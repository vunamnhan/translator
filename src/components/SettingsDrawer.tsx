"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, MAX_API_KEYS, normalizeApiKeys, type Settings } from "@/lib/defaults";
import { clampCooldown } from "@/lib/validate";
import { useConfirm } from "./ConfirmDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

type Tab = "general" | "prompt";

/** Prompt nằm riêng một tab vì textarea dài, đẩy mọi thông số khác trôi khỏi màn hình. */
const PROMPT_KEYS: (keyof Settings)[] = ["systemPrompt", "summaryPrompt"];

/** Một chỗ duy nhất: cấu hình này áp cho MỌI job. Lưu trong trình duyệt. */
export default function SettingsDrawer({ open, onClose, settings, updateSettings }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setSavedAt(null);
      setTab("general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changed = (Object.keys(settings) as (keyof Settings)[]).filter(
    (k) => draft[k] !== settings[k]
  );
  const dirty = changed.length > 0;
  const promptDirty = changed.some((k) => PROMPT_KEYS.includes(k));
  const generalDirty = changed.some((k) => !PROMPT_KEYS.includes(k));

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /**
   * Ô key giữ nguyên văn người dùng gõ (kể cả rỗng / trùng) để không nuốt ô đang nhập dở;
   * chuẩn hoá chỉ xảy ra khi ghi vào draft.
   */
  const [keyRows, setKeyRowsRaw] = useState<string[]>([]);
  useEffect(() => {
    if (open) setKeyRowsRaw(settings.apiKeys.length > 0 ? settings.apiKeys : [""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    setSavedAt(new Date().toLocaleTimeString("vi-VN"));
  }, [draft, updateSettings]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "color-mix(in srgb, #16310d 34%, transparent)" }}
    >
      <div onClick={() => void tryClose()} className="flex-1" />

      <aside className="flex h-full w-[452px] max-w-full animate-tz-slide flex-col bg-bg shadow-lg">
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
                  <input
                    value={draft.model}
                    onChange={(e) => set("model", e.target.value)}
                    className="input"
                  />
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

              <Field label={`Concurrency: ${draft.concurrency}`}>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={draft.concurrency}
                  onChange={(e) => set("concurrency", Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </Field>

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
                <Note>Nối thêm: bắt buộc thẻ &lt;translation&gt;.</Note>
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

              <Note>
                Prompt tạo <strong>ngữ cảnh chung</strong> là cố định trong app — sửa kết quả trực
                tiếp ở tab Summary của từng job.
              </Note>
            </>
          )}
        </div>

        <div className="flex flex-none items-center gap-2.5 border-t border-divider bg-white px-[22px] py-3.5">
          <button onClick={save} disabled={!dirty} className="btn btn-primary h-[38px]">
            Lưu {dirty && "•"}
          </button>
          <button
            onClick={() => setDraft(settings)}
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
