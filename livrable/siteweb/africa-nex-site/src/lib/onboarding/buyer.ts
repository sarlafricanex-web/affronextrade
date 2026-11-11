import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMyCompany } from "@/lib/data/company";
import type { BuyerDefaults } from "@/components/onboarding/BuyerForm";

// Valeurs du formulaire acheteur : son entreprise si elle existe, sinon le telephone saisi a l'inscription.
export async function buyerDefaults(client: SupabaseClient<Database>, userId: string): Promise<BuyerDefaults> {
  const [company, { data: profile }] = await Promise.all([
    getMyCompany(client, userId),
    client.from("profiles").select("phone, whatsapp").eq("id", userId).single(),
  ]);
  return {
    companyName: company?.company_name ?? "",
    buyerType: company?.buyer_type ?? "",
    country: company?.country ?? "",
    city: company?.city ?? "",
    phone: company?.private?.contact_phone ?? profile?.phone ?? "",
    whatsapp: company?.private?.contact_whatsapp ?? profile?.whatsapp ?? "",
    interests: company?.interests ?? [],
    website: company?.website ?? "",
  };
}
