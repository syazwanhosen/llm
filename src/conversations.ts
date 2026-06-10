import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Server-side chat history. Mirrors vectorStore.ts: the whole list lives in
// memory and is rewritten to a single JSON file on each mutation (under the
// server's existing withLock mutex, so it never interleaves with store writes).
// Documents / vectors stay GLOBAL — a conversation never filters them.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: unknown[]; // structured SourceRef[] (augmented with fileUrl) on assistant turns
  ts: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export async function loadConversations(filePath: string): Promise<Conversation[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { conversations?: Conversation[] };
    return Array.isArray(parsed.conversations) ? parsed.conversations : [];
  } catch {
    return [];
  }
}

export async function saveConversations(list: Conversation[], filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ conversations: list }), "utf8");
}

// Summaries, newest-updated first, without the (potentially large) message bodies.
export function listSummaries(list: Conversation[]): ConversationSummary[] {
  return [...list]
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
    .map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
}

export function getConversation(list: Conversation[], id: string): Conversation | undefined {
  return list.find((c) => c.id === id);
}

export function createConversation(list: Conversation[], title = "New chat"): Conversation {
  const now = Date.now();
  const conv: Conversation = { id: randomUUID(), title, createdAt: now, updatedAt: now, messages: [] };
  list.push(conv);
  return conv;
}

export function deleteConversation(list: Conversation[], id: string): boolean {
  const i = list.findIndex((c) => c.id === id);
  if (i === -1) return false;
  list.splice(i, 1);
  return true;
}

// Append a message; no-op if the conversation was deleted (so a stale in-flight
// write can't resurrect it). Bumps updatedAt for list ordering.
export function appendMessage(list: Conversation[], id: string, msg: ChatMessage): boolean {
  const conv = getConversation(list, id);
  if (!conv) return false;
  conv.messages.push(msg);
  conv.updatedAt = msg.ts;
  return true;
}

export function renameConversation(list: Conversation[], id: string, title: string): boolean {
  const conv = getConversation(list, id);
  if (!conv) return false;
  conv.title = title;
  return true;
}

export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 60 ? clean.slice(0, 60).trimEnd() + "…" : clean;
}
