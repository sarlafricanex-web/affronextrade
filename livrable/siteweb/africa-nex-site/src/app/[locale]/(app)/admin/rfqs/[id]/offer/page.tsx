import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOfferComposer } from "@/lib/data/admin-rfqs";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { DEFAULT_INSURANCE_RATE } from "@/lib/offer-pricing";
import { OfferForm } from "@/components/admin/OfferForm";
import { DELIVERED_INCOTERMS } from "@/lib/incoterms";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const str = (x: unknown) => (x === null || x === undefined ? "" : String(x));

// Composeur d'offre AFRICA NEX (sans maquette) : devis source a gauche du calculateur.
export default async function AdminOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ quote?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const { quote: quoteId } = await searchParams;
  const [t, tr, tc, format, data] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    getOfferComposer(user.supabase, id, quoteId ?? ""),
  ]);
  if (!data) notFound();
  const { rfq, quote, dispatch, margin, offer, nextLabel } = data;
  const company = (Array.isArray(quote.company) ? quote.company[0] : quote.company) as { company_name: string; wilaya: string | null; city: string | null } | null;
  const unit = dispatch?.unit ?? rfq.unit;
  const unitLabel = unit ? tc(`unitShort_${unit}`) : "";
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : "-");
  const editable = !offer || offer.status === "draft";
  const cIncoterm = (DELIVERED_INCOTERMS as readonly string[]).includes(rfq.incoterm ?? "");

  const defaults = {
    label: str(offer?.label ?? nextLabel),
    producerPrice: str(margin?.producer_unit_price ?? quote.unit_price_ht),
    quantity: str(offer?.quantity ?? quote.quantity),
    incoterm: str(offer?.incoterm ?? rfq.incoterm ?? quote.price_basis ?? "FOB"),
    incotermPlace: str(offer?.incoterm_place ?? (cIncoterm ? rfq.destination_port : quote.port_of_loading)),
    commissionRate: str(margin?.commission_rate ?? ""),
    insuranceRate: str(margin?.insurance_rate ?? DEFAULT_INSURANCE_RATE),
    freight: str(margin?.freight_cost && Number(margin.freight_cost) > 0 ? margin.freight_cost : ""),
    leadDays: str(offer?.lead_time_days ?? quote.production_lead_days),
    originRegion: str(offer?.origin_region ?? t("offerOriginDefault")),
    packaging: str(offer?.packaging),
    certifications: str(offer?.certifications),
    paymentTerms: str(offer?.payment_terms ?? quote.payment_terms),
    validUntil: str(offer?.valid_until ?? quote.valid_until),
    notes: str(offer?.notes),
  };

  const quoteRows = [
    [t("offerQuoteProducer"), company?.company_name ?? "-"],
    [t("offerQuotePrice"), `${Number(quote.unit_price_ht).toLocaleString(locale)} ${quote.currency} / ${unitLabel} ${quote.price_basis ?? ""}`.trim()],
    [t("offerQuotePort"), quote.port_of_loading ?? "-"],
    [t("offerQuoteQuantity"), `${Number(quote.quantity).toLocaleString(locale)} ${unitLabel}`],
    [t("offerQuoteLead"), quote.production_lead_days != null ? t("offerDays", { days: quote.production_lead_days }) : "-"],
    [t("offerQuoteValid"), date(quote.valid_until)],
    [t("offerQuotePayment"), quote.payment_terms ?? "-"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/admin/rfqs" className="hover:underline">{t("rfqsTitle")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/admin/rfqs/${rfq.id}`} className="hover:underline" dir="ltr">{rfq.reference}</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: "#059669" }}>{t("offerCrumb")}</span>
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{t("offerTitle", { label: defaults.label })}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {rfq.title} · {volumeLabel(rfq, tr, tc, locale)} · {destinationLabel(rfq, locale)} · {rfq.incoterm ?? "-"}
        </p>
      </header>

      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
          {t("offerQuoteTitle", { reference: dispatch?.reference ?? "" })}
        </h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          {quoteRows.map(([label, value]) => (
            <div key={label} className="p-4" style={{ borderTop: `1px solid ${HAIR}`, borderInlineEnd: `1px solid ${HAIR}` }}>
              <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{label}</dt>
              <dd className="mt-1 font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {quote.notes && <p className="whitespace-pre-line p-5 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>{quote.notes}</p>}
      </section>

      {editable ? (
        <OfferForm rfqId={rfq.id} quoteId={quote.id} currency={quote.currency} unitLabel={unitLabel} defaults={defaults} rateFixed={Boolean(margin?.commission_rate != null)} />
      ) : (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #f97316" }}>{t("offerLocked")}</p>
      )}
    </div>
  );
}
