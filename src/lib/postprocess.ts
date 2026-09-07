import { codeBlocks, tableShapes, urls } from "./md";

export interface PostProcessResult {
  translated: string;
  warning: string | null;
}

/** Lấy nội dung trong cặp <translation></translation> đầu tiên. */
export function extractTranslation(raw: string): string | null {
  const m = raw.match(/<translation>([\s\S]*?)<\/translation>/i);
  if (!m) return null;
  let body = m[1];
  body = body.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  return body;
}

/**
 * Thay code block trong bản dịch bằng code block gốc (match theo thứ tự).
 * Lệch số lượng → warning, giữ nguyên phần thừa/thiếu.
 */
export function restoreCodeBlocks(
  source: string,
  translated: string
): { text: string; warning: string | null } {
  const src = codeBlocks(source);
  const dst = codeBlocks(translated);
  if (src.length === 0 && dst.length === 0) return { text: translated, warning: null };

  const n = Math.min(src.length, dst.length);
  let text = translated;
  // Thay từ cuối lên đầu để offset không lệch.
  for (let i = n - 1; i >= 0; i--) {
    text = text.slice(0, dst[i].start) + src[i].text + text.slice(dst[i].end);
  }
  const warning =
    src.length !== dst.length
      ? `Số code block lệch: gốc ${src.length}, bản dịch ${dst.length}`
      : null;
  return { text, warning };
}

export function validateTables(source: string, translated: string): string | null {
  const a = tableShapes(source);
  const b = tableShapes(translated);
  if (a.length !== b.length) {
    return `Số bảng lệch: gốc ${a.length}, bản dịch ${b.length}`;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].rows !== b[i].rows) {
      return `Bảng #${i + 1} lệch số dòng: gốc ${a[i].rows}, bản dịch ${b[i].rows}`;
    }
    for (let r = 0; r < a[i].rows; r++) {
      if (a[i].cols[r] !== b[i].cols[r]) {
        return `Bảng #${i + 1} dòng ${r + 1} lệch số cột: gốc ${a[i].cols[r]}, bản dịch ${b[i].cols[r]}`;
      }
    }
  }
  return null;
}

export function validateUrls(source: string, translated: string): string | null {
  const a = urls(source);
  const b = urls(translated);
  if (a.length !== b.length) {
    return `Số URL lệch: gốc ${a.length}, bản dịch ${b.length}`;
  }
  const missing = a.filter((u) => !b.includes(u));
  if (missing.length > 0) {
    return `URL bị đổi: ${missing.slice(0, 3).join(", ")}`;
  }
  return null;
}

export function checkRatio(source: string, translated: string): string | null {
  const s = source.trim().length;
  if (s === 0) return null;
  const ratio = translated.trim().length / s;
  if (ratio > 3) return `Bản dịch dài bất thường (ratio ${ratio.toFixed(2)})`;
  if (ratio < 0.3) return `Bản dịch ngắn bất thường (ratio ${ratio.toFixed(2)})`;
  return null;
}

/** Hậu xử lý đầy đủ theo mục 5.2 + 6.2. */
export function postProcess(source: string, rawTranslation: string): PostProcessResult {
  const restored = restoreCodeBlocks(source, rawTranslation);
  const warnings = [
    restored.warning,
    validateTables(source, restored.text),
    validateUrls(source, restored.text),
    checkRatio(source, restored.text),
  ].filter((w): w is string => Boolean(w));

  return {
    translated: restored.text,
    warning: warnings.length > 0 ? warnings.join(" · ") : null,
  };
}
