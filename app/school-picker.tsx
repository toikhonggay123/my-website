"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, GraduationCap } from "lucide-react";
import { BRAND_MARK } from "@/lib/branding.mjs";
import { rememberSchool, storedSchool } from "./school-gate";
import { findSchool, productForNext, safeNext, SCHOOLS } from "@/lib/schools.mjs";
import "./school-picker.css";

export function SchoolPicker() {
  const [next, setNext] = useState("/mealcheck");
  const [current, setCurrent] = useState<string | null>(null);
  const [opening, setOpening] = useState("");
  useEffect(() => {
    setNext(safeNext(new URLSearchParams(location.search).get("tiep") ?? undefined));
    const stored = storedSchool();
    setCurrent(findSchool(stored) ? stored : null);
  }, []);
  function choose(slug: string) {
    setOpening(slug);
    rememberSchool(slug);
    location.assign(next);
  }
  return (
    <main className="school-picker">
      <div className="school-picker-card">
        <div className="brand" aria-label={"AFYLLX Edu " + productForNext(next)}>
          <img className="brandmark" src={BRAND_MARK} width="42" height="42" alt="" />
          <div className="brand-copy"><strong>AFYLLX Edu</strong><span>{productForNext(next)}</span></div>
        </div>
        <div className="school-picker-head">
          <h1>Chọn trường</h1>
          <p>Chọn trường của bạn để vào <b>AFYLLX Edu {productForNext(next)}</b>.</p>
        </div>
        <ul className="school-picker-list" aria-label="Danh sách trường">
          {SCHOOLS.map((school) => (
            <li key={school.slug}>
              <button type="button" className={"school-option" + (current === school.slug ? " is-current" : "")}
                onClick={() => choose(school.slug)} disabled={!!opening} aria-describedby={"school-" + school.slug}>
                <span className="school-option-icon" aria-hidden="true"><GraduationCap size={24} /></span>
                <span className="school-option-text">
                  <strong>{school.shortName}</strong>
                  <small id={"school-" + school.slug}>{school.fullName}</small>
                </span>
                {current === school.slug && <span className="school-option-badge"><Check size={14} aria-hidden="true" />Đang chọn</span>}
                <ChevronRight className="school-option-arrow" size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <p className="school-picker-note" role="status">
          {opening ? "Đang mở…" : "Lựa chọn được nhớ trên thiết bị này. Có thể đổi trường trong menu bất cứ lúc nào."}
        </p>
      </div>
    </main>
  );
}
