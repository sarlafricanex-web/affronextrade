import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rfqAttachments } from "@/lib/data/rfq";

const NO_STORE = { "Cache-Control": "no-store" };

// Piece jointe d'une demande de devis : lien signe valable 60 secondes.
// Le droit de lire la demande est decide par la RLS, avec la session du visiteur
// (l'acheteur pour ses demandes, AFRICA NEX pour toutes ; jamais un producteur).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = Number(new URL(request.url).searchParams.get("i") ?? "0");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });
  const supabase = await createClient();
  const { data: rfq } = await supabase.from("rfqs").select("attachments").eq("id", id).maybeSingle();
  const file = rfq ? rfqAttachments(rfq)[index] : undefined;
  if (!file || !file.path.startsWith(`buyer/${id}/`)) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });

  const { data, error } = await createAdminClient().storage.from("rfq-files").createSignedUrl(file.path, 60);
  if (error || !data) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: NO_STORE });
}
