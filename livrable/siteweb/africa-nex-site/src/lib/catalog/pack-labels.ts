import "server-only";
import { getTranslations } from "next-intl/server";
import { PACK_LABELS, PACK_PROTECTIONS, PACK_TYPES, PACK_WEDGING, TIER_BASES } from "@/lib/catalog/price-list";
import { STORAGE_CONDITIONS } from "@/lib/logistics/container";

// Libelles bilingues "francais / anglais" des listes de conditionnement du fichier Excel.
// L'import reconnait le libelle complet, chacune des deux langues ou le code.
export async function packLabelMaps() {
  const [fr, en] = await Promise.all([getTranslations({ locale: "fr", namespace: "catalog" }), getTranslations({ locale: "en", namespace: "catalog" })]);
  const map = (prefix: string, codes: readonly string[]) =>
    Object.fromEntries(codes.map((code) => [code, `${fr(`${prefix}_${code}`)} / ${en(`${prefix}_${code}`)}`]));
  return {
    packType: map("packType", PACK_TYPES),
    packLabel: map("packLabel", PACK_LABELS),
    packWedging: map("packWedging", PACK_WEDGING),
    packProtection: map("packProtection", PACK_PROTECTIONS),
    storage: map("storageName", STORAGE_CONDITIONS),
    tierBasis: map("tierBasis", TIER_BASES),
  };
}
