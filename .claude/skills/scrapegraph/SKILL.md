---
name: scrapegraph
description: Skill de web scraping intelligent via le serveur MCP ScrapeGraphAI. Quand l'utilisateur demande "scrape ce site", "extrais les donnees de", "recherche sur le web", "crawle ce site", ou donne une URL a analyser, cette skill utilise le serveur MCP scrapegraph-mcp pour recuperer et structurer les donnees.
---

# Skill : ScrapeGraph - Web Scraping Intelligent

## Mission

Utiliser le serveur MCP ScrapeGraphAI pour scraper, extraire, rechercher et crawler des donnees web de maniere intelligente. Cette skill est le point d'entree pour toute operation de collecte de donnees sur le web.

**Prerequis : la cle API `SGAI_API_KEY` doit etre configuree dans l'environnement du serveur MCP.**

---

## Outils disponibles

Le serveur MCP expose ces outils :

| Outil | Usage | Cout (credits) |
|-------|-------|----------------|
| `scrape` | Recuperer le contenu d'une page (markdown, html, screenshot, liens, images, resume, branding) | 1-2 |
| `extract` | Extraction structuree par IA (URL + prompt, schema optionnel) | 10 |
| `search` | Recherche web avec extraction IA (1-20 resultats) | 10/site |
| `crawl_start` | Crawl multi-pages asynchrone | 2-10/page |
| `crawl_get_status` | Verifier le statut d'un crawl en cours | 0 |
| `schema` | Generer un schema JSON a partir d'un prompt | variable |
| `credits` | Verifier le solde de credits restants | 0 |
| `history` | Historique des requetes API | 0 |
| `monitor_create` | Creer un job de monitoring planifie | variable |

---

## Quand utiliser quel outil

### Pour recuperer le contenu d'une page
**Outil : `scrape`**
```
website_url: "https://example.com"
output_format: "markdown"  (ou html, screenshot, links, images, summary, branding)
```

### Pour extraire des donnees structurees
**Outil : `extract`**
```
website_url: "https://example.com/produits"
user_prompt: "Extrais le nom, le prix et la disponibilite de chaque produit"
output_schema: {"type": "object", "properties": {...}, "required": []}
```

### Pour rechercher sur le web
**Outil : `search`**
```
user_prompt: "Producteurs de dattes en Algerie export"
num_results: 5
```

### Pour crawler un site entier
**Outil : `crawl_start`** puis **`crawl_get_status`**
```
url: "https://example.com"
extraction_mode: "markdown"
max_pages: 20
depth: 2
```

### Pour surveiller une page dans le temps
**Outil : `monitor_create`**
```
url: "https://example.com/prix"
prompt: "Extrais les prix actuels"
interval: "0 9 * * *"  (tous les jours a 9h)
```

---

## Modes de fetch

| Mode | Description | Vitesse |
|------|-------------|---------|
| `auto` | Selection automatique (defaut) | variable |
| `fast` | HTTP direct, pas de JavaScript | rapide |
| `js` | Navigateur headless, execute le JS | lent |

Ajouter `stealth: true` pour les sites avec detection de bots (+5 credits).

---

## Regles importantes

- **Toujours verifier les credits** avant une operation couteuse (crawl large, search multiple)
- **Commencer petit** : tester avec 1-2 pages avant de lancer un crawl de 100 pages
- **Etre precis dans les prompts** : "Extrais nom, prix, description" est meilleur que "Extrais tout"
- **Utiliser un schema** pour les extractions repetitives ou complexes
- **Ne jamais exposer la cle API** dans les reponses ou les livrables
- **Communication en francais** systematique
- **Pas de tirets longs** (em dashes)

---

## Gestion des erreurs

Si le serveur MCP n'est pas connecte :
1. Verifier que le serveur est configure dans les settings Claude Code
2. Verifier que `SGAI_API_KEY` est definie
3. Relancer avec `scrapegraph-mcp` en mode stdio

Si une requete echoue :
1. Verifier le format de l'URL (doit inclure http:// ou https://)
2. Essayer avec `mode: "js"` si le site est dynamique
3. Ajouter `stealth: true` si le site bloque les bots
4. Verifier les credits restants avec l'outil `credits`
