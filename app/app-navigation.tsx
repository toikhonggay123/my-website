"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Menu,
  QrCode,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { SCHOOL } from "@/lib/mealcheck.mjs";

export function navigationItems(admin: boolean) {
  return [
    { id: "overview", label: "Tổng quan", Icon: LayoutDashboard },
    { id: "scanner", label: "Quét QR điểm danh", Icon: ScanLine },
    { id: "attendance", label: "Lịch sử điểm danh", Icon: Clock3 },
    { id: "missing", label: "Chưa điểm danh", Icon: ClipboardCheck },
    { id: "students", label: "Học sinh", Icon: Users },
    { id: "reports", label: "Báo cáo", Icon: ChartNoAxesCombined },
    ...(admin
      ? [
          { id: "qrcards", label: "Thẻ QR học sinh", Icon: QrCode },
          { id: "settings", label: "Cài đặt", Icon: Settings },
        ]
      : []),
    { id: "guide", label: "Hướng dẫn sử dụng", Icon: BookOpen },
  ];
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brandmark">
        <Utensils size={22} />
      </span>
      <b>
        AFYLLX <em>MealCheck</em>
      </b>
    </div>
  );
}

export function AppNavigation({
  current,
  admin,
  publicDemo,
  onNavigate,
}: {
  current: string;
  admin: boolean;
  publicDemo: boolean;
  onNavigate: (tab: string) => void;
}) {
  const items = navigationItems(admin);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const primary = ["overview", "scanner", "attendance", "students"];
  const mobileLabels: Record<string, string> = {
    overview: "Tổng quan",
    scanner: "Quét QR",
    attendance: "Lịch sử",
    students: "Học sinh",
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function navigate(id: string) {
    dialog.current?.close();
    onNavigate(id);
  }

  const links = items.map(({ id, label, Icon }) => (
    <button
      key={id}
      className={current === id ? "active" : ""}
      aria-current={current === id ? "page" : undefined}
      onClick={() => navigate(id)}
    >
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  ));

  return (
    <>
      <aside className="sidebar">
        <Brand />
        <div className="school-label">
          <GraduationCap size={19} aria-hidden="true" />
          <span>{SCHOOL}</span>
        </div>
        <nav aria-label="Điều hướng chính">{links}</nav>
        <div className="sidebar-bottom">
          <div className="private">
            <ShieldCheck size={18} aria-hidden="true" />
            <b>{publicDemo ? "Bản demo" : "Quản trị nhà trường"}</b>
          </div>
        </div>
      </aside>
      <nav className="mobile-navigation" aria-label="Điều hướng nhanh">
        {items
          .filter((item) => primary.includes(item.id))
          .map(({ id, Icon }) => (
            <button
              key={id}
              className={current === id ? "active" : ""}
              aria-current={current === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{mobileLabels[id]}</span>
            </button>
          ))}
        <button
          className={!primary.includes(current) ? "active" : ""}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="navigation-dialog"
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <Menu size={21} aria-hidden="true" />
          <span>Thêm</span>
        </button>
      </nav>
      <dialog
        ref={dialog}
        id="navigation-dialog"
        className="navigation-dialog"
        aria-labelledby="navigation-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="navigation-dialog-content">
          <header>
            <h2 id="navigation-title">Menu</h2>
            <button
              className="icon-button"
              aria-label="Đóng menu"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} />
            </button>
          </header>
          <nav aria-label="Tất cả chức năng">{links}</nav>
        </div>
      </dialog>
    </>
  );
}
