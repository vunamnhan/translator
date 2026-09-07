import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { chunkMarkdown } from "@/lib/chunker";
import { DEFAULT_SETTINGS, MAX_UPLOAD_BYTES } from "@/lib/defaults";
import { bad, ok, readJson } from "@/lib/http";
import { clampTokens } from "@/lib/validate";
import { desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: jobs.id,
      name: jobs.name,
      createdAt: jobs.createdAt,
      total: sql<number>`count(${chunks.id})::int`,
      done: sql<number>`count(*) filter (where ${chunks.status} in ('done','skipped'))::int`,
      errors: sql<number>`count(*) filter (where ${chunks.status} = 'error')::int`,
    })
    .from(jobs)
    .leftJoin(chunks, eq(chunks.jobId, jobs.id))
    .groupBy(jobs.id)
    .orderBy(desc(jobs.createdAt));

  return ok(rows);
}

interface CreateBody {
  name?: string;
  source?: string;
  systemPrompt?: string;
  model?: string;
  endpoint?: string;
  chunkTokens?: number;
}

export async function POST(req: Request) {
  const body = await readJson<CreateBody>(req);
  if (!body) return bad("Body không hợp lệ");

  const source = body.source ?? "";
  if (source.trim().length === 0) return bad("Source rỗng");
  if (Buffer.byteLength(source, "utf8") > MAX_UPLOAD_BYTES) {
    return bad("File vượt quá 2 MB", 413);
  }

  const chunkTokens = clampTokens(body.chunkTokens);
  const pieces = chunkMarkdown(source, chunkTokens);

  const [job] = await db
    .insert(jobs)
    .values({
      name: (body.name ?? "untitled.md").slice(0, 200),
      source,
      systemPrompt: body.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt,
      model: body.model ?? DEFAULT_SETTINGS.model,
      endpoint: body.endpoint ?? DEFAULT_SETTINGS.endpoint,
      chunkTokens,
    })
    .returning();

  const inserted = await db
    .insert(chunks)
    .values(
      pieces.map((p, i) => ({
        jobId: job.id,
        idx: i,
        source: p.source,
        status: p.skip ? "skipped" : "pending",
      }))
    )
    .returning();

  return ok({ job, chunks: inserted.sort((a, b) => a.idx - b.idx) }, 201);
}
