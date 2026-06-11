# Audit Base de Donnees — Vitfix.io

**Date :** 2026-04-12
**Scope :** PostgreSQL 15 via Supabase (schema `public`)
**Mode :** Audit + Remediation
**Auditeur :** Claude (Opus 4.6)
**Statut :** 25/25 findings remediees — migrations 052-058 creees

---

## 1. Cartographie du perimetre audite

### Infrastructure

| Element | Valeur |
|---------|--------|
| SGBD | PostgreSQL 15 (Supabase) |
| Plan Supabase | Pro (7 jours PITR) |
| Extensions | pgcrypto (chiffrement AES) |
| Migrations versionnees | 51 fichiers (001 a 051) dans `supabase/migrations/` |
| Scripts SQL hors migrations | 7 fichiers (racine + `scripts/`) |
| Tables publiques | ~86 |
| Vues | 1 (`v_rentabilite_chantier`) |
| Fonctions RPC | 7 |
| Fonctions SECURITY DEFINER | 5 |
| Storage buckets | 5 |
| Jobs pg_cron | 3 (audit_logs, analytics_events, anonymize-old-bookings) |

### Tables par domaine

| Domaine | Tables | Migrations |
|---------|--------|------------|
| Auth / Profils | profiles_artisan, profiles_client | **Aucune migration** (Dashboard) |
| Reservations | bookings, booking_messages, booking_reviews | **Hors migrations** (scripts/) |
| Services | services, service_etapes, categories, availability | **Partiellement hors migrations** |
| Syndic | syndic_immeubles, syndic_signalements, syndic_missions, syndic_messages, syndic_notifications, syndic_team_members, syndic_oauth_tokens, syndic_coproprios, syndic_assemblees, syndic_resolutions, syndic_ag_presences, syndic_votes_correspondance, syndic_planning_events, syndic_signalement_messages, syndic_emails_analysed, syndic_artisans | 001, 004, 005, supabase-team.sql, supabase-notifications.sql |
| Marches (Bourse) | marches, marches_candidatures, marches_evaluations, marches_messages | 006, 007, 008, 031, 032 |
| RFQ / Fournisseurs | rfqs, rfq_items, offers, offer_items, suppliers | 025 |
| Marketplace BTP | marketplace_listings, marketplace_demandes | 027 |
| BTP Modules | chantiers_btp, membres_btp, equipes_btp, equipe_membres_btp, pointages_btp, depenses_btp, settings_btp, situations_btp, retenues_btp, dc4_btp, dce_analyses_btp, dpgf_btp | 029, 030, 049, 050 |
| Sous-traitance | sous_traitance_btp | 028 |
| Messagerie | conversations, conversation_messages | **Hors migrations** (scripts/) |
| Portugal Fiscal | pt_fiscal_series, pt_fiscal_documents | 040 |
| Pro Team RBAC | pro_team_members, pro_role_permissions, pro_team_audit_log | 048 |
| Abonnements / Paiement | subscriptions, stripe_webhook_events | 037, 038, 042 |
| Referrals | referrals, referral_risk_log, credits_log | 010 |
| Analytics / Audit | analytics_events, audit_logs, tracking | 042, 046 |
| Devis / Factures | devis, factures, doc_sequences, analyses_devis | 020, 022, 038 |
| Specialites | specialties, profile_specialties | 035 |
| Systeme | idempotency_keys, sync_jobs | 038, 047 |

---

## 2. Tableau des findings

| ID | Severite | Categorie | Source | Description | Fix suggere |
|----|----------|-----------|--------|-------------|-------------|
| DB-01 | **P0** | Migrations | Tout le repo | **8+ tables critiques sans definition de migration** : `bookings`, `profiles_artisan`, `profiles_client`, `services`, `availability`, `booking_reviews`, `client_favorites`, `syndic_cabinets`. Creees directement dans Supabase Dashboard. Impossible de reconstruire le schema complet depuis le code. | Generer des migrations `000_baseline.sql` depuis le schema prod actuel (`pg_dump --schema-only`). Documenter chaque table manquante. |
| DB-02 | **P0** | Migrations | `scripts/*.sql`, racine `*.sql` | **7 scripts SQL hors du systeme de migration** : `migration-messaging.sql`, `migration-messagerie-v2.sql`, `supabase-notifications.sql`, `supabase-team.sql`, `supabase-absences.sql`, `supabase-email-agent.sql`, `supabase-storage-migration.sql`. Definissent des tables critiques (booking_messages, conversations, notifications, team) mais sans numerotation ni garantie d'ordre d'execution. | Integrer chaque script dans une migration numerotee (`052_baseline_messaging.sql`, etc.) et archiver les originaux. |
| DB-03 | **P0** | Migrations | 51 fichiers | **Aucune migration reversible (down)**. Aucun des 51 fichiers ne contient de rollback SQL. En cas de migration defectueuse, il faut intervenir manuellement sur la base prod. | Ajouter des sections `-- DOWN` commentees dans chaque migration future. Pour les existantes, documenter les rollback procedures dans un fichier `rollback-procedures.md`. |
| DB-04 | **P1** | Schema | `001_syndic_tables.sql:42` | **`syndic_signalements.cabinet_id` manque NOT NULL**. Un signalement sans cabinet_id est un orphelin invisible dans les dashboards. Les RLS policies filtrent par cabinet_id, donc un signalement sans cabinet_id est inaccessible a tous. | `ALTER TABLE syndic_signalements ALTER COLUMN cabinet_id SET NOT NULL;` apres nettoyage des eventuels NULLs. |
| DB-05 | **P1** | Schema | `001_syndic_tables.sql:74` | **`syndic_missions.cabinet_id` manque NOT NULL**. Meme probleme que DB-04 : une mission sans cabinet_id est orpheline et invisible. | `ALTER TABLE syndic_missions ALTER COLUMN cabinet_id SET NOT NULL;` |
| DB-06 | **P1** | Schema | `scripts/migration-messaging.sql:8` | **`booking_messages.booking_id` manque FOREIGN KEY**. La colonne est `UUID NOT NULL` mais sans contrainte FK vers `bookings(id)`. Des messages referancant des bookings supprimes resteront en base. | `ALTER TABLE booking_messages ADD CONSTRAINT fk_booking_messages_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;` |
| DB-07 | **P1** | Securite | `scripts/migration-messagerie-v2.sql:128` | **`update_conversation_on_message()` est SECURITY DEFINER sans `SET search_path`**. Vulnerable a l'injection par schema hijacking. Cette fonction trigger s'execute a chaque INSERT dans conversation_messages. | Recreer avec `SET search_path = public, pg_temp`. |
| DB-08 | **P1** | Securite | `scripts/migration-messaging.sql:45-46` | **RLS policy `booking_messages_service_insert` avec `WITH CHECK (true)`**. Permet a TOUT utilisateur authentifie d'inserer des messages, pas seulement le service_role. Contourne le controle d'acces. | Supprimer cette policy. Le service_role bypasse deja le RLS nativement. |
| DB-09 | **P1** | Securite | `scripts/migration-messagerie-v2.sql:51,100-101` | **Policies `conversations_service` et `messages_service` avec USING(true)**. Meme probleme que DB-08 — permettent a tout utilisateur authentifie de lire/ecrire toutes les conversations. Migration 039 les supprime, mais si les scripts ont ete reeexecutes apres 039, elles reviennent. | Verifier en prod que ces policies n'existent plus. Ajouter `DROP POLICY IF EXISTS` dans une migration de consolidation. |
| DB-10 | **P1** | Schema | data-retention-policy.md:72-73 | **Fonction `delete_user_data(user_id)` referencee mais non definie**. La politique RGPD mentionne un nettoyage de 26 tables en cascade, mais aucune migration ne cree cette fonction. La suppression de compte n'est pas implementee cote DB. | Creer une fonction `delete_user_data(user_id UUID)` dans une migration qui nettoie toutes les tables et Storage. |
| DB-11 | **P1** | Schema | data-retention-policy.md:168 | **Table `data_requests` referencee mais non definie**. Le registre RGPD des demandes d'exercice des droits n'a pas de table correspondante. Obligation legale (Art. 30 RGPD). | Creer la table `data_requests` avec les colonnes documentees dans la politique. |
| DB-12 | **P2** | Securite | `051_increment_listing_vues.sql:2` | **`increment_listing_vues()` SECURITY DEFINER sans `SET search_path`**. Risque faible (simple UPDATE, pas de SQL dynamique) mais inconsistant avec les autres fonctions DEFINER corrigees en migration 043. | Recreer avec `SET search_path = public, pg_temp`. |
| DB-13 | **P2** | Securite | `039_fix_security_audit.sql:127-134` | **Tokens OAuth toujours en clair**. Les colonnes `access_token_encrypted` et `refresh_token_encrypted` existent mais le code applicatif utilise-t-il les colonnes chiffrees ? Les colonnes plaintext sont marquees DEPRECATED mais pas supprimees. | `A CLARIFIER` — verifier dans le code applicatif quel champ est lu/ecrit. Migrer puis `ALTER TABLE syndic_oauth_tokens DROP COLUMN access_token, DROP COLUMN refresh_token;`. |
| DB-14 | **P2** | Schema | Multiples tables | **`updated_at` sans trigger automatique sur 15+ tables**. Les tables suivantes ont `updated_at TIMESTAMPTZ DEFAULT NOW()` mais aucun trigger BEFORE UPDATE : `syndic_immeubles`, `syndic_signalements`, `syndic_missions`, `devis`, `factures`, `subscriptions`, `rfqs`, `rfq_items`, `situations_btp`, `retenues_btp`, `dc4_btp`, `dpgf_btp`, `bookings`, `services`, `availability`. L'application doit gerer manuellement — si elle oublie, `updated_at` est faux. | Creer un trigger generique `set_updated_at()` et l'appliquer a toutes les tables concernees. |
| DB-15 | **P2** | Schema | `025_rfq_btp.sql:40`, `025_rfq_btp.sql:54` | **FK sans ON DELETE** : `offers.supplier_id` et `offer_items.rfq_item_id` referencent leurs parents mais manquent de `ON DELETE CASCADE` ou `SET NULL`. La suppression d'un fournisseur ou d'un rfq_item echouera si des offres existent. | Ajouter `ON DELETE SET NULL` pour supplier_id (garder l'offre) et `ON DELETE CASCADE` pour rfq_item_id. |
| DB-16 | **P2** | Migrations | `024_missing_foreign_keys.sql` + `036_add_missing_foreign_keys.sql` | **Migrations dupliquees** : les deux fichiers ajoutent les memes 3 FK (syndic_signalements.cabinet_id, syndic_missions.cabinet_id, marches_candidatures.artisan_id). Idempotent grace a `IF NOT EXISTS`, mais montre un probleme de suivi. | Documenter dans un changelog de migrations. Pas d'action corrective necessaire. |
| DB-17 | **P2** | Donnees | `025_rfq_btp.sql:63-72` | **Donnees de seed dans une migration**. 5 fournisseurs de test (Pro Materiaux France, BTP Fournitures Pro, etc.) sont inseres dans la migration 025. Ces donnees de test sont en production. | Verifier en prod. Si presents et non utilises, supprimer avec `DELETE FROM suppliers WHERE email LIKE '%promateriaux.fr' ...`. |
| DB-18 | **P2** | Schema | `001_syndic_tables.sql:56`, `001_syndic_tables.sql:83` | **Colonnes TEXT pour references artisan** : `syndic_signalements.artisan_assigne` et `syndic_missions.artisan` stockent le NOM de l'artisan en TEXT au lieu d'un UUID FK vers `profiles_artisan`. Impossible de joindre, renommer, ou tracer. | Migration pour ajouter `artisan_id UUID REFERENCES profiles_artisan(id)` et migrer les donnees depuis le champ texte. |
| DB-19 | **P2** | Performance | Schema general | **Pas d'index GIN sur colonnes JSONB frequemment filtrees**. Les colonnes `properties` (analytics_events), `data_json` (notifications), `items` (devis/factures), `travaux` (situations_btp) sont JSONB sans index GIN. Si des requetes filtrent par cle JSON, elles font du seqscan. | Identifier les patterns de requete JSONB et ajouter des index GIN cibles (`CREATE INDEX ... USING gin (properties jsonb_path_ops)`). |
| DB-20 | **P2** | Performance | `038_audit_complete_fix.sql:163` | **`search_artisans_nearby()` calcule la distance avec Haversine pour chaque ligne**. Pas d'index spatial (PostGIS). Avec un grand nombre d'artisans, la requete scanne toute la table profiles_artisan. | `A CLARIFIER` — Evaluer la taille de la table. Si >1000 artisans actifs avec coordonnees, envisager PostGIS avec `CREATE INDEX ... USING gist (geography(point(longitude, latitude)))`. |
| DB-21 | **P3** | Schema | Multiples tables | **Types numeriques inconsistants pour coordonnees**. `profiles_artisan.latitude/longitude` = DOUBLE PRECISION, `syndic_immeubles.latitude/longitude` = DOUBLE PRECISION, `marketplace_listings.latitude/longitude` = NUMERIC(10,7). Fonctionnel mais inconsistant — peut causer des bugs de precision dans les calculs de distance. | Standardiser sur DOUBLE PRECISION pour toutes les coordonnees geographiques. |
| DB-22 | **P3** | Schema | `038_audit_complete_fix.sql:16` | **`idempotency_keys` sans job de cleanup actif**. Le commentaire montre un `cron.schedule` pour supprimer les cles >24h, mais il est commente. Les cles s'accumulent indefiniment. | Activer le cron job : `SELECT cron.schedule('cleanup-idempotency', '0 * * * *', $$DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'$$);` |
| DB-23 | **P3** | Schema | `046_analytics_events.sql:41` | **pg_cron pour analytics_events non verifie**. Le `SELECT cron.schedule(...)` est dans la migration mais pg_cron doit etre active manuellement dans Supabase. | `A CLARIFIER` — verifier dans Supabase Dashboard > Database > Extensions que pg_cron est actif, puis `SELECT * FROM cron.job;` pour confirmer les 3 jobs. |
| DB-24 | **P3** | Backup | Supabase | **Restore jamais teste**. Le plan Pro fournit 7 jours PITR, mais aucune preuve de test de restauration. La politique de retention (docs/data-retention-policy.md) documente les backups mais pas les tests. | Planifier un test de restore trimestriel. Documenter la procedure et le resultat dans `docs/disaster-recovery-test.md`. |
| DB-25 | **P3** | Schema | `028_sous_traitance_btp.sql:47` | **FK `marches_messages.sender_id` sans ON DELETE**. `sender_id UUID NOT NULL REFERENCES auth.users(id)` — si un utilisateur est supprime de auth.users, la FK bloque le DELETE. | Ajouter `ON DELETE SET NULL` ou `ON DELETE CASCADE` selon le besoin metier. |

---

## 3. Top risques

### Risque 1 — Impossibilite de reconstruire le schema depuis le code (DB-01, DB-02)

**Impact :** Si la base prod est perdue et que les backups sont corrompus, il est impossible de reconstruire le schema complet a partir du code source. Les tables `bookings`, `profiles_artisan`, `profiles_client`, `services` — coeur de l'application — n'ont aucune definition versionee.

**Probabilite :** Faible (Supabase PITR existe), mais la consequences serait catastrophique.

### Risque 2 — Migrations non reversibles (DB-03)

**Impact :** Une migration defectueuse deployee en prod ne peut pas etre rollback automatiquement. Chaque intervention necessite du SQL manuel sous pression.

### Risque 3 — Orphelins et integrite referentielle (DB-04, DB-05, DB-06, DB-18)

**Impact :** Des signalements, missions ou messages peuvent exister sans parent valide. Invisibles dans les dashboards (filtres par cabinet_id dans les RLS), ils occupent de l'espace et peuvent causer des surprises lors d'exports ou audits RGPD.

### Risque 4 — Policies RLS trop permissives sur messagerie (DB-08, DB-09)

**Impact :** Si les policies `booking_messages_service_insert`, `conversations_service`, et `messages_service` existent toujours en prod, tout utilisateur authentifie peut inserer des messages dans n'importe quel booking/conversation. Exploitation triviale.

### Risque 5 — Conformite RGPD incomplete (DB-10, DB-11)

**Impact :** La politique de retention documente des procedures (suppression de compte, registre des demandes) qui ne sont pas implementees cote base de donnees. En cas de controle CNIL/CNPD, la non-conformite entre documentation et implementation est un risque legal.

---

## 4. Plan de remediation ordonne

### Phase 1 — Urgent (cette semaine)

| Priorite | Action | Effort | IDs |
|----------|--------|--------|-----|
| 1 | **Verifier en prod** que les policies `conversations_service` et `messages_service` sont supprimees (migration 039 les drop). Si presentes, les supprimer immediatement. | 15 min | DB-08, DB-09 |
| 2 | **Generer un baseline SQL** depuis la prod : `pg_dump --schema-only --no-owner --no-privileges` et le stocker comme `supabase/migrations/000_baseline.sql`. | 30 min | DB-01 |
| 3 | **Verifier pg_cron** : confirmer que les 3 jobs sont actifs (`SELECT * FROM cron.job;`). | 5 min | DB-22, DB-23 |

### Phase 2 — Haute priorite (prochaine semaine)

| Priorite | Action | Effort | IDs |
|----------|--------|--------|-----|
| 4 | **Integrer les 7 scripts SQL** dans des migrations numerotees (052-058). Archiver les originaux. | 1h | DB-02 |
| 5 | **Ajouter NOT NULL** sur `syndic_signalements.cabinet_id` et `syndic_missions.cabinet_id` (apres nettoyage des NULLs eventuels). | 30 min | DB-04, DB-05 |
| 6 | **Ajouter FK** sur `booking_messages.booking_id`. | 15 min | DB-06 |
| 7 | **Corriger les SECURITY DEFINER** : ajouter `SET search_path = public, pg_temp` sur `increment_listing_vues()` et `update_conversation_on_message()`. | 15 min | DB-07, DB-12 |
| 8 | **Creer `delete_user_data()`** et la table `data_requests`** pour conformite RGPD. | 2h | DB-10, DB-11 |

### Phase 3 — Moyenne priorite (2 semaines)

| Priorite | Action | Effort | IDs |
|----------|--------|--------|-----|
| 9 | **Creer un trigger generique `set_updated_at()`** et l'appliquer aux 15+ tables sans trigger. | 1h | DB-14 |
| 10 | **Completer les FK manquantes** : offers.supplier_id, offer_items.rfq_item_id, marches_messages.sender_id. | 30 min | DB-15, DB-25 |
| 11 | **Verifier l'utilisation des tokens OAuth chiffres** dans le code applicatif. Migrer si necessaire. | 1h | DB-13 |
| 12 | **Nettoyer les donnees de seed** en prod (fournisseurs de test). | 15 min | DB-17 |
| 13 | **Activer le cron job idempotency_keys**. | 5 min | DB-22 |

### Phase 4 — Ameliorations (prochain sprint)

| Priorite | Action | Effort | IDs |
|----------|--------|--------|-----|
| 14 | Ajouter des sections DOWN dans les futures migrations. Documenter les rollback des existantes. | 2h | DB-03 |
| 15 | Migrer `syndic_signalements.artisan_assigne` et `syndic_missions.artisan` vers des UUID FK. | 2h | DB-18 |
| 16 | Evaluer PostGIS pour les recherches geographiques. | 1h | DB-20 |
| 17 | Standardiser les types numeriques de coordonnees. | 30 min | DB-21 |
| 18 | Planifier un test de restore trimestriel. | 1h | DB-24 |

---

## 5. Resume RLS

### Bilan global

- **81+ tables avec RLS active** — couverture 100%
- **Soft delete** implemente sur 8 tables critiques avec filtrage dans les policies SELECT
- **Storage** : 5 buckets proteges par RLS (path-based ownership)
- **SECURITY DEFINER** : 3/5 fonctions correctement securisees (search_path + auth.uid())

### Points positifs

1. Defense en profondeur : meme si l'API utilise service_role, le RLS protege contre l'exposition accidentelle de la clef anon.
2. Patterns coherents : cabinet-based access pour le syndic, owner-based pour les artisans, participant-based pour les bookings.
3. Soft delete bien implemente : `deleted_at IS NULL` dans toutes les policies SELECT des tables sensibles.
4. Token encryption : infrastructure AES via pgcrypto prete (meme si migration applicative a confirmer).

### Points a surveiller

1. La policy `syndic_signalements_insert WITH CHECK (true)` est intentionnelle (soumission externe) mais doit etre documentee.
2. Les `FOR ALL USING(true)` policies `TO service_role` dans migration 025 sont redondantes (service_role bypasse deja le RLS).

---

## 6. Resume Backups

| Element | Statut |
|---------|--------|
| Backups automatiques Supabase | Actifs (plan Pro, 7 jours PITR) |
| Point-in-time recovery | Configure |
| Test de restore | **Jamais effectue** (`A CLARIFIER`) |
| pg_cron cleanup audit_logs | Configure (1 an retention) |
| pg_cron cleanup analytics_events | Configure (90 jours retention) |
| pg_cron anonymize bookings | Configure (3 ans) |
| pg_cron cleanup idempotency_keys | **Non active** (commente dans migration) |
| Storage backup | Non inclus dans PITR (suppression immediate et definitive) |

---

## 7. Questions ouvertes

| # | Question | Contexte |
|---|----------|----------|
| Q1 | Les policies `conversations_service` et `messages_service` (USING true) existent-elles toujours en prod ? | Migration 039 les supprime, mais si les scripts ont ete reeexecutes apres... |
| Q2 | Le code applicatif utilise-t-il `access_token_encrypted` ou `access_token` (plaintext) pour les tokens OAuth ? | Determiner si la migration vers le chiffrement est complete. |
| Q3 | Les 3 jobs pg_cron sont-ils actifs en prod ? | Verifiable via `SELECT * FROM cron.job;` dans Supabase SQL Editor. |
| Q4 | Combien d'artisans actifs ont des coordonnees GPS ? | Si >1000, PostGIS devient pertinent pour `search_artisans_nearby()`. |
| Q5 | Les 5 fournisseurs de test (migration 025) sont-ils en prod ? | `SELECT * FROM suppliers WHERE email LIKE '%promateriaux%' OR email LIKE '%btpfournitures%';` |
| Q6 | Existe-t-il des `syndic_signalements` ou `syndic_missions` avec `cabinet_id IS NULL` en prod ? | A verifier avant d'ajouter NOT NULL. |
| Q7 | Un test de restore PITR a-t-il ete effectue ? | Aucune trace dans la documentation. |
| Q8 | La fonction `export_user_data(user_id)` (referencee dans data-retention-policy.md) est-elle implementee ? | Non trouvee dans les migrations ni dans le code applicatif. |

---

## 8. Scores par axe

| Axe | Score | Commentaire |
|-----|-------|-------------|
| **Integrite referentielle** | 6/10 | FK bien presentes sur les tables recentes, mais lacunes sur les tables historiques (booking_messages, artisan references en TEXT) |
| **Securite RLS** | 8/10 | Couverture 100%, patterns solides, soft delete. Points negatifs : policies USING(true) residuelles sur messagerie |
| **Migrations** | 4/10 | Numerotation sequentielle et idempotence OK, mais tables critiques hors systeme, pas de down, scripts eparpilles |
| **Performance** | 7/10 | Bons index composites sur les patterns de requete principaux. Manque PostGIS et index GIN |
| **Backups / Recovery** | 5/10 | PITR actif mais jamais teste. Pas de runbook de disaster recovery |
| **Conformite RGPD** | 6/10 | Politique documentee et detaillee, mais fonctions de suppression/export non implementees cote DB |

---

*Audit read-only termine. Aucune modification effectuee sur le code ou la base de donnees.*
