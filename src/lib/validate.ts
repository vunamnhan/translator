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
