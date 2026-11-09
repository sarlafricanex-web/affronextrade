import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export const instant = false;

const SPACE = { producer: "spaceProducer", buyer: "spaceBuyer", admin: "spaceAdmin" } as const;
const NEXT_STEP = { producer: "nextProducer", buyer: "nextBuyer", admin: "nextAdmin" } as const;
const ACTION = {
  producer: null,
  buyer: { href: "/producers", key: "browseProducers" },
  admin: { href: "/admin", key: "openAdmin" },
} as const;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.fullName.trim().split(/\s+/)[0];
  const action = ACTION[user.role];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t(SPACE[user.role])}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>
          {firstName ? t("greeting", { name: firstName }) : t("greetingNoName")}
        </h1>
      </header>

      <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
        <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("comingSoonTitle")}</h2>
        <p className="mt-3" style={{ color: "var(--muted)" }}>{t("comingSoonText")}</p>
        <p className="mt-5 font-semibold">{t(NEXT_STEP[user.role])}</p>
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
