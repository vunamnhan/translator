import JobList from "@/components/JobList";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex-1 overflow-auto px-6 pb-16 pt-8">
      <div className="mx-auto max-w-[940px]">
        <h2 className="mb-1.5">Jobs</h2>
        <p className="max-w-[620px] text-[13.5px] text-sand-700">
          Dịch Markdown bằng LLM · bring-your-own-key. Nhập API key ở Settings góc trên phải trước khi
          bấm Start.
        </p>
        <JobList />
      </div>
    </main>
  );
}
