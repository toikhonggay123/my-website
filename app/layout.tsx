import type { Metadata,Viewport } from "next";
import {PwaRuntime} from './pwa';
import './pwa.css';
import "./globals.css";
import "./student-qr-card.css";
import "./dashboard-layout.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "AFYLLX MealCheck · Na Rì",
  description: "Quét QR và điểm danh suất ăn nội trú.",
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,title:'MealCheck',statusBarStyle:'default'},
  icons: {
    icon: "/icons/favicon-32.png",
    shortcut: "/icons/favicon-32.png",
    apple:'/icons/apple-touch-icon.png',
  },
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#3264e6'};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased"><PwaRuntime/>{children}</body>
    </html>
  );
}
