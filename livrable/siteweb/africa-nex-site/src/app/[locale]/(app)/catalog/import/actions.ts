"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getCompanyTier, getMyCompanyId, listProducts } from "@/lib/data/company";
import { UNITS } from "@/lib/onboarding/reference";
import { PRICE_FIELDS, readPackagingInput, readPriceInput, todayIso, type PackField, type PriceField } from "@/lib/catalog/price-list";
import { readPriceListWorkbook } from "@/lib/catalog/price-list-excel";
import { packLabelMaps } from "@/lib/catalog/pack-labels";
import { packagingFields, packagingWarnings, readLogisticsExtras, type PackWarning } from "@/lib/catalog/packaging-logic";
import type { Database } from "@/lib/supabase/database.types";

type Update = Database["public"]["Tables"]["products"]["Update"];
export type ImportIssue = { row: number; sheet: "prices" | "packaging"; ref: string; fields: { field: string; error: string }[] };
export type ImportChange = { row: number; ref: string; kind: "update" | "create"; fields: string[] };
// Incoherences de conditionnement : signalees, sans bloquer l'import.
export type ImportWarning = { row: number; ref: string; warnings: PackWarning[] };
export type ImportState = {
  formError?: string;
  summary?: { updates: number; creates: number; unchanged: number; issues: ImportIssue[]; warnings: ImportWarning[]; changes: ImportChange[]; fileName: string };
  attempt?: number;
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 3000;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Valeurs comparables pour savoir si une ligne change vraiment quelque chose.
const norm = (v: unknown) => (v === null || v === undefined || v === "" ? "" : Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v)) ? String(Number(v)) : String(v));

// Import de la liste de prix remplie : "preview" montre ce qui va changer, "apply" l'enregistre.
// Seules les lignes valides sont appliquees ; les autres sont signalees ligne par ligne.
export async function importPriceList(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const supabase = user.supabase;
  const fail = (formError: string): ImportState => ({ formError, attempt: Date.now() });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("importErrorNoFile");
  if (file.size > MAX_BYTES) return fail("importErrorSize");
  if (!/\.xlsx$/i.test(file.name)) return fail("importErrorFormat");

  const [labels, products, tier] = await Promise.all([packLabelMaps(), listProducts(supabase, companyId), getCompanyTier(supabase, companyId)]);
  let sheets: Awaited<ReturnType<typeof readPriceListWorkbook>>;
  try {
    sheets = await readPriceListWorkbook(await file.arrayBuffer(), labels);
  } catch {
    return fail("importErrorFormat");
  }
  if (!sheets.prices) return fail("importErrorFormat");
  if (sheets.prices.rows.length + (sheets.packaging?.rows.length ?? 0) > MAX_ROWS) return fail("importErrorTooMany");

  const byId = new Map(products.map((p) => [p.id, p]));
  const today = todayIso();
  const issues: ImportIssue[] = [];
  const changes: ImportChange[] = [];
  const updates = new Map<string, Update>();
  const creates: { row: number; sku: string | null; fields: Update & { product_name: string } }[] = [];
  let unchanged = 0;

  for (const { row, values } of sheets.prices.rows) {
    const existing = values.id ? byId.get(values.id) : undefined;
    const ref = values.sku || values.productName || `#${row}`;
    if (values.id && !existing) { issues.push({ row, sheet: "prices", ref, fields: [{ field: "id", error: "importErrorUnknown" }] }); continue; }
    const fieldErrors: ImportIssue["fields"] = [];
    const name = values.productName ?? "";
    if (!existing && (name.length < 2 || name.length > 255)) fieldErrors.push({ field: "productName", error: "errorProductName" });
    if (existing && name && (name.length < 2 || name.length > 255)) fieldErrors.push({ field: "productName", error: "errorProductName" });
    const unit = values.unit || existing?.unit || "";
    if (!(UNITS as readonly string[]).includes(unit)) fieldErrors.push({ field: "unit", error: "errorChoose" });
    const input = Object.fromEntries(PRICE_FIELDS.map((k) => [k, values[k] ?? ""])) as Record<PriceField, string>;
    const priced = readPriceInput(input, tier, today, existing?.status === "published");
    for (const [field, error] of Object.entries(priced.errors)) fieldErrors.push({ field, error: error! });
    if (fieldErrors.length) { issues.push({ row, sheet: "prices", ref, fields: fieldErrors }); continue; }

    const fields: Update = { ...priced.fields, unit, ...(name ? { product_name: name } : {}) };
    if (existing) {
      const changed = Object.entries(fields).filter(([k, v]) => k !== "stock_updated_at" && norm(v) !== norm((existing as unknown as Record<string, unknown>)[k])).map(([k]) => k);
      if (changed.length) { updates.set(existing.id, fields); changes.push({ row, ref, kind: "update", fields: changed }); }
      else unchanged++;
    } else {
      creates.push({ row, sku: priced.fields.sku, fields: { ...fields, product_name: name } });
      changes.push({ row, ref, kind: "create", fields: [] });
    }
  }

  // Conditionnement : par ID, ou par reference fournisseur pour une ligne creee dans le meme fichier.
  // Logistique et capacite conteneur deduites exactement comme dans l'editeur (packagingFields).
  const packFor = new Map<string, ReturnType<typeof packagingFields>>();
  const warnings: ImportWarning[] = [];
  for (const { row, values } of sheets.packaging?.rows ?? []) {
    const ref = values.sku || values.productName || `#${row}`;
    const existing = values.id ? byId.get(values.id) : undefined;
    const target = existing?.id ?? (values.sku ? `sku:${values.sku.toLowerCase()}` : null);
    if (!target || (values.id && !existing)) { issues.push({ row, sheet: "packaging", ref, fields: [{ field: "id", error: "importErrorUnknown" }] }); continue; }
    const packed = readPackagingInput((k: PackField) => values[k] ?? "");
    const extras = readLogisticsExtras((k) => values[k] ?? "");
    const errs = Object.entries({ ...packed.errors, ...extras.errors }).map(([field, error]) => ({ field, error: error! }));
    if (errs.length) { issues.push({ row, sheet: "packaging", ref, fields: errs }); continue; }
    const w = packagingWarnings(packed.spec);
    if (w.length) warnings.push({ row, ref, warnings: w });
    if (existing && norm(packed.spec) === norm(existing.packaging_spec) && norm(extras.storage) === norm(existing.storage_condition) && norm(extras.maxStack) === norm(existing.max_stack_layers)) continue;
    const logistics = packagingFields(packed.spec, extras.storage, extras.maxStack);
    packFor.set(target, logistics);
    if (existing) {
      updates.set(existing.id, { ...(updates.get(existing.id) ?? {}), ...logistics });
      const change = changes.find((c) => c.kind === "update" && c.ref === (existing.sku || existing.product_name));
      if (change) change.fields.push("packaging_spec");
      else { changes.push({ row, ref, kind: "update", fields: ["packaging_spec"] }); if (unchanged > 0) unchanged--; }
    }
  }
  for (const c of creates) {
    const logistics = c.sku ? packFor.get(`sku:${c.sku.toLowerCase()}`) : undefined;
    if (logistics) Object.assign(c.fields, logistics);
  }

  const summary = { updates: updates.size, creates: creates.length, unchanged, issues, warnings, changes: changes.slice(0, 200), fileName: file.name };
  if (text(formData, "intent") !== "apply") return { summary, attempt: Date.now() };
  if (!updates.size && !creates.length) return { summary, formError: "importNothing", attempt: Date.now() };

  // Application : creations en brouillon, puis mises a jour par paquets de 10.
  for (const c of creates) {
    const { error } = await supabase.from("products").insert({ ...c.fields, company_id: companyId, source: "producer", status: "draft" });
    if (error) {
      issues.push({ row: c.row, sheet: "prices", ref: c.sku ?? c.fields.product_name, fields: [{ field: error.code === "23505" ? "sku" : "id", error: error.code === "23505" ? "errorSkuTaken" : "importErrorSave" }] });
      summary.creates--;
    }
  }
  const entries = [...updates.entries()];
  for (let i = 0; i < entries.length; i += 10) {
    const results = await Promise.all(entries.slice(i, i + 10).map(([id, fields]) => supabase.from("products").update(fields).eq("id", id).eq("company_id", companyId)));
    results.forEach(({ error }, j) => {
      if (!error) return;
      const p = byId.get(entries[i + j][0])!;
      issues.push({ row: 0, sheet: "prices", ref: p.sku ?? p.product_name, fields: [{ field: error.code === "23505" ? "sku" : "id", error: error.code === "23505" ? "errorSkuTaken" : "importErrorSave" }] });
      summary.updates--;
    });
  }
  await supabase.from("audit_log").insert({ actor_profile_id: user.userId, action: "catalog.import", entity: "company", entity_id: companyId, payload: { updates: summary.updates, creates: summary.creates, issues: issues.length } });
  updateTag("producers");
  if (issues.length) return { summary: { ...summary, issues }, formError: "importPartial", attempt: Date.now() };
  redirect(`/${locale}/catalog?imported=${summary.updates + summary.creates}`);
}
