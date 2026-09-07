"use client";

import { useEffect, useState } from "react";
import type { ChunkDTO } from "@/lib/types";
import { errorCode, errorHint } from "@/lib/errors";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  translating: "bg-blue-200 text-blue-800 animate-pulse dark:bg-blue-900 dark:text-blue-200",
  done: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  skipped: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px whitespace-nowrap border-b-2 px-1.5 py-1 font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

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
  const [tab, setTab] = useState<"source" | "translated" | "raw">("source");

  useEffect(() => setSrc(chunk.sourceOverride ?? chunk.source), [chunk.sourceOverride, chunk.source]);
  useEffect(() => setDst(chunk.translated ?? ""), [chunk.translated]);

  const busy = chunk.status === "translating";
  const code = errorCode(chunk.error);
  const hint = errorHint(code);

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
        {code && (
          <span
            title={chunk.error ?? undefined}
            className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white"
          >
            {code}
          </span>
        )}
        {chunk.warning && <span title={chunk.warning}>⚠</span>}
        {chunk.edited && <span title="Đã sửa tay">✎</span>}
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
          {peek(chunk.sourceOverride ?? chunk.source)}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
          {chunk.warning && (
            <p className="rounded bg-yellow-100 p-1.5 text-xs text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              ⚠ {chunk.warning}
            </p>
          )}
          {chunk.error && (
            <div className="rounded bg-red-100 p-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              <p>{chunk.error}</p>
              {hint && (
                <p className="mt-0.5 font-medium">
                  {code} — {hint}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 border-b border-neutral-200 text-[11px] dark:border-neutral-800">
            <Tab active={tab === "source"} onClick={() => setTab("source")}>
              Nguồn {chunk.sourceOverride !== null && "✎"}
            </Tab>
            <Tab active={tab === "translated"} onClick={() => setTab("translated")}>
              Bản dịch
            </Tab>
            <Tab active={tab === "raw"} onClick={() => setTab("raw")}>
              Raw
            </Tab>

            <div className="ml-auto flex items-center gap-2 pb-1">
              {chunk.attempts > 0 && (
                <span
                  title={`Đã gọi LLM ${chunk.attempts} lần`}
                  className="whitespace-nowrap text-neutral-500"
                >
                  ×{chunk.attempts}
                </span>
              )}
              {chunk.status !== "skipped" && (
                <button
                  onClick={() => onRetranslate(chunk.id)}
                  disabled={busy}
                  title="Dịch lại chunk này"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded bg-blue-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy && <Spinner />}
                  {busy ? "Đang dịch…" : "Dịch lại"}
                </button>
              )}
            </div>
          </div>

          {tab === "raw" ? (
            chunk.rawResponse ? (
              <pre className="max-h-[19rem] overflow-auto rounded border border-neutral-300 bg-neutral-50 p-1.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-950">
                {chunk.rawResponse}
              </pre>
            ) : (
              <p className="rounded border border-dashed border-neutral-300 p-3 text-center text-[11px] text-neutral-500 dark:border-neutral-700">
                Chưa có raw response — chunk này chưa gọi LLM lần nào.
              </p>
            )
          ) : tab === "source" ? (
            <textarea
              key="source"
              value={src}
              rows={14}
              onChange={(e) => setSrc(e.target.value)}
              onBlur={() => {
                if (src !== (chunk.sourceOverride ?? chunk.source)) onSaveSource(chunk.id, src);
              }}
              className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
            />
          ) : (
            <textarea
              key="translated"
              value={dst}
              rows={14}
              placeholder={chunk.status === "skipped" ? "(không dịch — front matter)" : "chưa dịch"}
              onChange={(e) => setDst(e.target.value)}
              onBlur={() => {
                if (dst !== (chunk.translated ?? "")) onSaveTranslated(chunk.id, dst);
              }}
              className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
            />
          )}
        </div>
      )}
    </div>
  );
}
