"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminCockpit, QueueGroup, QueueItem, QueueKind } from "@/lib/data/admin-cockpit";

// PROTOTYPE : trois variantes du tableau de bord admin dans la structure Europages (barre du haut,
// menu de gauche, colonne de cartes). Le selecteur (pilule sombre en bas) suit le cahier de la skill
// prototype a l'identique. A supprimer apres le choix d'Adlene.

type Props = { data: AdminCockpit; name: string; locale: string };

/* ------------------------------------------------------------------ icones (trait 1,75) */
const PATHS: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  inbox: "M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.4A8 8 0 1 1 21 12z",
  building: "M4 21V5l8-2v18M12 7l8 3v11M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01M3 21h18",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevron: "M9 6l6 6-6 6",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  swap: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  menu: "M4 6h16M4 12h16M4 18h16",
  check: "M5 12l5 5L20 7",
};
function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ libelles */
const KIND: Record<QueueKind, { label: string; icon: keyof typeof PATHS }> = {
  rfq: { label: "Demande à qualifier", icon: "file" },
  quote: { label: "Devis reçu", icon: "inbox" },
  currency: { label: "Autre devise demandée", icon: "swap" },
  message: { label: "Message non lu", icon: "chat" },
  claim: { label: "Revendication de fiche", icon: "flag" },
  review: { label: "Avis à modérer", icon: "star" },
  document: { label: "Document à vérifier", icon: "check" },
  deletion: { label: "Suppression de compte", icon: "trash" },
  subscription: { label: "Paiement d'abonnement", icon: "coin" },
  contact: { label: "Formulaire de contact", icon: "mail" },
};
const GROUPS: { key: QueueGroup | "all"; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "requests", label: "Demandes" },
  { key: "moderation", label: "Modération" },
  { key: "accounts", label: "Comptes" },
];
const days = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5));
const ageLabel = (d: number) => (d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `${d} jours`);

/* ------------------------------------------------------------------ jeu d'exemple (liste pleine) */
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
function sample(real: AdminCockpit): AdminCockpit {
  const queue: QueueItem[] = [
    { kind: "rfq", group: "requests", title: "Huile d'olive extra vierge, bidons de 5 L", detail: "RFQ-2026-7F31A2 · Côte d'Ivoire", href: "#", at: ago(96) },
    { kind: "message", group: "requests", title: "2 messages de l'acheteur", detail: "RFQ-2026-2C6792", href: "#", at: ago(70) },
    { kind: "quote", group: "requests", title: "Huilerie Demo Soummam", detail: "RFQ-2026-F35C9A", href: "#", at: ago(50) },
    { kind: "claim", group: "moderation", title: "Biscuiterie Bimo", detail: "Revendication de fiche", href: "#", at: ago(30) },
    { kind: "currency", group: "requests", title: "Offre B : EUR vers USD", detail: "RFQ-2026-2C6792", href: "#", at: ago(26) },
    { kind: "document", group: "moderation", title: "Certificat ISO 22000", detail: "Agrodiv", href: "#", at: ago(20) },
    { kind: "subscription", group: "accounts", title: "Ceramique Saida", detail: "croissance · 400 000 DZD", href: "#", at: ago(9) },
    { kind: "review", group: "moderation", title: "Cevital", detail: "Avis 4/5 à modérer", href: "#", at: ago(5) },
    { kind: "rfq", group: "requests", title: "Dattes Deglet Nour en vrac, 2 conteneurs de 40 pieds", detail: "RFQ-2026-9B04D1 · Sénégal", href: "#", at: ago(3) },
    { kind: "contact", group: "accounts", title: "Dakar Négoce", detail: "Formulaire de contact", href: "#", at: ago(1) },
  ];
  return { ...real, queue, counts: { requests: 6, moderation: 3, accounts: 2 } };
}

/* ------------------------------------------------------------------ structure commune */
type Tone = "dark" | "light";
function nav(locale: string, data: AdminCockpit) {
  const byKind = (k: QueueKind[]) => data.queue.filter((q) => k.includes(q.kind)).length;
  return [
    { group: null, items: [{ icon: "grid", label: "Tableau de bord", href: `/${locale}/dashboard`, active: true }] },
    { group: "Activité", items: [
      { icon: "file", label: "Demandes de devis", href: `/${locale}/admin/rfqs`, badge: byKind(["rfq", "quote", "currency", "message"]) },
      { icon: "mail", label: "Formulaire de contact", href: `/${locale}/admin`, badge: byKind(["contact"]) },
    ] },
    { group: "Annuaire", items: [
      { icon: "building", label: "Producteurs", href: `/${locale}/admin/producers`, badge: byKind(["document"]) },
      { icon: "flag", label: "Revendications", href: `/${locale}/admin/claims`, badge: byKind(["claim"]) },
      { icon: "star", label: "Avis", href: `/${locale}/admin/reviews`, badge: byKind(["review"]) },
    ] },
    { group: "Administration", items: [
      { icon: "users", label: "Comptes", href: `/${locale}/admin/accounts`, badge: byKind(["deletion", "subscription"]) },
      { icon: "gear", label: "Réglages", href: `/${locale}/admin/settings` },
    ] },
  ] as { group: string | null; items: { icon: keyof typeof PATHS; label: string; href: string; active?: boolean; badge?: number }[] }[];
}

function Shell({ tone, data, name, locale, children }: { tone: Tone; data: AdminCockpit; name: string; locale: string; children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "A";
  const unread = data.queue.filter((q) => q.kind === "message").length;
  const total = data.queue.length;
  async function signOut() { await createClient().auth.signOut(); location.href = `/${locale}/login`; }
  return (
    <div className={`pd pd-${tone}`}>
      <header className="pd-top">
        <button type="button" className="pd-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="menu" /></button>
        <a href={`/${locale}`} className="pd-logo" aria-label="AFRICA NEX, accueil du site">
          <img src={tone === "dark" ? "/images/logo-light.svg" : "/images/logo.svg"} alt="AFRICA NEX" height={34} />
        </a>
        <nav className="pd-topnav" aria-label="Raccourcis">
          <a href={`/${locale}/admin/rfqs`}><Icon name="file" /><span>Demandes de devis</span></a>
          <a href={`/${locale}/admin/producers`}><Icon name="building" /><span>Producteurs</span></a>
          <a href={`/${locale}/admin/rfqs`} className="pd-has-badge"><Icon name="chat" /><span>Messages</span>{unread > 0 && <b className="pd-dot">{unread}</b>}</a>
        </nav>
        <div className="pd-topright">
          <a href="#a-traiter" className="pd-square pd-has-badge" aria-label={`${total} éléments à traiter`}><Icon name="bell" />{total > 0 && <b className="pd-dot">{total}</b>}</a>
          <span className="pd-square pd-avatar" title={name}>{initials}</span>
          <span className="pd-square pd-lang">FR</span>
        </div>
      </header>
      <div className="pd-body">
        <aside className="pd-side" data-open={menu || undefined}>
          <div className="pd-who"><span className="pd-avatar-sm">{initials}</span><span><b>{name}</b><small>Administration AFRICA NEX</small></span></div>
          {nav(locale, data).map((g, i) => (
            <div key={i} className="pd-navgroup">
              {g.group && <p className="pd-navlabel">{g.group}</p>}
              {g.items.map((it) => (
                <a key={it.label} href={it.href} className="pd-navitem" aria-current={it.active ? "page" : undefined}>
                  <Icon name={it.icon} /><span>{it.label}</span>{!!it.badge && <b className="pd-count">{it.badge}</b>}
                </a>
              ))}
            </div>
          ))}
          <button type="button" className="pd-navitem pd-logout" onClick={signOut}><Icon name="logout" /><span>Se déconnecter</span></button>
        </aside>
        <main className="pd-main">
          {children}
          <footer className="pd-legal">
            <span>© 2026 SARL AFRICA NEX</span>
            <a href={`/${locale}/legal`}>Mentions légales</a><a href={`/${locale}/privacy`}>Confidentialité</a><a href={`/${locale}/terms`}>CGU</a><a href={`/${locale}/sales`}>CGV</a>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ blocs de contenu */
function Queue({ data, compact = false }: { data: AdminCockpit; compact?: boolean }) {
  const [group, setGroup] = useState<QueueGroup | "all">("all");
  const items = data.queue.filter((q) => group === "all" || q.group === group);
  const count = (g: QueueGroup | "all") => (g === "all" ? data.queue.length : data.counts[g]);
  return (
    <section className="pd-card" id="a-traiter" aria-labelledby="q-title">
      <div className="pd-cardhead">
        <div><h2 id="q-title">À traiter</h2><p>Du plus ancien au plus récent. Un clic ouvre l'écran qui permet d'agir.</p></div>
      </div>
      <div className="pd-tabs" role="tablist" aria-label="Filtrer">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={group === g.key} className="pd-tab" onClick={() => setGroup(g.key)}>
            {g.label}<span>{count(g.key)}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="pd-empty"><span className="pd-empty-ico"><Icon name="check" size={22} /></span><p><b>Rien n'attend d'action ici.</b><br />Les nouvelles demandes, devis et messages apparaîtront dans cette liste dès leur arrivée.</p></div>
      ) : (
        <ul className={`pd-list${compact ? " pd-list-compact" : ""}`}>
          {items.map((q, i) => <QueueRow key={i} q={q} />)}
        </ul>
      )}
    </section>
  );
}
function QueueRow({ q }: { q: QueueItem }) {
  const d = days(q.at);
  return (
    <li>
      <a href={q.href} className="pd-row">
        <span className={`pd-kind pd-kind-${q.group}`}><Icon name={KIND[q.kind].icon} size={18} /></span>
        <span className="pd-rowtext">
          <small>{KIND[q.kind].label}</small>
          <b>{q.title}</b>
          {q.detail && <span>{q.detail}</span>}
        </span>
        <span className="pd-age" data-late={d >= 3 || undefined}>{ageLabel(d)}</span>
        <span className="pd-chev"><Icon name="chevron" size={18} /></span>
      </a>
    </li>
  );
}
function Kpis({ data, stacked = false }: { data: AdminCockpit; stacked?: boolean }) {
  const k = data.kpis;
  const cells = [
    { label: "Demandes reçues ce mois", value: String(k.rfqsThisMonth) },
    { label: "Offres publiées ce mois", value: String(k.offersThisMonth) },
    { label: "Taux d'acceptation", value: k.acceptance === null ? "–" : `${k.acceptance} %`, hint: k.decided ? `sur ${k.decided} offre${k.decided > 1 ? "s" : ""} décidée${k.decided > 1 ? "s" : ""}` : "aucune offre décidée" },
    { label: "Fiches au catalogue", value: String(k.producersListed), hint: `${k.producersClaimed} gérée${k.producersClaimed > 1 ? "s" : ""} par le producteur` },
  ];
  return (
    <section className="pd-card" aria-labelledby="k-title">
      <div className="pd-cardhead"><div><h2 id="k-title">Ce mois-ci</h2><p>Activité de la plateforme depuis le 1er du mois.</p></div></div>
      <div className={stacked ? "pd-kpis pd-kpis-stack" : "pd-kpis"}>
        {cells.map((c) => <div key={c.label} className="pd-kpi"><small>{c.label}</small><b>{c.value}</b>{c.hint && <span>{c.hint}</span>}</div>)}
      </div>
    </section>
  );
}
function Goal({ data }: { data: AdminCockpit }) {
  const k = data.kpis;
  const pct = Math.min(100, Math.round((k.producersClaimed / k.producersTarget) * 100));
  return (
    <section className="pd-card" aria-labelledby="g-title">
      <div className="pd-cardhead"><div><h2 id="g-title">Objectif avril 2027</h2><p>Producteurs inscrits qui gèrent eux-mêmes leur fiche.</p></div></div>
      <p className="pd-goal"><b>{k.producersClaimed}</b> / {k.producersTarget} producteurs</p>
      <div className="pd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={k.producersTarget} aria-valuenow={k.producersClaimed} aria-label="Producteurs inscrits"><span style={{ width: `${pct}%` }} /></div>
      <p className="pd-muted">{k.producersListed - k.producersClaimed} fiches établies par AFRICA NEX attendent encore leur producteur.</p>
    </section>
  );
}
function Banner({ data, name, tone }: { data: AdminCockpit; name: string; tone: "brand" | "plain" }) {
  const n = data.queue.length;
  const oldest = data.queue[0];
  const first = name.split(/\s+/)[0] || "Adlene";
  return (
    <section className={`pd-banner pd-banner-${tone}`} aria-labelledby="b-title">
      <h1 id="b-title">Bonjour {first}</h1>
      {n === 0 ? <p>Tout est à jour : aucune demande, aucun devis ni aucune validation n'attend.</p> : (
        <p><b>{n}</b> élément{n > 1 ? "s" : ""} attend{n > 1 ? "ent" : ""} une action{oldest ? <>, le plus ancien depuis <b>{ageLabel(days(oldest.at)).toLowerCase()}</b></> : null}.</p>
      )}
      <div className="pd-pills">
        <span>{data.counts.requests} demandes et devis</span><span>{data.counts.moderation} validations</span><span>{data.counts.accounts} comptes et contacts</span>
      </div>
      {oldest && <a href={oldest.href} className="pd-btn">Traiter le plus ancien</a>}
    </section>
  );
}

/* ------------------------------------------------------------------ variantes */
const variants: { name: string; render: (p: Props) => React.ReactNode }[] = [
  { name: "Émeraude", render: (p) => (
    <Shell tone="dark" {...p}><div className="pd-col"><Banner data={p.data} name={p.name} tone="brand" /><Queue data={p.data} /><Kpis data={p.data} /><Goal data={p.data} /></div></Shell>
  ) },
  { name: "Clair", render: (p) => (
    <Shell tone="light" {...p}><div className="pd-col"><Banner data={p.data} name={p.name} tone="plain" /><Queue data={p.data} /><Kpis data={p.data} /><Goal data={p.data} /></div></Shell>
  ) },
  { name: "Dense", render: (p) => (
    <Shell tone="dark" {...p}>
      <div className="pd-dense-head"><h1>Bonjour {p.name.split(/\s+/)[0] || "Adlene"}</h1><p>{p.data.queue.length} élément{p.data.queue.length > 1 ? "s" : ""} à traiter</p></div>
      <div className="pd-two"><Queue data={p.data} compact /><div className="pd-col"><Kpis data={p.data} stacked /><Goal data={p.data} /></div></div>
    </Shell>
  ) },
];

/* ------------------------------------------------------------------ selecteur (cahier PICKER.md, a l'identique) */
export function Harness(props: Props) {
  const [current, setCurrent] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const [demo, setDemo] = useState(false);
  const shown = demo ? { ...props, data: sample(props.data) } : props;
  const picker = useRef<HTMLElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const setActive = (i: number) => {
    if (i < 0 || i >= variants.length) return;
    setCurrent(i);
    setMountKey((k) => k + 1);
    const url = new URL(location.href);
    url.searchParams.set("v", String(i + 1));
    history.replaceState(null, "", url);
  };
  useLayoutEffect(() => {
    const el = items.current[current];
    if (el && highlight.current) { highlight.current.style.width = `${el.offsetWidth}px`; highlight.current.style.transform = `translateX(${el.offsetLeft}px)`; }
  }, [current]);
  useEffect(() => {
    const requested = parseInt(new URLSearchParams(location.search).get("v") ?? "", 10);
    if (requested >= 1 && requested <= variants.length) setCurrent(requested - 1);
    requestAnimationFrame(() => requestAnimationFrame(() => picker.current?.setAttribute("data-ready", "")));
    const onResize = () => { const el = items.current[current]; if (el && highlight.current) { highlight.current.style.width = `${el.offsetWidth}px`; highlight.current.style.transform = `translateX(${el.offsetLeft}px)`; } };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= variants.length) setActive(num - 1);
      else if (e.key === "ArrowRight") setActive((current + 1) % variants.length);
      else if (e.key === "ArrowLeft") setActive((current - 1 + variants.length) % variants.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pd-overlay">
      <style>{CSS}</style>
      <div key={`${mountKey}-${demo}`}>{variants[current].render(shown)}</div>
      {/* Hors selecteur : bascule de donnees pour juger la liste vide et la liste pleine. */}
      <div className="proto-data" role="group" aria-label="Données affichées">
        <button type="button" aria-pressed={!demo} onClick={() => setDemo(false)}>Données réelles</button>
        <button type="button" aria-pressed={demo} onClick={() => setDemo(true)}>Exemple chargé</button>
      </div>
      <nav className="proto-picker" aria-label="Prototype variants" ref={picker}>
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlight} />
        {variants.map((v, i) => (
          <button key={v.name} ref={(el) => { items.current[i] = el; }} className="proto-picker-item" data-active={i === current || undefined} aria-current={i === current ? "true" : undefined} onClick={() => setActive(i)}>
            {v.name}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */
const CSS = `
.pd-overlay { position: fixed; inset: 0; z-index: 1000; overflow: auto; background: #f4f1ea; }
.pd { --chrome: #0b3a2c; --chrome-2: #0f4a37; --line: #e3dccd; --card: #fff; --ground: #f4f1ea; --ink: #0f172a; --muted: #5c5347; --act: #047857; --act-text: #065f46; --late: #c2410c;
  min-height: 100%; background: var(--chrome); color: var(--ink); font-size: 15px; }
.pd-light { --chrome: #ffffff; background: #ffffff; }
.pd a { color: inherit; text-decoration: none; }

/* barre du haut : 60 px, comme la reference */
.pd-top { position: sticky; top: 0; z-index: 5; height: 60px; display: flex; align-items: center; gap: 24px; padding: 0 24px 0 28px; background: var(--chrome); color: #fff; }
.pd-light .pd-top { color: var(--ink); border-bottom: 1px solid var(--line); }
.pd-logo { display: flex; align-items: center; }
.pd-logo img { height: 34px; width: auto; }
.pd-topnav { margin-inline-start: auto; display: flex; align-items: stretch; gap: 4px; }
.pd-topnav a { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; line-height: 1.2; }
.pd-topnav a:hover, .pd-square:hover { background: rgba(255,255,255,0.1); }
.pd-light .pd-topnav a:hover, .pd-light .pd-square:hover { background: #f1ede4; }
.pd-topright { display: flex; align-items: center; gap: 8px; }
.pd-square { position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(255,255,255,0.08); font-size: 13px; font-weight: 700; }
.pd-light .pd-square { background: #f6f3ec; }
.pd-avatar { background: #fff !important; color: var(--chrome-2); border-radius: 999px; width: 38px; height: 38px; margin: 0 3px; }
.pd-light .pd-avatar { background: #ecfdf5 !important; color: var(--act-text); }
.pd-dot { position: absolute; top: 2px; inset-inline-end: 4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--late); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
.pd-burger { display: none; background: none; border: 0; color: inherit; padding: 6px; border-radius: 6px; }

/* menu de gauche : 264 px */
.pd-body { display: flex; align-items: flex-start; }
.pd-side { position: sticky; top: 60px; width: 264px; flex-shrink: 0; height: calc(100vh - 60px); overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 20px 16px 16px; color: #fff; background: linear-gradient(180deg, var(--chrome) 0%, var(--chrome) 55%, var(--chrome-2) 100%); }
.pd-light .pd-side { color: var(--ink); background: #fff; border-inline-end: 1px solid var(--line); }
.pd-who { display: flex; align-items: center; gap: 12px; padding: 4px 8px 16px; }
.pd-who b { display: block; font-size: 15px; }
.pd-who small { display: block; font-size: 12px; opacity: .72; }
.pd-avatar-sm { width: 36px; height: 36px; border-radius: 999px; background: #fff; color: var(--chrome-2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
.pd-light .pd-avatar-sm { background: #ecfdf5; color: var(--act-text); }
.pd-navgroup { display: flex; flex-direction: column; gap: 2px; }
.pd-navlabel { margin: 14px 8px 4px; font-size: 12px; opacity: .7; }
.pd-navitem { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 8px 12px; border-radius: 8px; font-size: 15px; font-weight: 600; background: none; border: 0; color: inherit; text-align: start; cursor: pointer; transition: background 150ms ease-out; }
.pd-navitem:hover { background: rgba(255,255,255,0.08); }
.pd-navitem[aria-current="page"] { background: rgba(255,255,255,0.16); }
.pd-light .pd-navitem:hover { background: #f6f3ec; }
.pd-light .pd-navitem[aria-current="page"] { background: #ecfdf5; color: var(--act-text); }
.pd-count { margin-inline-start: auto; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 12px; line-height: 22px; text-align: center; }
.pd-light .pd-count { background: #f1ede4; }
.pd-logout { margin-top: auto; opacity: .85; }

/* zone de contenu : panneau clair au coin arrondi, comme la reference */
.pd-main { flex: 1; min-width: 0; min-height: calc(100vh - 60px); background: var(--ground); border-start-start-radius: 24px; padding: 16px 16px 0; display: flex; flex-direction: column; }
.pd-light .pd-main { border-radius: 0; padding-top: 24px; }
.pd-col { display: flex; flex-direction: column; gap: 16px; }
.pd-card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 32px; }
.pd-cardhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.pd-card h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.pd-cardhead p { margin: 6px 0 0; color: var(--muted); }
.pd-muted { color: var(--muted); font-size: 14px; margin: 12px 0 0; }

.pd-banner { border-radius: 12px; padding: 36px 32px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.pd-banner h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.pd-banner p { margin: 0; font-size: 16px; }
.pd-banner-brand { color: #fff; background: linear-gradient(160deg, #065f46 0%, #0b3a2c 100%); }
.pd-banner-plain { background: var(--card); border: 1px solid var(--line); }
.pd-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.pd-pills span { padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.55); }
.pd-banner-plain .pd-pills span { border-color: var(--line); color: var(--muted); }
.pd-btn { margin-top: 6px; display: inline-flex; align-items: center; min-height: 42px; padding: 0 20px; border-radius: 6px; font-weight: 700; background: var(--act); color: #fff !important; transition: transform 160ms ease-out; }
.pd-banner-brand .pd-btn { background: #fff; color: var(--act-text) !important; }
.pd-btn:active { transform: scale(0.97); }

.pd-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 4px; overflow-x: auto; scrollbar-width: none; }
.pd-tabs::-webkit-scrollbar { display: none; }
.pd-col, .pd-two > *, .pd-card { min-width: 0; }
.pd-tab { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 0; border-bottom: 2px solid transparent; background: none; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; margin-bottom: -1px; white-space: nowrap; }
.pd-tab span { min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: #f1ede4; font-size: 12px; line-height: 22px; color: var(--ink); }
.pd-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--act); }

.pd-list { list-style: none; margin: 0; padding: 0; }
.pd-list li + li { border-top: 1px solid #efe9dd; }
.pd-row { display: flex; align-items: center; gap: 16px; padding: 16px 8px; border-radius: 8px; transition: background 150ms ease-out; }
.pd-row:hover { background: #faf8f3; }
.pd-list-compact .pd-row { padding: 10px 6px; gap: 12px; }
.pd-kind { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.pd-list-compact .pd-kind { width: 32px; height: 32px; }
.pd-kind-requests { background: #ecfdf5; color: var(--act-text); }
.pd-kind-moderation { background: #fff7ed; color: #9a3412; }
.pd-kind-accounts { background: #eef2ff; color: #3730a3; }
.pd-rowtext { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pd-rowtext small { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.pd-rowtext b { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-rowtext span { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-age { font-size: 13px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.pd-age[data-late] { color: var(--late); }
.pd-chev { color: #b8ad99; }
.pd-empty { display: flex; align-items: center; gap: 16px; padding: 28px; border: 1px dashed #cfc5b2; border-radius: 6px; color: var(--muted); }
.pd-empty p { margin: 0; }
.pd-empty b { color: var(--ink); }
.pd-empty-ico { width: 44px; height: 44px; border-radius: 999px; background: #ecfdf5; color: var(--act-text); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.pd-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; }
.pd-kpi { padding: 4px 20px; border-inline-start: 1px solid #efe9dd; display: flex; flex-direction: column; gap: 4px; }
.pd-kpi:first-child { border-inline-start: 0; padding-inline-start: 0; }
.pd-kpi small { font-size: 13px; color: var(--muted); }
.pd-kpi b { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pd-kpi span { font-size: 12px; color: var(--muted); }
.pd-kpis-stack { grid-template-columns: 1fr 1fr; row-gap: 20px; }
.pd-kpis-stack .pd-kpi:nth-child(3) { border-inline-start: 0; padding-inline-start: 0; }

.pd-goal { margin: 0 0 10px; font-size: 15px; }
.pd-goal b { font-size: 30px; font-weight: 800; }
.pd-bar { height: 10px; border-radius: 999px; background: #efe9dd; overflow: hidden; }
.pd-bar span { display: block; height: 100%; background: var(--act); border-radius: 999px; }

.pd-dense-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 12px 8px 20px; }
.pd-dense-head h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.pd-dense-head p { margin: 0; color: var(--muted); font-weight: 600; }
.pd-two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 16px; align-items: start; }
.pd-two > .pd-card { padding: 24px; }

.pd-legal { margin-top: auto; display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 28px 8px 20px; font-size: 13px; color: var(--muted); }
.pd-legal a { text-decoration: underline !important; }

@media (max-width: 1100px) { .pd-two { grid-template-columns: minmax(0, 1fr); } .pd-topnav span { display: none; } }
@media (max-width: 900px) {
  .pd-burger { display: inline-flex; }
  .pd-topnav { display: none; }
  .pd-topright { margin-inline-start: auto; }
  .pd-side { position: fixed; top: 60px; inset-inline-start: 0; z-index: 4; transform: translateX(-100%); transition: transform 200ms ease-out; }
  [dir="rtl"] .pd-side { transform: translateX(100%); }
  .pd-side[data-open] { transform: none; box-shadow: 0 12px 32px rgba(0,0,0,.25); }
  .pd-main { border-radius: 0; }
  .pd-card { padding: 20px; }
  .pd-kpis { grid-template-columns: 1fr 1fr; row-gap: 20px; }
  .pd-kpi:nth-child(3) { border-inline-start: 0; padding-inline-start: 0; }
  .pd-square.pd-lang { display: none; }
}
@media (max-width: 520px) { .pd-top { padding: 0 12px; gap: 8px; } .pd-age { display: none; } .pd-banner { padding: 28px 20px; } }
@media (prefers-reduced-motion: reduce) { .pd-side, .pd-row, .pd-navitem, .pd-btn { transition: none; } }

.proto-data { position: fixed; bottom: 24px; inset-inline-end: 24px; z-index: 2147483646; display: flex; gap: 2px; padding: 4px; border-radius: 999px; background: rgba(10,10,10,0.82); font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.proto-data button { height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: rgba(255,255,255,0.55); cursor: pointer; font: inherit; }
.proto-data button[aria-pressed="true"] { background: rgba(255,255,255,0.12); color: #fff; }
@media (max-width: 900px) { .proto-data { bottom: 72px; inset-inline-end: 50%; transform: translateX(50%); } }

/* selecteur : cahier PICKER.md, valeurs a l'identique */
.proto-picker { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483647; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; background: rgba(10, 10, 10, 0.82); -webkit-backdrop-filter: blur(12px) saturate(1.4); backdrop-filter: blur(12px) saturate(1.4); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 8px 24px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.12); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; line-height: 1; -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none; }
.proto-picker-highlight { position: absolute; top: 4px; left: 0; height: 28px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); }
.proto-picker[data-ready] .proto-picker-highlight { transition: transform 250ms cubic-bezier(0.23, 1, 0.32, 1), width 250ms cubic-bezier(0.23, 1, 0.32, 1); }
@media (prefers-reduced-motion: reduce) { .proto-picker[data-ready] .proto-picker-highlight { transition: none; } }
.proto-picker-item { position: relative; display: flex; align-items: center; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: rgba(255, 255, 255, 0.55); font: inherit; cursor: pointer; transition: color 150ms ease-out, transform 160ms cubic-bezier(0.23, 1, 0.32, 1); }
@media (hover: hover) and (pointer: fine) { .proto-picker-item:hover { color: rgba(255, 255, 255, 0.85); } }
.proto-picker-item:active { transform: scale(0.97); }
.proto-picker-item:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 2px; }
.proto-picker-item[data-active] { color: #fff; }
`;
