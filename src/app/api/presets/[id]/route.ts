import { db } from "@/db";
import { presets } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import {
  normalizeContextPrompt,
  normalizeName,
  validatePresetInput,
  type PresetInput,
} from "@/lib/presets";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isDuplicate(e: unknown): boolean {
  return (e as { code?: string })?.code === "23505";
}

/** Sửa tập con bất kỳ của 4 field. Last-write-wins, không lock (§3.2). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<PresetInput>(req);
  if (!body) return bad("Body không hợp lệ");

  const error = validatePresetInput(body, true);
  if (error) return bad(error);

  const patch: Partial<typeof presets.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = normalizeName(body.name);
  if (body.translatePrompt !== undefined) patch.translatePrompt = body.translatePrompt as string;
  if (body.summaryPrompt !== undefined) patch.summaryPrompt = body.summaryPrompt as string;
  if (body.contextPrompt !== undefined) {
    patch.contextPrompt = normalizeContextPrompt(body.contextPrompt);
  }

  try {
    const [preset] = await db.update(presets).set(patch).where(eq(presets.id, id)).returning();
    // Preset bị xoá từ trình duyệt khác trong lúc drawer đang mở → 404, UI về "Tuỳ chỉnh".
    if (!preset) return bad("Preset không còn tồn tại", 404);
    return ok(preset);
  } catch (e) {
    if (isDuplicate(e)) return bad("Đã có preset trùng tên", 409);
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [preset] = await db.delete(presets).where(eq(presets.id, id)).returning();
  if (!preset) return bad("Preset không còn tồn tại", 404);
  return new NextResponse(null, { status: 204 });
}
