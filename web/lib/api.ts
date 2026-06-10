import type {
  Conversation,
  ConversationSummary,
  DocSummary,
  SourceRef,
} from "./types";

// All requests are relative; next.config.ts rewrites /api/* to the Hono backend.

export async function getDocuments(): Promise<DocSummary[]> {
  const r = await fetch("/api/documents");
  return (await r.json()).documents ?? [];
}

export async function removeDocument(id: string): Promise<DocSummary[]> {
  const r = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
  return (await r.json()).documents ?? [];
}

export async function clearDocuments(): Promise<DocSummary[]> {
  const r = await fetch("/api/documents/clear", { method: "POST" });
  return (await r.json()).documents ?? [];
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const r = await fetch("/api/conversations");
  return (await r.json()).conversations ?? [];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const r = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  return (await r.json()).conversation ?? null;
}

export async function deleteConversation(id: string): Promise<ConversationSummary[]> {
  const r = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
  return (await r.json()).conversations ?? [];
}

export interface UploadResult {
  name: string;
  chunks?: number;
  pages?: number;
  error?: string;
}

// Upload one file via XHR so we get real upload progress (fetch can't report it).
export function uploadFile(
  file: File,
  handlers: { onProgress?: (pct: number) => void; onIndexing?: () => void },
): Promise<{ result: UploadResult; documents: DocSummary[] }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("files", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) handlers.onProgress?.((e.loaded / e.total) * 100);
    };
    xhr.upload.onload = () => handlers.onIndexing?.();
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) {
          resolve({ result: { name: file.name, error: data.error || `HTTP ${xhr.status}` }, documents: [] });
          return;
        }
        resolve({ result: (data.results || [])[0] || { name: file.name }, documents: data.documents || [] });
      } catch {
        reject(new Error("Bad response from server"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

export interface ChatHandlers {
  onMeta?: (m: { conversationId: string; title: string }) => void;
  onToken?: (t: string) => void;
  onSources?: (s: SourceRef[]) => void;
  onError?: (msg: string) => void;
  signal?: AbortSignal;
}

// POST a question and consume the SSE stream, dispatching parsed events.
export async function streamChat(
  body: { question: string; conversationId: string | null },
  h: ChatHandlers,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: h.signal,
  });
  if (!res.body) {
    h.onError?.("No response from server.");
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
      }
      const data = dataLines.join("\n");
      if (event === "meta") h.onMeta?.(JSON.parse(data));
      else if (event === "token") h.onToken?.(JSON.parse(data).text);
      else if (event === "sources") h.onSources?.(JSON.parse(data));
      else if (event === "error") h.onError?.(data);
    }
  }
}

// Build the "jump to page" URL for a citation (PDFs only get a #page anchor).
export function jumpUrl(src: SourceRef): string | null {
  if (!src.fileUrl) return null;
  return src.page ? `${src.fileUrl}#page=${src.page}` : src.fileUrl;
}
