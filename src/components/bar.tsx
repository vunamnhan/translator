"use client";

/** Mảnh dùng chung giữa ChunkBar / SectionBar / ContextBar để 3 thẻ nhìn y hệt nhau. */

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-idle-bg text-idle-fg",
  translating: "bg-run-bg text-run-fg animate-tz-pulse",
  summarizing: "bg-run-bg text-run-fg animate-tz-pulse",
  generating: "bg-run-bg text-run-fg animate-tz-pulse",
  done: "bg-accent-200 text-accent-800",
  error: "bg-danger-bg text-danger-fg",
  skipped: "bg-warn-bg text-warn-fg",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] ${
        STATUS_STYLE[status] ?? STATUS_STYLE.pending
      }`}
    >
      {status}
    </span>
  );
}

/** Khung ngoài của thẻ: mở thì nổi lên (trắng + viền accent + shadow). */
export function barShell(expanded: boolean): string {
  return `overflow-hidden rounded-[18px] border ${
    expanded ? "border-accent bg-white shadow-md" : "border-divider bg-paper"
  }`;
}

export const BAR_HEAD =
  "flex w-full min-h-[34px] items-center gap-[7px] px-2.5 py-1.5 text-left hover:bg-accent-100/60";

export const BAR_BODY = "flex flex-col gap-2.5 px-2.5 pb-3";

export function ErrorCode({ code, title }: { code: string; title?: string }) {
  return (
    <span
      title={title}
      className="rounded-md bg-danger-700 px-1.5 py-0.5 font-mono text-[10.5px] text-white"
    >
      {code}
    </span>
  );
}

export function ErrorBox({ message, code, hint }: { message: string; code: string | null; hint: string | null }) {
  return (
    <div className="rounded-[14px] bg-danger-soft px-3 py-2.5 text-xs text-danger-ink">
      <p className="m-0 font-mono text-[11.5px]">{message}</p>
      {hint && (
        <p className="m-0 mt-1 opacity-85">
          {code} — {hint}
        </p>
      )}
    </div>
  );
}

export function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-warn-bg px-3 py-2.5 text-xs text-warn-fg">⚠ {children}</div>
  );
}

export function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{ boxShadow: active ? "inset 0 -2px 0 var(--color-accent)" : "none" }}
      className={`whitespace-nowrap rounded-[10px] px-2.5 py-1 text-xs ${
        active ? "text-accent-700" : "text-sand-600 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Khối chỉ đọc (Raw / Nguồn của section) — viền nét đứt để phân biệt với ô sửa được. */
export function ReadOnlyBox({ children }: { children: React.ReactNode }) {
  return (
    <pre className="m-0 h-[270px] overflow-auto whitespace-pre-wrap break-words rounded-[14px] border border-dashed border-sand-300 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-sand-700">
      {children}
    </pre>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-tz-spin rounded-pill border-2 border-white/40 border-t-white" />
  );
}
