import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getQuoteEntry } from "@/lib/data/admin-rfqs";
import { oneOf } from "@/lib/data/requests";
import { QuoteForm } from "@/components/requests/QuoteForm";
import { enterQuote } from "../../../offer-actions";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const str = (x: unknown) => (x === null || x === undefined ? "" : String(x));

// Saisie par AFRICA NEX du devis d'un producteur joint hors ligne (fiche non revendiquee,
// telephone, salon). Le devis est enregistre au nom de l'entreprise du producteur.
export default async function AdminQuoteEntryPage({ params }: { params: Promise<{ locale: string; id: string; dispatchId: string }> }) {
  const { locale, id, dispatchId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, tc, d] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "catalog" }),
    getQuoteEntry(user.supabase, id, dispatchId),
  ]);
  if (!d) notFound();
  const company = oneOf(d.company as unknown as { company_name: string } | null);
  const q = oneOf(d.quotes as unknown as Record<string, unknown> | Record<string, unknown>[] | null);
  const locked = q && q.status !== "submitted" && q.status !== "draft";
  const unitLabel = d.unit ? tc(`unitShort_${d.unit}`) : "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/admin/rfqs" className="hover:underline">{t("rfqsTitle")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/admin/rfqs/${d.rfq_id}`} className="hover:underline">{t("quoteEntryBack")}</Link>
          <span aria-hidden="true">/</span>
          <span dir="ltr" style={{ color: "#059669" }}>{d.reference}</span>
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{t("quoteEntryTitle", { company: company?.company_name ?? "" })}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("quoteEntryIntro")}</p>
      </header>
      <section className="p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <p className="font-bold">{d.brief_title}</p>
        {d.brief_specs && <p className="mt-1 whitespace-pre-line text-sm" style={{ color: "var(--muted)" }}>{d.brief_specs}</p>}
      </section>
      {locked ? (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #f97316" }}>{t("quoteEntryLocked")}</p>
      ) : (
        <section className="p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <QuoteForm
            dispatchId={d.id}
            unitLabel={unitLabel}
            update={Boolean(q)}
            onSubmit={enterQuote}
            labels={{ submit: t("quoteEntrySubmit"), note: t("quoteEntryNote") }}
            defaults={{
              currency: str(q?.currency ?? "USD"),
              unitPrice: str(q?.unit_price_ht),
              priceBasis: str(q?.price_basis ?? d.requested_incoterm ?? "FOB"),
              port: str(q?.port_of_loading),
              quantity: str(q?.quantity ?? d.quantity),
              leadDays: str(q?.production_lead_days),
              availableOn: str(q?.available_at_port_on),
              paymentTerms: str(q?.payment_terms),
              validUntil: str(q?.valid_until),
              notes: str(q?.notes),
            }}
          />
        </section>
      )}
    </div>
  );
}
