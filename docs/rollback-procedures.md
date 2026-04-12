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
