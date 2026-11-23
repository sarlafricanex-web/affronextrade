// Pages de l'espace connecte (groupe (app)) : elles ont leur propre barre d'application et leur
// propre ligne de liens legaux ; le menu et le pied de page du site vitrine ne s'y affichent pas.
export const APP_PREFIXES = ["/dashboard", "/onboarding", "/company", "/catalog", "/claim", "/admin", "/rfq", "/requests", "/subscription"] as const;

export const isAppPath = (path: string) => APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

// Couleur du menu de l'espace connecte, choisie par l'utilisateur et gardee dans un cookie (lu par
// le serveur au rendu, ecrit par le bouton du menu). Dans un fichier neutre : une constante importee
// d'un composant navigateur n'a pas sa valeur cote serveur.
export type ShellTheme = "emerald" | "light";
export const SHELL_COOKIE = "anx-shell";
