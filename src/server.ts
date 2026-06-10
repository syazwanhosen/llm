import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bodyLimit } from "hono/body-limit";
import { getMimeType } from "hono/utils/mime";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { config } from "./config";
import { makeEmbeddings } from "./models";
import { loadOrCreateStore, saveStore } from "./vectorStore";
import { streamAnswer } from "./graph";
import type { SourceRef } from "./graph";
import { loadUploadedFile, fileExtension } from "./loaders";
import {
  loadConversations,
  saveConversations,
  listSummaries,
  getConversation,
  createConversation,
  deleteConversation,
  appendMessage,
  renameConversation,
  deriveTitle,
} from "./conversations";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const embeddings = makeEmbeddings();
let store = await loadOrCreateStore(embeddings, config.storePath);
const conversations = await loadConversations(config.conversationsPath);
await mkdir(config.uploadsPath, { recursive: true });
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: config.chunkSize,
  chunkOverlap: config.chunkOverlap,
});

// Serialize all persistence (vectors, uploaded files, conversations) so
// concurrent requests can't clobber the JSON files or interleave writes.
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
// each chunk carries its docId, source filename, and (for PDFs) page number.
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

// Find the persisted original file for a docId (set in /api/upload).
function findUpload(docId: string): { storedFile: string; source: string } | null {
  for (const v of store.memoryVectors) {
    const meta = (v.metadata ?? {}) as Record<string, any>;
    if (meta.docId === docId && meta.storedFile) {
      return { storedFile: String(meta.storedFile), source: String(meta.source ?? meta.storedFile) };
    }
  }
  return null;
}

function uploadPathFor(docId: string): string | null {
  const u = findUpload(docId);
  if (!u) return null;
  const p = join(config.uploadsPath, u.storedFile);
  return existsSync(p) ? p : null;
}

interface SourceRefWire extends SourceRef {
  fileUrl: string | null; // `/api/files/<docId>` when the original is on disk, else null
}

// The graph can't see the filesystem, so the server adds the "jump to page" link.
function augmentSource(ref: SourceRef): SourceRefWire {
  const path = ref.docId ? uploadPathFor(ref.docId) : null;
  return { ...ref, fileUrl: path ? `/api/files/${ref.docId}` : null };
}

const app = new Hono();

app.get("/", async (c) => c.html(await readFile(join(PUBLIC_DIR, "index.html"), "utf8")));

// ---------- Documents ----------

app.get("/api/documents", (c) => c.json({ documents: listDocuments() }));

app.post(
  "/api/upload",
  bodyLimit({
    maxSize: config.maxUploadMb * 1024 * 1024,
    onError: (c) => c.json({ error: `Upload too large (max ${config.maxUploadMb} MB per request).` }, 413),
  }),
  async (c) => {
  const body = await c.req.parseBody({ all: true });
  const raw = body["files"];
  const files = (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as unknown[];
  if (files.length === 0) return c.json({ error: "No files uploaded." }, 400);

  const results: { name: string; chunks?: number; pages?: number; error?: string }[] = [];

  await withLock(async () => {
    for (const f of files as any[]) {
      const name: string = f?.name ?? "upload";
      if (typeof f?.arrayBuffer !== "function") {
        results.push({ name, error: "Invalid upload." });
        continue;
      }
      try {
        const ext = fileExtension(name);
        const buf = Buffer.from(await f.arrayBuffer());
        const docs = await loadUploadedFile(new Blob([buf]), name);
        const docId = randomUUID();
        const storedFile = `${docId}${ext}`;
        for (const d of docs) d.metadata = { ...d.metadata, source: name, docId, storedFile, ext };
        const chunks = await splitter.splitDocuments(docs);
        if (chunks.length === 0) {
          results.push({ name, error: "No text could be extracted (empty or scanned file?)." });
          continue;
        }
        await store.addDocuments(chunks);
        await writeFile(join(config.uploadsPath, storedFile), buf);
        results.push({ name, chunks: chunks.length, pages: ext === ".pdf" ? docs.length : 0 });
      } catch (err) {
        results.push({ name, error: (err as Error).message });
      }
    }
    await saveStore(store, config.storePath);
  });

  return c.json({ results, documents: listDocuments() });
  },
);

app.delete("/api/documents/:id", async (c) => {
  const id = c.req.param("id");
  await withLock(async () => {
    const storedFiles = new Set<string>();
    for (const v of store.memoryVectors) {
      const meta = (v.metadata ?? {}) as Record<string, any>;
      if (String(meta.docId ?? meta.source ?? "unknown") === id && meta.storedFile) {
        storedFiles.add(String(meta.storedFile));
      }
    }
    store.memoryVectors = store.memoryVectors.filter((v) => {
      const meta = (v.metadata ?? {}) as Record<string, any>;
      return String(meta.docId ?? meta.source ?? "unknown") !== id;
    });
    for (const sf of storedFiles) await unlink(join(config.uploadsPath, sf)).catch(() => {});
    await saveStore(store, config.storePath);
  });
  return c.json({ documents: listDocuments() });
});

app.post("/api/documents/clear", async (c) => {
  await withLock(async () => {
    const storedFiles = new Set<string>();
    for (const v of store.memoryVectors) {
      const sf = (v.metadata as Record<string, any> | undefined)?.storedFile;
      if (sf) storedFiles.add(String(sf));
    }
    store.memoryVectors = [];
    for (const sf of storedFiles) await unlink(join(config.uploadsPath, sf)).catch(() => {});
    await saveStore(store, config.storePath);
  });
  return c.json({ documents: listDocuments() });
});

// Serve an uploaded original inline, so the browser can "jump to page" in PDFs.
app.get("/api/files/:docId", async (c) => {
  const id = c.req.param("docId");
  if (!/^[A-Za-z0-9-]+$/.test(id)) return c.text("Invalid id", 400);
  const found = findUpload(id);
  if (!found) return c.text("Not found", 404);
  const path = join(config.uploadsPath, found.storedFile);
  if (!existsSync(path)) return c.text("Not found", 404);
  const bytes = await readFile(path);
  c.header("Content-Type", getMimeType(found.storedFile) ?? "application/octet-stream");
  c.header("Content-Disposition", `inline; filename="${found.source.replace(/["\r\n]/g, "")}"`);
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(new Uint8Array(bytes).buffer);
});

// ---------- Conversations ----------

app.get("/api/conversations", (c) => c.json({ conversations: listSummaries(conversations) }));

app.post("/api/conversations", async (c) => {
  const conv = await withLock(async () => {
    const created = createConversation(conversations);
    await saveConversations(conversations, config.conversationsPath);
    return created;
  });
  return c.json({ conversation: conv });
});

app.get("/api/conversations/:id", (c) => {
  const conv = getConversation(conversations, c.req.param("id"));
  if (!conv) return c.json({ error: "Not found" }, 404);
  return c.json({ conversation: conv });
});

app.delete("/api/conversations/:id", async (c) => {
  const id = c.req.param("id");
  await withLock(async () => {
    deleteConversation(conversations, id);
    await saveConversations(conversations, config.conversationsPath);
  });
  return c.json({ conversations: listSummaries(conversations) });
});

app.post("/api/conversations/:id", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as { title?: string };
  const title = (data.title ?? "").trim();
  const id = c.req.param("id");
  await withLock(async () => {
    if (title) renameConversation(conversations, id, deriveTitle(title));
    await saveConversations(conversations, config.conversationsPath);
  });
  return c.json({ conversations: listSummaries(conversations) });
});

// ---------- Chat (streaming + history) ----------

app.post("/api/chat", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as {
    question?: string;
    conversationId?: string;
  };
  const q = (data.question ?? "").trim();
  if (!q) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "error", data: "Empty question." });
    });
  }

  // Resolve or create the conversation and persist the user message up front.
  const { convId, title } = await withLock(async () => {
    let conv = data.conversationId ? getConversation(conversations, data.conversationId) : undefined;
    if (!conv) conv = createConversation(conversations);
    if (conv.messages.length === 0) conv.title = deriveTitle(q);
    appendMessage(conversations, conv.id, { role: "user", content: q, ts: Date.now() });
    await saveConversations(conversations, config.conversationsPath);
    return { convId: conv.id, title: conv.title };
  });

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "meta", data: JSON.stringify({ conversationId: convId, title }) });

    let answer = "";
    let sources: SourceRefWire[] = [];
    let saved = false;
    const persistAssistant = async () => {
      if (saved) return;
      saved = true;
      await withLock(async () => {
        appendMessage(conversations, convId, { role: "assistant", content: answer, sources, ts: Date.now() });
        await saveConversations(conversations, config.conversationsPath);
      });
    };
    stream.onAbort(() => void persistAssistant());

    try {
      const { sources: refs, stream: tokens } = await streamAnswer(store, q);
      for await (const token of tokens) {
        answer += token;
        await stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) });
      }
      sources = refs.map(augmentSource);
      await stream.writeSSE({ event: "sources", data: JSON.stringify(sources) });
      await stream.writeSSE({ event: "done", data: "1" });
      await persistAssistant();
    } catch (err) {
      await stream.writeSSE({ event: "error", data: (err as Error).message });
      await persistAssistant();
    }
  });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`\n  Chat with your PDF — web UI on http://localhost:${info.port}\n`);
});
