"use client";

import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** Menu ⋯ dùng chung: đóng khi bấm ra ngoài hoặc Esc. */
export default function Menu({
  items,
  label = "⋯",
  /** Nút nằm trong thanh dính đáy ở mobile → menu phải bung lên, không thì rơi khỏi màn. */
  dropUp = false,
}: {
  items: MenuItem[];
  label?: string;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Hành động"
        className="h-8 w-8 rounded-pill text-sand-600 hover:bg-accent-100 hover:text-ink"
      >
        {label}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-20 min-w-[184px] animate-tz-pop overflow-hidden rounded-[18px] border border-divider bg-white py-1 shadow-lg ${
            dropUp ? "bottom-12 lg:bottom-auto lg:top-9" : "top-9"
          }`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`block w-full px-4 py-2 text-left text-[13px] hover:bg-accent-100 ${
                it.danger ? "text-danger-700" : "text-ink"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
