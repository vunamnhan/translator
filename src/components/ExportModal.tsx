"use client";

import { useState } from "react";

interface Props {
  title: string;
  /** Nội dung hiển thị + copy. */
  text: string;
  /** Link tải file từ server. */
  href: string;
  filename: string;
  note?: string | null;
  onClose: () => void;
}

export default function ExportModal({ title, text, href, filename, note, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="sheet-wrap sheet-wrap-center"
      style={{ background: "color-mix(in srgb, #16310d 40%, transparent)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet bg-white"
      >
        <span className="sheet-grab" />
        <div className="flex flex-none flex-wrap items-center gap-3 px-4 py-3.5 lg:gap-3.5 lg:px-[22px] lg:py-[18px]">
          <h4 className="m-0">{title}</h4>
          {note && (
            <span className="rounded-pill bg-warn-bg px-3 py-1 text-xs text-warn-fg">{note}</span>
          )}
          <span className="min-w-[8px] flex-1" />
          <button onClick={copy} className="btn btn-secondary h-[34px] py-0">
            {copied ? "Đã copy" : "Copy"}
          </button>
          <a href={href} download={filename} className="btn btn-primary h-[34px] py-0">
            Download .md
          </a>
          <button onClick={onClose} className="px-2 text-[13px] text-sand-600 hover:underline">
            Đóng
          </button>
        </div>

        <pre className="m-0 mx-4 mb-4 min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[20px] border border-divider bg-paper px-3.5 py-3.5 font-mono text-xs leading-[1.7] text-sand-800 lg:mx-[22px] lg:mb-[22px] lg:px-[18px] lg:py-4">
          {text}
        </pre>

        <div className="flex-none px-4 pb-4 text-[11.5px] text-sand-600 lg:px-[22px]">
          Tên file: {filename}
        </div>
      </div>
    </div>
  );
}
