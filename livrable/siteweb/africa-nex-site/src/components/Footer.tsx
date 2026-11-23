"use client";

import { isAppPath } from "@/lib/app-routes";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const FOOTER_LINKS = ["about", "opportunities", "services", "producers", "buyers", "pricing", "contact"] as const;

// Rien sur les pages de l'espace connecte : elles ont leur propre barre (AppShell).
export function Footer() {
  const pathname = usePathname();
  return isAppPath(pathname) ? null : <SiteFooter />;
}

function SiteFooter() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");

  return (
    <footer style={{ background: "var(--ink)", color: "var(--ground)" }}>
      <div className="grid md:grid-cols-2" style={{ minHeight: "100svh" }}>
        <div className="relative overflow-hidden">
          <img
            src="/images/olive-trees.jpg"
            alt="Olive trees, painting by Vincent van Gogh, 1889"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div
          className="flex flex-col justify-between"
          style={{ padding: "5rem var(--page-margin) 2rem" }}
        >
          <div>
            <img
              src="/images/logo-light.svg"
              alt="AFRICA NEX"
              width={160}
              height={56}
              className="mb-16 h-10 w-auto"
            />

            <nav className="flex flex-col gap-3">
              {FOOTER_LINKS.map((key) => (
                <Link
                  key={key}
                  href={`/${key}`}
                  className="font-extrabold transition-all duration-300 hover:translate-x-3"
                  style={{
                    fontSize: "clamp(1.5rem, 2.6vw, 2.5rem)",
                    lineHeight: 1.1,
                    color: "var(--ground)",
                  }}
                >
                  {nav(key)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-16">
            <div className="flex gap-8 mb-6">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--on-ink-muted)" }}>
                  {t("followUs")}
                </p>
                <div className="flex gap-3">
                  <a href="#" className="text-sm hover:underline" style={{ color: "var(--ground)" }}>
                    LinkedIn
                  </a>
                  <a href="#" className="text-sm hover:underline" style={{ color: "var(--ground)" }}>
                    Facebook
                  </a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--on-ink-muted)" }}>
                  Email
                </p>
                <p className="text-sm" style={{ color: "var(--ground)" }}>sarlafricanex@gmail.com</p>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--on-ink-muted)" }}>
              {t("madeWith")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--on-ink-muted)" }}>
              &copy; 2026 AFRICA NEX. {t("rights")}
            </p>
            <p className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: "var(--on-ink-muted)" }}>
              {(["legal", "privacy", "terms", "sales"] as const).map((k) => (
                <Link key={k} href={`/${k}`} className="underline hover:no-underline">
                  {t(k)}
                </Link>
              ))}
            </p>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--on-ink-muted)" }}>
              Images: &ldquo;Olive Trees&rdquo; by Vincent van Gogh, 1889, public domain, via The Metropolitan Museum of Art.
              &ldquo;Boat in Harbor, Algeria&rdquo; by John Beasley Greene, 1853, public domain, via The Met.
              &ldquo;Olives in olive oil&rdquo; by stu_spivack, <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener license" className="underline">CC BY-SA 2.0</a>, via Wikimedia Commons.
              &ldquo;Cherchell Harbour&rdquo; by Bernard Gagnon, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener license" className="underline">CC BY 4.0</a>, via Wikimedia Commons.
              &ldquo;Ripe dates&rdquo; by Kerina yin, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener license" className="underline">CC0</a>, via Wikimedia Commons.
              &ldquo;Sunrise from Algeria port&rdquo; by Fadi karim 7, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener license" className="underline">CC BY-SA 4.0</a>, via Wikimedia Commons.
              &ldquo;Olive oil export&rdquo; generated with Canva AI.
              &ldquo;New Inventions of Modern Times (Nova Reperta)&rdquo; after Jan van der Straet, about 1600, public domain.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
