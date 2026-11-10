import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccounts } from "@/lib/data/accounts";
import { formatPhone } from "@/lib/phone";
import { RefreshButton } from "@/components/admin/RefreshButton";

export const instant = false;

const ROLE_KEY = { admin: "roleAdmin", producer: "roleProducer", buyer: "roleBuyer" } as const;

export default async function AccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  // Verification du role AVANT toute lecture avec la cle secrete.
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const [t, format, accounts] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getAccounts(user.supabase),
  ]);
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
