"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTEXT_PROMPT,
  DEFAULT_CHUNK_SUMMARY_PROMPT,
  DEFAULT_SETTINGS,
  MAX_API_KEYS,
  normalizeApiKeys,
  type ChainMode,
  type Settings,
} from "@/lib/defaults";
import { forgetModel, matchModels, readModels, rememberModel } from "@/lib/modelHistory";
import { contractWarning, type PromptSet } from "@/lib/presets";
import { PROMPT_VARS } from "@/lib/promptVars";
import { clampContextTokens, clampCooldown, clampWindowChunks } from "@/lib/validate";
import { useConfirm } from "./ConfirmDialog";
import PresetBar from "./PresetBar";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Chip preset ở top bar mở thẳng vào tab Prompt. */
  initialTab?: Tab;
}

type Tab = "general" | "prompt";

/** Prompt nằm riêng một tab vì textarea dài, đẩy mọi thông số khác trôi khỏi màn hình. */
const PROMPT_KEYS: (keyof Settings)[] = [
  "systemPrompt",
  "summaryPrompt",
  "contextPrompt",
  "chunkSummaryPrompt",
  "presetId",
];

/** Working copy trong Settings đặt tên theo v0 (`systemPrompt`); preset trên DB gọi là translate. */
function promptSetOf(s: Settings): PromptSet {
  return {
    translatePrompt: s.systemPrompt,
    summaryPrompt: s.summaryPrompt,
    contextPrompt: s.contextPrompt,
    chunkSummaryPrompt: s.chunkSummaryPrompt,
  };
}

/**
 * So sánh theo giá trị, không theo tham chiếu: `apiKeys` là mảng và store luôn
 * dựng mảng mới khi lưu, so bằng `!==` thì lưu xong vẫn báo "chưa lưu".
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** Một chỗ duy nhất: cấu hình này áp cho MỌI job. Lưu trong trình duyệt. */
export default function SettingsDrawer({
  open,
  onClose,
  settings,
  updateSettings,
  initialTab = "general",
}: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const { ask, dialog } = useConfirm();

  /**
   * Ô key giữ nguyên văn người dùng gõ (kể cả rỗng / trùng) để không nuốt ô đang nhập dở,
   * nên nó là state riêng — mọi chỗ đặt lại draft đều phải đặt lại nó cùng lúc, nếu không
   * màn hình sẽ hiện một đằng còn giá trị thật một nẻo.
   */
  const [keyRows, setKeyRowsRaw] = useState<string[]>([]);
  const [showDefaultContext, setShowDefaultContext] = useState(false);
  const [showDefaultChunkSummary, setShowDefaultChunkSummary] = useState(false);

  /** PresetBar ghi settings ngay khi ghi DB — cần draft mới nhất, không phải bản của render trước. */
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const syncFrom = useCallback((next: Settings) => {
    setDraft(next);
    setKeyRowsRaw(next.apiKeys.length > 0 ? next.apiKeys : [""]);
  }, []);

  useEffect(() => {
    if (open) {
      syncFrom(settings);
      setSavedAt(null);
      setTab(initialTab);
      setShowDefaultContext(false);
      setShowDefaultChunkSummary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  const changed = (Object.keys(settings) as (keyof Settings)[]).filter(
    (k) => !sameValue(draft[k], settings[k])
  );
  const dirty = changed.length > 0;
  const promptDirty = changed.some((k) => PROMPT_KEYS.includes(k));
  const generalDirty = changed.some((k) => !PROMPT_KEYS.includes(k));

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const setKeyRows = useCallback((rows: string[]) => {
    setKeyRowsRaw(rows);
    setDraft((d) => ({ ...d, apiKeys: normalizeApiKeys(rows) }));
  }, []);

  const setKey = (i: number, v: string) =>
    setKeyRows(keyRows.map((k, j) => (j === i ? v : k)));

  const removeKey = (i: number) => {
    const next = keyRows.filter((_, j) => j !== i);
    setKeyRows(next.length > 0 ? next : [""]);
  };

  const save = useCallback(() => {
    updateSettings(draft);
    // Chỉ nhớ model lúc lưu, không nhớ lúc gõ — nếu không lịch sử đầy các chuỗi gõ dở.
    rememberModel(draft.model);
    // Hiện lại đúng thứ vừa lưu: ô rỗng biến mất, key trùng gộp lại.
    syncFrom({ ...draft, apiKeys: normalizeApiKeys(draft.apiKeys) });
    setSavedAt(new Date().toLocaleTimeString("vi-VN"));
  }, [draft, syncFrom, updateSettings]);

  /** PresetBar nạp preset vào draft: 4 ô prompt + preset đang gắn. */
  const applyPreset = useCallback((patch: { presetId?: string | null; prompts?: PromptSet }) => {
    setDraft((d) => ({
      ...d,
      ...(patch.presetId !== undefined ? { presetId: patch.presetId } : {}),
      ...(patch.prompts
        ? {
            systemPrompt: patch.prompts.translatePrompt,
            summaryPrompt: patch.prompts.summaryPrompt,
            contextPrompt: patch.prompts.contextPrompt,
            chunkSummaryPrompt: patch.prompts.chunkSummaryPrompt,
          }
        : {}),
    }));
  }, []);

  /** Ghi DB xong thì ghi working copy vào settings luôn (§3.2), khỏi chờ nút Lưu. */
  const persistPreset = useCallback(
    (presetId: string | null) => {
      const next = { ...draftRef.current, presetId };
      updateSettings(next);
      setDraft(next);
      setSavedAt(new Date().toLocaleTimeString("vi-VN"));
    },
    [updateSettings]
  );

  const tryClose = useCallback(async () => {
    if (dirty) {
      const ok = await ask({
        title: "Đóng Settings?",
        body: "Còn thay đổi chưa lưu. Đóng và bỏ luôn?",
        ok: "Bỏ thay đổi",
      });
      if (!ok) return;
    }
    onClose();
  }, [ask, dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void tryClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tryClose, save]);

  /**
   * Tắt "tạo tóm tắt chunk" thì nấc `prev` mất chỗ dựa nên rơi về `off`;
   * `window` vẫn chạy được bằng phần nguyên văn nên giữ nguyên (CR v0.7 §2.1).
   */
  const setChunkSummary = (on: boolean) =>
    setDraft((d) => ({
      ...d,
      chunkSummary: on,
      chainMode: !on && d.chainMode === "prev" ? "off" : d.chainMode,
    }));

  const chainOn = draft.chainMode !== "off";

  if (!open) return null;

  return (
    <div
      className="sheet-wrap"
      style={{ background: "color-mix(in srgb, #16310d 34%, transparent)" }}
    >
      <div onClick={() => void tryClose()} className="flex-1" />

      {/* Cùng một panel: dưới md là bottom sheet, từ md là drawer bên phải. */}
      <aside className="sheet bg-bg">
        <span className="sheet-grab" />
        <div className="flex-none px-[22px] pt-[18px]">
          <div className="flex items-center gap-3">
            <h4 className="m-0 flex-1">Settings</h4>
            <button
              onClick={() => void tryClose()}
              className="text-[12.5px] text-sand-600 hover:underline"
            >
              Đóng (Esc)
            </button>
          </div>

          <div className="mt-3 flex gap-1 border-b border-divider">
            <DrawerTab active={tab === "general"} dirty={generalDirty} onClick={() => setTab("general")}>
              Chung
            </DrawerTab>
            <DrawerTab active={tab === "prompt"} dirty={promptDirty} onClick={() => setTab("prompt")}>
              Prompt
            </DrawerTab>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[22px] pb-[26px] pt-[18px]">
          {tab === "general" ? (
            <>
              <Hint>
                Áp cho <strong>mọi job</strong>, kể cả job đã tạo. Lưu trong trình duyệt — API key
                không bao giờ được lưu trên server.
              </Hint>

              <Field label="API keys">
                <div className="flex flex-col gap-2">
                  {keyRows.map((key, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(i, e.target.value)}
                        placeholder="sk-..."
                        autoComplete="off"
                        className="input flex-1"
                      />
                      {key.trim() && (
                        <span className="w-14 shrink-0 font-mono text-[11px] text-sand-600">
                          …{key.trim().slice(-4)}
                        </span>
                      )}
                      {keyRows.length > 1 && (
                        <button
                          onClick={() => removeKey(i)}
                          title="Xoá key này"
                          className="h-7 w-7 shrink-0 rounded-pill text-sand-600 hover:bg-danger-bg hover:text-danger-fg"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {keyRows.length < MAX_API_KEYS && (
                  <button
                    onClick={() => setKeyRows([...keyRows, ""])}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    + Thêm key
                  </button>
                )}
                <Note>
                  Nhiều key → app xoay vòng từng cú gọi, dính 429 thì đổi key kế tiếp. Các key phải
                  cùng endpoint.
                </Note>
              </Field>

              <Field label="Endpoint (base URL)">
                <input
                  value={draft.endpoint}
                  onChange={(e) => set("endpoint", e.target.value)}
                  className="input"
                />
                <Note>App tự nối /chat/completions.</Note>
              </Field>

              <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                <Field label="Model">
                  <ModelInput value={draft.model} onChange={(v) => set("model", v)} />
                </Field>
                <Field label="Temperature">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={draft.temperature}
                    onChange={(e) => set("temperature", Number(e.target.value))}
                    className="input"
                  />
                </Field>
              </div>

              {/* Chuỗi bật thì luồng dịch chạy 1-1; giá trị vẫn giữ nguyên cho lúc tắt chuỗi. */}
              <div className={chainOn ? "opacity-50" : ""}>
                <Field
                  label={`Concurrency: ${draft.concurrency}`}
                  action={
                    chainOn ? (
                      <span className="text-[11.5px] text-warn-fg">đang bị ép = 1 (chuỗi)</span>
                    ) : undefined
                  }
                >
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={draft.concurrency}
                    onChange={(e) => set("concurrency", Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </Field>
              </div>

              <Field label="Cool down (giây)">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={draft.cooldownMs / 1000}
                  onChange={(e) => set("cooldownMs", clampCooldown(Number(e.target.value) * 1000))}
                  className="input"
                />
                <Note>
                  {draft.cooldownMs > 0
                    ? `≈ ${draft.concurrency} call / ${draft.cooldownMs / 1000}s với concurrency ${draft.concurrency}. Mỗi worker nghỉ sau khi xong một call.`
                    : "0 = tắt, worker chạy liên tục."}
                </Note>
              </Field>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={draft.chunkSummary}
                  onChange={(e) => setChunkSummary(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  Tạo tóm tắt chunk
                  <Note>
                    Cùng cú gọi dịch, trả thêm thẻ &lt;summary&gt;, tốn thêm ~100 token output mỗi
                    chunk.
                  </Note>
                </span>
              </label>

              <Field label="Ngữ cảnh mạch khi dịch">
                <div className="flex flex-col gap-1.5">
                  <ChainRadio
                    value="off"
                    current={draft.chainMode}
                    onPick={(v) => set("chainMode", v)}
                    label="Tắt"
                    note="Mỗi chunk dịch độc lập, chạy song song theo Concurrency."
                  />
                  <ChainRadio
                    value="prev"
                    current={draft.chainMode}
                    onPick={(v) => set("chainMode", v)}
                    disabled={!draft.chunkSummary}
                    label="Tóm tắt đoạn liền trước"
                    note={
                      draft.chunkSummary
                        ? "Bơm tóm tắt đúng một đoạn ngay trước. Rẻ nhất trong ba nấc."
                        : "Cần bật “Tạo tóm tắt chunk” ở trên."
                    }
                  />
                  <ChainRadio
                    value="window"
                    current={draft.chainMode}
                    onPick={(v) => set("chainMode", v)}
                    label="Cửa sổ trượt"
                    note="Tóm tắt mọi đoạn đã dịch, cộng nguyên văn mấy đoạn gần nhất."
                  />
                </div>

                {draft.chainMode === "window" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-3 rounded-2xl bg-paper p-3">
                    <Field label="Đoạn nguyên văn gần nhất">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={draft.contextWindowChunks}
                        onChange={(e) =>
                          set("contextWindowChunks", clampWindowChunks(Number(e.target.value)))
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Trần ngữ cảnh (token)">
                      <input
                        type="number"
                        min={500}
                        max={100000}
                        step={500}
                        value={draft.contextTokens}
                        onChange={(e) =>
                          set("contextTokens", clampContextTokens(Number(e.target.value)))
                        }
                        className="input"
                      />
                    </Field>
                  </div>
                )}

                {draft.chainMode === "window" && !draft.chunkSummary && (
                  <p className="m-0 mt-2 rounded-2xl bg-warn-bg px-3.5 py-2.5 text-xs text-warn-fg">
                    Chưa bật “Tạo tóm tắt chunk” → khối chỉ có {draft.contextWindowChunks} đoạn gần
                    nhất, không có phần xa.
                  </p>
                )}

                {chainOn && (
                  <Note>
                    Dịch tuần tự 1-1, bỏ qua Concurrency. Thời gian ≈ số chunk × (latency + cool
                    down).
                    {draft.chainMode === "window" && (
                      <>
                        {" "}
                        Mỗi chunk gửi kèm tối đa {draft.contextTokens} token ngữ cảnh nên tốn token
                        hơn hẳn — và xoay nhiều key làm hỏng prompt cache của provider, job chạy
                        nấc này nên để đúng một key.
                      </>
                    )}
                  </Note>
                )}
              </Field>

              <Field label="Chunk tokens (ước lượng chars/4)">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={draft.chunkTokens}
                  onChange={(e) => set("chunkTokens", Number(e.target.value))}
                  className="input"
                />
                <Note>Đổi số này thì trang job sẽ nhắc chunk lại (chunk lại là mất bản dịch cũ).</Note>
              </Field>

              <div className="my-1 h-px bg-divider" />
              <h6 className="m-0 text-sand-700">Tóm tắt</h6>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={draft.useContextForTranslation}
                  onChange={(e) => set("useContextForTranslation", e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  Dùng ngữ cảnh chung khi dịch
                  <Note>
                    Bơm ngữ cảnh chung của job vào prompt dịch để giữ thuật ngữ nhất quán. Job chưa có
                    ngữ cảnh chung thì dịch như bình thường — tạo ở tab Summary.
                  </Note>
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Section tokens">
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={draft.summaryTokens}
                    onChange={(e) => set("summaryTokens", Number(e.target.value))}
                    className="input"
                  />
                </Field>
                <Field label="Context max tokens">
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={draft.contextMaxTokens}
                    onChange={(e) => set("contextMaxTokens", Number(e.target.value))}
                    className="input"
                  />
                </Field>
              </div>
              <Note>
                Đổi Section tokens thì trang job gom lại section (mất tóm tắt cũ). Tài liệu vượt
                Context max tokens thì gửi skeleton (heading + phần đầu mỗi section).
              </Note>
            </>
          ) : (
            <>
              <Hint>
                App tự nối output contract vào cuối mỗi prompt — đừng tự viết luật thẻ trong này.
              </Hint>

              <PresetBar
                presetId={draft.presetId}
                prompts={promptSetOf(draft)}
                onDraft={applyPreset}
                onPersist={persistPreset}
              />

              {contractWarning(promptSetOf(draft)) && (
                <p className="m-0 rounded-2xl bg-warn-bg px-3.5 py-2.5 text-xs text-warn-fg">
                  {contractWarning(promptSetOf(draft))}
                </p>
              )}

              <Field
                label="System prompt (dịch)"
                action={
                  <button
                    onClick={() => set("systemPrompt", DEFAULT_SETTINGS.systemPrompt)}
                    className="text-xs text-accent hover:underline"
                  >
                    Về mặc định
                  </button>
                }
              >
                <textarea
                  value={draft.systemPrompt}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                  className="textarea h-[230px] rounded-[18px] bg-white"
                />
                <Note>
                  App chỉ nối thêm đúng một thứ: luật thẻ &lt;translation&gt;. Mọi khối ngữ cảnh đều
                  do placeholder quyết định — không đặt vào prompt thì không gửi.
                </Note>
                <PromptVarHelp />
              </Field>

              <Field
                label="Summary prompt (tóm tắt section)"
                action={
                  <button
                    onClick={() => set("summaryPrompt", DEFAULT_SETTINGS.summaryPrompt)}
                    className="text-xs text-accent hover:underline"
                  >
                    Về mặc định
                  </button>
                }
              >
                <textarea
                  value={draft.summaryPrompt}
                  onChange={(e) => set("summaryPrompt", e.target.value)}
                  className="textarea h-[170px] rounded-[18px] bg-white"
                />
                <Note>Nối thêm: bắt buộc thẻ &lt;summary&gt;.</Note>
              </Field>

              <Field
                label="Context prompt (ngữ cảnh chung)"
                action={
                  <button
                    onClick={() => setShowDefaultContext((v) => !v)}
                    className="text-xs text-accent hover:underline"
                  >
                    {showDefaultContext ? "Ẩn mặc định" : "Xem mặc định"}
                  </button>
                }
              >
                <textarea
                  value={draft.contextPrompt}
                  onChange={(e) => set("contextPrompt", e.target.value)}
                  placeholder="Để trống = dùng prompt mặc định của app."
                  className="textarea h-[130px] rounded-[18px] bg-white"
                />
                <Note>
                  App vẫn tự nối contract thẻ &lt;context&gt; và ghi chú skeleton khi tài liệu bị
                  cắt.
                </Note>
                {showDefaultContext && (
                  <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[18px] bg-paper p-3 text-[11.5px] leading-snug text-sand-700">
                    {CONTEXT_PROMPT}
                  </pre>
                )}
              </Field>

              <Field
                label="Chunk summary prompt (tóm tắt chunk)"
                action={
                  <button
                    onClick={() => setShowDefaultChunkSummary((v) => !v)}
                    className="text-xs text-accent hover:underline"
                  >
                    {showDefaultChunkSummary ? "Ẩn mặc định" : "Xem mặc định"}
                  </button>
                }
              >
                <textarea
                  value={draft.chunkSummaryPrompt}
                  onChange={(e) => set("chunkSummaryPrompt", e.target.value)}
                  placeholder="Để trống = dùng mặc định app."
                  className="textarea h-[130px] rounded-[18px] bg-white"
                />
                <Note>
                  Chỉ dùng khi bật “Tạo tóm tắt chunk” ở tab Chung. App tự nối contract hai thẻ
                  &lt;translation&gt; + &lt;summary&gt;.
                </Note>
                {showDefaultChunkSummary && (
                  <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[18px] bg-paper p-3 text-[11.5px] leading-snug text-sand-700">
                    {DEFAULT_CHUNK_SUMMARY_PROMPT}
                  </pre>
                )}
              </Field>
            </>
          )}
        </div>

        <div className="flex flex-none items-center gap-2.5 border-t border-divider bg-white px-[22px] py-3.5">
          <button onClick={save} disabled={!dirty} className="btn btn-primary h-[38px]">
            Lưu {dirty && "•"}
          </button>
          <button
            onClick={() => syncFrom(settings)}
            disabled={!dirty}
            className="btn btn-secondary h-[38px]"
          >
            Huỷ thay đổi
          </button>
          <span className="flex-1" />
          <span className={`text-xs ${dirty ? "text-danger-700" : "text-accent-700"}`}>
            {dirty ? "● chưa lưu" : savedAt ? `✓ đã lưu ${savedAt}` : "✓ đã lưu"}
          </span>
        </div>
      </aside>

      {dialog}
    </div>
  );
}

/**
 * Ô Model kèm gợi ý các model đã dùng (lưu ở localStorage, xem `modelHistory`).
 * Không dùng <datalist>: mỗi trình duyệt xổ một kiểu và không xoá được từng dòng.
 */
function ModelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  /** Chỉ lọc sau khi người dùng gõ — bấm vào ô đang điền sẵn thì phải thấy cả danh sách. */
  const [typing, setTyping] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Đọc lại mỗi lần xổ: `save()` ở drawer có thể vừa thêm model mới vào lịch sử.
  const openList = () => {
    setHistory(readModels());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setTyping(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const hits = typing ? matchModels(history, value) : history.filter((m) => m !== value);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyping(true);
          if (!open) openList();
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={(e) => {
          // Esc đóng gợi ý trước, không để nó đóng luôn cả drawer.
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            setTyping(false);
          }
        }}
        autoComplete="off"
        className="input"
      />
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[188px] overflow-y-auto rounded-2xl border border-divider bg-white p-1 shadow-md">
          {hits.map((model) => (
            <div key={model} className="group flex items-center gap-1">
              <button
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                  setTyping(false);
                }}
                title={model}
                className="min-w-0 flex-1 truncate rounded-pill px-2.5 py-1.5 text-left font-mono text-[11.5px] text-sand-800 hover:bg-accent-100"
              >
                {model}
              </button>
              <button
                onClick={() => setHistory(forgetModel(model))}
                title="Quên model này"
                className="h-6 w-6 shrink-0 rounded-pill text-sand-500 opacity-0 hover:bg-danger-bg hover:text-danger-fg group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bảng biến dùng được trong prompt dịch (CR v0.7 §6.2). Gập lại mặc định — nó là
 * thứ tra cứu, mở sẵn thì đẩy ba ô prompt còn lại trôi khỏi màn hình. Bấm một
 * dòng là chép tên biến vào clipboard để dán thẳng vào ô prompt.
 */
function PromptVarHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`{{${name}}}`);
      setCopied(name);
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500);
    } catch {
      // Trình duyệt chặn clipboard → người dùng tự gõ, tên biến đang hiện sẵn.
    }
  };

  return (
    <div className="mt-2 rounded-2xl bg-paper p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-[11.5px] text-accent-800"
      >
        <span>{open ? "▾" : "▸"}</span>
        Biến dùng được trong prompt ({PROMPT_VARS.length})
      </button>

      {open && (
        <>
          <p className="m-0 mt-2 text-[11.5px] leading-snug text-sand-700">
            Đặt các biến này vào prompt, app sẽ thay bằng nội dung thật. Biến rỗng thì{" "}
            <strong>cả đoạn văn</strong> chứa nó biến mất, nên hãy để thẻ và câu hướng dẫn chung một
            đoạn với biến. Bấm để chép.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {PROMPT_VARS.map((v) => (
              <button
                key={v.name}
                onClick={() => void copy(v.name)}
                title={v.needs ? `Cần: ${v.needs}` : "Luôn có giá trị"}
                className="flex flex-wrap items-baseline gap-x-2 rounded-[10px] px-1.5 py-1 text-left hover:bg-accent-100"
              >
                <code className="font-mono text-[11.5px] text-accent-800">{`{{${v.name}}}`}</code>
                <span className="text-[11px] leading-snug text-sand-600">{v.hint}</span>
                {copied === v.name && <span className="text-[11px] text-accent">đã chép</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Một nấc của cụm "Ngữ cảnh mạch khi dịch" (CR v0.7 §6.1). */
function ChainRadio({
  value,
  current,
  onPick,
  label,
  note,
  disabled = false,
}: {
  value: ChainMode;
  current: ChainMode;
  onPick: (v: ChainMode) => void;
  label: string;
  note: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 text-[13px] ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="radio"
        name="chainMode"
        checked={current === value}
        disabled={disabled}
        onChange={() => onPick(value)}
        className="mt-1 h-4 w-4 accent-accent"
      />
      <span>
        {label}
        <Note>{note}</Note>
      </span>
    </label>
  );
}

function DrawerTab({
  active,
  dirty,
  onClick,
  children,
}: {
  active: boolean;
  dirty: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{ boxShadow: active ? "inset 0 -2px 0 var(--color-accent)" : "none" }}
      className={`flex items-center gap-1 px-3 py-[7px] text-[13px] ${
        active ? "text-accent-700" : "text-sand-600 hover:text-ink"
      }`}
    >
      {children}
      {dirty && <span title="Có thay đổi chưa lưu">•</span>}
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-2xl bg-accent-100 px-3.5 py-2.5 text-xs text-sand-700">{children}</p>
  );
}

/** span-block chứ không phải <p>: Note có lúc nằm trong <span> của label checkbox. */
function Note({ children }: { children: React.ReactNode }) {
  return <span className="mt-1.5 block text-[11.5px] leading-snug text-sand-600">{children}</span>;
}

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="flex items-baseline gap-2.5">
        <label className="flex-1">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}
