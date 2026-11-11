"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProducerCard } from "@/lib/data/directory";
import { SECTOR_FILTER_KEY, Stars } from "./parts";

// Annuaire d'apres la maquette Stitch 08 ("Commercial Registry"), alimente par nos vraies donnees.
const FILTERS = ["all", "agrifood", "industry", "automotive", "crafts", "cosmetics", "agriculture"] as const;
const SORTS = ["relevance", "rating", "name"] as const;
const PAGE_SIZE = 12;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const caps = "text-xs font-semibold uppercase";
const capsStyle = { letterSpacing: "0.08em", color: "var(--muted)" } as const;
const HAIR = "#d8cebb";

function Icon({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
const ARROW = "M5 12h14M13 6l6 6-6 6";
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35";
const SHIELD = "M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3zM9 12l2 2 4-4";

export function ProducerDirectory({ producers, unavailable = false }: { producers: ProducerCard[]; unavailable?: boolean }) {
  const t = useTranslations("producers");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]>("relevance");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const list = producers.filter(
      (p) =>
        (filter === "all" || p.sector === filter) &&
        (!verifiedOnly || p.verified) &&
        (!q || fold(p.name).includes(q) || fold(p.location).includes(q) || fold(p.wilaya ?? "").includes(q) || p.products.some((prod) => fold(prod).includes(q))),
    );
    if (sort === "rating") return [...list].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.reviewCount - a.reviewCount);
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [producers, filter, query, verifiedOnly, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1360, padding: "2rem var(--page-margin) 3rem" }}>
      <section className="mb-8 pb-8" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <nav aria-label={t("breadcrumb")} className={`mb-4 flex items-center gap-2 ${caps}`} style={capsStyle}>
          <Link href="/" className="hover:underline">{t("breadcrumbHome")}</Link>
          <span aria-hidden="true" style={{ color: HAIR }}>&gt;</span>
          <span className="font-bold" style={{ color: "var(--ink)" }}>{t("breadcrumbProducers")}</span>
        </nav>

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-extrabold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", lineHeight: 1.2, letterSpacing: "-0.025em" }}>{t("directoryTitle")}</h1>
            <p className="mt-1" style={{ color: "var(--muted)" }}>{t("directorySubtitle")}</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 ${caps}`} style={{ background: "white", border: `1px solid ${HAIR}`, letterSpacing: "0.08em" }}>
            <Icon d={SHIELD} className="text-[var(--accent)]" />
            {t("directorySecure")}
          </div>
        </div>

        <form
          role="search"
          className="mb-6 flex flex-col gap-0 p-1 sm:flex-row"
          style={{ background: "white", border: `1px solid ${HAIR}` }}
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="flex flex-grow items-center px-4 py-2">
            <Icon d={SEARCH} className="me-3 text-[var(--muted)]" />
            <span className="sr-only">{t("searchPlaceholder")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => reset(setQuery)(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-transparent p-0 text-sm"
              style={{ border: 0, outline: "none" }}
            />
          </label>
          <button type="submit" className={`flex items-center justify-center gap-2 px-8 py-3 font-bold text-white ${caps}`} style={{ background: "var(--accent)", letterSpacing: "0.08em" }}>
            {t("searchButton")}
            <Icon d={ARROW} size={16} />
          </button>
        </form>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2" role="group" aria-label={t("sector")} style={{ borderBottom: `1px solid ${HAIR}` }}>
            {FILTERS.map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => reset(setFilter)(key)}
                  className={`px-5 py-3 ${caps} ${active ? "font-bold" : ""}`}
                  style={{ letterSpacing: "0.08em", borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`, background: active ? "white" : "transparent", color: active ? "var(--ink)" : "var(--muted)", marginBottom: -1 }}
                >
                  {t(key === "all" ? "filterAll" : SECTOR_FILTER_KEY[key])}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 py-2 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <span className="font-semibold" style={{ fontFeatureSettings: '"tnum" 1' }}>{filtered.length}</span>
            <span style={{ color: "var(--muted)" }}>{t("countLabel", { count: filtered.length })}</span>
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <label className={`flex cursor-pointer select-none items-center gap-2 ${caps}`} style={capsStyle}>
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => reset(setVerifiedOnly)(e.target.checked)} className="h-4 w-4" style={{ borderRadius: 0, accentColor: "var(--ink)" }} />
              {t("verifiedOnly")}
            </label>
            <label className={`flex items-center gap-2 ${caps}`} style={capsStyle}>
              {t("sortBy")}
              <select value={sort} onChange={(e) => reset(setSort)(e.target.value as (typeof SORTS)[number])} className="px-3 py-1 text-sm normal-case" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--ink)", letterSpacing: 0 }}>
                {SORTS.map((s) => <option key={s} value={s}>{t(`sort_${s}`)}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      {unavailable ? (
        <p className="py-16 text-center text-lg" style={{ color: "var(--muted)" }}>{t("directoryUnavailable")}</p>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-lg" style={{ color: "var(--muted)" }}>{t("noResults")}</p>
      ) : (
        <ul className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col justify-between p-6" style={{ background: "white", border: `1px solid ${HAIR}` }}>
              <div>
                <div className="mb-4 flex items-center justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <span className={`${caps} truncate`} style={capsStyle}>
                    {[p.wilaya ?? p.location.split(",").pop()?.trim(), SECTOR_FILTER_KEY[p.sector] ? t(SECTOR_FILTER_KEY[p.sector]) : null].filter(Boolean).join(" • ")}
                  </span>
                  {p.verified ? (
                    <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", letterSpacing: "0.08em" }}>
                      <Icon d={SHIELD} size={13} />
                      {t("verified")}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 text-[11px] uppercase" style={{ background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)", letterSpacing: "0.08em" }}>
                      {t("referenced")}
                    </span>
                  )}
                </div>

                <h2 className="mb-2 font-bold" style={{ fontSize: "1rem", letterSpacing: "-0.01em" }}>
                  <Link href={`/producers/${p.slug}`} className="hover:underline">{p.name}</Link>
                </h2>
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <Stars rating={p.avgRating ?? 0} size={16} />
                  {p.reviewCount ? (
                    <>
                      <span className="font-semibold" style={{ fontFeatureSettings: '"tnum" 1' }}>{p.avgRating?.toFixed(1).replace(".", ",")}</span>
                      <span style={{ color: "var(--muted)" }}>({t("reviewsCount", { count: p.reviewCount })})</span>
                    </>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>{t("noReviews")}</span>
                  )}
                </div>

                {p.products.length > 0 && (
                  <div className="mb-6">
                    <p className="mb-2 text-[11px] font-semibold uppercase" style={capsStyle}>{t("exportableProducts")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.products.slice(0, 4).map((product) => (
                        <span key={product} className="px-2 py-1 text-xs" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>{product}</span>
                      ))}
                      {p.products.length > 4 && <span className="px-2 py-1 text-xs" style={{ color: "var(--muted)" }}>+{p.products.length - 4}</span>}
                    </div>
                  </div>
                )}
              </div>

              <div>
                {p.claimStatus !== "claimed" && (
                  <p className="mb-4 pt-3 text-center text-xs italic" style={{ borderTop: `1px solid ${HAIR}`, color: "var(--muted)" }}>
                    {t(p.claimStatus === "claim_pending" ? "claimPendingShort" : "byAfricaNex")}
                  </p>
                )}
                <Link href={`/producers/${p.slug}`} className={`flex w-full items-center justify-center gap-2 px-4 py-2.5 font-bold ${caps}`} style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
                  {t("viewProfile")}
                  <Icon d={ARROW} size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="mb-12 flex items-center justify-center gap-1">
          <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className={`px-4 py-2 ${caps} disabled:opacity-40`} style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--ink)" }}>‹ {t("prev")}</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)} className="h-10 w-10 text-sm font-semibold" style={{ background: n === current ? "var(--ink)" : "white", color: n === current ? "white" : "var(--ink)", border: `1px solid ${n === current ? "var(--ink)" : HAIR}` }}>{n}</button>
          ))}
          <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className={`px-4 py-2 ${caps} disabled:opacity-40`} style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--ink)" }}>{t("next")} ›</button>
        </nav>
      )}

      <section className="flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center" style={{ background: "#fff2e2", border: `1px solid ${HAIR}` }}>
        <div className="flex items-start gap-5">
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center sm:flex" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--accent)" }}>
            <Icon d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01" size={26} />
          </div>
          <div>
            <h2 className="font-bold" style={{ fontSize: "1.1rem" }}>{t("ctaProducerTitle")}</h2>
            <p className="mt-1" style={{ color: "var(--muted)", maxWidth: "60ch" }}>{t("ctaProducerText")}</p>
          </div>
        </div>
        <Link href="/register" className={`shrink-0 px-6 py-3 font-bold ${caps}`} style={{ background: "var(--accent)", color: "white", letterSpacing: "0.08em" }}>{t("ctaProducerButton")}</Link>
      </section>
    </div>
  );
}
