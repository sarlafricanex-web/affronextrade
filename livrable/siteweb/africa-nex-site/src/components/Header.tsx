"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { AuthNav } from "@/components/AuthNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV_KEYS = ["about", "opportunities", "services", "producers", "buyers", "pricing", "contact"] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header fixed top-0 left-0 right-0 z-50 bg-white${scrolled ? " scrolled" : ""}`} style={{ background: "white" }}>
      <nav
        className="mx-auto flex items-center justify-between h-14"
        style={{ padding: "0 var(--page-margin)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/images/logo.svg"
            alt="AFRICA NEX"
            width={140}
            height={49}
            className="h-8 w-auto"
          />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {NAV_KEYS.map((key) => (
            <Link
              key={key}
              href={`/${key}`}
              className="text-sm font-medium transition-colors hover:opacity-100"
              style={{ color: pathname === `/${key}` ? "var(--ink)" : "var(--muted)" }}
            >
              {t(key)}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <AuthNav className="text-sm font-semibold whitespace-nowrap" />
          <Link
            href="/contact"
            className="text-sm font-semibold px-5 py-2 transition-colors"
            style={{ background: "var(--ink)", color: "var(--ground)" }}
          >
            {t("getStarted")}
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-2">
        <LanguageSwitcher />
        <button
          className="p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <div className="w-5 space-y-1.5">
            <span
              className="block h-px transition-transform duration-300"
              style={{
                background: "var(--ink)",
                transform: menuOpen ? "rotate(45deg) translate(3px, 3px)" : "none",
              }}
            />
            <span
              className="block h-px transition-opacity duration-300"
              style={{
                background: "var(--ink)",
                opacity: menuOpen ? 0 : 1,
              }}
            />
            <span
              className="block h-px transition-transform duration-300"
              style={{
                background: "var(--ink)",
                transform: menuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none",
              }}
            />
          </div>
        </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="md:hidden"
          style={{
            background: "var(--ground)",
            padding: "1.5rem var(--page-margin)",
          }}
        >
          <div className="flex flex-col gap-4">
            {NAV_KEYS.map((key) => (
              <Link
                key={key}
                href={`/${key}`}
                onClick={() => setMenuOpen(false)}
                className="text-base font-medium"
                style={{ color: pathname === `/${key}` ? "var(--ink)" : "var(--muted)" }}
              >
                {t(key)}
              </Link>
            ))}
          </div>
          <AuthNav
            className="block text-center text-sm font-semibold mt-4 py-3"
            onNavigate={() => setMenuOpen(false)}
          />
          <Link
            href="/contact"
            onClick={() => setMenuOpen(false)}
            className="block text-center text-sm font-semibold mt-4 py-3"
            style={{ background: "var(--ink)", color: "var(--ground)" }}
          >
            {t("getStarted")}
          </Link>
        </div>
      )}
    </header>
  );
}
