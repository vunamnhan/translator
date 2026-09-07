import { topLevelBlocks, type BlockRef } from "./md";

export interface ChunkPiece {
  /** Slice nguyên bytes của source gốc. */
  source: string;
  /** Front matter → không dịch. */
  skip: boolean;
}

/** Ước lượng token thô: chars / 4. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const NEVER_SPLIT = new Set(["code", "table", "yaml", "toml"]);
const OWN_CHUNK = new Set(["yaml", "toml"]);

/**
 * Cắt markdown thành chunk theo block cấp 1.
 * Invariant: chunks.map(c => c.source).join("") === source
 */
export function chunkMarkdown(source: string, chunkTokens: number): ChunkPiece[] {
  if (source.length === 0) return [];
  const limit = Math.max(1, chunkTokens) * 4; // ngưỡng theo ký tự
  const blocks = topLevelBlocks(source);
  if (blocks.length === 0) return [{ source, skip: false }];

  // Mỗi phần tử: offset bắt đầu chunk + có phải front matter không.
  const starts: { offset: number; skip: boolean }[] = [];
  let curStart: number | null = null;
  let curSkip = false;

  const open = (offset: number, skip: boolean) => {
    starts.push({ offset, skip });
    curStart = offset;
    curSkip = skip;
  };
  const close = () => {
    curStart = null;
    curSkip = false;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const size = b.end - b.start;
    const isOwn = OWN_CHUNK.has(b.type);

    if (curStart === null) {
      open(b.start, isOwn);
    } else {
      const curChars = b.start - curStart;
      const shouldClose =
        isOwn ||
        curSkip ||
        (b.type === "heading" && curChars >= limit * 0.5) ||
        curChars + size > limit;
      if (shouldClose) open(b.start, isOwn);
    }

    // Block đơn lẻ vượt ngưỡng: cắt tiếp theo câu (trừ code / table / front matter).
    const alone = starts[starts.length - 1].offset === b.start;
    if (alone && size > limit && !NEVER_SPLIT.has(b.type)) {
      for (const cut of splitLongBlock(source, b, limit)) {
        starts.push({ offset: cut, skip: false });
      }
      close();
      continue;
    }

    if (isOwn) close();
  }

  // Chuẩn hoá: chunk đầu bắt đầu ở 0, chunk sau nối liền chunk trước, chunk cuối tới hết file.
  starts[0].offset = 0;
  return starts.map((s, i) => ({
    source: source.slice(s.offset, i + 1 < starts.length ? starts[i + 1].offset : source.length),
    skip: s.skip,
  }));
}

/** Cắt 1 block quá dài theo ranh giới câu (". ") hoặc xuống dòng. Trả về các offset cắt thêm. */
function splitLongBlock(source: string, block: BlockRef, limit: number): number[] {
  const candidates: number[] = [];
  for (let i = block.start; i < block.end; i++) {
    const ch = source[i];
    if (ch === "\n") {
      candidates.push(i + 1);
    } else if (ch === "." && (source[i + 1] === " " || source[i + 1] === "\n")) {
      candidates.push(i + 2);
    }
  }

  const cuts: number[] = [];
  let last = block.start;
  let best = -1;
  for (const cand of candidates) {
    if (cand <= last || cand >= block.end) continue;
    if (cand - last <= limit) {
      best = cand;
      continue;
    }
    const cut = best > last ? best : cand;
    cuts.push(cut);
    last = cut;
    best = cand - last <= limit ? cand : -1;
    if (best === -1 && cand > last) {
      cuts.push(cand);
      last = cand;
    }
  }
  return cuts;
}
