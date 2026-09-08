/** Chuẩn hoá tag theo mục 2.1 CR v0.2 — dùng chung cho API và UI. */

export const MAX_TAG_LEN = 32;
export const MAX_TAGS_PER_JOB = 20;

/** Trim + gộp khoảng trắng + cắt 32 ký tự. Giữ nguyên hoa thường người dùng gõ. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LEN);
}

/** Chuẩn hoá cả mảng: bỏ rỗng, gộp trùng (không phân biệt hoa thường), cắt 20 tag. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = normalizeTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS_PER_JOB) break;
  }
  return out;
}

/** Job đã có `api` thì gõ `API` không thêm nữa. */
export function hasTag(tags: string[], tag: string): boolean {
  const key = normalizeTag(tag).toLowerCase();
  return tags.some((t) => t.toLowerCase() === key);
}
