import type { Metadata } from "next";
import "./globals.css";
import "./student-qr-card.css";

export const metadata: Metadata = {
  title: "AFYLLX MealCheck · Na Rì",
  description: "Quản lý điểm danh suất ăn nội trú với giáo viên xác nhận.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
