"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CircleUserRound } from "lucide-react";

/**
 * AFYLLX Account shortcut. MealCheck administration stays public (owner's choice, 08/11/2026): this link only shows who
 * is signed in and never gates anything. AFYLLX Account exists only behind the Edu gateway, so the link appears on
 * edu.afyllx.com and nowhere else (not on localhost, afyllx.com or workers.dev).
 */
const ACCOUNT_HOST = "edu.afyllx.com";
const ACCOUNT_PATH = "/tai-khoan/";
const ACCOUNT_SITE = "https://account.afyllx.com/";
const roleName: Record<string, string> = {
  founder: "AFYLLX Account Founder",
  platform_admin: "Quản trị hệ thống",
  support: "Hỗ trợ",
};
type Me = { name: string; role: string | null };

export function AccountLink() {
  const [available, setAvailable] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (window.location.hostname !== ACCOUNT_HOST) return;
    setAvailable(true);
    const controller = new AbortController();
    type Reply = { data?: { state?: string; account?: { name?: string; platform_role?: string | null } } } | null;
    fetch(ACCOUNT_PATH + "api/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Reply>) : null))
      .then((json) => {
        const account = json?.data?.state === "full" ? json.data.account : undefined;
        if (account?.name) setMe({ name: account.name, role: account.platform_role ?? null });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!available) return null;
  // The account site has its own domain; only its API is read through edu.afyllx.com/tai-khoan/api.
  const href = me ? ACCOUNT_SITE : ACCOUNT_SITE + "?tiep=" + encodeURIComponent(window.location.href);
  return (
    <a className={"account-link" + (me ? " is-signed" : "")} data-role={me?.role ?? undefined} href={href}>
      <CircleUserRound size={18} aria-hidden="true" />
      <span>
        <b>{me ? me.name : "Đăng nhập AFYLLX Account"}</b>
        <small>{me ? (me.role ? roleName[me.role] ?? me.role : "AFYLLX Account") : "Không bắt buộc để dùng MealCheck"}</small>
      </span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}
