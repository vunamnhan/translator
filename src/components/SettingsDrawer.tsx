"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/defaults";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

/** Một chỗ duy nhất: cấu hình này áp cho MỌI job. Lưu trong trình duyệt. */
export default function SettingsDrawer({ open, onClose, settings, updateSettings }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setSavedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = (Object.keys(settings) as (keyof Settings)[]).some((k) => draft[k] !== settings[k]);
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <p className="text-xs text-neutral-500">
            Áp cho <strong>mọi job</strong>, kể cả job đã tạo. Lưu trong trình duyệt — API key không
            bao giờ được lưu trên server.
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
              {draft.apiKey ? `${draft.apiKey.length} ký tự — nhớ bấm Lưu ở dưới.` : "Chưa nhập key thì Start sẽ bị chặn."}
            </p>
          </Field>

          <Field label="Endpoint (base URL)">
            <input value={draft.endpoint} onChange={(e) => set("endpoint", e.target.value)} className="input" />
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

          <Field label="System prompt">
            <textarea
              value={draft.systemPrompt}
              rows={10}
              onChange={(e) => set("systemPrompt", e.target.value)}
              className="input font-mono text-xs"
            />
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-xs text-neutral-500">
                App tự nối output contract (bắt buộc thẻ &lt;translation&gt;) vào cuối.
              </p>
              <button
                onClick={() => set("systemPrompt", DEFAULT_SETTINGS.systemPrompt)}
                className="ml-auto whitespace-nowrap text-xs text-blue-600 hover:underline"
              >
                Về mặc định
              </button>
            </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}
