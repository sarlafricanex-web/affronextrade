import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app/AppNav";

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
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // Deuxieme verrou apres le proxy : une page protegee ne s'affiche jamais sans session valide.
  if (!userId) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", userId).single();

  return (
    <div className="mx-auto md:grid md:grid-cols-[240px_1fr]" style={{ maxWidth: 1280, minHeight: "70svh" }}>
      <AppNav role={profile?.role ?? "buyer"} name={profile?.full_name ?? ""} />
      <div style={{ padding: "2.5rem var(--page-margin)", minWidth: 0 }}>{children}</div>
    </div>
  );
}
