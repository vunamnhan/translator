"use client";

import { DEFAULT_READING, MAX_READING, MIN_READING, useReadingSize } from "@/lib/readingSize";

/** Khung quanh nội dung màn hình job: thanh tiến độ, banner, panel danh sách bên trái. */

/**
 * Khung đọc bên phải. Cỡ chữ đi qua biến CSS `--reading-size`, heading trong
 * `.md-preview` dùng em nên co giãn theo. Nút chỉnh cỡ nằm ở hàng thanh tiến độ
 * (`ReadingSizeControl`), không nhét trong khung để khỏi che chữ.
 */
export function ReadingPane({
  boxRef,
  children,
}: {
  boxRef: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const { size } = useReadingSize();

  return (
    <div
      ref={boxRef}
      className="h-full overflow-y-auto rounded-3xl bg-white px-4 pb-20 pt-6 shadow-md lg:px-[30px] lg:pt-[34px]"
    >
      <div
        className="md-preview mx-auto max-w-[764px]"
        style={{ "--reading-size": `${size}px` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** Cụm A− / A+ cho khung đọc, đặt ở chỗ trống bên phải hàng thanh tiến độ. */
export function ReadingSizeControl() {
  const { size, set } = useReadingSize();

  return (
    <div className="flex items-center gap-0.5 rounded-pill border border-divider bg-white/70 px-1 py-0.5">
      <button
        onClick={() => set(size - 1)}
        disabled={size <= MIN_READING}
        title="Giảm cỡ chữ khung đọc"
        className="h-5 w-6 rounded-pill text-[12.5px] leading-none text-sand-700 hover:bg-accent-100 disabled:opacity-40"
      >
        A−
      </button>
      <button
        onClick={() => set(DEFAULT_READING)}
        title="Về cỡ chữ mặc định"
        className="min-w-[32px] rounded-pill px-1 font-mono text-[11px] leading-none text-sand-600 hover:bg-accent-100"
      >
        {size}px
      </button>
      <button
        onClick={() => set(size + 1)}
        disabled={size >= MAX_READING}
        title="Tăng cỡ chữ khung đọc"
        className="h-5 w-6 rounded-pill text-[12.5px] leading-none text-sand-700 hover:bg-accent-100 disabled:opacity-40"
      >
        A+
      </button>
    </div>
  );
}

export interface FilterDef {
  key: string;
  label: string;
  count: number;
}

export function ProgressBar({
  done,
  running,
  errors,
  skipped,
  total,
}: {
  done: number;
  running: number;
  errors: number;
  skipped: number;
  total: number;
}) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    // Chỉ chiếm bề ngang cột trái — tiến độ nói về danh sách thẻ, không phải khung đọc.
    // Mobile không có cột trái nên nó tự trải hết bề ngang.
    <div className="flex w-[var(--pane-w)] max-w-full items-center gap-2.5">
      <div className="flex h-[3px] flex-1 overflow-hidden rounded-pill bg-white shadow-sm">
        <div style={{ width: pct(done) }} className="bg-accent-500 transition-[width] duration-500" />
        <div
          style={{ width: pct(running) }}
          className="animate-tz-pulse bg-run-bar transition-[width] duration-500"
        />
        <div style={{ width: pct(errors) }} className="bg-danger-bar transition-[width] duration-500" />
        <div style={{ width: pct(skipped) }} className="bg-moss-300" />
      </div>
      <span className="shrink-0 font-mono text-[11px] text-sand-600">
        {total > 0 ? Math.round((done / total) * 100) : 0}%
      </span>
    </div>
  );
}

const TONE: Record<string, string> = {
  warn: "bg-warn-bg text-warn-fg",
  info: "bg-run-soft text-run-fg",
  idle: "bg-idle-bg text-idle-fg",
};

export function Banner({
  tone = "info",
  children,
  note,
  action,
  onAction,
  onClose,
}: {
  tone?: "warn" | "info" | "idle";
  children: React.ReactNode;
  note?: string;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-2.5 rounded-[18px] px-3.5 py-2.5 text-[12.5px] ${TONE[tone]}`}
    >
      <span className="flex-1">{children}</span>
      {action && (
        <button onClick={onAction} className="btn btn-secondary btn-sm h-[30px] bg-white">
          {action}
        </button>
      )}
      {note && <span className="opacity-75">{note}</span>}
      <button onClick={onClose} title="Đóng" className="px-0.5 text-sm opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  );
}

/**
 * Cột trái: ô tìm, chip lọc, rồi vùng cuộn chứa các thẻ.
 * Từ md trở lên là cột cố định; dưới md cùng DOM đó thành sheet trượt từ đáy
 * (xem `.pane-list` trong globals.css). `open` chỉ có tác dụng ở khổ mobile.
 */
export function ListPanel({
  query,
  onQuery,
  filters,
  filter,
  onFilter,
  empty,
  open,
  onClose,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  filters: FilterDef[];
  filter: string;
  onFilter: (key: string) => void;
  /** Câu hiện khi không còn thẻ nào; null nghĩa là có thẻ. */
  empty: string | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {open && <div onClick={onClose} className="pane-backdrop" />}
      <div className={`pane-list flex-col bg-white py-3 pl-3.5 pr-2 ${open ? "is-open" : ""}`}>
        <span className="sheet-grab" />
        <div className="flex shrink-0 flex-col gap-2 pr-1.5">
          <div className="flex items-center gap-2 lg:contents">
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Tìm trong nội dung…"
              className="input h-8 bg-paper text-[12.5px] lg:min-h-0"
            />
            <button
              onClick={onClose}
              title="Đóng danh sách"
              className="h-9 w-9 shrink-0 rounded-pill bg-sand-100 text-sand-700 lg:hidden"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => onFilter(f.key)}
                className={`rounded-pill border px-2.5 py-[3px] text-[11.5px] ${
                  filter === f.key
                    ? "border-accent bg-accent text-white"
                    : "border-divider text-sand-700 hover:bg-accent-100"
                }`}
              >
                {f.label} {f.count}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1.5">
          {children}
          {empty && (
            <div className="rounded-[18px] border border-dashed border-sand-300 p-[18px] text-center text-[12.5px] text-sand-600">
              {empty}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
