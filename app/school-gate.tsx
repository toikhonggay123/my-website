"use client";

import { useEffect, useState, type ReactNode } from "react";
import { decideEntry, pickerApplies, pickerHref, readCookie, schoolCookie, SCHOOL_PARAM, SCHOOL_STORAGE_KEY } from "@/lib/schools.mjs";
import { viewFromSearch } from "@/lib/navigation.mjs";

export function storedSchool(): string | null {
  const fromCookie = readCookie(document.cookie);
  if (fromCookie) return fromCookie;
  try { return localStorage.getItem(SCHOOL_STORAGE_KEY); } catch { return null; }
}

export function rememberSchool(slug: string) {
  document.cookie = schoolCookie(slug, location.protocol === "https:");
  try { localStorage.setItem(SCHOOL_STORAGE_KEY, slug); } catch {}
}

const currentPath = () => location.pathname + location.search + location.hash;

/**
 * Phase 1 school entrance: no sign-in, it only asks which school once per browser on the web.
 * The decision runs in the browser (never a server redirect) so the cached offline scanner keeps opening.
 */
export function SchoolGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const decision = decideEntry({
      hostname: location.hostname,
      stored: storedSchool(),
      param: new URLSearchParams(location.search).get(SCHOOL_PARAM),
      scanner: viewFromSearch(location.search) === "scanner",
      standalone: matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      online: navigator.onLine,
    });
    if (decision.action === "choose") {
      location.replace(pickerHref(currentPath()));
      return;
    }
    if (decision.save) rememberSchool(decision.school.slug);
    setReady(true);
  }, []);
  return ready ? children : null;
}

/** "Đổi trường" link for product menus; hidden on the local app, which serves one school. */
export function ChangeSchoolLink({ className = "" }: { className?: string }) {
  const [href, setHref] = useState("");
  useEffect(() => {
    if (pickerApplies(location.hostname)) setHref(pickerHref(currentPath()));
  }, []);
  if (!href) return null;
  // The tab may have changed since mount; return to the page the user is on now.
  return <a className={className} href={href} onClick={event => { event.preventDefault(); location.assign(pickerHref(currentPath())); }}>Đổi trường</a>;
}
