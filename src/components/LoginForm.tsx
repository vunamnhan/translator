"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Đăng nhập thất bại");
        setBusy(false);
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Không gọi được server");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h1 className="text-xl font-semibold">Tranzlator</h1>
        <p className="mt-1 text-sm text-neutral-500">Tool nội bộ — nhập mật khẩu admin để vào.</p>

        <label className="mt-5 block text-sm font-medium">Mật khẩu</label>
        <input
          type="password"
          value={password}
          autoFocus
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-1"
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-3 rounded bg-red-100 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Đang vào…" : "Đăng nhập"}
        </button>

        <p className="mt-4 text-xs text-neutral-500">
          Phiên lưu bằng cookie httpOnly, hạn 30 ngày. API key của LLM không liên quan tới mật khẩu này.
        </p>
      </form>
    </main>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-neutral-500">Đang tải…</main>}>
      <Form />
    </Suspense>
  );
}
