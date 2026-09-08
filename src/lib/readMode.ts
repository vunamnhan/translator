"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Chế độ đọc của khổ mobile: giấu hết chrome quanh khung đọc và khoá tương tác
 * trong bài. Nút bật nằm ở top bar (`AppHeader`) còn thứ bị giấu nằm ở `JobView`,
 * nên phải là store chứ không phải state của một component.
 *
 * Cố ý KHÔNG lưu localStorage: mở app lên mà thấy trống trơn thì tưởng hỏng.
 */
let on = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useReadMode() {
  const value = useSyncExternalStore(
    subscribe,
    () => on,
    () => false
  );

  const set = useCallback((next: boolean) => {
    on = next;
    emit();
  }, []);

  const toggle = useCallback(() => {
    on = !on;
    emit();
  }, []);

  return { readMode: value, set, toggle };
}
