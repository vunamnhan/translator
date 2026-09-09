"use client";

import type { ChunkRuleKind } from "./chunker";
import { clampHeadingLevel, normalizeChunkRule, normalizeMarker } from "./defaults";

/**
 * Bản nháp của màn hình tạo job (CR v0.4 §2.5). Chỉ một nháp, nằm ở localStorage
 * nên F5 không mất; không phải store dùng chung vì chỉ đúng một màn hình đọc nó.
 */
export const DRAFT_KEY = "tranzlator.draft";

/** localStorage thường trần ~5 MB; giữ ngưỡng thấp hơn để còn chỗ cho settings. */
export const MAX_DRAFT_BYTES = 4 * 1024 * 1024;

export interface Draft {
  name: string;
  /** Văn bản gốc user nhập — cắt lại luôn xuất phát từ đây, không từ chunk đang sửa. */
  rawSource: string;
  rule: ChunkRuleKind;
  headingLevel: number;
  marker: string;
  chunks: string[];
  /** Đã tách / gộp / chèn / xoá / sửa text sau khi cắt. */
  editedManually: boolean;
  /** Chunk đang mở, để F5 quay lại đúng chỗ. */
  selected: number;
  updatedAt: number;
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (typeof d.rawSource !== "string" || !Array.isArray(d.chunks)) return null;
    return {
      name: typeof d.name === "string" ? d.name : "untitled.md",
      rawSource: d.rawSource,
      rule: normalizeChunkRule(d.rule),
      headingLevel: clampHeadingLevel(d.headingLevel),
      marker: normalizeMarker(d.marker),
      chunks: d.chunks.filter((c): c is string => typeof c === "string"),
      editedManually: d.editedManually === true,
      selected: typeof d.selected === "number" ? d.selected : 0,
      updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** false = không lưu được (quá lớn hoặc localStorage bị chặn) — UI hiện banner vàng. */
export function writeDraft(draft: Draft): boolean {
  try {
    const payload = JSON.stringify(draft);
    if (payload.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(DRAFT_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // localStorage bị chặn → coi như chưa từng có nháp
  }
}
