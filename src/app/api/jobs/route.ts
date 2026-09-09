import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { chunkMarkdown, isFrontMatter, type ChunkPiece } from "@/lib/chunker";
import {
  CHUNK_MODES,
  DEFAULT_SETTINGS,
  MAX_DRAFT_CHUNKS,
  MAX_UPLOAD_BYTES,
  type ChunkMode,
} from "@/lib/defaults";
import { bad, ok, readJson } from "@/lib/http";
import { clampSummaryTokens, clampContextMaxTokens, clampTokens } from "@/lib/validate";
import { regenerateSections } from "@/lib/sectionStore";
import { and, desc, isNotNull, isNull, sql, type SQL } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;

/**
 * Đếm chunk/section bằng subquery thay vì join: join cả 2 bảng cùng lúc sẽ nhân
 * chéo số dòng và đếm sai.
 */
const countChunks = (status: SQL) =>
  // Viết thẳng "jobs"."id": select một bảng thì drizzle render cột thành `"id"`,
  // vào trong subquery lại trỏ nhầm sang "chunks"."id" nên đếm ra 0.
  sql<number>`(select count(*) from "chunks" where "chunks"."job_id" = "jobs"."id" and ${status})::int`;

const countSections = (status: SQL) =>
  sql<number>`(select count(*) from "sections" where "sections"."job_id" = "jobs"."id" and ${status})::int`;

/** Điều kiện lọc dựng từ query string — dùng chung cho trang dữ liệu và cho count tổng. */
function buildWhere(url: URL): SQL | undefined {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const tags = (url.searchParams.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const fav = url.searchParams.get("fav") === "1";
  const archived = url.searchParams.get("archived");

  const parts: SQL[] = [];

  if (q) parts.push(sql`${jobs.name} ilike ${"%" + q + "%"}`);

  // Lọc tag không phân biệt hoa thường: `API` và `api` là một.
  // Liệt kê từng param thay vì `= any($1::text[])`: postgres-js gửi mảng JS thành
  // một tham số text nên Postgres báo "malformed array literal".
  if (tags.length > 0) {
    const list = sql.join(
      tags.map((t) => sql`${t}`),
      sql`, `
    );
    parts.push(sql`exists (select 1 from unnest("jobs"."tags") as t where lower(t) in (${list}))`);
  }

  if (fav) {
    // Favorite kéo cả job archived ra, không cần bật gì thêm (mục 2.4).
    parts.push(sql`${jobs.favorite} = true`);
  } else if (archived === "only") {
    parts.push(isNotNull(jobs.archivedAt));
  } else if (archived !== "include") {
    parts.push(isNull(jobs.archivedAt));
  }

  return parts.length > 0 ? and(...parts) : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const where = buildWhere(url);

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(jobs)
    .where(where);

  const items = await db
    .select({
      id: jobs.id,
      name: jobs.name,
      tags: jobs.tags,
      favorite: jobs.favorite,
      archivedAt: jobs.archivedAt,
      pinnedAt: jobs.pinnedAt,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
      total: countChunks(sql`true`),
      done: countChunks(sql`"chunks"."status" in ('done','skipped')`),
      errors: countChunks(sql`"chunks"."status" = 'error'`),
      sectionsTotal: countSections(sql`true`),
      sectionsDone: countSections(sql`"sections"."status" = 'done'`),
    })
    .from(jobs)
    .where(where)
    // Ghim lên đầu bất kể trang / search / filter (mục 2.6).
    .orderBy(sql`${jobs.pinnedAt} desc nulls last`, desc(jobs.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return ok({ items, page, limit, total });
}

interface CreateBody {
  name?: string;
  source?: string;
  systemPrompt?: string;
  model?: string;
  endpoint?: string;
  chunkTokens?: number;
  summaryTokens?: number;
  contextMaxTokens?: number;
  /** CR v0.4 — chunk đã duyệt ở màn hình tạo job. Có nó thì `source` bị bỏ qua. */
  chunks?: unknown;
  chunkMode?: unknown;
}

/**
 * Chunk do user duyệt (CR v0.4 §2.3): bỏ chunk trắng, thêm `\n` vào cuối chunk
 * thiếu để hai chunk không dính nhau lúc export. Đây là chỗ DUY NHẤT app sửa
 * nội dung user nhập — nhờ vậy `source = join("")` vẫn đúng theo cách dựng.
 */
function piecesFromChunks(raw: string[]): ChunkPiece[] {
  const kept = raw.filter((c) => c.trim().length > 0);
  return kept.map((text, i) => ({
    source: i === kept.length - 1 || text.endsWith("\n") ? text : text + "\n",
    skip: i === 0 && isFrontMatter(text),
  }));
}

export async function POST(req: Request) {
  const body = await readJson<CreateBody>(req);
  if (!body) return bad("Body không hợp lệ");

  const chunkTokens = clampTokens(body.chunkTokens);
  const summaryTokens = clampSummaryTokens(body.summaryTokens);
  const contextMaxTokens = clampContextMaxTokens(body.contextMaxTokens);

  let chunkMode: ChunkMode = "auto";
  if (body.chunkMode !== undefined) {
    if (!CHUNK_MODES.includes(body.chunkMode as ChunkMode)) return bad("chunkMode không hợp lệ");
    chunkMode = body.chunkMode as ChunkMode;
  }

  let pieces: ChunkPiece[];
  if (body.chunks !== undefined) {
    if (!Array.isArray(body.chunks) || body.chunks.some((c) => typeof c !== "string")) {
      return bad("chunks phải là mảng string");
    }
    pieces = piecesFromChunks(body.chunks as string[]);
    if (pieces.length === 0) return bad("Không còn chunk nào có nội dung");
    if (pieces.length > MAX_DRAFT_CHUNKS) return bad(`Tối đa ${MAX_DRAFT_CHUNKS} chunk`);
  } else {
    // Không có `chunks` → đường cũ của v0, giữ nguyên cho script và test cũ.
    const src = body.source ?? "";
    if (src.trim().length === 0) return bad("Source rỗng");
    if (Buffer.byteLength(src, "utf8") > MAX_UPLOAD_BYTES) {
      return bad("File vượt quá 2 MB", 413);
    }
    pieces = chunkMarkdown(src, chunkTokens);
  }

  const source = pieces.map((p) => p.source).join("");
  if (Buffer.byteLength(source, "utf8") > MAX_UPLOAD_BYTES) {
    return bad("File vượt quá 2 MB", 413);
  }

  const [job] = await db
    .insert(jobs)
    .values({
      name: (body.name ?? "untitled.md").slice(0, 200),
      source,
      systemPrompt: body.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt,
      model: body.model ?? DEFAULT_SETTINGS.model,
      endpoint: body.endpoint ?? DEFAULT_SETTINGS.endpoint,
      chunkTokens,
      summaryTokens,
      contextMaxTokens,
      chunkMode,
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

  const sectionRows = await regenerateSections(job.id, summaryTokens);

  return ok(
    { job, chunks: inserted.sort((a, b) => a.idx - b.idx), sections: sectionRows },
    201
  );
}
