import {
  CONTEXT_CONTRACT,
  CONTEXT_REMINDER,
  DEFAULT_CHUNK_SUMMARY_PROMPT,
  documentContextBlock,
  normalizeChunkSummary,
  OUTPUT_CONTRACT,
  OUTPUT_CONTRACT_WITH_SUMMARY,
  previousChunkSummaryBlock,
  REMINDER,
  REMINDER_WITH_SUMMARY,
  SUMMARY_CONTRACT,
  SUMMARY_REMINDER,
  WRITER_CONTRACT,
  WRITER_REMINDER,
} from "./defaults";
import { extractTag } from "./postprocess";

const CALL_TIMEOUT_MS = 120_000;
const TAG_RETRIES = 3;
/** Backoff cho 429/5xx. Đọc lúc gọi để test ghi đè được qua LLM_BACKOFF_MS. */
function backoffs(): number[] {
  return (process.env.LLM_BACKOFF_MS ?? "2000,4000,8000")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
}

export class LlmError extends Error {
  constructor(message: string, readonly raw: string | null = null) {
    super(message);
  }
}

export function normalizeEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

/** Chỉ cho https, trừ khi ALLOW_HTTP_ENDPOINT=1. */
export function assertEndpointAllowed(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new LlmError("Endpoint không hợp lệ");
  }
  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && process.env.ALLOW_HTTP_ENDPOINT === "1") return;
  throw new LlmError("Chỉ cho phép endpoint https:// (bật ALLOW_HTTP_ENDPOINT=1 để dùng http)");
}

/** Lôi status + message thật ra khỏi body lỗi của provider (mỗi hãng một kiểu). */
function describeBody(body: string): { status?: number; message?: string } {
  try {
    const j = JSON.parse(body) as {
      error?: { message?: string; code?: unknown; status?: unknown; type?: string };
      message?: string;
    };
    const err = j.error;
    const rawCode = err?.code ?? err?.status;
    const status = typeof rawCode === "number" ? rawCode : Number(rawCode) || undefined;
    const message = err?.message ?? j.message;
    return { status, message: typeof message === "string" ? message.slice(0, 300) : undefined };
  } catch {
    return {};
  }
}

export interface TranslateParams {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  source: string;
  /** Ngữ cảnh chung của job. Rỗng/null → không bơm block nào. */
  documentContext?: string | null;
  /** CR v0.5 — xin thêm thẻ <summary> trong cùng cú gọi. Tắt → prompt y hệt v0.2. */
  withSummary?: boolean;
  /** Prompt tóm tắt chunk (working copy). Rỗng → mặc định app. Chỉ dùng khi `withSummary`. */
  chunkSummaryPrompt?: string | null;
  /** Tóm tắt chunk liền trước. Rỗng/null → không bơm khối nào. */
  previousSummary?: string | null;
}

export interface TranslateOutcome {
  translated: string | null;
  /** CR v0.5 — nội dung thẻ <summary>. null khi tắt `withSummary` hoặc model quên thẻ. */
  summary: string | null;
  raw: string | null;
  attempts: number;
  error: string | null;
}

interface RawCall {
  content: string;
}

async function callOnce(
  p: TranslateParams,
  messages: { role: string; content: string }[]
): Promise<RawCall> {
  const url = normalizeEndpoint(p.endpoint);
  let lastErr: LlmError | null = null;
  const backoff = backoffs();

  for (let i = 0; i <= backoff.length; i++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          temperature: p.temperature,
          stream: false,
          messages,
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = new LlmError(
        e instanceof Error && e.name === "TimeoutError"
          ? "Timeout sau 120s"
          : `Không gọi được endpoint: ${(e as Error).message}`
      );
      if (i < backoff.length) {
        await sleep(backoff[i]);
        continue;
      }
      throw lastErr;
    }

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: unknown;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        const raw = JSON.stringify(json);
        const { status, message } = describeBody(raw);
        // Nhiều provider trả HTTP 200 nhưng nhét lỗi (kể cả 429) vào body.
        const label = status ? `HTTP ${status}: ` : "";
        const detail = message ?? "response không có choices[0].message.content";
        if (status === 429 || (status && status >= 500)) {
          lastErr = new LlmError(`${label}${detail}`, raw.slice(0, 4000));
          if (i < backoff.length) {
            await sleep(backoff[i]);
            continue;
          }
          throw lastErr;
        }
        throw new LlmError(`${label}${detail}`, raw.slice(0, 4000));
      }
      return { content };
    }

    const body = await res.text().catch(() => "");
    const detail = describeBody(body).message;
    const suffix = detail ? ` — ${detail}` : "";
    if (res.status === 401 || res.status === 403) {
      throw new LlmError(`HTTP ${res.status}: LLM từ chối, kiểm tra API key${suffix}`, body.slice(0, 4000));
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new LlmError(`HTTP ${res.status}: LLM lỗi tạm thời${suffix}`, body.slice(0, 4000));
      if (i < backoff.length) {
        await sleep(backoff[i]);
        continue;
      }
      throw lastErr;
    }
    throw new LlmError(`HTTP ${res.status}: LLM báo lỗi${suffix}`, body.slice(0, 4000));
  }

  throw lastErr ?? new LlmError("Lỗi không xác định");
}

interface TagSpec {
  tag: string;
  contract: string;
  reminder: string;
  /** CR v0.6 — user message đi thẳng, không bọc <source>. Chỉ Assistant Writer dùng. */
  rawUser?: boolean;
}

const TRANSLATE_SPEC: TagSpec = { tag: "translation", contract: OUTPUT_CONTRACT, reminder: REMINDER };
const SUMMARY_SPEC: TagSpec = { tag: "summary", contract: SUMMARY_CONTRACT, reminder: SUMMARY_REMINDER };
const CONTEXT_SPEC: TagSpec = { tag: "context", contract: CONTEXT_CONTRACT, reminder: CONTEXT_REMINDER };
const WRITER_SPEC: TagSpec = {
  tag: "output",
  contract: WRITER_CONTRACT,
  reminder: WRITER_REMINDER,
  rawUser: true,
};

/**
 * Gọi LLM, retry khi model quên thẻ output.
 * Thứ tự system message: prompt user → ngữ cảnh chung → tóm tắt đoạn trước →
 * prompt tóm tắt chunk → output contract. Ba mảnh giữa chỉ có khi CR v0.5 bật;
 * tắt thì chuỗi ghép ra đúng byte như v0.2.
 *
 * Chỉ luồng dịch mới xin hai thẻ — tóm tắt section và ngữ cảnh chung không đụng vào.
 */
async function runTagged(p: TranslateParams, spec: TagSpec): Promise<TranslateOutcome> {
  let raw: string | null = null;
  let attempts = 0;
  const ctx = p.documentContext?.trim() ? documentContextBlock(p.documentContext.trim()) : null;

  const twoTag = spec === TRANSLATE_SPEC && p.withSummary === true;
  const prevBlock =
    twoTag && p.previousSummary?.trim()
      ? previousChunkSummaryBlock(p.previousSummary.trim())
      : null;
  const summaryPrompt = twoTag
    ? p.chunkSummaryPrompt?.trim() || DEFAULT_CHUNK_SUMMARY_PROMPT
    : null;
  const contract = twoTag ? OUTPUT_CONTRACT_WITH_SUMMARY : spec.contract;
  const reminder = twoTag ? REMINDER_WITH_SUMMARY : spec.reminder;

  for (let attempt = 1; attempt <= TAG_RETRIES; attempt++) {
    attempts = attempt;
    const parts = [
      attempt === 1 ? null : reminder,
      p.systemPrompt,
      ctx,
      prevBlock,
      summaryPrompt,
      contract,
    ].filter((v): v is string => Boolean(v));
    const messages = [
      { role: "system", content: parts.join("\n\n") },
      { role: "user", content: spec.rawUser ? p.source : `<source>\n${p.source}\n</source>` },
    ];

    try {
      const { content } = await callOnce(p, messages);
      raw = content;
      const extracted = extractTag(content, spec.tag);
      if (extracted !== null) {
        // Thiếu <summary> thì vẫn nhận bản dịch — không retry, bản dịch mới là thứ chính (§2.1).
        const summary = twoTag ? normalizeChunkSummary(extractTag(content, "summary")) : null;
        return { translated: extracted, summary, raw, attempts, error: null };
      }
    } catch (e) {
      const err = e as LlmError;
      return { translated: null, summary: null, raw: err.raw ?? raw, attempts, error: err.message };
    }
  }

  return {
    translated: null,
    summary: null,
    raw,
    attempts,
    error: `LLM không trả thẻ <${spec.tag}> sau ${TAG_RETRIES} lần thử`,
  };
}

/** Dịch 1 chunk. */
export function translate(p: TranslateParams): Promise<TranslateOutcome> {
  return runTagged(p, TRANSLATE_SPEC);
}

/** Tóm tắt 1 section. */
export function summarize(p: TranslateParams): Promise<TranslateOutcome> {
  return runTagged(p, SUMMARY_SPEC);
}

/** Tạo ngữ cảnh chung cho cả tài liệu. */
export function buildContext(p: TranslateParams): Promise<TranslateOutcome> {
  return runTagged(p, CONTEXT_SPEC);
}

export interface WriterParams {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  /** Prompt đã điền placeholder ở front-end. Server không biết mẫu là gì (CR v0.6 §5.5). */
  prompt: string;
}

export interface WriterOutcome {
  output: string | null;
  raw: string | null;
  attempts: number;
  error: string | null;
}

/**
 * CR v0.6 — một cú gọi Assistant Writer. System message chỉ có `WRITER_CONTRACT`
 * (thêm reminder khi model quên thẻ); prompt đã điền là user message thô.
 */
export async function writeText(p: WriterParams): Promise<WriterOutcome> {
  const out = await runTagged(
    {
      endpoint: p.endpoint,
      apiKey: p.apiKey,
      model: p.model,
      temperature: p.temperature,
      systemPrompt: "",
      source: p.prompt,
    },
    WRITER_SPEC
  );
  return { output: out.translated, raw: out.raw, attempts: out.attempts, error: out.error };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
