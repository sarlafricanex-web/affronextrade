import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Grille des offres lue en base (migration 38) : prix, remise annuelle, quotas de produits, delai des
// comptes gratuits. Donnees publiques (page Tarifs), donc lues sans cookies et mises en cache.
export type PlanRow = { code: string; name: string; monthly: number; annual: number; products: number | null };
export type PlanGrid = { plans: PlanRow[]; annualDiscount: number; freeDelayHours: number; trialDays: number };

// Meme formule que public.compute_price : annuel paye d'avance = mensuel x 12 x (1 - remise).
export const annualPrice = (monthly: number, discount: number) => Math.round(monthly * 12 * (1 - discount));

export async function getPlanGrid(): Promise<PlanGrid> {
  "use cache";
  cacheTag("plans");
  cacheLife("hours");
  const db = createPublicClient();
  const [plans, settings, quotas] = await Promise.all([
    db.from("plans").select("code, name, monthly_price_dzd").eq("is_active", true).order("sort_order"),
    db.from("billing_settings").select("key, value"),
    db.from("plan_features").select("plan_code, limit_value").eq("feature_key", "products"),
  ]);
  if (plans.error) throw plans.error;
  if (settings.error) throw settings.error;
  if (quotas.error) throw quotas.error;
  const setting = (key: string, fallback: number) => Number(settings.data.find((s) => s.key === key)?.value ?? fallback);
  const annualDiscount = setting("annual_discount", 0);
  return {
    annualDiscount,
    freeDelayHours: setting("free_request_delay_hours", 48),
    trialDays: setting("trial_days", 60),
    plans: plans.data.map((p) => ({
      code: p.code,
      name: p.name,
      monthly: p.monthly_price_dzd,
      annual: annualPrice(p.monthly_price_dzd, annualDiscount),
      products: quotas.data.find((q) => q.plan_code === p.code)?.limit_value ?? null,
    })),
  };
}
