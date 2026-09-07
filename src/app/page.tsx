import JobList from "@/components/JobList";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="w-full p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-neutral-500">
          Dịch Markdown bằng LLM · bring-your-own-key. Nhập API key ở Settings góc trên phải trước khi
          bấm Start.
        </p>
      </header>
      <JobList />
    </main>
  );
}
