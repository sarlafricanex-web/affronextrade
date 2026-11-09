import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Lit les cookies : ne jamais appeler depuis une portee 'use cache', meme indirectement.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Un Server Component ne peut pas ecrire de cookie : le proxy rafraichit la session.
          }
        },
      },
    },
  );
}
