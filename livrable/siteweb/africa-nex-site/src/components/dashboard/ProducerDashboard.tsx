import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ProducerDashboard as Data } from "@/lib/data/dashboard";
import { countryName } from "@/lib/countries";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const tnum = { fontFeatureSettings: '"tnum" 1' } as const;

// Semaine 6 : tableau de bord producteur (mise en page de l'ecran 12 de Stitch, contenu reel
// uniquement : vues de la fiche, demandes, devis, messages, catalogue).
export async function ProducerDashboard({ locale, firstName, companyName, published, data }: { locale: string; firstName: string; companyName: string; published: boolean; data: Data }) {
  const [t, tr, format] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "requests" }),
    getFormatter({ locale }),
  ]);
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "medium" }) : "-");
  const variation = data.viewsPrevious ? Math.round(((data.views30 - data.viewsPrevious) / data.viewsPrevious) * 100) : null;

  const kpis = [
    { key: "views", value: data.views30.toLocaleString(locale), note: variation === null ? t("kpiViewsNoCompare") : t("kpiViewsVariation", { sign: variation >= 0 ? "+" : "", value: variation }) },
    { key: "received", value: data.received.toLocaleString(locale), note: t("kpiReceivedNote", { count: data.toDo.length }) },
    { key: "quotes", value: data.quotesSent.toLocaleString(locale), note: t("kpiQuotesNote", { count: data.selected }) },
    { key: "selection", value: data.selectionRate === null ? "-" : `${data.selectionRate} %`, note: t("kpiSelectionNote") },
  ];

  // Actions prioritaires : uniquement ce qui attend vraiment le producteur.
  const actions: { key: string; tone: "urgent" | "info"; label: string; text: string; href: string; cta: string }[] = [
    ...data.toDo.slice(0, 5).map((r) => ({
      key: `req-${r.id}`,
      tone: (r.hoursLeft !== null && r.hoursLeft < 72 ? "urgent" : "info") as "urgent" | "info",
      label: r.hoursLeft !== null && r.hoursLeft < 72 ? t("actionUrgent", { hours: Math.max(r.hoursLeft, 0) }) : t("actionRequest"),
      text: t("actionRequestText", { title: r.brief_title, date: date(r.respond_by) }),
      href: `/requests/${r.id}`,
      cta: t("actionRequestCta"),
    })),
    ...data.unreadRequests.map((r) => ({ key: `msg-${r.id}`, tone: "info" as const, label: t("actionMessage"), text: t("actionMessageText", { reference: r.reference }), href: `/requests/${r.id}#messages`, cta: t("actionMessageCta") })),
    ...(data.expiredPrices ? [{ key: "prices", tone: "urgent" as const, label: t("actionPrices"), text: t("actionPricesText", { count: data.expiredPrices }), href: "/catalog", cta: t("actionPricesCta") }] : []),
    ...(!data.productCount ? [{ key: "product", tone: "info" as const, label: t("actionCatalog"), text: t("actionNoProduct"), href: "/catalog/new", cta: t("actionNoProductCta") }] : []),
    ...(data.completion.percent < 100 ? [{ key: "profile", tone: "info" as const, label: t("actionProfile"), text: t("actionProfileText", { percent: data.completion.percent }), href: "/company", cta: t("actionProfileCta") }] : []),
  ];

  return (
    <div className="flex flex-col gap-6" data-dashboard="producer">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("producerEyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.1 }}>{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {companyName} · {published ? t("profileOnline") : t("profileDraft")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/requests" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("ctaRequests")}</Link>
          <Link href="/catalog" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>{t("ctaCatalog")}</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("kpisLabel")}>
        {kpis.map((k) => (
          <div key={k.key} className="flex flex-col gap-2 p-4" style={{ background: "white", border: `1px solid ${HAIR}` }} data-kpi={k.key}>
            <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t(`kpi_${k.key}`)}</span>
            <span className="font-extrabold" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", lineHeight: 1, ...tnum }} data-kpi-value={k.value}>{k.value}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{k.note}</span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
          <section style={{ background: "white", border: `1px solid ${HAIR}` }} data-actions={actions.length}>
            <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("actionsTitle", { count: actions.length })}</h2>
            {actions.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>{t("actionsEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-3 p-4">
                {actions.map((a) => (
                  <li key={a.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: a.tone === "urgent" ? "#fff7ed" : "#fffdf9", border: `1px solid ${HAIR}`, borderInlineStart: `3px solid ${a.tone === "urgent" ? "#f97316" : "#10b981"}` }} data-action-item={a.key}>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: a.tone === "urgent" ? "#c2410c" : "#065f46" }}>{a.label}</span>
                      <p className="mt-1 text-sm font-semibold">{a.text}</p>
                    </div>
                    <Link href={a.href} className="shrink-0 px-4 py-2 text-center text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>{a.cta}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
              <h2 className="text-xs font-bold uppercase" style={caps}>{t("recentTitle")}</h2>
              <Link href="/requests" className="text-xs font-bold uppercase underline" style={caps}>{t("seeAll")}</Link>
            </div>
            {data.recentRequests.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>{t("recentEmpty")}</p>
            ) : (
              <ul>
                {data.recentRequests.map((r) => (
                  <li key={r.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                    <Link href={`/requests/${r.id}`} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{r.reference} · {date(r.created_at)}</span>
                        <span className="block font-semibold">{r.brief_title}</span>
                      </span>
                      <span className="shrink-0 px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}` }}>{r.quote ? tr(`quote_${r.quote.status}`) : tr(`dispatch_${r.status}`)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {data.completion.percent < 100 && (
            <section className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} data-completion={data.completion.percent}>
              <h2 className="text-xs font-bold uppercase" style={caps}>{t("completionTitle")}</h2>
              <p className="font-extrabold" style={{ fontSize: "1.8rem", lineHeight: 1, ...tnum }}>{data.completion.percent} %</p>
              <div className="h-2 w-full" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }} role="progressbar" aria-valuenow={data.completion.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full" style={{ width: `${data.completion.percent}%`, background: "#059669" }} />
              </div>
              <Link href="/company" className="text-xs font-bold uppercase underline" style={caps}>{t("completionCta")}</Link>
            </section>
          )}
          <section className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} data-countries={data.topCountries.length}>
            <h2 className="text-xs font-bold uppercase" style={caps}>{t("countriesTitle")}</h2>
            {data.topCountries.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>{t("countriesEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.topCountries.map(([code, n]) => (
                  <li key={code} className="flex justify-between gap-3"><span>{countryName(code, locale)}</span><strong style={tnum}>{n}</strong></li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="text-xs font-bold uppercase" style={caps}>{t("catalogTitle")}</h2>
            <p className="text-sm">{t("catalogText", { total: data.productCount, published: data.publishedCount })}</p>
            <Link href="/catalog" className="text-xs font-bold uppercase underline" style={caps}>{t("ctaCatalog")}</Link>
          </section>
          <section className="flex flex-col gap-2 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} data-tier={data.tier}>
            <h2 className="text-xs font-bold uppercase" style={caps}>{t("planTitle")}</h2>
            <p className="font-extrabold" style={{ fontSize: "1.3rem" }}>{t(`plan_${data.tier}`)}</p>
            <Link href="/subscription" className="text-xs font-bold uppercase underline" style={caps}>{t("planCta")}</Link>
          </section>
          <section className="flex flex-col gap-2 p-5" style={{ background: "var(--ink)", color: "white" }}>
            <h2 className="text-xs font-bold uppercase" style={caps}>{t("contactTitle")}</h2>
            <p className="text-sm" style={{ color: "#cbd5e1" }}>{t("contactText")}</p>
            <p className="text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>sarlafricanex@gmail.com</p>
            <p className="text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>+213 770 96 02 70</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
