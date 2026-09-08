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

  const keyCount = settings.apiKeys.length;
  const hasKey = loaded && keyCount > 0;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="relative z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-divider bg-white/[0.78] px-5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 text-ink hover:no-underline">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-pill bg-accent font-heading text-[13px] text-white">
            T
          </span>
          <span className="font-heading text-[16.5px]">Tranzlator</span>
        </Link>
        <Link href="/" className="text-[13.5px] text-sand-700">
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
          className={`rounded-pill px-3 py-[5px] text-xs ${
            hasKey ? "bg-accent-200 text-accent-800" : "bg-danger-bg text-danger-fg"
          }`}
        >
          {hasKey
            ? keyCount > 1
              ? `● ${keyCount} key`
              : "● có key"
            : "○ chưa có key — nhập ngay"}
        </button>
        <span className="hidden font-mono text-[11.5px] text-sand-600 sm:inline">{settings.model}</span>
        <button onClick={() => setOpen(true)} className="btn btn-secondary h-[34px] py-0">
          Settings
        </button>
        {authEnabled && (
          <button onClick={logout} className="text-[13px] text-sand-600 hover:underline">
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
