"use client";

import { useState } from "react";

interface Props {
  title: string;
  /** Nội dung hiển thị + copy. */
  text: string;
  /** Link tải file từ server. */
  href: string;
  filename: string;
  note?: string | null;
  onClose: () => void;
}

export default function ExportModal({ title, text, href, filename, note, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
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
          <h2 className="text-lg font-semibold">{title}</h2>
          {note && <span className="text-sm text-yellow-700">{note}</span>}
          <div className="ml-auto flex gap-2 text-sm">
            <button onClick={copy} className="rounded border border-neutral-400 px-3 py-1.5">
              {copied ? "Đã copy" : "Copy"}
            </button>
            <a href={href} download={filename} className="rounded bg-blue-600 px-3 py-1.5 text-white">
              Download .md
            </a>
            <button onClick={onClose} className="rounded px-3 py-1.5 text-neutral-500">
              Đóng
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto rounded bg-neutral-100 p-3 font-mono text-xs whitespace-pre-wrap dark:bg-neutral-950">
          {text}
        </pre>
      </div>
    </div>
  );
}
