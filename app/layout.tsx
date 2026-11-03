import type { Metadata,Viewport } from "next";
import {PwaRuntime} from './pwa';
import {PRODUCT_NAME} from '@/lib/branding.mjs';
import './pwa.css';
import "./globals.css";
import "./student-qr-card.css";
import "./dashboard-layout.css";
import "./brand.css";
import "./liquid-motion.css";
import "./home-overview.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AFYLLX Edu MealCheck — quét QR và quản lý suất ăn học đường.",
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,title:PRODUCT_NAME,statusBarStyle:'default'},
  icons: {
    icon: "/icons/edtech-favicon-32.png",
    shortcut: "/icons/edtech-favicon-32.png",
    apple:'/icons/edtech-apple-touch-icon.png',
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
