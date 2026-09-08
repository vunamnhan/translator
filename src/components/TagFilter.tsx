"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TagCount } from "@/lib/types";

interface Props {
  tags: TagCount[];
  /** Tag đang chọn, so trùng không phân biệt hoa thường. */
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Dropdown đa chọn tag, có ô lọc nhanh bên trong (mục 5.1 CR v0.2). */
export default function TagFilter({ tags, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
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

  const picked = useMemo(() => new Set(selected.map((t) => t.toLowerCase())), [selected]);

  const shown = useMemo(() => {
    const q = needle.trim().toLowerCase();
    return q ? tags.filter((t) => t.tag.toLowerCase().includes(q)) : tags;
  }, [tags, needle]);

  function toggle(tag: string) {
    const key = tag.toLowerCase();
    onChange(
      picked.has(key) ? selected.filter((t) => t.toLowerCase() !== key) : [...selected, tag]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn h-9 py-0 ${selected.length > 0 ? "btn-primary" : "btn-secondary"}`}
      >
        Tag{selected.length > 0 && ` (${selected.length})`} ▾
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-20 w-[260px] animate-tz-pop overflow-hidden rounded-[20px] border border-divider bg-white shadow-lg">
          <div className="p-2">
            <input
              value={needle}
              autoFocus
              onChange={(e) => setNeedle(e.target.value)}
              placeholder="Lọc tag…"
              className="input h-8 min-h-0 bg-paper text-[12.5px]"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto pb-2">
            {shown.length === 0 && (
              <p className="m-0 px-4 py-3 text-center text-[12.5px] text-sand-600">
                {tags.length === 0 ? "Chưa có tag nào." : "Không có tag nào khớp."}
              </p>
            )}
            {shown.map((t) => (
              <button
                key={t.tag}
                onClick={() => toggle(t.tag)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[13px] hover:bg-accent-100"
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-md border text-[10px] ${
                    picked.has(t.tag.toLowerCase())
                      ? "border-accent bg-accent text-white"
                      : "border-divider"
                  }`}
                >
                  {picked.has(t.tag.toLowerCase()) ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.tag}</span>
                <span className="font-mono text-[11px] text-sand-600">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
