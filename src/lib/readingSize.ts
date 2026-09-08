"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "tranzlator.readingSize";
export const MIN_READING = 12;
export const MAX_READING = 24;
export const DEFAULT_READING = 15;

/** Cỡ chữ khung đọc — dùng chung cho tab Translate và Summary nên phải là store, không phải state riêng. */
let size = DEFAULT_READING;
const listeners = new Set<() => void>();
let started = false;

function clamp(n: number) {
  return Math.min(MAX_READING, Math.max(MIN_READING, Math.round(n)));
}

function emit() {
  for (const l of listeners) l();
}

function hydrate() {
  if (started) return;
  started = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) size = clamp(Number(raw) || DEFAULT_READING);
  } catch {
    // localStorage bị chặn → dùng mặc định
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useReadingSize() {
  const value = useSyncExternalStore(
    subscribe,
    () => size,
    () => DEFAULT_READING
  );

  useEffect(() => {
    hydrate();
  }, []);

  const set = useCallback((next: number) => {
    size = clamp(next);
    try {
      localStorage.setItem(KEY, String(size));
    } catch {
      // giữ trong memory
    }
    emit();
  }, []);

  return { size: value, set };
}
