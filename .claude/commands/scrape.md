# /scrape

> Commande pour scraper, extraire ou rechercher des donnees sur le web.

---

## Strategie d'outils

Cette commande utilise deux backends selon la disponibilite :

1. **Backend principal (WebSearch + WebFetch)** : outils integres Claude, fonctionnent toujours (cote serveur Anthropic)
2. **Backend avance (ScrapeGraphAI MCP)** : outils MCP avances, necessite acces reseau a api.scrapegraphai.com

Au lancement, tester si les outils MCP ScrapeGraph repondent. Si non, utiliser WebSearch/WebFetch automatiquement.

---

## Mission

Quand je lance `/scrape [URL ou instruction]`, execute la sequence suivante :

### Etape 1 : Comprendre la demande

Analyser ce que l'utilisateur veut faire :

- **URL seule** : scraper le contenu de la page
- **URL + instruction** : extraire des donnees specifiques
- **Question sans URL** : recherche web
- **"crawl" + URL** : crawler le site multi-pages (ScrapeGraph uniquement)
- **"monitor" + URL** : creer un monitoring planifie (ScrapeGraph uniquement)
- **"credits"** : verifier le solde ScrapeGraph

### Etape 2 : Confirmer l'action

Presenter l'action prevue avant de l'executer :

```
Je vais [action] sur [cible].

Outil : [WebFetch/WebSearch ou ScrapeGraph]

On lance ?
```

### Etape 3 : Executer

**Avec WebSearch (recherche) :**
- Utiliser WebSearch avec une requete precise
- Mode "standard" par defaut, "extended" pour les recherches approfondies

**Avec WebFetch (scraping de page) :**
- Utiliser WebFetch avec l'URL et un prompt d'extraction
- Le prompt decrit ce qu'on veut extraire de la page

**Avec ScrapeGraph (si disponible) :**
- Utiliser les outils MCP (smartscraper, searchscraper, markdownify, etc.)

### Etape 4 : Presenter les resultats

Afficher les resultats de maniere claire et structuree.

Si les donnees sont volumineuses, proposer :
1. Un resume dans le chat
2. L'export en fichier dans `livrable/application/`

---

## Exemples d'utilisation

### Scraper une page
```
/scrape https://example.com
```
Recupere le contenu principal de la page.

### Extraire des donnees
```
/scrape https://example.com/produits extrais les noms et prix
```
Extraction structuree par IA.

### Recherche web
```
/scrape recherche les fournisseurs de dattes en Algerie
```
Recherche web avec resultats structures.

### Prospection
```
/scrape trouve des importateurs de produits alimentaires en Cote d'Ivoire
```
Recherche et extraction de contacts/entreprises.

### Crawler un site (ScrapeGraph requis)
```
/scrape crawl https://docs.example.com 20 pages
```
Crawl multi-pages.

---

## Regles importantes

- **Toujours confirmer** l'action avant d'executer
- **Ne jamais exposer** de cle API dans les reponses
- **Sauvegarder** les resultats volumineux dans `livrable/application/`
- **Inclure les sources** (URLs) dans les resultats de recherche
- **Communication en francais** systematique
- **Pas de tirets longs** (em dashes)
