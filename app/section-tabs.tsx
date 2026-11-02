"use client";

import { ClipboardCheck, Clock3, QrCode, Users } from "lucide-react";
import { sectionForView } from "@/lib/navigation.mjs";
import { useRef } from "react";
import { useLiquidIndicator } from "./liquid-motion";

export function SectionTabs({
  current,
  admin,
  onNavigate,
}: {
  current: string;
  admin: boolean;
  onNavigate: (view: string) => void;
}) {
  const section = sectionForView(current);
  const tablist = useRef<HTMLDivElement>(null);
  useLiquidIndicator(tablist, current, '[role="tab"][aria-selected="true"]');
  const tabs = section === "attendance"
    ? [
        { id: "attendance", label: "Đã điểm danh", Icon: Clock3 },
        { id: "missing", label: "Chưa điểm danh", Icon: ClipboardCheck },
      ]
    : section === "students" && admin
      ? [
          { id: "students", label: "Danh sách học sinh", Icon: Users },
          { id: "qrcards", label: "Thẻ QR học sinh", Icon: QrCode },
        ]
      : [];
  if (!tabs.length) return null;

  return (
    <div
      className="section-tabs"
      ref={tablist}
      role="tablist"
      aria-label={section === "attendance" ? "Tra cứu điểm danh" : "Quản lý học sinh"}
    >
      <span className="liquid-indicator" aria-hidden="true"/>
      {tabs.map(({ id, label, Icon }, index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`view-tab-${id}`}
          aria-controls="section-panel"
          aria-selected={current === id}
          tabIndex={current === id ? 0 : -1}
          onClick={() => onNavigate(id)}
          onKeyDown={(event) => {
            const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!offset && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length;
            onNavigate(tabs[next].id);
            document.getElementById(`view-tab-${tabs[next].id}`)?.focus();
          }}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
