import type { Config } from "tailwindcss";

/** Màu/typo lấy từ biến CSS trong globals.css — đổi token ở đó, không đổi ở đây. */

/**
 * Token là hex trong biến CSS nên Tailwind không tự chèn alpha được.
 * Bọc qua color-mix để `bg-accent-100/60` vẫn chạy như màu Tailwind bình thường.
 */
/* Tailwind chạy được hàm màu, nhưng type của nó chỉ khai báo string — nên phải ép kiểu. */
const tone = (value: string) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? value
      : `color-mix(in srgb, ${value} calc(${opacityValue} * 100%), transparent)`) as unknown as string;

const ramp = (name: string) => ({
  100: tone(`var(--color-${name}-100)`),
  200: tone(`var(--color-${name}-200)`),
  300: tone(`var(--color-${name}-300)`),
  400: tone(`var(--color-${name}-400)`),
  500: tone(`var(--color-${name}-500)`),
  600: tone(`var(--color-${name}-600)`),
  700: tone(`var(--color-${name}-700)`),
  800: tone(`var(--color-${name}-800)`),
  900: tone(`var(--color-${name}-900)`),
});

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: tone("var(--color-bg)"),
        ink: tone("var(--color-text)"),
        divider: "var(--color-divider)",
        /** Nền ô nhập / khối code: trắng ngả xanh, dịu hơn #fff. */
        paper: "#fbfdf7",
        accent: { DEFAULT: tone("var(--color-accent)"), ...ramp("accent") },
        moss: ramp("moss"),
        sand: ramp("sand"),
        /** Trạng thái — đặt tên theo nghĩa, không theo màu. */
        run: { bg: "#d7eef2", fg: "#1d5a66", bar: "#3d9aa8", soft: "#e2f0f4" },
        danger: { bg: "#fbdcd6", fg: "#8a2418", bar: "#c4402c", 700: "#a3271a", soft: "#fdeae5", ink: "#7d2114" },
        warn: { bg: "#fdf3dc", fg: "#7a5312", icon: "#b4741a" },
        idle: { bg: "#eef1ea", fg: "#4a5346" },
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { pill: "999px" },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      animation: {
        "tz-pulse": "tz-pulse 1.2s infinite",
        "tz-spin": "tz-spin .7s linear infinite",
        "tz-slide": "tz-slide .22s ease-out",
        "tz-pop": "tz-pop .2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
