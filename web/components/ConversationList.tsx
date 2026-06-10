"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { ConversationSummary } from "@/lib/types";

interface Props {
  conversations: ConversationSummary[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, currentId, onSelect, onNew, onDelete }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Chats</span>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      {conversations.length === 0 ? (
        <p className="px-1 py-1.5 text-xs text-zinc-400">No chats yet — ask a question to start one.</p>
      ) : (
        <ul className="space-y-0.5">
          {conversations.map((c) => (
            <li
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                c.id === currentId
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
              }`}
            >
              <span className="flex-1 truncate" title={c.title}>
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                aria-label="Delete chat"
                className="text-zinc-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
