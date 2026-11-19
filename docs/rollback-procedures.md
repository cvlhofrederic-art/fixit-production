# Procedures de Rollback — Migrations SQL

Chaque migration est idempotente (IF NOT EXISTS / IF EXISTS) et peut etre re-executee sans risque.
En cas de probleme, voici les procedures de rollback manuelles pour chaque migration.

---

## Principes generaux

1. **Toujours faire un snapshot** avant d'appliquer une migration en prod :
   - Supabase Dashboard > Database > Backups > Create backup
   - Ou noter l'heure exacte pour utiliser le PITR

2. **Tester sur un projet Supabase de staging** avant la prod.

3. **Les rollbacks des migrations de creation de table** ne sont necessaires que si la table cause des problemes. Les `CREATE TABLE IF NOT EXISTS` ne modifient pas les tables existantes.

---

## Migration 052 — Baseline tables manquantes

```sql
-- Rollback : ne PAS executer sauf si les tables ont ete creees par erreur
-- en plus des tables existantes. Ces tables existent deja en prod.
-- Rien a rollback — migration purement documentaire.
```

## Migration 053 — Consolidation messagerie

```sql
-- Rollback : restaurer les policies supprimees
-- ATTENTION: ceci ROUVRE les failles de securite DB-08/DB-09

-- Restaurer policy booking_messages_service_insert
CREATE POLICY "booking_messages_service_insert" ON booking_messages
  FOR INSERT WITH CHECK (true);

-- Restaurer policies conversations_service et messages_service
CREATE POLICY "conversations_service" ON conversations
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "messages_service" ON conversation_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Rollback trigger (restaurer sans search_path)
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Rollback FK booking_messages
ALTER TABLE booking_messages DROP CONSTRAINT IF EXISTS fk_booking_messages_booking;
```

## Migration 055 — Integrite referentielle

```sql
-- Rollback NOT NULL
ALTER TABLE syndic_signalements ALTER COLUMN cabinet_id DROP NOT NULL;
ALTER TABLE syndic_missions ALTER COLUMN cabinet_id DROP NOT NULL;

-- Rollback FK
ALTER TABLE offers DROP CONSTRAINT IF EXISTS fk_offers_supplier;
ALTER TABLE offer_items DROP CONSTRAINT IF EXISTS fk_offer_items_rfq_item;

-- Rollback colonnes artisan UUID
ALTER TABLE syndic_signalements DROP COLUMN IF EXISTS artisan_assigne_id;
ALTER TABLE syndic_missions DROP COLUMN IF EXISTS artisan_id;

-- Rollback increment_listing_vues (retour sans search_path)
CREATE OR REPLACE FUNCTION increment_listing_vues(listing_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE marketplace_listings SET vues = COALESCE(vues, 0) + 1 WHERE id = listing_id;
$$;
```

## Migration 056 — Triggers updated_at

```sql
-- Rollback : supprimer tous les triggers
DROP TRIGGER IF EXISTS trg_syndic_immeubles_updated_at ON syndic_immeubles;
DROP TRIGGER IF EXISTS trg_syndic_signalements_updated_at ON syndic_signalements;
DROP TRIGGER IF EXISTS trg_syndic_missions_updated_at ON syndic_missions;
DROP TRIGGER IF EXISTS trg_devis_updated_at ON devis;
DROP TRIGGER IF EXISTS trg_factures_updated_at ON factures;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS trg_rfqs_updated_at ON rfqs;
DROP TRIGGER IF EXISTS trg_situations_btp_updated_at ON situations_btp;
DROP TRIGGER IF EXISTS trg_retenues_btp_updated_at ON retenues_btp;
DROP TRIGGER IF EXISTS trg_dc4_btp_updated_at ON dc4_btp;
DROP TRIGGER IF EXISTS trg_dpgf_btp_updated_at ON dpgf_btp;
DROP TRIGGER IF EXISTS trg_profiles_artisan_updated_at ON profiles_artisan;
DROP TRIGGER IF EXISTS trg_profiles_client_updated_at ON profiles_client;
DROP TRIGGER IF EXISTS trg_syndic_cabinets_updated_at ON syndic_cabinets;
DROP TRIGGER IF EXISTS trg_syndic_oauth_updated_at ON syndic_oauth_tokens;
DROP FUNCTION IF EXISTS set_updated_at();
```

## Migration 057 — RGPD

```sql
-- Rollback
DROP FUNCTION IF EXISTS export_user_data(UUID);
DROP FUNCTION IF EXISTS delete_user_data(UUID);
DROP TABLE IF EXISTS data_requests;
```

## Migration 058 — Cron cleanup

```sql
-- Rollback
SELECT cron.unschedule('cleanup-idempotency');
```

## Migration 20261114 — Équipe syndic : écritures réservées au serveur (T20)

Recrée les trois policies d'écriture de la production telles que constatées le 14/11/2026 et rend aux rôles
`anon` et `authenticated` les droits retirés. À n'employer que si une écriture légitime depuis le navigateur était
découverte (aucune au 14/11/2026 : le code passe par les routes serveur en service role). Sur un projet de test
construit depuis le dépôt, les policies portaient les noms du dépôt (`syndic_team_members_cabinet_full_access`,
`syndic_team_cabinet_write`) : les recréer d'après `20260527_syndic_team_members.sql` et `041_rls_complete_audit.sql`.
Après le retour arrière, relancer la partie 1 de `supabase/tests/syndic_equipe_ecritures_serveur.sql`.

```sql
-- Rollback (production)
CREATE POLICY "syndic_team_insert" ON public.syndic_team_members FOR INSERT WITH CHECK (cabinet_id = auth.uid());
CREATE POLICY "syndic_team_update" ON public.syndic_team_members FOR UPDATE USING (cabinet_id = auth.uid());
CREATE POLICY "syndic_team_delete" ON public.syndic_team_members FOR DELETE USING (cabinet_id = auth.uid());
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.syndic_team_members TO anon, authenticated;
```

---

## Migration 20261115 — Équipe BTP : écritures réservées au serveur (suite de R36)

Recrée les trois policies d'écriture de `pro_team_members` (mêmes noms en production, constatés le 14/11/2026, et dans
`048_pro_team_rbac.sql` ; forme de `20260610_rls_initplan_wrap.sql`, où `(select auth.uid())` équivaut à `auth.uid()`)
et rend aux rôles `anon` et `authenticated` les droits retirés. ATTENTION : ceci ROUVRE la faille R36 (lignes d'équipe
posées pour le compte d'un autre, rôle d'une invitation réécrit hors de l'application). À n'employer que si une
écriture légitime depuis le navigateur était découverte (aucune au 14/11/2026 : le code passe par les routes serveur en
service role). Après le retour arrière, relancer la partie 1 de `supabase/tests/pro_equipe_ecritures_serveur.sql`.

```sql
-- Rollback (production et projet construit depuis le dépôt)
CREATE POLICY "pro_team_insert" ON public.pro_team_members FOR INSERT WITH CHECK (company_id = (select auth.uid()));
CREATE POLICY "pro_team_update" ON public.pro_team_members FOR UPDATE USING (company_id = (select auth.uid()));
CREATE POLICY "pro_team_delete" ON public.pro_team_members FOR DELETE USING (company_id = (select auth.uid()));
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.pro_team_members TO anon, authenticated;
```

---

## Migration 20261116 — Pointage BTP : employés affectés aux chantiers

Retire l'index « un pointage en cours par employé », la table `pointage_reglages_btp` puis la colonne
`chantiers_btp.membres_ids`. ATTENTION : retirer la colonne EFFACE les affectations individuelles enregistrées depuis
(les équipes, `equipes_btp.chantier_id`, restent) ; retirer la table efface l'activation du pointage automatique et la
trace de la confirmation des gérants (date, auteur), et coupe le mode automatique partout. Le code continue de marcher
sans elles : l'écran Pointage n'affecte plus que des équipes, le pointage se fait à la main, et il le signale ;
`/api/btp` enregistre les chantiers sans leurs employés. Aucun pointage n'est touché.

```sql
-- Rollback
DROP INDEX IF EXISTS public.pointages_btp_un_ouvert_par_membre;
DROP TABLE IF EXISTS public.pointage_reglages_btp;
ALTER TABLE public.chantiers_btp DROP COLUMN IF EXISTS membres_ids;
```

---

## Migration 20261117 — Pointage BTP en arrière-plan

Retire les tables `pointage_lignes_appareil_btp` (pointages écrits par un téléphone), `pointage_evenements_btp`
(journal des envois) et `pointage_appareils_btp` (téléphones qui pointent en arrière-plan, appli Vitfix Pro).
ATTENTION : cela coupe le pointage téléphone en poche de tous les employés. Leurs téléphones continuent d'envoyer leurs
arrivées et départs, que `/api/btp/pointage/evenement` ignore (réponse 200, file du téléphone vidée) ; l'onglet Pointer
de l'appli indique que la base de données doit être mise à jour, et chaque téléphone y retire ses zones à l'ouverture.
Le pointage page ouverte et le pointage à la main continuent. Les pointages déjà écrits par les téléphones restent
dans `pointages_btp` (mode automatique), comme les autres : aucun pointage n'est touché.

```sql
-- Rollback
DROP TABLE IF EXISTS public.pointage_lignes_appareil_btp;
DROP TABLE IF EXISTS public.pointage_evenements_btp;
DROP TABLE IF EXISTS public.pointage_appareils_btp;
```

---

## Migration 20261119 — AJ Signalement : bureaux des cabinets

Script complet, relu et exécuté dans les tests (PGlite) : `supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql`
(hors de `supabase/migrations` : jamais appliqué par la chaîne). Il retire les triggers et les deux fonctions des bureaux,
remet `signalements_qr_inviter_gestionnaire` dans son texte de la 20261112 (même signature, mêmes droits), retire les
clés étrangères, le contrôle et les colonnes `bureau_id` (fiche gestionnaire, copropriété), puis la table
`signalements_qr_bureaux`. ATTENTION : les bureaux et les rattachements sont perdus ; les lignes du journal restent
(actions existantes). Relever avant, en nombres seulement : bureaux, fiches rattachées, copropriétés rattachées (requête en
tête du script). Le code de la PR se replie sans ces objets (listes sans bureau, actions sur les bureaux 503).

---

## Procedure de restore complete (PITR)

En cas de probleme majeur :

1. Aller dans Supabase Dashboard > Database > Backups
2. Selectionner "Point in time recovery"
3. Choisir un timestamp AVANT l'execution de la migration problematique
4. Confirmer la restauration
5. Verifier que l'application fonctionne
6. Re-appliquer les migrations qui etaient correctes

**Temps de restore estime :** 5-15 minutes selon la taille de la base.
