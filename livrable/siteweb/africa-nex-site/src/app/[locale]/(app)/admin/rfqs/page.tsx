import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listAdminRfqs } from "@/lib/data/admin-rfqs";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { countryName } from "@/lib/countries";
import { StatusBadge } from "@/components/rfq/RfqList";

export const instant = false;

const FILTERS = { todo: ["submitted"], progress: ["qualified", "dispatched"], offers: ["offered", "accepted"], closed: ["closed", "cancelled"] } as const;
type Filter = keyof typeof FILTERS | "all";

// File des demandes de devis (console AFRICA NEX, sans maquette : construite avec les jetons du site).
export default async function AdminRfqsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, tr, tc, format, rfqs, { f }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    listAdminRfqs(user.supabase),
    searchParams,
  ]);
  const filter: Filter = f && f in FILTERS ? (f as Filter) : "all";
  const inFilter = (status: string, key: Filter) => key === "all" || (FILTERS[key] as readonly string[]).includes(status);
  const shown = rfqs.filter((r) => inFilter(r.status, filter));
  const cell = "py-3 px-4 align-top";
  const head = "text-start py-3 px-4 font-semibold whitespace-nowrap";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("rfqsTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>{t("rfqsIntro")}</p>
      </header>

      <nav className="flex flex-wrap gap-1" aria-label={t("rfqsFilters")}>
        {(["all", "todo", "progress", "offers", "closed"] as const).map((key) => {
          const count = rfqs.filter((r) => inFilter(r.status, key)).length;
          const active = key === filter;
          return (
            <Link key={key} href={key === "all" ? "/admin/rfqs" : `/admin/rfqs?f=${key}`} aria-current={active ? "page" : undefined} className="px-3 py-2 text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", background: active ? "var(--ink)" : "white", color: active ? "white" : key === "todo" && count ? "#c2410c" : "var(--ink)", border: "1px solid var(--field-b)" }}>
              {t(`rfqsFilter_${key}`)} ({count})
            </Link>
          );
        })}
      </nav>

      {/* Telephone : une carte par demande, entierement cliquable. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {shown.length === 0 && <li className="p-6 text-center" style={{ background: "white", color: "var(--muted)" }}>{t("rfqsEmpty")}</li>}
        {shown.map((r) => {
          const buyer = r.buyer as unknown as { company_name: string; country: string | null } | null;
          const dispatches = (r.rfq_dispatches ?? []) as { status: string }[];
          const quoted = dispatches.filter((d) => d.status === "quoted").length;
          return (
            <li key={r.id}>
              <Link href={`/admin/rfqs/${r.id}`} className="flex flex-col gap-2 p-4" style={{ background: "white", border: "1px solid var(--field-b)" }}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold" dir="ltr" style={{ color: "var(--muted)" }}>{r.reference}</span>
                  <StatusBadge status={r.status} label={tr(`status_${r.status}`)} />
                </span>
                <span className="font-bold" style={{ color: "#059669" }}>{r.title}</span>
                <span className="text-sm">{[buyer?.company_name, buyer?.country ? countryName(buyer.country, locale) : null].filter(Boolean).join(" · ")}</span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {[volumeLabel(r, tr, tc, locale), destinationLabel(r, locale), r.incoterm].filter(Boolean).join(" · ")}
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  <span>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}{dispatches.length ? ` · ${t("rfqDispatchCount", { sent: dispatches.length, quoted })}` : ""}</span>
                  <span className="font-bold uppercase underline" style={{ letterSpacing: "0.08em", color: "var(--ink)" }}>{t("rfqOpen")}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block" style={{ background: "white", border: "1px solid var(--field-b)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
              <th scope="col" className={head}>{t("rfqColRequest")}</th>
              <th scope="col" className={head}>{t("rfqColBuyer")}</th>
              <th scope="col" className={head}>{t("rfqColVolume")}</th>
              <th scope="col" className={head}>{t("rfqColReceived")}</th>
              <th scope="col" className={head}>{t("rfqColStatus")}</th>
              <th scope="col" className={head}>{t("rfqColProducers")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--muted)" }}>{t("rfqsEmpty")}</td></tr>
            )}
            {shown.map((r) => {
              const buyer = r.buyer as unknown as { company_name: string; country: string | null } | null;
              const dispatches = (r.rfq_dispatches ?? []) as { status: string }[];
              const quoted = dispatches.filter((d) => d.status === "quoted").length;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--field-b)" }}>
                  <td className={cell}>
                    <Link href={`/admin/rfqs/${r.id}`} className="font-semibold underline" style={{ color: "#059669", textUnderlineOffset: "3px" }}>{r.title}</Link>
                    <span className="block text-xs" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{r.reference}</span>
                  </td>
                  <td className={cell}>
                    {buyer?.company_name ?? "-"}
                    {buyer?.country && <span className="block text-xs" style={{ color: "var(--muted)" }}>{countryName(buyer.country, locale)}</span>}
                  </td>
                  <td className={cell}>
                    <span className="font-semibold">{volumeLabel(r, tr, tc, locale)}</span>
                    <span className="block text-xs" style={{ color: "var(--muted)" }}>{[destinationLabel(r, locale), r.incoterm].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}</td>
                  <td className={cell}><StatusBadge status={r.status} label={tr(`status_${r.status}`)} /></td>
                  <td className={`${cell} whitespace-nowrap`}>{dispatches.length ? t("rfqDispatchCount", { sent: dispatches.length, quoted }) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
