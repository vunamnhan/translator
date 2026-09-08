import { Suspense } from "react";
import JobList from "@/components/JobList";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex-1 overflow-auto px-6 pb-16 pt-6">
      <div className="mx-auto max-w-[940px]">
        {/* JobList đọc useSearchParams nên phải nằm trong Suspense. */}
        <Suspense fallback={<p className="text-sm text-sand-600">Đang tải…</p>}>
          <JobList />
        </Suspense>
      </div>
    </main>
  );
}
