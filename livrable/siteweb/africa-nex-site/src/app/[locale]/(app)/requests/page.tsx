import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId } from "@/lib/data/company";
import { listMyRequests } from "@/lib/data/requests";
import { countryName } from "@/lib/countries";
import { RequestList, type RequestRow } from "@/components/requests/RequestList";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Demandes recues (maquette 15) : briefs anonymises envoyes par AFRICA NEX au producteur.
export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const [t, tc, format, requests] = await Promise.all([
    getTranslations({ locale, namespace: "requests" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    listMyRequests(user.supabase, companyId),
  ]);
  const rows: RequestRow[] = requests.map((r) => ({
    id: r.id,
    reference: r.reference,
    title: r.brief_title,
    specs: (r.brief_specs ?? "").split("\n")[0].slice(0, 120),
    volume: r.quantity != null ? `${Number(r.quantity).toLocaleString(locale)} ${r.unit ? tc(`unitShort_${r.unit}`) : ""}`.trim() : "",
    destination: (r.destination_country ? countryName(r.destination_country, locale) : null) ?? "",
    incoterm: r.requested_incoterm,
    group: r.status === "quoted" || r.quote ? "quoted" : r.status === "declined" ? "declined" : r.status === "expired" || r.overdue ? "expired" : "todo",
    isNew: r.status === "sent",
    respondBy: r.respond_by ? format.dateTime(new Date(`${r.respond_by}T12:00:00`), { dateStyle: "medium" }) : null,
    hoursLeft: r.hoursLeft,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("eyebrow")}</p>
        <h1 className="mt-1 font-extrabold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{t("listTitle")}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("listIntro")}</p>
      </header>
      <section className="flex gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #10b981" }}>
        <div>
          <p className="font-bold">{t("intermediationTitle")}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("intermediationText")}</p>
        </div>
      </section>
      <RequestList rows={rows} />
    </div>
  );
}
