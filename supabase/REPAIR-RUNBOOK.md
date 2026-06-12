# REPAIR-RUNBOOK — Réconciliation registre migrations ↔ prod (irluhepekbqgquveaett)

> **Contexte** (audit Phase 2/9 Data Layer, 2026-06-12) : le registre
> `supabase_migrations.schema_migrations` est arrêté à `20260513_alfredo_drafts`
> (84 entrées) alors que le repo compte 133 fichiers. 47 migrations ont été
> appliquées **à la main** hors registre ; 5 migrations enregistrées ont vu leurs
> objets **DROPpés à la main** (025, 028, 040, 046, 20260412) ; 4 migrations
> n'ont **jamais** été appliquées (084 + les 3 Léa 20260521).
>
> **Rien dans ce runbook ne s'exécute automatiquement.** Chaque étape est à
> dérouler manuellement, dans l'ordre, après validation humaine. Prévoir une
> fenêtre calme (pas de deploy en parallèle).

---

## Pourquoi les fichiers ont été renommés (déjà fait sur la branche)

Comportement vérifié dans le **code source de la CLI Supabase** (v2.x,
`pkg/migration/`) :

1. **Pattern de fichier** : `^([0-9]+)_(.*)\.sql$`. La *version* = les chiffres
   de tête. Un fichier `013b_service_etapes.sql` ou `20260612a_x.sql` **ne
   matche pas** → silencieusement ignoré par `db push` / `migration list`.
2. **Registre** : `schema_migrations (version text NOT NULL PRIMARY KEY)`. Deux
   fichiers avec la même version (les dix `20260602_*.sql`, les cinq
   `20260521_*.sql`…) **ne peuvent pas coexister** dans le registre, et
   l'INSERT de push n'a pas de `ON CONFLICT` → échec garanti.
3. **Alignement d'ordre** (`FindPendingMigrations`, two-pointer) : l'ordre
   lexicographique des **noms de fichiers** doit coïncider avec l'ordre
   lexicographique des **versions**. C'est ce qui disqualifie `0501` (proposé
   initialement) : `"0501_x.sql" < "050_y.sql"` en ordre fichier (`'1' <
   '_'`) mais `"050" < "0501"` en ordre version → `ErrMissingLocal` à chaque
   push. Idem `05001`. **Aucune version « insérée » par préfixe n'est possible** ;
   il faut des versions de même longueur, libres, hors préfixe d'une autre.

D'où les renommages (versions uniques, format CLI, ordre stable) :

| Ancien nom | Nouveau nom (version) |
|---|---|
| `013b_service_etapes.sql` | `015_service_etapes.sql` |
| `050_fix_artisan_photos_rls.sql` | `088_fix_artisan_photos_rls.sql` |
| `061_seed_ref_taux.sql` | `089_seed_ref_taux.sql` |
| `20260521_agent_conversations_tempo.sql` | `20260521000001_…` |
| `20260521_lea_documents.sql` | `20260521000002_…` |
| `20260521_lea_documents_hybrid_search.sql` | `20260521000003_…` |
| `20260521_lea_pdf_templates.sql` | `20260521000004_…` |
| `20260521_max_v11_toc_filter.sql` | `20260521000005_…` |
| `20260602_*.sql` (10 fichiers) | `20260602000001…10_…` (ordre alphabétique conservé) |
| `20260603_*.sql` (7) | `20260603000001…07_…` |
| `20260605_*.sql` (6) | `20260605000001…06_…` |
| `20260608_*.sql` (3) | `20260608000001…03_…` |
| `20260610_*.sql` (3) | `20260610000001…03_…` |

Les nouvelles migrations de l'audit suivent le même schéma :
`20260612000001` → `20260612000007` (les noms `20260612a…g` initialement
envisagés auraient été **ignorés** par la CLI, cf. point 1).

`015`, `088`, `089` : numéros 3 chiffres libres (014→020 et >087 inoccupés),
même longueur que leurs voisins → ordre fichier ≡ ordre version. La position
chronologique exacte n'a pas d'importance fonctionnelle (objets indépendants),
seule la **cohérence registre ↔ fichiers** compte.

---

## Étape 0 — Backups / PITR (OBLIGATOIRE AVANT TOUT)

1. Dashboard → `https://supabase.com/dashboard/project/irluhepekbqgquveaett/database/backups`
   - Vérifier qu'un backup **daté d'aujourd'hui** existe (ou déclencher un
     backup manuel si le plan le permet).
   - Si PITR actif : noter l'heure exacte de début d'intervention
     (`date -u +"%Y-%m-%dT%H:%M:%SZ"`) — c'est le point de restauration.
2. Sauvegarder le registre actuel (filet de sécurité, rollback étape 3/4) :

```sql
-- À exécuter dans le SQL Editor, sauvegarder le résultat en CSV
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

3. **GO/NO-GO** : sans backup vérifiable → STOP.

## Étape 1 — `supabase init` + `link`

```bash
cd /Users/elgato_fofo/Desktop/fixit-production
supabase init            # crée supabase/config.toml — répondre « n » aux prompts IDE
supabase link --project-ref irluhepekbqgquveaett
# Mot de passe DB : Dashboard > Settings > Database. Exportable pour la session :
# export SUPABASE_DB_PASSWORD='…'   (jamais en clair dans un fichier — règle wrangler secret)
supabase migration list  # état des lieux : doit montrer le drift décrit ci-dessus
```

`supabase init` ne touche pas `supabase/migrations/`. Si un prompt propose
d'écraser un fichier existant → refuser et examiner.

## Étape 2 — Vérifications PRÉ-repair (SQL Editor, lecture seule)

### 2a. Pré-requis des nouvelles contraintes (doivent TOUTES renvoyer 0)

```sql
-- INT-02 : orphelins devis/factures → profiles_artisan
SELECT count(*) FROM devis d    LEFT JOIN profiles_artisan p ON p.id = d.artisan_id WHERE p.id IS NULL;
SELECT count(*) FROM factures f LEFT JOIN profiles_artisan p ON p.id = f.artisan_id WHERE p.id IS NULL;
-- C-04 : NULL sur artisan_user_id
SELECT count(*) FROM devis WHERE artisan_user_id IS NULL;
SELECT count(*) FROM factures WHERE artisan_user_id IS NULL;
-- CHECK montants : violations existantes
SELECT count(*) FROM devis WHERE total_ht_cents < 0 OR total_tax_cents < 0 OR total_ttc_cents < 0;
SELECT count(*) FROM factures WHERE avoir_de_facture_id IS NULL
  AND (total_ht_cents < 0 OR total_tax_cents < 0 OR total_ttc_cents < 0);
-- INT-07 : filleuls en doublon
SELECT filleul_id, count(*) FROM referrals WHERE filleul_id IS NOT NULL
GROUP BY filleul_id HAVING count(*) > 1;
-- INT-08 : créneaux bookings en doublon
SELECT artisan_id, booking_date, booking_time, count(*) FROM bookings
WHERE status IS DISTINCT FROM 'cancelled' AND deleted_at IS NULL
  AND booking_date IS NOT NULL AND booking_time IS NOT NULL
GROUP BY 1, 2, 3 HAVING count(*) > 1;
```

> Un résultat non vide → corriger les données AVANT l'étape 5 (les migrations
> 20260612000001/3 échoueront proprement sinon).

### 2b. Les 5 index « doublons » sont bien des index simples (pas de contrainte)

```sql
SELECT i.indexrelid::regclass AS idx, c.conname
FROM pg_index i
LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid
WHERE i.indexrelid::regclass::text IN ('idx_idempotency_keys_key','idx_pro_team_token',
  'idx_team_token','idx_booking_reviews_booking','idx_sub_metrics_date');
-- Attendu : conname NULL partout. Sinon, retirer la ligne DROP correspondante
-- de 20260612000006 et traiter au cas par cas.
```

### 2c. Sondes « réellement appliquée ? » pour les versions à réparer en applied

L'audit a vérifié l'application manuelle des 47 migrations le 2026-06-12.
Re-sonder au moins les cas signalés douteux :

```sql
SELECT to_regclass('public.service_etapes')        AS m015,        -- 015
       to_regclass('public.syndic_legal_corpus_fr') AS m20260519,
       to_regclass('public.syndic_team_members')    AS m20260527,
       to_regclass('public.syndic_orcamentos')      AS m20260608000003,
       to_regprocedure('public.sync_user_role_to_app_metadata()') AS m20260429;
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN
  ('search_legal_corpus_hybrid_fr','search_legal_corpus_hybrid_pt');  -- 20260521000005
SELECT count(*) FROM ref_taux;                       -- 089 (seed) : > 0 attendu
SELECT conname FROM pg_constraint
WHERE conname IN ('devis_numero_artisan_user_unique','factures_numero_artisan_user_unique'); -- 087
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND policyname = 'artisan_photos_insert';                       -- 088
SELECT column_name FROM information_schema.columns
WHERE table_name = 'factures' AND column_name = 'avoir_de_facture_id';                       -- 20260514
```

> Toute sonde NULL/vide → la migration correspondante n'est PAS appliquée :
> la retirer de la liste « applied » de l'étape 3 et la laisser être appliquée
> par `db push` (vérifier d'abord son idempotence).

## Étape 3 — `migration repair --status applied` (47 versions hors registre)

```bash
supabase migration repair --status applied \
  015 087 088 089 \
  20260429 \
  20260514 20260515 20260516 20260517 20260518 20260519 20260520 \
  20260521000001 20260521000005 \
  20260522 20260523 20260527 \
  20260601 \
  20260602000001 20260602000002 20260602000003 20260602000004 20260602000005 \
  20260602000006 20260602000007 20260602000008 20260602000009 20260602000010 \
  20260603000001 20260603000002 20260603000003 20260603000004 20260603000005 \
  20260603000006 20260603000007 \
  20260605000001 20260605000002 20260605000003 20260605000004 20260605000005 \
  20260605000006 \
  20260608000001 20260608000002 20260608000003 \
  20260610000001 20260610000002 20260610000003
```

**Exclusions volontaires** (jamais appliquées → seront poussées à l'étape 5) :
`084`, `20260521000002`, `20260521000003`, `20260521000004`.

**Rollback étape 3** : `supabase migration repair --status reverted <versions…>`
(repair ne touche QUE le registre, jamais le schéma).

## Étape 4 — `migration repair --status reverted` (objets droppés à la main)

```bash
supabase migration repair --status reverted 025 028 040 046 20260412
```

Puis, **immédiatement** (sinon `db push --include-all` recréerait les objets
dormants pt_fiscal_* et background_jobs) :

```bash
git mv supabase/migrations/040_portugal_fiscal.sql    supabase/archive/
git mv supabase/migrations/20260412_background_jobs.sql supabase/archive/
```

**Ordre & logique** :
- `025`, `028`, `046` restent dans `migrations/` → elles seront **rejouées** par
  push (étape 5), recréant rfqs/offers/suppliers, btp_candidature_messages et
  analytics_events. Leur replay est sûr : les objets sont absents, et 046 a été
  rendue idempotente (garde pg_cron + DROP POLICY IF EXISTS) le 2026-06-12.
- `040` (pt_fiscal_* — lockdown 082, dormant volontaire) et `20260412`
  (background_jobs — lib/queue.ts non importé) sont **archivées** : registre ET
  schéma sont alors cohérents (« pas appliquée, pas de fichier »).
- `20260612000005` complète ensuite le replay de 025 (FK durcies de 055,
  policies réécrites initplan, seed gardé) — elle est idempotente dans les
  deux sens (replay ou non).

**Rollback étape 4** : `supabase migration repair --status applied 025 028 040
046 20260412` + `git mv` inverse des deux fichiers.

## Étape 5 — `db push` (replays + jamais-appliquées + 20260612*)

```bash
supabase db push --include-all --dry-run
```

Liste attendue (ordre exact — tout écart = STOP et analyse) :

```
025_rfq_btp.sql
028_sous_traitance_btp.sql
046_analytics_events.sql
084_factures_recues_pa.sql
20260521000002_lea_documents.sql
20260521000003_lea_documents_hybrid_search.sql
20260521000004_lea_pdf_templates.sql
20260612000001_integrite_facturation.sql
20260612000002_cascade_donnees_legales.sql
20260612000003_anti_doublons.sql
20260612000004_realtime_et_storage.sql
20260612000005_tables_droppees_restaurees.sql
20260612000006_hygiene_fonctions.sql
20260612000007_updated_at_triggers_completion.sql
```

Puis, si la liste est conforme :

```bash
supabase db push --include-all
```

`--include-all` est **requis** : 025/028/046/084/20260521* ont des versions
antérieures à la tête du registre (out-of-order) — sans le flag, push refuse
avec `ErrMissingRemote`.

### Revue d'idempotence effectuée le 2026-06-12 (avant ce push)

| Fichier | Verdict | Action |
|---|---|---|
| `084_factures_recues_pa.sql` | Idempotent (IF NOT EXISTS + DROP POLICY IF EXISTS partout) | aucune |
| `20260521000002_lea_documents.sql` | CREATE POLICY non gardés | **corrigé** : DROP POLICY IF EXISTS ajoutés (storage + table) |
| `20260521000003_…hybrid_search.sql` | CREATE OR REPLACE FUNCTION | aucune |
| `20260521000004_lea_pdf_templates.sql` | CREATE POLICY non gardés | **corrigé** : DROP POLICY IF EXISTS ajoutés |
| `046_analytics_events.sql` (replay) | `SELECT cron.schedule(...)` nu → échec si pg_cron absent ; CREATE POLICY non gardé | **corrigé** : garde `pg_extension`/WARNING (pattern 058) + DROP POLICY IF EXISTS |
| `025` / `028` (replay) | CREATE POLICY non gardés mais tables absentes en live → replay unique sûr | aucune (signalé) |

### Risques spécifiques de l'étape 5

- **20260521000002** : `embedding vector(1024)` + index HNSW → nécessite
  l'extension `vector` ≥ 0.8 (vérifiée présente par l'audit : pgvector 0.8,
  HNSW prêt). Sonde : `SELECT extversion FROM pg_extension WHERE extname='vector';`
- **20260521000002/4** : policies sur `storage.objects` → le rôle de migration
  doit être owner des policies storage (cas standard via CLI/postgres role).
  En cas d'erreur `must be owner of table objects`, appliquer la section
  storage de ces fichiers via le SQL Editor (dashboard, rôle postgres) puis
  `migration repair --status applied` la version.
- **20260612000001** : échec PROPRE (RAISE EXCEPTION) si des NULL/orphelins
  sont apparus depuis l'étape 2a → re-dérouler 2a, corriger, relancer push.
- **20260612000003** : échec du CREATE UNIQUE INDEX si doublons apparus depuis
  2a → même procédure.
- Chaque fichier est appliqué dans une transaction implicite unique (batch) :
  un échec n'enregistre PAS la version et n'applique rien de ce fichier ;
  les fichiers précédents restent appliqués (push s'arrête).

**Rollback étape 5** (du plus simple au plus lourd) :
1. Inverse SQL ciblé par migration (chacune documente ses objets) :
   - 20260612000001 : `ALTER TABLE … DROP CONSTRAINT devis_artisan_id_fkey /
     factures_artisan_id_fkey / devis_montants_non_negatifs /
     factures_montants_non_negatifs_sauf_avoir;` + `ALTER COLUMN artisan_user_id
     DROP NOT NULL;` + `DROP TRIGGER trg_devis_updated_at / trg_factures_updated_at …`
   - 20260612000002 : recréer les FK avec `ON DELETE CASCADE` (état antérieur).
   - 20260612000003 : `DROP INDEX uniq_referrals_filleul, uniq_bookings_artisan_slot;`
   - 20260612000004 : `ALTER PUBLICATION supabase_realtime DROP TABLE …;`
     (+ `DELETE FROM storage.buckets WHERE id='tracking'` si vide).
   - 20260612000005 : `DROP TABLE offer_items, offers, rfq_items, rfqs,
     suppliers, analytics_events;` (elles viennent d'être recréées vides).
   - 20260612000006 : recréer les 5 index droppés (définitions dans 037/048/052) ;
     les ALTER POLICY sont sans changement sémantique (pas de rollback utile).
   - 20260612000007 : `DROP TRIGGER trg_<table>_updated_at ON <table>;`
   Après chaque inverse : `supabase migration repair --status reverted <version>`.
2. PITR au timestamp noté à l'étape 0 (dernier recours — perd les écritures
   utilisateurs postérieures).

## Étape 6 — Vérifications POST-application

```sql
-- 6a. Objets restaurés / créés
SELECT to_regclass('public.factures_recues')          AS m084,
       to_regclass('public.syndic_documents')          AS lea_p1,
       to_regclass('public.syndic_pdf_templates')      AS lea_p4a,
       to_regclass('public.syndic_pdf_generated')      AS lea_p4b,
       to_regclass('public.rfqs')                      AS rfq1,
       to_regclass('public.offers')                    AS rfq2,
       to_regclass('public.suppliers')                 AS rfq3,
       to_regclass('public.analytics_events')          AS m046,
       to_regclass('public.btp_candidature_messages')  AS m028;
-- Tout NULL = problème.
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'search_syndic_documents_hybrid';  -- RPC Léa P3

-- 6b. Realtime
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('bookings','booking_messages','syndic_emails_analysed');
-- Attendu : 3 lignes.

-- 6c. Contraintes d'intégrité
SELECT conname, confdeltype FROM pg_constraint
WHERE conname IN ('devis_artisan_id_fkey','factures_artisan_id_fkey');     -- 'r' = RESTRICT
SELECT conname FROM pg_constraint
WHERE conname IN ('devis_montants_non_negatifs','factures_montants_non_negatifs_sauf_avoir');
SELECT c.conname, c.confdeltype
FROM pg_constraint c
WHERE c.confrelid = 'auth.users'::regclass AND c.contype = 'f'
  AND c.conrelid::regclass::text IN ('doc_sequences','situations_btp','retenues_btp',
                                     'dc4_btp','depenses_btp','pointages_btp');
-- Attendu : confdeltype = 'r' partout.
SELECT attnotnull FROM pg_attribute
WHERE attrelid IN ('devis'::regclass,'factures'::regclass) AND attname = 'artisan_user_id';
-- Attendu : true, true.

-- 6d. Index
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN
  ('uniq_referrals_filleul','uniq_bookings_artisan_slot','idx_artisans_catalogue_ville');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN
  ('idx_idempotency_keys_key','idx_pro_team_token','idx_team_token',
   'idx_booking_reviews_booking','idx_sub_metrics_date');   -- attendu : 0 ligne

-- 6e. Storage
SELECT id, public FROM storage.buckets
WHERE id IN ('tracking','syndic-documents','syndic-pdf-templates','syndic-pdf-generated');
-- Attendu : 4 lignes, public = false partout.
SELECT policyname FROM pg_policies WHERE schemaname='storage' AND policyname='auth_write_artisan_photos';
-- Attendu : 0 ligne (MIG-04).

-- 6f. Hygiène fonctions / triggers
SELECT proconfig FROM pg_proc WHERE oid = 'public.validate_facture_transition()'::regprocedure;
-- Attendu : {search_path=public}
SELECT pc.relname
FROM pg_class pc
JOIN pg_namespace n ON n.oid = pc.relnamespace AND n.nspname='public'
JOIN pg_attribute a ON a.attrelid = pc.oid AND a.attname='updated_at' AND a.attnum>0 AND NOT a.attisdropped
WHERE pc.relkind IN ('r','p')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = pc.oid
                  AND NOT tg.tgisinternal AND tg.tgname ~* 'updated_at');
-- Attendu : 0 ligne (C-03 soldé).

-- 6g. Registre propre
-- supabase migration list → plus aucun écart local/remote.
```

Smoke tests applicatifs : créer une RFQ test (RFQSection), POST
/api/analytics/track, vérifier qu'une notification booking arrive en Realtime.

## Étape 7 — Régénérer `lib/database.types.ts`

```bash
supabase gen types typescript --linked > lib/database.types.ts
git diff lib/database.types.ts   # relire : les tables restaurées doivent apparaître
```

(Le fichier existe déjà — untracked — sur la branche `fix/audit-p2-data-layer` ;
le régénérer APRÈS push pour intégrer rfqs/analytics_events/factures_recues/
syndic_documents/etc.)

---

## Récapitulatif des risques par étape

| Étape | Risque | Mitigation |
|---|---|---|
| 1 | `link` échoue (password) | Dashboard > Settings > Database ; `SUPABASE_DB_PASSWORD` |
| 3 | Une version « applied » ne l'est pas en réalité | sondes 2c ; retirer la version, laisser push l'appliquer |
| 4 | Oubli d'archiver 040/20260412 → push recrée des objets dormants | les 2 `git mv` sont DANS l'étape, avant push |
| 5 | Donnée non conforme apparue depuis l'audit | gardes RAISE EXCEPTION + re-passage 2a |
| 5 | Échec mi-parcours du push | atomicité par fichier ; reprendre au fichier en échec après correction |
| 6 | Écarts résiduels | inverse SQL ciblé, ou PITR (étape 0) en dernier recours |
| 7 | types générés divergents du code (`as any` existants) | hors scope ici — suivi Phase 2 TYP-* |
