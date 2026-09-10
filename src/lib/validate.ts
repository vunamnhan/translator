import { DEFAULT_SETTINGS } from "./defaults";

export function clampTokens(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DEFAULT_SETTINGS.chunkTokens;
  return Math.min(20000, Math.max(100, n));
}

export function clampTemperature(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_SETTINGS.temperature;
  return Math.min(2, Math.max(0, n));
}

export function clampSummaryTokens(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DEFAULT_SETTINGS.summaryTokens;
  return Math.min(100000, Math.max(500, n));
}

export function clampContextMaxTokens(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DEFAULT_SETTINGS.contextMaxTokens;
  return Math.min(1000000, Math.max(1000, n));
}

/** Cool down của vòng lặp front-end: 0..60s, làm tròn về bước 500ms. */
export function clampCooldown(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_SETTINGS.cooldownMs;
  return Math.min(60000, Math.max(0, Math.round(n / 500) * 500));
}

/** CR v0.7 — cửa sổ nguyên văn: 0..20 đoạn. 0 = chỉ gửi tóm tắt. */
export function clampWindowChunks(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v)
      ? Math.round(v)
      : DEFAULT_SETTINGS.contextWindowChunks;
  return Math.min(20, Math.max(0, n));
}

/** CR v0.7 — trần token của cả khối ngữ cảnh mạch. */
export function clampContextTokens(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DEFAULT_SETTINGS.contextTokens;
  return Math.min(100000, Math.max(500, n));
}
