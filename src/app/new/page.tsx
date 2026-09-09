import { Suspense } from "react";
import NewJobView from "@/components/NewJobView";

export const dynamic = "force-dynamic";

export default function NewJobPage() {
  return (
    // NewJobView đọc useSearchParams (`?resume=1` khi kéo file từ trang Jobs).
    <Suspense fallback={<main className="flex-1 p-6 text-sm text-sand-600">Đang tải…</main>}>
      <NewJobView />
    </Suspense>
  );
}
