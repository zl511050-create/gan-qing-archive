import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Space_Mono } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_SC({
  weight: ["300", "400", "600", "700", "900"],
  display: "swap",
  variable: "--font-noto-serif-sc",
  preload: false,
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "未寄｜他，你遗憾吗？",
  description: "记录失恋之后，那些没有寄出的心事。",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f3f2ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
