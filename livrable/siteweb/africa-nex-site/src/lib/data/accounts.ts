import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

// Liste des comptes pour l'administration. A n'appeler qu'apres avoir verifie le role admin.
// - Profils (nom, role, telephone) : lus avec la session de l'admin, la RLS verifie le role.
// - Mode de connexion et derniere connexion : stockes dans auth.users, lisibles seulement
//   avec la cle secrete, cote serveur.

export type Account = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
};

export async function getAccounts(client: SupabaseClient<Database>): Promise<Account[]> {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, full_name, email, role, phone, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: auth, error: authError } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw authError;
  const byId = new Map(auth.users.map((u) => [u.id, u]));

  return profiles.map((p) => {
    const u = byId.get(p.id);
    const meta = (u?.app_metadata ?? {}) as { provider?: string; providers?: string[] };
    return {
      id: p.id,
      fullName: p.full_name ?? "",
      email: p.email ?? u?.email ?? "",
      role: p.role,
      phone: p.phone,
      providers: meta.providers ?? (meta.provider ? [meta.provider] : []),
      createdAt: p.created_at,
      lastSignInAt: u?.last_sign_in_at ?? null,
    };
  });
}
