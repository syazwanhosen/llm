# Web UI image — runs `npm run web` (Hono server + the RAG pipeline).
# node:20-slim is multi-arch, so this also builds on Oracle's Arm (Ampere A1)
# Always Free VMs. Pair it with an Ollama container — see docker-compose.yml.
FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching.
#   --legacy-peer-deps: @langchain/community declares a conflicting optional peer.
#   --include=dev: tsx/typescript are devDependencies but are needed to run.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --include=dev

# Copy the rest of the app (node_modules/ and data/ excluded via .dockerignore).
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "web"]
