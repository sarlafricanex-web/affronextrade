import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getClaims } from "@/lib/data/claims";
import { formatPhone } from "@/lib/phone";
import { ClaimDecision } from "@/components/admin/ClaimDecision";

export const instant = false;

const STATUS_COLOR = { pending: "#f97316", approved: "var(--accent)", rejected: "#dc2626" } as const;

export default async function ClaimsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const [t, format, claims, { done, error }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getClaims(user.supabase),
    searchParams,
  ]);
  const pending = claims.filter((c) => c.status === "pending");
  const others = claims.filter((c) => c.status !== "pending");
  const date = (v: string) => format.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short" });
  const errorKey = { hasCompany: "claimErrorHasCompany", nifTaken: "claimErrorNifTaken", notPending: "claimErrorNotPending", generic: "claimErrorGeneric" }[error ?? ""];

  return (
    <div className="flex flex-col gap-8">
      {done && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>
          {t(done === "approve" ? "claimDoneApprove" : "claimDoneReject")}
        </p>
      )}
      {errorKey && (
        <p role="alert" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #dc2626" }}>{t(errorKey)}</p>
      )}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("claimsTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "62ch" }}>{t("claimsIntro", { count: pending.length })}</p>
      </header>

      {claims.length === 0 && <p style={{ color: "var(--muted)" }}>{t("claimsEmpty")}</p>}

      {[...pending, ...others].map((c) => {
        const company = c.company as { company_name: string; slug: string } | null;
        const claimant = c.claimant as { full_name: string | null; email: string | null } | null;
        const rows = [
          [t("claimClaimant"), `${claimant?.full_name ?? "-"} (${claimant?.email ?? "-"})`, true],
          [t("claimJobTitle"), c.job_title ?? "-", false],
          [t("claimNif"), c.tax_id ?? "-", true],
          [t("claimWorkEmail"), c.work_email ?? "-", true],
          [t("claimPhone"), c.phone ? formatPhone(c.phone) : "-", true],
        ] as const;
        return (
          <article key={c.id} className="flex flex-col gap-4 p-5" style={{ background: "white", border: "1px solid var(--field-b)", borderInlineStart: `4px solid ${STATUS_COLOR[c.status as keyof typeof STATUS_COLOR] ?? "var(--field-b)"}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>
                {company ? <Link href={`/producers/${company.slug}`} className="hover:underline">{company.company_name}</Link> : "-"}
              </h2>
              <span className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: STATUS_COLOR[c.status as keyof typeof STATUS_COLOR] }}>
                {t(`claimStatus_${c.status}`)} · {date(c.reviewed_at ?? c.created_at)}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {rows.map(([label, value, ltr]) => (
                <div key={label} className="contents">
                  <dt style={{ color: "var(--muted)" }}>{label}</dt>
                  <dd className="font-semibold" dir={ltr ? "ltr" : undefined} style={{ textAlign: "start" }}>{value}</dd>
                </div>
              ))}
            </dl>
            {c.message && <p className="whitespace-pre-line text-sm" style={{ background: "var(--ground)", padding: "0.75rem 1rem" }}>{c.message}</p>}
            {c.evidence_path && (
              <a href={`/api/admin/claims/${c.id}/evidence`} target="_blank" rel="noopener" className="w-fit text-sm font-bold underline" style={{ color: "var(--accent)" }}>
                {t("claimEvidence")}
              </a>
            )}
            {c.status === "pending" && (
              <>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{t("claimCheckHint")}</p>
                <ClaimDecision id={c.id} company={company?.company_name ?? ""} claimant={claimant?.full_name ?? claimant?.email ?? ""} />
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
