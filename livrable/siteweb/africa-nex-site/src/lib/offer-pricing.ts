// Calcul du prix d'une offre AFRICA NEX (partage entre le calculateur et le serveur).
// Regle d'Adlene (14 novembre 2026) : le prix fournisseur est la base de la commission
// et de l'assurance. Le fret s'ajoute en montant. Le serveur recalcule toujours.

// Commission selon le montant de l'affaire (prix fournisseur x quantite), memes seuils
// en EUR et en USD ; le palier atteint s'applique a tout le montant.
export const COMMISSION_TIERS = [
  { below: 5_000, rate: 10 },
  { below: 500_000, rate: 7, inclusive: true },
  { below: Infinity, rate: 5 },
] as const;

export const DEFAULT_INSURANCE_RATE = 1;

// Offres en dinars : conversion indicative pour trouver le palier (a mettre a jour).
export const DZD_PER_USD = 135;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function commissionRateFor(amount: number, currency: string): number {
  const ref = currency === "DZD" ? amount / DZD_PER_USD : amount;
  for (const tier of COMMISSION_TIERS) {
    if (ref < tier.below || ("inclusive" in tier && tier.inclusive && ref === tier.below)) return tier.rate;
  }
  return COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate;
}

export type OfferInput = { producerUnitPrice: number; quantity: number; commissionRate: number; insuranceRate: number; freight: number };

// Prix acheteur arrondi au centime ; le total affiche est prix unitaire x quantite,
// l'arrondi est absorbe par la commission.
export function priceOffer({ producerUnitPrice, quantity, commissionRate, insuranceRate, freight }: OfferInput) {
  const base = round2(producerUnitPrice * quantity);
  const insurance = round2((base * insuranceRate) / 100);
  const unitPrice = quantity > 0 ? round2((base * (1 + (commissionRate + insuranceRate) / 100) + freight) / quantity) : 0;
  const total = round2(unitPrice * quantity);
  const commission = round2(total - base - insurance - freight);
  return { base, commission, insurance, freight: round2(freight), total, unitPrice };
}
