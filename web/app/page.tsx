"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";
import * as api from "@/lib/api";
import type {
  ConversationSummary,
  DocSummary,
  UIMessage,
  UploadItem,
} from "@/lib/types";

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export default function Home() {
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const refreshDocs = useCallback(async () => setDocuments(await api.getDocuments()), []);
  const refreshConvos = useCallback(async () => setConversations(await api.getConversations()), []);

  useEffect(() => {
    refreshDocs();
    refreshConvos();
  }, [refreshDocs, refreshConvos]);

  // ---------- uploads ----------
  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    for (const file of [...files]) {
      const id = nextId();
      if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) {
        setUploads((prev) => [...prev, { id, name: file.name, status: "error", percent: 0, error: "Unsupported type" }]);
        setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== id)), 4000);
        continue;
      }
      setUploads((prev) => [...prev, { id, name: file.name, status: "uploading", percent: 0 }]);
      try {
        const { result, documents: docs } = await api.uploadFile(file, {
          onProgress: (pct) => patchUpload(id, { status: "uploading", percent: pct }),
          onIndexing: () => patchUpload(id, { status: "indexing", percent: 100 }),
        });
        if (result.error) {
          patchUpload(id, { status: "error", error: result.error });
        } else {
          patchUpload(id, { status: "done", percent: 100, chunks: result.chunks });
          setDocuments(docs);
          setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== id)), 4000);
        }
      } catch (e) {
        patchUpload(id, { status: "error", error: (e as Error).message });
      }
    }
  }, []);

  // ---------- documents ----------
  const removeDoc = useCallback(async (id: string) => setDocuments(await api.removeDocument(id)), []);
  const clearDocs = useCallback(async () => {
    if (!confirm("Remove all indexed documents?")) return;
    setDocuments(await api.clearDocuments());
  }, []);

  // ---------- conversations ----------
  const openConversation = useCallback(async (id: string) => {
    const conv = await api.getConversation(id);
    if (!conv) return;
    setCurrentId(id);
    setMessages(
      conv.messages.map((m) => ({ id: nextId(), role: m.role, content: m.content, sources: m.sources })),
    );
    setNavOpen(false);
  }, []);

  const newChat = useCallback(() => {
    setCurrentId(null);
    setMessages([]);
    setNavOpen(false);
  }, []);

  const deleteConv = useCallback(
    async (id: string) => {
      const list = await api.deleteConversation(id);
      setConversations(list);
      if (id === currentId) {
        setCurrentId(null);
        setMessages([]);
      }
    },
    [currentId],
  );

  // ---------- chat ----------
  const send = useCallback(
    async (text: string) => {
      if (busy) return;
      setBusy(true);
      const botId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: text },
        { id: botId, role: "assistant", content: "", streaming: true },
      ]);

      let convId = currentId;
      const update = (patch: Partial<UIMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));

      try {
        await api.streamChat(
          { question: text, conversationId: currentId },
          {
            onMeta: (m) => {
              // Adopt whatever id the server resolved/created (handles stale ids).
              if (m.conversationId && m.conversationId !== convId) {
                convId = m.conversationId;
                setCurrentId(m.conversationId);
                refreshConvos();
              }
            },
            onToken: (t) =>
              setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, content: m.content + t } : m))),
            onSources: (s) => update({ sources: s }),
            onError: (err) => update({ content: "⚠️ " + err, error: true, streaming: false }),
          },
        );
      } catch {
        update({ content: "⚠️ Request failed. Is the backend running on port 3000?", error: true });
      } finally {
        update({ streaming: false });
        setBusy(false);
        refreshConvos();
      }
    },
    [busy, currentId, refreshConvos],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />
      )}
      <div
        className={`${navOpen ? "fixed inset-y-0 left-0 z-50" : "hidden"} h-full md:static md:z-auto md:block`}
      >
        <Sidebar
          conversations={conversations}
          currentId={currentId}
          onSelectConversation={openConversation}
          onNewChat={newChat}
          onDeleteConversation={deleteConv}
          documents={documents}
          uploads={uploads}
          onUpload={handleUpload}
          onRemoveDocument={removeDoc}
          onClearDocuments={clearDocs}
        />
      </div>

      <ChatPanel
        messages={messages}
        hasDocs={documents.length > 0}
        busy={busy}
        onSend={send}
        onOpenNav={() => setNavOpen(true)}
      />
    </div>
  );
}
