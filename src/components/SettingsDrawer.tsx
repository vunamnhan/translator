"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/defaults";

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

  const save = useCallback(() => {
    updateSettings(draft);
    setSavedAt(new Date().toLocaleTimeString("vi-VN"));
  }, [draft, updateSettings]);

  const tryClose = useCallback(() => {
    if (dirty && !confirm("Còn thay đổi chưa lưu. Đóng và bỏ luôn?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tryClose();
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={tryClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={tryClose} className="text-sm text-neutral-500 hover:underline">
            Đóng (Esc)
          </button>
        </div>

        <div className="flex gap-1 border-b border-neutral-200 px-5 text-sm dark:border-neutral-800">
          <TabButton active={tab === "general"} dirty={generalDirty} onClick={() => setTab("general")}>
            Chung
          </TabButton>
          <TabButton active={tab === "prompt"} dirty={promptDirty} onClick={() => setTab("prompt")}>
            Prompt
          </TabButton>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {tab === "general" ? (
            <>
              <p className="text-xs text-neutral-500">
                Áp cho <strong>mọi job</strong>, kể cả job đã tạo. Lưu trong trình duyệt — API key
                không bao giờ được lưu trên server.
              </p>

              <Field label="API key">
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => set("apiKey", e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="input"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  {draft.apiKey
                    ? `${draft.apiKey.length} ký tự — nhớ bấm Lưu ở dưới.`
                    : "Chưa nhập key thì Start sẽ bị chặn."}
                </p>
              </Field>

              <Field label="Endpoint (base URL)">
                <input
                  value={draft.endpoint}
                  onChange={(e) => set("endpoint", e.target.value)}
                  className="input"
                />
                <p className="mt-1 text-xs text-neutral-500">App tự nối /chat/completions.</p>
              </Field>

              <Field label="Model">
                <input value={draft.model} onChange={(e) => set("model", e.target.value)} className="input" />
              </Field>

              <Field label={`Temperature: ${draft.temperature}`}>
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

              <Field label={`Concurrency: ${draft.concurrency}`}>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={draft.concurrency}
                  onChange={(e) => set("concurrency", Number(e.target.value))}
                  className="w-full"
                />
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
                <p className="mt-1 text-xs text-neutral-500">
                  Đổi số này thì trang job sẽ nhắc chunk lại (chunk lại là mất bản dịch cũ).
                </p>
              </Field>

              <hr className="border-neutral-200 dark:border-neutral-800" />
              <h3 className="font-semibold">Tóm tắt</h3>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={draft.useContextForTranslation}
                  onChange={(e) => set("useContextForTranslation", e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Dùng ngữ cảnh chung khi dịch</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    Bơm ngữ cảnh chung của job vào prompt dịch. Job chưa có ngữ cảnh chung thì dịch
                    như bình thường — tạo ở tab Summary.
                  </span>
                </span>
              </label>

              <Field label="Section tokens (gom chunk để tóm tắt)">
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={draft.summaryTokens}
                  onChange={(e) => set("summaryTokens", Number(e.target.value))}
                  className="input"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Đổi số này thì trang job sẽ gom lại section (mất tóm tắt section cũ).
                </p>
              </Field>

              <Field label="Context max tokens (ngưỡng gửi nguyên văn)">
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={draft.contextMaxTokens}
                  onChange={(e) => set("contextMaxTokens", Number(e.target.value))}
                  className="input"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Tài liệu vượt ngưỡng thì gửi skeleton (heading + phần đầu mỗi section).
                </p>
              </Field>
            </>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                App tự nối output contract vào cuối mỗi prompt — đừng tự viết luật thẻ trong này.
              </p>

              <Field label="System prompt (dịch)">
                <textarea
                  value={draft.systemPrompt}
                  rows={16}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                  className="input font-mono text-xs"
                />
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-xs text-neutral-500">
                    Nối thêm: bắt buộc thẻ &lt;translation&gt;.
                  </p>
                  <button
                    onClick={() => set("systemPrompt", DEFAULT_SETTINGS.systemPrompt)}
                    className="ml-auto whitespace-nowrap text-xs text-blue-600 hover:underline"
                  >
                    Về mặc định
                  </button>
                </div>
              </Field>

              <Field label="Summary prompt (tóm tắt section)">
                <textarea
                  value={draft.summaryPrompt}
                  rows={12}
                  onChange={(e) => set("summaryPrompt", e.target.value)}
                  className="input font-mono text-xs"
                />
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-xs text-neutral-500">Nối thêm: bắt buộc thẻ &lt;summary&gt;.</p>
                  <button
                    onClick={() => set("summaryPrompt", DEFAULT_SETTINGS.summaryPrompt)}
                    className="ml-auto whitespace-nowrap text-xs text-blue-600 hover:underline"
                  >
                    Về mặc định
                  </button>
                </div>
              </Field>

              <p className="text-xs text-neutral-500">
                Prompt tạo <strong>ngữ cảnh chung</strong> là cố định trong app — sửa kết quả trực
                tiếp ở tab Summary của từng job.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <button
            onClick={save}
            disabled={!dirty}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Lưu {dirty && "•"}
          </button>
          <button
            onClick={() => setDraft(settings)}
            disabled={!dirty}
            className="rounded border border-neutral-400 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Huỷ thay đổi
          </button>
          <span className="ml-auto text-xs text-neutral-500">
            {dirty ? "● chưa lưu" : savedAt ? `✓ đã lưu ${savedAt}` : "✓ đã lưu"}
          </span>
        </div>
      </aside>
    </div>
  );
}

function TabButton({
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
      className={`-mb-px flex items-center gap-1 border-b-2 px-3 py-2 font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
      {dirty && <span title="Có thay đổi chưa lưu">•</span>}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}
