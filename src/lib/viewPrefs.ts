"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "tranzlator.viewPrefs";

/**
 * Ba công tắc bố cục của màn job, chỉ có nghĩa từ 1024px trở lên. Nút bật nằm ở
 * top bar (`AppHeader`) còn thứ bị giấu nằm trong `JobView`, nên phải là store.
 *
 * Khác `readMode`: cái này CÓ lưu localStorage. Nút ở top bar luôn hiện và sáng
 * theo trạng thái, nên mở app lên thấy thiếu thanh nào cũng biết ngay tại sao.
 */
export interface ViewPrefs {
  /** Thanh công cụ màn job: tên, tag, tab, số liệu, cụm nút. */
  toolbar: boolean;
  /** Bấm đoạn trong khung đọc thì chọn, cuộn tới và mở thẻ tương ứng bên trái. */
  snap: boolean;
  /** Cột danh sách thẻ bên trái (cả tab Translate lẫn Summary). */
  sidebar: boolean;
}

export const DEFAULT_VIEW_PREFS: ViewPrefs = { toolbar: true, snap: true, sidebar: true };

let prefs: ViewPrefs = DEFAULT_VIEW_PREFS;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const l of listeners) l();
}

function hydrate() {
  if (started) return;
  started = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
      prefs = {
        toolbar: parsed.toolbar !== false,
        snap: parsed.snap !== false,
        sidebar: parsed.sidebar !== false,
      };
    }
  } catch {
    // localStorage bị chặn hoặc JSON hỏng → dùng mặc định
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useViewPrefs() {
  const value = useSyncExternalStore(
    subscribe,
    () => prefs,
    () => DEFAULT_VIEW_PREFS
  );

  useEffect(() => {
    hydrate();
  }, []);

  const toggle = useCallback((key: keyof ViewPrefs) => {
    prefs = { ...prefs, [key]: !prefs[key] };
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // giữ trong memory
    }
    emit();
  }, []);

  return { prefs: value, toggle };
}
