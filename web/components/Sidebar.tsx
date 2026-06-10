"use client";

import { FileText } from "lucide-react";
import type { ConversationSummary, DocSummary, UploadItem } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";
import { ConversationList } from "./ConversationList";
import { DocumentPanel } from "./DocumentPanel";

interface Props {
  conversations: ConversationSummary[];
  currentId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  documents: DocSummary[];
  uploads: UploadItem[];
  onUpload: (files: FileList | File[]) => void;
  onRemoveDocument: (id: string) => void;
  onClearDocuments: () => void;
}

export function Sidebar({
  conversations,
  currentId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  documents,
  uploads,
  onUpload,
  onRemoveDocument,
  onClearDocuments,
}: Props) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30">
            <FileText className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Chat with your PDF</p>
            <p className="text-[11px] text-zinc-400">Local RAG · Ollama</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-3">
        <ConversationList
          conversations={conversations}
          currentId={currentId}
          onSelect={onSelectConversation}
          onNew={onNewChat}
          onDelete={onDeleteConversation}
        />
        <DocumentPanel
          documents={documents}
          uploads={uploads}
          onUpload={onUpload}
          onRemove={onRemoveDocument}
          onClear={onClearDocuments}
        />
      </div>
    </aside>
  );
}
