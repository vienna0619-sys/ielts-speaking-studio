import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocalis · AI IELTS Speaking Studio",
  description: "面向中国雅思考生的 AI 口语模拟考试与专项练习工具。",
  applicationName: "Vocalis",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
