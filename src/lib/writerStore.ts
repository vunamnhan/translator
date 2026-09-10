"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_DRAFT,
  normalizeFields,
  normalizeTemperature,
  type WriterDraft,
  type WriterPromptDTO,
} from "./writerPrompts";

/**
 * Assistant Writer (CR v0.6). Hai thứ nằm chung một chỗ vì cùng phục vụ một popup:
 * danh sách mẫu trên DB (store dùng chung, y như `presetStore` của v0.3) và
 * working copy trong sessionStorage (đóng / mở popup trong cùng phiên không mất chữ).
 */
export interface WriterState {
  items: WriterPromptDTO[];
  loaded: boolean;
  loading: boolean;
  /** Lỗi mạng lúc nạp danh sách. Template đang gõ vẫn chạy bình thường. */
  error: string | null;
}

let state: WriterState = { items: [], loaded: false, loading: false, error: null };
const listeners = new Set<() => void>();

function setState(next: WriterState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const SERVER_STATE: WriterState = { items: [], loaded: false, loading: false, error: null };

export function useWriterState(): WriterState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}

/** Lỗi có kèm status để chỗ gọi phân biệt 409 (trùng tên) với 404 (mẫu đã bị xoá). */
export class WriterError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new WriterError(data?.error ?? `HTTP ${res.status}`, res.status);
  }
  return res;
}

function upsert(prompt: WriterPromptDTO) {
  const items = state.items.filter((p) => p.id !== prompt.id).concat(prompt);
  items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  setState({ ...state, items, loaded: true });
}

export async function loadWriterPrompts(force = false) {
  if (state.loading || (state.loaded && !force)) return;
  setState({ ...state, loading: true, error: null });
  try {
    const res = await send("/api/writer-prompts", {});
    const items = ((await res.json()) as WriterPromptDTO[]).map((p) => ({
      ...p,
      fields: normalizeFields(p.fields),
    }));
    setState({ items, loaded: true, loading: false, error: null });
  } catch (e) {
    setState({ ...state, loading: false, error: (e as Error).message });
  }
}

export interface WriterPromptInputDTO {
  name: string;
  template: string;
  fields: Record<string, string>;
  temperature: number | null;
}

export async function createWriterPrompt(
  input: WriterPromptInputDTO
): Promise<WriterPromptDTO> {
  const res = await send("/api/writer-prompts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const prompt = (await res.json()) as WriterPromptDTO;
  prompt.fields = normalizeFields(prompt.fields);
  upsert(prompt);
  return prompt;
}

export async function updateWriterPrompt(
  id: string,
  patch: Partial<WriterPromptInputDTO>
): Promise<WriterPromptDTO> {
  const res = await send(`/api/writer-prompts/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const prompt = (await res.json()) as WriterPromptDTO;
  prompt.fields = normalizeFields(prompt.fields);
  upsert(prompt);
  return prompt;
}

export async function deleteWriterPrompt(id: string): Promise<void> {
  await send(`/api/writer-prompts/${id}`, { method: "DELETE" });
  forgetWriterPrompt(id);
}

/** Bỏ khỏi danh sách khi DB báo không còn (404) — không cần nạp lại cả list. */
export function forgetWriterPrompt(id: string) {
  setState({ ...state, items: state.items.filter((p) => p.id !== id) });
}

/* ── Working copy ───────────────────────────────────────────────────────────
 * sessionStorage chứ không localStorage: đóng / mở popup hay chuyển tab trong
 * cùng phiên thì còn nguyên, đóng trình duyệt là mất — cố ý (§3.6).
 */
export const WRITER_DRAFT_KEY = "tranzlator.writer";

export function readWriterDraft(): WriterDraft {
  try {
    const raw = sessionStorage.getItem(WRITER_DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const d = JSON.parse(raw) as Partial<WriterDraft>;
    return {
      promptId: typeof d.promptId === "string" ? d.promptId : null,
      template: typeof d.template === "string" ? d.template : "",
      values: normalizeFields(d.values),
      temperature: normalizeTemperature(d.temperature),
      result: typeof d.result === "string" ? d.result : "",
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeWriterDraft(draft: WriterDraft) {
  try {
    sessionStorage.setItem(WRITER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage bị chặn / đầy → working copy chỉ sống trong memory
  }
}
