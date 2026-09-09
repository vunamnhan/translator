"use client";

import { useSyncExternalStore } from "react";
import type { PresetDTO } from "./presets";

/**
 * Danh sách preset (CR v0.3). Store dùng chung chứ không phải state của drawer:
 * chip preset ở top bar và tab Prompt cùng đọc một danh sách, nạp một lần.
 * Không cache lâu dài — preset nằm trên DB, trình duyệt khác sửa được.
 */
export interface PresetState {
  items: PresetDTO[];
  loaded: boolean;
  loading: boolean;
  /** Lỗi mạng lúc nạp danh sách. Các ô prompt vẫn dùng bình thường. */
  error: string | null;
}

let state: PresetState = { items: [], loaded: false, loading: false, error: null };
const listeners = new Set<() => void>();

function setState(next: PresetState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const SERVER_STATE: PresetState = { items: [], loaded: false, loading: false, error: null };

export function usePresetState(): PresetState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}

export function getPreset(id: string | null): PresetDTO | null {
  if (!id) return null;
  return state.items.find((p) => p.id === id) ?? null;
}

/** Lỗi có kèm status để chỗ gọi phân biệt 409 (trùng tên) với 404 (preset đã bị xoá). */
export class PresetError extends Error {
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
    throw new PresetError(data?.error ?? `HTTP ${res.status}`, res.status);
  }
  return res;
}

function upsert(preset: PresetDTO) {
  const items = state.items.filter((p) => p.id !== preset.id).concat(preset);
  items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  setState({ ...state, items, loaded: true });
}

export async function loadPresets(force = false) {
  if (state.loading || (state.loaded && !force)) return;
  setState({ ...state, loading: true, error: null });
  try {
    const res = await send("/api/presets", {});
    setState({ items: (await res.json()) as PresetDTO[], loaded: true, loading: false, error: null });
  } catch (e) {
    setState({ ...state, loading: false, error: (e as Error).message });
  }
}

export async function createPreset(input: {
  name: string;
  translatePrompt: string;
  summaryPrompt: string;
  contextPrompt: string;
  chunkSummaryPrompt: string;
}): Promise<PresetDTO> {
  const res = await send("/api/presets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const preset = (await res.json()) as PresetDTO;
  upsert(preset);
  return preset;
}

export async function updatePreset(
  id: string,
  patch: Partial<{
    name: string;
    translatePrompt: string;
    summaryPrompt: string;
    contextPrompt: string;
    chunkSummaryPrompt: string;
  }>
): Promise<PresetDTO> {
  const res = await send(`/api/presets/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const preset = (await res.json()) as PresetDTO;
  upsert(preset);
  return preset;
}

export async function deletePreset(id: string): Promise<void> {
  await send(`/api/presets/${id}`, { method: "DELETE" });
  forgetPreset(id);
}

/** Bỏ khỏi danh sách khi DB báo không còn (404) — không cần nạp lại cả list. */
export function forgetPreset(id: string) {
  setState({ ...state, items: state.items.filter((p) => p.id !== id) });
}
