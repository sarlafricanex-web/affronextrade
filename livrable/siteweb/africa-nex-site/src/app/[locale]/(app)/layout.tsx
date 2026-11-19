import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AppNav } from "@/components/app/AppNav";
import { countOffersReady } from "@/lib/data/rfq";
import { countRfqsToQualify } from "@/lib/data/admin-rfqs";
import { countNewRequests } from "@/lib/data/requests";
import { getMyCompanyId } from "@/lib/data/company";
import { countUnreadMessages } from "@/lib/data/messages";

// Producteur : nouvelles demandes de devis pas encore ouvertes, plus les messages non lus.
async function producerBadges(client: Parameters<typeof getMyCompanyId>[0], userId: string): Promise<Record<string, number>> {
  const companyId = await getMyCompanyId(client, userId);
  if (!companyId) return {};
  const [fresh, unread] = await Promise.all([countNewRequests(client, companyId), countUnreadMessages(client, "producer")]);
  return { "/requests": fresh + unread };
}

// Pages par utilisateur : rendues a chaque requete, sans validation de navigation instantanee.
export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <Suspense fallback={<div style={{ minHeight: "70svh" }} />}>
        <AppShell params={params}>{children}</AppShell>
      </Suspense>
    </div>
  );
}

async function AppShell({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  // Deuxieme verrou apres le proxy : une page protegee ne s'affiche jamais sans session valide.
  if (!user) redirect(`/${locale}/login`);
  // Notifications dans l'espace : compteurs a cote des liens du menu (elements a traiter + messages
  // non lus, lot 5f).
  const sum = async (...counts: Promise<number>[]) => (await Promise.all(counts)).reduce((a, b) => a + b, 0);
  const badges: Record<string, number> =
    user.role === "buyer" ? { "/rfq": await sum(countOffersReady(user.supabase, user.userId), countUnreadMessages(user.supabase, "buyer")) }
    : user.role === "admin" ? { "/admin/rfqs": await sum(countRfqsToQualify(user.supabase), countUnreadMessages(user.supabase, "admin")) }
    : user.role === "producer" ? await producerBadges(user.supabase, user.userId)
    : {};

  return (
    <div className="mx-auto md:grid md:grid-cols-[240px_1fr]" style={{ maxWidth: 1280, minHeight: "70svh" }}>
      <AppNav role={user.role} name={user.fullName} badges={badges} />
      <div style={{ padding: "2.5rem var(--page-margin)", minWidth: 0 }}>{children}</div>
    </div>
  );
}
