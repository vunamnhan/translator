"use client";

import { useEffect, useState } from "react";
import type { ChunkDTO } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  translating: "bg-blue-200 text-blue-800 animate-pulse dark:bg-blue-900 dark:text-blue-200",
  done: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  skipped: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

/** Dòng đầu có chữ của chunk, để nhận diện nhanh khi thu gọn. */
function peek(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line ?? "(trống)").slice(0, 120);
}

interface Props {
  chunk: ChunkDTO;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSaveSource: (id: string, value: string) => void;
  onSaveTranslated: (id: string, value: string) => void;
  onRetranslate: (id: string) => void;
}

export default function ChunkBar({
  chunk,
  expanded,
  onToggle,
  onSaveSource,
  onSaveTranslated,
  onRetranslate,
}: Props) {
  const [src, setSrc] = useState(chunk.sourceOverride ?? chunk.source);
  const [dst, setDst] = useState(chunk.translated ?? "");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => setSrc(chunk.sourceOverride ?? chunk.source), [chunk.sourceOverride, chunk.source]);
  useEffect(() => setDst(chunk.translated ?? ""), [chunk.translated]);

  return (
    <div
      className={`rounded border ${
        expanded
          ? "border-blue-500 bg-white shadow-sm dark:bg-neutral-900"
          : "border-neutral-300 dark:border-neutral-700"
      }`}
    >
      <button
        onClick={() => onToggle(chunk.id)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="font-mono text-[11px] text-neutral-500">#{chunk.idx}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[chunk.status] ?? ""}`}>
          {chunk.status}
        </span>
        {chunk.warning && <span title={chunk.warning}>⚠</span>}
        {chunk.edited && <span title="Đã sửa tay">✎</span>}
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
          {peek(chunk.sourceOverride ?? chunk.source)}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {chunk.attempts > 0 && <span className="text-neutral-500">{chunk.attempts} lần gọi</span>}
            {chunk.rawResponse && (
              <button onClick={() => setShowRaw((v) => !v)} className="text-blue-600 hover:underline">
                {showRaw ? "Ẩn raw" : "Xem raw"}
              </button>
            )}
            {chunk.status !== "skipped" && (
              <button
                onClick={() => onRetranslate(chunk.id)}
                className="ml-auto rounded bg-blue-600 px-2 py-1 text-white"
              >
                Re-translate
              </button>
            )}
          </div>

          {chunk.warning && (
            <p className="rounded bg-yellow-100 p-1.5 text-xs text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              ⚠ {chunk.warning}
            </p>
          )}
          {chunk.error && (
            <p className="rounded bg-red-100 p-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {chunk.error}
            </p>
          )}
          {showRaw && (
            <pre className="max-h-48 overflow-auto rounded bg-neutral-100 p-2 text-[11px] dark:bg-neutral-950">
              {chunk.rawResponse}
            </pre>
          )}

          <label className="block text-[11px] font-medium text-neutral-500">
            Nguồn {chunk.sourceOverride !== null && "(đã sửa tay)"}
          </label>
          <textarea
            value={src}
            rows={8}
            onChange={(e) => setSrc(e.target.value)}
            onBlur={() => {
              if (src !== (chunk.sourceOverride ?? chunk.source)) onSaveSource(chunk.id, src);
            }}
            className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
          />

          <label className="block text-[11px] font-medium text-neutral-500">Bản dịch</label>
          <textarea
            value={dst}
            rows={8}
            placeholder={chunk.status === "skipped" ? "(không dịch — front matter)" : "chưa dịch"}
            onChange={(e) => setDst(e.target.value)}
            onBlur={() => {
              if (dst !== (chunk.translated ?? "")) onSaveTranslated(chunk.id, dst);
            }}
            className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
          />
        </div>
      )}
    </div>
  );
}
