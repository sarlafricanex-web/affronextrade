import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompany } from "@/lib/data/company";
import { ClaimForm } from "@/components/claim/ClaimForm";

export const instant = false;

// Revendication d'une fiche etablie par AFRICA NEX. Un seul ecran, qui explique aussi
// pourquoi la demande n'est pas possible quand c'est le cas.
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { locale, slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();

  const [t, { sent }, { data: company }] = await Promise.all([
    getTranslations({ locale, namespace: "claim" }),
    searchParams,
    user.supabase.from("companies").select("id, company_name, slug, claim_status, visibility").eq("slug", slug).maybeSingle(),
  ]);
  if (!company || company.visibility !== "published") notFound();

  const [{ data: myClaim }, myCompany, { data: profile }] = await Promise.all([
    user.supabase.from("company_claims").select("status, created_at").eq("company_id", company.id).eq("profile_id", user.userId).maybeSingle(),
    user.role === "producer" ? getMyCompany(user.supabase, user.userId) : Promise.resolve(null),
    user.supabase.from("profiles").select("phone").eq("id", user.userId).single(),
  ]);

  // Message a afficher a la place du formulaire, le cas echeant.
  let notice: { title: string; text: string } | null = null;
  if (myClaim) notice = { title: t(`status_${myClaim.status}_title`), text: t(`status_${myClaim.status}_text`, { name: company.company_name }) };
  else if (user.role !== "producer") notice = { title: t("notProducerTitle"), text: t("notProducerText") };
  else if (myCompany) notice = { title: t("hasCompanyTitle"), text: t("hasCompanyText", { name: myCompany.company_name }) };
  else if (company.claim_status !== "unclaimed") notice = { title: t("unavailableTitle"), text: t("unavailableText") };

  return (
    <div className="flex flex-col gap-8">
      {sent && myClaim?.status === "pending" && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>{t("sentNotice")}</p>
      )}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("eyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("title", { name: company.company_name })}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "62ch" }}>{t("intro")}</p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          {notice ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{notice.title}</h2>
              <p style={{ color: "var(--muted)" }}>{notice.text}</p>
              <div className="flex flex-wrap gap-4">
                <Link href={`/producers/${company.slug}`} className="text-sm font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>{t("backToProfile")}</Link>
                <Link href="/contact" className="text-sm font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>{t("contactUs")}</Link>
              </div>
            </div>
          ) : (
            <ClaimForm slug={company.slug} defaults={{ nif: "", workEmail: "", phone: profile?.phone ?? "", jobTitle: "", message: "" }} />
          )}
        </section>
        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <h2 className="font-bold">{t("sideTitle")}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sideManual")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sideAfter")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sidePrivate")}</p>
        </aside>
      </div>
    </div>
  );
}
