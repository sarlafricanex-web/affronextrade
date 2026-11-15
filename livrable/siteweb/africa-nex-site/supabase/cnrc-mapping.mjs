// Correspondance codes CNRC -> secteurs CITI de la plateforme, puis migration SQL de la table de reference.
import { readFileSync, writeFileSync } from "node:fs";
const DIR = "C:/Users/DELL/AppData/Local/Temp/claude/6d61328ebec290b3/a54a89ff-9579-4b73-a56c-c599d818b4cb/scratchpad";
const SITE = "C:/Users/DELL/Desktop/affronextrade/livrable/siteweb/africa-nex-site";
const entries = JSON.parse(readFileSync(`${DIR}/cnrc.json`, "utf8"));

// 1. Regle par groupe (4 premiers chiffres). null = hors perimetre de la plateforme.
const GROUP = {
  1011: "A01", 1012: "A01", 1021: null, 1022: null, 1023: null, 1031: "B07", 1032: "B08",
  1041: "C20", 1042: "C20", 1051: "C28", 1052: "C28", 1053: "C30", 1054: "C29", 1055: "C27", 1056: "C26", 1057: "C28",
  1061: "C24", 1062: "C24", 1063: "C24", 1071: "C10", 1072: "C10", 1073: "C10", 1074: "C10", 1075: "C11", 1076: "C10",
  1081: "C13", 1082: "C15", 1083: "C32", 1091: "C23", 1092: "kw", 1101: "C25", 1102: "C16", 1103: "C31",
  1111: null, 1112: "C32", 1113: "C32", 1120: "kw", 1131: "C20", 1141: null, 1151: "C23", 1152: "C23", 1161: "C22",
  2011: "C23", 2012: "C23", 2013: "C25", 2014: "C16", 2015: "C13", 2016: "C15", 2021: "B08", 2022: "C25",
  2023: "C25", 2024: "C10", 2025: "C14", 2026: "C16", 2027: "C25", 2028: "C32",
};
// 2. Affinage par mots-cles dans les groupes de production et d'artisanat (ordre = priorite).
const KEYWORDS = [
  [/p[eê]che|aquaculture|aquacole/i, "A03"],
  [/for[eê]t|sylvicult/i, "A02"],
  [/houille|charbon/i, null],
  [/pharmac|m[ée]dicament/i, "C21"],
  [/tabac|cigar/i, "C12"],
  [/boisson|jus |jus$|limonade|eau(x)? min[ée]rale|bi[eè]re|vin(s)?\b|vinification/i, "C11"],
  [/savon|d[ée]tergent|cosm[ée]ti|parfum|engrais|peinture|vernis|encre/i, "C20"],
  [/plastique|caoutchouc|pneu/i, "C22"],
  [/a[ée]ro|avion|h[ée]licopt|a[ée]rodyne|drone/i, "C30"],
  [/\barmes?\b/i, "C25"],
  [/t[ée]l[ée]communication/i, "C26"],
  [/papier|carton/i, "C17"],
  [/imprim|reliure|reprographie/i, "C18"],
  [/meuble|ameublement|mobilier/i, "C31"],
  [/bijou|orf[eè]vr|joaill/i, "C32"],
  [/v[eê]tement|confection|habillement|bonneterie|chemiserie|lingerie/i, "C14"],
  [/cuir|maroquin|chaussure|tannerie/i, "C15"],
  [/c[aâ]ble/i, "C27"],
  [/[ée]lectronique|t[ée]l[ée]vis|radio|informatique|ordinateur|t[ée]l[ée]phon/i, "C26"],
  [/navire|bateau|a[ée]ronef|ferroviaire|wagon|cycle|motocycle/i, "C30"],
  [/charpente m[ée]tallique|chaudronnerie|construction m[ée]tallique|serrurerie|quincaillerie|coutellerie|visserie|boulonnerie/i, "C25"],
  [/verre|vitre|c[ée]ramique|poterie|fa[iï]ence|marbre|pl[aâ]tre|ciment|brique|tuile|r[ée]fractaire|chaux|amiante/i, "C23"],
  [/menuiserie|scierie|sciage|bois/i, "C16"],
];
// Groupes BTP et recyclage seulement : fabrications reconnues en plus des mots-cles generaux.
const KEYWORDS_KW = [
  [/produits de la chimie/i, "C20"],
  [/fabrication d'[ée]quipements|fabrication de machines/i, "C28"],
];
const allowedSector = (code) => ["1", "2", "3", "7"].includes(code[0]);

function isicOf(e) {
  if (!allowedSector(e.code)) return null;
  if (e.code[0] === "3" || e.code[0] === "7") return "G46";
  const group = Number(e.code.slice(0, 4));
  let base = group in GROUP ? GROUP[group] : undefined;
  if (base === null) return null; // groupe hors perimetre (hydrocarbures, BTP, eau, dechets...)
  for (const [re, div] of KEYWORDS) if (re.test(e.fr)) return div;
  // Groupes BTP et recyclage : seulement les vraies fabrications reconnues par mot-cle.
  if (base === "kw") { for (const [re, div] of KEYWORDS_KW) if (re.test(e.fr)) return div; return null; }
  return base ?? null;
}

const rows = entries.map((e) => ({ ...e, sector: Number(e.code[0]), isic: isicOf(e) }));
const usable = rows.filter((r) => r.isic && r.status !== "Bloquée");
const byIsic = usable.reduce((a, r) => ((a[r.isic] = (a[r.isic] ?? 0) + 1), a), {});
console.log("Codes utilisables (production, artisanat, gros, export, non bloques, avec secteur) :", usable.length);
console.log("Par secteur CITI :", JSON.stringify(byIsic));
console.log("Production/artisanat sans secteur :", rows.filter((r) => ["1", "2"].includes(r.code[0]) && !r.isic).map((r) => `${r.code} ${r.fr.slice(0, 40)}`).slice(0, 60).join("\n  "));
writeFileSync(`${DIR}/cnrc-mapped.json`, JSON.stringify(rows));

// Migration : table de reference publique, remplie avec les 2 132 codes.
const q = (s) => (s === null || s === undefined || s === "" ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const STATUS = { "Libre": "free", "Réglementée": "regulated", "Bloquée": "blocked" };
const values = rows.map((r) => `(${q(r.code)}, ${q(r.fr)}, ${q(r.ar)}, ${r.sector}, ${q(STATUS[r.status])}, ${q(r.authority)}, ${q(r.isic)})`);
const sql = `-- Nomenclature des activites du registre du commerce (CNRC 2026, 2 132 codes).
-- Source : CNRC (sidjilcom.cnrc.dz), compilation UpGrowth (upgrowth.dz), licence CC BY 4.0 : attribution
-- obligatoire, affichee sur la plateforme. isic_division : secteur de la plateforme deduit du code
-- (null = activite hors perimetre : services, detail, importation, hydrocarbures, BTP...).
create table public.cnrc_activities (
  code char(6) primary key check (code ~ '^[1-7][0-9]{5}$'),
  label_fr text not null,
  label_ar text,
  cnrc_sector smallint not null check (cnrc_sector between 1 and 7),
  status text not null check (status in ('free', 'regulated', 'blocked')),
  authority text,
  isic_division text
);

alter table public.cnrc_activities enable row level security;
create policy cnrc_activities_read on public.cnrc_activities for select to anon, authenticated using (true);

insert into public.cnrc_activities (code, label_fr, label_ar, cnrc_sector, status, authority, isic_division) values
${values.join(",\n")};

-- Activite d'export de l'entreprise : le code CNRC du registre (principal /00 ou secondaire /01...)
-- avec lequel elle travaille sur la plateforme. Il impose le secteur ; la description reste libre.
alter table public.companies
  add column activity_code char(6) references public.cnrc_activities (code),
  add column activity_description text check (char_length(activity_description) <= 500);

grant select (activity_code, activity_description) on public.companies to anon, authenticated;

create or replace function public.companies_activity_sector()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v public.cnrc_activities;
begin
  if new.activity_code is null then
    return new;
  end if;
  select * into v from public.cnrc_activities where code = new.activity_code;
  if v.code is null or v.status = 'blocked' or v.cnrc_sector not in (1, 2, 3, 7) or v.isic_division is null then
    raise exception 'activity code not allowed for export' using errcode = '22023';
  end if;
  new.sector := v.isic_division;
  return new;
end
$$;

create trigger companies_activity_sector
  before insert or update of activity_code, sector on public.companies
  for each row execute function public.companies_activity_sector();
`;
writeFileSync(`${SITE}/supabase/migrations/20261115000025_cnrc_activities.sql`, sql);
console.log("Migration ecrite :", (sql.length / 1024).toFixed(0), "Ko");
