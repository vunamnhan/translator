/** Trích HTTP status code từ message lỗi để hiện ngay trên bar, khỏi mở raw. */
export function errorCode(error: string | null): string | null {
  if (!error) return null;
  const m = error.match(/\b(HTTP\s*)?(4\d{2}|5\d{2})\b/);
  return m ? m[2] : null;
}

const HINTS: Record<string, string> = {
  "429": "bị giới hạn tốc độ — giảm concurrency hoặc chờ rồi Dịch lại lỗi",
  "401": "API key sai hoặc hết hạn",
  "403": "key không có quyền với model này",
  "402": "hết credit / cần thanh toán",
  "404": "endpoint hoặc model không tồn tại",
  "500": "lỗi phía nhà cung cấp — thử lại sau",
  "502": "lỗi phía nhà cung cấp — thử lại sau",
  "503": "nhà cung cấp quá tải — thử lại sau",
};

export function errorHint(code: string | null): string | null {
  return code ? HINTS[code] ?? null : null;
}
