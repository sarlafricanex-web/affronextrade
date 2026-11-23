import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ProducerDashboard as Data } from "@/lib/data/dashboard";
import { countryName } from "@/lib/countries";
import { AppIcon, type IconName } from "@/components/app/icons";

// Tableau de bord producteur, structure Europages (24 novembre 2026) : bandeau de completion de la
// fiche, puis une colonne de cartes (a faire, statistiques, demandes, catalogue et abonnement,
// interlocuteur). Contenu reel uniquement : rien d'invente.
export async function ProducerDashboard({ locale, firstName, companyName, published, data }: { locale: string; firstName: string; companyName: string; published: boolean; data: Data }) {
  const [t, tr, format] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "requests" }),
    getFormatter({ locale }),
  ]);
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "medium" }) : "-");
  const nf = (n: number) => format.number(n);
  const variation = data.viewsPrevious ? Math.round(((data.views30 - data.viewsPrevious) / data.viewsPrevious) * 100) : null;
  const complete = data.completion.percent >= 100;

  const kpis = [
    { key: "views", value: nf(data.views30), note: variation === null ? t("kpiViewsNoCompare") : t("kpiViewsVariation", { sign: variation >= 0 ? "+" : "", value: variation }) },
    { key: "received", value: nf(data.received), note: t("kpiReceivedNote", { count: data.toDo.length }) },
    { key: "quotes", value: nf(data.quotesSent), note: t("kpiQuotesNote", { count: data.selected }) },
    { key: "selection", value: data.selectionRate === null ? "-" : `${nf(data.selectionRate)} %`, note: t("kpiSelectionNote") },
  ];

  // A faire : uniquement ce qui attend vraiment le producteur.
  type Action = { key: string; urgent: boolean; icon: IconName; label: string; text: string; href: string };
  const actions: Action[] = [
    ...data.toDo.slice(0, 5).map((r) => {
      const urgent = r.hoursLeft !== null && r.hoursLeft < 72;
      return { key: `req-${r.id}`, urgent, icon: "inbox" as IconName, label: urgent ? t("actionUrgent", { hours: Math.max(r.hoursLeft ?? 0, 0) }) : t("actionRequest"), text: t("actionRequestText", { title: r.brief_title, date: date(r.respond_by) }), href: `/requests/${r.id}` };
    }),
    ...data.unreadRequests.map((r) => ({ key: `msg-${r.id}`, urgent: false, icon: "chat" as IconName, label: t("actionMessage"), text: t("actionMessageText", { reference: r.reference }), href: `/requests/${r.id}#messages` })),
    ...(data.expiredPrices ? [{ key: "prices", urgent: true, icon: "coin" as IconName, label: t("actionPrices"), text: t("actionPricesText", { count: data.expiredPrices }), href: "/catalog" }] : []),
    ...(!data.productCount ? [{ key: "product", urgent: false, icon: "box" as IconName, label: t("actionCatalog"), text: t("actionNoProduct"), href: "/catalog/new" }] : []),
    ...(!complete ? [{ key: "profile", urgent: false, icon: "building" as IconName, label: t("actionProfile"), text: t("actionProfileText", { percent: data.completion.percent }), href: "/company" }] : []),
  ];

  return (
    <div className="dash" data-dashboard="producer">
      {/* Bandeau : completer la fiche (comme le bandeau de verification de la reference), ou accueil. */}
      <section className="dash-banner" aria-labelledby="dash-hello" data-completion={data.completion.percent}>
        <h1 id="dash-hello">{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>
        <p>{companyName} · {published ? t("profileOnline") : t("profileDraft")}</p>
        {complete ? (
          <Link href="/requests" className="dash-banner-btn">{t("ctaRequests")}</Link>
        ) : (
          <>
            <p className="dash-banner-sub">{t("bannerCompletion", { percent: data.completion.percent })}</p>
            <div className="dash-banner-bar" role="progressbar" aria-valuenow={data.completion.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("completionTitle")}>
              <span style={{ width: `${data.completion.percent}%` }} />
            </div>
            <div className="dash-pills"><span>{t("bannerWhy1")}</span><span>{t("bannerWhy2")}</span></div>
            <Link href="/company" className="dash-banner-btn">{t("completionCta")}</Link>
          </>
        )}
      </section>

      <section className="dash-card" aria-labelledby="dash-todo" data-actions={actions.length}>
        <div className="dash-cardhead"><div><h2 id="dash-todo">{t("actionsTitle", { count: actions.length })}</h2><p>{t("actionsHelp")}</p></div></div>
        {actions.length === 0 ? (
          <div className="dash-empty"><span className="dash-empty-ico"><AppIcon name="check" size={22} /></span><p><b>{t("actionsEmpty")}</b></p></div>
        ) : (
          <ul className="dash-list">
            {actions.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="dash-row" data-action-item={a.key}>
                  <span className={`dash-kind ${a.urgent ? "dash-kind-moderation" : "dash-kind-requests"}`}><AppIcon name={a.icon} size={18} /></span>
                  <span className="dash-rowtext"><small data-urgent={a.urgent || undefined}>{a.label}</small><b className="dash-wrap">{a.text}</b></span>
                  <span className="dash-chev" aria-hidden="true"><AppIcon name="chevron" size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card" aria-labelledby="dash-stats">
        <div className="dash-cardhead"><div><h2 id="dash-stats">{t("statsTitle")}</h2><p>{t("statsHelp")}</p></div></div>
        <div className="dash-kpis" aria-label={t("kpisLabel")}>
          {kpis.map((k) => (
            <div key={k.key} className="dash-kpi" data-kpi={k.key}>
              <small>{t(`kpi_${k.key}`)}</small>
              <b data-kpi-value={k.value}>{k.value}</b>
              <span>{k.note}</span>
            </div>
          ))}
        </div>
        <div className="dash-subblock" data-countries={data.topCountries.length}>
          <h3>{t("countriesTitle")}</h3>
          {data.topCountries.length === 0 ? (
            <p className="dash-muted">{t("countriesEmpty")}</p>
          ) : (
            <ul className="dash-countries">
              {data.topCountries.map(([code, n]) => <li key={code}><span>{countryName(code, locale)}</span><b>{nf(n)}</b></li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="dash-card" aria-labelledby="dash-recent">
        <div className="dash-cardhead">
          <div><h2 id="dash-recent">{t("recentTitle")}</h2><p>{t("recentHelp")}</p></div>
          <Link href="/requests" className="dash-btn">{t("seeAll")}</Link>
        </div>
        {data.recentRequests.length === 0 ? (
          <div className="dash-empty"><span className="dash-empty-ico"><AppIcon name="inbox" size={22} /></span><p><b>{t("recentEmpty")}</b></p></div>
        ) : (
          <ul className="dash-list">
            {data.recentRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="dash-row">
                  <span className="dash-kind dash-kind-requests"><AppIcon name="file" size={18} /></span>
                  <span className="dash-rowtext"><small dir="ltr">{r.reference} · {date(r.created_at)}</small><b>{r.brief_title}</b></span>
                  <span className="dash-tag">{r.quote ? tr(`quote_${r.quote.status}`) : tr(`dispatch_${r.status}`)}</span>
                  <span className="dash-chev" aria-hidden="true"><AppIcon name="chevron" size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card dash-split">
        <div>
          <h2>{t("catalogTitle")}</h2>
          <p className="dash-muted">{t("catalogText", { total: data.productCount, published: data.publishedCount })}</p>
          <Link href="/catalog" className="dash-btn">{t("ctaCatalog")}</Link>
        </div>
        <div data-tier={data.tier}>
          <h2>{t("planTitle")}</h2>
          <p className="dash-plan">{t(`plan_${data.tier}`)}</p>
          <Link href="/subscription" className="dash-btn">{t("planCta")}</Link>
        </div>
      </section>

      <section className="dash-card dash-contact" aria-labelledby="dash-contact">
        <div>
          <h2 id="dash-contact">{t("contactTitle")}</h2>
          <p className="dash-muted">{t("contactText")}</p>
        </div>
        <div className="dash-contact-lines">
          <a href="mailto:sarlafricanex@gmail.com" dir="ltr"><AppIcon name="mail" size={18} />sarlafricanex@gmail.com</a>
          <a href="tel:+213770960270" dir="ltr"><AppIcon name="chat" size={18} />+213 770 96 02 70</a>
        </div>
      </section>
    </div>
  );
}
