// Completion de la fiche producteur, calculee sur les vrais champs (pas de "score" invente).
// Partagee par "Mon entreprise" et le tableau de bord producteur.
export type CompletionInput = {
  company: {
    description_fr: string | null;
    description_en: string | null;
    description_ar: string | null;
    logo_url: string | null;
    website: string | null;
    private?: { tax_id: string | null; nis: string | null; tax_article: string | null; rc_number: string | null } | null;
  };
  productCount: number;
  registrationCount: number;
};

export function companyChecks({ company, productCount, registrationCount }: CompletionInput) {
  const checks = [
    { key: "checkIdentity", ok: Boolean(company.private?.tax_id && company.private?.nis && company.private?.tax_article && company.private?.rc_number) },
    { key: "checkDescriptionFr", ok: Boolean(company.description_fr) },
    { key: "checkDescriptionEn", ok: Boolean(company.description_en) },
    { key: "checkDescriptionAr", ok: Boolean(company.description_ar) },
    { key: "checkLogo", ok: Boolean(company.logo_url) },
    { key: "checkWebsite", ok: Boolean(company.website) },
    { key: "checkProduct", ok: productCount > 0 },
    { key: "checkRegistration", ok: registrationCount > 0 },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { checks, percent };
}
