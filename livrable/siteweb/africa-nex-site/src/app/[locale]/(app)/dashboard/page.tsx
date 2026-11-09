import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", userId).single();
  const role = profile?.role ?? "buyer";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const space = role === "producer" ? "spaceProducer" : role === "admin" ? "spaceAdmin" : "spaceBuyer";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t(space)}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>
          {firstName ? t("greeting", { name: firstName }) : t("greetingNoName")}
        </h1>
      </header>

      <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
        <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("comingSoonTitle")}</h2>
        <p className="mt-3" style={{ color: "var(--muted)" }}>{t("comingSoonText")}</p>
        <p className="mt-5 font-semibold">{t(role === "producer" ? "nextProducer" : "nextBuyer")}</p>
        {role !== "producer" && (
          <Link
            href="/producers"
            className="mt-5 inline-block px-5 py-3 text-sm font-bold uppercase"
            style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
          >
            {t("browseProducers")}
          </Link>
        )}
      </section>
    </div>
  );
}
