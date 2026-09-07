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
