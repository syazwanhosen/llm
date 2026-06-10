// Shapes returned by the Hono backend (kept in sync with src/server.ts).

export interface DocSummary {
  id: string;
  name: string;
  chunks: number;
  pages: number;
}

export interface SourceRef {
  docId: string | null;
  source: string;
  page: number | null;
  label: string;
  snippet: string;
  fileUrl?: string | null; // added by the server when the original is on disk
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  ts?: number;
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

export type UploadStatus = "uploading" | "indexing" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  status: UploadStatus;
  percent: number;
  chunks?: number;
  error?: string;
}

// A message as held in the UI (assistant messages may still be streaming).
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  streaming?: boolean;
  error?: boolean;
}
