// Offres des producteurs (decisions d'Adlene du 24 novembre 2026) : Passeport gratuit, Agent Export,
// Ambassadeur. Les prix, la remise annuelle et les quotas vivent en base (migration 38, lus par
// src/lib/data/plans.ts) ; ce fichier ne decrit que la presentation de chaque offre.
// Un point "soon" est un service pas encore construit : il s'affiche « Bientôt ».
export const PLANS = ["vitrine", "agent_export", "ambassadeur"] as const;
export type Plan = (typeof PLANS)[number];

export type PlanItem = { key: string; problem?: boolean; soon?: boolean };

// Cles de traduction de l'espace "pricing" : item_<key> (et problem_<key> quand problem = true).
export const PLAN_ITEMS: Record<Plan, PlanItem[]> = {
  vitrine: [
    { key: "profile" },
    { key: "products10" },
    { key: "requestsDelayed" },
    { key: "confidential" },
    { key: "noFee" },
  ],
  agent_export: [
    { key: "requestsFirst", problem: true },
    { key: "tenders", problem: true, soon: true },
    { key: "translation", problem: true, soon: true },
    { key: "answers", problem: true, soon: true },
    { key: "report", problem: true, soon: true },
    { key: "catalog1000", problem: true },
  ],
  ambassadeur: [
    { key: "videos", problem: true, soon: true },
    { key: "campaigns", problem: true, soon: true },
    { key: "customs", problem: true, soon: true },
    { key: "watch", problem: true, soon: true },
    { key: "featured", problem: true, soon: true },
    { key: "unlimited" },
  ],
};

// Lancement : seul le Passeport est ouvert ; l'Agent Export s'ouvre apres la phase d'essai.
export const PLAN_CTA: Record<Plan, { href: string; key: string }> = {
  vitrine: { href: "/register?role=producer", key: "cta_vitrine" },
  agent_export: { href: "/contact", key: "cta_agent_export" },
  ambassadeur: { href: "/contact", key: "cta_ambassadeur" },
};

export const isPlan = (x: unknown): x is Plan => typeof x === "string" && (PLANS as readonly string[]).includes(x);
