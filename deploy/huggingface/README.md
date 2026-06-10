---
title: Chat With Your PDF
emoji: 📄
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Chat with your PDF

A fully local RAG app (LangChain.js + LangGraph + Ollama) running entirely inside this Space —
upload one or more PDFs and ask questions answered **only** from them, with file + page citations.

Built from <https://github.com/syazwanhosen/llm>.

- Runs on **free CPU**, so the first answer after a cold start is slow while the model loads.
- Uses a small chat model (`llama3.2:1b`) for snappier CPU responses — change `CHAT_MODEL` in the
  `Dockerfile` to `llama3.1` for higher-quality (but slower) answers.
- Storage is ephemeral on the free tier: uploaded PDFs reset when the Space restarts.
