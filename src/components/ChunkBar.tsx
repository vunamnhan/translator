"use client";

import { useEffect, useState } from "react";
import type { ChunkDTO } from "@/lib/types";
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
  WarnBox,
  barShell,
} from "./bar";

/** Dòng đầu có chữ của chunk, để nhận diện nhanh khi thu gọn. */
function peek(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line ?? "(trống)").replace(/^#+\s*/, "").slice(0, 120);
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
    <div className={barShell(expanded)}>
      <button onClick={() => onToggle(chunk.id)} className={BAR_HEAD}>
        <span className="min-w-[26px] font-mono text-xs text-sand-600">#{chunk.idx}</span>
        <StatusPill status={chunk.status} />
        {code && <ErrorCode code={code} title={chunk.error ?? undefined} />}
        {chunk.warning && (
          <span title={chunk.warning} className="text-xs text-warn-icon">
            ⚠
          </span>
        )}
        {chunk.edited && (
          <span title="Đã sửa tay" className="text-xs text-accent">
            ✎
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-sand-700">
          {peek(chunk.sourceOverride ?? chunk.source)}
        </span>
      </button>

      {expanded && (
        <div className={BAR_BODY}>
          {chunk.error && <ErrorBox message={chunk.error} code={code} hint={hint} />}
          {chunk.warning && <WarnBox>{chunk.warning}</WarnBox>}

          <div className="flex flex-wrap items-center gap-1 border-b border-divider pb-1.5">
            <Tab active={tab === "source"} onClick={() => setTab("source")}>
              Nguồn {chunk.sourceOverride !== null && "✎"}
            </Tab>
            <Tab active={tab === "translated"} onClick={() => setTab("translated")}>
              Bản dịch
            </Tab>
            <Tab active={tab === "raw"} onClick={() => setTab("raw")}>
              Raw
            </Tab>

            <span className="min-w-[4px] flex-1" />

            {chunk.attempts > 0 && (
              <span
                title={`Đã gọi LLM ${chunk.attempts} lần`}
                className="whitespace-nowrap font-mono text-[11px] text-sand-600"
              >
                ×{chunk.attempts}
              </span>
            )}
            {chunk.status !== "skipped" && (
              <button
                onClick={() => onRetranslate(chunk.id)}
                disabled={busy}
                title="Dịch lại chunk này"
                className="btn btn-primary btn-sm h-7"
              >
                {busy && <Spinner />}
                {busy ? "Đang dịch…" : "Dịch lại"}
              </button>
            )}
          </div>

          {tab === "raw" ? (
            <ReadOnlyBox>
              {chunk.rawResponse ?? "Chưa có raw response — chunk này chưa gọi LLM lần nào."}
            </ReadOnlyBox>
          ) : tab === "source" ? (
            <textarea
              key="source"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onBlur={() => {
                if (src !== (chunk.sourceOverride ?? chunk.source)) onSaveSource(chunk.id, src);
              }}
              className="textarea h-[270px] rounded-[14px]"
            />
          ) : (
            <textarea
              key="translated"
              value={dst}
              placeholder={chunk.status === "skipped" ? "(không dịch — front matter)" : "chưa dịch"}
              onChange={(e) => setDst(e.target.value)}
              onBlur={() => {
                if (dst !== (chunk.translated ?? "")) onSaveTranslated(chunk.id, dst);
              }}
              className="textarea textarea-target h-[270px] rounded-[14px]"
            />
          )}
        </div>
      )}
    </div>
  );
}
