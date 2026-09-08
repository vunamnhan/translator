import { UNTRANSLATED_MARKER } from "./defaults";

export interface AssemblePiece {
  idx: number;
  status: string;
  source: string;
  translated: string | null;
}

/** Ghép bản dịch theo idx. Chunk chưa xong dùng source gốc + marker. */
export function assembleMarkdown(chunks: AssemblePiece[]): string {
  return [...chunks]
    .sort((a, b) => a.idx - b.idx)
    .map((c) => {
      if (c.status === "skipped") return c.source;
      if (c.status === "done" && c.translated !== null) return c.translated;
      return `${UNTRANSLATED_MARKER}\n${c.source}`;
    })
    .join("");
}

export interface SummaryPiece {
  idx: number;
  heading: string;
  summary: string | null;
}

/** Export tóm tắt: ngữ cảnh chung ở đầu, rồi `## heading` + summary từng section theo idx. */
export function assembleSummary(context: string | null, sections: SummaryPiece[]): string {
  const parts: string[] = [];
  if (context && context.trim()) parts.push(context.trim());

  for (const s of [...sections].sort((a, b) => a.idx - b.idx)) {
    const body = s.summary?.trim() ? s.summary.trim() : "_(chưa tóm tắt)_";
    parts.push(`## ${s.heading}\n\n${body}`);
  }

  return parts.join("\n\n") + (parts.length > 0 ? "\n" : "");
}
