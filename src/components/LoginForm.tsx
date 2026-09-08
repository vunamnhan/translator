"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <main className="grid flex-1 place-items-center p-6">
      <form
        onSubmit={submit}
        className="w-[396px] max-w-full animate-tz-pop rounded-[30px] bg-white p-[30px] shadow-lg"
      >
        <div className="mb-1 flex items-center gap-2.5">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-pill bg-accent font-heading text-[15px] text-white">
            T
          </span>
          <h3 className="m-0">Tranzlator</h3>
        </div>
        <p className="mb-5 mt-0 text-[13px] text-sand-700">Tool nội bộ — nhập mật khẩu admin để vào.</p>

        <div className="field mb-3.5">
          <label htmlFor="pw">Mật khẩu</label>
          <input
            id="pw"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="mb-3.5 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="btn btn-primary h-[42px] w-full"
        >
          {busy ? "Đang vào…" : "Đăng nhập"}
        </button>

        <p className="mb-0 mt-[18px] text-[11.5px] leading-normal text-sand-600">
          Phiên lưu bằng cookie httpOnly, hạn 30 ngày. API key của LLM không liên quan tới mật khẩu
          này.
        </p>
      </form>
    </main>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<main className="flex-1 p-6 text-sm text-sand-600">Đang tải…</main>}>
      <Form />
    </Suspense>
  );
}
