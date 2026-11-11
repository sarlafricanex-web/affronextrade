import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompany } from "@/lib/data/company";

export const instant = false;

const SPACE = { producer: "spaceProducer", buyer: "spaceBuyer", admin: "spaceAdmin" } as const;
const NEXT_STEP = { producer: "nextProducer", buyer: "nextBuyer", admin: "nextAdmin" } as const;
const ACTION = {
  producer: { href: "/onboarding", key: "startOnboarding" },
  buyer: { href: "/producers", key: "browseProducers" },
  admin: { href: "/admin", key: "openAdmin" },
} as const;

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ configured?: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.fullName.trim().split(/\s+/)[0];
  const { configured } = await searchParams;
  // Producteur : configuration a commencer, a reprendre, ou terminee (lien vers son entreprise).
  let action: { href: string; key: string } = ACTION[user.role];
  if (user.role === "producer") {
    const [company, { data: profile }] = await Promise.all([
      getMyCompany(user.supabase, user.userId),
      user.supabase.from("profiles").select("onboarding_completed").eq("id", user.userId).single(),
    ]);
    if (profile?.onboarding_completed) action = { href: "/company", key: "navCompany" };
    else if (company) action = { href: company.description_fr ? "/onboarding?step=3" : "/onboarding?step=2", key: "continueOnboarding" };
  } else if (user.role === "buyer") {
    // Acheteur : profil d'entreprise a remplir avant de demander des devis.
    const { data: profile } = await user.supabase.from("profiles").select("onboarding_completed").eq("id", user.userId).single();
    if (!profile?.onboarding_completed) action = { href: "/onboarding", key: "startBuyerOnboarding" };
  }
  const nextStep = user.role === "buyer" && action.href === "/onboarding" ? "nextBuyerSetup" : NEXT_STEP[user.role];

  return (
    <div className="flex flex-col gap-8">
      {configured && (user.role === "producer" || user.role === "buyer") && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>
          {t(user.role === "buyer" ? "buyerConfiguredNotice" : "configuredNotice")}
        </p>
      )}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t(SPACE[user.role])}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>
          {firstName ? t("greeting", { name: firstName }) : t("greetingNoName")}
        </h1>
      </header>

      <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
        <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("comingSoonTitle")}</h2>
        <p className="mt-3" style={{ color: "var(--muted)" }}>{t("comingSoonText")}</p>
        <p className="mt-5 font-semibold">{t(nextStep)}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-5 inline-block px-5 py-3 text-sm font-bold uppercase"
            style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
          >
            {t(action.key)}
          </Link>
        )}
      </section>
    </div>
  );
}
