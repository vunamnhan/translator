"use client";

import { useEffect, useState } from "react";
import type { JobDTO } from "@/lib/types";
import { Spinner } from "./bar";

interface Props {
  job: JobDTO;
  expanded: boolean;
  busy: boolean;
  truncated: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onSave: (value: string) => void;
}

/** Ngữ cảnh chung — cùng khuôn thẻ với ChunkBar / SectionBar, đứng đầu cột trái. */
export default function ContextBar({
  job,
  expanded,
  busy,
  truncated,
  onToggle,
  onGenerate,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(job.context ?? "");
  useEffect(() => setDraft(job.context ?? ""), [job.context]);

  const hasContext = Boolean(job.context && job.context.trim());
  const dirty = draft !== (job.context ?? "");

  return (
    <div
      className={`rounded border ${
        expanded
          ? "border-blue-500 bg-white shadow-sm dark:bg-neutral-900"
          : "border-neutral-300 dark:border-neutral-700"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="font-mono text-[11px] text-neutral-500">§0</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            busy
              ? "animate-pulse bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              : hasContext
                ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
          }`}
        >
          {busy ? "generating" : hasContext ? "done" : "pending"}
        </span>
        {job.contextEdited && <span title="Đã sửa tay">✎</span>}
        {truncated && <span title={`Tài liệu vượt ${job.contextMaxTokens} token — gửi skeleton`}>⚠</span>}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">Ngữ cảnh chung</span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
          {truncated && (
            <p className="rounded bg-yellow-100 p-1.5 text-xs text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              ⚠ Tài liệu dài quá {job.contextMaxTokens} token — đã gửi skeleton (heading + phần đầu
              mỗi section).
            </p>
          )}

          <div className="flex items-center gap-2 border-b border-neutral-200 pb-1 text-[11px] dark:border-neutral-800">
            <span className="font-medium text-neutral-500">
              {job.contextEdited ? "đã sửa tay" : hasContext ? "do LLM tạo" : "chưa có"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => onSave(draft)}
                disabled={!dirty}
                className="whitespace-nowrap rounded border border-neutral-400 px-2 py-1 disabled:opacity-40"
              >
                Save {dirty && "•"}
              </button>
              <button
                onClick={onGenerate}
                disabled={busy}
                title="Gọi LLM đọc cả tài liệu và viết ngữ cảnh chung"
                className="flex items-center gap-1.5 whitespace-nowrap rounded bg-blue-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Spinner />}
                {busy ? "Đang tạo…" : hasContext ? "Tạo lại" : "Tạo tóm tắt chung"}
              </button>
            </div>
          </div>

          <textarea
            value={draft}
            rows={14}
            placeholder="Chưa có ngữ cảnh chung — bấm “Tạo tóm tắt chung”, rồi sửa lại nếu cần."
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded border border-neutral-300 p-1.5 font-mono text-[11px] dark:border-neutral-700"
          />
          <p className="text-[11px] text-neutral-500">
            Bơm vào prompt tóm tắt section, và vào prompt dịch nếu bật toggle trong Settings.
          </p>
        </div>
      )}
    </div>
  );
}
