import { AUTH_COOKIE, SESSION_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth";
import { bad, readJson } from "@/lib/http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return bad("Auth đang tắt trên server", 400);

  const body = await readJson<{ password?: string }>(req);
  const given = body?.password ?? "";
  if (!given || !safeEqual(given, password)) {
    return bad("Sai mật khẩu", 401);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
