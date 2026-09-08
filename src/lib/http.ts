import { NextResponse } from "next/server";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Vi phạm unique (23505) → 409 chứ không phải 500. Drizzle 0.44 bọc lỗi query lại,
 * mã của Postgres nằm ở `cause` (có thể lồng nhiều tầng) — kiểm mỗi `e.code` là hụt.
 */
export function isUniqueViolation(e: unknown): boolean {
  for (let cur = e, depth = 0; cur && depth < 5; depth++) {
    if ((cur as { code?: string }).code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
