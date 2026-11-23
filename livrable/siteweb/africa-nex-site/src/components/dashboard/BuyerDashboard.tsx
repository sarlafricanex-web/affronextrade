import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { BuyerDashboard as Data } from "@/lib/data/dashboard";
import { Progress, StatusBadge } from "@/components/rfq/RfqList";
import { stageOf } from "@/lib/data/rfq";
import { isSector } from "@/lib/sectors";
import { AppIcon } from "@/components/app/icons";

// Tableau de bord acheteur, structure Europages (24 novembre 2026) : bandeau (offres a decider ou
// accueil), puis une colonne de cartes (a faire, chiffres, dernieres demandes, producteurs de ses
// secteurs). Rien d'invente.
export async function BuyerDashboard({ locale, firstName, data }: { locale: string; firstName: string; data: Data }) {
  const [t, tr, ts, format] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "sectors" }),
    getFormatter({ locale }),
  ]);
  const actions = [
    ...data.toDecide.map((x) => ({ key: `o-${x.rfq.id}`, offers: true, tag: t("buyerTagOffers"), text: t("buyerActionOffers", { count: x.count, reference: x.rfq.reference, title: x.rfq.title }), href: `/rfq/${x.rfq.id}#offers` })),
    ...data.unread.map((x) => ({ key: `m-${x.rfq.id}`, offers: false, tag: t("buyerTagMessage"), text: t("buyerActionMessage", { count: x.count, reference: x.rfq.reference }), href: `/rfq/${x.rfq.id}#messages` })),
  ];
  const firstOffer = data.toDecide[0];
  const kpis = [
    { key: "inProgress", value: data.inProgress },
    { key: "toDecide", value: data.offersToDecide },
    { key: "accepted", value: data.accepted },
  ];

  return (
    <div className="dash" data-dashboard="buyer">
      <section className="dash-banner" aria-labelledby="dash-hello">
        <h1 id="dash-hello">{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>
        {firstOffer ? (
          <>
            <p>{t("buyerBannerOffers", { count: data.offersToDecide })}</p>
            <Link href={`/rfq/${firstOffer.rfq.id}#offers`} className="dash-banner-btn">{t("buyerActionOffersCta")}</Link>
          </>
        ) : (
          <>
            <p>{t("buyerBannerIdle")}</p>
            <Link href="/rfq/new" className="dash-banner-btn">{t("buyerNewRequest")}</Link>
          </>
        )}
      </section>

      {actions.length > 0 && (
        <section className="dash-card" aria-labelledby="dash-todo" data-buyer-actions={actions.length}>
          <div className="dash-cardhead"><div><h2 id="dash-todo">{t("buyerActionsTitle")}</h2><p>{t("buyerActionsHelp")}</p></div></div>
          <ul className="dash-list">
            {actions.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="dash-row" data-action-item={a.key}>
                  <span className={`dash-kind ${a.offers ? "dash-kind-moderation" : "dash-kind-requests"}`}><AppIcon name={a.offers ? "file" : "chat"} size={18} /></span>
                  <span className="dash-rowtext"><small data-urgent={a.offers || undefined}>{a.tag}</small><b className="dash-wrap">{a.text}</b></span>
                  <span className="dash-chev" aria-hidden="true"><AppIcon name="chevron" size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dash-card" aria-labelledby="dash-figures">
        <div className="dash-cardhead"><div><h2 id="dash-figures">{t("buyerFiguresTitle")}</h2></div></div>
        <div className="dash-kpis dash-kpis-3" aria-label={t("kpisLabel")}>
          {kpis.map((k) => (
            <div key={k.key} className="dash-kpi" data-kpi={k.key}>
              <small>{t(`buyerKpi_${k.key}`)}</small>
              <b data-kpi-value={k.value} data-tone={k.key === "toDecide" && k.value > 0 ? "warm" : undefined}>{format.number(k.value)}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-card" aria-labelledby="dash-recent">
        <div className="dash-cardhead">
          <div><h2 id="dash-recent">{t("buyerRecentTitle")}</h2></div>
          <Link href="/rfq" className="dash-btn">{t("buyerAllRequests")}</Link>
        </div>
        {data.recent.length === 0 ? (
          <div className="dash-empty">
            <span className="dash-empty-ico"><AppIcon name="filePlus" size={22} /></span>
            <p><b>{t("buyerRecentEmpty")}</b><br /><Link href="/producers" className="underline">{t("buyerBrowse")}</Link></p>
          </div>
        ) : (
          <ul className="dash-list">
            {data.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/rfq/${r.id}`} className="dash-row dash-row-rfq">
                  <span className="dash-rowtext">
                    <span className="dash-rfqhead"><small dir="ltr">{r.reference}</small><StatusBadge status={r.status} label={tr(`status_${r.status}`)} /></span>
                    <b>{r.title}</b>
                    <span>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}</span>
                  </span>
                  <span className="dash-progress"><Progress stage={stageOf(r.status)} label={tr(`stage_${r.status}`, { count: (r.offers ?? []).filter((o) => o.status === "published").length })} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.producers.length > 0 && (
        <section className="dash-card" aria-labelledby="dash-producers">
          <div className="dash-cardhead">
            <div><h2 id="dash-producers">{data.matchesInterests ? t("buyerProducersTitle") : t("buyerProducersTitleAll")}</h2></div>
            <Link href="/producers" className="dash-btn">{t("buyerBrowse")}</Link>
          </div>
          <div className="dash-producers">
            {data.producers.map((p) => (
              <article key={p.id} className="dash-producer" data-producer={p.slug}>
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo} alt="" width={48} height={48} className="dash-producer-logo" />
                ) : (
                  <span className="dash-producer-logo" style={{ background: p.color, color: "white" }}>{p.initials}</span>
                )}
                <div className="min-w-0">
                  <Link href={`/producers/${p.slug}`} className="font-bold hover:underline">{p.name}</Link>
                  <p className="dash-muted" style={{ margin: 0 }}>{[p.location, p.wilaya].filter(Boolean).join(", ")}</p>
                  {isSector(p.sector) && <span className="dash-tag" style={{ marginTop: 8 }}>{ts(p.sector)}</span>}
                </div>
                <Link href={`/rfq/new?producer=${p.slug}`} className="dash-btn dash-btn-full">{t("buyerAskQuote")}</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
