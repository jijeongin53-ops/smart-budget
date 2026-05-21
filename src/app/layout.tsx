import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 스마트 예산 집행 & 회계 관리 솔루션",
  description: "정부지원사업 규정 가이드라인 기반 실시간 규정 적격성 검토 및 구글 시트 연동 자동화 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

