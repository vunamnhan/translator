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
        title="Đổi tên job"
        className="group flex items-center gap-1.5 rounded-xl px-2 py-0.5 font-heading text-[19px] hover:bg-accent-100"
      >
        {name}
        <span className="text-xs text-sand-400 opacity-0 transition-opacity group-hover:opacity-100">
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
        className="input h-9 w-[230px] border-accent"
      />
      <span className="text-[11.5px] text-sand-600">
        {saving ? "đang lưu…" : "Enter lưu · Esc huỷ"}
      </span>
    </form>
  );
}
