import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép build ra thư mục khác để không đè .next của dev server đang chạy.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
