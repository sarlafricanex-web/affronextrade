"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Les liens des sections a venir (entreprise, produits, demandes) s'ajouteront semaine apres semaine.
const LINKS = {
  producer: [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/company", key: "navCompany" },
  ],
  buyer: [{ href: "/dashboard", key: "navDashboard" }],
  admin: [
    { href: "/dashboard", key: "navDashboard" },
    { href: "/admin", key: "navAdmin" },
    { href: "/admin/accounts", key: "navAccounts" },
  ],
} as const;

const SPACE_KEY = { producer: "spaceProducer", buyer: "spaceBuyer", admin: "spaceAdmin" } as const;

export function AppNav({ role, name }: { role: string; name: string }) {
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
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--accent)" }}>
          {t(SPACE_KEY[space])}
        </p>
        {name && <p className="mt-1 font-bold truncate">{name}</p>}
      </div>
      <nav className="flex md:flex-col overflow-x-auto">
        {LINKS[space].map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="px-5 py-3 text-sm font-semibold whitespace-nowrap"
              style={{
                background: active ? "var(--ground)" : "transparent",
                borderInlineStart: active ? "3px solid var(--ink)" : "3px solid transparent",
                color: active ? "var(--ink)" : "var(--muted)",
              }}
            >
              {t(link.key)}
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
