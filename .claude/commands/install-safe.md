# /install-safe

> Commande pour vérifier la sécurité d'un repo GitHub AVANT de le cloner ou l'installer.

---

## Mission

Quand je lance `/install-safe [URL du repo]`, exécute la séquence suivante :

### Étape 1 : Identifier le repo

Si aucune URL n'est fournie, demande-la :

```
Quel repo veux-tu installer ?

Donne-moi l'URL GitHub (ex: https://github.com/user/repo)
```

### Étape 2 : Lancer l'audit de sécurité

Charge et exécute la skill `audit-github` sur le repo fourni.

Attends le verdict avant de continuer. **Ne jamais cloner ou installer quoi que ce soit avant la fin de l'audit.**

### Étape 3 : Décision selon le verdict

**Si verdict = Sûr (score >= 90)** :

```
Audit terminé : [score]/100 - Sûr

Le repo est clean. On passe à l'installation ?
1. Oui, clone et installe
2. Non, je veux d'abord voir le rapport complet
```

**Si verdict = Prudence (score 60-89)** :

```
Audit terminé : [score]/100 - Prudence

Points d'attention :
- [Risque 1]
- [Risque 2]

Je te recommande de lire le rapport complet avant d'installer.
Que veux-tu faire ?
1. Voir le rapport complet
2. Installer quand même (à tes risques)
3. Annuler
```

**Si verdict = Dangereux (score < 60)** :

```
Audit terminé : [score]/100 - DANGEREUX

Risques critiques détectés :
- [Risque critique 1]
- [Risque critique 2]

JE DECONSEILLE FORTEMENT l'installation de ce repo.
Que veux-tu faire ?
1. Voir le rapport complet
2. Annuler (recommandé)
```

Ne PAS proposer d'installer un repo dangereux sans que l'utilisateur insiste explicitement.

### Étape 4 : Installation (si validée)

Si l'utilisateur confirme l'installation :

1. Demander le dossier de destination :
```
Où veux-tu cloner ce repo ?
1. Dans le dossier courant
2. Dans un dossier spécifique (à préciser)
```

2. Cloner le repo : `git clone [URL] [destination]`

3. Vérifier les dépendances :
   - Si `package.json` existe : afficher les scripts d'install AVANT de lancer `npm install`
   - Si `requirements.txt` existe : afficher les packages AVANT de lancer `pip install`
   - Si `Makefile` existe : afficher les cibles AVANT d'exécuter

4. Pour chaque étape d'installation, demander validation :
```
Prochaine étape : [commande à exécuter]

Cela va [explication de ce que fait la commande].

On continue ?
```

5. Confirmer la fin :
```
Installation terminée.

Repo : [nom]
Dossier : [chemin]
Rapport d'audit : livrable/application/audit-[nom]-[date].html

Tout est en place.
```

---

## Règles importantes

- **TOUJOURS auditer AVANT d'installer**, jamais l'inverse
- **JAMAIS d'installation silencieuse** : chaque commande d'install est montrée et validée
- **Alerter** si des scripts pre/postinstall sont détectés dans package.json
- **Ne pas exécuter** de Makefile, install.sh ou bootstrap.sh sans validation explicite
- **Garder le rapport d'audit** dans livrable/application/ pour référence future
- **Communication en français** systématique
- **Pas de tirets longs** (em dashes)
