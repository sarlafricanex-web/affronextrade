import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countryName } from "@/lib/countries";
import { Stars } from "@/components/producers/parts";
import { moderateReview } from "./actions";

export const instant = false;

const COLOR = { pending: "#f97316", approved: "var(--accent)", rejected: "#dc2626" } as const;

export default async function AdminReviewsPage({
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

  const [t, format, { data, error: loadError }, { done, error }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    user.supabase
      .from("reviews")
      .select("id, rating, comment, author_name, author_country, status, created_at, moderated_at, company:companies(company_name, slug), author:profiles!reviews_author_profile_id_fkey(email)")
      .order("created_at", { ascending: false })
      .limit(200),
    searchParams,
  ]);
  if (loadError) throw loadError;
  const reviews = [...(data ?? []).filter((r) => r.status === "pending"), ...(data ?? []).filter((r) => r.status !== "pending")];
  const pending = reviews.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-8">
      {done && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>{t(done === "approved" ? "reviewDoneApproved" : "reviewDoneRejected")}</p>}
      {error && <p role="alert" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #dc2626" }}>{t("claimErrorGeneric")}</p>}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("reviewsTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "62ch" }}>{t("reviewsIntro", { count: pending })}</p>
      </header>
      {reviews.length === 0 && <p style={{ color: "var(--muted)" }}>{t("reviewsEmpty")}</p>}
      {reviews.map((r) => {
        const company = r.company as { company_name: string; slug: string } | null;
        const author = r.author as { email: string | null } | null;
        return (
          <article key={r.id} className="flex flex-col gap-3 p-5" style={{ background: "white", border: "1px solid var(--field-b)", borderInlineStart: `4px solid ${COLOR[r.status as keyof typeof COLOR]}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-bold">
                {company ? <Link href={`/producers/${company.slug}`} className="hover:underline">{company.company_name}</Link> : "-"}
              </h2>
              <span className="text-xs font-bold uppercase" style={{ color: COLOR[r.status as keyof typeof COLOR], letterSpacing: "0.08em" }}>
                {t(`reviewStatus_${r.status}`)} · {format.dateTime(new Date(r.moderated_at ?? r.created_at), { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Stars rating={r.rating} size={14} /> <span className="font-semibold">{r.author_name}</span>
              <span style={{ color: "var(--muted)" }}>· {countryName(r.author_country, locale)}</span>
              {author?.email && <span className="text-xs" dir="ltr" style={{ color: "var(--muted)" }}>({t("reviewAccount")} {author.email})</span>}
            </p>
            {r.comment && <p className="whitespace-pre-line text-sm" style={{ background: "var(--ground)", padding: "0.75rem 1rem" }}>{r.comment}</p>}
            {r.status === "pending" && (
              <form action={moderateReview} className="flex flex-wrap gap-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" name="decision" value="approved" className="px-4 py-2 text-xs font-bold uppercase" style={{ background: "var(--accent)", color: "white", letterSpacing: "0.08em" }}>{t("reviewPublish")}</button>
                <button type="submit" name="decision" value="rejected" className="px-4 py-2 text-xs font-bold uppercase" style={{ border: "1px solid #dc2626", color: "#dc2626", letterSpacing: "0.08em" }}>{t("reviewRejectBtn")}</button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
