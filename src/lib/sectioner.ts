import { estimateTokens } from "./chunker";

export interface SectionPiece {
  idx: number;
  heading: string;
  chunkFrom: number;
  chunkTo: number;
}

export interface SectionInput {
  idx: number;
  status: string;
  source: string;
  sourceOverride?: string | null;
}

/** Nội dung thật của chunk: bản user sửa nếu có. */
export function chunkText(c: SectionInput): string {
  return c.sourceOverride ?? c.source;
}

/** Dòng có chữ đầu tiên là heading cấp 1/2 → mốc mở section mới. */
function startsWithTopHeading(text: string): boolean {
  const line = text.split("\n").find((l) => l.trim().length > 0);
  return line ? /^\s{0,3}#{1,2}\s+\S/.test(line) : false;
}

/** Heading đầu tiên (mọi cấp) trong dải, dùng làm tên section. */
function firstHeading(text: string): string | null {
  for (const line of text.split("\n")) {
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) return m[2].trim();
  }
  return null;
}

/**
 * Gom chunk dịch thành section để tóm tắt.
 * Không parse lại markdown — chỉ gom từ danh sách chunk có sẵn.
 * Chunk `skipped` (front matter) không vào section nào.
 */
export function buildSections(chunks: SectionInput[], summaryTokens: number): SectionPiece[] {
  const limit = Math.max(1, summaryTokens);
  const usable = [...chunks].sort((a, b) => a.idx - b.idx).filter((c) => c.status !== "skipped");
  if (usable.length === 0) return [];

  const groups: SectionInput[][] = [];
  let cur: SectionInput[] = [];
  let curTokens = 0;

  for (const c of usable) {
    const text = chunkText(c);
    const tokens = estimateTokens(text);
    // Heading cấp 1/2 mở section mới khi section hiện tại đã đủ "dày" (≥ 30% ngưỡng).
    const headingBreak = cur.length > 0 && startsWithTopHeading(text) && curTokens >= limit * 0.3;

    if (headingBreak) {
      groups.push(cur);
      cur = [];
      curTokens = 0;
    }

    cur.push(c);
    curTokens += tokens;

    // Vượt ngưỡng → đóng section (chunk vừa thêm vẫn nằm trong section này).
    if (curTokens > limit) {
      groups.push(cur);
      cur = [];
      curTokens = 0;
    }
  }
  if (cur.length > 0) groups.push(cur);

  return groups.map((g, i) => ({
    idx: i,
    heading: firstHeading(g.map(chunkText).join("")) ?? `(đoạn ${i + 1})`,
    chunkFrom: g[0].idx,
    chunkTo: g[g.length - 1].idx,
  }));
}

/**
 * Input gửi LLM để tạo ngữ cảnh chung.
 * Vừa ngưỡng → nguyên văn. Vượt → skeleton: heading + N ký tự đầu mỗi section.
 */
export function buildContextInput(
  chunks: SectionInput[],
  sections: SectionPiece[],
  contextMaxTokens: number
): { text: string; truncated: boolean } {
  const byIdx = new Map(chunks.map((c) => [c.idx, c]));
  const full = [...chunks].sort((a, b) => a.idx - b.idx).map(chunkText).join("");
  if (estimateTokens(full) <= contextMaxTokens) {
    return { text: full, truncated: false };
  }

  const budget = contextMaxTokens * 4;
  // Chưa gom section (job cũ / chưa resection): cắt thẳng phần đầu, đừng để vỡ context length.
  if (sections.length === 0) {
    return { text: `${full.slice(0, budget).trimEnd()}\n…`, truncated: true };
  }

  // Chia đều ngân sách ký tự cho các section, tối thiểu 300 ký tự/section.
  const perSection = Math.max(300, Math.floor(budget / sections.length));

  const parts = sections.map((s) => {
    let body = "";
    for (let i = s.chunkFrom; i <= s.chunkTo; i++) {
      const c = byIdx.get(i);
      if (!c || c.status === "skipped") continue;
      body += chunkText(c);
      if (body.length >= perSection) break;
    }
    const cut = body.slice(0, perSection).trimEnd();
    const ellipsis = body.length > perSection ? "\n…" : "";
    return `## ${s.heading}\n\n${cut}${ellipsis}`;
  });

  return { text: parts.join("\n\n"), truncated: true };
}
