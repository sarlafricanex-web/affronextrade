import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countSubmissions, getSubmissions } from "@/lib/data/submissions";
import { formatPhone } from "@/lib/phone";
import { countryName } from "@/lib/countries";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";

export const instant = false;

// Au-dela, l'export Excel contient tout.
const SHOWN = 500;

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  // Un compte non admin retourne a son espace. La RLS ne lui renverrait de toute facon aucune ligne.
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const [t, format, rows, total] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getSubmissions(user.supabase, SHOWN),
    countSubmissions(user.supabase),
  ]);

  // Dates formatees cote serveur : meme texte au rendu et dans le navigateur.
  const submissions = rows.map((s) => {
    const date = new Date(s.created_at);
    return {
      ...s,
      country: countryName(s.country, locale),
      phone: formatPhone(s.phone),
      whatsapp: formatPhone(s.whatsapp),
      shortDate: format.dateTime(date, { dateStyle: "medium", timeStyle: "short" }),
      longDate: format.dateTime(date, { dateStyle: "full", timeStyle: "short" }),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("eyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("title")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("total", { count: total })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RefreshButton />
          {total > 0 && (
            <a
              href="/api/admin/export"
              download
              className="px-5 py-3 text-sm font-bold uppercase"
              style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
            >
              {t("export")}
            </a>
          )}
        </div>
      </header>

      {total > rows.length && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("truncated", { shown: rows.length })}</p>
      )}

      {rows.length === 0 ? (
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("emptyTitle")}</h2>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("emptyText")}</p>
        </section>
      ) : (
        <SubmissionsTable submissions={submissions} />
      )}
    </div>
  );
}
