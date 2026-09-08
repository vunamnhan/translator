"use client";

/**
 * Nhớ những model đã dùng để lần sau khỏi gõ lại tay.
 * Tách khỏi `tranzlator.settings`: đây là lịch sử gõ, không phải cấu hình —
 * xoá settings hay đổi model không nên làm mất danh sách này.
 */
const KEY = "tranzlator.modelHistory";
export const MAX_MODEL_HISTORY = 10;

/** Mới nhất lên đầu, bỏ trùng (phân biệt hoa thường vì tên model là chuỗi định danh), cắt còn 10. */
export function addModel(list: string[], raw: string): string[] {
  const model = raw.trim();
  if (!model) return list;
  return [model, ...list.filter((m) => m !== model)].slice(0, MAX_MODEL_HISTORY);
}

export function normalizeModels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const model = item.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
    if (out.length >= MAX_MODEL_HISTORY) break;
  }
  return out;
}

/** Lọc gợi ý theo phần đang gõ; gõ đúng y hệt một dòng thì khỏi gợi ý lại chính nó. */
export function matchModels(list: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q);
}

export function readModels(): string[] {
  try {
    return normalizeModels(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage bị chặn → chỉ mất lịch sử, không chặn việc lưu settings
  }
  return list;
}

export function rememberModel(model: string): string[] {
  return write(addModel(readModels(), model));
}

export function forgetModel(model: string): string[] {
  return write(readModels().filter((m) => m !== model));
}
