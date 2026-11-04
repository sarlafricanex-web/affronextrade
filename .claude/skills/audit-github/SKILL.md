---
name: audit-github
description: Skill d'audit sécurité de repos GitHub. Quand l'utilisateur demande "vérifie ce repo", "audite ce GitHub", "c'est safe ce repo ?", "analyse ce dépôt", ou donne une URL GitHub à vérifier, cette skill effectue une analyse de sécurité complète en lecture seule et produit un rapport HTML dans livrable/application/.
---

# Skill : Audit Sécurité GitHub

## Mission

Analyser un dépôt GitHub en **lecture seule** pour détecter les risques de sécurité avant de le cloner ou l'utiliser. Produit un rapport HTML autonome, lisible sur mobile, avec un score de confiance et des recommandations concrètes.

**REGLE ABSOLUE : lecture seule. N'exécute, n'installe et ne lance rien du repo audité.**

---

## Phase 1 : Identifier le repo à auditer

Si l'utilisateur n'a pas fourni d'URL, demande-la :

```
Quel repo GitHub veux-tu que j'audite ?

Donne-moi l'URL (ex: https://github.com/user/repo)
```

Extraire de l'URL :
- Le propriétaire (owner)
- Le nom du repo (name)
- La branche cible (par défaut : main ou master)

---

## Phase 2 : Collecter les informations

### 2.1 Métadonnées du repo

Via l'API GitHub ou en naviguant le repo, collecter :
- Age du repo (date de création)
- Nombre d'étoiles, forks, watchers
- Nombre de contributeurs
- Dernier commit (date et auteur)
- Licence
- Présence et cohérence du README
- Ratio étoiles/activité (un repo avec 5000 étoiles et 1 commit est suspect)

### 2.2 Analyse des fichiers (9 catégories)

Parcourir le repo et vérifier chaque catégorie :

**1. Exécution automatique**
- `package.json` : scripts `preinstall`, `postinstall`, `prepare`, `prepack`
- `setup.py`, `setup.cfg`, `pyproject.toml` : commandes d'install custom
- `Makefile`, `install.sh`, `bootstrap.sh`
- `.vscode/tasks.json`, `.devcontainer/`
- `.husky/`, `.git/hooks/`

**2. Code suspect**
- Obfuscation : `base64`, `hex`, `eval()`, `exec()`, `Function()`, `atob()`
- Chaînes encodées longues et illisibles
- Code minifié dans un repo non-minifié

**3. Réseau**
- URLs et IP codées en dur
- Webhooks Discord (`discord.com/api/webhooks`), Telegram (`api.telegram.org`)
- Domaines inconnus ou suspects
- `curl | sh`, `wget | bash`, `PowerShell -enc`, `iex`

**4. Vol de données**
- Accès à `~/.ssh`, `~/.aws`, `~/.config`
- Lecture de `.env`, fichiers de cookies, profils navigateur
- Accès aux wallets crypto (`~/.bitcoin`, `~/.ethereum`)
- Lecture du presse-papiers

**5. Secrets exposés**
- Clés API (patterns connus : `AKIA`, `sk-`, `ghp_`, `glpat-`)
- Tokens, mots de passe en clair
- Fichiers `.env` commités

**6. Binaires sans source**
- `.exe`, `.dll`, `.so`, `.dylib`
- Archives (`.zip`, `.tar.gz`) sans source correspondante
- Fichiers binaires dans des dossiers inattendus

**7. Dépendances**
- Typosquatting (noms proches de packages populaires)
- Versions non figées (`*`, `latest`)
- Packages avec peu de téléchargements ou récemment publiés

**8. GitHub Actions**
- `pull_request_target` (dangereux si mal utilisé)
- Secrets exposés dans les logs
- Actions tierces non vérifiées
- Permissions trop larges

**9. Réputation globale**
- Profil du propriétaire (age, autres repos, activité)
- Cohérence entre le README et le code réel
- Issues et PR : activité communautaire légitime
- Forks suspects ou coordonnés

---

## Phase 3 : Notation

### Score de confiance /100

Partir de 100 et retirer des points :

| Risque | Points retirés |
|--------|---------------|
| Exécution auto suspecte | -15 à -25 |
| Code obfusqué/eval | -20 à -30 |
| Téléchargement + exécution | -30 |
| Vol de données potentiel | -30 à -40 |
| Secrets exposés | -10 à -20 |
| Binaires sans source | -15 à -25 |
| Dépendances suspectes | -10 à -20 |
| GitHub Actions risquées | -10 à -15 |
| Réputation faible | -5 à -15 |

### Verdict

- **90-100** : Sûr (vert)
- **60-89** : Prudence (orange)
- **0-59** : Dangereux (rouge)

---

## Phase 4 : Générer le rapport HTML

Produire UN fichier HTML autonome (CSS inline) dans `livrable/application/audit-[nom-du-repo]-[date].html`

### Structure du rapport :

```html
<!-- En-tête -->
- Nom du repo + lien
- Score de confiance /100 (grand, coloré)
- Verdict : 🟢 Sûr / 🟠 Prudence / 🔴 Dangereux
- Date de l'audit

<!-- Cartes par catégorie (9 cartes) -->
Chaque carte contient :
- Icône de statut : 🟢 OK / 🟠 A vérifier / 🔴 Critique
- Nom de la catégorie
- Résumé en 1 ligne
- Détails si problèmes trouvés

<!-- Tableau des risques -->
Trié du plus grave au moins grave :
- Fichier + ligne
- Court extrait du code
- Explication simple du risque
- Sévérité (Critique / Moyen / Faible)

<!-- Conclusion -->
- "Peut-on cloner et lancer ce repo ?"
- Réponse claire (oui / oui avec précautions / non)
- Recommandations concrètes numérotées
```

### Contraintes du HTML :
- CSS inline uniquement (pas de fichier externe)
- Responsive (lisible sur mobile)
- Palette de couleurs : vert #22c55e, orange #f59e0b, rouge #ef4444, fond #f8fafc
- Police sans-serif, lisible
- Pas de JavaScript (fichier statique pur)

---

## Phase 5 : Présenter le résultat

Après génération du rapport, résumer dans le chat :

```
Audit terminé pour [nom du repo].

Score : [XX]/100 - [Verdict emoji + texte]

Principaux constats :
- [Constat 1 le plus important]
- [Constat 2]
- [Constat 3]

Verdict : [Peut-on cloner ? Oui/Non + condition]

Rapport complet : livrable/application/audit-[nom]-[date].html
```

---

## Règles importantes

- **JAMAIS exécuter de code** du repo audité, même pour "tester"
- **Ne rien inventer** : si un fichier n'a pas pu être lu, le mentionner dans le rapport
- **Pour chaque constat** : fichier + ligne + extrait + explication. Pas de vague
- **Être honnête** sur les limites : une analyse statique ne détecte pas tout
- **Communication en français** systématique
- **Pas de tirets longs** (em dashes)
- **Rapport dans** `livrable/application/`
