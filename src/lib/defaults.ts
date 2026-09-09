import type { ChunkRuleKind } from "./chunker";

export const DEFAULT_SYSTEM_PROMPT = `Bạn là dịch giả chuyên nghiệp. Dịch văn bản Markdown sau sang tiếng Việt.
Yêu cầu:
- Giữ nguyên cấu trúc Markdown: heading, list, bảng, link, hình, code block, inline code.
- Không dịch nội dung trong code block và inline code. Không dịch URL.
- Giữ nguyên thuật ngữ kỹ thuật phổ biến bằng tiếng Anh.
- Dịch tự nhiên, không dịch máy móc từng từ.`;

export const DEFAULT_SUMMARY_PROMPT = `Tóm tắt đoạn văn bản Markdown sau bằng tiếng Việt, 3–5 gạch đầu dòng.
Nêu ý chính, kết luận, con số hoặc quyết định quan trọng nếu có.
Không diễn giải thêm, không nhận xét.`;

/**
 * Prompt tóm tắt chung mặc định. Từ CR v0.3 preset ghi đè được (`contextPrompt`
 * trong Settings); `CONTEXT_TRUNCATED_NOTE` và `CONTEXT_CONTRACT` vẫn do app nối.
 */
export const CONTEXT_PROMPT = `Bạn đọc toàn bộ tài liệu Markdown dưới đây và viết phần "ngữ cảnh chung" bằng tiếng Việt,
dùng làm nền cho việc dịch và tóm tắt từng phần sau này.
Trả về đúng khung sau, không thêm phần nào khác:

## Tổng quan
(3–6 câu: tài liệu nói về gì, cho ai, giọng văn)

## Cấu trúc
(outline ngắn các phần chính)

## Thuật ngữ
- term gốc → cách dịch / giữ nguyên
- ...`;

export const CONTEXT_TRUNCATED_NOTE = `LƯU Ý: Tài liệu quá dài nên đã bị rút gọn — mỗi phần chỉ giữ heading và phần đầu.
Hãy suy luận trên phần rút gọn này, đừng phàn nàn về việc thiếu nội dung.`;

/** App tự nối vào cuối system prompt. User không sửa được. */
export const OUTPUT_CONTRACT = `QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về bản dịch, bọc trong thẻ <translation></translation>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.`;

export const SUMMARY_CONTRACT = `QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về bản tóm tắt, bọc trong thẻ <summary></summary>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.`;

export const CONTEXT_CONTRACT = `QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về phần ngữ cảnh chung, bọc trong thẻ <context></context>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.`;

export const REMINDER = `NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc toàn bộ bản dịch trong <translation></translation>.`;
export const SUMMARY_REMINDER = `NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc toàn bộ bản tóm tắt trong <summary></summary>.`;
export const CONTEXT_REMINDER = `NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc toàn bộ nội dung trong <context></context>.`;

/**
 * CR v0.5 — prompt tóm tắt chunk mặc định. Preset ghi đè được (`chunkSummaryPrompt`
 * trong Settings). Chỉ nói tóm tắt cái gì; luật thẻ do app nối qua contract.
 */
export const DEFAULT_CHUNK_SUMMARY_PROMPT = `Sau khi dịch, viết thêm phần tóm tắt ngắn của đoạn vừa dịch bằng tiếng Việt, 2–4 câu:
- đoạn nói về gì, chủ thể / nhân vật nào đang xuất hiện;
- đoạn kết thúc ở trạng thái nào (đang dở câu chuyện, đang liệt kê, vừa đặt câu hỏi…).
Chỉ dùng để đoạn kế tiếp hiểu mạch. Không nhận xét, không lặp lại bản dịch.`;

/** Contract khi bật `chunkSummary`: một cú gọi trả cả bản dịch lẫn tóm tắt (CR v0.5 §4.2). */
export const OUTPUT_CONTRACT_WITH_SUMMARY = `QUY TẮC ĐẦU RA BẮT BUỘC:
Trả về đúng hai thẻ, theo thứ tự:
<translation>bản dịch</translation>
<summary>tóm tắt ngắn của đoạn vừa dịch</summary>
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài hai thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.`;

export const REMINDER_WITH_SUMMARY = `NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc bản dịch trong <translation></translation> và tóm tắt trong <summary></summary>.`;

/** Tóm tắt chunk cắt cứng 1 000 ký tự sau trim; rỗng coi như không có. */
export const MAX_CHUNK_SUMMARY = 1000;

export function normalizeChunkSummary(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text ? text.slice(0, MAX_CHUNK_SUMMARY) : null;
}

/** Khối tóm tắt đoạn ngay trước, bơm sau ngữ cảnh chung (CR v0.5 §4.1). */
export function previousChunkSummaryBlock(summary: string): string {
  return `<previous_chunk_summary>
${summary}
</previous_chunk_summary>
Đây là tóm tắt đoạn ngay trước đoạn cần dịch, chỉ để hiểu mạch và giữ giọng, xưng hô nhất quán. Không dịch, không lặp lại nội dung này.`;
}

/** Câu warning của luồng chuỗi — route ghi vào chunk, UI so chuỗi nên để một chỗ. */
export const WARN_NO_CHUNK_SUMMARY = "Model không trả tóm tắt chunk";
export const WARN_NO_PREV_SUMMARY = "Không có tóm tắt đoạn trước";

/** Block ngữ cảnh chung, dùng chung cho cả luồng dịch lẫn luồng tóm tắt section. */
export function documentContextBlock(context: string): string {
  return `<document_context>
${context}
</document_context>
Dùng ngữ cảnh trên để hiểu tài liệu và giữ thuật ngữ nhất quán. Chỉ xử lý nội dung trong <source>.`;
}

export interface Settings {
  endpoint: string;
  /** 1..5 key, cùng endpoint + model. Xoay vòng từng cú gọi để né 429 (CR v0.2 §8.1). */
  apiKeys: string[];
  model: string;
  temperature: number;
  systemPrompt: string;
  chunkTokens: number;
  concurrency: number;
  summaryPrompt: string;
  /** Prompt tạo ngữ cảnh chung (CR v0.3). Rỗng = dùng `CONTEXT_PROMPT` của app. */
  contextPrompt: string;
  /** Prompt tóm tắt chunk (CR v0.5). Rỗng = dùng `DEFAULT_CHUNK_SUMMARY_PROMPT` của app. */
  chunkSummaryPrompt: string;
  /** CR v0.5 — cùng cú gọi dịch xin thêm thẻ <summary> cho từng chunk. */
  chunkSummary: boolean;
  /** CR v0.5 — bơm tóm tắt chunk trước vào prompt; ép dịch 1-1. Cần `chunkSummary` bật. */
  chainPrevSummary: boolean;
  /** Preset đang gắn (CR v0.3). null = "Tuỳ chỉnh". Preset không còn trên DB cũng coi như null. */
  presetId: string | null;
  summaryTokens: number;
  contextMaxTokens: number;
  useContextForTranslation: boolean;
  /** Worker nghỉ bao lâu sau mỗi call trước khi lấy việc tiếp. 0 = tắt (CR v0.2 §8.2). */
  cooldownMs: number;
  /** CR v0.4 — quy tắc cắt dùng lần gần nhất, để `/new` lần sau mở đúng rule. */
  chunkRule: ChunkRuleKind;
  headingLevel: number;
  chunkMarker: string;
}

export const DEFAULT_SETTINGS: Settings = {
  endpoint: "https://api.openai.com/v1",
  apiKeys: [],
  model: "gpt-4o-mini",
  temperature: 0.2,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  chunkTokens: 1500,
  concurrency: 3,
  summaryPrompt: DEFAULT_SUMMARY_PROMPT,
  contextPrompt: "",
  chunkSummaryPrompt: "",
  chunkSummary: false,
  chainPrevSummary: false,
  presetId: null,
  summaryTokens: 6000,
  contextMaxTokens: 80000,
  useContextForTranslation: true,
  cooldownMs: 5000,
  chunkRule: "auto",
  headingLevel: 2,
  chunkMarker: "---",
};

export const MAX_API_KEYS = 5;

/** Bỏ key rỗng, gộp key trùng, cắt còn tối đa 5. */
export function normalizeApiKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_API_KEYS) break;
  }
  return out;
}

/** Nhãn key trong thông báo lỗi: `key #2 (…a4f9)`. */
export function apiKeyLabel(key: string, index: number): string {
  return `key #${index + 1} (…${key.slice(-4)})`;
}

export const SETTINGS_KEY = "tranzlator.settings";
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const UNTRANSLATED_MARKER = "<!-- UNTRANSLATED -->";

/** CR v0.4 — quy tắc ghi trên job. 'manual' = có sửa tay sau khi cắt. */
export type ChunkMode = ChunkRuleKind | "manual";
export const CHUNK_MODES: ChunkMode[] = ["auto", "heading", "blank", "marker", "manual"];

/** Nhãn quy tắc cắt, hiện ở chip màn hình job và trong câu confirm Rechunk. */
export function chunkModeLabel(mode: ChunkMode): string {
  const map: Record<ChunkMode, string> = {
    auto: "tự động",
    heading: "heading",
    blank: "dòng trống",
    marker: "dấu ngắt",
    manual: "tay",
  };
  return map[mode] ?? mode;
}

export const MAX_MARKER_LEN = 64;
export const MAX_DRAFT_CHUNKS = 2000;

export function clampHeadingLevel(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 2;
  return Math.min(3, Math.max(1, n));
}

/** Dấu ngắt phải là một dòng đặc, 1..64 ký tự. Rỗng → về mặc định. */
export function normalizeMarker(v: unknown): string {
  const raw = typeof v === "string" ? v.trim().slice(0, MAX_MARKER_LEN) : "";
  return raw.length > 0 ? raw : DEFAULT_SETTINGS.chunkMarker;
}

export function normalizeChunkRule(v: unknown): ChunkRuleKind {
  return v === "heading" || v === "blank" || v === "marker" ? v : "auto";
}

export type ChunkStatus = "pending" | "translating" | "done" | "error" | "skipped";
export type SectionStatus = "pending" | "summarizing" | "done" | "error";
