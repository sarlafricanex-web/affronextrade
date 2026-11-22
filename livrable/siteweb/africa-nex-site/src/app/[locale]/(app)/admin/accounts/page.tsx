import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccounts } from "@/lib/data/accounts";
import { formatPhone } from "@/lib/phone";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { processAccountDeletion } from "@/app/[locale]/(app)/account-actions";

export const instant = false;

const NOTICES = ["done", "gone", "error", "confirm"] as const;
const ROLE_KEY = { admin: "roleAdmin", producer: "roleProducer", buyer: "roleBuyer" } as const;

export default async function AccountsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ deletion?: string }> }) {
  const [{ locale }, { deletion }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  // Verification du role AVANT toute lecture avec la cle secrete.
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const [t, format, accounts, { data: deletions }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getAccounts(user.supabase),
    user.supabase.from("account_deletion_requests").select("id, email, role, reason, created_at").eq("status", "pending").order("created_at"),
  ]);
  const notice = NOTICES.find((n) => n === deletion);
  const date = (value: string | null) => (value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : t("never"));
  const via = (providers: string[]) =>
    providers.length ? providers.map((p) => (p === "google" ? "Google" : p === "email" ? t("viaEmail") : p)).join(", ") : "-";

  const cell = "py-3 px-4";
  const head = `text-start ${cell} font-semibold whitespace-nowrap`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("accountsTitle")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("accountsTotal", { count: accounts.length })}</p>
        </div>
        <RefreshButton />
      </header>

      {/* Demandes de suppression de compte (audit legal, correction 3) : a traiter sous un mois. */}
      <section id="deletion-requests" className="flex flex-col gap-3 p-5" style={{ background: "white", border: "1px solid var(--field-b)", borderInlineStart: "4px solid #b91c1c" }} data-deletion-requests={deletions?.length ?? 0}>
        <h2 className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em" }}>{t("deletionTitle")}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("deletionHelp")}</p>
        {notice && <p role="status" className="text-sm font-semibold" style={{ color: notice === "done" ? "#065f46" : "#b91c1c" }}>{t(`deletionNotice_${notice}`)}</p>}
        {!deletions?.length ? (
          <p className="text-sm">{t("deletionEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {deletions.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between" style={{ borderTop: "1px solid var(--field-b)" }} data-deletion={d.email}>
                <span className="min-w-0">
                  <span className="block font-semibold" dir="ltr" style={{ textAlign: "start" }}>{d.email}</span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>
                    {d.role in ROLE_KEY ? t(ROLE_KEY[d.role as keyof typeof ROLE_KEY]) : d.role} · {t("deletionRequestedOn", { date: format.dateTime(new Date(d.created_at), { dateStyle: "long" }) })}
                  </span>
                  <span className="block text-sm">{d.reason || t("deletionNoReason")}</span>
                </span>
                <form action={processAccountDeletion} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="requestId" value={d.id} />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="confirm" required />
                    {t("deletionConfirm")}
                  </label>
                  <button type="submit" className="px-4 py-2 text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", background: "#b91c1c", color: "white" }}>{t("deletionSubmit")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="relative overflow-x-auto" style={{ background: "white", border: "1px solid var(--field-b)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
              <th scope="col" className={head}>{t("colName")}</th>
              <th scope="col" className={head}>{t("colEmail")}</th>
              <th scope="col" className={head}>{t("colRole")}</th>
              <th scope="col" className={head}>{t("colVia")}</th>
              <th scope="col" className={head}>{t("colPhone")}</th>
              <th scope="col" className={head}>{t("colCreated")}</th>
              <th scope="col" className={head}>{t("colLastSignIn")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--field-b)" }}>
                <td className={`${cell} font-semibold`}>{a.fullName || "-"}</td>
                <td className={cell}><span dir="ltr">{a.email}</span></td>
                <td className={`${cell} whitespace-nowrap`}>
                  {a.role in ROLE_KEY ? t(ROLE_KEY[a.role as keyof typeof ROLE_KEY]) : a.role}
                </td>
                <td className={`${cell} whitespace-nowrap`}>{via(a.providers)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  {a.phone ? <span dir="ltr">{formatPhone(a.phone)}</span> : <span style={{ color: "var(--muted)" }}>{t("missingPhone")}</span>}
                </td>
                <td className={`${cell} whitespace-nowrap`} style={{ color: "var(--muted)" }}>{date(a.createdAt)}</td>
                <td className={`${cell} whitespace-nowrap`} style={{ color: "var(--muted)" }}>{date(a.lastSignInAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
