"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const FOOTER_LINKS = ["about", "opportunities", "services", "producers", "buyers", "contact"] as const;

export function Footer() {
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
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
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
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                  Email
                </p>
                <p className="text-sm" style={{ color: "var(--ground)" }}>contact@africanex.com</p>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {t("madeWith")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              &copy; 2026 AFRICA NEX. {t("rights")} &middot;{" "}
              <Link href="/legal" className="underline hover:no-underline">
                {t("legal")}
              </Link>
            </p>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--muted)", opacity: 0.6 }}>
              Images: &ldquo;Olive Trees&rdquo; by Vincent van Gogh, 1889, public domain, via The Metropolitan Museum of Art.
              &ldquo;Boat in Harbor, Algeria&rdquo; by John Beasley Greene, 1853, public domain, via The Met.
              &ldquo;Olives in olive oil&rdquo; by stu_spivack, CC BY-SA 2.0, via Wikimedia Commons.
              &ldquo;Cherchell Harbour&rdquo; by Bernard Gagnon, CC BY 4.0, via Wikimedia Commons.
              &ldquo;Ripe dates&rdquo; by Kerina yin, CC0, via Wikimedia Commons.
              &ldquo;Sunrise from Algeria port&rdquo; by Fadi karim 7, CC BY-SA 4.0, via Wikimedia Commons.
              &ldquo;Olive oil export&rdquo; generated with Canva AI.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
