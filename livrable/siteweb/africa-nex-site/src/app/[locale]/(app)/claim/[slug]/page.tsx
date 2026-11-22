import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompany } from "@/lib/data/company";
import { WILAYAS } from "@/lib/onboarding/reference";
import { ClaimForm } from "@/components/claim/ClaimForm";
import { ProducerAvatar } from "@/components/producers/parts";
import { isSector } from "@/lib/sectors";

export const instant = false;

// Revendication d'une fiche etablie par AFRICA NEX, d'apres la maquette Stitch 11.
// Un seul ecran, qui explique aussi pourquoi la demande n'est pas possible quand c'est le cas.

const HAIR = "#d8cebb";
const STRIP = "#f5efe6";
const caps = { letterSpacing: "0.08em" } as const;

function Sheet({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ background: STRIP, borderBottom: `1px solid ${HAIR}` }}>
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase" style={caps}>
          <span className="h-2.5 w-2.5" style={{ background: "#f97316" }} aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

type StepState = "done" | "current" | "todo" | "refused";
const STEP_STYLE: Record<StepState, { border: string; bg: string; color: string; badgeBg: string }> = {
  done: { border: "#10b981", bg: "#ecfdf5", color: "#065f46", badgeBg: "#047857" },
  current: { border: "#f97316", bg: "#fff7ed", color: "#9a3412", badgeBg: "#c2410c" },
  todo: { border: HAIR, bg: "#f5efe6", color: "var(--muted)", badgeBg: "#5c5347" },
  refused: { border: "#dc2626", bg: "#fef2f2", color: "#991b1b", badgeBg: "#dc2626" },
};

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

  const [t, ts, { sent }, { data: company }] = await Promise.all([
    getTranslations({ locale, namespace: "claim" }),
    getTranslations({ locale, namespace: "sectors" }),
    searchParams,
    user.supabase
      .from("companies")
      .select("id, company_name, slug, claim_status, visibility, city, wilaya, sector, brand_initials, brand_color, logo_url")
      .eq("slug", slug)
      .maybeSingle(),
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

  const status = myClaim?.status;
  const steps: { key: string; state: StepState }[] = [
    { key: "step1", state: status ? "done" : "todo" },
    { key: "step2", state: status === "pending" ? "current" : status === "approved" ? "done" : status === "rejected" ? "refused" : "todo" },
    { key: "step3", state: status === "approved" ? "done" : "todo" },
  ];
  const wilaya = WILAYAS.find(([code]) => code === company.wilaya)?.[1];
  const place = [company.city, wilaya && company.city !== wilaya ? wilaya : null].filter(Boolean).join(", ");
  const sector = company.sector && isSector(company.sector) ? ts(company.sector) : null;

  return (
    <div className="flex flex-col gap-6">
      {sent && status === "pending" && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t("sentNotice")}</p>
      )}

      <header className="flex flex-col justify-between gap-5 p-6 lg:flex-row lg:items-center" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <span className="h-2 w-2" style={{ background: "#f97316" }} aria-hidden="true" />
            {t("eyebrow")}
          </p>
          <h1 className="font-extrabold" style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{t("title", { name: company.company_name })}</h1>
          <p className="mt-2" style={{ color: "var(--muted)", maxWidth: "62ch" }}>{t("intro")}</p>
        </div>
        <div className="flex items-start gap-3 p-4 lg:max-w-xs" style={{ background: "#fff2e2", border: `1px solid ${HAIR}` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3zM9 12l2 2 4-4" /></svg>
          <div>
            <p className="text-[11px] font-bold uppercase" style={caps}>{t("badgeTitle")}</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{t("badgeText")}</p>
          </div>
        </div>
      </header>

      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: STRIP, borderBottom: `1px solid ${HAIR}`, color: "var(--muted)" }}>{t("targetTitle")}</h2>
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ProducerAvatar name={company.company_name} logo={company.logo_url} initials={company.brand_initials ?? company.company_name.slice(0, 2).toUpperCase()} color={company.brand_color ?? "#0f172a"} size={56} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/producers/${company.slug}`} className="text-xl font-extrabold hover:underline" style={{ color: "var(--ink)" }}>{company.company_name}</Link>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }}>{t("listedBadge")}</span>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{[place, sector].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <p className="text-xs md:max-w-xs md:ps-5" style={{ color: "var(--muted)", borderInlineStart: `1px solid ${HAIR}` }}>
            <strong style={{ color: "var(--ink)" }}>{t("protocolTitle")}</strong> {t("protocolText")}
          </p>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Sheet title={t("formTitle")} aside={notice ? null : <span className="text-[11px]" style={{ color: "var(--muted)" }}>{t("requiredFields")}</span>}>
          {notice ? (
            <div className="flex flex-col gap-4">
              <h3 className="font-extrabold" style={{ fontSize: "1.25rem" }}>{notice.title}</h3>
              <p style={{ color: "var(--muted)" }}>{notice.text}</p>
              <div className="flex flex-wrap gap-4">
                <Link href={`/producers/${company.slug}`} className="text-sm font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t("backToProfile")}</Link>
                <Link href="/contact" className="text-sm font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("contactUs")}</Link>
              </div>
            </div>
          ) : (
            <ClaimForm slug={company.slug} companyName={company.company_name} defaults={{ nif: "", workEmail: "", phone: profile?.phone ?? "", jobTitle: "", message: "" }} />
          )}
        </Sheet>

        <div className="flex flex-col gap-6">
          <Sheet title={t("trackTitle")}>
            <ol className="flex flex-col gap-3">
              {steps.map((s) => {
                const st = STEP_STYLE[s.state];
                return (
                  <li key={s.key} className="p-3" style={{ background: st.bg, border: `${s.state === "current" ? 2 : 1}px solid ${st.border}` }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold" style={{ color: st.color }}>{t(`${s.key}Title`)}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ ...caps, background: st.badgeBg }}>{t(`stepState_${s.state}`)}</span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: st.color }}>{t(`${s.key}Text`)}</p>
                  </li>
                );
              })}
            </ol>
          </Sheet>

          <Sheet title={t("whyTitle")}>
            <ul className="flex flex-col gap-4">
              {(["why1", "why2", "why3"] as const).map((k) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold" style={{ border: "1px solid #10b981", color: "#065f46" }} aria-hidden="true">✓</span>
                  <span>
                    <span className="block font-bold">{t(`${k}Title`)}</span>
                    <span className="block text-sm" style={{ color: "var(--muted)" }}>{t(`${k}Text`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title={t("neutralTitle")}>
            <ul className="flex flex-col gap-4 text-sm">
              {(["neutral1", "neutral2"] as const).map((k, i) => (
                <li key={k} style={{ borderTop: i ? `1px solid ${HAIR}` : undefined, paddingTop: i ? "1rem" : undefined }}>
                  <strong>{t(`${k}Title`)}</strong> <span style={{ color: "var(--muted)" }}>{t(`${k}Text`)}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
