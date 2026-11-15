// Nomenclature des activites du registre du commerce (CNRC 2026), table cnrc_activities.
// Source : CNRC, compilation UpGrowth (upgrowth.dz), licence CC BY 4.0 (attribution affichee).
// Seules les activites de production, d'artisanat, de gros et d'exportation, non bloquees et
// rattachees a un secteur de la plateforme, sont acceptees comme activite d'export.

export type CnrcActivity = {
  code: string;
  label_fr: string;
  label_ar: string | null;
  cnrc_sector: number;
  status: "free" | "regulated" | "blocked";
  authority: string | null;
  isic_division: string | null;
};

export const EXPORT_CNRC_SECTORS = [1, 2, 3, 7];

// Raison du refus d'un code, ou null s'il est accepte.
export function cnrcRefusal(a: Pick<CnrcActivity, "status" | "cnrc_sector" | "isic_division"> | null): "errorActivityUnknown" | "errorActivityBlocked" | "errorActivityOutOfScope" | null {
  if (!a) return "errorActivityUnknown";
  if (a.status === "blocked") return "errorActivityBlocked";
  if (!EXPORT_CNRC_SECTORS.includes(a.cnrc_sector) || !a.isic_division) return "errorActivityOutOfScope";
  return null;
}

export const CNRC_COLUMNS = "code, label_fr, label_ar, cnrc_sector, status, authority, isic_division";
