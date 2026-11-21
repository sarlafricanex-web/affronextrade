// Les 11 incoterms d'Incoterms 2020, acceptes partout (prix fournisseur, devis, demande, offre).
// Decision d'Adlene du 21 novembre 2026 : plus de prix construit en FCA, tous les incoterms.
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];

// Choix logistique de l'acheteur dans sa demande :
//   - il organise le transport : depart usine ou remise au transporteur / au port de depart ;
//   - livre par AFRICA NEX : le fret principal (et au-dela) est organise par AFRICA NEX.
export const BUYER_INCOTERMS = ["EXW", "FCA", "FAS", "FOB"] as const;
export const DELIVERED_INCOTERMS = ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export const LOGISTICS = ["buyer", "africanex"] as const;
export type Logistics = (typeof LOGISTICS)[number];

export const isIncoterm = (v: string | null | undefined): v is Incoterm => (INCOTERMS as readonly string[]).includes(v ?? "");
export const incotermsFor = (logistics: Logistics): readonly Incoterm[] => (logistics === "africanex" ? DELIVERED_INCOTERMS : BUYER_INCOTERMS);
