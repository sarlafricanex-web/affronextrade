import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminCockpit } from "@/lib/data/admin-cockpit";
import { Harness } from "./Harness";

// PROTOTYPE (skill prototype) : trois variantes du tableau de bord admin, a comparer en direct.
// A supprimer une fois la variante choisie. Rien du site n'importe ce dossier.
export const metadata: Metadata = { title: "Prototype : tableau de bord admin", robots: { index: false, follow: false } };
export const instant = false;

export default async function AdminDashboardPrototype({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const data = await getAdminCockpit(user.supabase);
  return <Harness data={data} name={user.fullName || "Admin"} locale={locale} />;
}
