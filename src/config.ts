import "dotenv/config";

export const config = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  chatModel: process.env.CHAT_MODEL ?? "llama3.1",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
  sourceUrl: process.env.SOURCE_URL ?? "https://js.langchain.com/docs/introduction/",
  crawlMaxDepth: Number(process.env.CRAWL_MAX_DEPTH ?? 1),
  chunkSize: Number(process.env.CHUNK_SIZE ?? 1000),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 200),
  topK: Number(process.env.TOP_K ?? 4),
  storePath: process.env.STORE_PATH ?? "data/vector-store.json",
};
