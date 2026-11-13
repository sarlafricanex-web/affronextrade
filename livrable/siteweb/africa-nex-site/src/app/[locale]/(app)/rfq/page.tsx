import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listMyRfqs, stageOf } from "@/lib/data/rfq";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { RfqList, type RfqRow } from "@/components/rfq/RfqList";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Mes demandes (maquette 13) : toutes les demandes de devis de l'acheteur et leur progression.
export default async function MyRfqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);

  const [t, tc, format, rfqs] = await Promise.all([
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    listMyRfqs(user.supabase, user.userId),
  ]);
  const rows: RfqRow[] = rfqs.map((r) => ({
    id: r.id,
    reference: r.reference,
    title: r.title,
    status: r.status,
    stage: stageOf(r.status),
    volume: volumeLabel(r, t, tc, locale),
    incoterm: r.incoterm,
    destination: destinationLabel(r, locale),
    date: format.dateTime(new Date(r.created_at), { dateStyle: "medium" }),
    offers: (r.offers ?? []).filter((o) => o.status === "published").length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("eyebrow")}</p>
          <h1 className="mt-1 font-extrabold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{t("listTitle")}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("listIntro")}</p>
        </div>
        <Link href="/rfq/new" className="px-6 py-3.5 text-center text-xs font-bold uppercase" style={{ ...caps, background: "#10b981", color: "white" }}>+ {t("newButton")}</Link>
      </header>

      <section className="flex gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" /></svg>
        </span>
        <div>
          <p className="text-xs font-bold uppercase" style={caps}>{t("intermediationTitle")}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("intermediationText")}</p>
        </div>
      </section>

      <RfqList rows={rows} />
    </div>
  );
}
