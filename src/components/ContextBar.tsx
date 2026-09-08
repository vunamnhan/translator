"use client";

import { useEffect, useState } from "react";
import type { JobDTO } from "@/lib/types";
import { BAR_BODY, BAR_HEAD, Spinner, StatusPill, WarnBox } from "./bar";

interface Props {
  job: JobDTO;
  expanded: boolean;
  busy: boolean;
  truncated: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onSave: (value: string) => void;
}

/** Ngữ cảnh chung — cùng khuôn thẻ với ChunkBar / SectionBar, nhưng nhuộm accent để đứng riêng. */
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
      className={`overflow-hidden rounded-[18px] border ${
        expanded ? "border-accent bg-white shadow-md" : "border-accent-200 bg-accent-100"
      }`}
    >
      <button onClick={onToggle} className={BAR_HEAD}>
        <span className="min-w-[26px] font-mono text-xs text-sand-600">§0</span>
        <StatusPill status={busy ? "generating" : hasContext ? "done" : "pending"} />
        {job.contextEdited && (
          <span title="Đã sửa tay" className="text-xs text-accent">
            ✎
          </span>
        )}
        {truncated && (
          <span
            title={`Tài liệu vượt ${job.contextMaxTokens} token — gửi skeleton`}
            className="text-xs text-warn-icon"
          >
            ⚠
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-sand-700">
          Ngữ cảnh chung
        </span>
      </button>

      {expanded && (
        <div className={BAR_BODY}>
          {truncated && (
            <WarnBox>
              Tài liệu dài quá {job.contextMaxTokens} token — đã gửi skeleton (heading + phần đầu mỗi
              section).
            </WarnBox>
          )}

          <div className="flex flex-wrap items-center gap-2 border-b border-divider pb-1.5">
            <span className="px-1 text-xs text-sand-600">
              {job.contextEdited ? "đã sửa tay" : hasContext ? "do LLM tạo" : "chưa có"}
            </span>
            <span className="min-w-[4px] flex-1" />
            <button
              onClick={() => onSave(draft)}
              disabled={!dirty}
              className="btn btn-secondary btn-sm h-7"
            >
              Lưu {dirty && "•"}
            </button>
            <button
              onClick={onGenerate}
              disabled={busy}
              title="Gọi LLM đọc cả tài liệu và viết ngữ cảnh chung"
              className="btn btn-primary btn-sm h-7"
            >
              {busy && <Spinner />}
              {busy ? "Đang tạo…" : hasContext ? "Tạo lại" : "Tạo tóm tắt chung"}
            </button>
          </div>

          <textarea
            value={draft}
            placeholder="Chưa có ngữ cảnh chung — bấm “Tạo tóm tắt chung”, rồi sửa lại nếu cần."
            onChange={(e) => setDraft(e.target.value)}
            className="textarea textarea-target h-[270px] rounded-[14px]"
          />
          <p className="m-0 text-[11px] text-sand-600">
            Bơm vào prompt tóm tắt section, và vào prompt dịch nếu bật toggle trong Settings.
          </p>
        </div>
      )}
    </div>
  );
}
