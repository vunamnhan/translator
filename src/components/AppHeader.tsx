"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import SettingsDrawer from "./SettingsDrawer";
import { useSettings } from "@/lib/useSettings";
import { useReadMode } from "@/lib/readMode";

export default function AppHeader({ authEnabled }: { authEnabled: boolean }) {
  const { settings, update, loaded } = useSettings();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { readMode, toggle: toggleRead } = useReadMode();

  if (pathname === "/login") return null;

  const keyCount = settings.apiKeys.length;
  const hasKey = loaded && keyCount > 0;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="relative z-30 flex h-[52px] shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-divider bg-white/[0.78] px-3 backdrop-blur-md lg:gap-4 lg:px-5">
        {/* Chế độ đọc chỉ có nghĩa ở màn job và ở khổ mobile — desktop vốn đã rộng. */}
        {pathname.startsWith("/job/") && (
          <button
            onClick={toggleRead}
            title={readMode ? "Thoát chế độ đọc" : "Chế độ đọc — giấu hết nút, chỉ còn bài"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-pill text-[15px] lg:hidden ${
              readMode ? "bg-accent text-white" : "bg-accent-100 text-accent-800"
            }`}
          >
            {readMode ? "✕" : "📖"}
          </button>
        )}

        <Link href="/" className="flex items-center gap-2.5 text-ink hover:no-underline">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-pill bg-accent font-heading text-[13px] text-white">
            T
          </span>
          <span className="hidden font-heading text-[16.5px] sm:inline">Tranzlator</span>
        </Link>
        <Link href="/" className="hidden text-[13.5px] text-sand-700 lg:inline">
          Jobs
        </Link>

        <span className="flex-1" />

        <button
          onClick={() => setOpen(true)}
          title={
            hasKey
              ? `${keyCount} API key lưu trong trình duyệt`
              : "Chưa có API key — bấm để nhập"
          }
          className={`shrink-0 whitespace-nowrap rounded-pill px-3 py-[5px] text-xs ${
            hasKey ? "bg-accent-200 text-accent-800" : "bg-danger-bg text-danger-fg"
          }`}
        >
          {/* Mobile chỉ còn ký hiệu + số; phần chữ dài ẩn đi chứ không render hai lần. */}
          {hasKey ? (keyCount > 1 ? `● ${keyCount}` : "●") : "○"}
          <span className="hidden lg:inline">
            {hasKey ? (keyCount > 1 ? " key" : " có key") : " chưa có key — nhập ngay"}
          </span>
        </button>
        <span className="hidden shrink-0 font-mono text-[11.5px] text-sand-600 lg:inline">
          {settings.model}
        </span>
        <button onClick={() => setOpen(true)} className="btn btn-secondary h-[34px] shrink-0 py-0">
          Settings
        </button>
        {authEnabled && (
          <button onClick={logout} className="shrink-0 whitespace-nowrap text-[13px] text-sand-600 hover:underline">
            Đăng xuất
          </button>
        )}
      </nav>

      <SettingsDrawer
        open={open}
        onClose={() => setOpen(false)}
        settings={settings}
        updateSettings={update}
      />
    </>
  );
}
