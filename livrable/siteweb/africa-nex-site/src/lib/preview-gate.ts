import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { safeCompare } from "./safe-compare";

// Version de test en ligne (deploiement Vercel "preview" de la branche plateforme) : reservee a
// l'equipe par un mot de passe partage, demande par le navigateur (authentification HTTP Basic).
// - Production : jamais actif, meme si PREVIEW_PASSWORD y a ete copiee par erreur
//   (VERCEL_ENV vient des variables systeme de Vercel, a laisser activees).
// - Version de test sans mot de passe configure : tout est refuse, jamais d'acces ouvert par erreur.
// - Le nom d'utilisateur saisi est libre : seul le mot de passe compte.
export function previewGate(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV === "production") return null;
  const password = process.env.PREVIEW_PASSWORD;
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (!password && !isPreview) return null;
  if (!password) return new NextResponse("Version de test non configuree.", { status: 503 });

  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    if (safeCompare(decoded.slice(decoded.indexOf(":") + 1), password)) return null;
  }
  return new NextResponse("Acces reserve a l'equipe AFRICA NEX.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AFRICA NEX - version de test", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
