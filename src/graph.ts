import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { Document } from "@langchain/core/documents";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { config } from "./config";
import { makeChatModel } from "./models";

// Shared state passed between graph nodes.
const GraphState = Annotation.Root({
  question: Annotation<string>,
  documents: Annotation<Document[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  answer: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

type State = typeof GraphState.State;

const NO_CONTEXT_MESSAGE =
  "I couldn't find anything relevant in the document.";

// A short, human-readable label for where a chunk came from — "page N" for
// PDFs (PDFLoader sets loc.pageNumber), otherwise the source URL/path.
export function describeSource(doc: Document): string {
  const page = doc.metadata?.loc?.pageNumber;
  if (page) return `page ${page}`;
  return String(doc.metadata?.source ?? "unknown source");
}

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant answering questions about a single document. " +
      "Use ONLY the context below to answer. If the answer is not in the context, " +
      "say you don't know — do not use outside knowledge or make anything up. " +
      'Cite the source label (e.g. "page 2") for the facts you use.\n\nContext:\n{context}',
  ],
  ["human", "{question}"],
]);

export function buildGraph(store: MemoryVectorStore) {
  const retriever = store.asRetriever({ k: config.topK });
  const chain = prompt.pipe(makeChatModel()).pipe(new StringOutputParser());

  async function retrieve(state: State): Promise<Partial<State>> {
    const documents = await retriever.invoke(state.question);
    return { documents };
  }

  async function generate(state: State): Promise<Partial<State>> {
    const context = state.documents
      .map((d) => `[${describeSource(d)}]\n${d.pageContent}`)
      .join("\n\n---\n\n");
    const answer = await chain.invoke({ context, question: state.question });
    return { answer };
  }

  function noContext(): Partial<State> {
    return { answer: NO_CONTEXT_MESSAGE };
  }

  // Skip the (slow) LLM call entirely when retrieval comes back empty.
  function routeAfterRetrieve(state: State): "generate" | "no_context" {
    return state.documents.length > 0 ? "generate" : "no_context";
  }

  return new StateGraph(GraphState)
    .addNode("retrieve", retrieve)
    .addNode("generate", generate)
    .addNode("no_context", noContext)
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", routeAfterRetrieve, {
      generate: "generate",
      no_context: "no_context",
    })
    .addEdge("generate", END)
    .addEdge("no_context", END)
    .compile();
}
