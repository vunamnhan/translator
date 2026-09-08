"use client";

import Menu from "./Menu";
import type { JobListItem } from "@/lib/types";

interface Props {
  job: JobListItem;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onPickTag: (tag: string) => void;
}

function Bar({ done, errors, total }: { done: number; errors: number; total: number }) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="flex h-1.5 w-[86px] overflow-hidden rounded-pill bg-accent-100">
      <div style={{ width: pct(done) }} className="bg-accent-500" />
      <div style={{ width: pct(errors) }} className="bg-danger-bar" />
    </div>
  );
}

export default function JobRow({
  job,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onPickTag,
}: Props) {
  const archived = Boolean(job.archivedAt);
  const pinned = Boolean(job.pinnedAt);

  const items = [
    ...(archived ? [] : [{ label: pinned ? "Bỏ ghim" : "Ghim lên đầu", onClick: onTogglePin }]),
    { label: job.favorite ? "Bỏ favorite" : "Đánh dấu favorite", onClick: onToggleFavorite },
    { label: archived ? "Unarchive" : "Archive", onClick: onToggleArchive },
    { label: "Xoá job", onClick: onDelete, danger: true },
  ];

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[20px] px-3 py-2.5 transition-colors hover:bg-accent-100/50 ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="flex w-12 shrink-0 items-center gap-0.5">
        <span className={`text-sm ${pinned ? "opacity-100" : "opacity-0"}`} title="Đã ghim">
          📌
        </span>
        <button
          onClick={onToggleFavorite}
          title={job.favorite ? "Bỏ favorite" : "Đánh dấu favorite"}
          className={`h-6 w-6 rounded-pill text-sm ${
            job.favorite ? "text-warn-icon" : "text-sand-400 hover:text-warn-icon"
          }`}
        >
          {job.favorite ? "★" : "☆"}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/job/${job.id}`} className="truncate font-semibold text-ink hover:text-accent">
            {job.name}
          </a>
          {archived && (
            <span className="tag bg-sand-200 text-sand-700">Archived</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {job.tags.map((t) => (
            <button
              key={t}
              onClick={() => onPickTag(t)}
              title={`Lọc theo tag ${t}`}
              className="tag bg-accent-100 text-accent-800 hover:bg-accent-200"
            >
              {t}
            </button>
          ))}
          <span className="text-[11.5px] text-sand-600">
            {new Date(job.createdAt).toLocaleString("vi-VN")}
          </span>
        </div>
      </div>

      {/* Mobile: xuống dòng 2 (w-full + order) chứ không ẩn — tiến độ là thứ cần nhất. */}
      <div className="order-last flex w-full shrink-0 items-center gap-4 pl-12 text-[12px] text-sand-700 lg:order-none lg:w-auto lg:pl-0">
        <div className="flex items-center gap-2" title="Tiến độ dịch">
          <span className="font-mono">
            {job.done}/{job.total}
          </span>
          <Bar done={job.done} errors={job.errors} total={job.total} />
          {job.errors > 0 && <span className="text-danger-700">{job.errors} lỗi</span>}
        </div>
        <div className="flex items-center gap-2" title="Tiến độ tóm tắt">
          <span className="font-mono text-sand-600">
            §{job.sectionsDone}/{job.sectionsTotal}
          </span>
        </div>
      </div>

      <Menu items={items} />
    </div>
  );
}
