# Hugging Face Space (Docker SDK, free CPU) — Ollama + the web app in ONE container.
# The app and the (small) models are baked in, so the Space boots without downloading.
# Built from github.com/syazwanhosen/llm. See HF_DEPLOY.md for setup steps.
FROM ollama/ollama

ENV DEBIAN_FRONTEND=noninteractive

# The base image is Ubuntu-based and runs Ollama; add Node 20 + git on top.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg git \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# HF Spaces run the container as UID 1000; only $HOME is writable.
RUN (id -u 1000 >/dev/null 2>&1 || useradd -m -u 1000 user) \
 && mkdir -p /home/user/app && chown -R 1000:1000 /home/user

ENV HOME=/home/user \
    OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_MODELS=/home/user/.ollama/models \
    OLLAMA_BASE_URL=http://127.0.0.1:11434 \
    CHAT_MODEL=llama3.2:1b \
    EMBEDDING_MODEL=nomic-embed-text \
    STORE_PATH=/home/user/app/data/vector-store.json \
    PORT=7860 \
    NODE_ENV=production

USER 1000
WORKDIR /home/user/app

# App code (pinned to main — Factory-rebuild the Space to pick up new commits).
RUN git clone --depth 1 https://github.com/syazwanhosen/llm.git . \
 && npm ci --legacy-peer-deps --include=dev

# Bake the models into the image so the Space starts instantly (no re-download).
RUN ollama serve & pid=$!; \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    ollama pull "$CHAT_MODEL"; \
    ollama pull "$EMBEDDING_MODEL"; \
    kill $pid

EXPOSE 7860
ENTRYPOINT []

# Start Ollama in the background, wait for it, then launch the web app on :7860.
CMD ollama serve & \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    npm run web
