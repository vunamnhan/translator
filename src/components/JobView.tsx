"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChunkBar from "./ChunkBar";
import JobTitle from "./JobTitle";
import Preview from "./Preview";
import ExportModal from "./ExportModal";
import SummaryView from "./SummaryView";
import { useConfirm } from "./ConfirmDialog";
import { Banner, ListPanel, ProgressBar, ReadingSizeControl, type FilterDef } from "./chrome";
import Menu from "./Menu";
import { useReadMode } from "@/lib/readMode";
import TagEditor from "./TagEditor";
import { useTags } from "@/lib/useTags";
import { useSettings } from "@/lib/useSettings";
import { apiKeyLabel } from "@/lib/defaults";
import { coolDown, isRateLimited, nextKey, pickKey, type KeyPick } from "@/lib/runner";
import { assembleMarkdown, assembleSummary } from "@/lib/assemble";
import type { ChunkDTO, JobDTO, SectionDTO } from "@/lib/types";

type Tab = "translate" | "summary";
type Loop = "translate" | "summary";

export default function JobView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { settings, loaded } = useSettings();
  const { ask, dialog } = useConfirm();
  const { tags: allTags, reload: reloadTags } = useTags();
  const [job, setJob] = useState<JobDTO | null>(null);
  const [chunks, setChunks] = useState<ChunkDTO[]>([]);
  const [sections, setSections] = useState<SectionDTO[]>([]);
  const [tab, setTab] = useState<Tab>("translate");
  const [loop, setLoop] = useState<Loop | null>(null);
  const [contextBusy, setContextBusy] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSummaryExport, setShowSummaryExport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  // Lọc + tìm ở cột trái. Đổi tab thì reset để không lọc nhầm sang danh sách kia.
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  /* Chỉ có nghĩa dưới 768px: cột danh sách là sheet trượt từ đáy. Từ md trở lên
     CSS cho cột hiện luôn nên state này bị kệ, không cần đo bề ngang màn hình. */
  const [listOpen, setListOpen] = useState(false);
  const { readMode } = useReadMode();

  // Vào chế độ đọc thì đóng luôn sheet danh sách — nút mở nó cũng vừa bị giấu.
  useEffect(() => {
    if (readMode) setListOpen(false);
  }, [readMode]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  // Key nào đã gọi thẻ nào — chỉ giữ trong bộ nhớ trang, không lưu DB (§8.1).
  const [keyUsed, setKeyUsed] = useState<Record<string, number>>({});
  const [cooling, setCooling] = useState(false);

  // Chỉ 1 vòng lặp active tại một thời điểm (mục 5.3 CR).
  const runRef = useRef<Loop | null>(null);
  const chunksRef = useRef<ChunkDTO[]>([]);
  chunksRef.current = chunks;
  const sectionsRef = useRef<SectionDTO[]>([]);
  sectionsRef.current = sections;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const jobRef = useRef<JobDTO | null>(null);
  jobRef.current = job;
  /** Bộ đếm round-robin dùng chung cho cả 3 luồng, reset khi tải lại trang. */
  const keyCursor = useRef(0);
  const coolingWorkers = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) {
      setNotice("Không tải được job");
      return;
    }
    const data: { job: JobDTO; chunks: ChunkDTO[]; sections: SectionDTO[] } = await res.json();
    setJob(data.job);
    setChunks(data.chunks);
    setSections(data.sections ?? []);
  }, [jobId]);

  useEffect(() => {
    void load();
    return () => {
      runRef.current = null;
    };
  }, [load]);

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    setQuery("");
    setFilter("all");
  }, []);

  const needKey = useCallback(() => {
    if (settingsRef.current.apiKeys.length > 0) return false;
    setNotice("Chưa có API key — mở Settings trên thanh trên cùng để nhập.");
    return true;
  }, []);

  /** Lấy key kế tiếp trong vòng cho một cú gọi. */
  const takeKey = useCallback((): KeyPick => {
    const keys = settingsRef.current.apiKeys;
    const pick = pickKey(keys, keyCursor.current);
    keyCursor.current += 1;
    return pick;
  }, []);

  /** Pool chạy chung cho cả 2 vòng lặp. */
  const runPool = useCallback(async (kind: Loop, ids: string[], one: (id: string) => Promise<void>) => {
    if (runRef.current) {
      setNotice("Đang có một vòng lặp chạy — Pause trước đã.");
      return;
    }
    if (ids.length === 0) return;
    setNotice(null);
    runRef.current = kind;
    setLoop(kind);

    let cursor = 0;
    const pool = Math.min(6, Math.max(1, settingsRef.current.concurrency));
    const active = () => runRef.current === kind;
    coolingWorkers.current = 0;
    setCooling(false);

    await Promise.all(
      Array.from({ length: pool }, async () => {
        let first = true;
        while (active() && cursor < ids.length) {
          // Nghỉ sau mỗi call, trước khi lấy việc tiếp. Call đầu của worker không nghỉ (§8.2).
          const wait = settingsRef.current.cooldownMs;
          if (!first && wait > 0) {
            coolingWorkers.current += 1;
            setCooling(coolingWorkers.current >= pool);
            const carryOn = await coolDown(wait, active);
            coolingWorkers.current -= 1;
            setCooling(coolingWorkers.current >= pool);
            if (!carryOn) break;
          }
          first = false;
          await one(ids[cursor++]);
        }
      })
    );

    coolingWorkers.current = 0;
    setCooling(false);
    runRef.current = null;
    setLoop(null);
  }, []);

  const pause = useCallback(() => {
    runRef.current = null;
    setLoop(null);
    coolingWorkers.current = 0;
    setCooling(false);
  }, []);

  // ---------- Dịch ----------

  const patchChunk = useCallback((id: string, patch: Partial<ChunkDTO>) => {
    setChunks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  /** 1 API call = 1 chunk, dùng đúng cấu hình trong Settings. Server không loop. */
  const callTranslate = useCallback(
    async (id: string, pick: KeyPick): Promise<ChunkDTO | { error: string }> => {
      const s = settingsRef.current;
      try {
        const res = await fetch(`/api/chunks/${id}/translate`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-llm-key": pick.key },
          body: JSON.stringify({
            endpoint: s.endpoint,
            model: s.model,
            systemPrompt: s.systemPrompt,
            temperature: s.temperature,
            useContext: s.useContextForTranslation,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` };
        return data as ChunkDTO;
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    []
  );

  const translateOne = useCallback(
    async (id: string) => {
      const keys = settingsRef.current.apiKeys;
      patchChunk(id, { status: "translating", error: null });

      let pick = takeKey();
      let row = await callTranslate(id, pick);
      // Dính 429 và còn key khác → thử lại ngay 1 lần bằng key kế tiếp (§8.1).
      if (keys.length >= 2 && isRateLimited(row.error)) {
        pick = nextKey(keys, pick.index);
        row = await callTranslate(id, pick);
      }

      setKeyUsed((prev) => ({ ...prev, [id]: pick.index }));
      const label = keys.length >= 2 ? `${apiKeyLabel(pick.key, pick.index)}: ` : "";

      if ("id" in row) {
        const withKey =
          row.error && label ? ({ ...row, error: `${label}${row.error}` } as ChunkDTO) : row;
        setChunks((prev) => prev.map((c) => (c.id === id ? withKey : c)));
        return;
      }
      patchChunk(id, { status: "error", error: `${label}${row.error}` });
    },
    [callTranslate, patchChunk, takeKey]
  );

  const start = useCallback(async () => {
    if (needKey()) return;
    const ids = chunksRef.current
      .filter((c) => c.status === "pending" || c.status === "error")
      .map((c) => c.id);
    await runPool("translate", ids, translateOne);
  }, [needKey, runPool, translateOne]);

  const retryErrors = useCallback(async () => {
    const errored = chunksRef.current.filter((c) => c.status === "error");
    if (errored.length === 0) return;
    await Promise.all(
      errored.map((c) =>
        fetch(`/api/chunks/${c.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        })
      )
    );
    setChunks((prev) =>
      prev.map((c) => (c.status === "error" ? { ...c, status: "pending", error: null } : c))
    );
    await start();
  }, [start]);

  const retranslateOne = useCallback(
    async (id: string) => {
      if (needKey()) return;
      // Khoá nút ngay, đừng chờ round-trip DB — nếu không user bấm thêm lần nữa.
      patchChunk(id, { status: "translating", error: null, warning: null });
      await fetch(`/api/chunks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      await translateOne(id);
    },
    [needKey, patchChunk, translateOne]
  );

  const saveSource = useCallback(async (id: string, value: string) => {
    const res = await fetch(`/api/chunks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceOverride: value }),
    });
    if (!res.ok) return;
    const row: ChunkDTO = await res.json();
    setChunks((prev) => prev.map((c) => (c.id === id ? row : c)));
  }, []);

  const saveTranslated = useCallback(async (id: string, value: string) => {
    const res = await fetch(`/api/chunks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ translated: value }),
    });
    if (!res.ok) return;
    const row: ChunkDTO = await res.json();
    setChunks((prev) => prev.map((c) => (c.id === id ? row : c)));
  }, []);

  // ---------- Ngữ cảnh chung + tóm tắt section ----------

  const generateContext = useCallback(async () => {
    if (needKey()) return;
    const s = settingsRef.current;
    if (jobRef.current?.context) {
      const ok = await ask({
        title: "Tạo lại ngữ cảnh chung?",
        body: "Tạo lại sẽ ghi đè ngữ cảnh chung hiện có.",
        ok: "Tạo lại",
      });
      if (!ok) return;
    }
    setContextBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/context`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-llm-key": takeKey().key },
        body: JSON.stringify({
          endpoint: s.endpoint,
          model: s.model,
          temperature: s.temperature,
          contextMaxTokens: s.contextMaxTokens,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNotice(`Tạo ngữ cảnh chung thất bại: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setJob(data.job as JobDTO);
      setTruncated(Boolean(data.truncated));
    } catch (e) {
      setNotice(`Tạo ngữ cảnh chung thất bại: ${(e as Error).message}`);
    } finally {
      setContextBusy(false);
    }
  }, [ask, jobId, needKey]);

  const saveContext = useCallback(
    async (value: string) => {
      const res = await fetch(`/api/jobs/${jobId}/context`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: value }),
      });
      if (!res.ok) {
        setNotice("Lưu ngữ cảnh chung thất bại");
        return;
      }
      setJob((await res.json()) as JobDTO);
    },
    [jobId]
  );

  const patchSection = useCallback((id: string, patch: Partial<SectionDTO>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const callSummarize = useCallback(
    async (id: string, pick: KeyPick): Promise<SectionDTO | { error: string }> => {
      const s = settingsRef.current;
      try {
        const res = await fetch(`/api/sections/${id}/summarize`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-llm-key": pick.key },
          body: JSON.stringify({
            endpoint: s.endpoint,
            model: s.model,
            summaryPrompt: s.summaryPrompt,
            temperature: s.temperature,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` };
        return data as SectionDTO;
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    []
  );

  const summarizeOne = useCallback(
    async (id: string) => {
      const keys = settingsRef.current.apiKeys;
      patchSection(id, { status: "summarizing", error: null });

      let pick = takeKey();
      let row = await callSummarize(id, pick);
      if (keys.length >= 2 && isRateLimited(row.error)) {
        pick = nextKey(keys, pick.index);
        row = await callSummarize(id, pick);
      }

      setKeyUsed((prev) => ({ ...prev, [id]: pick.index }));
      const label = keys.length >= 2 ? `${apiKeyLabel(pick.key, pick.index)}: ` : "";

      if ("id" in row) {
        const withKey =
          row.error && label ? ({ ...row, error: `${label}${row.error}` } as SectionDTO) : row;
        setSections((prev) => prev.map((x) => (x.id === id ? withKey : x)));
        return;
      }
      patchSection(id, { status: "error", error: `${label}${row.error}` });
    },
    [callSummarize, patchSection, takeKey]
  );

  const startSummary = useCallback(async () => {
    if (needKey()) return;
    if (!jobRef.current?.context?.trim()) {
      setNotice("Chưa có ngữ cảnh chung — tạo tóm tắt chung trước.");
      return;
    }
    const ids = sectionsRef.current
      .filter((s) => s.status === "pending" || s.status === "error")
      .map((s) => s.id);
    await runPool("summary", ids, summarizeOne);
  }, [needKey, runPool, summarizeOne]);

  const retrySummaryErrors = useCallback(async () => {
    const errored = sectionsRef.current.filter((s) => s.status === "error");
    if (errored.length === 0) return;
    await Promise.all(
      errored.map((s) =>
        fetch(`/api/sections/${s.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "pending" }),
        })
      )
    );
    setSections((prev) =>
      prev.map((s) => (s.status === "error" ? { ...s, status: "pending", error: null } : s))
    );
    await startSummary();
  }, [startSummary]);

  const resummarizeOne = useCallback(
    async (id: string) => {
      if (needKey()) return;
      patchSection(id, { status: "summarizing", error: null });
      await fetch(`/api/sections/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      await summarizeOne(id);
    },
    [needKey, patchSection, summarizeOne]
  );

  const saveSummary = useCallback(async (id: string, value: string) => {
    const res = await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: value }),
    });
    if (!res.ok) return;
    const row: SectionDTO = await res.json();
    setSections((prev) => prev.map((s) => (s.id === id ? row : s)));
  }, []);

  const jumpToChunk = useCallback(
    (idx: number) => {
      const target = chunksRef.current.find((c) => c.idx === idx);
      if (!target) return;
      switchTab("translate");
      setSelectedId(target.id);
      requestAnimationFrame(() => {
        document.getElementById(`chunk-${idx}`)?.scrollIntoView({ block: "center" });
      });
    },
    [switchTab]
  );

  // ---------- Rechunk / resection ----------

  /** PATCH job rồi nhận lại bản mới — dùng chung cho rename, tag, pin, favorite, archive. */
  const patchJob = useCallback(
    async (body: Record<string, unknown>, failMsg: string) => {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setNotice(payload.error ?? failMsg);
        return;
      }
      setJob((await res.json()) as JobDTO);
    },
    [jobId]
  );

  const rename = useCallback(
    (name: string) => patchJob({ name }, "Đổi tên thất bại"),
    [patchJob]
  );

  const saveTags = useCallback(
    async (tags: string[]) => {
      await patchJob({ tags }, "Lưu tag thất bại");
      void reloadTags();
    },
    [patchJob, reloadTags]
  );

  const removeJob = useCallback(async () => {
    if (!jobRef.current) return;
    const okToDelete = await ask({
      title: "Xoá job?",
      body: `Xoá job "${jobRef.current.name}"? Toàn bộ chunk và section sẽ mất.`,
      ok: "Xoá job",
    });
    if (!okToDelete) return;
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    router.push("/");
  }, [ask, jobId, router]);

  const rechunk = useCallback(
    async (chunkTokens: number, confirmFirst: boolean) => {
      if (confirmFirst) {
        const ok = await ask({
          title: "Chunk lại tài liệu?",
          body: "Chunk lại sẽ xoá toàn bộ bản dịch và tóm tắt section của job này.",
          ok: "Chunk lại",
        });
        if (!ok) return;
      }
      pause();
      const res = await fetch(`/api/jobs/${jobId}/rechunk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chunkTokens }),
      });
      if (!res.ok) {
        setNotice("Chunk lại thất bại");
        return;
      }
      const data: { job: JobDTO; chunks: ChunkDTO[]; sections: SectionDTO[] } = await res.json();
      setJob(data.job);
      setChunks(data.chunks);
      setSections(data.sections ?? []);
      setNotice(`Đã chunk lại theo ${data.job.chunkTokens} token: ${data.chunks.length} chunk`);
    },
    [ask, jobId, pause]
  );

  const resection = useCallback(
    async (summaryTokens: number, confirmFirst: boolean) => {
      if (confirmFirst) {
        const ok = await ask({
          title: "Gom lại section?",
          body: "Gom lại section sẽ xoá toàn bộ tóm tắt section.",
          ok: "Gom lại",
        });
        if (!ok) return;
      }
      pause();
      const res = await fetch(`/api/jobs/${jobId}/resection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summaryTokens }),
      });
      if (!res.ok) {
        setNotice("Gom lại section thất bại");
        return;
      }
      const data: { job: JobDTO; sections: SectionDTO[] } = await res.json();
      setJob(data.job);
      setSections(data.sections ?? []);
      setNotice(`Đã gom lại theo ${data.job.summaryTokens} token: ${data.sections.length} section`);
    },
    [ask, jobId, pause]
  );

  // Đổi chunkTokens trong Settings: chưa dịch gì thì chunk lại luôn, có rồi thì hỏi.
  const tokensDiffer = Boolean(job && loaded && settings.chunkTokens !== job.chunkTokens);
  const hasTranslation = chunks.some((c) => c.status === "done");

  useEffect(() => {
    if (!tokensDiffer || hasTranslation || loop) return;
    void rechunk(settingsRef.current.chunkTokens, false);
  }, [tokensDiffer, hasTranslation, loop, rechunk]);

  // Tương tự cho summaryTokens: chưa tóm tắt gì thì gom lại luôn, có rồi thì hỏi.
  const summaryTokensDiffer = Boolean(job && loaded && settings.summaryTokens !== job.summaryTokens);
  const hasSummary = sections.some((s) => s.status === "done");

  useEffect(() => {
    if (!summaryTokensDiffer || hasSummary || loop) return;
    void resection(settingsRef.current.summaryTokens, false);
  }, [summaryTokensDiffer, hasSummary, loop, resection]);

  const stats = useMemo(() => {
    const total = chunks.length;
    const done = chunks.filter((c) => c.status === "done").length;
    const skipped = chunks.filter((c) => c.status === "skipped").length;
    const running = chunks.filter((c) => c.status === "translating").length;
    const errors = chunks.filter((c) => c.status === "error").length;
    const warnings = chunks.filter((c) => c.warning).length;
    const pending = chunks.filter((c) => c.status === "pending").length;
    return { total, done, skipped, running, errors, warnings, pending };
  }, [chunks]);

  const summaryStats = useMemo(() => {
    const total = sections.length;
    const done = sections.filter((s) => s.status === "done").length;
    const running = sections.filter((s) => s.status === "summarizing").length;
    const errors = sections.filter((s) => s.status === "error").length;
    const pending = sections.filter((s) => s.status === "pending").length;
    return { total, done, running, errors, pending };
  }, [sections]);

  const isTranslate = tab === "translate";

  const filters: FilterDef[] = isTranslate
    ? [
        { key: "all", label: "All", count: stats.total },
        { key: "error", label: "Error", count: stats.errors },
        { key: "warn", label: "Warning", count: stats.warnings },
        { key: "pending", label: "Pending", count: stats.pending },
        { key: "done", label: "Done", count: stats.done },
      ]
    : [
        { key: "all", label: "All", count: summaryStats.total },
        { key: "error", label: "Error", count: summaryStats.errors },
        { key: "pending", label: "Pending", count: summaryStats.pending },
        { key: "done", label: "Done", count: summaryStats.done },
      ];

  const visibleChunks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chunks.filter((c) => {
      if (filter === "error" && c.status !== "error") return false;
      if (filter === "warn" && !c.warning) return false;
      if (filter === "pending" && c.status !== "pending") return false;
      if (filter === "done" && c.status !== "done") return false;
      if (!q) return true;
      return `${c.sourceOverride ?? c.source}\n${c.translated ?? ""}`.toLowerCase().includes(q);
    });
  }, [chunks, filter, query]);

  const hasContext = Boolean(job?.context && job.context.trim());

  const exportMd = useMemo(() => (showExport ? assembleMarkdown(chunks) : ""), [showExport, chunks]);
  const summaryMd = useMemo(
    () => (showSummaryExport && job ? assembleSummary(job.context, sections) : ""),
    [showSummaryExport, job, sections]
  );

  if (!job) {
    return <main className="flex-1 p-6 text-sm text-sand-600">Đang tải…</main>;
  }

  const untranslated = chunks.filter((c) => c.status !== "done" && c.status !== "skipped").length;
  const base = job.name.replace(/\.md$/i, "");
  const archived = Boolean(job.archivedAt);
  const running = isTranslate ? loop === "translate" : loop === "summary";
  const doneCount = isTranslate ? stats.done : summaryStats.done;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar — một thẻ nổi, gom tên job, tab, số liệu và mọi nút hành động. */}
      <div className={`flex-none px-3 pt-3 lg:block lg:px-5 ${readMode ? "hidden" : ""}`}>
        <div className="flex flex-wrap items-center gap-2.5 rounded-3xl bg-white px-3 py-2.5 shadow-sm lg:gap-3.5 lg:px-4 lg:py-3">
          <Link href="/" title="Về danh sách job" className="text-base text-sand-600">
            ←
          </Link>
          <JobTitle name={job.name} onRename={rename} />

          <button
            onClick={() => patchJob({ favorite: !job.favorite }, "Lưu favorite thất bại")}
            title={job.favorite ? "Bỏ favorite" : "Đánh dấu favorite"}
            className={`h-8 w-8 rounded-pill text-base ${
              job.favorite ? "text-warn-icon" : "text-sand-400 hover:text-warn-icon"
            }`}
          >
            {job.favorite ? "★" : "☆"}
          </button>
          {!archived && (
            <button
              onClick={() => patchJob({ pinned: !job.pinnedAt }, "Lưu ghim thất bại")}
              title={job.pinnedAt ? "Bỏ ghim" : "Ghim lên đầu danh sách"}
              className={`h-8 w-8 rounded-pill text-base ${
                job.pinnedAt ? "opacity-100" : "opacity-35 hover:opacity-100"
              }`}
            >
              📌
            </button>
          )}

          {/* Hàng cuộn ngang ở mobile; từ md dùng `contents` nên layout desktop y như cũ. */}
          <div className="no-scrollbar flex w-full items-center gap-2.5 overflow-x-auto lg:contents">
          <TagEditor tags={job.tags} suggestions={allTags} onChange={saveTags} />

          <div className="flex shrink-0 rounded-pill bg-accent-100 p-[3px]">
            {(["translate", "summary"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`rounded-pill px-4 py-1.5 text-[13px] ${
                  tab === t ? "bg-accent text-white" : "text-accent-800"
                }`}
              >
                {t === "translate" ? "Translate" : "Summary"}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[12.5px] text-sand-700">
            {isTranslate ? (
              <>
                <span>
                  {stats.done + stats.skipped}/{stats.total} chunk xong
                </span>
                {stats.errors > 0 && <span className="text-danger-700">{stats.errors} lỗi</span>}
                {stats.warnings > 0 && <span className="text-warn-fg">{stats.warnings} cảnh báo</span>}
                {cooling && (
                  <span className="text-run-fg">đang nghỉ {settings.cooldownMs / 1000}s…</span>
                )}
              </>
            ) : (
              <>
                <span>
                  {summaryStats.done}/{summaryStats.total} section
                </span>
                {summaryStats.errors > 0 && (
                  <span className="text-danger-700">{summaryStats.errors} lỗi</span>
                )}
                {cooling && (
                  <span className="text-run-fg">đang nghỉ {settings.cooldownMs / 1000}s…</span>
                )}
              </>
            )}
          </div>

          </div>

          <span className="min-w-[8px] flex-1" />

          <div className={`action-dock no-scrollbar lg:flex ${readMode ? "hidden" : ""}`}>
            {/* Mở cột danh sách — dưới md nó là sheet nên mới cần nút; desktop luôn hiện. */}
            <button
              onClick={() => setListOpen(true)}
              className="btn btn-secondary lg:hidden"
            >
              Danh sách
            </button>

            {running ? (
              <button
                onClick={pause}
                className="btn btn-primary"
                style={{ background: "#b4741a" }}
              >
                Pause
              </button>
            ) : (
              <button
                onClick={isTranslate ? start : startSummary}
                disabled={
                  !loaded ||
                  loop !== null ||
                  (!isTranslate && (!hasContext || summaryStats.total === 0))
                }
                title={
                  loop !== null
                    ? "Vòng lặp khác đang chạy — Pause trước"
                    : !isTranslate && !hasContext
                      ? "Cần có ngữ cảnh chung trước"
                      : undefined
                }
                className="btn btn-primary"
              >
                {doneCount > 0 ? "Resume" : "Start"}
              </button>
            )}

            <button
              onClick={isTranslate ? retryErrors : retrySummaryErrors}
              disabled={
                (isTranslate ? stats.errors : summaryStats.errors) === 0 ||
                loop !== null ||
                (!isTranslate && !hasContext)
              }
              className="btn btn-secondary"
            >
              {isTranslate
                ? `Dịch lại lỗi (${stats.errors})`
                : `Tóm tắt lại lỗi (${summaryStats.errors})`}
            </button>

            {!isTranslate && (
              <button
                onClick={() => resection(settings.summaryTokens, hasSummary)}
                disabled={loop !== null || contextBusy}
                title="Xoá sections hiện tại và gom lại theo Section tokens trong Settings"
                className="btn btn-secondary"
              >
                Gom lại section
              </button>
            )}

            <button
              onClick={() => (isTranslate ? setShowExport(true) : setShowSummaryExport(true))}
              className="btn btn-secondary"
            >
              {isTranslate ? "Export" : "Export summary"}
            </button>

            <Menu
              dropUp
              items={[
                {
                  label: archived ? "Unarchive" : "Archive",
                  onClick: () =>
                    patchJob({ archived: !archived }, "Lưu trạng thái archive thất bại"),
                },
                { label: "Xoá job", onClick: removeJob, danger: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Thanh tiến độ ôm cột trái; chỗ trống bên phải để cụm chỉnh cỡ chữ khung đọc. */}
      <div
        className={`flex-none items-center gap-3 px-3 pt-2.5 lg:flex lg:px-5 ${
          readMode ? "hidden" : "flex"
        }`}
      >
        {isTranslate ? (
          <ProgressBar
            done={stats.done}
            running={stats.running}
            errors={stats.errors}
            skipped={stats.skipped}
            total={stats.total}
          />
        ) : (
          <ProgressBar
            done={summaryStats.done}
            running={summaryStats.running}
            errors={summaryStats.errors}
            skipped={0}
            total={summaryStats.total}
          />
        )}
        <span className="flex-1" />
        <ReadingSizeControl />
      </div>

      <div className="flex flex-none flex-col gap-2 px-3 pt-2.5 empty:hidden lg:px-5">
        {archived && (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 rounded-[18px] bg-idle-bg px-3.5 py-2.5 text-[12.5px] text-idle-fg">
            <span className="flex-1">
              Job này đang ở archive — không hiện ở danh sách mặc định. Mọi thao tác vẫn chạy bình
              thường.
            </span>
            <button
              onClick={() => patchJob({ archived: false }, "Unarchive thất bại")}
              className="btn btn-secondary btn-sm h-[30px] bg-white"
            >
              Unarchive
            </button>
          </div>
        )}

        {tokensDiffer && hasTranslation && !dismissed.chunk && (
          <Banner
            tone="warn"
            action={`Chunk lại theo ${settings.chunkTokens}`}
            onAction={() => rechunk(settings.chunkTokens, true)}
            note="(mất toàn bộ bản dịch hiện có)"
            onClose={() => setDismissed((d) => ({ ...d, chunk: true }))}
          >
            Settings để chunk {settings.chunkTokens} token, job này đang chunk theo {job.chunkTokens}.
          </Banner>
        )}

        {summaryTokensDiffer && hasSummary && !dismissed.section && (
          <Banner
            tone="warn"
            action={`Gom lại theo ${settings.summaryTokens}`}
            onAction={() => resection(settings.summaryTokens, true)}
            note="(mất toàn bộ tóm tắt section)"
            onClose={() => setDismissed((d) => ({ ...d, section: true }))}
          >
            Settings để section {settings.summaryTokens} token, job này đang gom theo{" "}
            {job.summaryTokens}.
          </Banner>
        )}

        {isTranslate && settings.useContextForTranslation && !hasContext && !dismissed.ctx && (
          <Banner
            tone="idle"
            action="Sang tab Summary"
            onAction={() => switchTab("summary")}
            onClose={() => setDismissed((d) => ({ ...d, ctx: true }))}
          >
            Toggle “Dùng ngữ cảnh chung” đang bật nhưng job này <strong>chưa có ngữ cảnh chung</strong>{" "}
            — dịch vẫn chạy bình thường. Tạo ở tab Summary.
          </Banner>
        )}

        {notice && (
          <Banner tone="info" onClose={() => setNotice(null)}>
            {notice}
          </Banner>
        )}
      </div>

      {isTranslate ? (
        <div className="flex min-h-0 flex-1 gap-3 lg:px-5 lg:pb-4 lg:pt-3">
          {/* Mobile không padding — khung đọc trải hết bề ngang; chỗ chừa cho thanh
              nút đáy nằm trong chính khung đọc (`.reading-pane` có pb-20). */}
          <ListPanel
            open={listOpen}
            onClose={() => setListOpen(false)}
            query={query}
            onQuery={setQuery}
            filters={filters}
            filter={filter}
            onFilter={setFilter}
            empty={
              chunks.length === 0
                ? "Job này chưa có chunk nào."
                : visibleChunks.length === 0
                  ? "Không có thẻ nào khớp bộ lọc."
                  : null
            }
          >
            {visibleChunks.map((c) => (
              <div key={c.id} id={`chunk-${c.idx}`} className="shrink-0">
                <ChunkBar
                  chunk={c}
                  keyIndex={keyUsed[c.id]}
                  expanded={selectedId === c.id}
                  onToggle={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                  onSaveSource={saveSource}
                  onSaveTranslated={saveTranslated}
                  onRetranslate={retranslateOne}
                />
              </div>
            ))}
          </ListPanel>

          <div className="min-w-0 flex-1">
            <Preview
              chunks={chunks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              readOnly={readMode}
            />
          </div>
        </div>
      ) : (
        <SummaryView
          readMode={readMode}
          listOpen={listOpen}
          onCloseList={() => setListOpen(false)}
          job={job}
          chunks={chunks}
          sections={sections}
          running={loop === "summary"}
          otherLoopRunning={loop === "translate"}
          contextBusy={contextBusy}
          truncated={truncated}
          selectedId={selectedSectionId}
          onSelect={setSelectedSectionId}
          keyUsed={keyUsed}
          query={query}
          onQuery={setQuery}
          filters={filters}
          filter={filter}
          onFilter={setFilter}
          onGenerateContext={generateContext}
          onSaveContext={saveContext}
          onResection={() => resection(settings.summaryTokens, hasSummary)}
          onSaveSummary={saveSummary}
          onResummarize={resummarizeOne}
          onJumpToChunk={jumpToChunk}
        />
      )}

      {showExport && (
        <ExportModal
          title="Export"
          text={exportMd}
          href={`/api/jobs/${job.id}/export`}
          filename={`${base}.vi.md`}
          note={untranslated > 0 ? `${untranslated} chunk chưa dịch → giữ source gốc + marker` : null}
          onClose={() => setShowExport(false)}
        />
      )}

      {showSummaryExport && (
        <ExportModal
          title="Export summary"
          text={summaryMd}
          href={`/api/jobs/${job.id}/export-summary`}
          filename={`${base}.summary.md`}
          note={
            summaryStats.done < summaryStats.total
              ? `${summaryStats.total - summaryStats.done} section chưa tóm tắt`
              : null
          }
          onClose={() => setShowSummaryExport(false)}
        />
      )}

      {dialog}
    </main>
  );
}
