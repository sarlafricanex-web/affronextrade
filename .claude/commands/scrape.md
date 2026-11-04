# /scrape

> Commande pour scraper, extraire ou rechercher des donnees sur le web via ScrapeGraphAI.

---

## Mission

Quand je lance `/scrape [URL ou instruction]`, execute la sequence suivante :

### Etape 1 : Comprendre la demande

Analyser ce que l'utilisateur veut faire :

- **URL seule** : scraper le contenu en markdown
- **URL + instruction** : extraire des donnees structurees
- **Question sans URL** : recherche web
- **"crawl" + URL** : crawler le site multi-pages
- **"monitor" + URL** : creer un monitoring planifie
- **"credits"** : verifier le solde

### Etape 2 : Confirmer l'action

Presenter l'action prevue avant de l'executer :

```
Je vais [action] sur [cible].

Outil : [nom de l'outil MCP]
Cout estime : [X credits]

On lance ?
```

### Etape 3 : Executer

Lancer l'outil MCP appropriate via le serveur scrapegraph-mcp.

Pour un crawl asynchrone, poller `crawl_get_status` jusqu'a completion.

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
Recupere le contenu en markdown.

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

### Crawler un site
```
/scrape crawl https://docs.example.com 20 pages
```
Crawl multi-pages.

### Verifier les credits
```
/scrape credits
```

---

## Regles importantes

- **Toujours confirmer** l'action et le cout estime avant d'executer
- **Verifier les credits** avant les operations couteuses (crawl, search multiple)
- **Ne jamais exposer** la cle API dans les reponses
- **Sauvegarder** les resultats volumineux dans `livrable/application/`
- **Communication en francais** systematique
- **Pas de tirets longs** (em dashes)
