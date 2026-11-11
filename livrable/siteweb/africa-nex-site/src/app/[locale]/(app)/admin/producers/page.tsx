import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listAdminProducers } from "@/lib/data/admin-producers";
import { WILAYAS } from "@/lib/onboarding/reference";
import { ProducerOps } from "@/components/admin/ProducerOps";

export const instant = false;

const VIS_COLOR = { published: "var(--accent)", draft: "var(--muted)", suspended: "#dc2626" } as const;

export default async function AdminProducersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; done?: string; error?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const [t, o, producers, { saved, done, error }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "onboarding" }),
    listAdminProducers(user.supabase),
    searchParams,
  ]);
  const online = producers.filter((p) => p.visibility === "published").length;
  const notice = saved ? t(saved === "create" ? "apCreated" : "apUpdated") : done ? t(`opDone_${done}`) : null;
  const cell = "py-3 px-4";
  const head = `text-start ${cell} font-semibold whitespace-nowrap`;

  return (
    <div className="flex flex-col gap-8">
      {notice && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>{notice}</p>}
      {error && <p role="alert" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #dc2626" }}>{t(error === "verifyUnclaimed" ? "opVerifyUnclaimed" : "claimErrorGeneric")}</p>}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("producersTitle")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("producersSummary", { total: producers.length, online })}</p>
        </div>
        <Link href="/admin/producers/new" className="px-5 py-3 text-sm font-bold uppercase" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {t("apNew")}
        </Link>
      </header>

      <div className="relative overflow-x-auto" style={{ background: "white", border: "1px solid var(--field-b)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
              <th scope="col" className={head}>{t("colProducer")}</th>
              <th scope="col" className={head}>{t("colStatus")}</th>
              <th scope="col" className={head}>{t("colClaim")}</th>
              <th scope="col" className={head}>{t("colProducts")}</th>
              <th scope="col" className={head}>{t("colViews")}</th>
              <th scope="col" className={head}>{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {producers.map((p) => {
              const wilaya = WILAYAS.find(([c]) => c === p.wilaya)?.[1];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--field-b)" }}>
                  <td className={cell}>
                    <Link href={`/admin/producers/${p.id}`} className="font-semibold hover:underline">{p.company_name}</Link>
                    {p.verified && <span className="ms-2 text-xs font-bold" style={{ color: "var(--accent)" }}>✓ {t("badgeVerified")}</span>}
                    <span className="block text-xs" style={{ color: "var(--muted)" }}>
                      {[p.city, wilaya].filter(Boolean).join(" · ")}{p.sector ? ` · ${o(`sector_${p.sector}`)}` : ""}
                    </span>
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <span className="text-xs font-bold uppercase" style={{ color: VIS_COLOR[p.visibility as keyof typeof VIS_COLOR], letterSpacing: "0.06em" }}>{t(`vis_${p.visibility}`)}</span>
                    {p.visibility === "published" && (
                      <Link href={`/producers/${p.slug}`} className="ms-2 text-xs underline" style={{ color: "var(--muted)" }}>{t("viewPublic")}</Link>
                    )}
                  </td>
                  <td className={`${cell} whitespace-nowrap text-xs`}>{t(`claim_${p.claim_status}`)}</td>
                  <td className={cell}>{p.productCount}</td>
                  <td className={cell}>{p.views30}</td>
                  <td className={cell}>
                    <ProducerOps id={p.id} locale={locale} visibility={p.visibility} verified={p.verified} claimed={p.claim_status === "claimed"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("producersNote")}</p>
    </div>
  );
}
