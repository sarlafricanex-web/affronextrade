"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId, getProduct, productImages, type ProductImage } from "@/lib/data/company";
import { contentTypeOf, readImage } from "@/lib/images";
import { CURRENCIES, PRICE_BASES, UNITS, normalizeHsCode, parseAmount } from "@/lib/onboarding/reference";
import type { Database } from "@/lib/supabase/database.types";
import { STORAGE_CONDITIONS, estimateContainer, type StorageCondition } from "@/lib/logistics/container";

export type CatalogField =
  | "productName" | "hsCode" | "descriptionFr" | "descriptionEn" | "descriptionAr" | "price" | "currency" | "priceBasis"
  | "unit" | "moq" | "packaging" | "stock" | "status" | "photo"
  | "unitsPerCarton" | "cartonLength" | "cartonWidth" | "cartonHeight" | "cartonWeight" | "maxStack" | "storage" | "cartonsPerPallet";
// values : saisie renvoyee en cas d'erreur (React reinitialise le formulaire apres chaque envoi).
export type CatalogState = {
  errors: Partial<Record<CatalogField, string>>;
  formError?: string;
  values?: Record<string, string>;
  attempt?: number;
};
const TEXT_FIELDS = [
  "productName", "hsCode", "descriptionFr", "descriptionEn", "descriptionAr", "price", "currency", "priceBasis",
  "unit", "moq", "packaging", "stock", "status",
  "unitsPerCarton", "cartonLength", "cartonWidth", "cartonHeight", "cartonWeight", "maxStack", "storage", "palletized", "cartonsPerPallet",
] as const;

// Nombre facultatif > 0 et <= max : null si vide, NaN si invalide.
function optionalPositive(value: string, max: number) {
  if (value === "") return null;
  const n = parseAmount(value);
  return n !== null && n > 0 && n <= max ? n : NaN;
}

const MAX_PHOTOS = 5;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Entier facultatif >= 0 : null si vide, NaN si invalide.
function optionalInt(value: string) {
  const v = value.replace(/\s/g, "");
  if (v === "") return null;
  return /^\d{1,9}$/.test(v) ? Number(v) : NaN;
}

async function producerContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  return { locale, supabase: user.supabase, companyId };
}

// Creation ou modification d'un produit. La RLS garantit qu'un producteur ne touche qu'aux produits
// de sa propre entreprise ; chaque champ est revalide ici.
export async function saveProduct(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const { locale, supabase, companyId } = await producerContext(formData);
  const productId = text(formData, "id");
  const existing = productId ? await getProduct(supabase, companyId, productId) : null;
  if (productId && !existing) redirect(`/${locale}/catalog`);

  const stockRaw = text(formData, "stock");
  const v = {
    productName: text(formData, "productName"),
    hsCode: normalizeHsCode(text(formData, "hsCode")),
    descriptionFr: text(formData, "descriptionFr"),
    descriptionEn: text(formData, "descriptionEn"),
    descriptionAr: text(formData, "descriptionAr"),
    price: parseAmount(text(formData, "price")),
    currency: text(formData, "currency"),
    priceBasis: text(formData, "priceBasis"),
    unit: text(formData, "unit"),
    moq: parseAmount(text(formData, "moq")),
    packaging: text(formData, "packaging"),
    stock: stockRaw === "" ? null : parseAmount(stockRaw),
    status: text(formData, "status"),
    // Fiche logistique (facultative) : la capacite par conteneur en est deduite, jamais saisie.
    unitsPerCarton: optionalPositive(text(formData, "unitsPerCarton"), 1_000_000),
    cartonLength: optionalPositive(text(formData, "cartonLength"), 300),
    cartonWidth: optionalPositive(text(formData, "cartonWidth"), 300),
    cartonHeight: optionalPositive(text(formData, "cartonHeight"), 300),
    cartonWeight: optionalPositive(text(formData, "cartonWeight"), 2000),
    maxStack: optionalInt(text(formData, "maxStack")),
    storage: text(formData, "storage"),
    palletized: formData.get("palletized") === "on",
    cartonsPerPallet: optionalInt(text(formData, "cartonsPerPallet")),
  };

  const errors: CatalogState["errors"] = {};
  if (v.productName.length < 2 || v.productName.length > 255) errors.productName = "errorProductName";
  if (!v.hsCode) errors.hsCode = "errorHsCode";
  for (const k of ["descriptionFr", "descriptionEn", "descriptionAr"] as const) if (v[k].length > 2000) errors[k] = "errorTooLong";
  if (v.price === null || v.price <= 0) errors.price = "errorPrice";
  if (!(CURRENCIES as readonly string[]).includes(v.currency)) errors.currency = "errorChoose";
  if (!(PRICE_BASES as readonly string[]).includes(v.priceBasis)) errors.priceBasis = "errorChoose";
  if (!(UNITS as readonly string[]).includes(v.unit)) errors.unit = "errorChoose";
  if (v.moq === null || v.moq <= 0) errors.moq = "errorMoq";
  if (v.packaging.length > 200) errors.packaging = "errorTooLong";
  if (stockRaw !== "" && v.stock === null) errors.stock = "errorAmount";
  for (const k of ["unitsPerCarton", "cartonLength", "cartonWidth", "cartonHeight", "cartonWeight"] as const) {
    if (Number.isNaN(v[k])) errors[k] = "errorPositive";
  }
  if (Number.isNaN(v.maxStack) || (v.maxStack !== null && (v.maxStack < 1 || v.maxStack > 50))) errors.maxStack = "errorStack";
  if (v.storage && !(STORAGE_CONDITIONS as readonly string[]).includes(v.storage)) errors.storage = "errorChoose";
  if (Number.isNaN(v.cartonsPerPallet) || (v.cartonsPerPallet !== null && (v.cartonsPerPallet < 1 || v.cartonsPerPallet > 500))) errors.cartonsPerPallet = "errorPallet";
  if (v.palletized && v.cartonsPerPallet === null) errors.cartonsPerPallet = "errorPallet";
  if (!["draft", "published"].includes(v.status)) errors.status = "errorChoose";

  // Photos : retraits demandes (seulement parmi celles du produit), puis une nouvelle eventuelle.
  const current = productImages(existing);
  const toRemove = new Set(formData.getAll("removePhoto").map(String).filter((p) => current.some((i) => i.path === p)));
  let images: ProductImage[] = current.filter((i) => !toRemove.has(i.path));
  const photo = await readImage(formData.get("photo"), PHOTO_MAX_BYTES);
  if (photo && "error" in photo) errors.photo = photo.error === "size" ? "errorPhotoSize" : "errorPhotoType";
  else if (photo && images.length >= MAX_PHOTOS) errors.photo = "errorPhotoCount";
  const values = Object.fromEntries(TEXT_FIELDS.map((k) => [k, text(formData, k)]));
  const fail = (s: Omit<CatalogState, "values" | "attempt">): CatalogState => ({ ...s, values, attempt: Date.now() });
  if (Object.keys(errors).length) return fail({ errors });

  if (photo && !("error" in photo)) {
    const path = `${companyId}/produit-${randomBytes(6).toString("hex")}.${photo.kind}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, photo.bytes, { contentType: contentTypeOf(photo.kind), upsert: false });
    if (uploadError) {
      console.error("Catalog photo upload failed:", uploadError.message);
      return fail({ errors: {}, formError: "errorGeneric" });
    }
    images = [...images, { path, url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl }];
  }

  // Capacite par conteneur recalculee ici (la valeur affichee dans le navigateur n'est qu'un apercu).
  const num = (x: number | null) => (x === null || Number.isNaN(x) ? null : x);
  const logistics = {
    unitsPerCarton: num(v.unitsPerCarton),
    lengthCm: num(v.cartonLength),
    widthCm: num(v.cartonWidth),
    heightCm: num(v.cartonHeight),
    grossWeightKg: num(v.cartonWeight),
    maxStackLayers: num(v.maxStack),
    storage: (v.storage || null) as StorageCondition | null,
    palletized: v.palletized,
    cartonsPerPallet: num(v.cartonsPerPallet),
  };
  const est20 = estimateContainer(logistics, "20");
  const est40 = estimateContainer(logistics, "40");
  const hasCarton = logistics.lengthCm && logistics.widthCm && logistics.heightCm && logistics.grossWeightKg;

  const fields = {
    units_per_carton: logistics.unitsPerCarton,
    carton_length_cm: logistics.lengthCm,
    carton_width_cm: logistics.widthCm,
    carton_height_cm: logistics.heightCm,
    carton_gross_weight_kg: logistics.grossWeightKg,
    max_stack_layers: logistics.maxStackLayers,
    storage_condition: logistics.storage,
    palletized: logistics.palletized,
    cartons_per_pallet: logistics.palletized ? logistics.cartonsPerPallet : null,
    dimensions_cm: hasCarton ? { length: logistics.lengthCm, width: logistics.widthCm, height: logistics.heightCm, weight_kg: logistics.grossWeightKg } : null,
    container_capacity_20ft: est20?.units ?? null,
    container_capacity_40ft: est40?.units ?? null,
    product_name: v.productName,
    hs_code: v.hsCode,
    description_fr: v.descriptionFr || null,
    description_en: v.descriptionEn || null,
    description_ar: v.descriptionAr || null,
    unit_price_ht: v.price,
    currency: v.currency,
    price_basis: v.priceBasis,
    unit: v.unit,
    min_order_quantity: v.moq,
    packaging: v.packaging || null,
    stock_quantity: v.stock,
    status: v.status,
    images,
  } satisfies Database["public"]["Tables"]["products"]["Update"];

  const { error } = existing
    ? await supabase.from("products").update(fields).eq("id", existing.id)
    : await supabase.from("products").insert({ ...fields, company_id: companyId, source: "producer" });
  if (error) {
    console.error("Catalog save failed:", error.code, error.message);
    const added = images.filter((i) => !current.some((c) => c.path === i.path)).map((i) => i.path);
    if (added.length) await supabase.storage.from("product-images").remove(added);
    return fail({ errors: {}, formError: "errorGeneric" });
  }
  const removable = [...toRemove].filter((p) => p.startsWith(`${companyId}/`));
  if (removable.length) await supabase.storage.from("product-images").remove(removable);

  updateTag("producers"); // annuaire et fiche publique a jour
  redirect(`/${locale}/catalog?saved=1`);
}

// Suppression d'un produit et de ses photos.
export async function deleteProduct(formData: FormData) {
  const { locale, supabase, companyId } = await producerContext(formData);
  const product = await getProduct(supabase, companyId, text(formData, "id"));
  if (product) {
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) console.error("Catalog delete failed:", error.code, error.message);
    else {
      const paths = productImages(product).map((i) => i.path).filter((p) => p.startsWith(`${companyId}/`));
      if (paths.length) await supabase.storage.from("product-images").remove(paths);
    }
  }
  updateTag("producers");
  redirect(`/${locale}/catalog?deleted=1`);
}
