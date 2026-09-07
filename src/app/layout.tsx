import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tranzlator",
  description: "Dịch tài liệu Markdown bằng LLM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = Boolean(process.env.ADMIN_PASSWORD);
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <AppHeader authEnabled={authEnabled} />
        {children}
      </body>
    </html>
  );
}
