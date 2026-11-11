// Secteurs d'activite d'apres la CITI Rev.4 de l'ONU (Classification internationale type, par industrie,
// de toutes les branches d'activite economique), sur laquelle s'appuie la nomenclature algerienne NAA.
// Code enregistre = lettre de la section + numero de la division (ex. "C10" = fabrication de produits
// alimentaires). Seules les sections utiles a l'export de produits sont retenues :
// A agriculture, sylviculture et peche ; B industries extractives ; C industrie manufacturiere ;
// G commerce de gros (negociants exportateurs). Libelles : espace de traduction "sectors".
// Partage navigateur et serveur. La contrainte companies_sector_check en base reprend la meme liste.

export const SECTOR_SECTIONS = {
  A: ["A01", "A02", "A03"],
  B: ["B05", "B06", "B07", "B08", "B09"],
  C: [
    "C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
    "C22", "C23", "C24", "C25", "C26", "C27", "C28", "C29", "C30", "C31", "C32", "C33",
  ],
  G: ["G46"],
} as const;

export type SectorSection = keyof typeof SECTOR_SECTIONS;
export const SECTIONS = Object.keys(SECTOR_SECTIONS) as SectorSection[];
export const SECTORS = Object.values(SECTOR_SECTIONS).flat();
export type Sector = (typeof SECTORS)[number];

export const isSector = (value: string): value is Sector => (SECTORS as readonly string[]).includes(value);
export const sectionOf = (code: string) => (isSector(code) ? (code[0] as SectorSection) : null);
