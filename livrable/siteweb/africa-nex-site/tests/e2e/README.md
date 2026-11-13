# Tests de bout en bout

Chaque suite ouvre un vrai Chrome sans fenêtre, crée des comptes de test, parcourt
le site comme un utilisateur, vérifie la base de données, puis supprime tout ce qu'elle a créé.

## Sécurité

Ces tests utilisent la clé secrète Supabase (ils créent et suppriment des comptes).
`_guard.mjs` les **bloque s'ils ne visent pas la base de développement africanex-dev**.
Ne jamais retirer ce garde-fou, ne jamais les lancer contre la production.

Les comptes créés sont tous en `test-...@example.com`. Le compte de démonstration
`demo.producteur@example.com` n'est jamais touché.

## Lancer les tests

1. Construire et démarrer l'aperçu local :
   `npm run build` puis `npx next start -p 3000`
2. Dans un second terminal, depuis le dossier du site :
   - toutes les suites : `node tests/e2e/run-all.mjs`
   - quelques suites : `node tests/e2e/run-all.mjs claim company`
   - une seule, avec le détail : `node tests/e2e/company-e2e.mjs`

Comptez environ 15 minutes pour l'ensemble. Les captures et fichiers de test vont dans
`tests/e2e/.output/` (non versionné).

Chrome doit être installé. Autre emplacement : variable `CHROME_PATH`.

## Les suites

| Suite | Ce qui est vérifié |
|---|---|
| `onboarding` | Première configuration producteur, étape 1 (identité, NIF, RLS) |
| `step2`, `step3` | Présentation et logo, premier produit |
| `company` | Mon entreprise : en-tête, complétion, wilayas et communes, secteurs, NIS et article |
| `catalog` | Catalogue et éditeur de produit, fiche logistique, isolement entre producteurs |
| `documents` | Documents d'entreprise : réduction des photos, vérification par l'admin, affichage public |
| `buyer` | Inscription acheteur et Mon entreprise côté acheteur |
| `directory` | Annuaire public, filtres par secteur, fiche publique |
| `reviews` | Avis des acheteurs et modération |
| `claim` | Revendication d'une fiche, validation et refus par l'admin |
| `rfq-admin` | Console des demandes : prise en charge, garde-fou d'anonymat du brief, envoi aux producteurs, cloisonnement |
| `rfq-buyer` | Demande de devis côté acheteur : en unités ou en conteneurs, pièce jointe, liste, compteur, annulation, isolement |
| `admin-producers` | Console admin des producteurs |
| `return`, `redirect` | Retour à la bonne page après inscription ou connexion |
| `phone` | Téléphone international et pays |

Une suite affiche `Tout est bon` quand elle réussit. Le réseau vers Supabase étant parfois lent,
un échec isolé se relance une fois avant d'être considéré comme un vrai problème.
