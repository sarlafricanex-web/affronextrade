"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Les liens des sections a venir (entreprise, produits, demandes) s'ajouteront semaine apres semaine.
const LINKS = {
  producer: [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/requests", key: "navRequests" },
    { href: "/company", key: "navCompany" },
    { href: "/catalog", key: "navCatalog" },
    { href: "/subscription", key: "navSubscription" },
  ],
  buyer: [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/rfq", key: "navRfqs" },
    { href: "/rfq/new", key: "navRfqNew" },
    { href: "/company", key: "navCompany" },
  ],
  admin: [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/admin", key: "navAdmin" },
    { href: "/admin/rfqs", key: "navAdminRfqs" },
    { href: "/admin/accounts", key: "navAccounts" },
    { href: "/admin/producers", key: "navProducers" },
    { href: "/admin/claims", key: "navClaims" },
    { href: "/admin/reviews", key: "navReviews" },
    { href: "/admin/settings", key: "navSettings" },
  ],
} as const;

const SPACE_KEY = { producer: "spaceProducer", buyer: "spaceBuyer", admin: "spaceAdmin" } as const;

// badges : notifications dans l'espace (ex. offres pretes a comparer), par lien.
export function AppNav({ role, name, badges = {} }: { role: string; name: string; badges?: Record<string, number> }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();
  const space = role === "producer" || role === "admin" ? role : "buyer";

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <aside
      className="flex flex-col"
      style={{ background: "white", borderInlineEnd: "1px solid var(--field-b)", borderBottom: "1px solid var(--field-b)" }}
    >
      <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid var(--field-b)" }}>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--accent-text)" }}>
          {t(SPACE_KEY[space])}
        </p>
        {name && <p className="mt-1 font-bold truncate">{name}</p>}
      </div>
      <nav className="flex md:flex-col overflow-x-auto">
        {LINKS[space].map((link) => {
          const active =
            pathname === link.href ||
            ((link.href === "/catalog" || link.href === "/requests" || link.href === "/admin/producers" || link.href === "/admin/rfqs") && pathname.startsWith(`${link.href}/`)) ||
            (link.href === "/rfq" && pathname.startsWith("/rfq/") && pathname !== "/rfq/new");
          const badge = badges[link.href] ?? 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm font-semibold whitespace-nowrap"
              style={{
                background: active ? "var(--ground)" : "transparent",
                borderInlineStart: active ? "3px solid var(--ink)" : "3px solid transparent",
                color: active ? "var(--ink)" : "var(--muted)",
              }}
            >
              {t(link.key)}
              {badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center px-1.5 text-[11px] font-bold" style={{ background: "#c2410c", color: "white" }} aria-label={t("badgeLabel", { count: badge })}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={signOut}
        className="mt-auto text-start px-5 py-4 text-sm font-semibold"
        style={{ color: "#dc2626", borderTop: "1px solid var(--field-b)" }}
      >
        {t("signOut")}
      </button>
    </aside>
  );
}
