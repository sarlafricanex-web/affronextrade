// Forfaits des producteurs (decision d'Adlene du 19 novembre 2026) : prix du cahier des charges,
// sans "success fee" (remplace par la commission AFRICA NEX ajoutee au prix acheteur, lot 5d) et
// sans les services qui n'existent pas encore. Aucun paiement en ligne en v1 : "Nous contacter".
// Les prix vivent dans le code, pas en base (plan de la plateforme).
export const PLANS = ["starter", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

// Zones de facturation : chaque zone a sa devise.
export const ZONES = [
  { key: "dz", currency: "DZD" },
  { key: "eu", currency: "EUR" },
  { key: "intl", currency: "USD" },
] as const;
export type Zone = (typeof ZONES)[number]["key"];

// Prix mensuel par forfait et par devise ; null = sur devis.
export const MONTHLY_PRICE: Record<Plan, Record<"DZD" | "EUR" | "USD", number | null>> = {
  starter: { DZD: 20_000, EUR: 290, USD: 350 },
  pro: { DZD: 50_000, EUR: 790, USD: 950 },
  enterprise: { DZD: 120_000, EUR: null, USD: null },
};

// Ce que chaque forfait inclut (cles de traduction de l'espace "pricing"). Uniquement des services
// qui existent ; la traduction automatique est annoncee "Bientot" (quotas a confirmer).
export const PLAN_FEATURES: Record<Plan, string[]> = {
  starter: ["featureProfile", "featureCatalog", "featureRequests", "featureMessages", "featureDocuments", "featureStarterPrice"],
  pro: ["featureAllStarter", "featureProPrice", "featureFreight", "featureDetailedExcel"],
  enterprise: ["featureAllPro", "featureDedicated"],
};

// Quotas de traduction FR vers EN et AR, par mois (proposition du plan, a confirmer par Adlene).
export const TRANSLATION_QUOTA: Record<Plan, number> = { starter: 30, pro: 150, enterprise: 1000 };

export const isPlan = (x: unknown): x is Plan => typeof x === "string" && (PLANS as readonly string[]).includes(x);
