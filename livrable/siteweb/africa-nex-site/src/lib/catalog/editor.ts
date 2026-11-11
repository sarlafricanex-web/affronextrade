import "server-only";
import { productImages, type Product } from "@/lib/data/company";
import type { EditorProduct } from "@/components/catalog/ProductEditor";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// Produit de la base -> valeurs du formulaire d'edition (vide pour un nouveau produit).
export function toEditorProduct(p: Product | null): EditorProduct {
  return {
    id: p?.id ?? "",
    productName: p?.product_name ?? "",
    hsCode: p?.hs_code ?? "",
    descriptionFr: p?.description_fr ?? "",
    descriptionEn: p?.description_en ?? "",
    descriptionAr: p?.description_ar ?? "",
    price: str(p?.unit_price_ht),
    currency: p?.currency ?? "",
    priceBasis: p?.price_basis ?? "",
    unit: p?.unit ?? "",
    moq: str(p?.min_order_quantity),
    packaging: p?.packaging ?? "",
    stock: str(p?.stock_quantity),
    unitsPerCarton: str(p?.units_per_carton),
    cartonLength: str(p?.carton_length_cm),
    cartonWidth: str(p?.carton_width_cm),
    cartonHeight: str(p?.carton_height_cm),
    cartonWeight: str(p?.carton_gross_weight_kg),
    maxStack: str(p?.max_stack_layers),
    storage: p?.storage_condition ?? "",
    palletized: p?.palletized ? "on" : "",
    cartonsPerPallet: str(p?.cartons_per_pallet),
    status: p?.status ?? "draft",
    images: productImages(p),
  };
}
