"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ChunkBar from "./ChunkBar";
import JobTitle from "./JobTitle";
import Preview from "./Preview";
import ExportModal from "./ExportModal";
import SummaryView from "./SummaryView";
import { useSettings } from "@/lib/useSettings";
import { assembleMarkdown, assembleSummary } from "@/lib/assemble";
import type { ChunkDTO, JobDTO, SectionDTO } from "@/lib/types";

type Tab = "translate" | "summary";
type Loop = "translate" | "summary";

export default function JobView({ jobId }: { jobId: string }) {
  const { settings, loaded } = useSettings();
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
    if (jobRef.current?.context && !confirm("Tạo lại sẽ ghi đè ngữ cảnh chung hiện có. Tiếp tục?")) {
      return;
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
  }, [jobId, needKey]);

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
      setTab("translate");
      setSelectedId(target.id);
      requestAnimationFrame(() => {
        document.getElementById(`chunk-${idx}`)?.scrollIntoView({ block: "center" });
      });
    },
    []
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
    async (chunkTokens: number, ask: boolean) => {
      if (ask && !confirm("Chunk lại sẽ XOÁ toàn bộ bản dịch và tóm tắt section của job này. Tiếp tục?"))
        return;
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
    [jobId, pause]
  );

  const resection = useCallback(
    async (summaryTokens: number, ask: boolean) => {
      if (ask && !confirm("Gom lại section sẽ XOÁ toàn bộ tóm tắt section. Tiếp tục?")) return;
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
    [jobId, pause]
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
    const done = chunks.filter((c) => c.status === "done" || c.status === "skipped").length;
    const errors = chunks.filter((c) => c.status === "error").length;
    const warnings = chunks.filter((c) => c.warning).length;
    return { total, done, errors, warnings };
  }, [chunks]);

  const summaryStats = useMemo(() => {
    const total = sections.length;
    const done = sections.filter((s) => s.status === "done").length;
    const errors = sections.filter((s) => s.status === "error").length;
    return { total, done, errors };
  }, [sections]);

  const hasContext = Boolean(job?.context && job.context.trim());

  const host = useMemo(() => {
    try {
      return new URL(settings.endpoint).host;
    } catch {
      return settings.endpoint;
    }
  }, [settings.endpoint]);

  const exportMd = useMemo(() => (showExport ? assembleMarkdown(chunks) : ""), [showExport, chunks]);
  const summaryMd = useMemo(
    () => (showSummaryExport && job ? assembleSummary(job.context, sections) : ""),
    [showSummaryExport, job, sections]
  );

  if (!job) {
    return <main className="p-6 text-sm text-neutral-500">Đang tải…</main>;
  }

  const untranslated = chunks.filter((c) => c.status !== "done" && c.status !== "skipped").length;
  const base = job.name.replace(/\.md$/i, "");

  return (
    <main className="flex h-[calc(100vh-2.75rem)] w-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-300 px-4 py-2.5 dark:border-neutral-700">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ←
        </Link>
        <JobTitle name={job.name} onRename={rename} />

        <div className="flex items-center gap-1 rounded border border-neutral-300 p-0.5 text-sm dark:border-neutral-700">
          <button
            onClick={() => setTab("translate")}
            className={`rounded px-3 py-1 ${
              tab === "translate" ? "bg-blue-600 text-white" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            Translate
          </button>
          <button
            onClick={() => setTab("summary")}
            className={`rounded px-3 py-1 ${
              tab === "summary" ? "bg-blue-600 text-white" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            Summary
          </button>
        </div>

        <span className="text-sm text-neutral-500">
          {tab === "translate" ? (
            <>
              {stats.done}/{stats.total} xong
              {stats.errors > 0 && <span className="ml-2 text-red-600">{stats.errors} lỗi</span>}
              {stats.warnings > 0 && (
                <span className="ml-2 text-yellow-600">{stats.warnings} cảnh báo</span>
              )}
            </>
          ) : (
            <>
              {summaryStats.done}/{summaryStats.total} section
              {summaryStats.errors > 0 && (
                <span className="ml-2 text-red-600">{summaryStats.errors} lỗi</span>
              )}
            </>
          )}
        </span>
        <span
          title={`Sẽ gọi: ${settings.endpoint}/chat/completions`}
          className="rounded bg-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {settings.model} · {host}
        </span>

        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          {tab === "translate" ? (
            <>
              {loop === "translate" ? (
                <button onClick={pause} className="rounded bg-amber-600 px-3 py-1.5 text-white">
                  Pause
                </button>
              ) : (
                <button
                  onClick={start}
                  disabled={!loaded || loop !== null}
                  className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-40"
                >
                  {stats.done > 0 ? "Resume" : "Start"}
                </button>
              )}
              <button
                onClick={retryErrors}
                disabled={stats.errors === 0 || loop !== null}
                className="rounded border border-neutral-400 px-3 py-1.5 disabled:opacity-40"
              >
                Dịch lại lỗi ({stats.errors})
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="rounded border border-neutral-400 px-3 py-1.5"
              >
                Export
              </button>
            </>
          ) : (
            <>
              {loop === "summary" ? (
                <button onClick={pause} className="rounded bg-amber-600 px-3 py-1.5 text-white">
                  Pause
                </button>
              ) : (
                <button
                  onClick={startSummary}
                  disabled={!loaded || loop !== null || !hasContext || summaryStats.total === 0}
                  title={hasContext ? undefined : "Cần có ngữ cảnh chung trước"}
                  className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-40"
                >
                  {summaryStats.done > 0 ? "Resume" : "Start"}
                </button>
              )}
              <button
                onClick={retrySummaryErrors}
                disabled={summaryStats.errors === 0 || loop !== null || !hasContext}
                className="rounded border border-neutral-400 px-3 py-1.5 disabled:opacity-40"
              >
                Tóm tắt lại lỗi ({summaryStats.errors})
              </button>
              <button
                onClick={() => resection(settings.summaryTokens, hasSummary)}
                disabled={loop !== null || contextBusy}
                title="Xoá sections hiện tại và gom lại theo Section tokens trong Settings"
                className="rounded border border-neutral-400 px-3 py-1.5 disabled:opacity-40"
              >
                Gom lại section
              </button>
              <button
                onClick={() => setShowSummaryExport(true)}
                className="rounded border border-neutral-400 px-3 py-1.5"
              >
                Export summary
              </button>
            </>
          )}
        </div>
      </header>

      {tokensDiffer && hasTranslation && (
        <div className="mx-4 mb-2 flex shrink-0 flex-wrap items-center gap-3 rounded bg-yellow-100 p-2 text-sm text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <span>
            Settings để chunk {settings.chunkTokens} token, job này đang chunk theo {job.chunkTokens}.
          </span>
          <button
            onClick={() => rechunk(settings.chunkTokens, true)}
            className="rounded bg-yellow-700 px-3 py-1 text-white"
          >
            Chunk lại theo {settings.chunkTokens}
          </button>
          <span className="text-xs">(mất toàn bộ bản dịch hiện có)</span>
        </div>
      )}

      {summaryTokensDiffer && hasSummary && (
        <div className="mx-4 mb-2 flex shrink-0 flex-wrap items-center gap-3 rounded bg-yellow-100 p-2 text-sm text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <span>
            Settings để section {settings.summaryTokens} token, job này đang gom theo{" "}
            {job.summaryTokens}.
          </span>
          <button
            onClick={() => resection(settings.summaryTokens, true)}
            className="rounded bg-yellow-700 px-3 py-1 text-white"
          >
            Gom lại theo {settings.summaryTokens}
          </button>
          <span className="text-xs">(mất toàn bộ tóm tắt section)</span>
        </div>
      )}

      {tab === "translate" && settings.useContextForTranslation && !job.context?.trim() && (
        <p className="mx-4 mb-2 shrink-0 rounded bg-neutral-100 p-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Toggle “Dùng ngữ cảnh chung” đang bật nhưng job này <strong>chưa có ngữ cảnh chung</strong> —
          dịch vẫn chạy bình thường. Tạo ở tab{" "}
          <button onClick={() => setTab("summary")} className="text-blue-600 hover:underline">
            Summary
          </button>
          .
        </p>
      )}

      {notice && (
        <p className="mx-4 mb-2 shrink-0 rounded bg-blue-100 p-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {notice}
        </p>
      )}

      {tab === "translate" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(260px,25%)_1fr]">
          <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {chunks.map((c) => (
              <div key={c.id} id={`chunk-${c.idx}`}>
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
          </div>

          <div className="min-h-0">
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
    </main>
  );
}
