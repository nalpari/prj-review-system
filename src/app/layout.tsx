import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const wanted = localFont({
  src: "./fonts/WantedSansVariable.woff2",
  variable: "--font-wanted",
  weight: "400 800",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Redline", template: "%s · Redline" },
  description: "브랜치 diff와 커밋 맥락으로 AI 코드리뷰를 실행하고 기록하는 팀 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${wanted.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
