/** Mảnh thuần của vòng lặp front-end (CR v0.2 §8) — tách ra để test được. */

export interface KeyPick {
  key: string;
  /** Vị trí trong mảng apiKeys, dùng cho nhãn `key #n`. */
  index: number;
}

/** Round-robin theo từng cú gọi: cú thứ k dùng apiKeys[k mod n]. */
export function pickKey(keys: string[], cursor: number): KeyPick {
  const index = ((cursor % keys.length) + keys.length) % keys.length;
  return { key: keys[index], index };
}

/** Key kế tiếp trong vòng — dùng khi dính 429 và có từ 2 key trở lên. */
export function nextKey(keys: string[], index: number): KeyPick {
  const next = (index + 1) % keys.length;
  return { key: keys[next], index: next };
}

/** Chỉ 429 mới đổi key. 401/403/402 là lỗi cấu hình, người phải xử lý. */
export function isRateLimited(error: string | null | undefined): boolean {
  return Boolean(error && /\b429\b/.test(error));
}

/**
 * Ngủ theo lát nhỏ để Pause cắt được ngay, không phải đợi hết cool down.
 * Trả về false nếu bị cắt giữa chừng.
 */
export async function coolDown(ms: number, active: () => boolean): Promise<boolean> {
  const step = 100;
  let left = ms;
  while (left > 0) {
    if (!active()) return false;
    const wait = Math.min(step, left);
    await new Promise((r) => setTimeout(r, wait));
    left -= wait;
  }
  return active();
}
