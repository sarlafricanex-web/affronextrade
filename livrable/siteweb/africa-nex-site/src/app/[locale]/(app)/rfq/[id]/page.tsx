import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyRfq, listMyOffers, rfqAttachments, stageOf, type RfqLine } from "@/lib/data/rfq";
import { RfqLinesTable } from "@/components/rfq/RfqLinesTable";
import { BuyerOffers } from "@/components/rfq/BuyerOffers";
import { after } from "next/server";
import { listThread, markThreadRead } from "@/lib/data/messages";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageForm } from "@/components/messages/MessageForm";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { StatusBadge } from "@/components/rfq/RfqList";
import { cancelRfq } from "../actions";
import { logisticsOf } from "@/lib/offer-auto";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const STAGE_KEYS = ["submitted", "qualified", "dispatched", "offered", "accepted"] as const;

// Detail d'une demande (maquette 14) et offres AFRICA NEX (lot 5e). Le fil de messages arrive au lot 5f.
export default async function RfqDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ sent?: string; cancelled?: string; offer?: string; about?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);
  const [t, tm, tc, format, rfq, { offers, today }, { sent, cancelled, offer: offerDone, about }] = await Promise.all([
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "thread" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    getMyRfq(user.supabase, user.userId, id),
    listMyOffers(user.supabase, id),
    searchParams,
  ]);
  if (!rfq) notFound();
  // Lot 5f : fil avec AFRICA NEX ; les messages recus passent lus apres l'affichage.
  const thread = await listThread(user.supabase, rfq.id, null);
  if (thread.some((m) => m.sender_role === "admin" && !m.read_at)) {
    const supabase = user.supabase;
    after(() => markThreadRead(supabase, rfq.id, null));
  }
  const aboutOffer = about && offers.some((o) => o.label === about) ? about : null;
  const lines = (rfq.rfq_lines ?? []) as RfqLine[];
  const OFFER_NOTICES = ["accepted", "declined", "currencyRequested", "currencyInvalid", "unavailable"];

  const stage = stageOf(rfq.status);
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : null);
  const files = rfqAttachments(rfq);
  const specs = [
    { label: t("specQuantity"), value: volumeLabel(rfq, t, tc, locale) },
    { label: t("specDestination"), value: destinationLabel(rfq, locale) || null },
    { label: t("specLogistics"), value: t(`logistics_${logisticsOf(rfq.logistics, rfq.incoterm)}`) },
    { label: t("specIncoterm"), value: rfq.incoterm },
    { label: t("specNeededBy"), value: date(rfq.needed_by) },
    { label: t("specTargetPrice"), value: rfq.target_unit_price != null ? `${Number(rfq.target_unit_price).toLocaleString(locale)} ${rfq.currency ?? ""}`.trim() : null },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sent && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t("sentNotice")}</p>}
      {cancelled && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #f97316" }}>{t("cancelledNotice")}</p>}
      {offerDone && OFFER_NOTICES.includes(offerDone) && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: `4px solid ${["currencyInvalid", "unavailable"].includes(offerDone) ? "#dc2626" : "#10b981"}` }} data-offer-notice={offerDone}>
          {t(`offerNotice_${offerDone}`)}
        </p>
      )}

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <nav aria-label={t("breadcrumb")} className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/rfq" className="hover:underline">{t("navList")}</Link>
            <span aria-hidden="true" style={{ color: HAIR }}>/</span>
            <span dir="ltr" style={{ color: "#065f46" }}>{rfq.reference}</span>
          </nav>
          <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{rfq.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={rfq.status} label={t(`status_${rfq.status}`)} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>{t("openedOn", { date: format.dateTime(new Date(rfq.created_at), { dateStyle: "long" }) })}</span>
          </div>
        </div>
        <Link href="/rfq" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("backList")}</Link>
      </header>

      {/* Les 5 jalons du dossier */}
      {stage > 0 && (
        <ol className="grid sm:grid-cols-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          {STAGE_KEYS.map((key, i) => {
            const n = i + 1;
            const state = n < stage || (n === stage && n === 5) ? "done" : n === stage ? "current" : "todo";
            return (
              <li key={key} className="flex items-center gap-3 p-3" style={{ borderInlineEnd: i < 4 ? `1px solid ${HAIR}` : undefined, background: state === "current" ? "#fff7ed" : "transparent", borderBottom: state === "current" ? "3px solid #f97316" : "3px solid transparent" }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold" style={state === "done" ? { background: "#065f46", color: "white" } : state === "current" ? { background: "#c2410c", color: "white" } : { border: `1px solid ${HAIR}`, color: "var(--muted)" }}>
                  {state === "done" ? "✓" : n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase" style={{ ...caps, color: state === "todo" ? "var(--muted)" : state === "current" ? "#c2410c" : "#065f46" }}>{t(`stageState_${state}`)}</span>
                  <span className="block text-xs font-semibold" style={{ color: state === "todo" ? "var(--muted)" : "var(--ink)" }}>{t(`milestone_${key}`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Produits demandes (une ligne par produit) */}
      <RfqLinesTable lines={lines} locale={locale} currency={rfq.currency} />

      {/* Cahier des charges */}
      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("specsTitle")}</h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-5">
          {specs.map((s, i) => (
            <div key={s.label} className="p-4" style={{ borderInlineStart: i ? `1px solid ${HAIR}` : undefined, borderTop: `1px solid ${HAIR}` }}>
              <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{s.label}</dt>
              <dd className="mt-1 font-bold" style={{ color: s.value ? "var(--ink)" : "var(--muted)" }}>{s.value ?? t("notSpecified")}</dd>
            </div>
          ))}
        </dl>
        {(rfq.description || files.length > 0) && (
          <div className="flex flex-col gap-3 p-5" style={{ borderTop: `1px solid ${HAIR}` }}>
            {rfq.description && <p className="whitespace-pre-line text-sm">{rfq.description}</p>}
            {files.map((f, i) => (
              <a key={f.path} href={`/api/rfq-files/${rfq.id}?i=${i}`} className="w-fit px-3 py-2 text-sm font-semibold underline" style={{ border: `1px solid ${HAIR}` }}>{f.name}</a>
            ))}
          </div>
        )}
      </section>

      {offers.length > 0 && <BuyerOffers rfqId={rfq.id} rfqStatus={rfq.status} locale={locale} offers={offers} lines={lines} today={today} />}

      {/* Etat actuel et suite */}
      <section className="flex flex-col gap-3 p-5" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>
        <h2 className="font-bold">{t(`next_${rfq.status}_title`)}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t(`next_${rfq.status}_text`)}</p>
        {rfq.status === "submitted" && (
          <form action={cancelRfq}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={rfq.id} />
            <button type="submit" className="px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }}>{t("cancel")}</button>
          </form>
        )}
      </section>

      {/* Lot 5f : fil avec AFRICA NEX (maquette 14) */}
      <section id="messages" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: 16 }} aria-labelledby="messages-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
          <div>
            <h2 id="messages-title" className="flex items-center gap-2 font-extrabold" style={{ fontSize: "1.1rem" }}>
              <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: "var(--ink)" }} />
              {tm("buyerTitle")}
            </h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{tm("buyerIntro")}</p>
          </div>
        </div>
        <MessageThread messages={thread} mine="buyer" otherName={tm("africanex")} otherInitials="AN" locale={locale} emptyText={tm("buyerEmpty")} />
        <MessageForm
          key={aboutOffer ?? "free"}
          rfqId={rfq.id}
          placeholder={tm("buyerPlaceholder")}
          initial={aboutOffer ? tm("aboutOffer", { label: aboutOffer }) : undefined}
          closed={["closed", "cancelled"].includes(rfq.status)}
        />
      </section>
    </div>
  );
}
