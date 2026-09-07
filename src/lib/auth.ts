export const AUTH_COOKIE = "tz_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

/** Token phiên = SHA-256 của password + salt. Chạy được cả edge lẫn node runtime. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`tranzlator:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** So sánh không phụ thuộc thời gian, tránh lộ độ dài khớp. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
