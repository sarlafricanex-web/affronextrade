"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppIcon, type IconName } from "./icons";

// Espace connecte, structure inspiree d'Europages (validee par Adlene le 23 novembre 2026) :
// barre du haut de 60 px, menu de gauche de 264 px regroupe par themes, contenu en cartes sur un
// panneau clair, une ligne de liens legaux. Deux couleurs de menu, au choix de l'utilisateur :
// "emerald" (vert fonce, par defaut) et "light" (blanc). Le choix est garde dans un cookie.

export type ShellTheme = "emerald" | "light";
export const SHELL_COOKIE = "anx-shell";

type Role = "producer" | "buyer" | "admin";
type NavItem = { href: string; key: string; icon: IconName; nested?: boolean };
type NavGroup = { key?: string; items: NavItem[] };

const NAV: Record<Role, NavGroup[]> = {
  producer: [
    { items: [{ href: "/dashboard", key: "navDashboard", icon: "grid" }] },
    { key: "groupActivity", items: [{ href: "/requests", key: "navRequests", icon: "inbox", nested: true }] },
    { key: "groupCompany", items: [
      { href: "/company", key: "navCompany", icon: "building" },
      { href: "/catalog", key: "navCatalog", icon: "box", nested: true },
    ] },
    { key: "groupAccount", items: [{ href: "/subscription", key: "navSubscription", icon: "coin" }] },
  ],
  buyer: [
    { items: [{ href: "/dashboard", key: "navDashboard", icon: "grid" }] },
    { key: "groupPurchases", items: [
      { href: "/rfq", key: "navRfqs", icon: "file", nested: true },
      { href: "/rfq/new", key: "navRfqNew", icon: "filePlus" },
    ] },
    { key: "groupAccount", items: [{ href: "/company", key: "navCompany", icon: "building" }] },
  ],
  admin: [
    { items: [{ href: "/dashboard", key: "navDashboard", icon: "grid" }] },
    { key: "groupActivity", items: [
      { href: "/admin/rfqs", key: "navAdminRfqs", icon: "file", nested: true },
      { href: "/admin", key: "navContact", icon: "mail" },
    ] },
    { key: "groupDirectory", items: [
      { href: "/admin/producers", key: "navProducers", icon: "building", nested: true },
      { href: "/admin/claims", key: "navClaims", icon: "flag" },
      { href: "/admin/reviews", key: "navReviews", icon: "star" },
    ] },
    { key: "groupAdministration", items: [
      { href: "/admin/accounts", key: "navAccounts", icon: "users" },
      { href: "/admin/settings", key: "navSettings", icon: "gear" },
    ] },
  ],
};

// Raccourcis de la barre du haut (icone au-dessus du libelle, comme la reference).
const SHORTCUTS: Record<Role, NavItem[]> = {
  producer: [
    { href: "/requests", key: "navRequests", icon: "inbox" },
    { href: "/catalog", key: "navCatalog", icon: "box" },
  ],
  buyer: [
    { href: "/rfq/new", key: "navRfqNew", icon: "filePlus" },
    { href: "/rfq", key: "navRfqs", icon: "file" },
  ],
  admin: [
    { href: "/admin/rfqs", key: "navAdminRfqs", icon: "file" },
    { href: "/admin/producers", key: "navProducers", icon: "building" },
  ],
};

const SPACE_KEY = { producer: "spaceProducer", buyer: "spaceBuyer", admin: "spaceAdmin" } as const;

export function AppShell({ role, name, badges = {}, initialTheme, children }: { role: Role; name: string; badges?: Record<string, number>; initialTheme: ShellTheme; children: React.ReactNode }) {
  const t = useTranslations("app");
  const tf = useTranslations("footer");
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<ShellTheme>(initialTheme);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);

  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "AN";
  const total = Object.values(badges).reduce((a, b) => a + b, 0);
  const bellHref = role === "admin" ? "/dashboard" : role === "producer" ? "/requests" : "/rfq";
  const isActive = (it: NavItem) => pathname === it.href || (!!it.nested && pathname.startsWith(`${it.href}/`) && !(it.href === "/rfq" && pathname === "/rfq/new"));

  function switchTheme() {
    const next: ShellTheme = theme === "emerald" ? "light" : "emerald";
    setTheme(next);
    document.cookie = `${SHELL_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-top">
        <button type="button" className="app-burger" aria-label={t("menu")} aria-expanded={menu} aria-controls="app-side" onClick={() => setMenu((m) => !m)}>
          <AppIcon name="menu" />
        </button>
        <Link href="/" className="app-logo" aria-label={t("homeLink")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={theme === "emerald" ? "/images/logo-light.svg" : "/images/logo.svg"} alt="AFRICA NEX" width={98} height={34} />
        </Link>
        <nav className="app-topnav" aria-label={t("shortcuts")}>
          {SHORTCUTS[role].map((s) => (
            <Link key={s.href} href={s.href} className="app-topnav-item" aria-current={isActive({ ...s, nested: true }) ? "page" : undefined}>
              <AppIcon name={s.icon} /><span>{t(s.key)}</span>
            </Link>
          ))}
        </nav>
        <div className="app-topright">
          <Link href={bellHref} className="app-square" aria-label={t("toProcess", { count: total })} data-app-bell={total}>
            <AppIcon name="bell" />{total > 0 && <b className="app-dot">{total}</b>}
          </Link>
          {role === "admin" ? (
            <span className="app-avatar" title={name}>{initials}</span>
          ) : (
            <Link href="/company" className="app-avatar" title={name} aria-label={t("navCompany")}>{initials}</Link>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <div className="app-body">
        <aside id="app-side" className="app-side" data-open={menu || undefined}>
          <div className="app-who">
            <span className="app-avatar-sm" aria-hidden="true">{initials}</span>
            <span className="min-w-0"><b className="truncate">{name || t(SPACE_KEY[role])}</b><small>{t(SPACE_KEY[role])}</small></span>
          </div>
          <nav aria-label={t(SPACE_KEY[role])} className="app-nav">
            {NAV[role].map((g, i) => (
              <div key={i} className="app-navgroup">
                {g.key && <p className="app-navlabel">{t(g.key)}</p>}
                {g.items.map((it) => {
                  const badge = badges[it.href] ?? 0;
                  return (
                    <Link key={it.href} href={it.href} className="app-navitem" aria-current={isActive(it) ? "page" : undefined}>
                      <AppIcon name={it.icon} /><span>{t(it.key)}</span>
                      {badge > 0 && <b className="app-count" aria-label={t("badgeLabel", { count: badge })}>{badge}</b>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="app-sidefoot">
            <button type="button" className="app-navitem" onClick={switchTheme} aria-label={t(theme === "emerald" ? "themeToLight" : "themeToEmerald")} data-theme-toggle={theme}>
              <AppIcon name="contrast" /><span>{t(theme === "emerald" ? "themeToLight" : "themeToEmerald")}</span>
            </button>
            <button type="button" className="app-navitem app-logout" onClick={signOut}>
              <AppIcon name="logout" /><span>{t("signOut")}</span>
            </button>
          </div>
        </aside>
        {menu && <button type="button" className="app-scrim" aria-label={t("closeMenu")} onClick={() => setMenu(false)} />}

        <div className="app-main">
          <div className="app-content">{children}</div>
          <footer className="app-legal">
            <span>© 2026 SARL AFRICA NEX</span>
            <Link href="/legal">{tf("legal")}</Link>
            <Link href="/privacy">{tf("privacy")}</Link>
            <Link href="/terms">{tf("terms")}</Link>
            <Link href="/sales">{tf("sales")}</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
