"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ChunkBar from "./ChunkBar";
import JobTitle from "./JobTitle";
import Preview from "./Preview";
import ExportModal from "./ExportModal";
import { useSettings } from "@/lib/useSettings";
import type { ChunkDTO, JobDTO } from "@/lib/types";

export default function JobView({ jobId }: { jobId: string }) {
  const { settings, loaded } = useSettings();
  const [job, setJob] = useState<JobDTO | null>(null);
  const [chunks, setChunks] = useState<ChunkDTO[]>([]);
  const [running, setRunning] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runRef = useRef(false);
  const chunksRef = useRef<ChunkDTO[]>([]);
  chunksRef.current = chunks;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) {
      setNotice("Không tải được job");
      return;
    }
    const data: { job: JobDTO; chunks: ChunkDTO[] } = await res.json();
    setJob(data.job);
    setChunks(data.chunks);
  }, [jobId]);

  useEffect(() => {
    void load();
    return () => {
      runRef.current = false;
    };
  }, [load]);

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
    if (runRef.current) return;
    if (!settingsRef.current.apiKey) {
      setNotice("Chưa có API key — mở Settings trên thanh trên cùng để nhập.");
      return;
    }
    setNotice(null);
    runRef.current = true;
    setRunning(true);

    const queue = chunksRef.current
      .filter((c) => c.status === "pending" || c.status === "error")
      .map((c) => c.id);

    let cursor = 0;
    const pool = Math.min(6, Math.max(1, settingsRef.current.concurrency));
    const workers = Array.from({ length: pool }, async () => {
      while (runRef.current && cursor < queue.length) {
        const id = queue[cursor++];
        await translateOne(id);
      }
    });

    await Promise.all(workers);
    runRef.current = false;
    setRunning(false);
  }, [translateOne]);

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
      const updated: JobDTO = await res.json();
      setJob(updated);
    },
    [jobId]
  );

  const pause = useCallback(() => {
    runRef.current = false;
    setRunning(false);
  }, []);

  const rechunk = useCallback(
    async (chunkTokens: number, ask: boolean) => {
      if (ask && !confirm("Chunk lại sẽ XOÁ toàn bộ bản dịch của job này. Tiếp tục?")) return;
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
      const data: { job: JobDTO; chunks: ChunkDTO[] } = await res.json();
      setJob(data.job);
      setChunks(data.chunks);
      setNotice(`Đã chunk lại theo ${data.job.chunkTokens} token: ${data.chunks.length} chunk`);
    },
    [jobId, pause]
  );

  // Đổi chunkTokens trong Settings: chưa dịch gì thì chunk lại luôn, có rồi thì hỏi.
  const tokensDiffer = Boolean(job && loaded && settings.chunkTokens !== job.chunkTokens);
  const hasTranslation = chunks.some((c) => c.status === "done");

  useEffect(() => {
    if (!tokensDiffer || hasTranslation || running) return;
    void rechunk(settingsRef.current.chunkTokens, false);
  }, [tokensDiffer, hasTranslation, running, rechunk]);

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

  const retranslateOne = useCallback(
    async (id: string) => {
      if (!settingsRef.current.apiKey) {
        setNotice("Chưa có API key — mở Settings trên thanh trên cùng để nhập.");
        return;
      }
      // Khoá nút ngay, đừng chờ round-trip DB — nếu không user bấm thêm lần nữa.
      patchChunk(id, { status: "translating", error: null, warning: null });
      await fetch(`/api/chunks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      await translateOne(id);
    },
    [patchChunk, translateOne]
  );

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

  const stats = useMemo(() => {
    const total = chunks.length;
    const done = chunks.filter((c) => c.status === "done" || c.status === "skipped").length;
    const errors = chunks.filter((c) => c.status === "error").length;
    const warnings = chunks.filter((c) => c.warning).length;
    return { total, done, errors, warnings };
  }, [chunks]);

  const host = useMemo(() => {
    try {
      return new URL(settings.endpoint).host;
    } catch {
      return settings.endpoint;
    }
  }, [settings.endpoint]);

  if (!job) {
    return <main className="p-6 text-sm text-neutral-500">Đang tải…</main>;
  }

  return (
    <main className="flex h-[calc(100vh-2.75rem)] w-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-300 px-4 py-2.5 dark:border-neutral-700">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ←
        </Link>
        <JobTitle name={job.name} onRename={rename} />
        <span className="text-sm text-neutral-500">
          {stats.done}/{stats.total} xong
          {stats.errors > 0 && <span className="ml-2 text-red-600">{stats.errors} lỗi</span>}
          {stats.warnings > 0 && <span className="ml-2 text-yellow-600">{stats.warnings} cảnh báo</span>}
        </span>
        <span
          title={`Sẽ gọi: ${settings.endpoint}/chat/completions`}
          className="rounded bg-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {settings.model} · {host}
        </span>

        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          {running ? (
            <button onClick={pause} className="rounded bg-amber-600 px-3 py-1.5 text-white">
              Pause
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!loaded}
              className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-40"
            >
              {stats.done > 0 ? "Resume" : "Start"}
            </button>
          )}
          <button
            onClick={retryErrors}
            disabled={stats.errors === 0 || running}
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

      {notice && (
        <p className="mx-4 mb-2 shrink-0 rounded bg-blue-100 p-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {notice}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(260px,25%)_1fr]">
        <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
          {chunks.map((c) => (
            <ChunkBar
              key={c.id}
              chunk={c}
              expanded={selectedId === c.id}
              onToggle={(id) => setSelectedId((cur) => (cur === id ? null : id))}
              onSaveSource={saveSource}
              onSaveTranslated={saveTranslated}
              onRetranslate={retranslateOne}
            />
          ))}
        </div>

        <div className="min-h-0">
          <Preview chunks={chunks} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {showExport && (
        <ExportModal jobId={job.id} name={job.name} chunks={chunks} onClose={() => setShowExport(false)} />
      )}
    </main>
  );
}
