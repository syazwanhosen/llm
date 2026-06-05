import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { config } from "./config";
import { loadSource } from "./loaders";
import { makeEmbeddings } from "./models";
import { saveStore } from "./vectorStore";

export async function ingest(source: string = config.source): Promise<void> {
  const docs = await loadSource(source);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  const chunks = await splitter.splitDocuments(docs);
  if (chunks.length === 0) {
    throw new Error(
      `No text extracted from "${source}". If it's a scanned PDF (just images), ` +
        "it has no text layer to read.",
    );
  }
  console.log(`Split into ${chunks.length} chunk(s). Embedding with "${config.embeddingModel}"...`);

  const embeddings = makeEmbeddings();
  const store = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  await saveStore(store, config.storePath);
  console.log(`Done. Vector store saved to ${config.storePath}.`);
}
