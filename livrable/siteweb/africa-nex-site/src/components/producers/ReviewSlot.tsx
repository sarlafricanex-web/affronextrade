import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ReviewForm } from "./ReviewForm";

// Bloc "laisser un avis" de la fiche publique. Lit la session : rendu a la demande (sous Suspense)
// alors que le reste de la fiche reste en cache.
export async function ReviewSlot({ companyId, slug, locale }: { companyId: string; slug: string; locale: string }) {
  const [t, user] = await Promise.all([getTranslations({ locale, namespace: "producers" }), getCurrentUser()]);
  const box = "mt-4 p-5 text-sm";
  const style = { background: "white", border: "1px solid var(--field-b)" } as const;

  if (!user) {
    return (
      <p className={box} style={style}>
        {t("reviewLoginPrompt")}{" "}
        <Link href={`/login?next=/${locale}/producers/${slug}`} className="font-bold underline">{t("reviewLogin")}</Link>
      </p>
    );
  }
  if (user.role !== "buyer") return <p className={box} style={{ ...style, color: "var(--muted)" }}>{t("reviewBuyersOnly")}</p>;

  const [{ data: mine }, { data: profile }] = await Promise.all([
    user.supabase.from("reviews").select("status").eq("producer_company_id", companyId).eq("author_profile_id", user.userId).maybeSingle(),
    user.supabase.from("profiles").select("onboarding_completed").eq("id", user.userId).single(),
  ]);
  if (mine) return <p role="status" className={box} style={{ ...style, borderInlineStart: "4px solid var(--accent)" }}>{t(`reviewMine_${mine.status}`)}</p>;
  if (!profile?.onboarding_completed) {
    return (
      <p className={box} style={style}>
        {t("reviewProfileFirst")}{" "}
        <Link href="/onboarding" className="font-bold underline">{t("reviewCompleteProfile")}</Link>
      </p>
    );
  }
  return (
    <div className={box} style={style}>
      <h3 className="mb-4 font-bold">{t("leaveReview")}</h3>
      <ReviewForm slug={slug} />
    </div>
  );
}
