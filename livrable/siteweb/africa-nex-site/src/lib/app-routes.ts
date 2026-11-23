// Pages de l'espace connecte (groupe (app)) : elles ont leur propre barre d'application et leur
// propre ligne de liens legaux ; le menu et le pied de page du site vitrine ne s'y affichent pas.
export const APP_PREFIXES = ["/dashboard", "/onboarding", "/company", "/catalog", "/claim", "/admin", "/rfq", "/requests", "/subscription"] as const;

export const isAppPath = (path: string) => APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
