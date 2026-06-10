import { Bot, User } from "lucide-react";
import type { UIMessage } from "@/lib/types";
import { SourceCard } from "./SourceCard";

export function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="min-w-0 max-w-[680px]">
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
            isUser
              ? "rounded-tr-md bg-indigo-600 text-white"
              : message.error
                ? "rounded-tl-md border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                : "rounded-tl-md border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          }`}
        >
          {message.content}
          {message.streaming &&
            (message.content ? (
              <span className="caret bg-indigo-500" />
            ) : (
              <TypingDots />
            ))}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 space-y-2">
            {message.sources.map((s, i) => (
              <SourceCard key={i} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}
