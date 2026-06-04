import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

// MemoryVectorStore is in-memory only, so we persist its raw vectors to a JSON
// file. This lets `ingest` (embed once) and `query` (read many) run as
// separate processes without re-embedding on every run.

export async function saveStore(store: MemoryVectorStore, filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store.memoryVectors), "utf8");
}

export async function loadStore(
  embeddings: EmbeddingsInterface,
  filePath: string,
): Promise<MemoryVectorStore | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const store = new MemoryVectorStore(embeddings);
  store.memoryVectors = JSON.parse(raw);
  return store;
}
