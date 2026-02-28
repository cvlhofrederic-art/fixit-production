# Stratégie de Sauvegarde & Plan de Reprise — Vitfix

## 1. Sauvegardes Base de Données (Supabase)

### Sauvegardes automatiques
- **Fréquence** : Quotidienne (incluse dans le plan Supabase Pro)
- **Rétention** : 7 jours (Pro), 30 jours (Enterprise)
- **Type** : Snapshots PostgreSQL complets

### Sauvegardes manuelles
- **Commande** : `pg_dump` via connection string Supabase
- **Fréquence recommandée** : Avant chaque migration
- **Stockage** : Bucket S3 chiffré séparé

### Procédure de restauration
1. Accéder au Dashboard Supabase > Database > Backups
2. Sélectionner le snapshot souhaité
3. Cliquer "Restore" (crée une nouvelle instance)
4. Vérifier les données
5. Basculer le DNS / variables d'environnement

## 2. Objectifs de Reprise

| Métrique | Objectif | Actuel |
|----------|----------|--------|
| **RTO** (Recovery Time Objective) | < 1 heure | ~2 heures |
| **RPO** (Recovery Point Objective) | < 24 heures | 24 heures |

## 3. Sauvegardes Code Source

- **Repository** : Git (hébergé)
- **Branches** : `main` (production)
- **Déploiement** : Vercel (historique des déploiements conservé)
- **Rollback** : Via Vercel Dashboard > Deployments > Promote

## 4. Sauvegardes Storage (Fichiers)

- **Buckets Supabase Storage** : Sauvegardés avec la DB
- **Documents sensibles** : Chiffrés au repos (Supabase managed)

## 5. Secrets & Variables d'environnement

- **Stockage** : Vercel Environment Variables (chiffré)
- **Rotation** : Trimestrielle pour les clés API
- **Accès** : Limité aux administrateurs

## 6. Plan d'Incident Sécurité

### En cas de fuite de données
1. Révoquer immédiatement les clés compromises
2. Notifier la CNIL sous 72 heures (RGPD Art. 33)
3. Notifier les utilisateurs affectés (RGPD Art. 34)
4. Documenter l'incident
5. Mettre en place les correctifs

### En cas de panne service
1. Vérifier `/api/health` endpoint
2. Consulter Supabase Status + Vercel Status
3. Si DB down : restaurer depuis backup
4. Si Vercel down : attendre ou basculer CDN
5. Communiquer via page de statut

## 7. Tests de Reprise

- **Fréquence** : Trimestrielle
- **Procédure** : Restaurer un backup sur instance de test
- **Vérification** : Intégrité des données + fonctionnalités critiques
