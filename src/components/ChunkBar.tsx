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
  /** Key thứ mấy đã gọi thẻ này trong lượt chạy hiện tại (0-based). Không lưu DB. */
  keyIndex?: number;
  /** CR v0.5 — tóm tắt của chunk trước đổi sau khi chunk này dịch xong. */
  staleContext?: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  /** Ba hàm lưu đều async: thẻ chờ chúng xong để hiện "Đang lưu…" trên nút Run. */
  onSaveSource: (id: string, value: string) => Promise<void>;
  onSaveTranslated: (id: string, value: string) => Promise<void>;
  onSaveSummary: (id: string, value: string) => Promise<void>;
  onRetranslate: (id: string) => void;
}

const STALE_NOTE = "Tóm tắt đoạn trước đã đổi sau khi dịch";

export default function ChunkBar({
  chunk,
  keyIndex,
  staleContext = false,
  expanded,
  onToggle,
  onSaveSource,
  onSaveTranslated,
  onSaveSummary,
  onRetranslate,
}: Props) {
  const [src, setSrc] = useState(chunk.sourceOverride ?? chunk.source);
  const [dst, setDst] = useState(chunk.translated ?? "");
  const [sum, setSum] = useState(chunk.summary ?? "");
  const [tab, setTab] = useState<"source" | "translated" | "raw">("source");
  const [sumOpen, setSumOpen] = useState(false);
  /** Đếm chứ không phải boolean: rời ô này rồi rời ô kia là hai lượt lưu chồng nhau. */
  const [saving, setSaving] = useState(0);

  useEffect(() => setSrc(chunk.sourceOverride ?? chunk.source), [chunk.sourceOverride, chunk.source]);
  useEffect(() => setDst(chunk.translated ?? ""), [chunk.translated]);
  useEffect(() => setSum(chunk.summary ?? ""), [chunk.summary]);

  /** Mọi cú lưu lúc blur đều đi qua đây để nút Run báo được trạng thái. */
  const save = async (fn: (id: string, value: string) => Promise<void>, value: string) => {
    setSaving((n) => n + 1);
    try {
      await fn(chunk.id, value);
    } finally {
      setSaving((n) => n - 1);
    }
  };

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
        {chunk.prevSummaryUsed && (
          <span title="Dịch có ngữ cảnh đoạn trước" className="text-xs text-accent">
            ⛓
          </span>
        )}
        {staleContext && (
          <span title={STALE_NOTE} className="text-xs text-warn-icon">
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
          {staleContext && <WarnBox>{STALE_NOTE} — dịch lại chunk này nếu muốn khớp mạch.</WarnBox>}

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
            {keyIndex !== undefined && (
              <span
                title="API key đã dùng cho lần gọi gần nhất"
                className="whitespace-nowrap font-mono text-[11px] text-sand-600"
              >
                key #{keyIndex + 1}
              </span>
            )}
            {chunk.status !== "skipped" && (
              <button
                onClick={() => onRetranslate(chunk.id)}
                disabled={busy || saving > 0}
                title={saving > 0 ? "Đang lưu thay đổi…" : "Dịch lại chunk này"}
                className="btn btn-primary btn-sm h-7"
              >
                {(busy || saving > 0) && <Spinner />}
                {busy ? "Đang dịch…" : saving > 0 ? "Đang lưu…" : "Run"}
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
                if (src !== (chunk.sourceOverride ?? chunk.source)) void save(onSaveSource, src);
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
                if (dst !== (chunk.translated ?? "")) void save(onSaveTranslated, dst);
              }}
              className="textarea textarea-target h-[270px] rounded-[14px]"
            />
          )}

          {/* Tóm tắt chunk (CR v0.5) — front matter không có tóm tắt nên giấu luôn hàng này. */}
          {chunk.status !== "skipped" && (
            <div className="rounded-[14px] border border-divider px-2.5 py-1.5">
              <button
                onClick={() => setSumOpen((v) => !v)}
                className="flex w-full min-w-0 items-center gap-2 text-left text-[12px]"
              >
                <span className="shrink-0 text-sand-600">{sumOpen ? "▾" : "▸"} Tóm tắt</span>
                {!sumOpen && (
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      chunk.summary ? "text-sand-700" : "text-sand-500"
                    }`}
                  >
                    {chunk.summary ? peek(chunk.summary) : "(chưa có)"}
                  </span>
                )}
              </button>
              {sumOpen && (
                <textarea
                  value={sum}
                  placeholder="(chưa có) — bật “Tạo tóm tắt chunk” trong Settings, hoặc tự viết ở đây."
                  onChange={(e) => setSum(e.target.value)}
                  onBlur={() => {
                    if (sum !== (chunk.summary ?? "")) void save(onSaveSummary, sum);
                  }}
                  className="textarea mt-1.5 h-[104px] rounded-[12px] text-[12px]"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
