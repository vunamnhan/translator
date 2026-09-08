"use client";

import { useEffect, useState } from "react";
import type { SectionDTO } from "@/lib/types";
import { errorCode, errorHint } from "@/lib/errors";
import {
  BAR_BODY,
  BAR_HEAD,
  ErrorBox,
  ErrorCode,
  ReadOnlyBox,
  Spinner,
  StatusPill,
  Tab,
  barShell,
} from "./bar";

interface Props {
  section: SectionDTO;
  /** Key thứ mấy đã gọi thẻ này trong lượt chạy hiện tại (0-based). Không lưu DB. */
  keyIndex?: number;
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
  keyIndex,
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
    <div className={barShell(expanded)}>
      <button onClick={() => onToggle(section.id)} className={BAR_HEAD}>
        <span className="min-w-[26px] font-mono text-xs text-sand-600">§{section.idx + 1}</span>
        <StatusPill status={section.status} />
        {code && <ErrorCode code={code} title={section.error ?? undefined} />}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-sand-700">{section.heading}</span>
        <span className="whitespace-nowrap font-mono text-[11px] text-sand-500">
          {section.chunkFrom}–{section.chunkTo}
        </span>
      </button>

      {expanded && (
        <div className={BAR_BODY}>
          {section.error && <ErrorBox message={section.error} code={code} hint={hint} />}

          <div className="flex flex-wrap items-center gap-1 border-b border-divider pb-1.5">
            <Tab active={tab === "summary"} onClick={() => setTab("summary")}>
              Tóm tắt
            </Tab>
            <Tab active={tab === "source"} onClick={() => setTab("source")}>
              Nguồn
            </Tab>
            <Tab active={tab === "raw"} onClick={() => setTab("raw")}>
              Raw
            </Tab>

            <span className="min-w-[4px] flex-1" />

            {section.attempts > 0 && (
              <span
                title={`Đã gọi LLM ${section.attempts} lần`}
                className="whitespace-nowrap font-mono text-[11px] text-sand-600"
              >
                ×{section.attempts}
              </span>
            )}
            {keyIndex !== undefined && (
              <span
                title="API key đã dùng cho lần gọi gần nhất"
                className="whitespace-nowrap font-mono text-[11px] text-sand-600"
              >
                key #{keyIndex + 1}
              </span>
            )}
            <button
              onClick={() => onJumpToChunk(section.chunkFrom)}
              title="Sang tab Translate, tới chunk đầu của section"
              className="whitespace-nowrap px-1.5 py-1 text-xs text-accent hover:underline"
            >
              → chunk {section.chunkFrom}–{section.chunkTo}
            </button>
            <button
              onClick={() => onResummarize(section.id)}
              disabled={busy || disabled}
              title="Tóm tắt lại section này"
              className="btn btn-primary btn-sm h-7"
            >
              {busy && <Spinner />}
              {busy ? "Đang tóm tắt…" : "Tóm tắt lại"}
            </button>
          </div>

          {tab === "raw" ? (
            <ReadOnlyBox>
              {section.rawResponse ?? "Chưa có raw response — section này chưa gọi LLM lần nào."}
            </ReadOnlyBox>
          ) : tab === "source" ? (
            <ReadOnlyBox>{sourceText}</ReadOnlyBox>
          ) : (
            <textarea
              key="summary"
              value={dst}
              placeholder="chưa tóm tắt"
              onChange={(e) => setDst(e.target.value)}
              onBlur={() => {
                if (dst !== (section.summary ?? "")) onSaveSummary(section.id, dst);
              }}
              className="textarea textarea-target h-[270px] rounded-[14px]"
            />
          )}
        </div>
      )}
    </div>
  );
}
