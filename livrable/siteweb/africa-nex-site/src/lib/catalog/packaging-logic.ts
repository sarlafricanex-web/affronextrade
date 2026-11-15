// Conditionnement en 4 niveaux -> donnees logistiques et capacite conteneur. Meme calcul pour
// l'editeur en ligne et l'import Excel : le resultat est identique quel que soit le circuit.
// Dimensions en millimetres (standard export, comme l'annexe "brief conditionnement").
import { STORAGE_CONDITIONS, estimateContainer, type LogisticsInput, type StorageCondition } from "@/lib/logistics/container";
import type { PackagingSpec, PackLevel } from "@/lib/catalog/price-list";

const hasDims = (l: PackLevel | undefined) => Boolean(l && l.length_mm && l.width_mm && l.height_mm);
const volume = (l: PackLevel) => (l.length_mm! * l.width_mm! * l.height_mm!) / 1e9; // m3

// Unite de manutention pour le calcul conteneur : le colis (niveau 3) s'il est decrit, sinon le carton (niveau 2).
function handlingLevel(spec: PackagingSpec | null) {
  const l3 = spec?.levels?.[2], l2 = spec?.levels?.[1];
  if (l3 && hasDims(l3) && l3.qty) return l3;
  if (l2 && hasDims(l2) && l2.qty) return l2;
  return null;
}

export function logisticsFromSpec(spec: PackagingSpec | null, storage: string | null, maxStack: number | null): LogisticsInput {
  const carton = handlingLevel(spec);
  const pallet = spec?.levels?.[3];
  const cartonsPerPallet = carton?.qty && pallet?.qty && pallet.qty >= carton.qty ? Math.floor(pallet.qty / carton.qty) : null;
  return {
    unitsPerCarton: carton?.qty ?? null,
    lengthCm: carton?.length_mm ? carton.length_mm / 10 : null,
    widthCm: carton?.width_mm ? carton.width_mm / 10 : null,
    heightCm: carton?.height_mm ? carton.height_mm / 10 : null,
    grossWeightKg: carton?.weight_kg ?? null,
    maxStackLayers: maxStack,
    storage: storage && (STORAGE_CONDITIONS as readonly string[]).includes(storage) ? (storage as StorageCondition) : null,
    palletized: Boolean(cartonsPerPallet && cartonsPerPallet >= 1 && cartonsPerPallet <= 500),
    cartonsPerPallet: cartonsPerPallet && cartonsPerPallet <= 500 ? cartonsPerPallet : null,
  };
}

// Colonnes logistiques du produit, deduites de la fiche (jamais saisies a part).
export function packagingFields(spec: PackagingSpec | null, storage: string | null, maxStack: number | null) {
  const l = logisticsFromSpec(spec, storage, maxStack);
  // Capacite principale : palettisee si une palette est decrite, sinon au sol. Capacite au sol toujours calculee.
  const e20 = estimateContainer(l, "20");
  const e40 = estimateContainer(l, "40");
  const f20 = estimateContainer(l, "20", "floor");
  const f40 = estimateContainer(l, "40", "floor");
  const hasCarton = l.lengthCm && l.widthCm && l.heightCm && l.grossWeightKg;
  return {
    packaging_spec: spec,
    units_per_carton: l.unitsPerCarton,
    carton_length_cm: l.lengthCm,
    carton_width_cm: l.widthCm,
    carton_height_cm: l.heightCm,
    carton_gross_weight_kg: l.grossWeightKg,
    max_stack_layers: l.maxStackLayers,
    storage_condition: l.storage,
    palletized: l.palletized,
    cartons_per_pallet: l.palletized ? l.cartonsPerPallet : null,
    dimensions_cm: hasCarton ? { length: l.lengthCm, width: l.widthCm, height: l.heightCm, weight_kg: l.grossWeightKg } : null,
    container_capacity_20ft: e20?.units ?? null,
    container_capacity_40ft: e40?.units ?? null,
    container_floor_20ft: f20?.units ?? null,
    container_floor_40ft: f40?.units ?? null,
  };
}

// Conservation et gerbage : saisis a cote des 4 niveaux (editeur et feuille Excel).
export function readLogisticsExtras(get: (k: "storage" | "maxStack") => string) {
  const errors: Partial<Record<"storage" | "maxStack", string>> = {};
  const storage = get("storage").trim();
  if (storage && !(STORAGE_CONDITIONS as readonly string[]).includes(storage)) errors.storage = "errorChoose";
  const raw = get("maxStack").replace(/\s/g, "");
  let maxStack: number | null = null;
  if (raw) {
    maxStack = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
    if (Number.isNaN(maxStack) || maxStack < 1 || maxStack > 50) { errors.maxStack = "errorStack"; maxStack = null; }
  }
  return { storage: storage && !errors.storage ? storage : null, maxStack, errors };
}

// Controles de coherence : de simples avertissements (n'empechent pas d'enregistrer).
export type PackWarning = { code: string; level?: number; value?: number };
export function packagingWarnings(spec: PackagingSpec | null): PackWarning[] {
  const out: PackWarning[] = [];
  const levels = spec?.levels ?? [];
  levels.forEach((l, i) => {
    const n = i + 1;
    if (!l) return;
    // Un cote de moins de 20 mm pour un carton, un colis ou une palette : saisi en cm ?
    const dims = [l.length_mm, l.width_mm, l.height_mm].filter((d): d is number => typeof d === "number");
    if (n >= 2 && dims.some((d) => d < 20)) out.push({ code: "warnDimsTiny", level: n });
    if (hasDims(l) && l.weight_kg && l.weight_kg / volume(l) > 3000) out.push({ code: "warnDensity", level: n });
    // Niveau precedent decrit : quantites, volume et poids doivent etre coherents.
    const prev = levels.slice(0, i).reverse().find((p) => p && p.qty);
    if (prev?.qty && l.qty) {
      if (l.qty < prev.qty) out.push({ code: "warnQtyOrder", level: n });
      else if (l.qty % prev.qty !== 0) out.push({ code: "warnQtyNotMultiple", level: n });
      else {
        const ratio = l.qty / prev.qty;
        if (hasDims(l) && hasDims(prev) && volume(prev) * ratio > volume(l) * 1.02) out.push({ code: "warnContentsDontFit", level: n });
        if (l.weight_kg && prev.weight_kg && prev.weight_kg * ratio > l.weight_kg * 1.02) out.push({ code: "warnLighterThanContents", level: n });
      }
    }
  });
  const carton = levels[1];
  if (carton?.weight_kg && carton.weight_kg > 30) out.push({ code: "warnCartonHeavy", level: 2, value: carton.weight_kg });
  const pallet = levels[3];
  if (pallet) {
    const [a, b] = [pallet.length_mm ?? 0, pallet.width_mm ?? 0].sort((x, y) => y - x);
    if (a > 1300 || b > 1100) out.push({ code: "warnPalletFootprint", level: 4 });
    if ((pallet.height_mm ?? 0) > 2400) out.push({ code: "warnPalletHeight", level: 4 });
    if ((pallet.weight_kg ?? 0) > 1500) out.push({ code: "warnPalletWeight", level: 4 });
  }
  return out;
}
