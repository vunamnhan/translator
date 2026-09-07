"use client";

import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from "./defaults";

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
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
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
  state = { settings, loaded: true };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage bị chặn → giữ trong memory
  }
  emit();
}
