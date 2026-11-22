import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAutoOfferEditor } from "@/lib/data/admin-rfqs";
import { computeRfqAutoOffers } from "@/lib/data/auto-offer";
import { oneOf } from "@/lib/data/requests";
import { OFFER_VALIDITY_DAYS } from "@/lib/offer-auto";
import { AutoOfferForm, type AutoOfferLine } from "@/components/admin/AutoOfferForm";
import { DELIVERED_INCOTERMS } from "@/lib/incoterms";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const str = (x: unknown) => (x === null || x === undefined ? "" : String(x));

// Lot 6e : offre calculee a completer par AFRICA NEX (sans maquette). Commission, marge negociee,
// fret et conditions ; une offre publiee se consulte seulement (la retirer pour la modifier).
export default async function AutoOfferPage({ params }: { params: Promise<{ locale: string; id: string; offerId: string }> }) {
  const { locale, id, offerId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, tc, format, data] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    getAutoOfferEditor(user.supabase, id, offerId),
  ]);
  if (!data) notFound();
  const { rfq, offer, margin: m, today } = data;
  const mode = m.export_mode === "africanex" ? "africanex" : "self";
  const editable = offer.status === "draft" && ["qualified", "dispatched", "offered"].includes(rfq.status);
  // Taux de la grille pour toute la demande (bouton "revenir au taux de la grille").
  const grid = mode === "self" && editable ? await computeRfqAutoOffers(user.supabase, rfq.id) : null;
  const money = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${offer.currency}`;
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : "-");

  type LineMargin = { base_amount: number; insurance_rate: number; fx_margin_rate: number; max_discount_rate: number | null; company: { company_name: string } | { company_name: string }[] | null };
  const lines: AutoOfferLine[] = (offer.offer_lines ?? []).map((l) => {
    const lm = oneOf(l.offer_line_margins as unknown as LineMargin | LineMargin[] | null);
    return {
      id: l.id,
      position: l.position,
      description: l.description,
      unitLabel: l.unit ? tc(`unitShort_${l.unit}`) : "",
      supplier: oneOf(lm?.company ?? null)?.company_name ?? "-",
      quantity: Number(l.quantity),
      base: Number(lm?.base_amount ?? 0),
      insuranceRate: Number(lm?.insurance_rate ?? 0),
      fxMarginRate: Number(lm?.fx_margin_rate ?? 0),
      maxDiscountRate: lm?.max_discount_rate != null ? Number(lm.max_discount_rate) : null,
    };
  });
  const freightManaged = m.freight_pending || m.freight_cost != null;
  const maxValid = new Date(Date.parse(`${today}T12:00:00Z`) + OFFER_VALIDITY_DAYS * 864e5).toISOString().slice(0, 10);
  const withFreightPlace = (DELIVERED_INCOTERMS as readonly string[]).includes(offer.incoterm ?? "");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/admin/rfqs" className="hover:underline">{t("rfqsTitle")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/admin/rfqs/${rfq.id}`} className="hover:underline" dir="ltr">{rfq.reference}</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: "#065f46" }}>{t("offerName", { label: offer.label })}</span>
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{t("autoEditTitle", { label: offer.label })}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2 py-0.5 text-xs font-bold" style={{ background: mode === "self" ? "var(--ink)" : "#065f46", color: "white" }}>{t(`autoMode_${mode}`)}</span>
          <span className="font-bold" dir="ltr">{offer.currency}{offer.incoterm ? ` · ${offer.incoterm}` : ""}</span>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, border: `1px solid ${HAIR}` }}>{t(`offerStatus_${offer.status}`)}</span>
          {m.fx_rate && <span className="text-xs" style={{ color: "#c2410c" }} dir="ltr">{t("autoFxRate", { currency: offer.currency, rate: Number(m.fx_rate).toLocaleString() })}</span>}
          <span style={{ color: "var(--muted)" }}>{rfq.title}</span>
        </p>
      </header>

      {editable ? (
        <AutoOfferForm
          rfqId={rfq.id}
          offerId={offer.id}
          mode={mode}
          currency={offer.currency}
          incoterm={offer.incoterm}
          freightManaged={freightManaged}
          gridRate={grid?.commissionRate ?? Number(m.commission_rate ?? 0)}
          maxValid={maxValid}
          lines={lines}
          defaults={{
            commissionRate: str(m.commission_rate),
            marginKind: m.margin_rate == null && m.margin_amount != null ? "amount" : "rate",
            margin: m.margin_pending ? "" : str(m.margin_rate ?? m.margin_amount),
            freight: str(m.freight_cost),
            incotermPlace: str(offer.incoterm_place ?? (withFreightPlace ? rfq.destination_port : "")),
            validUntil: str(offer.valid_until && offer.valid_until <= maxValid ? offer.valid_until : maxValid),
            paymentTerms: str(offer.payment_terms),
            notes: str(offer.notes),
          }}
        />
      ) : (
        <>
          <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #f97316" }}>{offer.status === "draft" ? t("offerErrorRfqClosed") : t("offerLocked")}</p>
          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <ul>
              {lines.map((l) => {
                const ol = offer.offer_lines.find((x) => x.id === l.id)!;
                return (
                  <li key={l.id} className="flex flex-wrap justify-between gap-3 px-5 py-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>
                    <span className="font-semibold">{l.position}. {l.description}</span>
                    <span dir="ltr">{l.quantity.toLocaleString(locale)} {l.unitLabel} × {money(Number(ol.unit_price))} = <strong>{money(Number(ol.total_amount))}</strong></span>
                  </li>
                );
              })}
              {offer.freight_amount != null && (
                <li className="flex justify-between gap-3 px-5 py-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <span className="font-semibold">{t("offerCalcFreight")}</span>
                  <span dir="ltr">{money(Number(offer.freight_amount))}</span>
                </li>
              )}
              <li className="flex justify-between gap-3 px-5 py-3 text-sm font-bold" style={{ borderTop: `1px solid ${HAIR}` }}>
                <span>{t("offerCalcTotal")}</span>
                <span dir="ltr">{money(Number(offer.total_amount))}</span>
              </li>
            </ul>
            <p className="px-5 pb-4 text-xs" style={{ color: "var(--muted)" }}>{t("offerValidLine", { date: date(offer.valid_until) })}</p>
          </section>
        </>
      )}
    </div>
  );
}
