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
    cap20: str(p?.container_capacity_20ft),
    cap40: str(p?.container_capacity_40ft),
    stock: str(p?.stock_quantity),
    status: p?.status ?? "draft",
    images: productImages(p),
  };
}
