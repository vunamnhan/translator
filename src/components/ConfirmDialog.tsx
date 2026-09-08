"use client";

import { useCallback, useRef, useState } from "react";

export interface ConfirmOptions {
  title: string;
  body: string;
  /** Nhãn nút xác nhận, ví dụ "Xoá job". */
  ok: string;
}

/**
 * Dialog xác nhận theo design, thay cho `confirm()` của trình duyệt.
 * Trả về `ask()` dạng Promise nên call site giữ nguyên dòng chảy async.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOpts(null);
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }, []);

  const dialog = opts ? (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-5"
      style={{ background: "color-mix(in srgb, #16310d 50%, transparent)" }}
      onClick={() => settle(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] animate-tz-pop flex-col gap-3 rounded-[32px] bg-white p-6 shadow-lg"
      >
        <h4 className="m-0">{opts.title}</h4>
        <p className="m-0 text-sm opacity-85">{opts.body}</p>
        <p className="m-0 text-xs text-danger-700">Hành động này không hoàn tác được.</p>
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={() => settle(false)}>
            Huỷ
          </button>
          <button className="btn btn-danger" onClick={() => settle(true)}>
            {opts.ok}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}
