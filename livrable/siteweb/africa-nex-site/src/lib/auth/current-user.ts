import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "producer" | "buyer" | "admin";

// Session et profil lus une seule fois par requete, partages entre le layout et la page.
// Le role vient de la base (profiles.role), jamais du navigateur ni des metadonnees du compte.
// Le client renvoye agit au nom de l'utilisateur : la RLS reste la vraie barriere.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", userId).single();
  const role: Role = profile?.role === "producer" || profile?.role === "admin" ? profile.role : "buyer";
  return { supabase, userId, role, fullName: profile?.full_name ?? "" };
});
