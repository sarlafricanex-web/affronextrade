---
name: scrapegraph
description: Skill de web scraping et prospection. Quand l'utilisateur demande "scrape ce site", "extrais les donnees de", "recherche sur le web", "trouve des entreprises", "prospection", ou donne une URL a analyser, cette skill utilise WebSearch/WebFetch (toujours disponibles) ou les outils MCP ScrapeGraphAI (si le reseau le permet).
---

# Skill : Web Scraping et Prospection

## Mission

Scraper, extraire, rechercher et prospecter sur le web. Cette skill est le point d'entree pour toute operation de collecte de donnees web.

---

## Backends disponibles

### Backend 1 : WebSearch + WebFetch (toujours disponible)

Ces outils fonctionnent cote serveur Anthropic, pas de contrainte reseau.

| Outil | Usage |
|-------|-------|
| `WebSearch` | Recherche web, prospection, trouver des entreprises/contacts |
| `WebFetch` | Scraper le contenu d'une page, extraire des donnees structurees |

### Backend 2 : ScrapeGraphAI MCP (si reseau disponible)

Necessite un acces a `api.scrapegraphai.com` et la cle `SGAI_API_KEY`.

| Outil | Usage |
|-------|-------|
| `smartscraper` | Scraping intelligent avec prompt |
| `searchscraper` | Recherche web avec extraction IA |
| `markdownify` | Convertir une page en markdown |
| `sitemap` | Obtenir le plan du site |
| `smartcrawler_initiate` | Crawl multi-pages asynchrone |
| `smartcrawler_fetch_results` | Recuperer les resultats d'un crawl |
| `agentic_scrapper` | Scraping agentique avance |

---

## Selection du backend

Au lancement de la skill :
1. Tester si ScrapeGraph repond (appel rapide)
2. Si oui : utiliser ScrapeGraph pour les operations avancees
3. Si non : utiliser WebSearch/WebFetch automatiquement, sans message d'erreur

---

## Comment utiliser WebSearch + WebFetch

### Recherche web / Prospection
**Outil : `WebSearch`**
```
query: "importateurs produits alimentaires Cote d'Ivoire"
mode: "standard"  (ou "extended" pour recherche approfondie)
```

### Scraper une page
**Outil : `WebFetch`**
```
url: "https://example.com/produits"
prompt: "Extrais le nom, le prix et la description de chaque produit. Presente les resultats sous forme de tableau."
```

### Prospection multi-etapes
1. `WebSearch` pour trouver des entreprises/sites pertinents
2. `WebFetch` sur chaque resultat pour extraire les details (contacts, emails, adresses)
3. Compiler les resultats dans un fichier structure

---

## Comment utiliser ScrapeGraph (si disponible)

### Scraping intelligent
**Outil : `smartscraper`**
```
website_url: "https://example.com"
user_prompt: "Extrais les produits avec nom et prix"
```

### Recherche web
**Outil : `searchscraper`**
```
user_prompt: "Producteurs de dattes en Algerie export"
```

### Crawler un site
**Outil : `smartcrawler_initiate`** puis **`smartcrawler_fetch_results`**

---

## Regles importantes

- **Toujours confirmer** l'action avant d'executer
- **Etre precis dans les prompts** : "Extrais nom, prix, contact" est meilleur que "Extrais tout"
- **Inclure les sources** (URLs) dans tous les resultats
- **Ne jamais exposer** de cle API dans les reponses ou les livrables
- **Sauvegarder** les resultats volumineux dans `livrable/application/`
- **Communication en francais** systematique
- **Pas de tirets longs** (em dashes)

---

## Gestion des erreurs

Si ScrapeGraph ne repond pas (erreur SSL/reseau) :
- Basculer automatiquement sur WebSearch/WebFetch
- Ne pas afficher d'erreur technique, juste utiliser le backend disponible

Si WebFetch echoue sur une URL :
1. Verifier que l'URL est complete (https://)
2. Certains sites bloquent le scraping, essayer une autre source
3. Utiliser WebSearch pour trouver des pages alternatives
