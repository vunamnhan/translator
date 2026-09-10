/**
 * Assistant Writer (CR v0.6) — luật thuần của mẫu prompt: parse placeholder,
 * điền, validate, so working copy với record. Route và popup dùng chung một bộ,
 * y như `presets.ts` của v0.3.
 */

export const MAX_WRITER_NAME = 60;
export const MAX_WRITER_TEMPLATE = 20000;
/** Giới hạn mỗi giá trị placeholder. Cùng ngưỡng với template cho dễ nhớ. */
export const MAX_FIELD_VALUE = 20000;
/** Prompt sau khi điền, ~100k token. Vượt là chặn ở route, không gọi LLM (§3.3). */
export const MAX_FILLED_PROMPT = 400000;

/** Placeholder đặt trước: không sinh ô nhập, popup tự điền bằng văn bản nơi gắn. */
export const TEXT_KEY = "text";

/** `{{ten}}` — tên chỉ A–Z a–z 0–9 _, 1..40 ký tự. Sai luật thì coi như chữ thường (§3.2). */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}/g;

export interface WriterPromptDTO {
  id: string;
  name: string;
  template: string;
  fields: Record<string, string>;
  /** null = lấy `settings.temperature`. */
  temperature: number | null;
  updatedAt: string;
}

/** Working copy trong popup: thứ thực sự được điền và gửi đi. */
export interface WriterDraft {
  /** Mẫu đang chọn. null = chưa chọn / mẫu đã bị xoá. */
  promptId: string | null;
  template: string;
  /** Giá trị mọi key — kể cả key không còn trong template (giữ để đổi qua lại không mất). */
  values: Record<string, string>;
  temperature: number | null;
  result: string;
}

export interface ParsedTemplate {
  /** Tên ô nhập theo thứ tự xuất hiện lần đầu, đã bỏ `text` và bỏ trùng. */
  names: string[];
  /** Template có `{{text}}` hay không — quyết định dòng ⓘ trong popup. */
  hasText: boolean;
}

export function parseTemplate(template: string): ParsedTemplate {
  const names: string[] = [];
  const seen = new Set<string>();
  let hasText = false;
  for (const m of template.matchAll(PLACEHOLDER)) {
    const name = m[1];
    if (name === TEXT_KEY) {
      hasText = true;
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return { names, hasText };
}

/** Nhãn ô nhập = tên placeholder, `_` thành khoảng trắng. Không có cấu hình nhãn (§3.2). */
export function fieldLabel(name: string): string {
  return name.replace(/_/g, " ");
}

/**
 * Thay một lượt, **không đệ quy**: `String.replace` không quét lại phần vừa chèn
 * nên giá trị chứa `{{x}}` không bị thay tiếp (§3.3).
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
  text: string
): string {
  return template.replace(PLACEHOLDER, (_all, name: string) =>
    name === TEXT_KEY ? text : values[name] ?? ""
  );
}

/** Bỏ key `text` và giá trị không phải string. `text` do nơi gắn popup cấp, không lưu (§2). */
export function normalizeFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === TEXT_KEY || typeof value !== "string") continue;
    out[key] = value;
  }
  return out;
}

/** Rơi key rỗng không còn dùng tới; key đang có trong template thì giữ cả khi rỗng. */
export function pruneFields(
  values: Record<string, string>,
  names: string[]
): Record<string, string> {
  const keep = new Set(names);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === TEXT_KEY) continue;
    if (value !== "" || keep.has(key)) out[key] = value;
  }
  return out;
}

/** Rỗng và vắng mặt là một — ô mới sinh ra chưa gõ gì không tính là "đã sửa". */
export function sameFields(a: Record<string, string>, b: Record<string, string>): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

export function normalizeName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** null = theo Settings. Ngoài 0..2 thì kẹp lại, làm tròn về bước 0.1 (§3.1). */
export function normalizeTemperature(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(2, Math.max(0, n)) * 10) / 10;
}

export interface WriterPromptInput {
  name?: unknown;
  template?: unknown;
  fields?: unknown;
  temperature?: unknown;
}

/** Câu lỗi để trả 400, hoặc null nếu hợp lệ. `partial` cho PATCH: field vắng thì bỏ qua. */
export function validateWriterInput(body: WriterPromptInput, partial = false): string | null {
  const has = (k: keyof WriterPromptInput) => body[k] !== undefined;

  if (!partial || has("name")) {
    const name = normalizeName(body.name);
    if (!name) return "Thiếu tên mẫu";
    if (name.length > MAX_WRITER_NAME) return `Tên mẫu quá ${MAX_WRITER_NAME} ký tự`;
  }
  if (!partial || has("template")) {
    if (typeof body.template !== "string" || body.template.trim().length === 0) {
      return "Thiếu template";
    }
    if (body.template.length > MAX_WRITER_TEMPLATE) {
      return `Template quá ${MAX_WRITER_TEMPLATE} ký tự`;
    }
  }
  if (has("fields") && body.fields !== null) {
    const f = body.fields;
    if (typeof f !== "object" || Array.isArray(f)) return "fields phải là object phẳng";
    for (const [key, value] of Object.entries(f as Record<string, unknown>)) {
      if (typeof value !== "string") return `Giá trị của «${key}» phải là chuỗi`;
      if (value.length > MAX_FIELD_VALUE) {
        return `Giá trị của «${key}» quá ${MAX_FIELD_VALUE} ký tự`;
      }
    }
  }
  if (has("temperature") && body.temperature !== null) {
    const n = typeof body.temperature === "number" ? body.temperature : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 2) return "Temperature phải trong khoảng 0..2";
  }
  return null;
}

/** Working copy đã khác record chưa — nhãn "● đã sửa" và nút Lưu dùng chung câu trả lời này. */
export function draftModified(draft: WriterDraft, prompt: WriterPromptDTO | null): boolean {
  if (!prompt) return false;
  return (
    draft.template !== prompt.template ||
    draft.temperature !== prompt.temperature ||
    !sameFields(draft.values, prompt.fields)
  );
}

/** Nạp một mẫu xuống working copy. Kết quả đang có giữ nguyên, người dùng tự ghi đè. */
export function draftFromPrompt(prompt: WriterPromptDTO, result = ""): WriterDraft {
  return {
    promptId: prompt.id,
    template: prompt.template,
    values: { ...prompt.fields },
    temperature: prompt.temperature,
    result,
  };
}

export const EMPTY_DRAFT: WriterDraft = {
  promptId: null,
  template: "",
  values: {},
  temperature: null,
  result: "",
};

/**
 * Chèn cuối: trả về **phần thêm vào**, đã kèm dấu ngăn cách. Nội dung cũ chưa
 * kết thúc bằng dòng trống thì thêm dòng trống, để hai khối không dính nhau.
 */
export function appendBlock(existing: string, added: string): string {
  if (existing.length === 0) return added;
  if (existing.endsWith("\n\n")) return added;
  return existing.endsWith("\n") ? `\n${added}` : `\n\n${added}`;
}

/** Gợi ý tên khi "Lưu thành mẫu mới". */
export function copyName(from: string | null): string {
  return from ? `${from} (copy)` : "Mẫu mới";
}
