"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ChunkBar from "./ChunkBar";
import JobTitle from "./JobTitle";
import Preview from "./Preview";
import ExportModal from "./ExportModal";
import SummaryView from "./SummaryView";
import { useConfirm } from "./ConfirmDialog";
import { Banner, ListPanel, ProgressBar, type FilterDef } from "./chrome";
import { useSettings } from "@/lib/useSettings";
import { assembleMarkdown, assembleSummary } from "@/lib/assemble";
import type { ChunkDTO, JobDTO, SectionDTO } from "@/lib/types";

type Tab = "translate" | "summary";
type Loop = "translate" | "summary";

export default function JobView({ jobId }: { jobId: string }) {
  const { settings, loaded } = useSettings();
  const { ask, dialog } = useConfirm();
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
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

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
    if (settingsRef.current.apiKey) return false;
    setNotice("Chưa có API key — mở Settings trên thanh trên cùng để nhập.");
    return true;
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
    await Promise.all(
      Array.from({ length: pool }, async () => {
        while (runRef.current === kind && cursor < ids.length) {
          await one(ids[cursor++]);
        }
      })
    );

    runRef.current = null;
    setLoop(null);
  }, []);

  const pause = useCallback(() => {
    runRef.current = null;
    setLoop(null);
  }, []);

  // ---------- Dịch ----------

  const patchChunk = useCallback((id: string, patch: Partial<ChunkDTO>) => {
    setChunks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  /** 1 API call = 1 chunk, dùng đúng cấu hình trong Settings. Server không loop. */
  const translateOne = useCallback(
    async (id: string) => {
      const s = settingsRef.current;
      patchChunk(id, { status: "translating", error: null });
      try {
        const res = await fetch(`/api/chunks/${id}/translate`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-llm-key": s.apiKey },
          body: JSON.stringify({
            endpoint: s.endpoint,
            model: s.model,
            systemPrompt: s.systemPrompt,
            temperature: s.temperature,
            useContext: s.useContextForTranslation,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          patchChunk(id, { status: "error", error: data.error ?? `HTTP ${res.status}` });
          return;
        }
        setChunks((prev) => prev.map((c) => (c.id === id ? (data as ChunkDTO) : c)));
      } catch (e) {
        patchChunk(id, { status: "error", error: (e as Error).message });
      }
    },
    [patchChunk]
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
        headers: { "content-type": "application/json", "x-llm-key": s.apiKey },
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

  const summarizeOne = useCallback(
    async (id: string) => {
      const s = settingsRef.current;
      patchSection(id, { status: "summarizing", error: null });
      try {
        const res = await fetch(`/api/sections/${id}/summarize`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-llm-key": s.apiKey },
          body: JSON.stringify({
            endpoint: s.endpoint,
            model: s.model,
            summaryPrompt: s.summaryPrompt,
            temperature: s.temperature,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          patchSection(id, { status: "error", error: data.error ?? `HTTP ${res.status}` });
          return;
        }
        setSections((prev) => prev.map((x) => (x.id === id ? (data as SectionDTO) : x)));
      } catch (e) {
        patchSection(id, { status: "error", error: (e as Error).message });
      }
    },
    [patchSection]
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

  const rename = useCallback(
    async (name: string) => {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setNotice("Đổi tên thất bại");
        return;
      }
      setJob((await res.json()) as JobDTO);
    },
    [jobId]
  );

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
  const running = isTranslate ? loop === "translate" : loop === "summary";
  const doneCount = isTranslate ? stats.done : summaryStats.done;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar — một thẻ nổi, gom tên job, tab, số liệu và mọi nút hành động. */}
      <div className="flex-none px-5 pt-3">
        <div className="flex flex-wrap items-center gap-3.5 rounded-3xl bg-white px-4 py-3 shadow-sm">
          <Link href="/" title="Về danh sách job" className="text-base text-sand-600">
            ←
          </Link>
          <JobTitle name={job.name} onRename={rename} />

          <div className="flex rounded-pill bg-accent-100 p-[3px]">
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

          <div className="flex items-center gap-3 text-[12.5px] text-sand-700">
            {isTranslate ? (
              <>
                <span>
                  {stats.done + stats.skipped}/{stats.total} chunk xong
                </span>
                {stats.errors > 0 && <span className="text-danger-700">{stats.errors} lỗi</span>}
                {stats.warnings > 0 && <span className="text-warn-fg">{stats.warnings} cảnh báo</span>}
              </>
            ) : (
              <>
                <span>
                  {summaryStats.done}/{summaryStats.total} section
                </span>
                {summaryStats.errors > 0 && (
                  <span className="text-danger-700">{summaryStats.errors} lỗi</span>
                )}
              </>
            )}
          </div>

          <span className="min-w-[8px] flex-1" />

          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <button
                onClick={pause}
                className="btn btn-primary h-9 py-0"
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
                className="btn btn-primary h-9 py-0"
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
              className="btn btn-secondary h-9 py-0"
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
                className="btn btn-secondary h-9 py-0"
              >
                Gom lại section
              </button>
            )}

            <button
              onClick={() => (isTranslate ? setShowExport(true) : setShowSummaryExport(true))}
              className="btn btn-secondary h-9 py-0"
            >
              {isTranslate ? "Export" : "Export summary"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-2.5">
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
      </div>

      <div className="flex flex-none flex-col gap-2 px-5 pt-2.5 empty:hidden">
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
        <div className="flex min-h-0 flex-1 gap-3 px-5 pb-4 pt-3">
          <ListPanel
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
            <Preview chunks={chunks} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      ) : (
        <SummaryView
          job={job}
          chunks={chunks}
          sections={sections}
          running={loop === "summary"}
          otherLoopRunning={loop === "translate"}
          contextBusy={contextBusy}
          truncated={truncated}
          selectedId={selectedSectionId}
          onSelect={setSelectedSectionId}
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
