"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Menu,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { SCHOOL } from "@/lib/mealcheck.mjs";
import { sectionForView } from "@/lib/navigation.mjs";
import { useLiquidIndicator } from "./liquid-motion";
import {Brand,BrandSupport} from './brand';
import { AccountLink } from "./account-link";
export {Brand} from './brand';

export function navigationItems(admin: boolean) {
  return [
    { id: "overview", label: "Tổng quan", Icon: LayoutDashboard },
    { id: "scanner", label: "Quét QR điểm danh", Icon: ScanLine },
    { id: "attendance", label: "Lịch sử điểm danh", Icon: Clock3 },
    { id: "students", label: "Học sinh", Icon: Users },
    { id: "reports", label: "Báo cáo", Icon: ChartNoAxesCombined },
    ...(admin
      ? [
          { id: "settings", label: "Cài đặt", Icon: Settings },
        ]
      : []),
    { id: "guide", label: "Hướng dẫn sử dụng", Icon: BookOpen },
  ];
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
  const section = sectionForView(current);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const homeDialog = useRef<HTMLDialogElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);
  const [homeOpen,setHomeOpen] = useState(false);
  const sidebarNav = useRef<HTMLElement>(null);
  const mobileNav = useRef<HTMLElement>(null);
  const dialogNav = useRef<HTMLElement>(null);
  useLiquidIndicator(sidebarNav, section);
  useLiquidIndicator(mobileNav, section);
  useLiquidIndicator(dialogNav, section + String(open));
  const primary = ["overview", "scanner", "attendance", "students"];
  const mobileLabels: Record<string, string> = {
    overview: "Tổng quan",
    scanner: "Quét QR",
    attendance: "Lịch sử",
    students: "Học sinh",
  };

  useEffect(() => {
    if (!open&&!homeOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open,homeOpen]);

  function askHome(){
    dialog.current?.close();
    setOpen(false);
    homeDialog.current?.showModal();
    setHomeOpen(true);
    stayButton.current?.focus();
  }

  function navigate(id: string) {
    dialog.current?.close();
    onNavigate(id);
  }

  const links = items.map(({ id, label, Icon }) => (
    <button
      key={id}
      className={section === id ? "active" : ""}
      aria-current={section === id ? "page" : undefined}
      onClick={() => navigate(id)}
    >
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  ));

  return (
    <>
      <aside className="sidebar">
        <button type="button" className="brand-home" aria-label="Trở lại trang chủ AFYLLX Edu" onClick={askHome}><Brand /></button>
        <div className="school-label">
          <GraduationCap size={19} aria-hidden="true" />
          <span>{SCHOOL}</span>
        </div>
        <nav ref={sidebarNav} className="liquid-navigation" aria-label="Điều hướng chính"><span className="liquid-indicator" aria-hidden="true"/>{links}</nav>
        <div className="sidebar-bottom">
          <AccountLink />
          <div className="private">
            <ShieldCheck size={18} aria-hidden="true" />
            <b>{publicDemo ? "Bản demo" : "Quản trị nhà trường"}</b>
          </div>
          <BrandSupport onHomeClick={askHome}/>
        </div>
      </aside>
      <nav ref={mobileNav} className="mobile-navigation liquid-navigation" aria-label="Điều hướng nhanh">
        <span className="liquid-indicator" aria-hidden="true"/>
        {items
          .filter((item) => primary.includes(item.id))
          .map(({ id, Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{mobileLabels[id]}</span>
            </button>
          ))}
        <button
          className={!primary.includes(section) ? "active" : ""}
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
          <nav ref={dialogNav} className="liquid-navigation" aria-label="Tất cả chức năng"><span className="liquid-indicator" aria-hidden="true"/>{links}</nav>
          <AccountLink />
          <BrandSupport onHomeClick={askHome}/>
        </div>
      </dialog>
      <dialog ref={homeDialog} className="reset-dialog edu-home-dialog" aria-labelledby="edu-home-title" aria-describedby="edu-home-description" onClose={()=>{setHomeOpen(false);}} onClick={event=>{if(event.target===event.currentTarget)homeDialog.current?.close();}}>
        <h2 id="edu-home-title">Trở lại trang chủ AFYLLX Edu?</h2>
        <p id="edu-home-description">Bạn sẽ rời CheckIn và mở trang chủ tại edu.afyllx.com.</p>
        <div className="reset-dialog-actions"><button ref={stayButton} className="secondary" onClick={()=>homeDialog.current?.close()}>Ở lại CheckIn</button><button className="primary" onClick={()=>window.location.assign('https://edu.afyllx.com/')}>Đồng ý</button></div>
      </dialog>
    </>
  );
}
