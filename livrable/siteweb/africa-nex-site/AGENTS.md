<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regles du projet AFRICA NEX (Cache Components + Supabase)

`cacheComponents` et `partialPrefetching` sont actives : tout est rendu a la requete sauf ce qui est marque `'use cache'`, et le routeur precharge les pages avec les cookies de session.

1. **Session** : toute lecture de session passe par `getCurrentUser()` (`src/lib/auth/current-user.ts`). Elle appelle `connection()` : la verification du jeton Supabase lit l'heure courante, interdite pendant un pre-rendu ou un prechargement.
2. **Role** : il se lit dans `profiles.role` en base, jamais dans les metadonnees du compte ni cote navigateur. Chaque page et route sensible le verifie cote serveur ; la RLS reste la vraie barriere.
3. **Pas de client serveur Supabase dans `'use cache'`** (il lit les cookies), meme indirectement. L'erreur passe `next build` et ne casse qu'en production.
4. **Jamais de cookies dans `src/app/[locale]/layout.tsx`** : l'etat de connexion du Header est un ilot client (`AuthNav`), sinon toutes les pages vitrine perdent leur rendu statique.
5. **Donnees publiques** (annuaire) : fonction `'use cache'` + `cacheTag(...)` avec le client sans cookies (`src/lib/supabase/public.ts`), invalidee par `updateTag(...)` dans les actions admin.
6. **Pages connectees** dans `src/app/[locale]/(app)/` avec `export const instant = false`.
7. **Identifiants et references** generes en base (`gen_random_uuid()`), jamais `Date.now()` ni `Math.random()` pendant le rendu. Aucun export `runtime` dans les routes.
8. **Cle secrete** (`SUPABASE_SECRET_KEY`) : lue uniquement dans `src/lib/supabase/admin.ts` (`server-only`), utilisee seulement quand aucune session ne peut servir (formulaire de contact, tache hebdomadaire, scripts).
9. **Diagnostic en developpement** : les erreurs vues par le navigateur sont lisibles via `POST /_next/mcp` (outil `get_errors`).
