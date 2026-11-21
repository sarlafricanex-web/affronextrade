import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId, listProducts } from "@/lib/data/company";
import { buildPriceListWorkbook } from "@/lib/catalog/price-list-excel";
import { packLabelMaps } from "@/lib/catalog/pack-labels";

const NO_STORE = { "Cache-Control": "no-store" };

// Liste de prix du fournisseur connecte en Excel (modele unique), pre-remplie avec son
// catalogue. La RLS et product_prices() limitent la lecture aux produits de sa propre entreprise.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "producer") return NextResponse.json({ error: "Interdit" }, { status: 403, headers: NO_STORE });
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) return NextResponse.json({ error: "Interdit" }, { status: 403, headers: NO_STORE });
  try {
    const [products, { data: company }, labels] = await Promise.all([
      listProducts(user.supabase, companyId),
      user.supabase.from("companies").select("company_name").eq("id", companyId).single(),
      packLabelMaps(),
    ]);
    const generatedOn = new Date().toISOString().slice(0, 10);
    const buffer = await buildPriceListWorkbook({ products, companyName: company?.company_name ?? "", labels, generatedOn });
    const slug = (company?.company_name ?? "catalogue").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="liste-de-prix-${slug}-${generatedOn}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("Price list export failed:", e);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500, headers: NO_STORE });
  }
}
