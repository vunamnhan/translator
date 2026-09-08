"use client";

/** Mảnh dùng chung giữa ChunkBar và SectionBar để 2 tab nhìn y hệt nhau. */

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  translating: "bg-blue-200 text-blue-800 animate-pulse dark:bg-blue-900 dark:text-blue-200",
  summarizing: "bg-blue-200 text-blue-800 animate-pulse dark:bg-blue-900 dark:text-blue-200",
  done: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  skipped: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status] ?? ""}`}>
      {status}
    </span>
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
      className={`-mb-px whitespace-nowrap border-b-2 px-1.5 py-1 font-medium ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}
