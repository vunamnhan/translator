"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_UPLOAD_BYTES } from "@/lib/defaults";
import { useSettings } from "@/lib/useSettings";
import { useConfirm } from "./ConfirmDialog";
import type { JobListItem } from "@/lib/types";

export default function JobList() {
  const router = useRouter();
  const { settings, loaded } = useSettings();
  const { ask, dialog } = useConfirm();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/jobs");
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createJob(name: string, source: string) {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          source,
          systemPrompt: settings.systemPrompt,
          model: settings.model,
          endpoint: settings.endpoint,
          chunkTokens: settings.chunkTokens,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tạo job thất bại");
      router.push(`/job/${data.job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function takeFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File vượt quá 2 MB");
      return;
    }
    await createJob(file.name, await file.text());
  }

  async function remove(id: string, name: string) {
    const ok = await ask({
      title: "Xoá job?",
      body: `Xoá job "${name}"? Toàn bộ chunk sẽ mất.`,
      ok: "Xoá job",
    });
    if (!ok) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    void load();
  }

  const withErrors = jobs.filter((j) => j.errors > 0).length;

  return (
    <>
      <div className="mt-5 flex items-center gap-2.5">
        <button onClick={() => setShowNew((v) => !v)} className="btn btn-primary h-10">
          ＋ New job
        </button>
        <span className="text-[12.5px] text-sand-600">
          {jobs.length} job{withErrors > 0 && ` · ${withErrors} job có lỗi`}
        </span>
      </div>

      {showNew && (
        <div className="mt-4 grid animate-tz-pop grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[18px] rounded-[26px] bg-white p-[22px] shadow-md">
          <div>
            <div className="mb-2 font-heading text-base">Upload file .md</div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void takeFile(e.dataTransfer.files?.[0]);
              }}
              className={`grid h-[118px] cursor-pointer place-items-center gap-1.5 rounded-[20px] border-[1.5px] border-dashed text-[13px] text-accent-700 transition-colors ${
                dragging ? "border-accent bg-accent-200" : "border-accent-300 bg-accent-100"
              }`}
            >
              <span>Kéo file vào đây hoặc bấm để chọn</span>
              <span className="text-[11.5px] text-sand-600">.md · tối đa 2 MB</span>
              <input
                type="file"
                accept=".md,.markdown,text/markdown"
                disabled={busy}
                onChange={(e) => void takeFile(e.target.files?.[0])}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 font-heading text-base">Hoặc paste text</div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="# Markdown here"
              className="textarea h-[118px] resize-none rounded-[20px]"
            />
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={() => createJob("pasted.md", paste)}
                disabled={busy || paste.trim().length === 0}
                className="btn btn-secondary h-[34px] py-0"
              >
                Tạo job từ text
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger-ink">
          {error}
        </p>
      )}

      <div className="mt-[22px] rounded-[26px] bg-white px-[18px] pb-3.5 pt-2 shadow-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Ngày</th>
              <th className="w-[34%]">Tiến độ</th>
              <th className="text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const pct = (n: number) => (j.total > 0 ? `${(n / j.total) * 100}%` : "0%");
              return (
                <tr key={j.id}>
                  <td className="font-semibold">{j.name}</td>
                  <td className="text-[13px] text-sand-600">
                    {new Date(j.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-[7px] max-w-[170px] flex-1 overflow-hidden rounded-pill bg-accent-100">
                        <div style={{ width: pct(j.done) }} className="bg-accent-500" />
                        <div style={{ width: pct(j.errors) }} className="bg-danger-bar" />
                      </div>
                      <span className="font-mono text-xs">
                        {j.done}/{j.total}
                      </span>
                      {j.errors > 0 && (
                        <span className="text-[11.5px] text-danger-700">{j.errors} lỗi</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <a href={`/job/${j.id}`}>Mở</a>
                    <span className="mx-2 text-sand-400">·</span>
                    <button onClick={() => remove(j.id, j.name)} className="text-danger-700 hover:underline">
                      Xoá
                    </button>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sand-600">
                  Chưa có job nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog}
    </>
  );
}
