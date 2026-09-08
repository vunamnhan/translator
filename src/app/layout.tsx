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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      {/* Khung app cố định chiều cao: header không cuộn, phần thân tự lo overflow.
          dvh chứ không vh — trên iOS thanh địa chỉ ăn mất một khúc của 100vh. */}
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <AppHeader authEnabled={authEnabled} />
        {children}
      </body>
    </html>
  );
}
