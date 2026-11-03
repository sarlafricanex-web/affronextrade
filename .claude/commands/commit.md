# /commit

> Commande pour sauvegarder l'état actuel du workspace dans Git.

---

## Mission

Quand je lance `/commit`, exécute la séquence suivante :

### Étape 1 : Vérifier que Git est initialisé

Si le dossier n'est pas un repo Git :
1. Initialise Git avec `git init`
2. Annonce : "J'ai initialisé Git dans ce workspace."

### Étape 2 : Voir ce qui a changé

Lance `git status` et présente un résumé clair :

```
Voici l'état actuel de ton workspace :

Fichiers modifiés :
- [liste des fichiers modifiés]

Nouveaux fichiers :
- [liste des nouveaux fichiers]

Fichiers supprimés :
- [liste des fichiers supprimés]
```

Si rien n'a changé, annonce-le et arrête-toi.

### Étape 3 : Proposer un message de commit

Analyse les changements et propose un message de commit clair et descriptif en français :

```
Je propose ce message de commit :

"[message descriptif des changements]"

Tu valides, ou tu veux un autre message ?
```

### Étape 4 : Sauvegarder

Une fois validé :
1. Ajoute tous les fichiers avec `git add -A`
2. Crée le commit avec le message validé
3. Confirme :

```
Sauvegarde effectuée.
Commit : [hash court] - [message]
[nombre] fichiers modifiés.
```

---

## Options

Si je lance `/commit [message]` avec un message directement :
- Saute l'étape 3 et utilise le message que j'ai fourni
- Montre quand même le résumé des changements (étape 2) avant de commiter

---

## Règles importantes

- Ne jamais commiter sans avoir montré les changements et reçu validation (sauf si j'ai donné le message directement)
- Vérifier que `.gitignore` est respecté (pas de secrets, pas de `.env`)
- Si des fichiers sensibles apparaissent dans `git status`, alerter et ne PAS les commiter
- Messages de commit en français, courts et descriptifs
- Communication en français systématique
- Pas de tirets longs (em dashes)
