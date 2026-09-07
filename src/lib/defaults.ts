export const DEFAULT_SYSTEM_PROMPT = `Bạn là dịch giả chuyên nghiệp. Dịch văn bản Markdown sau sang tiếng Việt.
Yêu cầu:
- Giữ nguyên cấu trúc Markdown: heading, list, bảng, link, hình, code block, inline code.
- Không dịch nội dung trong code block và inline code. Không dịch URL.
- Giữ nguyên thuật ngữ kỹ thuật phổ biến bằng tiếng Anh.
- Dịch tự nhiên, không dịch máy móc từng từ.`;

/** App tự nối vào cuối system prompt. User không sửa được. */
export const OUTPUT_CONTRACT = `QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về bản dịch, bọc trong thẻ <translation></translation>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.`;

export const REMINDER = `NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc toàn bộ bản dịch trong <translation></translation>.`;

export interface Settings {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  chunkTokens: number;
  concurrency: number;
}

export const DEFAULT_SETTINGS: Settings = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.2,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  chunkTokens: 1500,
  concurrency: 3,
};

export const SETTINGS_KEY = "tranzlator.settings";
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const UNTRANSLATED_MARKER = "<!-- UNTRANSLATED -->";

export type ChunkStatus = "pending" | "translating" | "done" | "error" | "skipped";
