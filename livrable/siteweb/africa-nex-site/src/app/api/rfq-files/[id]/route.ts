import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rfqAttachments } from "@/lib/data/rfq";

const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f-]{36}$/i;
const notFound = () => NextResponse.json({ error: "Introuvable" }, { status: 404, headers: NO_STORE });

// Piece jointe d'une demande de devis (id = demande) ou d'un devis producteur
// (?quote=<devis>) : lien signe valable 60 secondes. Le droit de lecture est decide
// par la RLS, avec la session du visiteur : l'acheteur pour ses demandes, le producteur
// pour ses devis, AFRICA NEX pour tout. Un acheteur ne lit jamais un devis producteur.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const index = Number(search.get("i") ?? "0");
  const quoteId = search.get("quote");
  if (!UUID.test(id) || !Number.isInteger(index) || index < 0 || (quoteId !== null && !UUID.test(quoteId))) return notFound();
  const supabase = await createClient();

  let path: string | undefined;
  if (quoteId) {
    const { data: quote } = await supabase.from("quotes").select("dispatch_id, attachments, dispatch:rfq_dispatches(rfq_id)").eq("id", quoteId).maybeSingle();
    const dispatch = quote ? ((Array.isArray(quote.dispatch) ? quote.dispatch[0] : quote.dispatch) as { rfq_id: string } | null) : null;
    const file = quote && dispatch?.rfq_id === id ? rfqAttachments(quote)[index] : undefined;
    path = file && file.path.startsWith(`dispatch/${quote!.dispatch_id}/`) ? file.path : undefined;
  } else {
    const { data: rfq } = await supabase.from("rfqs").select("attachments").eq("id", id).maybeSingle();
    const file = rfq ? rfqAttachments(rfq)[index] : undefined;
    path = file && file.path.startsWith(`buyer/${id}/`) ? file.path : undefined;
  }
  if (!path) return notFound();

  const { data, error } = await createAdminClient().storage.from("rfq-files").createSignedUrl(path, 60);
  if (error || !data) return notFound();
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: NO_STORE });
}
