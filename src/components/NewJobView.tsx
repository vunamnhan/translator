"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DraftChunkBar, { FLAG_LABEL } from "./DraftChunkBar";
import { ListPanel, type FilterDef } from "./chrome";
import { useConfirm } from "./ConfirmDialog";
import WriterDialog from "./WriterDialog";
import { Spinner } from "./bar";
import { useSettings } from "@/lib/useSettings";
import {
  chunkByRule,
  chunkFlags,
  estimateTokens,
  isFrontMatter,
  type ChunkFlag,
  type ChunkRule,
  type ChunkRuleKind,
} from "@/lib/chunker";
import {
  MAX_DRAFT_CHUNKS,
  MAX_MARKER_LEN,
  MAX_UPLOAD_BYTES,
  normalizeMarker,
} from "@/lib/defaults";
import { clearDraft, readDraft, writeDraft, type Draft } from "@/lib/draft";

const RULE_LABEL: Record<ChunkRuleKind, string> = {
  auto: "Tự động",
  heading: "Heading",
  blank: "Dòng trống",
  marker: "Dấu ngắt",
};

function buildRule(
  kind: ChunkRuleKind,
  level: number,
  marker: string,
  chunkTokens: number
): ChunkRule {
  if (kind === "heading") return { kind, maxLevel: level };
  if (kind === "marker") return { kind, marker };
  if (kind === "blank") return { kind };
  return { kind: "auto", chunkTokens };
}

/**
 * Màn hình tạo job (CR v0.4). Hai bước trên cùng một trang: nhập văn bản, rồi
 * xem trước / sửa chunk. Cắt chạy hoàn toàn ở front-end — server chỉ nhận mảng
 * chunk đã duyệt, nên không có route xem trước.
 */
export default function NewJobView() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, update, loaded } = useSettings();
  const { ask, dialog } = useConfirm();

  const [ready, setReady] = useState(false);
  const [found, setFound] = useState<Draft | null>(null);
  const [step, setStep] = useState<"input" | "edit">("input");

  const [name, setName] = useState("untitled.md");
  const [raw, setRaw] = useState("");
  const [rule, setRule] = useState<ChunkRuleKind>("auto");
  const [level, setLevel] = useState(2);
  const [marker, setMarker] = useState("---");
  // Ô dấu ngắt gõ tới đâu hiện tới đó; blur mới cắt lại (§6.2).
  const [markerBox, setMarkerBox] = useState("---");

  const [pieces, setPieces] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  const [sel, setSel] = useState(0);
  const [text, setText] = useState("");

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // CR v0.6 — Assistant Writer, chỉ gắn ở bước nhập văn bản.
  const [writerOpen, setWriterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const taRef = useRef<HTMLTextAreaElement>(null);
  // Tạo job xong thì nháp phải chết hẳn — timer lưu đang chờ không được hồi sinh nó.
  const finished = useRef(false);
  // Vị trí con trỏ lúc rời textarea — nút "Tách" bấm sau khi textarea đã blur.
  const caretRef = useRef(0);

  const applyDraft = useCallback((d: Draft) => {
    setName(d.name);
    setRaw(d.rawSource);
    setRule(d.rule);
    setLevel(d.headingLevel);
    setMarker(d.marker);
    setMarkerBox(d.marker);
    setPieces(d.chunks);
    setEdited(d.editedManually);
    setSel(Math.max(0, Math.min(d.chunks.length - 1, d.selected)));
    setStep(d.chunks.length > 0 ? "edit" : "input");
    setFound(null);
    setReady(true);
  }, []);

  // Nạp một lần: có nháp thì hỏi trước, chưa chọn thì màn hình trống (§2.5).
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || !loaded) return;
    inited.current = true;
    const d = readDraft();
    if (d && params.get("resume") === "1") {
      applyDraft(d);
      return;
    }
    if (d) {
      setFound(d);
      return;
    }
    setRule(settings.chunkRule);
    setLevel(settings.headingLevel);
    setMarker(settings.chunkMarker);
    setMarkerBox(settings.chunkMarker);
    setReady(true);
  }, [loaded, params, settings, applyDraft]);

  // Textarea theo chunk đang chọn. pieces đổi sau mỗi lần commit nên giá trị luôn khớp.
  useEffect(() => {
    setText(pieces[sel] ?? "");
  }, [sel, pieces]);

  /** Danh sách chunk kèm nội dung đang gõ dở của chunk đang chọn. */
  const merged = useCallback(
    () => pieces.map((p, i) => (i === sel ? text : p)),
    [pieces, sel, text]
  );

  // Tự lưu nháp, debounce 500 ms. Gõ dở cũng vào nháp nên F5 không mất chữ.
  useEffect(() => {
    if (!ready || finished.current) return;
    if (raw.length === 0 && pieces.length === 0) return;
    const t = setTimeout(() => {
      const saved = writeDraft({
        name,
        rawSource: raw,
        rule,
        headingLevel: level,
        marker,
        chunks: merged(),
        editedManually: edited,
        selected: sel,
        updatedAt: Date.now(),
      });
      setTooBig(!saved);
      if (saved) setSavedAt(Date.now());
    }, 500);
    return () => clearTimeout(t);
  }, [ready, name, raw, rule, level, marker, edited, sel, pieces, merged]);

  const cut = useCallback(
    (kind: ChunkRuleKind, lv: number, mk: string, source: string) => {
      const parts = chunkByRule(source, buildRule(kind, lv, mk, settings.chunkTokens));
      setRule(kind);
      setLevel(lv);
      setMarker(mk);
      setMarkerBox(mk);
      setPieces(parts.map((p) => p.source));
      setEdited(false);
      setSel(0);
      setStep("edit");
      setError(null);
      update({ chunkRule: kind, headingLevel: lv, chunkMarker: mk });
    },
    [settings.chunkTokens, update]
  );

  /** Đổi rule / N / dấu ngắt — cắt lại từ văn bản gốc, hỏi trước nếu đã sửa tay. */
  const recut = useCallback(
    async (kind: ChunkRuleKind, lv: number, mk: string) => {
      if (kind === rule && lv === level && mk === marker) return;
      if (edited) {
        const okToCut = await ask({
          title: "Cắt lại toàn bộ?",
          body: "Cắt lại sẽ bỏ mọi chỉnh sửa tay trên danh sách chunk và cắt lại từ văn bản gốc.",
          ok: "Cắt lại",
        });
        if (!okToCut) {
          setMarkerBox(marker);
          return;
        }
      }
      cut(kind, lv, mk, raw);
    },
    [ask, cut, edited, level, marker, raw, rule]
  );

  /** Áp một phép sửa lên danh sách chunk. Luôn chạy trên bản đã gộp chữ đang gõ. */
  const apply = useCallback(
    (fn: (list: string[]) => { next: string[]; sel: number }) => {
      const { next, sel: nextSel } = fn(merged());
      setPieces(next);
      setSel(Math.max(0, Math.min(next.length - 1, nextSel)));
      setEdited(true);
    },
    [merged]
  );

  const focusEditor = () =>
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(0, 0);
    });

  function insertAt(at: number) {
    apply((list) => ({ next: [...list.slice(0, at), "", ...list.slice(at)], sel: at }));
    focusEditor();
  }

  function splitAtCaret() {
    const at = caretRef.current;
    apply((list) => {
      const cur = list[sel] ?? "";
      if (at <= 0 || at >= cur.length) return { next: list, sel };
      const next = [...list];
      next.splice(sel, 1, cur.slice(0, at), cur.slice(at));
      return { next, sel };
    });
  }

  function mergeNext() {
    apply((list) => {
      if (sel >= list.length - 1) return { next: list, sel };
      const next = [...list];
      next.splice(sel, 2, list[sel] + list[sel + 1]);
      return { next, sel };
    });
  }

  function removeCurrent() {
    apply((list) => {
      if (list.length <= 1) return { next: list, sel };
      return { next: list.filter((_, i) => i !== sel), sel: Math.min(sel, list.length - 2) };
    });
  }

  async function takeFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File vượt quá 2 MB");
      return;
    }
    setError(null);
    setName(file.name);
    setRaw(await file.text());
  }

  /** "Lưu và cắt lại" sau khi sửa văn bản gốc — cũng hỏi nếu đã sửa tay (§2.2). */
  async function recutFromRaw() {
    if (edited) {
      const okToCut = await ask({
        title: "Cắt lại toàn bộ?",
        body: "Văn bản gốc đã đổi — cắt lại sẽ bỏ mọi chỉnh sửa tay trên danh sách chunk.",
        ok: "Cắt lại",
      });
      if (!okToCut) return;
    }
    cut(rule, level, marker, raw);
  }

  async function create() {
    const list = merged().filter((p) => p.trim().length > 0);
    if (list.length === 0 || name.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          chunks: list,
          chunkMode: edited ? "manual" : rule,
          systemPrompt: settings.systemPrompt,
          model: settings.model,
          endpoint: settings.endpoint,
          chunkTokens: settings.chunkTokens,
          summaryTokens: settings.summaryTokens,
          contextMaxTokens: settings.contextMaxTokens,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Tạo job thất bại");
      finished.current = true;
      clearDraft();
      router.push(`/job/${payload.job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const tokens = useMemo(() => pieces.map(estimateTokens), [pieces]);
  const flags = useMemo(
    () => pieces.map((p) => chunkFlags(p, settings.chunkTokens)),
    [pieces, settings.chunkTokens]
  );

  const tally = useMemo(() => {
    const count = (f: ChunkFlag) => flags.filter((list) => list.includes(f)).length;
    return {
      large: count("large") + count("huge"),
      huge: count("huge"),
      split: count("code-split"),
      empty: count("empty"),
    };
  }, [flags]);

  const filters: FilterDef[] = [
    { key: "all", label: "Tất cả", count: pieces.length },
    { key: "large", label: "Lớn", count: tally.large },
    { key: "code-split", label: FLAG_LABEL["code-split"], count: tally.split },
    { key: "empty", label: FLAG_LABEL.empty, count: tally.empty },
  ];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pieces
      .map((textOf, idx) => ({ text: textOf, idx }))
      .filter(({ text: t, idx }) => {
        if (needle && !t.toLowerCase().includes(needle)) return false;
        if (filter === "large") return flags[idx].includes("large") || flags[idx].includes("huge");
        if (filter !== "all") return flags[idx].includes(filter as ChunkFlag);
        return true;
      });
  }, [pieces, flags, query, filter]);

  const selFlags = flags[sel] ?? [];
  const noCutPoint = step === "edit" && rule !== "auto" && pieces.length === 1;
  const missingNewline =
    sel < pieces.length - 1 && text.trim().length > 0 && !text.endsWith("\n");

  if (!ready) {
    return (
      <main className="flex-1 px-3 pt-4 lg:px-6 lg:pt-6">
        <div className="mx-auto max-w-[940px]">
          {found ? (
            <div className="flex flex-wrap items-center gap-2.5 rounded-[18px] bg-run-soft px-3.5 py-3 text-[12.5px] text-run-fg">
              <span className="flex-1">
                Có bản nháp «{found.name}» lúc{" "}
                {new Date(found.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                — {found.chunks.length} chunk.
              </span>
              <button onClick={() => applyDraft(found)} className="btn btn-primary btn-sm h-[30px]">
                Tiếp tục
              </button>
              <button
                onClick={() => {
                  clearDraft();
                  setFound(null);
                  setRule(settings.chunkRule);
                  setLevel(settings.headingLevel);
                  setMarker(settings.chunkMarker);
                  setMarkerBox(settings.chunkMarker);
                  setReady(true);
                }}
                className="btn btn-secondary btn-sm h-[30px] bg-white"
              >
                Bỏ
              </button>
            </div>
          ) : (
            <p className="text-sm text-sand-600">Đang tải…</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {/* Top bar — cùng một thẻ nổi như màn hình job. */}
      <div className="flex-none px-3 pt-3 lg:px-5">
        <div className="flex flex-wrap items-center gap-2.5 rounded-3xl bg-white px-3 py-2.5 shadow-sm lg:gap-3.5 lg:px-4 lg:py-3">
          <Link href="/" title="Về danh sách job" className="text-base text-sand-600">
            ←
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 200))}
            placeholder="Tên job"
            className="input h-9 min-w-[160px] flex-1 bg-paper"
          />
          <span className="hidden flex-1 lg:block" />

          {step === "input" ? (
            <>
              <span className="whitespace-nowrap text-[11.5px] text-sand-600">
                {raw.length.toLocaleString("vi-VN")} ký tự ·{" "}
                {estimateTokens(raw).toLocaleString("vi-VN")} token
              </span>
              <button
                onClick={() => setWriterOpen(true)}
                title="Viết / biến đổi văn bản bằng LLM theo mẫu prompt"
                className="btn btn-secondary h-9 shrink-0 py-0"
              >
                ✎ Assistant Writer
              </button>
              {/* Kéo thả là đường chính (thả thẳng vào ô nhập), nút này cho máy không kéo được. */}
              <label
                title="Chọn file .md / .txt"
                className="btn btn-secondary h-9 shrink-0 cursor-pointer py-0"
              >
                Chọn file
                <input
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  onChange={(e) => void takeFile(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {pieces.length > 0 && (
                <button onClick={() => setStep("edit")} className="btn btn-secondary h-9 py-0">
                  Huỷ
                </button>
              )}
              <button
                onClick={() =>
                  pieces.length > 0 ? void recutFromRaw() : cut(rule, level, marker, raw)
                }
                disabled={raw.trim().length === 0}
                className="btn btn-primary h-9 py-0"
              >
                {pieces.length > 0 ? "Lưu và cắt lại" : "Cắt chunk"}
              </button>
            </>
          ) : (
            <button
              onClick={create}
              disabled={
                busy ||
                name.trim().length === 0 ||
                pieces.every((p, i) => (i === sel ? text : p).trim().length === 0)
              }
              className="btn btn-primary h-9 py-0"
            >
              {busy && <Spinner />}
              {busy ? "Đang tạo…" : "Tạo job"}
            </button>
          )}
        </div>
      </div>

      {step === "input" ? (
        /* Ô nhập chiếm trọn phần còn lại của màn và trọn bề ngang — không card,
           không ô thả riêng: thả file thẳng vào chính ô nhập. */
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 pt-2.5 lg:px-5 lg:pb-4">
          {error && (
            <div className="flex-none rounded-[18px] bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger-ink">
              {error}
            </div>
          )}
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void takeFile(e.dataTransfer.files?.[0]);
            }}
            spellCheck={false}
            placeholder="Dán Markdown vào đây, hoặc kéo thả file .md / .txt (tối đa 2 MB) vào ô này."
            className={`textarea min-h-0 flex-1 resize-none rounded-3xl bg-white px-4 py-3.5 shadow-md transition-colors ${
              dragging ? "border-accent bg-accent-100" : ""
            }`}
          />
        </div>
      ) : (
        <>
          {/* Thanh rule — radio quick-switch, đổi cái nào cắt lại ngay. */}
          <div className="flex-none px-3 pt-2.5 lg:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] bg-white px-3.5 py-2.5 text-[12.5px] shadow-sm">
              {(Object.keys(RULE_LABEL) as ChunkRuleKind[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    checked={rule === k}
                    onChange={() =>
                      void recut(k, level, k === "marker" ? normalizeMarker(markerBox) : marker)
                    }
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  {RULE_LABEL[k]}
                  {k === "heading" && (
                    <select
                      value={level}
                      onChange={(e) => void recut("heading", Number(e.target.value), marker)}
                      className="input h-7 w-[68px] px-2 py-0 text-xs"
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          ≤ H{n}
                        </option>
                      ))}
                    </select>
                  )}
                  {k === "marker" && (
                    <input
                      value={markerBox}
                      onChange={(e) => setMarkerBox(e.target.value.slice(0, MAX_MARKER_LEN))}
                      onBlur={() => {
                        // Đang ở rule khác thì giữ nguyên chữ vừa gõ, đừng tự nhảy sang marker.
                        if (rule === "marker") void recut("marker", level, normalizeMarker(markerBox));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      title="Dòng bằng đúng chuỗi này sẽ mở chunk mới"
                      className="input h-7 w-[112px] px-2 py-0 font-mono text-xs"
                    />
                  )}
                </label>
              ))}

              <span className="flex-1" />

              <button onClick={() => setStep("input")} className="btn btn-secondary btn-sm h-8">
                Sửa văn bản gốc
              </button>
            </div>
          </div>

          {/* Tổng kết + banner. */}
          <div className="flex flex-none flex-col gap-2 px-3 pt-2.5 lg:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-sand-700">
              <span>{pieces.length} chunk</span>
              {tally.large > 0 && <span className="text-warn-fg">{tally.large} lớn</span>}
              {tally.split > 0 && <span className="text-danger-700">{tally.split} code cắt đôi</span>}
              {tally.empty > 0 && <span className="text-sand-600">{tally.empty} rỗng sẽ bị bỏ</span>}
              {edited && <span className="text-accent-700">✎ đã sửa tay</span>}
              <span className="flex-1" />
              {savedAt && !tooBig && (
                <span className="text-[11.5px] text-sand-500">
                  Đã lưu nháp {new Date(savedAt).toLocaleTimeString("vi-VN")}
                </span>
              )}
            </div>

            {noCutPoint && (
              <div className="rounded-[18px] bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn-fg">
                Không tìm thấy điểm ngắt nào với quy tắc «{RULE_LABEL[rule]}» — chọn quy tắc khác
                hoặc tách tay.
              </div>
            )}
            {pieces.length > MAX_DRAFT_CHUNKS && (
              <div className="rounded-[18px] bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger-fg">
                {pieces.length} chunk, vượt giới hạn {MAX_DRAFT_CHUNKS} — gộp bớt hoặc đổi quy tắc.
              </div>
            )}
            {tooBig && (
              <div className="rounded-[18px] bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn-fg">
                Bản nháp quá lớn, không lưu tự động. Tạo job vẫn được.
              </div>
            )}
            {error && (
              <div className="rounded-[18px] bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger-ink">
                {error}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 gap-3 lg:px-5 lg:pb-4 lg:pt-3">
            <ListPanel
              open={listOpen}
              onClose={() => setListOpen(false)}
              query={query}
              onQuery={setQuery}
              filters={filters}
              filter={filter}
              onFilter={setFilter}
              empty={visible.length === 0 ? "Không có chunk nào khớp bộ lọc." : null}
            >
              {visible.map(({ text: t, idx }) => (
                <div key={idx} className="shrink-0">
                  <DraftChunkBar
                    idx={idx}
                    text={t}
                    tokens={tokens[idx]}
                    flags={flags[idx]}
                    frontMatter={idx === 0 && isFrontMatter(t)}
                    selected={sel === idx}
                    onSelect={() => {
                      setSel(idx);
                      setListOpen(false);
                    }}
                  />
                </div>
              ))}
            </ListPanel>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 pb-16 lg:pb-0">
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={(e) => {
                  caretRef.current = e.target.selectionStart;
                  if (text !== pieces[sel]) {
                    setPieces((prev) => prev.map((p, i) => (i === sel ? text : p)));
                    setEdited(true);
                  }
                }}
                spellCheck={false}
                placeholder="(chunk rỗng — sẽ bị bỏ khi tạo job)"
                className="textarea min-h-0 flex-1 resize-none rounded-3xl bg-white px-4 py-3.5 shadow-md"
              />

              {(selFlags.length > 0 || missingNewline) && (
                <div className="flex flex-wrap items-center gap-2 px-1 text-[12px]">
                  {selFlags.includes("huge") && (
                    <span className="text-danger-700">
                      Chunk này ~{tokens[sel]?.toLocaleString("vi-VN")} token — có thể vượt giới hạn
                      output của model.
                    </span>
                  )}
                  {selFlags.includes("large") && (
                    <span className="text-warn-fg">
                      Chunk này ~{tokens[sel]?.toLocaleString("vi-VN")} token, lớn hơn{" "}
                      {settings.chunkTokens} trong Settings.
                    </span>
                  )}
                  {selFlags.includes("code-split") && (
                    <span className="text-danger-700">
                      Code block bị cắt đôi, dịch có thể hỏng khôi phục code.
                    </span>
                  )}
                  {missingNewline && (
                    <span className="text-sand-600">Sẽ tự thêm xuống dòng cuối chunk.</span>
                  )}
                </div>
              )}

              <div className="action-dock">
                <button onClick={() => setListOpen(true)} className="btn btn-secondary lg:hidden">
                  Danh sách
                </button>
                <button onClick={() => insertAt(sel)} className="btn btn-secondary">
                  Chèn trước
                </button>
                <button onClick={() => insertAt(sel + 1)} className="btn btn-secondary">
                  Chèn sau
                </button>
                <button
                  onClick={splitAtCaret}
                  title="Đặt con trỏ trong ô sửa rồi bấm — chunk tách làm hai tại con trỏ"
                  className="btn btn-secondary"
                >
                  Tách tại con trỏ
                </button>
                <button
                  onClick={mergeNext}
                  disabled={sel >= pieces.length - 1}
                  className="btn btn-secondary"
                >
                  Gộp với sau
                </button>
                <button
                  onClick={removeCurrent}
                  disabled={pieces.length <= 1}
                  className="btn btn-secondary"
                >
                  Xoá
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Popup độc lập: chỉ nhận 5 props, không biết gì về màn hình này (CR v0.6 §7.1).
          Ghi thẳng vào `raw` nên nháp localStorage của v0.4 tự lưu theo. */}
      <WriterDialog
        open={writerOpen}
        onClose={() => setWriterOpen(false)}
        getText={() => raw}
        onReplace={(next) => setRaw(next)}
        onAppend={(added) => setRaw((prev) => prev + added)}
      />

      {dialog}
    </main>
  );
}
