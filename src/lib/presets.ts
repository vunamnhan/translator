/**
 * Preset = bộ prompt đặt tên, lưu DB (CR v0.3). Chỗ này chỉ có luật thuần tuý
 * (validate, so sánh, cảnh báo contract) để route và UI dùng chung một bộ.
 */

export const MAX_PRESET_NAME = 60;
export const MAX_PROMPT_CHARS = 20000;

export interface PresetDTO {
  id: string;
  name: string;
  translatePrompt: string;
  summaryPrompt: string;
  /** null = dùng CONTEXT_PROMPT cố định của app. */
  contextPrompt: string | null;
  /** CR v0.5 — null = dùng DEFAULT_CHUNK_SUMMARY_PROMPT của app. */
  chunkSummaryPrompt: string | null;
  updatedAt: string;
}

/** Bốn prompt của một preset, cũng là working copy trong Settings. */
export interface PromptSet {
  translatePrompt: string;
  summaryPrompt: string;
  contextPrompt: string;
  /** CR v0.5 — rỗng = dùng prompt tóm tắt chunk mặc định của app. */
  chunkSummaryPrompt: string;
}

export interface PresetInput {
  name?: unknown;
  translatePrompt?: unknown;
  summaryPrompt?: unknown;
  contextPrompt?: unknown;
  chunkSummaryPrompt?: unknown;
}

export function normalizeName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Rỗng sau trim = null: '' và null cùng nghĩa "dùng prompt của app" (§3.1). */
export function normalizeOptionalPrompt(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  return raw.trim() ? raw : null;
}

/** Tên cũ từ v0.3, giữ lại vì luật của `contextPrompt` và `chunkSummaryPrompt` y hệt nhau. */
export const normalizeContextPrompt = normalizeOptionalPrompt;

function promptError(label: string, value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return `Thiếu ${label}`;
  if (value.length > MAX_PROMPT_CHARS) return `${label} quá ${MAX_PROMPT_CHARS} ký tự`;
  return null;
}

/** Câu lỗi để trả 400, hoặc null nếu hợp lệ. `partial` cho PATCH: field vắng mặt thì bỏ qua. */
export function validatePresetInput(body: PresetInput, partial = false): string | null {
  const has = (k: keyof PresetInput) => body[k] !== undefined;

  if (!partial || has("name")) {
    const name = normalizeName(body.name);
    if (!name) return "Thiếu tên preset";
    if (name.length > MAX_PRESET_NAME) return `Tên preset quá ${MAX_PRESET_NAME} ký tự`;
  }
  if (!partial || has("translatePrompt")) {
    const e = promptError("prompt dịch", body.translatePrompt);
    if (e) return e;
  }
  if (!partial || has("summaryPrompt")) {
    const e = promptError("prompt tóm tắt", body.summaryPrompt);
    if (e) return e;
  }
  if (has("contextPrompt") && body.contextPrompt !== null) {
    if (typeof body.contextPrompt !== "string") return "Prompt ngữ cảnh chung không hợp lệ";
    if (body.contextPrompt.length > MAX_PROMPT_CHARS) {
      return `Prompt ngữ cảnh chung quá ${MAX_PROMPT_CHARS} ký tự`;
    }
  }
  if (has("chunkSummaryPrompt") && body.chunkSummaryPrompt !== null) {
    if (typeof body.chunkSummaryPrompt !== "string") return "Prompt tóm tắt chunk không hợp lệ";
    if (body.chunkSummaryPrompt.length > MAX_PROMPT_CHARS) {
      return `Prompt tóm tắt chunk quá ${MAX_PROMPT_CHARS} ký tự`;
    }
  }
  return null;
}

/** So working copy với preset đang gắn. So sau trim để khỏi báo "đã sửa" vì một dấu xuống dòng. */
export function samePromptSet(a: PromptSet, b: PromptSet): boolean {
  return (
    a.translatePrompt.trim() === b.translatePrompt.trim() &&
    a.summaryPrompt.trim() === b.summaryPrompt.trim() &&
    a.contextPrompt.trim() === b.contextPrompt.trim() &&
    a.chunkSummaryPrompt.trim() === b.chunkSummaryPrompt.trim()
  );
}

export function presetPromptSet(p: PresetDTO): PromptSet {
  return {
    translatePrompt: p.translatePrompt,
    summaryPrompt: p.summaryPrompt,
    contextPrompt: p.contextPrompt ?? "",
    chunkSummaryPrompt: p.chunkSummaryPrompt ?? "",
  };
}

const CONTRACT_TAGS = ["<translation>", "<summary>", "<context>"];

/**
 * App tự nối output contract, user viết luật thẻ trong prompt là thừa và dễ đá nhau.
 * Chỉ cảnh báo, không chặn (§3.1).
 */
export function contractWarning(set: PromptSet): string | null {
  const all =
    `${set.translatePrompt}\n${set.summaryPrompt}\n${set.contextPrompt}\n${set.chunkSummaryPrompt}`.toLowerCase();
  const hit = CONTRACT_TAGS.filter((tag) => all.includes(tag));
  if (hit.length === 0) return null;
  return `Prompt có chứa ${hit.join(", ")} — app đã tự nối luật thẻ, viết thêm dễ đá nhau.`;
}

/** Gợi ý tên khi "Lưu thành preset mới". */
export function copyName(from: string | null): string {
  return from ? `${from} (copy)` : "Preset mới";
}
