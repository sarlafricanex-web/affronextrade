import "server-only";
import ExcelJS from "exceljs";
import { UNITS } from "@/lib/onboarding/reference";
import { EXPORT_CURRENCIES, PACK_LABELS, PACK_LEVELS, PACK_PROTECTIONS, PACK_TYPES, PACK_WEDGING, PRICE_BASES, TIER_BASES, TIER_SLOTS, packagingValues, tierValues, type PackField, type PriceField } from "@/lib/catalog/price-list";
import { PACK_PICTOGRAMS } from "@/lib/catalog/pictograms";

// Liste de prix fournisseur en Excel : un modele unique (prix HT + incoterm), pre-rempli
// avec les references du catalogue, puis relu a l'import. La ligne 2 (masquee) porte la cle de
// chaque colonne : l'import retrouve les colonnes meme si le fournisseur en deplace.

export const PRICE_SHEET = "Liste de prix";
export const PACK_SHEET = "Conditionnement";
const LIST_SHEET = "Listes";
const KEY_ROW = 2;
const FIRST_ROW = 5;
const EXTRA_ROWS = 200; // lignes vides pour de nouvelles references

type Col = { key: string; fr: string; en: string; width: number; editable: boolean; list?: string; kind?: "date" | "number" };
type Labels = Record<"packType" | "packLabel" | "packWedging" | "packProtection" | "storage" | "tierBasis", Record<string, string>>;

export function priceColumns(): Col[] {
  const head: Col[] = [
    { key: "id", fr: "ID (ne pas modifier)", en: "ID (do not edit)", width: 6, editable: false },
    { key: "sku", fr: "Réf. fournisseur", en: "Supplier ref.", width: 16, editable: true },
    { key: "productName", fr: "Désignation", en: "Product", width: 34, editable: true },
    { key: "unit", fr: "Unité de vente", en: "Sales unit", width: 12, editable: true, list: "units" },
  ];
  const price: Col[] = [
    { key: "price", fr: "Prix unitaire HT", en: "Unit price", width: 14, editable: true, kind: "number" },
    { key: "currency", fr: "Devise", en: "Currency", width: 9, editable: true, list: "currencies" },
    { key: "priceBasis", fr: "Incoterm", en: "Incoterm", width: 10, editable: true, list: "bases" },
    { key: "pricePlace", fr: "Lieu de l'incoterm", en: "Incoterm place", width: 18, editable: true },
  ];
  // Deuxieme prix (confidentiel) puis marge de negociation par paliers (facultative).
  const dzd: Col[] = [{ key: "priceDzd", fr: "Prix en dinars HT (confidentiel)", en: "Price in DZD excl. tax (confidential)", width: 16, editable: true, kind: "number" }];
  const tiers: Col[] = TIER_SLOTS.flatMap((n) => [
    { key: `t${n}Basis`, fr: `Remise palier ${n} : seuil en`, en: `Discount tier ${n}: threshold in`, width: 16, editable: true, list: "tierBases" },
    { key: `t${n}Threshold`, fr: `Palier ${n} : à partir de`, en: `Tier ${n}: from`, width: 13, editable: true, kind: "number" },
    { key: `t${n}Discount`, fr: `Palier ${n} : remise max. (%)`, en: `Tier ${n}: max. discount (%)`, width: 13, editable: true, kind: "number" },
  ] as Col[]);
  const tail: Col[] = [
    ...dzd,
    { key: "priceValidUntil", fr: "Prix valable jusqu'au", en: "Price valid until", width: 15, editable: true, kind: "date" },
    { key: "stock", fr: "Stock disponible", en: "Stock available", width: 13, editable: true, kind: "number" },
    { key: "moq", fr: "MOQ (commande min.)", en: "MOQ", width: 12, editable: true, kind: "number" },
    { key: "leadDays", fr: "Délai de production (jours)", en: "Production lead time (days)", width: 14, editable: true, kind: "number" },
    { key: "originCountry", fr: "Pays d'origine (code)", en: "Made in (code)", width: 12, editable: true },
    { key: "crossRefs", fr: "Réf. croisées (séparées par ,)", en: "Cross references", width: 26, editable: true },
    ...tiers,
  ];
  return [...head, ...price, ...tail];
}

function packColumns(): Col[] {
  const cols: Col[] = [
    { key: "id", fr: "ID (ne pas modifier)", en: "ID (do not edit)", width: 6, editable: false },
    { key: "sku", fr: "Réf. fournisseur", en: "Supplier ref.", width: 16, editable: false },
    { key: "productName", fr: "Désignation", en: "Product", width: 30, editable: false },
  ];
  for (const n of PACK_LEVELS) {
    cols.push(
      { key: `pk${n}Qty`, fr: n === 1 ? "Qté d'unités" : `Qté d'unités niv. ${n}`, en: `Qty of UN1`, width: 10, editable: true, kind: "number" },
      { key: `pk${n}Type`, fr: "Conditionnement", en: "Packaging", width: 20, editable: true, list: "packType" },
      { key: `pk${n}Weight`, fr: "Poids total (kg)", en: "Total weight (kg)", width: 10, editable: true, kind: "number" },
      { key: `pk${n}Length`, fr: "Longueur (mm)", en: "Length (mm)", width: 10, editable: true, kind: "number" },
      { key: `pk${n}Width`, fr: "Largeur (mm)", en: "Width (mm)", width: 10, editable: true, kind: "number" },
      { key: `pk${n}Height`, fr: "Hauteur (mm)", en: "Height (mm)", width: 10, editable: true, kind: "number" },
    );
  }
  cols.push(
    { key: "pkLabel", fr: "Étiquette", en: "Label", width: 18, editable: true, list: "packLabel" },
    { key: "pkWedging", fr: "Calage", en: "Wedging", width: 10, editable: true, list: "packWedging" },
    { key: "pkProtection", fr: "Protection niv. 3 et 4", en: "Protection level 3-4", width: 20, editable: true, list: "packProtection" },
    { key: "storage", fr: "Conservation", en: "Storage", width: 18, editable: true, list: "storage" },
    { key: "maxStack", fr: "Gerbage max. (couches)", en: "Max. stacking (layers)", width: 12, editable: true, kind: "number" },
    { key: "pkNotes", fr: "Précisions", en: "Precisions", width: 30, editable: true },
  );
  return cols;
}

// Neutralise les formules : une cellule commencant par = + - @ s'executerait dans Excel.
const safe = (v: unknown) => {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
const EDIT = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8DC" } } as const;
const LOCKED = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECE3D4" } } as const;
const INK = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } } as const;
const THIN = { style: "thin", color: { argb: "FFD8CEBB" } } as const;

export type ExportProduct = {
  id: string; sku: string | null; product_name: string; unit: string | null; unit_price_ht: number | null;
  currency: string | null; price_basis: string | null; price_place: string | null; price_valid_until: string | null; stock_quantity: number | null;
  min_order_quantity: number | null; lead_time_days: number | null; origin_country: string | null; cross_refs: string[] | null; packaging_spec: unknown;
  storage_condition: string | null; max_stack_layers: number | null; price_dzd_ht: number | null; discount_tiers: unknown;
};

export async function buildPriceListWorkbook({ products, companyName, labels, generatedOn }: { products: ExportProduct[]; companyName: string; labels: Labels; generatedOn: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AFRICA NEX";

  // Listes des menus deroulants (feuille masquee : une liste en ligne est limitee a 255 caracteres).
  const lists = wb.addWorksheet(LIST_SHEET, { state: "veryHidden" });
  const listRanges: Record<string, string> = {};
  const listValues: Record<string, string[]> = {
    units: [...UNITS],
    currencies: [...EXPORT_CURRENCIES],
    tierBases: TIER_BASES.map((b) => labels.tierBasis[b]),
    bases: [...PRICE_BASES],
    packType: PACK_TYPES.map((c) => labels.packType[c]),
    packLabel: PACK_LABELS.map((c) => labels.packLabel[c]),
    packWedging: PACK_WEDGING.map((c) => labels.packWedging[c]),
    packProtection: PACK_PROTECTIONS.map((c) => labels.packProtection[c]),
    storage: Object.values(labels.storage),
  };
  Object.entries(listValues).forEach(([name, values], i) => {
    const col = lists.getColumn(i + 1);
    values.forEach((v, r) => { lists.getCell(r + 1, i + 1).value = v; });
    listRanges[name] = `${LIST_SHEET}!$${col.letter}$1:$${col.letter}$${values.length}`;
  });

  // Consignes
  const help = wb.addWorksheet("Consignes");
  help.getColumn(1).width = 110;
  const helpLines = [
    `Liste de prix AFRICA NEX · ${companyName} · généré le ${generatedOn}`,
    "",
    "1. Complétez les cellules jaunes de la feuille « Liste de prix », puis la feuille « Conditionnement ».",
    "2. Indiquez votre prix HT et son incoterm (les 11 d'Incoterms 2020 : EXW, FCA, FOB, CIF, DAP...), avec le lieu (ville, port). Le fret et l'assurance éventuels sont compris dans votre prix selon l'incoterm choisi.",
    "   Votre prix export est en EUR ou en USD (une seule devise). Indiquez aussi votre prix en dinars HT : il reste confidentiel, réservé à AFRICA NEX, et n'est jamais montré à l'acheteur.",
    "   Facultatif : votre marge de négociation, jusqu'à 3 paliers (seuil en quantité ou en montant, remise maximale en %). Confidentielle, jamais appliquée d'office. Laissée vide, votre grille par défaut s'applique.",
    "3. Indiquez la date jusqu'à laquelle chaque prix est valable : un prix expiré n'est plus proposé aux acheteurs.",
    "4. Tenez le stock disponible à jour : la date de mise à jour est enregistrée à l'import.",
    "5. Nouvelle référence : remplissez une ligne vide (désignation et unité au minimum). Elle sera créée en brouillon.",
    "6. Ne modifiez pas la colonne ID ni la ligne masquée sous le titre. Les photos s'ajoutent sur la plateforme, fiche par fiche.",
    "7. Enregistrez le fichier puis importez-le depuis votre catalogue : « Importer ma liste ». Vous verrez un aperçu avant de confirmer.",
    "",
    "Your AFRICA NEX price list: fill in the yellow cells, keep the ID column unchanged, then import the file from your catalogue.",
  ];
  helpLines.forEach((l, i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = l;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 13 };
  });

  const sheetFor = (name: string, cols: Col[], title: string) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });
    ws.getColumn(1).hidden = true;
    ws.mergeCells(1, 1, 1, cols.length);
    ws.getCell(1, 1).value = title;
    ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    ws.getCell(1, 1).fill = INK;
    ws.getRow(1).height = 24;
    cols.forEach((c, i) => {
      ws.getCell(KEY_ROW, i + 1).value = c.key;
      const fr = ws.getCell(3, i + 1);
      fr.value = c.fr;
      fr.font = { bold: true };
      fr.alignment = { wrapText: true, vertical: "bottom" };
      fr.fill = LOCKED;
      fr.border = { bottom: THIN };
      const en = ws.getCell(4, i + 1);
      en.value = c.en;
      en.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
      en.fill = LOCKED;
    });
    ws.getRow(KEY_ROW).hidden = true;
    ws.getRow(3).height = 34;
    return ws;
  };

  // Liste de prix
  const pcols = priceColumns();
  const ws = sheetFor(PRICE_SHEET, pcols, "Liste de prix · prix HT et incoterm");
  const total = products.length + EXTRA_ROWS;
  for (let r = 0; r < total; r++) {
    const p = products[r];
    const row = FIRST_ROW + r;
    const values: Record<string, unknown> = p
      ? {
          id: p.id, sku: p.sku ?? "", productName: p.product_name, unit: p.unit ?? "",
          price: p.unit_price_ht,
          // Devise export : EUR ou USD seulement (un ancien prix en DZD passe dans la colonne dinars).
          currency: p.currency === "EUR" || p.currency === "USD" ? p.currency : "", priceBasis: p.price_basis ?? "FOB", pricePlace: p.price_place ?? "",
          priceDzd: p.price_dzd_ht,
          ...Object.fromEntries(Object.entries(tierValues(p.discount_tiers)).map(([k, val]) => [k, k.endsWith("Basis") ? (labels.tierBasis[val] ?? "") : val === "" ? null : Number(val)])),
          priceValidUntil: p.price_valid_until ? new Date(`${p.price_valid_until}T00:00:00Z`) : null,
          stock: p.stock_quantity, moq: p.min_order_quantity, leadDays: p.lead_time_days, originCountry: p.origin_country ?? "DZ",
          crossRefs: (p.cross_refs ?? []).join(", "),
        }
      : {};
    pcols.forEach((c, i) => {
      const cell = ws.getCell(row, i + 1);
      const v = values[c.key];
      if (v !== null && v !== undefined && v !== "") {
        cell.value = c.kind === "number" ? Number(v) : v instanceof Date ? v : safe(v);
      }
      if (c.kind === "date") cell.numFmt = "dd/mm/yyyy";
      if (c.kind === "number") cell.numFmt = "#,##0.00";
      cell.fill = c.editable ? EDIT : LOCKED;
      cell.border = { bottom: THIN, right: THIN };
      if (c.list) cell.dataValidation = { type: "list", allowBlank: true, formulae: [listRanges[c.list]], showErrorMessage: true, errorTitle: "AFRICA NEX", error: "Choisissez une valeur de la liste." };
      if (c.kind === "date") cell.dataValidation = { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(Date.UTC(2020, 0, 1))], showErrorMessage: true, error: "Date invalide (jj/mm/aaaa)." };
    });
  }

  // Conditionnement (meme fiche pour tous les forfaits), pictogrammes des 4 niveaux en tete.
  const kcols = packColumns();
  const pk = sheetFor(PACK_SHEET, kcols, "Conditionnement · 4 niveaux (unité, carton, colis, palette)");
  pk.getRow(1).height = 64;
  PACK_LEVELS.forEach((n, i) => {
    const first = 4 + i * 6; // colonne de la quantite du niveau n
    const image = wb.addImage({ base64: `data:image/png;base64,${PACK_PICTOGRAMS[i]}`, extension: "png" });
    pk.addImage(image, { tl: { col: first - 1 + 0.1, row: 0.1 }, ext: { width: 160, height: 77 } });
  });
  // Le titre fusionne masquerait les pictogrammes : il ne couvre que les 3 premieres colonnes.
  pk.unMergeCells(1, 1, 1, kcols.length);
  pk.mergeCells(1, 1, 1, 3);
  for (let r = 0; r < total; r++) {
    const p = products[r];
    const row = FIRST_ROW + r;
    const pv = p ? packagingValues(p.packaging_spec) : null;
    const decode = (k: PackField, v: string) => {
      if (k === "pkLabel") return labels.packLabel[v] ?? v;
      if (k === "pkWedging") return labels.packWedging[v] ?? v;
      if (k === "pkProtection") return labels.packProtection[v] ?? v;
      if (/^pk\dType$/.test(k)) return labels.packType[v] ?? v;
      return v;
    };
    kcols.forEach((c, i) => {
      const cell = pk.getCell(row, i + 1);
      let v: unknown = null;
      if (p) {
        if (c.key === "id") v = p.id;
        else if (c.key === "sku") v = p.sku ?? "";
        else if (c.key === "productName") v = p.product_name;
        else if (c.key === "storage") v = p.storage_condition ? (labels.storage[p.storage_condition] ?? null) : null;
        else if (c.key === "maxStack") v = p.max_stack_layers;
        else {
          const raw = pv![c.key as PackField];
          v = raw === "" ? null : c.kind === "number" ? Number(raw) : decode(c.key as PackField, raw);
        }
      }
      if (v !== null && v !== "") cell.value = typeof v === "number" ? v : safe(v);
      if (c.kind === "number") cell.numFmt = "#,##0.##";
      cell.fill = c.editable ? EDIT : LOCKED;
      cell.border = { bottom: THIN, right: THIN };
      if (c.list) cell.dataValidation = { type: "list", allowBlank: true, formulae: [listRanges[c.list]], showErrorMessage: true, errorTitle: "AFRICA NEX", error: "Choisissez une valeur de la liste." };
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --- Lecture du fichier rempli ---

export type SheetRow = { row: number; values: Record<string, string> };

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(Math.round(v * 1e6) / 1e6);
  if (typeof v === "boolean") return v ? "1" : "";
  if (typeof v === "object") {
    if ("result" in v) return cellText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  }
  return String(v).replace(/^'/, "").trim();
};

// Date saisie a la main (31/12/2026 ou 2026-12-31) ou numero de serie Excel : Excel enregistre
// parfois la date sous son numero (46356 = 30/11/2026) en perdant le format de la cellule.
const normalizeDate = (s: string) => {
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 30000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 864e5).toISOString().slice(0, 10);
  }
  return s;
};

export async function readPriceListWorkbook(buffer: ArrayBuffer, labels: Labels) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const reverse = (map: Record<string, string>) => {
    const out = new Map<string, string>();
    for (const [code, label] of Object.entries(map)) {
      out.set(label.toLowerCase(), code);
      out.set(code.toLowerCase(), code);
      for (const part of label.split(" / ")) out.set(part.trim().toLowerCase(), code);
    }
    return out;
  };
  const maps = { packType: reverse(labels.packType), packLabel: reverse(labels.packLabel), packWedging: reverse(labels.packWedging), packProtection: reverse(labels.packProtection), storage: reverse(labels.storage), tierBasis: reverse(labels.tierBasis) };
  const readSheet = (name: string) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return null;
    const keys = new Map<number, string>();
    ws.getRow(KEY_ROW).eachCell((cell, col) => { const k = cellText(cell.value); if (k) keys.set(col, k); });
    if (!keys.size) return null;
    const rows: SheetRow[] = [];
    ws.eachRow((r, n) => {
      if (n < FIRST_ROW) return;
      const values: Record<string, string> = {};
      keys.forEach((key, col) => { values[key] = cellText(r.getCell(col).value); });
      if (values.priceValidUntil) values.priceValidUntil = normalizeDate(values.priceValidUntil);
      for (const [k, m] of [["pkLabel", maps.packLabel], ["pkWedging", maps.packWedging], ["pkProtection", maps.packProtection], ["storage", maps.storage]] as const) {
        if (values[k]) values[k] = m.get(values[k].toLowerCase()) ?? values[k];
      }
      for (const n of PACK_LEVELS) { const k = `pk${n}Type`; if (values[k]) values[k] = maps.packType.get(values[k].toLowerCase()) ?? values[k]; }
      for (const n of TIER_SLOTS) { const k = `t${n}Basis`; if (values[k]) values[k] = maps.tierBasis.get(values[k].toLowerCase()) ?? values[k]; }
      // Ancien modele "construction du prix FCA" (avant le 21 novembre 2026) : cout produit +
      // emballage repris comme prix FCA, pour qu'un fichier deja telecharge reste importable.
      if (!values.price && values.productCost) {
        const num = (x?: string) => Number((x ?? "").replace(/s/g, "").replace(",", ".")) || 0;
        values.price = String(Math.round((num(values.productCost) + num(values.packagingCost)) * 100) / 100);
        values.priceBasis ||= "FCA";
      }
      delete values.productCost; delete values.packagingCost;
      if (Object.entries(values).some(([k, v]) => v && k !== "fca")) rows.push({ row: n, values });
    });
    return { rows, keys: new Set(keys.values()) };
  };
  return { prices: readSheet(PRICE_SHEET), packaging: readSheet(PACK_SHEET) };
}

export const PRICE_KEYS: PriceField[] = ["sku", "crossRefs", "price", "currency", "priceBasis", "pricePlace", "priceValidUntil", "stock", "moq", "leadDays", "originCountry"];
