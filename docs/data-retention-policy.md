# Politique de Rétention des Données

**Projet :** Fixit Production
**Version :** 1.0
**Date d'entrée en vigueur :** 2026-04-06
**Prochaine révision :** 2027-04-06
**Responsable :** DPO / Équipe technique Fixit

---

## 1. Objectif

Cette politique définit les durées de conservation applicables à chaque catégorie de données personnelles traitées par Fixit, conformément au principe de limitation de la conservation prévu par le RGPD, article 5(1)(e) :

> *Les données à caractère personnel doivent être conservées sous une forme permettant l'identification des personnes concernées pendant une durée n'excédant pas celle nécessaire au regard des finalités pour lesquelles elles sont traitées.*

Elle sert à la fois de cadre juridique et de guide d'implémentation technique pour l'équipe de développement. Chaque durée de rétention est associée à une base légale, un mécanisme de suppression et un responsable identifié.

Le périmètre couvre l'ensemble des données stockées dans Supabase (PostgreSQL, Storage, Auth), les services tiers (Stripe, Sentry, Langfuse, Resend) et les sauvegardes associées.

---

## 2. Tableau de rétention

| Catégorie | Données | Durée de conservation | Base légale | Mécanisme de suppression |
|---|---|---|---|---|
| Comptes utilisateurs | Profils, credentials, préférences | Durée du compte actif | Contrat (Art. 6(1)(b)) | Suppression immédiate sur demande utilisateur |
| Réservations | Bookings, messages associés, historique | 3 ans après complétion | Intérêt légitime (Art. 6(1)(f)) | Anonymisation des données personnelles |
| Factures / Devis | PDF, montants, SIRET, NIF | 6 ans (FR, Code de commerce L123-22) / 10 ans (PT, Código Comercial Art. 40) | Obligation légale (Art. 6(1)(c)) | Archivage séparé puis suppression à expiration |
| Données fiscales PT | Fichiers SAF-T, numéros ATCUD, séries | 10 ans (Portaria 363/2010) | Obligation légale (Art. 6(1)(c)) | Archivage longue durée, suppression à expiration |
| Paiements Stripe | Transactions, refunds, disputes | 7 ans | Obligation fiscale | Géré par Stripe (hors de notre contrôle direct) |
| Audit logs | Actions utilisateur, adresses IP, user_agent | 1 an | RGPD Art. 30 (registre des traitements) | Suppression automatique via `pg_cron` |
| Analytics events | Page views, clics, événements custom | 90 jours | Consentement (Art. 6(1)(a)) | Suppression automatique via `pg_cron` |
| Photos / Documents | Fichiers dans les Storage buckets Supabase | Durée du compte actif | Contrat (Art. 6(1)(b)) | Suppression en cascade avec le compte |
| Logs Sentry | Erreurs, stack traces, breadcrumbs | 90 jours | Intérêt légitime (Art. 6(1)(f)) | Géré par Sentry (rétention configurée dans le projet) |
| Logs Langfuse | Traces IA, prompts, réponses | 30 jours | Intérêt légitime (Art. 6(1)(f)) | Géré par Langfuse (rétention configurée côté service) |
| Emails (Resend) | Corps des emails, destinataires, statuts | 30 jours | Contrat (Art. 6(1)(b)) | Géré par Resend (suppression automatique) |
| Comptes supprimés | Aucune donnée personnelle conservée | 0 jour (suppression immédiate) | RGPD Art. 17 (droit à l'effacement) | Nettoyage de 26 tables en cascade |

---

## 3. Procédures de suppression

### 3.1 Suppressions automatiques (pg_cron)

Les jobs `pg_cron` suivants tournent sur la base Supabase PostgreSQL :

```sql
-- Audit logs : suppression des entrées de plus d'1 an
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * 0',  -- chaque dimanche à 3h
  $$DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year'$$
);

-- Analytics events : suppression des entrées de plus de 90 jours
SELECT cron.schedule(
  'cleanup-analytics',
  '0 4 * * 0',  -- chaque dimanche à 4h
  $$DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days'$$
);
```

Ces jobs doivent être vérifiés mensuellement via `SELECT * FROM cron.job;` pour confirmer qu'ils sont actifs.

### 3.2 Suppression de compte utilisateur

Lorsqu'un utilisateur demande la suppression de son compte, le processus suit cet ordre :

1. **Vérification d'identité** : confirmation par email ou via le tableau de bord.
2. **Suppression des fichiers** : purge des Storage buckets liés à l'utilisateur.
3. **Nettoyage des 26 tables** : suppression en cascade via la fonction `delete_user_data(user_id)`.
4. **Suppression du compte Auth** : appel à `supabase.auth.admin.deleteUser(uid)`.
5. **Confirmation** : email de confirmation envoyé à l'adresse enregistrée.

Le délai maximal est de 72 heures après la demande. En pratique, la suppression est quasi-immédiate.

### 3.3 Anonymisation des réservations

Après 3 ans, les réservations ne sont pas supprimées mais anonymisées :

- Les champs `customer_name`, `customer_email`, `customer_phone` sont remplacés par des valeurs génériques (`"[anonymisé]"`).
- Les messages associés sont supprimés.
- Les montants et dates sont conservés à des fins statistiques.

```sql
-- Job d'anonymisation des réservations anciennes
SELECT cron.schedule(
  'anonymize-old-bookings',
  '0 2 1 * *',  -- le 1er de chaque mois à 2h
  $$UPDATE bookings
    SET customer_name = '[anonymisé]',
        customer_email = '[anonymisé]',
        customer_phone = '[anonymisé]'
    WHERE completed_at < NOW() - INTERVAL '3 years'
      AND customer_name != '[anonymisé]'$$
);
```

### 3.4 Archivage des factures et données fiscales

Les factures et données fiscales suivent un processus en deux phases :

1. **Phase active** : les documents restent dans la base principale pendant les 2 premières années.
2. **Phase d'archivage** : transfert vers un schéma `archive` avec accès restreint. Les données SAF-T portugaises (Portaria 363/2010) restent dans ce schéma pendant 10 ans.

La suppression finale est déclenchée manuellement par l'équipe technique après vérification de la date d'expiration.

### 3.5 Services tiers

| Service | Action requise | Fréquence |
|---|---|---|
| Stripe | Aucune (Stripe gère la rétention selon ses obligations) | N/A |
| Sentry | Configurer la rétention à 90 jours dans Project Settings > General | À la création du projet |
| Langfuse | Configurer la rétention à 30 jours dans les paramètres du projet | À la création du projet |
| Resend | Aucune (suppression automatique après 30 jours) | N/A |

---

## 4. Backups et données supprimées

### 4.1 Backups Supabase

Supabase effectue des sauvegardes automatiques avec une rétention de 7 jours (plan Pro). Les backups sont des snapshots complets de la base PostgreSQL.

Conséquence : une donnée supprimée de la base de production peut persister dans les backups pendant un maximum de 7 jours. Après la rotation complète des backups, la donnée est définitivement effacée.

### 4.2 Backups Storage

Les fichiers supprimés des Storage buckets Supabase ne sont pas inclus dans les backups point-in-time. La suppression est immédiate et définitive.

### 4.3 Demandes d'effacement et backups

En cas de demande d'effacement (Art. 17), la suppression est effectuée immédiatement sur la base de production. Le demandeur est informé que les backups peuvent contenir ses données pendant un délai maximal de 7 jours, ce qui est conforme aux recommandations de la CNIL concernant les sauvegardes techniques.

---

## 5. Demandes d'exercice des droits

### 5.1 Canaux de réception

Les demandes peuvent être soumises via :

- Le formulaire de contact sur le site (section "Mes données")
- Email direct à l'adresse du DPO : `dpo@fixit.com` (à adapter)
- Courrier postal à l'adresse du siège

### 5.2 Délai de traitement

Le délai légal est de **30 jours** à compter de la réception de la demande (RGPD Art. 12(3)). Ce délai peut être prolongé de 2 mois supplémentaires en cas de complexité, à condition d'en informer le demandeur dans les 30 premiers jours.

### 5.3 Types de demandes

**Droit d'accès (Art. 15)**
Export JSON ou PDF de toutes les données personnelles de l'utilisateur. Implémenté via la fonction `export_user_data(user_id)` qui agrège les données de toutes les tables concernées.

**Droit de rectification (Art. 16)**
Modification des données inexactes. L'utilisateur peut effectuer la plupart des modifications directement depuis son profil. Les données de facturation nécessitent une intervention manuelle.

**Droit à l'effacement (Art. 17)**
Suppression complète du compte et de toutes les données associées (cf. section 3.2). Exceptions : les données soumises à obligation légale de conservation (factures, données fiscales) ne peuvent pas être supprimées avant expiration du délai légal.

**Droit à la portabilité (Art. 20)**
Export des données dans un format structuré, lisible par machine (JSON). L'export inclut : profil, réservations, messages, factures. Disponible via l'endpoint API `/api/user/export` ou sur demande au DPO.

### 5.4 Registre des demandes

Chaque demande est enregistrée dans la table `data_requests` avec :

- Date de réception
- Type de demande
- Identité du demandeur
- Date de traitement
- Action effectuée
- Responsable du traitement

Ce registre est conservé 3 ans à des fins de preuve de conformité.

---

## 6. Responsabilités

### 6.1 DPO (Délégué à la Protection des Données)

- Validation des durées de rétention lors de l'introduction de nouvelles catégories de données.
- Réponse aux demandes d'exercice des droits.
- Tenue du registre des traitements (Art. 30).
- Point de contact avec la CNIL et la CNPD (Portugal).

### 6.2 Équipe technique

- Implémentation et maintenance des jobs `pg_cron`.
- Vérification mensuelle du bon fonctionnement des suppressions automatiques.
- Implémentation des fonctions d'export et de suppression de données.
- Configuration de la rétention sur les services tiers (Sentry, Langfuse).

### 6.3 Équipe juridique / Direction

- Validation des bases légales pour chaque traitement.
- Mise à jour de la politique en cas d'évolution réglementaire (FR et PT).
- Décision sur les demandes d'effacement impliquant des obligations légales contradictoires.

---

## 7. Révision

Cette politique est révisée **une fois par an**, au minimum, ou lors de :

- L'ajout d'une nouvelle catégorie de données personnelles.
- Un changement de prestataire (hébergement, paiement, analytics).
- Une évolution réglementaire affectant les durées de conservation.
- Un incident de sécurité impliquant des données personnelles.

La prochaine révision est prévue pour **avril 2027**.

| Version | Date | Auteur | Modifications |
|---|---|---|---|
| 1.0 | 2026-04-06 | Équipe Fixit | Création initiale |

---

*Document classé : interne. Ne pas diffuser en dehors de l'équipe projet sans autorisation du DPO.*
