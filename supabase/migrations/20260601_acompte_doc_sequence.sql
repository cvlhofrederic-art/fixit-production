-- ── Séquence de numérotation dédiée aux factures d'acompte (BTP) ──
-- Méthode pro : une série indépendante par type de document
-- (art. L441-3 C. com. ; numérotation continue art. 242 nonies A I 2° CGI).
--
-- AVANT : les factures d'acompte consommaient la séquence 'facture' (FACT-),
--         se mélangeant dans la chronologie avec les factures standard.
-- APRÈS : doc_type 'acompte' → préfixe AC-YYYY-NNN, compteur INDÉPENDANT de FACT-.
--
-- Les acomptes DÉJÀ émis (FACT-...) ne sont PAS renumérotés (interdit de
-- modifier le numéro d'une facture émise). La séparation vaut pour les nouveaux.

-- 1) Autoriser le nouveau doc_type dans la table de séquences gapless.
ALTER TABLE doc_sequences DROP CONSTRAINT IF EXISTS doc_sequences_doc_type_check;
ALTER TABLE doc_sequences
  ADD CONSTRAINT doc_sequences_doc_type_check
  CHECK (doc_type IN ('devis', 'facture', 'avoir', 'acompte'));

-- 2) Réémettre next_doc_number avec le préfixe 'acompte' → 'AC'.
--    Le corps d'autorisation est repris VERBATIM de 20260522_rls_critical_fixes.sql
--    (un CREATE OR REPLACE écrase la fonction entière : on préserve le check
--    ownership service_role / artisan / membre d'équipe actif).
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_artisan_user_id uuid,
  p_doc_type        text,
  p_year            integer DEFAULT (EXTRACT(year FROM now()))::integer
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seq            INTEGER;
  v_prefix         TEXT;
  v_caller         UUID;
  v_is_authorized  BOOLEAN := false;
BEGIN
  v_caller := auth.uid();

  -- service_role bypass (cron, server-only), pas anon
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    v_is_authorized := true;
  ELSIF v_caller IS NOT NULL AND v_caller = p_artisan_user_id THEN
    v_is_authorized := true;
  ELSIF v_caller IS NOT NULL AND EXISTS (
    SELECT 1 FROM pro_team_members
    WHERE user_id    = v_caller
      AND company_id = p_artisan_user_id
      AND is_active  = true
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot generate doc number for artisan %',
      v_caller, p_artisan_user_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO doc_sequences (artisan_user_id, doc_type, year, last_seq)
  VALUES (p_artisan_user_id, p_doc_type, p_year, 1)
  ON CONFLICT (artisan_user_id, doc_type, year)
  DO UPDATE SET last_seq = doc_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  v_prefix := CASE p_doc_type
    WHEN 'devis'   THEN 'DEV'
    WHEN 'facture' THEN 'FACT'
    WHEN 'avoir'   THEN 'AV'
    WHEN 'acompte' THEN 'AC'
  END;

  -- Garde-fou : un doc_type inconnu ne doit pas produire un numéro 'NULL-...'
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'invalid doc_type: %', p_doc_type USING ERRCODE = '22023';
  END IF;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;
