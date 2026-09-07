"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  onRename: (name: string) => Promise<void>;
}

/** Bấm vào tên job để sửa tại chỗ. Enter lưu, Esc huỷ. */
export default function JobTitle({ name, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(next);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Bấm để đổi tên"
        className="group flex items-center gap-1.5 rounded px-1 font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        {name}
        <span className="text-xs text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
          ✎
        </span>
      </button>
    );
  }

  // Dùng form để Enter submit theo hành vi mặc định của trình duyệt.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        value={draft}
        autoFocus
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="w-64 rounded border border-blue-500 px-1.5 py-0.5 font-semibold outline-none"
      />
      <span className="text-xs text-neutral-500">{saving ? "đang lưu…" : "Enter lưu · Esc huỷ"}</span>
    </form>
  );
}
