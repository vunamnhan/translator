"use client";

import type { ChunkFlag } from "@/lib/chunker";
import { BAR_HEAD, barShell } from "./bar";

/**
 * Thẻ chunk ở màn hình tạo job (CR v0.4 §6.2). Cùng bộ "bar" với Translate và
 * Summary, chỉ khác: chưa có status vì chunk chưa tồn tại trên DB — thay vào đó
 * là ước lượng token và chip cảnh báo cỡ (§2.4).
 */

const FLAG_STYLE: Record<ChunkFlag, string> = {
  empty: "bg-sand-200 text-sand-600 italic",
  short: "bg-sand-100 text-sand-600",
  large: "bg-warn-bg text-warn-fg",
  huge: "bg-danger-bg text-danger-fg",
  "code-split": "bg-danger-bg text-danger-fg",
};

export const FLAG_LABEL: Record<ChunkFlag, string> = {
  empty: "rỗng",
  short: "ngắn",
  large: "lớn",
  huge: "quá lớn",
  "code-split": "code cắt đôi",
};

export function FlagChip({ flag }: { flag: ChunkFlag }) {
  return (
    <span className={`tag whitespace-nowrap ${FLAG_STYLE[flag]}`}>{FLAG_LABEL[flag]}</span>
  );
}

/** Hai dòng có chữ đầu tiên — đủ để nhận ra chunk mà không phải mở ra. */
function peek(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 2);
  return lines.join(" ⏎ ").slice(0, 160);
}

function shortTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function DraftChunkBar({
  idx,
  text,
  tokens,
  flags,
  frontMatter,
  selected,
  onSelect,
}: {
  idx: number;
  text: string;
  tokens: number;
  flags: ChunkFlag[];
  frontMatter: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const empty = flags.includes("empty");

  return (
    <div className={barShell(selected)}>
      <button onClick={onSelect} className={BAR_HEAD}>
        <span className="min-w-[26px] font-mono text-xs text-sand-600">#{idx}</span>
        <span className="whitespace-nowrap font-mono text-[11px] text-sand-600">
          {shortTokens(tokens)} tok
        </span>
        {frontMatter && <span className="tag bg-warn-bg text-warn-fg">front matter</span>}
        {flags.map((f) => (
          <FlagChip key={f} flag={f} />
        ))}
        <span
          className={`min-w-0 flex-1 truncate text-[12.5px] ${
            empty ? "italic text-sand-500" : "text-sand-700"
          }`}
        >
          {empty ? "(rỗng)" : peek(text)}
        </span>
      </button>
    </div>
  );
}
