"use client";

import { useMemo, useState } from "react";
import { assembleMarkdown } from "@/lib/assemble";
import type { ChunkDTO } from "@/lib/types";

interface Props {
  jobId: string;
  name: string;
  chunks: ChunkDTO[];
  onClose: () => void;
}

export default function ExportModal({ jobId, name, chunks, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const md = useMemo(() => assembleMarkdown(chunks), [chunks]);
  const untranslated = chunks.filter((c) => c.status !== "done" && c.status !== "skipped").length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-6xl flex-col rounded bg-white p-4 shadow-xl dark:bg-neutral-900"
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Export</h2>
          {untranslated > 0 && (
            <span className="text-sm text-yellow-700">
              {untranslated} chunk chưa dịch → giữ source gốc + marker
            </span>
          )}
          <div className="ml-auto flex gap-2 text-sm">
            <button onClick={copy} className="rounded border border-neutral-400 px-3 py-1.5">
              {copied ? "Đã copy" : "Copy"}
            </button>
            <a
              href={`/api/jobs/${jobId}/export`}
              download={`${name.replace(/\.md$/i, "")}.vi.md`}
              className="rounded bg-blue-600 px-3 py-1.5 text-white"
            >
              Download .md
            </a>
            <button onClick={onClose} className="rounded px-3 py-1.5 text-neutral-500">
              Đóng
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto rounded bg-neutral-100 p-3 font-mono text-xs whitespace-pre-wrap dark:bg-neutral-950">
          {md}
        </pre>
      </div>
    </div>
  );
}
