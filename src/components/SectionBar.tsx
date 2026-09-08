"use client";

import { useEffect, useState } from "react";
import type { SectionDTO } from "@/lib/types";
import { errorCode, errorHint } from "@/lib/errors";
import { Spinner, StatusPill, Tab } from "./bar";

interface Props {
  section: SectionDTO;
  /** Source ghép từ chunkFrom..chunkTo — chỉ đọc, sửa nguồn nằm ở tab Translate. */
  sourceText: string;
  expanded: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  onSaveSummary: (id: string, value: string) => void;
  onResummarize: (id: string) => void;
  onJumpToChunk: (idx: number) => void;
}

export default function SectionBar({
  section,
  sourceText,
  expanded,
  disabled,
  onToggle,
  onSaveSummary,
  onResummarize,
  onJumpToChunk,
}: Props) {
  const [dst, setDst] = useState(section.summary ?? "");
  const [tab, setTab] = useState<"source" | "summary" | "raw">("summary");

  useEffect(() => setDst(section.summary ?? ""), [section.summary]);

  const busy = section.status === "summarizing";
  const code = errorCode(section.error);
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
        onClick={() => onToggle(section.id)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="font-mono text-[11px] text-neutral-500">§{section.idx + 1}</span>
        <StatusPill status={section.status} />
        {code && (
          <span
            title={section.error ?? undefined}
            className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white"
          >
            {code}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
          {section.heading}
        </span>
        <span className="whitespace-nowrap font-mono text-[11px] text-neutral-400">
          {section.chunkFrom}–{section.chunkTo}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
          {section.error && (
            <div className="rounded bg-red-100 p-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              <p>{section.error}</p>
              {hint && (
                <p className="mt-0.5 font-medium">
                  {code} — {hint}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 border-b border-neutral-200 text-[11px] dark:border-neutral-800">
            <Tab active={tab === "summary"} onClick={() => setTab("summary")}>
              Tóm tắt
            </Tab>
            <Tab active={tab === "source"} onClick={() => setTab("source")}>
              Nguồn
            </Tab>
            <Tab active={tab === "raw"} onClick={() => setTab("raw")}>
              Raw
            </Tab>

            <div className="ml-auto flex items-center gap-2 pb-1">
              <button
                onClick={() => onJumpToChunk(section.chunkFrom)}
                title="Sang tab Translate, tới chunk đầu của section"
                className="whitespace-nowrap text-blue-600 hover:underline"
              >
                → chunk {section.chunkFrom}–{section.chunkTo}
              </button>
              {section.attempts > 0 && (
                <span
                  title={`Đã gọi LLM ${section.attempts} lần`}
                  className="whitespace-nowrap text-neutral-500"
                >
                  ×{section.attempts}
                </span>
              )}
              <button
                onClick={() => onResummarize(section.id)}
                disabled={busy || disabled}
                title="Tóm tắt lại section này"
                className="flex items-center gap-1.5 whitespace-nowrap rounded bg-blue-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Spinner />}
                {busy ? "Đang tóm tắt…" : "Tóm tắt lại"}
              </button>
            </div>
          </div>

          {tab === "raw" ? (
            section.rawResponse ? (
              <pre className="h-[19rem] overflow-auto whitespace-pre-wrap break-words rounded border border-neutral-300 bg-neutral-50 p-1.5 font-mono text-[11px] dark:border-neutral-700 dark:bg-neutral-950">
                {section.rawResponse}
              </pre>
            ) : (
              <p className="rounded border border-dashed border-neutral-300 p-3 text-center text-[11px] text-neutral-500 dark:border-neutral-700">
                Chưa có raw response — section này chưa gọi LLM lần nào.
              </p>
            )
          ) : tab === "source" ? (
            <pre className="h-[19rem] overflow-auto whitespace-pre-wrap break-words rounded border border-neutral-300 bg-neutral-50 p-1.5 font-mono text-[11px] dark:border-neutral-700 dark:bg-neutral-950">
              {sourceText}
            </pre>
          ) : (
            <textarea
              key="summary"
              value={dst}
              rows={14}
              placeholder="chưa tóm tắt"
              onChange={(e) => setDst(e.target.value)}
              onBlur={() => {
                if (dst !== (section.summary ?? "")) onSaveSummary(section.id, dst);
              }}
              className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
            />
          )}
        </div>
      )}
    </div>
  );
}
