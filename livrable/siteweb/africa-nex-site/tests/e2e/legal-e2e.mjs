// Test de bout en bout des documents legaux (audit legal, corrections 1 et 2) : les quatre pages
// existent dans les trois langues, avec les mentions obligatoires ; liens du pied de page, de
// l'inscription et du formulaire de contact ; plus d'affirmations invérifiables sur l'accueil.
import "./_guard.mjs";

const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const page = async (path) => { const r = await fetch(BASE + path); return { status: r.status, html: await r.text() }; };
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

try {
  const DOCS = ["legal", "privacy", "terms", "sales"];
  for (const locale of ["fr", "en", "ar"]) {
    const res = await Promise.all(DOCS.map((d) => page(`/${locale}/${d}`)));
    report(`${locale} : les 4 documents s'affichent`, res.every((r) => r.status === 200 && r.html.includes(`data-legal-doc="`)), res.map((r) => r.status).join(","));
    report(`${locale} : onglets entre les 4 documents`, res.every((r) => DOCS.every((d) => r.html.includes(`href="/${locale}/${d}"`))));
  }

  const legal = text((await page("/fr/legal")).html);
  report("Mentions legales : capital, RC, NIF, directeur de la publication, hebergeurs", ["3 000 000 DA", "19/00-0096919 B 26", "002619009691970", "Directeur de la publication", "Adlene ZEMOULI", "Vercel Inc.", "Supabase Inc."].every((s) => legal.includes(s)));
  const privacy = text((await page("/fr/privacy")).html);
  report("Confidentialite : bases legales, sous-traitants, durees, droits, autorites, cookies", ["Intérêt légitime", "Resend", "Vercel", "13 mois", "10 ans", "portabilité", "ANPDP", "CNIL", "NEXT_LOCALE", "sb-"].every((s) => privacy.toLowerCase().includes(s.toLowerCase())));
  const terms = text((await page("/fr/terms")).html);
  report("CGU : professionnels majeurs, anonymat, contournement, avis, droit algerien", ["majeures", "anonymat", "contourner", "ne vérifie pas qu'une transaction", "droit algérien"].every((s) => terms.includes(s)));
  const sales = text((await page("/fr/sales")).html);
  report("CGV : HT, virement, annuel -10 % non remboursable, essai gratuit, retour en gratuit, retractation, plus d'offre fondateur", ["hors taxes", "virement", "non remboursable", "10 %", "Essai gratuit", "formule gratuite", "rétractation"].every((s) => sales.includes(s)) && !sales.includes("fondateur"));
  const arPrivacy = (await page("/ar/privacy")).html;
  report("Arabe : page en RTL et traduite", arPrivacy.includes('dir="rtl"') && arPrivacy.includes("سياسة الخصوصية"));

  const home = (await page("/fr")).html;
  report("Accueil : liens vers les 4 documents en pied de page", DOCS.every((d) => home.includes(`href="/fr/${d}"`)));
  const homeText = text(home);
  report("Accueil : plus de 80+ producteurs, 500+ transactions, logos partenaires, CAGEX", !/80\+|500\+|Ils nous font confiance|Assuré par la CAGEX|paiements protégés|logos\/bna/i.test(home + homeText));
  const reg = (await page("/fr/register")).html;
  report("Inscription : la case renvoie aux CGU et a la politique", reg.includes('href="/fr/terms"') && reg.includes('href="/fr/privacy"'));
  const contact = (await page("/fr/contact")).html;
  report("Contact : la case renvoie a la politique de confidentialite", contact.includes('href="/fr/privacy"'));
  const pricing = text((await page("/fr/pricing")).html);
  report("Tarifs : plus de 'Le plus choisi', prix HT", !pricing.includes("Le plus choisi") && pricing.includes("HT par mois"));
} catch (e) {
  report("Execution du test", false, e.message);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
