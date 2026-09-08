"use client";

import { useMemo, useRef, useState } from "react";
import { hasTag, MAX_TAGS_PER_JOB, normalizeTag } from "@/lib/tags";
import type { TagCount } from "@/lib/types";

interface Props {
  tags: string[];
  suggestions: TagCount[];
  onChange: (next: string[]) => void;
}

/** Chip tag + ô thêm tag trên màn hình job. Lưu ngay mỗi lần thay đổi (mục 5.2). */
export default function TagEditor({ tags, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.tag.toLowerCase().includes(q) && !hasTag(tags, s.tag))
      .slice(0, 6);
  }, [draft, suggestions, tags]);

  function add(raw: string) {
    const tag = normalizeTag(raw);
    setDraft("");
    if (!tag || hasTag(tags, tag) || tags.length >= MAX_TAGS_PER_JOB) return;
    onChange([...tags, tag]);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="tag bg-accent-100 text-accent-800">
          {t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            title={`Xoá tag ${t}`}
            className="ml-1.5 opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        // Blur trễ một nhịp để click vào gợi ý còn kịp ăn.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(matches.length === 1 ? matches[0].tag : draft);
          }
          if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        placeholder={tags.length === 0 ? "+ tag" : "+"}
        disabled={tags.length >= MAX_TAGS_PER_JOB}
        className="h-6 w-[92px] min-w-0 rounded-pill border border-divider bg-paper px-2.5 text-[11.5px] text-ink placeholder:text-sand-500 focus-visible:border-accent"
      />

      {focused && matches.length > 0 && (
        <div className="absolute left-0 top-8 z-20 w-[220px] animate-tz-pop overflow-hidden rounded-[16px] border border-divider bg-white py-1 shadow-lg">
          {matches.map((m) => (
            <button
              key={m.tag}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                add(m.tag);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-accent-100"
            >
              <span className="min-w-0 flex-1 truncate">{m.tag}</span>
              <span className="font-mono text-[11px] text-sand-600">{m.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
