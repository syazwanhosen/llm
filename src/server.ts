import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";
import { config } from "./config";
import { makeEmbeddings } from "./models";
import { loadOrCreateStore, saveStore } from "./vectorStore";
import { streamAnswer } from "./graph";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const embeddings = makeEmbeddings();
let store = await loadOrCreateStore(embeddings, config.storePath);
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: config.chunkSize,
  chunkOverlap: config.chunkOverlap,
});

// Serialize store mutations so concurrent uploads/removes don't clobber the JSON.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

interface DocSummary {
  id: string;
  name: string;
  chunks: number;
  pages: number;
}

// Derive the document list straight from the persisted vectors' metadata —
// each chunk carries its docId, source filename, and page number.
function listDocuments(): DocSummary[] {
  const groups = new Map<string, { name: string; chunks: number; pages: Set<number> }>();
  for (const v of store.memoryVectors) {
    const meta = (v.metadata ?? {}) as Record<string, any>;
    const id = String(meta.docId ?? meta.source ?? "unknown");
    const name = meta.source ? String(meta.source).split(/[\\/]/).pop()! : "unknown";
    const page = meta.loc?.pageNumber as number | undefined;
    const g = groups.get(id) ?? { name, chunks: 0, pages: new Set<number>() };
    g.chunks += 1;
    if (page) g.pages.add(page);
    groups.set(id, g);
  }
  return [...groups.entries()].map(([id, g]) => ({
    id,
    name: g.name,
    chunks: g.chunks,
    pages: g.pages.size,
  }));
}

const app = new Hono();

app.get("/", async (c) => c.html(await readFile(join(PUBLIC_DIR, "index.html"), "utf8")));

app.get("/api/documents", (c) => c.json({ documents: listDocuments() }));

app.post("/api/upload", async (c) => {
  const body = await c.req.parseBody({ all: true });
  const raw = body["files"];
  const files = (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as unknown[];
  if (files.length === 0) return c.json({ error: "No files uploaded." }, 400);

  const results: { name: string; chunks?: number; pages?: number; error?: string }[] = [];

  await withLock(async () => {
    for (const f of files as any[]) {
      const name: string = f?.name ?? "upload.pdf";
      if (typeof f?.arrayBuffer !== "function" || !/\.pdf$/i.test(name)) {
        results.push({ name, error: "Not a PDF file." });
        continue;
      }
      try {
        const pages = (await new PDFLoader(f as any, { splitPages: true }).load()) as Document[];
        const docId = randomUUID();
        for (const p of pages) p.metadata = { ...p.metadata, source: name, docId };
        const chunks = await splitter.splitDocuments(pages);
        if (chunks.length === 0) {
          results.push({ name, error: "No text layer found (is it a scanned PDF?)." });
          continue;
        }
        await store.addDocuments(chunks);
        results.push({ name, chunks: chunks.length, pages: pages.length });
      } catch (err) {
        results.push({ name, error: (err as Error).message });
      }
    }
    await saveStore(store, config.storePath);
  });

  return c.json({ results, documents: listDocuments() });
});

app.delete("/api/documents/:id", async (c) => {
  const id = c.req.param("id");
  await withLock(async () => {
    store.memoryVectors = store.memoryVectors.filter((v) => {
      const meta = (v.metadata ?? {}) as Record<string, any>;
      return String(meta.docId ?? meta.source ?? "unknown") !== id;
    });
    await saveStore(store, config.storePath);
  });
  return c.json({ documents: listDocuments() });
});

app.post("/api/documents/clear", async (c) => {
  await withLock(async () => {
    store.memoryVectors = [];
    await saveStore(store, config.storePath);
  });
  return c.json({ documents: listDocuments() });
});

app.post("/api/chat", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as { question?: string };
  const q = (data.question ?? "").trim();
  return streamSSE(c, async (stream) => {
    if (!q) {
      await stream.writeSSE({ event: "error", data: "Empty question." });
      return;
    }
    try {
      const { sources, stream: tokens } = await streamAnswer(store, q);
      for await (const token of tokens) {
        await stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) });
      }
      await stream.writeSSE({ event: "sources", data: JSON.stringify(sources) });
      await stream.writeSSE({ event: "done", data: "1" });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: (err as Error).message });
    }
  });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`\n  Chat with your PDF — web UI on http://localhost:${info.port}\n`);
});
