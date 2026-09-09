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

/* ══════════════════════════════════════════════════════════════════════════
   CR v0.4 — cắt theo quy tắc do user chọn.
   Ba rule dưới đây đi THEO DÒNG, không qua remark: điểm cắt là ranh giới dòng
   nên chỉ cần offset + máy trạng thái fence / front matter. Không đếm token,
   không gộp, không tách thêm — chunk to hay nhỏ là do văn bản.
   ══════════════════════════════════════════════════════════════════════ */

export type ChunkRuleKind = "auto" | "heading" | "blank" | "marker";

export type ChunkRule =
  | { kind: "auto"; chunkTokens: number }
  | { kind: "heading"; maxLevel: number }
  | { kind: "blank" }
  | { kind: "marker"; marker: string };

interface Line {
  /** Offset đầu dòng. */
  start: number;
  /** Nội dung dòng, KHÔNG gồm `\n` / `\r\n` — chỉ để so khớp, cắt vẫn dùng offset. */
  text: string;
}

function splitLines(source: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "\n") continue;
    const end = i > start && source[i - 1] === "\r" ? i - 1 : i;
    out.push({ start, text: source.slice(start, end) });
    start = i + 1;
  }
  if (start < source.length) out.push({ start, text: source.slice(start) });
  return out;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING_RE = /^ {0,3}(#{1,6})(\s|$)/;
const FRONT_DELIMS = ["---", "+++"];

/** Số dòng của front matter ở đầu file (gồm cả 2 dòng dấu), 0 nếu không có. */
function frontMatterLines(lines: Line[]): number {
  if (lines.length === 0) return 0;
  const delim = lines[0].text;
  if (!FRONT_DELIMS.includes(delim)) return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].text === delim) return i + 1;
  }
  return 0;
}

/** Chunk 0 có phải front matter hợp lệ không — dùng chung cho UI và route tạo job. */
export function isFrontMatter(text: string): boolean {
  return frontMatterLines(splitLines(text)) > 0;
}

/** Trạng thái fence: mở bằng ``` / ~~~ thì mọi điểm cắt bên trong bị bỏ qua. */
class FenceState {
  private char: string | null = null;
  private len = 0;

  /** Trả về true nếu dòng này nằm trong (hoặc là mép của) một fence. */
  feed(text: string): boolean {
    const m = FENCE_RE.exec(text);
    if (this.char === null) {
      if (!m) return false;
      this.char = m[1][0];
      this.len = m[1].length;
      return true;
    }
    // Đóng fence: cùng loại ký tự, dài không kém lúc mở, sau đó không có chữ.
    if (m && m[1][0] === this.char && m[1].length >= this.len && m[2].trim() === "") {
      this.char = null;
      this.len = 0;
    }
    return true;
  }
}

/**
 * Cắt theo quy tắc. Invariant chung với `chunkMarkdown`:
 * chunks.map(c => c.source).join("") === source
 */
export function chunkByRule(source: string, rule: ChunkRule): ChunkPiece[] {
  if (rule.kind === "auto") return chunkMarkdown(source, rule.chunkTokens);
  if (source.length === 0) return [];

  const lines = splitLines(source);
  const fmCount = frontMatterLines(lines);
  const starts: { offset: number; skip: boolean }[] = [];

  if (fmCount > 0) {
    starts.push({ offset: 0, skip: true });
    if (fmCount < lines.length) starts.push({ offset: lines[fmCount].start, skip: false });
  } else {
    starts.push({ offset: 0, skip: false });
  }

  const fence = new FenceState();
  // Đã gặp chữ trong chunk đang mở chưa — để rule `blank` không đẻ ra chunk toàn dòng trống.
  let sawContent = false;
  let pendingBlank = false;

  const cut = (offset: number) => {
    if (offset <= starts[starts.length - 1].offset) return;
    starts.push({ offset, skip: false });
    sawContent = false;
  };

  for (let i = fmCount; i < lines.length; i++) {
    const line = lines[i];
    const inFence = fence.feed(line.text);
    const blank = line.text.trim().length === 0;

    if (inFence) {
      pendingBlank = false;
      sawContent = true;
      continue;
    }

    if (rule.kind === "blank") {
      if (blank) {
        // Dòng trống thuộc về chunk phía trước; chunk mới mở ở dòng có chữ kế tiếp.
        pendingBlank = sawContent;
      } else {
        if (pendingBlank) cut(line.start);
        pendingBlank = false;
        sawContent = true;
      }
      continue;
    }

    if (blank) continue;

    if (rule.kind === "heading") {
      const m = HEADING_RE.exec(line.text);
      if (m && m[1].length <= rule.maxLevel) cut(line.start);
    } else if (line.text.trim() === rule.marker) {
      cut(line.start);
    }
    sawContent = true;
  }

  return starts.map((s, i) => ({
    source: source.slice(s.offset, i + 1 < starts.length ? starts[i + 1].offset : source.length),
    skip: s.skip,
  }));
}

/* ── Cảnh báo cỡ chunk (CR v0.4 §2.4) — chỉ để hiện chip, không chặn tạo job. ── */

export type ChunkFlag = "empty" | "short" | "large" | "huge" | "code-split";

export const HUGE_TOKENS = 8000;
const SHORT_TOKENS = 20;

/** Fence lẻ → code block bị cắt đôi. Đếm theo dòng vì chunk có thể không parse được. */
function fenceCount(text: string): number {
  let n = 0;
  for (const line of splitLines(text)) {
    if (FENCE_RE.test(line.text)) n++;
  }
  return n;
}

export function chunkFlags(text: string, chunkTokens: number): ChunkFlag[] {
  if (text.trim().length === 0) return ["empty"];
  const flags: ChunkFlag[] = [];
  const tokens = estimateTokens(text);
  if (tokens > HUGE_TOKENS) flags.push("huge");
  else if (tokens > chunkTokens) flags.push("large");
  else if (tokens < SHORT_TOKENS && !isFrontMatter(text)) flags.push("short");
  if (fenceCount(text) % 2 === 1) flags.push("code-split");
  return flags;
}
