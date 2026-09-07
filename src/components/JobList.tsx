"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_UPLOAD_BYTES } from "@/lib/defaults";
import { useSettings } from "@/lib/useSettings";
import type { JobListItem } from "@/lib/types";

export default function JobList() {
  const router = useRouter();
  const { settings, loaded } = useSettings();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [showNew, setShowNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File vượt quá 2 MB");
      return;
    }
    const text = await file.text();
    await createJob(file.name, text);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Xoá job "${name}"? Toàn bộ chunk sẽ mất.`)) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          New job
        </button>
      </div>

      {showNew && (
        <div className="space-y-3 rounded border border-neutral-300 p-4 dark:border-neutral-700">
          <div>
            <label className="mb-1 block text-sm font-medium">Upload file .md</label>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={onFile}
              disabled={busy}
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Hoặc paste text</label>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder="# Markdown here"
              className="w-full rounded border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700"
            />
            <button
              onClick={() => createJob("pasted.md", paste)}
              disabled={busy || paste.trim().length === 0}
              className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-neutral-200 dark:text-neutral-900"
            >
              Tạo job từ text
            </button>
          </div>
        </div>
      )}

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-300 dark:border-neutral-700">
            <th className="py-2">Tên</th>
            <th>Ngày</th>
            <th>Tiến độ</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-neutral-200 dark:border-neutral-800">
              <td className="py-2 font-medium">{j.name}</td>
              <td className="text-neutral-500">{new Date(j.createdAt).toLocaleString("vi-VN")}</td>
              <td>
                {j.done}/{j.total}
                {j.errors > 0 && <span className="ml-2 text-red-600">{j.errors} lỗi</span>}
              </td>
              <td className="py-2 text-right">
                <a href={`/job/${j.id}`} className="mr-3 text-blue-600 hover:underline">
                  Mở
                </a>
                <button onClick={() => remove(j.id, j.name)} className="text-red-600 hover:underline">
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-neutral-500">
                Chưa có job nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
