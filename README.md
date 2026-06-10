# Chat with your PDF (local RAG, Ollama)

A small but complete **Retrieval-Augmented Generation** app: point it at a **PDF**, then ask
questions answered **only** from that file. It runs **fully locally** with
[Ollama](https://ollama.com) — no API keys, no cost. (It can also crawl a website instead of a
PDF — see [Use a website instead](#use-a-website-instead).)

Built with:

- **LangChain.js** — document loading (`PDFLoader`), text splitting, embeddings, and the vector store.
- **LangGraph.js** — orchestrates the RAG flow as an explicit state graph (`retrieve → generate`).
- **RAG** — read the PDF's text, embed chunks into a vector store, retrieve the most relevant
  chunks at query time, and ground the LLM's answer in them (with **page citations**).

> The PDF's **text layer** is read directly (via `PDFLoader` → `pdf-parse`) — no OCR/scanning.
> A scanned PDF that is just page images has no text to extract and won't work.

## How it works

```
            ┌──────────┐      chunks found     ┌──────────┐
  question ─►│ retrieve │──────────────────────►│ generate │──► answer (+ "page N" citations)
            └──────────┘                       └──────────┘
                  │  nothing found                  ▲
                  └──────────► no_context ──────────┘ (skips the LLM call)
```

1. **Ingest** (`npm run ingest`): read the PDF page by page, split into overlapping chunks
   (keeping each chunk's page number), embed each chunk with Ollama, and save the vectors to
   `data/vector-store.json`.
2. **Query** (`npm start` / `npm run query`): embed the question, retrieve the top-`k` chunks
   from the saved store, and ask the LLM to answer using **only** that context. A conditional
   edge short-circuits to a "couldn't find anything" reply when retrieval is empty.

## Prerequisites

1. **Node.js 20+**
2. **Ollama** running locally, with the two models pulled:

   ```bash
   ollama pull llama3.1          # chat model (any chat model works)
   ollama pull nomic-embed-text  # embedding model
   ```

   Check `ollama list` to see what you already have. To use a different chat model, set
   `CHAT_MODEL` in `.env`.

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env   # optional — defaults work out of the box
```

> `--legacy-peer-deps` is needed because `@langchain/community` declares an optional peer
> (`@getzep/zep-cloud`, unused here) with a conflicting version range.

A ready-to-use sample PDF ships at `samples/llm-handbook.pdf` (a fictional remote-work
handbook). Regenerate it any time with `npm run sample`.

## Web UI

For a modern browser experience — drag-and-drop **multiple files** (PDF, DOCX, TXT, MD), a chat
with **streaming** answers and **cited snippets**, **persisted multi-conversation** history, and a
document manager — start the web server:

```bash
npm run web        # then open http://localhost:3000
```

- **Upload:** drag files onto the sidebar (or click) — **PDF, DOCX, TXT, MD**, several at once.
  Each shows its own **upload + indexing progress**, then is split, embedded, and appended to the
  shared vector store. (PDFs keep page numbers; other formats are indexed as text.)
- **Chat:** ask in the main panel; answers stream in token by token. Each answer shows **citation
  cards** — the source label, a **"jump to page N"** link that opens the original PDF at that page,
  and the **exact snippet** the answer drew from (click to expand).
- **Conversations:** chat history is saved server-side. Use **+ New** to start a chat, click any
  past chat in the sidebar to resume it, or delete it with the × button.
- **Manage documents:** the sidebar lists each indexed file with its page/chunk counts; remove one
  with the × button, or wipe everything with **Clear all**.

The UI is served by a small [Hono](https://hono.dev) server (`src/server.ts`) that shares the
same ingestion pipeline, vector store, and grounding as the CLI. Uploaded originals are kept under
`data/uploads/` (to power the jump-to-page link) and chat history under `data/conversations.json`.
Set `PORT` in `.env` to change the port. Retrieval is single-turn and stays grounded — history is
for replay, not extra context.

## Usage (CLI)

**1. Ingest a PDF** (defaults to the bundled sample):

```bash
npm run ingest                          # uses SOURCE from .env (the sample PDF)
npm run ingest -- ./path/to/your.pdf    # or pass any PDF path
```

**2. Ask questions:**

```bash
npm start                                        # interactive REPL
npm run query -- "How many remote days per week?"   # one-shot question
```

Each answer lists the **source pages** it drew from, e.g. `Sources: page 1, page 2`.

Try these against the sample PDF:

- `What is the equipment stipend?` → $500 per year (page 2)
- `What are the core hours?` → 10:00 AM to 4:00 PM (page 1)
- `How long are meeting recordings kept?` → 90 days (page 2)
- `What is the capital of France?` → it won't answer (not in the document)

## Use a website instead

Set `SOURCE` to an `http(s)` URL and it crawls the page(s) instead of reading a PDF:

```bash
npm run ingest -- https://js.langchain.com/docs/introduction/
```

`CRAWL_MAX_DEPTH` controls how many link levels to follow (`0` = just that one page).

## Configuration

All settings are environment variables (see `.env.example`):

| Variable           | Default                     | Description                                          |
| ------------------ | --------------------------- | ---------------------------------------------------- |
| `OLLAMA_BASE_URL`  | `http://localhost:11434`    | Ollama server URL                                    |
| `CHAT_MODEL`       | `llama3.1`                  | Ollama chat model                                    |
| `EMBEDDING_MODEL`  | `nomic-embed-text`          | Ollama embedding model                               |
| `SOURCE`           | `samples/llm-handbook.pdf`  | A local PDF path **or** an `http(s)` URL to crawl    |
| `CRAWL_MAX_DEPTH`  | `1`                         | Link levels to follow (URL sources only)             |
| `CHUNK_SIZE`       | `1000`                      | Characters per chunk                                 |
| `CHUNK_OVERLAP`    | `200`                       | Overlap between chunks                               |
| `TOP_K`            | `4`                         | Chunks retrieved per question                        |
| `STORE_PATH`       | `data/vector-store.json`    | Where the vector store is persisted                  |
| `PORT`             | `3000`                      | Web UI server port (`npm run web`)                   |

## Deploy (free, self-hosted — no API keys)

Two **100% free** hosting paths, both keeping everything local (app + Ollama + models):

- **[Hugging Face Spaces](HF_DEPLOY.md)** (Docker, free CPU) — no VM and a public URL in minutes;
  the whole stack runs in one container ([`deploy/huggingface/`](deploy/huggingface)). Best for a
  quick public demo. Caveats: sleeps when idle, storage is ephemeral, CPU is slow (defaults to a
  small `llama3.2:1b` model).
- **[Oracle Cloud Always Free](DEPLOY.md)** (Arm VM, 24 GB RAM) — always-on with persistent storage;
  uses the repo's `Dockerfile` + `docker-compose.yml` (`docker compose up -d --build`).

## Project structure

```
src/
  config.ts        env-driven configuration
  models.ts        Ollama chat model + embeddings factories
  loaders.ts       source → Documents: PDF/DOCX/TXT/MD uploads, files, or URL crawl
  ingest.ts        load → split → embed → persist
  vectorStore.ts   JSON persistence for the in-memory vector store
  graph.ts         the LangGraph RAG state graph (+ cited snippets/pages + streaming)
  conversations.ts server-side chat-history persistence (multiple conversations)
  index.ts         CLI entry point (ingest / query / REPL)
  server.ts        Hono web server (upload / chat / documents / conversations / files)
public/
  index.html       the web UI (modern single-page app, no build step)
scripts/
  make-sample-pdf.mjs   generates the bundled sample PDF
```

## Notes & extension ideas

- The vector store is an in-memory store persisted to JSON — great for demos and small/medium
  documents. For larger corpora, swap in a persistent store (e.g. PGVector, Chroma) in
  `vectorStore.ts` / `ingest.ts`.
- The graph is intentionally minimal. Because it's a real `StateGraph`, it's easy to extend with
  extra nodes — e.g. a document-relevance grader, query rewriting, or multi-PDF support.
