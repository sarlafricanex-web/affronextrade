import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Visiteur anonyme, sans cookies : utilisable dans une portee 'use cache'
// pour les donnees publiques (annuaire, avis approuves).
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
