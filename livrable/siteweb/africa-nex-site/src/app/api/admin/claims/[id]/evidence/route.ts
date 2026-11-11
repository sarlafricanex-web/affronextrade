import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

// Justificatif d'une revendication : redirection vers un lien signe valable 60 secondes,
// genere a la demande pour un admin connecte. Le fichier n'est jamais public.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { data: claim } = await user.supabase.from("company_claims").select("evidence_path").eq("id", id).maybeSingle();
  if (!claim?.evidence_path) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data, error } = await user.supabase.storage.from("company-documents").createSignedUrl(claim.evidence_path, 60);
  if (error || !data) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
