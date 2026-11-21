"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

async function adminContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  return { locale, supabase: user.supabase, userId: user.userId };
}

// Taux saisi : "150", "150,25" ou "150.2500" ; entre 1 et 100 000 DZD, 4 decimales au plus.
function parseRate(raw: string) {
  const v = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,4})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 100000 ? n : null;
}

export type RatesState = { errors: Partial<Record<"EUR" | "USD", string>>; values?: Record<string, string>; attempt?: number };

// Taux de reference : 1 EUR = x DZD, 1 USD = y DZD. Chaque offre gardera le taux utilise.
export async function saveFxRates(_prev: RatesState, formData: FormData): Promise<RatesState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const values = { EUR: text(formData, "EUR"), USD: text(formData, "USD") };
  const errors: RatesState["errors"] = {};
  const rows = (["EUR", "USD"] as const).flatMap((currency) => {
    if (!values[currency]) return [];
    const rate = parseRate(values[currency]);
    if (rate === null) { errors[currency] = "settingsErrorRate"; return []; }
    return [{ currency, dzd_per_unit: rate, updated_at: new Date().toISOString(), updated_by: userId }];
  });
  if (Object.keys(errors).length) return { errors, values, attempt: Date.now() };
  if (rows.length) {
    const { error } = await supabase.from("fx_rates").upsert(rows);
    if (error) { console.error("FX rates save failed:", error.message); return { errors: { EUR: "settingsErrorSave" }, values, attempt: Date.now() }; }
    await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "settings.fx_rates", entity: "fx_rates", payload: Object.fromEntries(rows.map((r) => [r.currency, r.dzd_per_unit])) });
  }
  redirect(`/${locale}/admin/settings?saved=rates`);
}

// Mode d'affaire des fournisseurs (fixe par AFRICA NEX seul) : "self" = le fournisseur exporte,
// "africanex" = AFRICA NEX exporte, seulement avec l'accord du fournisseur ; vide = a definir.
export async function saveSupplierModes(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const changes: { company_id: string; export_mode: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^mode_([0-9a-f-]{36})$/i.exec(key);
    if (!m || !UUID.test(m[1])) continue;
    const mode = String(value);
    if (String(formData.get(`was_${m[1]}`) ?? "") === mode) continue;
    if (mode === "" || mode === "self" || mode === "africanex") changes.push({ company_id: m[1], export_mode: mode || null });
  }
  // Export par AFRICA NEX sans l'accord du fournisseur : refuse (la base le refuse aussi).
  const wanted = changes.filter((c) => c.export_mode === "africanex").map((c) => c.company_id);
  const { data: consenting } = wanted.length
    ? await supabase.from("companies").select("id").in("id", wanted).eq("africanex_export_consent", true)
    : { data: [] };
  const allowed = new Set((consenting ?? []).map((c) => c.id));
  const refused = wanted.filter((id) => !allowed.has(id)).length;
  for (let i = changes.length - 1; i >= 0; i--) if (changes[i].export_mode === "africanex" && !allowed.has(changes[i].company_id)) changes.splice(i, 1);
  const set = changes.filter((c) => c.export_mode).map((c) => ({ company_id: c.company_id, export_mode: c.export_mode!, updated_at: new Date().toISOString(), updated_by: userId }));
  const unset = changes.filter((c) => !c.export_mode).map((c) => c.company_id);
  if (set.length) {
    const { error } = await supabase.from("supplier_settings").upsert(set);
    if (error) console.error("Supplier modes save failed:", error.message);
  }
  if (unset.length) await supabase.from("supplier_settings").delete().in("company_id", unset);
  if (changes.length) await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "settings.supplier_modes", entity: "supplier_settings", payload: { changes } });
  redirect(`/${locale}/admin/settings?saved=modes&count=${changes.length}${refused ? `&refused=${refused}` : ""}`);
}
