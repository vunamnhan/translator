"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Menu from "./Menu";
import { Spinner } from "./bar";
import { useConfirm } from "./ConfirmDialog";
import { useNameDialog } from "./NameDialog";
import { apiKeyLabel } from "@/lib/defaults";
import { errorCode, errorHint } from "@/lib/errors";
import { isRateLimited, nextKey, pickKey, type KeyPick } from "@/lib/runner";
import { useSettings } from "@/lib/useSettings";
import {
  appendBlock,
  copyName,
  draftFromPrompt,
  draftModified,
  EMPTY_DRAFT,
  fieldLabel,
  fillTemplate,
  MAX_FIELD_VALUE,
  MAX_FILLED_PROMPT,
  MAX_WRITER_TEMPLATE,
  parseTemplate,
  pruneFields,
  type WriterDraft,
} from "@/lib/writerPrompts";
import {
  createWriterPrompt,
  deleteWriterPrompt,
  forgetWriterPrompt,
  loadWriterPrompts,
  readWriterDraft,
  updateWriterPrompt,
  useWriterState,
  WriterError,
  writeWriterDraft,
} from "@/lib/writerStore";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nội dung cho `{{text}}` — nơi gắn popup tự quyết định lấy chữ ở đâu. */
  getText: () => string;
  onReplace: (text: string) => void;
  /** Nhận **phần thêm vào**, đã kèm dòng trống ngăn cách (xem `appendBlock`). */
  onAppend: (text: string) => void;
}

/**
 * Assistant Writer (CR v0.6). Popup độc lập: không biết trang New, job hay chunk
 * là gì, chỉ nhận 5 props. Muốn gắn chỗ khác thì render nó ở đó, không sửa gì bên trong.
 *
 * Hai tầng y như preset v0.3: mẫu trên DB chỉ để nạp xuống / cất lên, thứ thực sự
 * gửi đi là working copy trong popup. Server không biết mẫu hay placeholder —
 * điền xong ở đây rồi mới gọi `/api/writer/run`.
 */
export default function WriterDialog({ open, onClose, getText, onReplace, onAppend }: Props) {
  const { settings } = useSettings();
  const { items, loading, error: listError } = useWriterState();
  const { ask, dialog: confirmDialog } = useConfirm();
  const { askName, dialog: nameDialog } = useNameDialog();

  const [draft, setDraft] = useState<WriterDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [parsed, setParsed] = useState(() => parseTemplate(""));
  const [tab, setTab] = useState<"fill" | "result">("fill");
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const keyCursor = useRef(0);
  // Bản draft mới nhất, để lúc đóng ghi ngay chứ không mất phần debounce đang chờ.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Nạp working copy từ sessionStorage mỗi lần mở: đóng / mở lại trong cùng phiên
  // thì mẫu, giá trị, kết quả còn nguyên (§3.6).
  useEffect(() => {
    if (!open) return;
    const d = readWriterDraft();
    setDraft(d);
    setEditMode(d.promptId === null);
    setParsed(parseTemplate(d.template));
    setError(null);
    setNote(null);
    setTab("fill");
    setHydrated(true);
    void loadWriterPrompts(true);
  }, [open]);

  // Cất working copy lại, debounce 300 ms — kết quả có thể dài, khỏi ghi mỗi phím.
  // Chỉ ghi sau khi đã nạp xong, kẻo đè bằng draft rỗng.
  useEffect(() => {
    if (!open || !hydrated) return;
    const t = setTimeout(() => writeWriterDraft(draft), 300);
    return () => clearTimeout(t);
  }, [open, hydrated, draft]);

  // Gõ template → parse lại, debounce 300 ms. Giá trị ô trùng tên giữ nguyên vì
  // `values` không bị đụng tới, ô mới chỉ đơn giản là chưa có key (§3.7).
  useEffect(() => {
    const t = setTimeout(() => setParsed(parseTemplate(draft.template)), 300);
    return () => clearTimeout(t);
  }, [draft.template]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Đóng popup: cắt request đang chạy và ghi ngay working copy — đóng trong vòng
  // 300 ms sau khi gõ thì cleanup của effect trên đã huỷ lần ghi đang chờ.
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    if (hydrated) writeWriterDraft(draftRef.current);
  }, [open, hydrated]);

  const patch = useCallback((p: Partial<WriterDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  if (!open) return null;

  const current = items.find((p) => p.id === draft.promptId) ?? null;
  const modified = draftModified(draft, current);
  const text = getText();
  const keys = settings.apiKeys;
  const temperature = draft.temperature ?? settings.temperature;

  /** 404 nghĩa là mẫu không còn trên DB: gỡ khỏi danh sách, giữ nguyên working copy. */
  const handleGone = (e: unknown, id: string) => {
    if (e instanceof WriterError && e.status === 404) {
      forgetWriterPrompt(id);
      patch({ promptId: null });
      setNote("Mẫu không còn tồn tại — giữ nguyên nội dung đang điền.");
      return true;
    }
    return false;
  };

  const select = (id: string) => {
    setNote(null);
    setError(null);
    if (!id) {
      // "— Chọn mẫu —": bỏ mẫu nhưng giữ nguyên template và giá trị đang điền.
      patch({ promptId: null });
      setEditMode(true);
      return;
    }
    const next = items.find((p) => p.id === id);
    if (!next) return;
    setDraft(draftFromPrompt(next, draft.result));
    setParsed(parseTemplate(next.template));
    setEditMode(false);
  };

  async function callRun(pick: KeyPick, prompt: string, signal: AbortSignal) {
    const res = await fetch("/api/writer/run", {
      method: "POST",
      headers: { "content-type": "application/json", "x-llm-key": pick.key },
      body: JSON.stringify({
        endpoint: settings.endpoint,
        model: settings.model,
        temperature,
        prompt,
      }),
      signal,
    });
    const data = (await res.json()) as { output?: string | null; error?: string };
    if (!res.ok) return { output: null, error: data.error ?? `HTTP ${res.status}` };
    return { output: data.output ?? null, error: data.error ?? null };
  }

  async function run() {
    if (running) return;
    if (keys.length === 0) {
      setError("Chưa có API key — mở Settings trên thanh trên cùng để nhập.");
      return;
    }
    const prompt = fillTemplate(draft.template, draft.values, text);
    if (prompt.trim().length === 0) {
      setError("Template rỗng — chọn một mẫu hoặc gõ template ở chế độ Sửa mẫu.");
      return;
    }
    if (prompt.length > MAX_FILLED_PROMPT) {
      setError(
        `Prompt sau khi điền quá dài (${prompt.length.toLocaleString("vi-VN")} ký tự, tối đa ${MAX_FILLED_PROMPT.toLocaleString("vi-VN")}).`
      );
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setSecs(0);
    setError(null);
    setNote(null);

    try {
      let pick = pickKey(keys, keyCursor.current);
      keyCursor.current += 1;
      let out = await callRun(pick, prompt, ctrl.signal);
      // Dính 429 và còn key khác → thử lại ngay 1 lần bằng key kế (§3.4).
      if (keys.length >= 2 && isRateLimited(out.error)) {
        pick = nextKey(keys, pick.index);
        out = await callRun(pick, prompt, ctrl.signal);
      }

      if (out.output === null) {
        const label = keys.length >= 2 ? `${apiKeyLabel(pick.key, pick.index)}: ` : "";
        const hint = errorHint(errorCode(out.error ?? null));
        setError(`${label}${out.error ?? "LLM không trả kết quả"}${hint ? ` — ${hint}` : ""}`);
      } else {
        patch({ result: out.output });
        setTab("result");
      }
    } catch (e) {
      // Huỷ → về đúng trạng thái điền, không banner đỏ (§3.4).
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  const saveDefaults = async () => {
    if (!current) return;
    if (editMode && draft.template.trim().length === 0) {
      setNote("Template đang trống — gõ nội dung mẫu rồi mới lưu được.");
      return;
    }
    try {
      const fields = pruneFields(draft.values, parsed.names);
      const updated = await updateWriterPrompt(current.id, {
        fields,
        // Template và temperature chỉ đi kèm khi đang ở chế độ Sửa mẫu (§3.6).
        ...(editMode && draft.template !== current.template ? { template: draft.template } : {}),
        ...(editMode && draft.temperature !== current.temperature
          ? { temperature: draft.temperature }
          : {}),
      });
      setDraft((d) => ({ ...d, values: { ...fields } }));
      setNote(`Đã lưu mẫu «${updated.name}».`);
    } catch (e) {
      if (handleGone(e, current.id)) return;
      setNote(`Lưu mẫu thất bại: ${(e as Error).message}`);
    }
  };

  const saveAsNew = () => {
    // Mẫu là template chứ không phải cái tên: chưa gõ gì mà hỏi tên trước thì
    // người dùng đặt tên xong mới ăn 400 "Thiếu template" — chỉ đường luôn cho nhanh.
    if (draft.template.trim().length === 0) {
      setEditMode(true);
      setTab("fill");
      setNote("Chưa có nội dung mẫu — gõ template ở ô Template rồi lưu thành mẫu mới.");
      return;
    }
    askName({
      title: "Lưu thành mẫu mới",
      ok: "Tạo mẫu",
      defaultValue: copyName(current?.name ?? null),
      submit: async (name) => {
        const created = await createWriterPrompt({
          name,
          template: draft.template,
          fields: pruneFields(draft.values, parsed.names),
          temperature: draft.temperature,
        });
        patch({ promptId: created.id });
        setNote(`Đã tạo mẫu «${created.name}».`);
      },
    });
  };

  const rename = () => {
    if (!current) return;
    askName({
      title: "Đổi tên mẫu",
      ok: "Đổi tên",
      defaultValue: current.name,
      submit: async (name) => {
        try {
          const updated = await updateWriterPrompt(current.id, { name });
          setNote(`Đã đổi tên thành «${updated.name}».`);
        } catch (e) {
          if (handleGone(e, current.id)) return;
          throw e;
        }
      },
    });
  };

  const remove = async () => {
    if (!current) return;
    const okToDelete = await ask({
      title: `Xoá mẫu «${current.name}»?`,
      body: "Template và giá trị đang điền vẫn giữ nguyên, chỉ mất bản lưu trên DB.",
      ok: "Xoá mẫu",
    });
    if (!okToDelete) return;
    try {
      await deleteWriterPrompt(current.id);
    } catch (e) {
      if (!handleGone(e, current.id)) {
        setNote(`Xoá mẫu thất bại: ${(e as Error).message}`);
        return;
      }
    }
    patch({ promptId: null });
    setNote("Đã xoá mẫu. Nội dung đang điền giữ nguyên.");
  };

  const replace = async () => {
    if (!draft.result) return;
    if (text.trim().length > 0) {
      const okToReplace = await ask({
        title: "Thay toàn bộ văn bản hiện tại?",
        body: "Nội dung đang có trong ô văn bản sẽ bị thay bằng kết quả này.",
        ok: "Thay thế",
      });
      if (!okToReplace) return;
    }
    onReplace(draft.result);
    onClose();
  };

  const append = () => {
    if (!draft.result) return;
    onAppend(appendBlock(text, draft.result));
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const locked = running;

  return (
    <>
      <div
        className="sheet-wrap sheet-wrap-center"
        style={{ background: "color-mix(in srgb, #16310d 40%, transparent)" }}
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()} className="sheet sheet-writer bg-white">
          <span className="sheet-grab" />

          {/* Hàng mẫu */}
          <div className="flex flex-none flex-wrap items-center gap-2 px-4 pb-2 pt-3 lg:px-[22px] lg:pt-[18px]">
            <h4 className="m-0 mr-1">Assistant Writer</h4>
            <select
              value={draft.promptId ?? ""}
              disabled={locked || loading || Boolean(listError)}
              onChange={(e) => select(e.target.value)}
              aria-label="Mẫu prompt"
              title="Mẫu prompt đang dùng"
              className="input h-9 min-w-0 flex-1 lg:h-8 lg:min-h-0"
            >
              <option value="">— Chọn mẫu —</option>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {modified && (
              <span title="Đang khác mẫu đã lưu" className="shrink-0 text-[11.5px] text-warn-fg">
                ● đã sửa
              </span>
            )}

            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={editMode}
                disabled={locked}
                onChange={(e) => setEditMode(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              Sửa mẫu
            </label>
            <Menu
              items={[
                { label: "Lưu thành mẫu mới…", onClick: saveAsNew },
                ...(current
                  ? [
                      { label: "Đổi tên…", onClick: rename },
                      { label: "Xoá mẫu…", onClick: () => void remove(), danger: true },
                    ]
                  : []),
                { label: "Tải lại danh sách", onClick: () => void loadWriterPrompts(true) },
              ]}
            />
            <button
              onClick={onClose}
              title="Đóng"
              className="shrink-0 px-1 text-[15px] text-sand-600 hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* Tab Kết quả chỉ xuất hiện khi đã có kết quả — chưa chạy thì đừng chiếm chỗ.
              Giữ tab lại khi đang đứng ở đó dù ô bị xoá trắng, kẻo tab biến mất giữa lúc gõ. */}
          <div className="flex flex-none items-center gap-1 px-4 pb-2 lg:px-[22px]">
            <TabButton on={tab === "fill"} onClick={() => setTab("fill")}>
              Điền
            </TabButton>
            {(draft.result.length > 0 || tab === "result") && (
              <TabButton on={tab === "result"} onClick={() => setTab("result")}>
                Kết quả
              </TabButton>
            )}
          </div>

          {/* Cuộn trong lòng dialog; thanh nút dính đáy. */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 lg:px-[22px]">
            {keys.length === 0 && (
              <Banner tone="danger">
                Chưa có API key — mở Settings trên thanh trên cùng để nhập.
              </Banner>
            )}
            {listError && (
              <Banner tone="warn">
                Không tải được danh sách mẫu ({listError}).{" "}
                <button
                  onClick={() => void loadWriterPrompts(true)}
                  className="text-accent hover:underline"
                >
                  Thử lại
                </button>
                . Template đang gõ vẫn chạy được.
              </Banner>
            )}
            {error && <Banner tone="danger">{error}</Banner>}
            {note && <p className="m-0 text-[11.5px] leading-snug text-sand-600">{note}</p>}

            {tab === "fill" && editMode && (
              <Section title="Template">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-sand-600">
                  <span>
                    Dùng <code className="font-mono">{"{{ten_o}}"}</code> để sinh ô nhập,{" "}
                    <code className="font-mono">{"{{text}}"}</code> để chèn văn bản đang có.
                  </span>
                  <span className="flex-1" />
                  <label className="flex items-center gap-1.5">
                    Temperature
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={draft.temperature ?? ""}
                      disabled={locked}
                      placeholder={String(settings.temperature)}
                      onChange={(e) =>
                        patch({
                          temperature: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      title="Bỏ trống = dùng temperature trong Settings"
                      className="input h-8 w-[84px] px-2 py-0 text-xs lg:min-h-0"
                    />
                  </label>
                </div>
                <textarea
                  value={draft.template}
                  disabled={locked}
                  spellCheck={false}
                  onChange={(e) => patch({ template: e.target.value.slice(0, MAX_WRITER_TEMPLATE) })}
                  rows={6}
                  placeholder="Ví dụ: Dựa vào văn bản sau:&#10;&#10;{{text}}&#10;&#10;Hãy {{yeu_cau}}."
                  className="textarea w-full resize-y font-mono text-[12.5px]"
                />
              </Section>
            )}

            {tab === "fill" && (
              <div className="flex flex-col gap-3">
                {parsed.names.length === 0 && (
                  <p className="m-0 text-[12px] text-sand-600">
                    Mẫu này không có ô nhập nào — bấm Chạy là xong.
                  </p>
                )}
                {parsed.names.map((name) => {
                  const value = draft.values[name] ?? "";
                  return (
                    <label key={name} className="flex flex-col gap-1">
                      <span className="text-[12.5px] text-sand-700">{fieldLabel(name)}</span>
                      <textarea
                        value={value}
                        disabled={locked}
                        spellCheck={false}
                        onChange={(e) =>
                          patch({
                            values: {
                              ...draft.values,
                              [name]: e.target.value.slice(0, MAX_FIELD_VALUE),
                            },
                          })
                        }
                        rows={Math.min(8, Math.max(2, value.split("\n").length))}
                        className={`textarea w-full resize-y text-[13px] ${
                          value.trim().length === 0 ? "border-warn-fg" : ""
                        }`}
                      />
                    </label>
                  );
                })}

                {parsed.hasText &&
                  (text.length > 0 ? (
                    <p className="m-0 text-[12px] text-sand-600">
                      ⓘ <code className="font-mono">{"{{text}}"}</code> = văn bản đang có (
                      {text.length.toLocaleString("vi-VN")} ký tự)
                    </p>
                  ) : (
                    <p className="m-0 text-[12px] text-warn-fg">
                      <code className="font-mono">{"{{text}}"}</code> đang rỗng — chạy vẫn được, chỗ
                      đó sẽ thành chuỗi rỗng.
                    </p>
                  ))}
              </div>
            )}

            {tab === "result" && (
              <textarea
                value={draft.result}
                disabled={locked}
                autoFocus
                spellCheck={false}
                onChange={(e) => patch({ result: e.target.value })}
                className="textarea min-h-[240px] w-full flex-1 resize-none text-[13px]"
              />
            )}
          </div>

          {/* Mỗi tab một bộ nút của riêng nó: tab Điền lo chạy và lưu mẫu, tab Kết quả lo dán đi. */}
          <div className="flex flex-none flex-wrap items-center gap-2 border-t border-divider px-4 py-3 lg:px-[22px]">
            {tab === "fill" ? (
              <>
                <button
                  onClick={() => void run()}
                  disabled={running}
                  className="btn btn-primary h-9 py-0"
                >
                  {running && <Spinner />}
                  {running ? `Đang chạy… ${secs}s` : "Chạy ▷"}
                </button>
                <button onClick={cancel} disabled={!running} className="btn btn-secondary h-9 py-0">
                  Huỷ
                </button>
                <button
                  onClick={() => void saveDefaults()}
                  disabled={locked || !current || !modified}
                  title="Ghi giá trị đang điền thành mặc định của mẫu"
                  className="btn btn-secondary h-9 py-0"
                >
                  Lưu giá trị làm mặc định
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => void replace()}
                  disabled={!draft.result}
                  className="btn btn-primary h-9 py-0"
                >
                  Thay thế
                </button>
                <button
                  onClick={append}
                  disabled={!draft.result}
                  className="btn btn-secondary h-9 py-0"
                >
                  Chèn cuối
                </button>
                <button
                  onClick={() => void copy()}
                  disabled={!draft.result}
                  className="btn btn-secondary h-9 py-0"
                >
                  {copied ? "Đã copy" : "Copy"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDialog}
      {nameDialog}
    </>
  );
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-3.5 py-1.5 text-[12.5px] ${
        on ? "bg-accent text-white" : "bg-sand-100 text-sand-700 hover:bg-accent-100"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] uppercase tracking-wide text-sand-500">{title}</span>
        <span className="h-px flex-1 bg-divider" />
      </div>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "danger" | "warn"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-[18px] px-3.5 py-2.5 text-[12.5px] ${
        tone === "danger" ? "bg-danger-soft text-danger-ink" : "bg-warn-bg text-warn-fg"
      }`}
    >
      {children}
    </div>
  );
}
