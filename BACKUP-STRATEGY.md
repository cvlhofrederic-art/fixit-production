# Stratégie de Sauvegarde & Reprise d'Activité — Vitfix.io

> Dernière mise à jour : 5 avril 2026

---

## 1. Vue d'ensemble

Ce document couvre la sauvegarde et la restauration de tous les composants de Vitfix.io.

| Composant | Méthode de sauvegarde | Fréquence | Rétention |
|-----------|-----------------------|-----------|-----------|
| Base de données PostgreSQL | Snapshots automatiques Supabase | Quotidienne | 7 jours (Pro) |
| Code source | Repository GitHub + tags Release Please | Continue (chaque push) | Illimitée |
| Fichiers Storage | Inclus dans les snapshots Supabase | Quotidienne | 7 jours |
| Variables d'environnement | Vercel Dashboard + GitHub Secrets | Manuelle | Tant que le projet existe |
| Données Stripe | Conservées par Stripe | Continue | Selon plan Stripe |
| Traces Sentry / Langfuse | Conservées par chaque service | Continue | 30-90 jours selon plan |

---

## 2. Base de données (Supabase PostgreSQL)

### Sauvegardes automatiques

Supabase effectue un snapshot complet de la base PostgreSQL chaque jour. Sur le plan Pro, les 7 derniers jours sont conservés. Le plan Enterprise étend la rétention à 30 jours.

Le Point-in-Time Recovery (PITR) est disponible sur le plan Pro (addon) et Enterprise. Il permet de restaurer la base à n'importe quelle seconde dans la fenêtre de rétention, ce qui réduit le RPO de 24h à quelques secondes.

### Sauvegardes manuelles via pg_dump

Avant chaque migration destructive (suppression de colonne, modification de type, DROP TABLE), lancer un export manuel :

```bash
# Récupérer la connection string depuis Supabase Dashboard > Settings > Database
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump
```

Stocker le fichier `.dump` dans un bucket S3 chiffré ou en local. Ces exports manuels n'ont pas de limite de rétention.

### Ce qui est sauvegardé

- Toutes les tables (utilisateurs, artisans, devis, bookings, paiements, etc.)
- Les 41 politiques RLS
- Les fonctions et triggers PostgreSQL
- Les index et contraintes

---

## 3. Code source (GitHub)

Le code vit dans un repository GitHub privé. L'historique Git complet sert de sauvegarde du code.

**Branches :**
- `main` : branche de production, déployée automatiquement sur Vercel
- Branches de PR : créées pour chaque fonctionnalité ou correctif

**Tags et releases :**
Release Please (`release.yml`) crée automatiquement des tags versionnés et des GitHub Releases à chaque merge dans `main`. Le `CHANGELOG.md` est mis à jour en parallèle. Ces tags permettent de retrouver l'état exact du code à chaque version publiée.

**Vercel conserve l'historique de tous les déploiements.** Chaque deploy est identifié par un hash de commit et peut être promu en production via le Dashboard (Deployments > "..." > Promote to Production).

---

## 4. Fichiers Storage (Supabase Storage)

Supabase Storage héberge 5 buckets protégés par RLS :

- Documents de chantier (photos, rapports PDF)
- Pièces justificatives artisans (attestations RC Pro, Kbis)
- Avatars et logos
- Documents de copropriété
- Exports et factures générées

Les fichiers Storage sont inclus dans les snapshots automatiques quotidiens de Supabase. Ils suivent la même rétention que la base de données (7 jours Pro).

Pour une sauvegarde complémentaire, il est possible de synchroniser les buckets vers un stockage externe via l'API Supabase Storage ou `supabase storage cp`.

---

## 5. Variables d'environnement

Les secrets sont répartis sur trois emplacements :

| Emplacement | Contenu | Accès |
|-------------|---------|-------|
| Vercel Environment Variables | Toutes les variables de production (Supabase, Groq, Stripe, Sentry, Upstash, Google OAuth, DocuSeal, CRON_SECRET, ENCRYPTION_KEY) | Administrateurs Vercel |
| GitHub Actions Secrets | Variables CI : SONAR_TOKEN, SENTRY_AUTH_TOKEN, LANGFUSE keys, GISKARD_API_KEY, clés Supabase publiques | Administrateurs du repo |
| `.env.local` (local uniquement) | Copie locale pour le développement, jamais commité | Développeur |

Le fichier `.env.example` à la racine du projet liste toutes les variables requises sans leurs valeurs. Il sert de référence pour reconstituer la configuration en cas de perte.

Il n'existe pas de sauvegarde automatique des variables Vercel. Maintenir un export chiffré (1Password, Bitwarden, ou fichier GPG) des secrets de production, mis à jour à chaque rotation de clé.

---

## 6. Services externes

### Stripe

Stripe conserve l'intégralité de l'historique des paiements, abonnements, clients et webhooks. Ces données sont récupérables via le Dashboard Stripe ou l'API. La table `stripe_webhook_events` dans Supabase assure l'idempotence des webhooks, mais les données de paiement source restent chez Stripe.

### Sentry

Les erreurs, traces (10% sampling) et source maps sont conservées par Sentry selon le plan (30 à 90 jours). Ces données sont utiles pour le debugging mais ne sont pas critiques pour la reprise d'activité.

### Langfuse

Les traces LLM (prompts, réponses, latences, scores) sont stockées chez Langfuse. L'évaluation nocturne (`langfuse-eval.yml`) en dépend. En cas de perte de ces données, les agents IA continuent de fonctionner, mais l'historique de qualité est perdu. Exporter périodiquement les datasets d'évaluation via l'API Langfuse si nécessaire.

### Groq / Tavily / OpenRouter

Aucune donnée persistante chez ces providers. Seules les clés API comptent (voir section 5).

---

## 7. Procédure de restauration

### Étape 1 : Restaurer la base de données

1. Accéder au Dashboard Supabase > Database > Backups
2. Sélectionner le snapshot le plus récent avant l'incident (ou utiliser le PITR si activé)
3. Cliquer "Restore" (Supabase crée une nouvelle instance)
4. Si l'URL ou les clés de la nouvelle instance changent, mettre à jour `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` dans Vercel

Alternative avec pg_dump :

```bash
pg_restore --dbname="postgresql://postgres:[PASSWORD]@db.[NEW_PROJECT].supabase.co:5432/postgres" \
  --clean --if-exists backup_YYYYMMDD_HHMMSS.dump
```

### Étape 2 : Redéployer le code

Si le code en production est corrompu ou si les variables d'environnement ont changé :

```bash
# Option A : redeploy depuis Vercel Dashboard
# Deployments > dernier deploy fonctionnel > Promote to Production

# Option B : forcer un redeploy via CLI
vercel --prod --yes
```

### Étape 3 : Vérifier la santé

```bash
# Health check
curl -s https://fixit-production.vercel.app/api/health | jq .

# Pages principales
curl -s -o /dev/null -w "%{http_code}" https://fixit-production.vercel.app/fr/
curl -s -o /dev/null -w "%{http_code}" https://fixit-production.vercel.app/pt/
```

Vérifier que le health check retourne `database: healthy` et `environment: healthy`.

### Étape 4 : Resynchroniser les données externes

- Vérifier que les webhooks Stripe arrivent (Stripe Dashboard > Webhooks > événements récents)
- Vérifier que les cron jobs tournent (Vercel Dashboard > Crons)
- Lancer manuellement les syncs de données si nécessaire (DECP, SITADEL, mairies, Base.gov PT)

---

## 8. Scénarios de disaster recovery

### Base de données corrompue

1. Identifier l'étendue de la corruption via les logs Supabase
2. Restaurer depuis le snapshot quotidien le plus récent (Dashboard > Backups > Restore)
3. Si le PITR est activé, restaurer au moment précis avant la corruption
4. Vérifier l'intégrité des données (comptes utilisateurs, devis, paiements)
5. Mettre à jour les env vars Vercel si l'instance Supabase a changé, puis redéployer

**Temps estimé :** 1 à 2 heures.

### Suppression accidentelle de données

Si une migration ou une requête SQL a supprimé des données par erreur :

1. Ne pas appliquer d'autres modifications sur la base
2. Restaurer depuis le backup le plus récent via PITR ou snapshot
3. Si la suppression est partielle, exporter les données manquantes du backup et les réinjecter via SQL

**Temps estimé :** 30 minutes à 2 heures selon le volume.

### Panne Vercel

Vitfix tourne en mono-provider sur Vercel. Aucun failover automatique n'est configuré.

1. Surveiller https://www.vercel-status.com
2. Si la panne dure plus de 2 heures, envisager un déploiement temporaire (Cloudflare Pages, Netlify) en connectant le même repo GitHub
3. Les données ne sont pas affectées (Supabase est indépendant de Vercel)

**Temps estimé :** variable, dépend de Vercel.

### Panne Supabase

1. Surveiller https://status.supabase.com
2. L'application affichera `database: unhealthy` sur `/api/health`
3. Les pages statiques (SEO, blog) restent accessibles via le CDN Vercel
4. Attendre la résolution ou contacter le support Supabase si la panne dépasse 15 minutes

**Temps estimé :** variable, dépend de Supabase.

### Identifiants compromis

1. Révoquer immédiatement les clés concernées sur chaque dashboard (Supabase, Stripe, Groq, Google Cloud, etc.)
2. Régénérer de nouvelles clés
3. Mettre à jour les env vars dans Vercel et GitHub Secrets
4. Redéployer (`vercel --prod --yes`)
5. Lancer un scan TruffleHog (`npm run scan:secrets`) pour vérifier qu'aucun secret n'est dans le code
6. Vérifier les logs d'accès Supabase (Dashboard > Logs > Auth)
7. Si des données personnelles sont concernées : notifier la CNIL sous 72h (RGPD Art. 33), notifier les utilisateurs (Art. 34)
8. Documenter l'incident dans `docs/postmortems/`

**Temps estimé :** 30 minutes pour la rotation des clés, variable pour l'investigation.

---

## 9. RTO / RPO cibles

| Composant | RPO (perte de données max) | RTO (temps de reprise) |
|-----------|---------------------------|------------------------|
| Base de données (sans PITR) | 24 heures | 2 heures |
| Base de données (avec PITR) | ~10 secondes | 1 heure |
| Code source | 0 (Git distribué) | 5 minutes |
| Fichiers Storage | 24 heures | 2 heures (lié au restore DB) |
| Variables d'environnement | 0 si export chiffré maintenu | 15 minutes |
| Données Stripe | 0 (conservées par Stripe) | 0 (service indépendant) |
| Traces Sentry / Langfuse | Non critique | Non applicable |

**Objectif global :** RPO < 24h, RTO < 2h. L'activation du PITR Supabase réduirait le RPO de la base de données à quelques secondes.

---

## 10. Tests de restauration

### Fréquence

Trimestrielle. Planifier un test au début de chaque trimestre.

### Procédure de test

1. Restaurer le dernier snapshot Supabase sur un projet de test (Dashboard > Backups > Restore to new project)
2. Créer un déploiement preview Vercel pointant vers cette instance de test
3. Vérifier les fonctionnalités critiques :
   - Connexion utilisateur (auth Supabase)
   - Création d'un devis via Fixy AI
   - Affichage du dashboard artisan et client
   - Flux de paiement Stripe (mode test)
   - Pages SEO FR et PT (HTTP 200)
4. Vérifier l'intégrité des données : nombre d'utilisateurs, de devis, de bookings cohérent avec la production
5. Supprimer le projet de test après validation

### Ce qu'il faut documenter après chaque test

- Date du test
- Version du snapshot restauré
- Fonctionnalités testées et résultat (OK / KO)
- Temps total de restauration mesuré
- Écarts constatés par rapport aux objectifs RTO/RPO
- Actions correctives si nécessaire

Stocker le rapport dans `docs/postmortems/YYYY-MM-DD-test-restauration.md`.
