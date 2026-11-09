import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

// Rafraichit la session et renvoie une reponse "porteuse" des cookies a jour.
// La requete est modifiee en place : le rendu de la page voit la session rafraichie.
export async function refreshSession(request: NextRequest) {
  let carrier = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { claims: null, carrier };

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        carrier = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => carrier.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => carrier.headers.set(name, value));
      },
    },
  });

  // Aucun code entre la creation du client et cet appel : c'est lui qui declenche le rafraichissement.
  const { data } = await supabase.auth.getClaims();
  return { claims: data?.claims ?? null, carrier };
}

// Recopie les cookies rafraichis et les en-tetes anti-cache sur la reponse finale,
// sinon le navigateur garderait un jeton deja consomme et la session serait perdue.
export function adopt(target: NextResponse, carrier: NextResponse) {
  carrier.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const name of CACHE_HEADERS) {
    const value = carrier.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  return target;
}
