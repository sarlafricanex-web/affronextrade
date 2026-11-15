import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CNRC_COLUMNS, EXPORT_CNRC_SECTORS, cnrcRefusal, type CnrcActivity } from "@/lib/cnrc";

const HEADERS = { "Cache-Control": "private, max-age=300" };

// Recherche dans la nomenclature CNRC (table publique) :
//   ?code=107301 : un code precis, avec la raison d'un eventuel refus ;
//   ?q=huile     : jusqu'a 20 activites d'export (code ou mots de l'intitule).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const supabase = await createClient();
  const code = (params.get("code") ?? "").trim();
  if (code) {
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ activity: null, refusal: "errorActivityUnknown" }, { headers: HEADERS });
    const { data } = await supabase.from("cnrc_activities").select(CNRC_COLUMNS).eq("code", code).maybeSingle();
    return NextResponse.json({ activity: data, refusal: cnrcRefusal(data as CnrcActivity | null) }, { headers: HEADERS });
  }
  const q = (params.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] }, { headers: HEADERS });
  let query = supabase
    .from("cnrc_activities")
    .select(CNRC_COLUMNS)
    .in("cnrc_sector", EXPORT_CNRC_SECTORS)
    .neq("status", "blocked")
    .not("isic_division", "is", null)
    .order("code")
    .limit(20);
  if (/^\d+$/.test(q)) query = query.like("code", `${q}%`);
  else for (const word of q.split(/\s+/).filter((w) => w.length >= 2).slice(0, 4)) query = query.ilike("label_fr", `%${word.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  return NextResponse.json({ results: data ?? [] }, { headers: HEADERS });
}
