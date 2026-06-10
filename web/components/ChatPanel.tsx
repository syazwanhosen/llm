"use client";

import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import type { UIMessage } from "@/lib/types";
import { Message } from "./Message";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";

interface Props {
  messages: UIMessage[];
  hasDocs: boolean;
  busy: boolean;
  onSend: (t: string) => void;
  onOpenNav: () => void;
}

export function ChatPanel({ messages, hasDocs, busy, onSend, onOpenNav }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-6">
        <button
          onClick={onOpenNav}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight">Ask your documents</h1>
          <p className="text-xs text-zinc-400">Grounded answers with cited snippets and page links.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState hasDocs={hasDocs} onPick={onSend} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <Composer onSend={onSend} disabled={busy} />
    </main>
  );
}
