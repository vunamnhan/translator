"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JobRow from "./JobRow";
import TagFilter from "./TagFilter";
import { useConfirm } from "./ConfirmDialog";
import { MAX_UPLOAD_BYTES } from "@/lib/defaults";
import { useSettings } from "@/lib/useSettings";
import { useTags } from "@/lib/useTags";
import type { JobListItem, JobListResponse } from "@/lib/types";

const PAGE_SIZE = 20;
type ArchiveMode = "hide" | "include" | "only";

/** Trang danh sách job (CR v0.2): search + lọc tag + favorite + archive + phân trang. */
export default function JobList() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, loaded } = useSettings();
  const { tags, reload: reloadTags } = useTags();
  const { ask, dialog } = useConfirm();

  // Toàn bộ trạng thái lọc nằm trên URL để F5 / share link giữ nguyên (mục 2.6).
  const q = params.get("q") ?? "";
  const selectedTags = useMemo(
    () => (params.get("tags") ?? "").split(",").filter(Boolean),
    [params]
  );
  const fav = params.get("fav") === "1";
  // API còn hỗ trợ "only" (dùng cho câu đếm ở trạng thái trống), UI chỉ bật/tắt "include".
  const archiveMode: ArchiveMode = params.get("archived") === "include" ? "include" : "hide";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [data, setData] = useState<JobListResponse>({
    items: [],
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
  });
  const [archivedHits, setArchivedHits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Ô search gõ tới đâu hiện tới đó, 300ms sau mới đẩy lên URL.
  const [needle, setNeedle] = useState(q);
  useEffect(() => setNeedle(q), [q]);

  const hasFilter = Boolean(q || selectedTags.length > 0 || fav || archiveMode !== "hide");

  const query = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      // Đổi bộ lọc → về trang 1 (mục 2.6).
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [params, router]
  );

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (selectedTags.length > 0) sp.set("tags", selectedTags.join(","));
    if (fav) sp.set("fav", "1");
    if (archiveMode !== "hide") sp.set("archived", archiveMode);
    sp.set("page", String(page));
    sp.set("limit", String(PAGE_SIZE));
    return `/api/jobs?${sp.toString()}`;
  }, [q, selectedTags, fav, archiveMode, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl);
      if (res.ok) setData((await res.json()) as JobListResponse);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  // Đang ẩn archive mà không có kết quả → đếm xem trong archive có gì khớp không (mục 5.1).
  useEffect(() => {
    if (loading || archiveMode !== "hide" || data.total > 0 || !hasFilter) {
      setArchivedHits(0);
      return;
    }
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (selectedTags.length > 0) sp.set("tags", selectedTags.join(","));
    sp.set("archived", "only");
    sp.set("limit", "1");
    let cancelled = false;
    void fetch(`/api/jobs?${sp.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: JobListResponse | null) => {
        if (!cancelled) setArchivedHits(d?.total ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, archiveMode, data.total, hasFilter, q, selectedTags]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onNeedle(v: string) {
    setNeedle(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => query({ q: v.slice(0, 100) }), 300);
  }

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
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Tạo job thất bại");
      router.push(`/job/${payload.job.id}`);
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

  const patchJob = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "Cập nhật job thất bại");
        return;
      }
      setError(null);
      await load();
    },
    [load]
  );

  async function remove(job: JobListItem) {
    const okToDelete = await ask({
      title: "Xoá job?",
      body: `Xoá job "${job.name}"? Toàn bộ chunk và section sẽ mất.`,
      ok: "Xoá job",
    });
    if (!okToDelete) return;
    await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    void load();
    void reloadTags();
  }

  function pickTag(tag: string) {
    const key = tag.toLowerCase();
    if (selectedTags.some((t) => t.toLowerCase() === key)) return;
    query({ tags: [...selectedTags, tag].join(",") });
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const pinned = data.items.filter((j) => j.pinnedAt);
  const rest = data.items.filter((j) => !j.pinnedAt);

  const row = (j: JobListItem) => (
    <JobRow
      key={j.id}
      job={j}
      onToggleFavorite={() => patchJob(j.id, { favorite: !j.favorite })}
      onTogglePin={() => patchJob(j.id, { pinned: !j.pinnedAt })}
      onToggleArchive={() => patchJob(j.id, { archived: !j.archivedAt })}
      onDelete={() => remove(j)}
      onPickTag={pickTag}
    />
  );

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-3xl bg-white px-4 py-3 shadow-sm">
        <div className="relative min-w-[190px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-500">
            ⌕
          </span>
          <input
            value={needle}
            onChange={(e) => onNeedle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query({ q: needle.slice(0, 100) })}
            placeholder="Tìm theo tên job…"
            className="input h-9 bg-paper pl-8 pr-8"
          />
          {needle && (
            <button
              onClick={() => {
                setNeedle("");
                query({ q: null });
              }}
              title="Xoá tìm kiếm"
              className="absolute right-2.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-pill text-sand-600 hover:bg-accent-100"
            >
              ×
            </button>
          )}
        </div>

        <TagFilter
          tags={tags}
          selected={selectedTags}
          onChange={(next) => query({ tags: next.join(",") })}
        />

        <button
          onClick={() => query({ fav: fav ? null : "1" })}
          title="Chỉ hiện job favorite (gồm cả archive)"
          className={`btn h-9 py-0 ${fav ? "btn-primary" : "btn-secondary"}`}
        >
          {fav ? "★" : "☆"} Favorite
        </button>

        {/* Mặc định đã ẩn archive, nên một checkbox "gồm archive" là đủ. */}
        <label
          title="Tìm cả trong archive"
          className={`btn h-9 cursor-pointer py-0 ${
            archiveMode === "include" ? "btn-primary" : "btn-secondary"
          }`}
        >
          <input
            type="checkbox"
            checked={archiveMode === "include"}
            onChange={(e) => query({ archived: e.target.checked ? "include" : null })}
            className="h-3.5 w-3.5 accent-accent"
          />
          Gồm archive
        </label>

        {hasFilter && (
          <button
            onClick={() => router.replace("/", { scroll: false })}
            className="btn btn-ghost h-9 py-0 text-[13px]"
          >
            Xoá bộ lọc
          </button>
        )}

        <span className="flex-1" />

        <button onClick={() => setShowNew((v) => !v)} className="btn btn-primary h-9 py-0">
          ＋ New job
        </button>
      </div>

      {selectedTags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {selectedTags.map((t) => (
            <span key={t} className="tag bg-accent-200 text-accent-800">
              {t}
              <button
                onClick={() =>
                  query({
                    tags: selectedTags.filter((x) => x.toLowerCase() !== t.toLowerCase()).join(","),
                  })
                }
                title={`Bỏ lọc tag ${t}`}
                className="ml-1.5 opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

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

      <p className="mb-0 mt-4 text-[12.5px] text-sand-600">
        {loading ? "Đang tải…" : hasFilter ? `${data.total} job khớp` : `${data.total} job`}
        {!loading && pages > 1 && ` · trang ${page}/${pages}`}
      </p>

      <div className="mt-2 rounded-[26px] bg-white p-2 shadow-sm">
        {loading && data.items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13.5px] text-sand-600">Đang tải…</div>
        ) : data.items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="m-0 text-[13.5px] text-sand-600">
              {hasFilter ? "Không có job nào khớp." : "Chưa có job nào."}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {hasFilter ? (
                <button
                  onClick={() => router.replace("/", { scroll: false })}
                  className="btn btn-secondary h-9 py-0"
                >
                  Xoá bộ lọc
                </button>
              ) : (
                <button onClick={() => setShowNew(true)} className="btn btn-primary h-9 py-0">
                  ＋ New job
                </button>
              )}
              {archivedHits > 0 && (
                <button
                  onClick={() => query({ archived: "include" })}
                  className="btn btn-secondary h-9 py-0"
                >
                  Có {archivedHits} job trong archive khớp — Tìm trong archive
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="px-3 pb-1 pt-2 text-[10.5px] uppercase tracking-[0.1em] text-accent-700">
                  Đã ghim
                </div>
                {pinned.map(row)}
                <div className="mx-3 my-1.5 h-px bg-divider" />
              </>
            )}
            {rest.map(row)}
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <PageBtn disabled={page <= 1} onClick={() => query({ page: String(page - 1) })}>
            ‹
          </PageBtn>
          {pageNumbers(page, pages).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className="px-1 text-sand-500">
                …
              </span>
            ) : (
              <PageBtn key={n} active={n === page} onClick={() => query({ page: String(n) })}>
                {n}
              </PageBtn>
            )
          )}
          <PageBtn disabled={page >= pages} onClick={() => query({ page: String(page + 1) })}>
            ›
          </PageBtn>
          <span className="ml-2 text-[11.5px] text-sand-600">{PAGE_SIZE} / trang</span>
        </div>
      )}

      {dialog}
    </>
  );
}

function PageBtn({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-[32px] rounded-pill px-2.5 text-[13px] disabled:opacity-40 ${
        active ? "bg-accent text-white" : "text-sand-700 hover:bg-accent-100"
      }`}
    >
      {children}
    </button>
  );
}

/** `‹ 1 … 4 5 6 … 12 ›` — luôn giữ trang đầu, trang cuối và hàng xóm của trang hiện tại. */
function pageNumbers(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page, page - 1, page + 1]);
  const out: (number | null)[] = [];
  let gap = false;
  for (let n = 1; n <= pages; n++) {
    if (keep.has(n)) {
      out.push(n);
      gap = false;
    } else if (!gap) {
      out.push(null);
      gap = true;
    }
  }
  return out;
}
