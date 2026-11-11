import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countryName } from "@/lib/countries";
import { ReviewForm } from "./ReviewForm";
import { Stars } from "./parts";

// Bloc "laisser un avis" de la fiche publique, d'apres la maquette Stitch 10. Lit la session :
// rendu a la demande (sous Suspense) alors que le reste de la fiche reste en cache.

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const STATUS = {
  pending: { bg: "#fff7ed", border: "#f97316", color: "#9a3412" },
  approved: { bg: "#ecfdf5", border: "#10b981", color: "#065f46" },
  rejected: { bg: "#fef2f2", border: "#dc2626", color: "#991b1b" },
} as const;

// Meme regle que la base (trigger reviews_fill_author) : "Prenom I."
function displayName(fullName: string | null) {
  const n = (fullName ?? "").trim();
  if (!n) return null;
  const [first, second] = n.split(/\s+/);
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

export async function ReviewSlot({ companyId, slug, locale, producerName }: { companyId: string; slug: string; locale: string; producerName: string }) {
  const [t, format, user] = await Promise.all([getTranslations({ locale, namespace: "producers" }), getFormatter({ locale }), getCurrentUser()]);
  const note = "mt-4 p-5 text-sm";
  const box = { background: "white", border: `1px solid ${HAIR}` } as const;

  if (!user) {
    return (
      <p className={note} style={box}>
        {t("reviewLoginPrompt")}{" "}
        <Link href={`/login?next=/${locale}/producers/${slug}`} className="font-bold underline" style={{ color: "var(--ink)" }}>{t("reviewLogin")}</Link>
      </p>
    );
  }
  if (user.role !== "buyer") return <p className={note} style={{ ...box, color: "var(--muted)" }}>{t("reviewBuyersOnly")}</p>;

  const [{ data: mine }, { data: profile }, { data: membership }] = await Promise.all([
    user.supabase.from("reviews").select("status, rating, comment, created_at").eq("producer_company_id", companyId).eq("author_profile_id", user.userId).maybeSingle(),
    user.supabase.from("profiles").select("onboarding_completed, full_name").eq("id", user.userId).single(),
    user.supabase.from("company_members").select("companies(country, kind)").eq("profile_id", user.userId).limit(1).maybeSingle(),
  ]);
  if (!mine && !profile?.onboarding_completed) {
    return (
      <p className={note} style={box}>
        {t("reviewProfileFirst")}{" "}
        <Link href="/onboarding" className="font-bold underline" style={{ color: "var(--ink)" }}>{t("reviewCompleteProfile")}</Link>
      </p>
    );
  }

  const buyerCompany = membership?.companies as { country: string; kind: string } | null | undefined;
  const country = buyerCompany?.kind === "buyer" ? countryName(buyerCompany.country, locale) : null;
  const publishedAs = [displayName(profile?.full_name ?? null) ?? t("reviewBuyer"), country].filter(Boolean).join(" · ");
  const status = mine?.status as keyof typeof STATUS | undefined;

  return (
    <div className="mt-4" style={{ border: `1px solid ${HAIR}`, background: "white" }}>
      <div className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5" /></svg>
        <div>
          <h3 className="font-extrabold uppercase" style={{ letterSpacing: "-0.01em" }}>{t("reviewPanelTitle", { name: producerName })}</h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("reviewPanelSubtitle")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="p-5" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <p className="mb-4 pb-2 text-xs font-bold uppercase" style={{ ...caps, borderBottom: `1px solid ${HAIR}` }}>{t("reviewStepEval")}</p>
          {mine ? (
            <div className="flex flex-col gap-3 text-sm">
              <p style={{ color: "var(--muted)" }}>{t("reviewAlreadySent")}</p>
            </div>
          ) : (
            <ReviewForm slug={slug} publishedAs={publishedAs} />
          )}
        </div>

        <div className="flex flex-col gap-5 p-5 md:border-s" style={{ background: "#fff8f3", borderColor: HAIR }}>
          <div className="flex items-center justify-between gap-3 pb-2" style={{ borderBottom: `1px solid ${HAIR}` }}>
            <p className="text-xs font-bold uppercase" style={caps}>{t("reviewStepModeration")}</p>
            {status && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: STATUS[status].bg, border: `1px solid ${STATUS[status].border}`, color: STATUS[status].color }}>
                {t(`reviewState_${status}`)}
              </span>
            )}
          </div>

          {mine && status ? (
            <>
              <div role="status" className="flex items-start gap-3 p-4" style={{ background: "white", border: `1px solid ${HAIR}` }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center font-bold" style={{ background: STATUS[status].bg, border: `1px solid ${STATUS[status].border}`, color: STATUS[status].color }} aria-hidden="true">
                  {status === "rejected" ? "×" : "✓"}
                </span>
                <div>
                  <p className="font-bold">{t(`reviewMine_${status}`)}</p>
                  {status === "pending" && <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("reviewPendingText")}</p>}
                </div>
              </div>
              <div style={{ background: "white", border: `1px solid ${HAIR}` }}>
                <p className="px-4 py-2 text-[11px] font-bold uppercase" style={{ ...caps, borderBottom: `1px solid ${HAIR}`, color: "var(--muted)" }}>{t("reviewPreview")}</p>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><Stars rating={mine.rating} size={14} /><strong>{mine.rating} / 5</strong></span>
                    <span className="text-[11px] font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{format.dateTime(new Date(mine.created_at), { dateStyle: "medium" })}</span>
                  </div>
                  {mine.comment && <p className="text-sm italic" style={{ borderInlineStart: "3px solid #10b981", paddingInlineStart: "0.75rem" }}>« {mine.comment} »</p>}
                  <p className="mt-3 pt-3 text-[11px] font-bold uppercase" style={{ ...caps, borderTop: `1px solid ${HAIR}` }}>{publishedAs}</p>
                </div>
              </div>
            </>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {(["reviewFlow1", "reviewFlow2", "reviewFlow3"] as const).map((k, i) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold" style={{ border: "1px solid var(--ink)" }}>{i + 1}</span>
                  <span>{t(k)}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="p-4" style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <p className="mb-2 text-xs font-bold uppercase" style={caps}>{t("reviewRulesTitle")}</p>
            <ul className="list-disc space-y-1.5 ps-5 text-sm" style={{ color: "var(--muted)" }}>
              <li>{t("reviewRule1")}</li>
              <li>{t("reviewRule2")}</li>
              <li>{t("reviewRule3")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
