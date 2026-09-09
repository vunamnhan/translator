"use client";

import {
  clampHeadingLevel,
  DEFAULT_SETTINGS,
  normalizeApiKeys,
  normalizeChunkRule,
  normalizeMarker,
  SETTINGS_KEY,
  type Settings,
} from "./defaults";

export interface SettingsState {
  settings: Settings;
  loaded: boolean;
}

/** Store dùng chung cho mọi component — nhập key ở header thì trang job thấy ngay. */
let state: SettingsState = { settings: DEFAULT_SETTINGS, loaded: false };
const listeners = new Set<() => void>();
let started = false;

function readStorage(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings> & { apiKey?: string };
    const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed };
    // v0.1 lưu 1 key ở `apiKey`; v0.2 dùng mảng `apiKeys` — chuyển sang khi load lần đầu.
    merged.apiKeys = normalizeApiKeys(
      parsed.apiKeys ?? (parsed.apiKey ? [parsed.apiKey] : [])
    );
    // CR v0.4 — 3 khoá cắt chunk có thể là rác từ bản cũ / user sửa tay localStorage.
    merged.chunkRule = normalizeChunkRule(merged.chunkRule);
    merged.headingLevel = clampHeadingLevel(merged.headingLevel);
    merged.chunkMarker = normalizeMarker(merged.chunkMarker);
    // CR v0.5 — chuỗi không đứng một mình được: tóm tắt chunk tắt thì chuỗi cũng tắt.
    merged.chainPrevSummary = merged.chunkSummary && merged.chainPrevSummary;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function hydrate() {
  if (started) return;
  started = true;
  state = { settings: readStorage(), loaded: true };
  // Đồng bộ giữa các tab.
  window.addEventListener("storage", (e) => {
    if (e.key !== SETTINGS_KEY) return;
    state = { settings: readStorage(), loaded: true };
    emit();
  });
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSnapshot(): SettingsState {
  return state;
}

const SERVER_STATE: SettingsState = { settings: DEFAULT_SETTINGS, loaded: false };
export function getServerSnapshot(): SettingsState {
  return SERVER_STATE;
}

export function setSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  if (patch.apiKeys) settings.apiKeys = normalizeApiKeys(patch.apiKeys);
  settings.chainPrevSummary = settings.chunkSummary && settings.chainPrevSummary;
  state = { settings, loaded: true };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage bị chặn → giữ trong memory
  }
  emit();
}
