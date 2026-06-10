"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { SourceRef } from "@/lib/types";
import { jumpUrl } from "@/lib/api";

export function SourceCard({ source }: { source: SourceRef }) {
  const [open, setOpen] = useState(false);
  const url = jumpUrl(source);
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20">
          {source.label}
        </span>
        {url && source.page && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            jump to page {source.page}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {source.snippet && (
        <p
          onClick={() => setOpen((o) => !o)}
          title="Click to expand"
          className={`mt-2 cursor-pointer text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400 ${
            open ? "" : "line-clamp-3"
          }`}
        >
          {source.snippet}
        </p>
      )}
    </div>
  );
}
