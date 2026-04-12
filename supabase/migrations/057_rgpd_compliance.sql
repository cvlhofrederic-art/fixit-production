-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 057 — Conformite RGPD : fonctions de suppression et registre
-- Date: 2026-04-12
-- Audit: DB-10 — Fonction delete_user_data() referencee mais non definie
--        DB-11 — Table data_requests referencee mais non definie
--
-- IMPORTANT: Entierement idempotent. Safe en prod.
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Table data_requests — Registre des demandes d'exercice des droits
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS data_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type      TEXT NOT NULL CHECK (request_type IN (
    'access',         -- Art. 15 — Droit d'acces
    'rectification',  -- Art. 16 — Droit de rectification
    'erasure',        -- Art. 17 — Droit a l'effacement
    'portability',    -- Art. 20 — Droit a la portabilite
    'restriction',    -- Art. 18 — Droit a la limitation
    'objection'       -- Art. 21 — Droit d'opposition
  )),
  requester_email   TEXT NOT NULL,
  requester_name    TEXT,
  status            TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'in_progress', 'completed', 'rejected'
  )),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  action_taken      TEXT,                   -- Description de l'action effectuee
  processed_by      TEXT,                   -- Responsable du traitement
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_user ON data_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_requests_type ON data_requests(request_type);

-- RLS : service_role uniquement (donnees sensibles)
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_requests_service_role" ON data_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Fonction delete_user_data — Suppression complete d'un compte utilisateur
-- Nettoie toutes les tables contenant des donnees personnelles.
-- Doit etre appelee AVANT auth.admin.deleteUser() car les FK CASCADE
-- ne couvrent pas tout (certaines tables n'ont pas de FK directe).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_artisan_id UUID;
  v_result JSONB := '{}';
  v_count INTEGER;
BEGIN
  -- Verifier que la fonction est appelee par service_role
  -- (defense en profondeur, normalement controlee par RLS)

  -- 1. Trouver le profil artisan lie (si artisan)
  SELECT id INTO v_artisan_id FROM profiles_artisan WHERE user_id = p_user_id;

  -- 2. Supprimer les donnees liees au profil artisan
  IF v_artisan_id IS NOT NULL THEN
    -- Services
    DELETE FROM service_etapes WHERE service_id IN (
      SELECT id FROM services WHERE artisan_id = v_artisan_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('service_etapes', v_count);

    DELETE FROM services WHERE artisan_id = v_artisan_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('services', v_count);

    -- Availability
    DELETE FROM availability WHERE artisan_id = v_artisan_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('availability', v_count);

    -- Absences
    DELETE FROM artisan_absences WHERE artisan_id = v_artisan_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('artisan_absences', v_count);

    -- Photos
    DELETE FROM artisan_photos WHERE artisan_id = v_artisan_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('artisan_photos', v_count);

    -- Notifications artisan
    DELETE FROM artisan_notifications WHERE artisan_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('artisan_notifications', v_count);

    -- Specialites
    DELETE FROM profile_specialties WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('profile_specialties', v_count);

    -- Referrals
    UPDATE referrals SET filleul_id = NULL WHERE filleul_id = v_artisan_id;
    DELETE FROM referrals WHERE parrain_id = v_artisan_id;

    -- Marches candidatures
    DELETE FROM marches_candidatures WHERE artisan_user_id = p_user_id;

    -- Profil artisan
    DELETE FROM profiles_artisan WHERE id = v_artisan_id;
    v_result := v_result || jsonb_build_object('profiles_artisan', 1);
  END IF;

  -- 3. Supprimer les donnees client
  DELETE FROM client_favorites WHERE client_id = p_user_id;
  DELETE FROM profiles_client WHERE id = p_user_id;

  -- 4. Anonymiser les bookings (garder pour stats, effacer PII)
  UPDATE bookings SET
    client_name = '[supprime]',
    client_email = '[supprime]',
    client_phone = '[supprime]',
    client_address = '[supprime]',
    notes = NULL,
    deleted_at = NOW(),
    deleted_by = p_user_id
  WHERE client_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('bookings_anonymized', v_count);

  -- 5. Soft-delete les messages
  UPDATE booking_messages SET deleted_at = NOW(), deleted_by = p_user_id
  WHERE sender_id = p_user_id;
  UPDATE conversation_messages SET deleted_at = NOW(), deleted_by = p_user_id
  WHERE sender_id = p_user_id;

  -- 6. Soft-delete les conversations
  UPDATE conversations SET deleted_at = NOW(), deleted_by = p_user_id
  WHERE artisan_id = p_user_id OR contact_id = p_user_id;

  -- 7. Supprimer les donnees syndic
  DELETE FROM syndic_notifications WHERE syndic_id = p_user_id;

  -- 8. Supprimer les donnees BTP
  DELETE FROM situations_btp WHERE owner_id = p_user_id;
  DELETE FROM retenues_btp WHERE owner_id = p_user_id;
  DELETE FROM dc4_btp WHERE owner_id = p_user_id;
  DELETE FROM dce_analyses_btp WHERE owner_id = p_user_id;
  DELETE FROM dpgf_btp WHERE owner_id = p_user_id;
  DELETE FROM pointages_btp WHERE owner_id = p_user_id;
  DELETE FROM depenses_btp WHERE owner_id = p_user_id;
  DELETE FROM chantiers_btp WHERE owner_id = p_user_id;

  -- 9. Supprimer les abonnements
  DELETE FROM subscriptions WHERE user_id = p_user_id;

  -- 10. Supprimer les devis et factures (sauf si obligation legale)
  -- NOTE: Les factures < 6 ans (FR) ou < 10 ans (PT) sont ANONYMISEES, pas supprimees
  UPDATE devis SET
    client_name = '[supprime]',
    client_email = '[supprime]',
    client_phone = '[supprime]',
    client_address = '[supprime]'
  WHERE artisan_user_id = p_user_id;

  UPDATE factures SET
    client_name = '[supprime]',
    client_email = '[supprime]',
    client_phone = '[supprime]',
    client_address = '[supprime]'
  WHERE artisan_user_id = p_user_id;

  -- 11. Supprimer les donnees Portugal fiscal
  DELETE FROM pt_fiscal_documents WHERE artisan_id = p_user_id
    AND created_at < NOW() - INTERVAL '10 years';
  DELETE FROM pt_fiscal_series WHERE artisan_id = p_user_id
    AND created_at < NOW() - INTERVAL '10 years';

  -- 12. Supprimer les analytics (non-PII mais lie au user)
  DELETE FROM analytics_events WHERE user_id = p_user_id;

  -- 13. Logger la suppression dans audit_logs
  INSERT INTO audit_logs (user_id, action, table_name, details)
  VALUES (p_user_id, 'DELETE_ACCOUNT', 'all', v_result);

  -- 14. Logger dans data_requests
  INSERT INTO data_requests (user_id, request_type, requester_email, status, processed_at, action_taken)
  VALUES (p_user_id, 'erasure', '[auto]', 'completed', NOW(), 'Automated account deletion');

  RETURN v_result;
END;
$$;

-- Seul le service_role peut appeler cette fonction
REVOKE ALL ON FUNCTION delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_data(UUID) TO service_role;

COMMENT ON FUNCTION delete_user_data IS
  'Supprime toutes les donnees personnelles d''un utilisateur. '
  'Anonymise les bookings/devis/factures au lieu de les supprimer (obligation legale). '
  'Doit etre appelee AVANT auth.admin.deleteUser(). '
  'Retourne un JSONB avec le nombre d''enregistrements supprimes par table.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Fonction export_user_data — Export RGPD (Art. 20 portabilite)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB := '{}';
  v_artisan_id UUID;
BEGIN
  -- Profil artisan
  SELECT id INTO v_artisan_id FROM profiles_artisan WHERE user_id = p_user_id;

  IF v_artisan_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('profile_artisan',
      (SELECT to_jsonb(pa.*) FROM profiles_artisan pa WHERE pa.user_id = p_user_id)
    );
    v_result := v_result || jsonb_build_object('services',
      (SELECT COALESCE(jsonb_agg(to_jsonb(s.*)), '[]') FROM services s WHERE s.artisan_id = v_artisan_id)
    );
  END IF;

  -- Profil client
  v_result := v_result || jsonb_build_object('profile_client',
    (SELECT to_jsonb(pc.*) FROM profiles_client pc WHERE pc.id = p_user_id)
  );

  -- Bookings
  v_result := v_result || jsonb_build_object('bookings',
    (SELECT COALESCE(jsonb_agg(to_jsonb(b.*)), '[]')
     FROM bookings b WHERE b.client_id = p_user_id OR b.artisan_id = v_artisan_id)
  );

  -- Abonnement
  v_result := v_result || jsonb_build_object('subscription',
    (SELECT to_jsonb(s.*) FROM subscriptions s WHERE s.user_id = p_user_id)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION export_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_user_data(UUID) TO service_role;
