import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

// Ouverture d'un document d'entreprise : lien signe valable 60 secondes.
// Qui peut lire la ligne est decide par la RLS, avec la session du visiteur :
// document public et verifie d'une fiche en ligne, document de sa propre entreprise, ou admin.
// La cle secrete ne sert qu'a signer le lien, une fois ce droit etabli.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });
  const supabase = await createClient();
  const { data: doc } = await supabase.from("company_documents").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });

  const { data, error } = await createAdminClient().storage.from("company-documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: NO_STORE });
}
