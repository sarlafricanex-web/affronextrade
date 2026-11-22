import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { BuyerDashboard as Data } from "@/lib/data/dashboard";
import { Progress, StatusBadge } from "@/components/rfq/RfqList";
import { stageOf } from "@/lib/data/rfq";
import { isSector } from "@/lib/sectors";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const tnum = { fontFeatureSettings: '"tnum" 1' } as const;

// Semaine 6 : tableau de bord acheteur (maquette 18). Action requise (offres a decider, messages),
// trois indicateurs, dernieres demandes, producteurs de ses secteurs. Rien d'invente.
export async function BuyerDashboard({ locale, firstName, data }: { locale: string; firstName: string; data: Data }) {
  const [t, tr, ts, format] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "sectors" }),
    getFormatter({ locale }),
  ]);
  const actions = [
    ...data.toDecide.map((x) => ({ key: `o-${x.rfq.id}`, tag: t("buyerTagOffers"), text: t("buyerActionOffers", { count: x.count, reference: x.rfq.reference, title: x.rfq.title }), href: `/rfq/${x.rfq.id}#offers`, cta: t("buyerActionOffersCta"), strong: true })),
    ...data.unread.map((x) => ({ key: `m-${x.rfq.id}`, tag: t("buyerTagMessage"), text: t("buyerActionMessage", { count: x.count, reference: x.rfq.reference }), href: `/rfq/${x.rfq.id}#messages`, cta: t("actionMessageCta"), strong: false })),
  ];
  const kpis = [
    { key: "inProgress", value: data.inProgress, color: "var(--ink)" },
    { key: "toDecide", value: data.offersToDecide, color: "#c2410c" },
    { key: "accepted", value: data.accepted, color: "#065f46" },
  ];

  return (
    <div className="flex flex-col gap-6" data-dashboard="buyer">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("buyerEyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.1 }}>{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>
        </div>
        <Link href="/rfq/new" className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>+ {t("buyerNewRequest")}</Link>
      </header>

      {actions.length > 0 && (
        <section className="flex flex-col p-5" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #f97316" }} data-buyer-actions={actions.length}>
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase" style={caps}><span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: "#f97316" }} />{t("buyerActionsTitle")}</h2>
          <ul>
            {actions.map((a, i) => (
              <li key={a.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                <span className="flex min-w-0 flex-wrap items-center gap-3">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, background: "#fff7ed", border: "1px solid #fdba74", color: "#c2410c" }}>{a.tag}</span>
                  <span className="text-sm">{a.text}</span>
                </span>
                <Link href={a.href} className="shrink-0 px-4 py-2.5 text-center text-xs font-bold uppercase" style={{ ...caps, ...(a.strong ? { background: "#c2410c", color: "white" } : { background: "var(--ink)", color: "white" }) }}>{a.cta}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("kpisLabel")}>
        {kpis.map((k) => (
          <div key={k.key} className="flex flex-col gap-2 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} data-kpi={k.key}>
            <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: k.color === "var(--ink)" ? "var(--muted)" : k.color }}>{t(`buyerKpi_${k.key}`)}</span>
            <span className="font-extrabold" style={{ fontSize: "2.4rem", lineHeight: 1, color: k.color, ...tnum }} data-kpi-value={k.value}>{k.value}</span>
          </div>
        ))}
      </section>

      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <h2 className="font-extrabold" style={{ fontSize: "1.15rem" }}>{t("buyerRecentTitle")}</h2>
          <Link href="/rfq" className="text-sm font-semibold underline">{t("buyerAllRequests")}</Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-sm" style={{ color: "var(--muted)" }}>{t("buyerRecentEmpty")}</p>
            <Link href="/producers" className="text-xs font-bold uppercase underline" style={caps}>{t("buyerBrowse")}</Link>
          </div>
        ) : (
          <ul>
            {data.recent.map((r) => (
              <li key={r.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                <Link href={`/rfq/${r.id}`} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold" dir="ltr">{r.reference}</span>
                      <StatusBadge status={r.status} label={tr(`status_${r.status}`)} />
                    </span>
                    <span className="mt-1 block font-semibold">{r.title}</span>
                    <span className="block text-xs" style={{ color: "var(--muted)" }}>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}</span>
                  </span>
                  <Progress stage={stageOf(r.status)} label={tr(`stage_${r.status}`, { count: (r.offers ?? []).filter((o) => o.status === "published").length })} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.producers.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-extrabold" style={{ fontSize: "1.15rem" }}>{data.matchesInterests ? t("buyerProducersTitle") : t("buyerProducersTitleAll")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {data.producers.map((p) => (
              <article key={p.id} className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} data-producer={p.slug}>
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo} alt="" width={56} height={56} className="h-14 w-14 object-contain" style={{ border: `1px solid ${HAIR}` }} />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center text-sm font-bold" style={{ background: p.color, color: "white" }}>{p.initials}</span>
                )}
                <div>
                  <Link href={`/producers/${p.slug}`} className="font-bold hover:underline">{p.name}</Link>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{[p.location, p.wilaya].filter(Boolean).join(", ")}</p>
                </div>
                {isSector(p.sector) && <span className="w-fit px-2 py-1 text-xs font-semibold" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>{ts(p.sector)}</span>}
                <Link href={`/rfq/new?producer=${p.slug}`} className="mt-auto block px-4 py-2.5 text-center text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("buyerAskQuote")}</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
