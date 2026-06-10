import { MessageSquareText } from "lucide-react";

export function EmptyState({ hasDocs, onPick }: { hasDocs: boolean; onPick: (t: string) => void }) {
  const tips = hasDocs
    ? ["Summarize the documents", "What are the key points?", "What does it say about deadlines?"]
    : [];
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {hasDocs ? "Ask anything about your documents" : "Upload a file to get started"}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {hasDocs
          ? "Every answer is grounded in your files and shows the snippet and page it came from."
          : "Drop a PDF, DOCX, TXT or MD file into the sidebar, then ask away."}
      </p>
      {tips.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {tips.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
