import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import * as cheerio from "cheerio";
import { config } from "./config";
import { makeEmbeddings } from "./models";
import { saveStore } from "./vectorStore";

function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export async function ingest(url: string = config.sourceUrl): Promise<void> {
  console.log(`Crawling ${url} (maxDepth=${config.crawlMaxDepth})...`);
  const loader = new RecursiveUrlLoader(url, {
    extractor: extractText,
    maxDepth: config.crawlMaxDepth,
    timeout: 10_000,
    preventOutside: true,
  });
  const docs = await loader.load();
  console.log(`Fetched ${docs.length} page(s).`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  const chunks = await splitter.splitDocuments(docs);
  if (chunks.length === 0) {
    throw new Error("No content extracted — check SOURCE_URL and your network connection.");
  }
  console.log(`Split into ${chunks.length} chunk(s). Embedding with "${config.embeddingModel}"...`);

  const embeddings = makeEmbeddings();
  const store = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  await saveStore(store, config.storePath);
  console.log(`Done. Vector store saved to ${config.storePath}.`);
}
