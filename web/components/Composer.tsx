"use client";

import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

export function Composer({ onSend, disabled }: { onSend: (t: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  }

  return (
    <div className="border-t border-zinc-200 bg-white/70 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 pl-4 shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder="Ask a question about your documents…"
          onChange={(e) => {
            setValue(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 160) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-zinc-400"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-[18px] w-[18px]" />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-400">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
