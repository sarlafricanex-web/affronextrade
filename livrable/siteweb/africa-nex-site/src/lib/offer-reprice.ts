// Lot 6e : prix d'une offre calculee apres saisie par AFRICA NEX (commission, marge negociee, fret).
// Fonction pure partagee par l'apercu de l'ecran et l'action serveur (le serveur recalcule toujours).
// Regles d'Adlene :
//   - intermediation : commission de la grille, modifiable offre par offre, sur le cout fournisseur ;
//   - export par AFRICA NEX : marge negociee au cas par cas, en % du cout ou en montant (reparti sur
//     les lignes au prorata du cout), en plus de la marge de change ; secrete, jamais affichee ;
//   - le fret est une ligne separee de l'offre : il s'ajoute au total, pas aux prix unitaires.
import { round2 } from "./offer-pricing";

// Centime superieur, sans artefact de virgule flottante (10,3 reste 10,3).
const ceil2 = (n: number) => Math.ceil(round2(n * 100 * 1e6) / 1e6) / 100;

export type RepriceLine = {
  quantity: number;
  base: number; // cout fournisseur dans la devise de l'offre
  insuranceRate: number;
  fxMarginRate: number;
  maxDiscountRate?: number | null;
};

export type MarginInput = { kind: "rate" | "amount"; value: number } | null;

export type RepriceInput = {
  mode: "self" | "africanex";
  lines: RepriceLine[];
  commissionRate: number; // intermediation seulement
  margin: MarginInput; // export AFRICA NEX seulement ; null = pas encore saisie
  freight: number | null; // null = pas encore saisi (ou fret a la charge du fournisseur)
};

export type RepricedLine = {
  unitPrice: number;
  total: number;
  insurance: number;
  commission: number;
  fxMargin: number;
  margin: number;
};

export type RepriceResult = {
  lines: RepricedLine[];
  base: number;
  insurance: number;
  commission: number;
  fxMargin: number;
  margin: number;
  linesTotal: number;
  freight: number;
  total: number;
  maxDiscountAmount: number;
};

export function repriceOffer({ mode, lines, commissionRate, margin, freight }: RepriceInput): RepriceResult {
  const sumBase = lines.reduce((s, l) => s + l.base, 0);
  const out = lines.map((l): RepricedLine => {
    const insurance = round2((l.base * l.insuranceRate) / 100);
    if (mode === "self") {
      const unitPrice = round2((l.base * (1 + (l.insuranceRate + commissionRate) / 100)) / l.quantity);
      const total = round2(unitPrice * l.quantity);
      // L'ecart d'arrondi va dans la commission, comme au calcul automatique.
      return { unitPrice, total, insurance, commission: round2(total - l.base - insurance), fxMargin: 0, margin: 0 };
    }
    const lineMargin = !margin ? 0 : margin.kind === "rate" ? (l.base * margin.value) / 100 : sumBase > 0 ? (margin.value * l.base) / sumBase : 0;
    const exact = (l.base * (1 + (l.insuranceRate + l.fxMarginRate) / 100) + lineMargin) / l.quantity;
    // Avec une marge negociee, le prix est arrondi au centime superieur : la marge encaissee n'est
    // jamais inferieure a celle saisie (l'arrondi x quantite peut peser plusieurs unites de devise).
    const unitPrice = lineMargin > 0 ? ceil2(exact) : round2(exact);
    const total = round2(unitPrice * l.quantity);
    const earning = round2(total - l.base - insurance);
    // Sans marge negociee, l'ecart d'arrondi reste dans la marge de change (comme au calcul automatique).
    const negotiated = lineMargin > 0 ? Math.max(0, round2(earning - round2((l.base * l.fxMarginRate) / 100))) : 0;
    return { unitPrice, total, insurance, commission: 0, fxMargin: round2(earning - negotiated), margin: negotiated };
  });
  const sum = (f: (l: RepricedLine) => number) => round2(out.reduce((s, l) => s + f(l), 0));
  const linesTotal = sum((l) => l.total);
  const f = freight !== null && freight > 0 ? round2(freight) : 0;
  return {
    lines: out,
    base: round2(sumBase),
    insurance: sum((l) => l.insurance),
    commission: sum((l) => l.commission),
    fxMargin: sum((l) => l.fxMargin),
    margin: sum((l) => l.margin),
    linesTotal,
    freight: f,
    total: round2(linesTotal + f),
    maxDiscountAmount: round2(lines.reduce((s, l) => s + (l.maxDiscountRate ? (l.base * l.maxDiscountRate) / 100 : 0), 0)),
  };
}
