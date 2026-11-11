"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProducerCard } from "@/lib/data/directory";
import { ProducerAvatar, SECTOR_FILTER_KEY, Stars, VerifiedBadge } from "./parts";

const FILTERS = ["all", "agrifood", "industry", "automotive", "crafts", "cosmetics", "agriculture"] as const;

// Recherche sans accents ni majuscules ("bejaia" trouve "Béjaïa").
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Filtrage cote navigateur ; les fiches viennent de la base (rendu serveur, en cache).
export function ProducerDirectory({ producers, unavailable = false }: { producers: ProducerCard[]; unavailable?: boolean }) {
  const t = useTranslations("producers");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return producers.filter(
      (p) =>
        (activeFilter === "all" || p.sector === activeFilter) &&
        (!q || fold(p.name).includes(q) || fold(p.location).includes(q) || p.products.some((prod) => fold(prod).includes(q))),
    );
  }, [producers, activeFilter, search]);

  return (
    <section style={{ background: "var(--field-a)", padding: "var(--section-gap) var(--page-margin)" }}>
      <h2 className="font-extrabold" style={{ fontSize: "var(--step-title)" }}>{t("directoryTitle")}</h2>
      <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "40ch" }}>{t("directorySubtitle")}</p>

      <div className="mt-8">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full max-w-md px-4 py-3 text-sm"
          style={{ background: "var(--ground)", border: "1px solid var(--field-b)", outline: "none" }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("sector")}>
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeFilter === key}
            onClick={() => setActiveFilter(key)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: activeFilter === key ? "var(--ink)" : "var(--ground)", color: activeFilter === key ? "var(--ground)" : "var(--muted)" }}
          >
            {t(key === "all" ? "filterAll" : SECTOR_FILTER_KEY[key])}
          </button>
        ))}
      </div>

      {unavailable ? (
        <p className="py-16 text-center text-lg" style={{ color: "var(--muted)" }}>{t("directoryUnavailable")}</p>
      ) : filtered.length > 0 ? (
        <ul className="mt-8 grid gap-px md:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--field-b)" }}>
          {filtered.map((p) => (
            <li key={p.id} className="flex flex-col" style={{ background: "var(--ground)", padding: "1.5rem" }}>
              <div className="flex items-start gap-3">
                <ProducerAvatar name={p.name} logo={p.logo} initials={p.initials} color={p.color} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/producers/${p.slug}`} className="truncate font-bold hover:underline">{p.name}</Link>
                    {p.verified && <VerifiedBadge label={t("verified")} />}
                  </div>
                  <p style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>{p.location}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Stars rating={p.avgRating ?? 0} size={12} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {p.reviewCount ? `${p.avgRating?.toFixed(1)} (${p.reviewCount})` : t("noReviews")}
                </span>
              </div>

              {p.products.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.products.slice(0, 5).map((product) => (
                    <span key={product} className="px-2 py-0.5 text-xs" style={{ background: "var(--field-a)", color: "var(--muted)" }}>{product}</span>
                  ))}
                </div>
              )}

              {p.claimStatus !== "claimed" && (
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{t("unclaimedShort")}</p>
              )}

              <div className="mt-auto flex gap-4 pt-4">
                <Link href={`/producers/${p.slug}`} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{t("viewProfile")}</Link>
                <Link href={`/producers/${p.slug}#devis`} className="text-sm font-medium" style={{ color: "var(--muted)" }}>{t("requestQuote")}</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-16 text-center text-lg" style={{ color: "var(--muted)" }}>{t("noResults")}</p>
      )}
    </section>
  );
}
