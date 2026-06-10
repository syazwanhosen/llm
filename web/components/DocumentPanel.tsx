"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import type { DocSummary, UploadItem } from "@/lib/types";

interface Props {
  documents: DocSummary[];
  uploads: UploadItem[];
  onUpload: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function DocumentPanel({ documents, uploads, onUpload, onRemove, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Documents</span>
        {documents.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            Clear all
          </button>
        )}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onUpload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition ${
          drag
            ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
            : "border-zinc-300 bg-zinc-50/60 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-indigo-500/5"
        }`}
      >
        <UploadCloud className="h-5 w-5 text-indigo-500" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Upload files</span>
        <span className="text-xs text-zinc-400">PDF, DOCX, TXT, MD — drop or click</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          hidden
          onChange={(e) => {
            if (e.target.files) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {uploads.map((u) => (
            <UploadRow key={u.id} item={u} />
          ))}
        </ul>
      )}

      <ul className="mt-2 space-y-1.5">
        {documents.length === 0 && uploads.length === 0 ? (
          <p className="px-1 py-2 text-center text-xs text-zinc-400">No documents yet.</p>
        ) : (
          documents.map((d) => (
            <li
              key={d.id}
              className="group flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium" title={d.name}>
                  {d.name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {d.pages > 0 ? `${d.pages} page${d.pages === 1 ? "" : "s"} · ` : ""}
                  {d.chunks} chunk{d.chunks === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => onRemove(d.id)}
                aria-label="Remove document"
                className="text-zinc-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const pct = Math.round(item.percent);
  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="truncate font-medium">{item.name}</span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 ${
            item.status === "error"
              ? "text-red-500"
              : item.status === "done"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-400"
          }`}
        >
          {item.status === "uploading" && <>{pct}%</>}
          {item.status === "indexing" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Indexing…
            </>
          )}
          {item.status === "done" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> {item.chunks} chunks
            </>
          )}
          {item.status === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5" /> {item.error || "Failed"}
            </>
          )}
        </span>
      </div>
      {item.status !== "error" && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] ${
              item.status === "done" ? "bg-emerald-500" : "bg-indigo-500"
            } ${item.status === "indexing" ? "animate-pulse" : ""}`}
            style={{ width: `${item.status === "uploading" ? pct : 100}%` }}
          />
        </div>
      )}
    </li>
  );
}
