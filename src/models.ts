import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { config } from "./config";

export function makeEmbeddings(): OllamaEmbeddings {
  return new OllamaEmbeddings({
    model: config.embeddingModel,
    baseUrl: config.ollamaBaseUrl,
  });
}

export function makeChatModel(): ChatOllama {
  return new ChatOllama({
    model: config.chatModel,
    baseUrl: config.ollamaBaseUrl,
    temperature: 0,
  });
}
