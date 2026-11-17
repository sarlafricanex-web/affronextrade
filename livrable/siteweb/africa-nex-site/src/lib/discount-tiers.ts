// Marge de negociation du fournisseur : remise maximale par paliers (3 au plus), seuil en
// quantite ou en montant. Confidentielle, jamais appliquee d'office. Sans dependance, pour
// servir a la liste de prix comme au calcul automatique de l'offre.
export type DiscountTier = { basis: "qty" | "amount"; threshold: number; discount: number };

// Palier atteint par une commande (quantite et montant) : la plus forte remise applicable.
export function reachedTier(tiers: DiscountTier[] | null | undefined, quantity: number, amount: number): DiscountTier | null {
  let best: DiscountTier | null = null;
  for (const t of tiers ?? []) {
    const ok = t.basis === "qty" ? quantity >= t.threshold : amount >= t.threshold;
    if (ok && (!best || t.discount > best.discount)) best = t;
  }
  return best;
}
