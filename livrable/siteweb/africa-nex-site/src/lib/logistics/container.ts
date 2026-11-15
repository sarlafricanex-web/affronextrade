// Estimation du nombre de cartons par conteneur (navigateur et serveur).
// Volontairement prudente : chargement en blocs reguliers (pas de mix d'orientations),
// cartons toujours poses a plat (hauteur fixe, rotation horizontale seulement), charge utile
// avec une marge de securite. AFRICA NEX confirme avant toute offre ; l'agent logistique
// (phase 3) affinera (chargements mixtes, palettes doubles).

export const STORAGE_CONDITIONS = ["ambient", "controlled", "chilled", "frozen"] as const;
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];

type Container = { lengthCm: number; widthCm: number; heightCm: number; payloadKg: number; euroPallets: number };

// Dimensions interieures usuelles et charge utile prudente (marge sous le maximum constructeur).
const DRY: Record<"20" | "40", Container> = {
  "20": { lengthCm: 589, widthCm: 235, heightCm: 239, payloadKg: 25000, euroPallets: 11 },
  "40": { lengthCm: 1203, widthCm: 235, heightCm: 239, payloadKg: 26500, euroPallets: 24 },
};
const REEFER: Record<"20" | "40", Container> = {
  "20": { lengthCm: 544, widthCm: 229, heightCm: 227, payloadKg: 24000, euroPallets: 10 },
  "40": { lengthCm: 1158, widthCm: 229, heightCm: 222, payloadKg: 26000, euroPallets: 22 },
};

export type LogisticsInput = {
  unitsPerCarton: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  grossWeightKg: number | null;
  maxStackLayers: number | null;
  storage: StorageCondition | null;
  palletized: boolean;
  cartonsPerPallet: number | null;
};

export type ContainerEstimate = {
  cartons: number;
  units: number;
  limitedBy: "volume" | "weight" | "pallets";
  reefer: boolean;
  mode: LoadMode;
  // Part du volume interieur occupee par les cartons : le reste est du vide (jeu, chutes de rangement).
  fillRate: number;
};

// "pallet" : palettes Europe sur une couche ; "floor" : cartons charges directement au sol, sans palette.
export type LoadMode = "pallet" | "floor";

// Jeu de chargement au sol : fermeture de la porte et calage (longueur), parois (largeur), plafond (hauteur).
const CLEARANCE = { lengthCm: 10, widthCm: 4, heightCm: 5 };

/** null si les donnees sont incompletes, si le carton ne rentre pas ou si le mode palette n'est pas renseigne. */
export function estimateContainer(input: LogisticsInput, size: "20" | "40", mode: LoadMode = input.palletized ? "pallet" : "floor"): ContainerEstimate | null {
  const { unitsPerCarton, lengthCm, widthCm, heightCm, grossWeightKg, maxStackLayers, storage, cartonsPerPallet } = input;
  if (!unitsPerCarton || !lengthCm || !widthCm || !heightCm || !grossWeightKg) return null;
  const reefer = storage !== null && storage !== "ambient";
  const box = (reefer ? REEFER : DRY)[size];

  let byVolume: number;
  let limitedBy: ContainerEstimate["limitedBy"];
  if (mode === "pallet") {
    if (!cartonsPerPallet) return null;
    // Une couche de palettes Europe (120 x 80), sans gerbage de palettes.
    byVolume = box.euroPallets * cartonsPerPallet;
    limitedBy = "pallets";
  } else {
    const L = box.lengthCm - CLEARANCE.lengthCm, W = box.widthCm - CLEARANCE.widthCm, H = box.heightCm - CLEARANCE.heightCm;
    const layers = Math.min(Math.floor(H / heightCm), maxStackLayers ?? Infinity);
    const floor = Math.max(
      Math.floor(L / lengthCm) * Math.floor(W / widthCm),
      Math.floor(L / widthCm) * Math.floor(W / lengthCm),
    );
    byVolume = floor * layers;
    limitedBy = "volume";
  }
  const byWeight = Math.floor(box.payloadKg / grossWeightKg);
  if (byWeight < byVolume) limitedBy = "weight";
  const cartons = Math.min(byVolume, byWeight);
  if (cartons <= 0) return null;
  const fillRate = Math.min(1, (cartons * lengthCm * widthCm * heightCm) / (box.lengthCm * box.widthCm * box.heightCm));
  return { cartons, units: Math.floor(cartons * unitsPerCarton), limitedBy, reefer, mode, fillRate };
}
