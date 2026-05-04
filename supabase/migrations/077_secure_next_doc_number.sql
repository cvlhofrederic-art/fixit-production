-- ── Hotfix audit interne 04/05/2026 ──
-- Sécurise la fonction next_doc_number contre la pollution de séquence
-- inter-artisans via SECURITY DEFINER.
--
-- AVANT : la fonction était SECURITY DEFINER mais ne vérifiait pas que
-- p_artisan_user_id === auth.uid(). Un membre d'équipe BTP authentifié
-- (CONDUCTEUR_TRAVAUX, OUVRIER, etc.) pouvait appeler la RPC directement
-- via le client Supabase en passant un UUID forgé via les devtools React,
-- incrémentant la séquence d'un autre artisan sans son consentement.
-- Conséquence : trous dans la numérotation comptable de la cible
-- (illégal art. 242 nonies A I 2° CGI).
--
-- APRÈS :
--  - Vérification auth.uid() === p_artisan_user_id côté DB
--  - Bypass autorisé pour service_role (sync route, backfill admin)
--  - Bypass autorisé pour les membres pro_team_members ayant company_id ===
--    p_artisan_user_id (gérant + équipe d'une même société peuvent appeler
--    sous l'identité du gérant)
--
-- Cohérent avec le check ownership étendu de /api/devis/sync (PR hotfix).

CREATE OR REPLACE FUNCTION next_doc_number(
  p_artisan_user_id UUID,
  p_doc_type TEXT,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_prefix TEXT;
  v_caller UUID;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- 1. Vérification d'autorisation
  v_caller := auth.uid();

  -- Service role (jwt sub absent ou role='service_role') → bypass
  IF v_caller IS NULL OR (current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_is_authorized := true;
  -- Caller = artisan lui-même → autorisé
  ELSIF v_caller = p_artisan_user_id THEN
    v_is_authorized := true;
  -- Caller = membre actif d'équipe BTP de la société (company_id = p_artisan_user_id)
  ELSIF EXISTS (
    SELECT 1 FROM pro_team_members
    WHERE user_id = v_caller
      AND company_id = p_artisan_user_id
      AND is_active = true
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot generate doc number for artisan %', v_caller, p_artisan_user_id
      USING ERRCODE = '42501';
  END IF;

  -- 2. Atomically increment or initialize the sequence
  INSERT INTO doc_sequences (artisan_user_id, doc_type, year, last_seq)
  VALUES (p_artisan_user_id, p_doc_type, p_year, 1)
  ON CONFLICT (artisan_user_id, doc_type, year)
  DO UPDATE SET last_seq = doc_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- 3. Build prefix based on doc_type
  v_prefix := CASE p_doc_type
    WHEN 'devis' THEN 'DEV'
    WHEN 'facture' THEN 'FACT'
    WHEN 'avoir' THEN 'AV'
  END;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- Note : la table pro_team_members existe (migration 048). La condition EXISTS
-- ci-dessus est safe même avant accept_invitation puisque on filtre is_active.
