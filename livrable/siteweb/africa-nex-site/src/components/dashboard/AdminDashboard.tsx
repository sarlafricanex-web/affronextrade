"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import type { AdminCockpit, QueueGroup, QueueItem, QueueKind } from "@/lib/data/admin-cockpit";
import { AppIcon, type IconName } from "@/components/app/icons";

// Poste de pilotage d'AFRICA NEX (variante "Emeraude", choisie par Adlene le 23 novembre 2026) :
// bandeau d'accueil, file "A traiter" triee par anciennete et filtrable, chiffres du mois,
// objectif des 80 producteurs.

const ICON: Record<QueueKind, IconName> = {
  rfq: "file", quote: "inbox", currency: "swap", message: "chat", claim: "flag",
  review: "star", document: "check", deletion: "trash", subscription: "coin", contact: "mail",
};
const GROUPS: (QueueGroup | "all")[] = ["all", "requests", "moderation", "accounts"];
const LATE_DAYS = 3;

export function AdminDashboard({ data, firstName }: { data: AdminCockpit; firstName: string }) {
  const now = data.generatedAt;
  const t = useTranslations("cockpit");
  const locale = useLocale();
  const [group, setGroup] = useState<QueueGroup | "all">("all");
  const days = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / 864e5));
  const age = (iso: string) => t("age", { days: days(iso) });
  const total = data.queue.length;
  const oldest = data.queue[0];
  const items = data.queue.filter((q) => group === "all" || q.group === group);
  const count = (g: QueueGroup | "all") => (g === "all" ? total : data.counts[g]);
  const k = data.kpis;
  const nf = (n: number) => n.toLocaleString(locale === "ar" ? "ar-DZ" : locale === "en" ? "en-US" : "fr-FR");

  // Texte d'une ligne, compose ici dans la langue de l'admin.
  function lineOf(q: QueueItem): { title: string; sub: string } {
    const ref = q.ref ?? "";
    switch (q.kind) {
      case "rfq": return { title: q.title ?? "", sub: [ref, q.country ? countryName(q.country, locale) : ""].filter(Boolean).join(" · ") };
      case "quote": return { title: q.title ?? t("unknownProducer"), sub: ref };
      case "currency": return { title: t("currencyTitle", { label: q.label ?? "", from: q.from ?? "", to: q.to ?? "" }), sub: ref };
      case "message": return { title: t(q.role === "buyer" ? "messagesFromBuyer" : "messagesFromProducer", { count: q.count ?? 1 }), sub: ref };
      case "claim": return { title: q.title ?? "", sub: "" };
      case "review": return { title: q.title ?? "", sub: t("reviewRating", { rating: q.rating ?? 0 }) };
      case "document": return { title: q.title ?? t(`doc_${q.label ?? "other"}`), sub: ref };
      case "deletion": return { title: q.title ?? "", sub: t(q.role === "producer" ? "roleProducer" : "roleBuyer") };
      case "subscription": return { title: q.title ?? "", sub: `${t.has(`plan_${q.plan}`) ? t(`plan_${q.plan}`) : q.plan ?? ""} · ${nf(q.amount ?? 0)} DZD` };
      case "contact": return { title: q.title ?? "", sub: "" };
    }
  }

  const pct = Math.min(100, Math.round((k.producersClaimed / k.producersTarget) * 100));
  return (
    <div className="dash" data-dashboard="admin">
      <section className="dash-banner" aria-labelledby="dash-hello">
        <h1 id="dash-hello">{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>
        <p data-queue-total={total}>
          {total === 0 ? t("allClear") : t.rich("waiting", { count: total, age: oldest ? age(oldest.at).toLowerCase() : "", b: (c) => <b>{c}</b> })}
        </p>
        <div className="dash-pills">
          <span>{t("pillRequests", { count: data.counts.requests })}</span>
          <span>{t("pillModeration", { count: data.counts.moderation })}</span>
          <span>{t("pillAccounts", { count: data.counts.accounts })}</span>
        </div>
        {oldest && <Link href={oldest.href} className="dash-banner-btn">{t("handleOldest")}</Link>}
      </section>

      <section className="dash-card" id="a-traiter" aria-labelledby="dash-queue">
        <div className="dash-cardhead"><div><h2 id="dash-queue">{t("queueTitle")}</h2><p>{t("queueHelp")}</p></div></div>
        <div className="dash-tabs" role="tablist" aria-label={t("filter")}>
          {GROUPS.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={group === g} className="dash-tab" onClick={() => setGroup(g)} data-group={g}>
              {t(`group_${g}`)}<span>{count(g)}</span>
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="dash-empty" data-queue-empty="">
            <span className="dash-empty-ico"><AppIcon name="check" size={22} /></span>
            <p><b>{t("emptyTitle")}</b><br />{t("emptyText")}</p>
          </div>
        ) : (
          <ul className="dash-list">
            {items.map((q, i) => {
              const { title, sub } = lineOf(q);
              const d = days(q.at);
              return (
                <li key={`${q.kind}-${i}`}>
                  <Link href={q.href} className="dash-row" data-queue-kind={q.kind}>
                    <span className={`dash-kind dash-kind-${q.group}`}><AppIcon name={ICON[q.kind]} size={18} /></span>
                    <span className="dash-rowtext">
                      <small>{t(`kind_${q.kind}`)}</small>
                      <b>{title}</b>
                      {sub && <span>{sub}</span>}
                    </span>
                    <span className="dash-age" data-late={d >= LATE_DAYS || undefined}>{age(q.at)}</span>
                    <span className="dash-chev" aria-hidden="true"><AppIcon name="chevron" size={18} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dash-card" aria-labelledby="dash-month">
        <div className="dash-cardhead"><div><h2 id="dash-month">{t("monthTitle")}</h2><p>{t("monthHelp")}</p></div></div>
        <div className="dash-kpis">
          <div className="dash-kpi" data-kpi="rfqs"><small>{t("kpiRfqs")}</small><b>{nf(k.rfqsThisMonth)}</b></div>
          <div className="dash-kpi" data-kpi="offers"><small>{t("kpiOffers")}</small><b>{nf(k.offersThisMonth)}</b></div>
          <div className="dash-kpi" data-kpi="acceptance"><small>{t("kpiAcceptance")}</small><b>{k.acceptance === null ? "–" : `${nf(k.acceptance)} %`}</b><span>{t("kpiAcceptanceHint", { count: k.decided })}</span></div>
          <div className="dash-kpi" data-kpi="listed"><small>{t("kpiListed")}</small><b>{nf(k.producersListed)}</b><span>{t("kpiListedHint", { count: k.producersClaimed })}</span></div>
        </div>
      </section>

      <section className="dash-card" aria-labelledby="dash-goal">
        <div className="dash-cardhead"><div><h2 id="dash-goal">{t("goalTitle")}</h2><p>{t("goalHelp")}</p></div></div>
        <p className="dash-goal"><b>{nf(k.producersClaimed)}</b> / {t("goalTarget", { count: k.producersTarget })}</p>
        <div className="dash-bar" role="progressbar" aria-valuemin={0} aria-valuemax={k.producersTarget} aria-valuenow={k.producersClaimed} aria-label={t("goalTitle")}><span style={{ width: `${pct}%` }} /></div>
        <p className="dash-muted">{t("goalRemaining", { count: k.producersListed - k.producersClaimed })}</p>
      </section>
    </div>
  );
}
