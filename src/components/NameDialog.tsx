"use client";

import { useCallback, useState } from "react";

interface Options {
  title: string;
  /** Nhãn nút xác nhận, ví dụ "Tạo preset". */
  ok: string;
  defaultValue: string;
  /** Ném lỗi (409 trùng tên…) thì dialog ở lại và hiện câu lỗi dưới ô. */
  submit: (value: string) => Promise<void>;
}

/**
 * Dialog một ô text, dùng để hỏi tên preset. Khác `useConfirm` ở chỗ **không đóng
 * khi submit lỗi** — 409 trùng tên phải hiện ngay dưới ô để sửa lại, không bắt
 * người dùng mở lại dialog và gõ lại từ đầu.
 */
export function useNameDialog() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const askName = useCallback((o: Options) => {
    setOpts(o);
    setValue(o.defaultValue);
    setError(null);
    setBusy(false);
  }, []);

  const close = () => {
    setOpts(null);
    setError(null);
    setBusy(false);
  };

  const confirm = async () => {
    if (!opts || busy) return;
    const name = value.trim();
    if (!name) {
      setError("Tên không được để trống");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await opts.submit(name);
      close();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const dialog = opts ? (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-5"
      style={{ background: "color-mix(in srgb, #16310d 50%, transparent)" }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] animate-tz-pop flex-col gap-3 rounded-[32px] bg-white p-6 shadow-lg"
      >
        <h4 className="m-0">{opts.title}</h4>
        <input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Esc/Enter phải dừng ở đây, không thì rơi xuống handler của drawer.
            e.stopPropagation();
            if (e.key === "Enter") void confirm();
            if (e.key === "Escape") close();
          }}
          maxLength={60}
          className="input"
        />
        {error && <p className="m-0 text-xs text-danger-700">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={close}>
            Huỷ
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
            {opts.ok}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { askName, dialog };
}
