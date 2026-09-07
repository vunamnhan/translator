"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import SettingsDrawer from "./SettingsDrawer";
import { useSettings } from "@/lib/useSettings";

export default function AppHeader({ authEnabled }: { authEnabled: boolean }) {
  const { settings, update, loaded } = useSettings();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  const hasKey = loaded && Boolean(settings.apiKey);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="sticky top-0 z-40 flex h-11 items-center gap-4 border-b border-neutral-300 bg-white/95 px-4 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <Link href="/" className="font-semibold tracking-tight">
          Tranzlator
        </Link>
        <Link href="/" className="text-sm text-neutral-600 hover:underline dark:text-neutral-300">
          Jobs
        </Link>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <button
            onClick={() => setOpen(true)}
            title={hasKey ? "API key đã lưu trong trình duyệt" : "Chưa có API key — bấm để nhập"}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              hasKey
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {hasKey ? "● có key" : "○ chưa có key — nhập ngay"}
          </button>
          <span className="hidden text-xs text-neutral-500 sm:inline">{settings.model}</span>
          <button
            onClick={() => setOpen(true)}
            className="rounded border border-neutral-400 px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Settings
          </button>
          {authEnabled && (
            <button onClick={logout} className="text-neutral-500 hover:underline">
              Đăng xuất
            </button>
          )}
        </div>
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
