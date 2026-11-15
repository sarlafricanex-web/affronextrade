"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getCompanyTier, getMyCompanyId, getProduct, productImages, type ProductImage } from "@/lib/data/company";
import { contentTypeOf, readImage } from "@/lib/images";
import { UNITS, normalizeHsCode } from "@/lib/onboarding/reference";
import { PACK_FIELDS, PRICE_FIELDS, readPackagingInput, readPriceInput, type PackField, type PriceField } from "@/lib/catalog/price-list";
import type { Database } from "@/lib/supabase/database.types";
import { packagingFields, readLogisticsExtras } from "@/lib/catalog/packaging-logic";

export type CatalogField =
  | "productName" | "hsCode" | "descriptionFr" | "descriptionEn" | "descriptionAr"
  | "unit" | "packaging" | "status" | "photo"
  | "maxStack" | "storage"
  | PriceField | PackField;
// values : saisie renvoyee en cas d'erreur (React reinitialise le formulaire apres chaque envoi).
export type CatalogState = {
  errors: Partial<Record<CatalogField, string>>;
  formError?: string;
  values?: Record<string, string>;
  attempt?: number;
};
const TEXT_FIELDS = [
  "productName", "hsCode", "descriptionFr", "descriptionEn", "descriptionAr",
  "unit", "packaging", "status",
  "maxStack", "storage",
  ...PRICE_FIELDS, ...PACK_FIELDS,
];

const MAX_PHOTOS = 5;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

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

  const tier = await getCompanyTier(supabase, companyId);
  const v = {
    productName: text(formData, "productName"),
    hsCode: normalizeHsCode(text(formData, "hsCode")),
    descriptionFr: text(formData, "descriptionFr"),
    descriptionEn: text(formData, "descriptionEn"),
    descriptionAr: text(formData, "descriptionAr"),
    unit: text(formData, "unit"),
    packaging: text(formData, "packaging"),
    status: text(formData, "status"),
  };

  const errors: CatalogState["errors"] = {};
  if (v.productName.length < 2 || v.productName.length > 255) errors.productName = "errorProductName";
  if (!v.hsCode) errors.hsCode = "errorHsCode";
  for (const k of ["descriptionFr", "descriptionEn", "descriptionAr"] as const) if (v[k].length > 2000) errors[k] = "errorTooLong";
  if (!(UNITS as readonly string[]).includes(v.unit)) errors.unit = "errorChoose";
  if (v.packaging.length > 200) errors.packaging = "errorTooLong";
  // Liste de prix (selon le forfait) et conditionnement : regles communes avec l'import Excel.
  const today = new Date().toISOString().slice(0, 10);
  const priced = readPriceInput(
    Object.fromEntries(PRICE_FIELDS.map((k) => [k, text(formData, k)])) as Record<PriceField, string>,
    tier,
    today,
    v.status === "published",
  );
  // Conditionnement en 4 niveaux + conservation et gerbage : la logistique et la capacite conteneur
  // en sont deduites (meme calcul que l'import Excel).
  const packed = readPackagingInput((k) => text(formData, k));
  const extras = readLogisticsExtras((k) => text(formData, k));
  Object.assign(errors, priced.errors, packed.errors, extras.errors);
  if (!["draft", "published"].includes(v.status)) errors.status = "errorChoose";

  // Photos : retraits demandes (seulement parmi celles du produit), puis une nouvelle eventuelle.
  const current = productImages(existing);
  const toRemove = new Set(formData.getAll("removePhoto").map(String).filter((p) => current.some((i) => i.path === p)));
  let images: ProductImage[] = current.filter((i) => !toRemove.has(i.path));
  const photo = await readImage(formData.get("photo"), PHOTO_MAX_BYTES);
  if (photo && "error" in photo) errors.photo = photo.error === "size" ? "errorPhotoSize" : "errorPhotoType";
  else if (photo && images.length >= MAX_PHOTOS) errors.photo = "errorPhotoCount";
  // Publication : au moins une photo (conservee ou nouvelle).
  if (v.status === "published" && !errors.photo && images.length === 0 && !(photo && !("error" in photo))) errors.photo = "errorPhotoRequired";
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
  const fields = {
    ...packagingFields(packed.spec, extras.storage, extras.maxStack),
    product_name: v.productName,
    hs_code: v.hsCode,
    description_fr: v.descriptionFr || null,
    description_en: v.descriptionEn || null,
    description_ar: v.descriptionAr || null,
    ...priced.fields,
    unit: v.unit,
    packaging: v.packaging || null,
    status: v.status,
    images,
  } satisfies Database["public"]["Tables"]["products"]["Update"];

  const { error } = existing
    ? await supabase.from("products").update(fields).eq("id", existing.id)
    : await supabase.from("products").insert({ ...fields, company_id: companyId, source: "producer" });
  if (error) {
    const added = images.filter((i) => !current.some((c) => c.path === i.path)).map((i) => i.path);
    if (added.length) await supabase.storage.from("product-images").remove(added);
    // Reference fournisseur deja utilisee dans le catalogue.
    if (error.code === "23505") return fail({ errors: { sku: "errorSkuTaken" } });
    console.error("Catalog save failed:", error.code, error.message);
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
