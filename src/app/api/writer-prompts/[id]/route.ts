import { db } from "@/db";
import { writerPrompts } from "@/db/schema";
import { bad, isUniqueViolation, ok, readJson } from "@/lib/http";
import {
  normalizeFields,
  normalizeName,
  normalizeTemperature,
  validateWriterInput,
  type WriterPromptInput,
} from "@/lib/writerPrompts";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Sửa tập con của 4 field. `fields` là **thay toàn bộ**, không merge (§5.3). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<WriterPromptInput>(req);
  if (!body) return bad("Body không hợp lệ");

  const error = validateWriterInput(body, true);
  if (error) return bad(error);

  const patch: Partial<typeof writerPrompts.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = normalizeName(body.name);
  if (body.template !== undefined) patch.template = body.template as string;
  if (body.fields !== undefined) patch.fields = normalizeFields(body.fields);
  if (body.temperature !== undefined) patch.temperature = normalizeTemperature(body.temperature);

  try {
    const [prompt] = await db
      .update(writerPrompts)
      .set(patch)
      .where(eq(writerPrompts.id, id))
      .returning();
    // Mẫu bị xoá từ trình duyệt khác trong lúc popup đang mở → 404, UI về "không mẫu".
    if (!prompt) return bad("Mẫu không còn tồn tại", 404);
    return ok(prompt);
  } catch (e) {
    if (isUniqueViolation(e)) return bad("Đã có mẫu trùng tên", 409);
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [prompt] = await db.delete(writerPrompts).where(eq(writerPrompts.id, id)).returning();
  if (!prompt) return bad("Mẫu không còn tồn tại", 404);
  return new NextResponse(null, { status: 204 });
}
