# LangGraph RAG over docs (local, Ollama)

A small but complete **Retrieval-Augmented Generation** app that answers questions about a
website or documentation site. It runs **fully locally** with [Ollama](https://ollama.com) —
no API keys, no cost.

Built with:

- **LangChain.js** — document loading, splitting, embeddings, and the vector store.
- **LangGraph.js** — orchestrates the RAG flow as an explicit state graph (`retrieve → generate`).
- **RAG** — crawl pages, embed chunks into a vector store, retrieve the most relevant chunks at
  query time, and ground the LLM's answer in them.

## How it works

```
            ┌──────────┐      docs found      ┌──────────┐
  question ─►│ retrieve │──────────────────────►│ generate │──► answer
            └──────────┘                       └──────────┘
                  │  no docs found                  ▲
                  └──────────► no_context ──────────┘ (skips the LLM call)
```

1. **Ingest** (`npm run ingest`): crawl the source URL, strip HTML to text, split into
   overlapping chunks, embed each chunk with Ollama, and save the vectors to
   `data/vector-store.json`.
2. **Query** (`npm run query` / `npm start`): embed the question, retrieve the top-`k` chunks
   from the saved store, and ask the LLM to answer using only that context. A conditional edge
   short-circuits to a "couldn't find anything" reply when retrieval is empty.

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

## Usage

**1. Ingest a site** (defaults to the LangChain.js docs intro page):

```bash
npm run ingest                                   # uses SOURCE_URL from .env
npm run ingest -- https://docs.python.org/3/     # or pass a URL
```

Increase `CRAWL_MAX_DEPTH` in `.env` to follow links deeper (depth `0` = just the one page).

**2. Ask questions:**

```bash
npm start                              # interactive REPL
npm run query -- "What is LangGraph?"  # one-shot question
```

## Configuration

All settings are environment variables (see `.env.example`):

| Variable           | Default                                          | Description                          |
| ------------------ | ------------------------------------------------ | ------------------------------------ |
| `OLLAMA_BASE_URL`  | `http://localhost:11434`                         | Ollama server URL                    |
| `CHAT_MODEL`       | `llama3.1`                                        | Ollama chat model                    |
| `EMBEDDING_MODEL`  | `nomic-embed-text`                               | Ollama embedding model               |
| `SOURCE_URL`       | `https://js.langchain.com/docs/introduction/`    | Page to crawl on ingest              |
| `CRAWL_MAX_DEPTH`  | `1`                                              | How many link levels to follow       |
| `CHUNK_SIZE`       | `1000`                                           | Characters per chunk                 |
| `CHUNK_OVERLAP`    | `200`                                            | Overlap between chunks               |
| `TOP_K`            | `4`                                              | Chunks retrieved per question        |
| `STORE_PATH`       | `data/vector-store.json`                         | Where the vector store is persisted  |

## Project structure

```
src/
  config.ts        env-driven configuration
  models.ts        Ollama chat model + embeddings factories
  ingest.ts        crawl → extract → split → embed → persist
  vectorStore.ts   JSON persistence for the in-memory vector store
  graph.ts         the LangGraph RAG state graph
  index.ts         CLI entry point (ingest / query / REPL)
```

## Notes & extension ideas

- The vector store is an in-memory store persisted to JSON — great for demos and small/medium
  corpora. For larger datasets, swap in a persistent store (e.g. PGVector, Chroma) in
  `vectorStore.ts` / `ingest.ts`.
- The graph is intentionally minimal. Because it's a real `StateGraph`, it's easy to extend with
  extra nodes — e.g. a document-relevance grader, query rewriting, or web-search fallback for a
  more "agentic" / corrective RAG.
