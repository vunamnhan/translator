/**
 * CR v0.7 — chọn và dựng khối ngữ cảnh mạch cho một cú dịch.
 *
 * Luật thuần, không đụng DB, không gọi mạng: route dùng để dựng khối gửi đi,
 * UI dùng đúng hàm này để ước lượng "sẽ gửi kèm khoảng bao nhiêu token".
 * Một luật, hai nơi đọc — đừng chép thuật toán ra thành hai bản.
 */

import { estimateTokens } from "./chunker";
import { TRANSLATED_SO_FAR_NOTE } from "./defaults";

/** Chunk đứng trước chunk đang dịch. Chỉ cần đúng bốn cột này. */
export interface ContextPiece {
  idx: number;
  status: string;
  translated: string | null;
  summary: string | null;
}

export interface ContextPick {
  /** Tóm tắt các đoạn xa, idx tăng dần. */
  summaries: { idx: number; summary: string }[];
  /** Nguyên văn bản dịch mấy đoạn gần nhất, idx tăng dần, liền mạch tới đoạn cuối. */
  verbatim: { idx: number; translated: string }[];
  /** Token ước lượng của phần nội dung đã chọn (chưa tính khung thẻ và câu ghi chú). */
  tokens: number;
  /** Số tóm tắt bị bỏ vì hết ngân sách. > 0 thì chunk nhận warning. */
  droppedSummaries: number;
}

export interface ContextOptions {
  /** Số đoạn gần nhất muốn gửi nguyên văn. */
  windowChunks: number;
  /** Trần token cho cả khối. */
  contextTokens: number;
}

export const EMPTY_PICK: ContextPick = {
  summaries: [],
  verbatim: [],
  tokens: 0,
  droppedSummaries: 0,
};

/** Dòng tóm tắt trong khối — đánh số để model biết trình tự. */
function summaryLine(idx: number, summary: string): string {
  return `#${idx}: ${summary.trim()}`;
}

/**
 * Xếp chỗ theo ưu tiên gần trước xa sau (CR v0.7 §2.3):
 * 1. nguyên văn từ đoạn gần nhất lùi dần, gặp đoạn không vừa là dừng — cửa sổ
 *    phải liền mạch, thủng một lỗ giữa thì đọc còn khó hiểu hơn không có;
 * 2. mọi đoạn còn lại (kể cả đoạn vừa rớt khỏi cửa sổ vì quá khổ) xuống dùng tóm tắt;
 * 3. hết ngân sách thì bỏ tiếp từ tóm tắt xa nhất.
 *
 * `prev` phải là các chunk có idx nhỏ hơn chunk đang dịch. Chunk `skipped`
 * (front matter) bị loại ngay từ đây nên không lọt vào cửa sổ lẫn tóm tắt.
 */
export function pickContext(prev: ContextPiece[], opts: ContextOptions): ContextPick {
  // `done` đã loại luôn `skipped`: front matter không bao giờ ở trạng thái done.
  const done = prev.filter((p) => p.status === "done").sort((a, b) => a.idx - b.idx);
  if (done.length === 0 || opts.contextTokens <= 0) return EMPTY_PICK;

  let budget = opts.contextTokens;

  const width = Math.max(0, opts.windowChunks);
  const withText = done.filter((p) => p.translated !== null && p.translated.trim().length > 0);
  const candidates = width === 0 ? [] : withText.slice(-width);

  const verbatim: ContextPick["verbatim"] = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const text = candidates[i].translated as string;
    const cost = estimateTokens(text);
    // Không vừa thì dừng hẳn, không nhảy cóc sang đoạn xa hơn cho vừa chỗ trống.
    if (cost > budget) break;
    budget -= cost;
    verbatim.unshift({ idx: candidates[i].idx, translated: text });
  }

  const taken = new Set(verbatim.map((v) => v.idx));
  const pool = done.filter((p) => !taken.has(p.idx) && p.summary && p.summary.trim().length > 0);

  const summaries: ContextPick["summaries"] = [];
  let droppedSummaries = 0;
  for (let i = pool.length - 1; i >= 0; i--) {
    const summary = (pool[i].summary as string).trim();
    const cost = estimateTokens(summaryLine(pool[i].idx, summary));
    if (cost > budget) {
      // Hết chỗ: mọi đoạn xa hơn cũng bỏ luôn, để phần giữ lại là một dải liền.
      droppedSummaries = i + 1;
      break;
    }
    budget -= cost;
    summaries.unshift({ idx: pool[i].idx, summary });
  }

  return {
    summaries,
    verbatim,
    tokens: opts.contextTokens - budget,
    droppedSummaries,
  };
}

/** Khối `<translated_so_far>`. Không có gì để bơm thì trả chuỗi rỗng, không trả thẻ rỗng. */
export function renderContextBlock(pick: ContextPick): string {
  if (pick.summaries.length === 0 && pick.verbatim.length === 0) return "";

  const parts: string[] = [];
  if (pick.summaries.length > 0) {
    const lines = pick.summaries.map((s) => summaryLine(s.idx, s.summary)).join("\n");
    parts.push(`<summaries>\n${lines}\n</summaries>`);
  }
  if (pick.verbatim.length > 0) {
    const blocks = pick.verbatim.map((v) => `#${v.idx}:\n${v.translated}`).join("\n\n");
    parts.push(`<recent>\n${blocks}\n</recent>`);
  }

  return `<translated_so_far>\n${parts.join("\n")}\n</translated_so_far>\n${TRANSLATED_SO_FAR_NOTE}`;
}
