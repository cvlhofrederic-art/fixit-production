-- ── Numérotation portugaise des devis et factures (22/11/2026) ──
-- Demande de Frédéric : « Numérotation ORC pour PT, DEV pour FR, faut que ça ait du sens ! Pareil les factures. »
--
-- Une fiche en portugais (profiles_artisan.language = 'pt', même critère que lib/btp/fiche-societe-francaise.ts)
-- reçoit des préfixes portugais : ORC (orçamento), FT (fatura), NC (nota de crédito), FA (fatura de adiantamento).
-- Toute autre fiche garde DEV, FACT, AV et AC. Artisans et sociétés BTP : même fonction, même règle.
--
-- Ce qui ne change pas :
--   - les compteurs (doc_sequences, par compte, type et année) : une fiche qui passe au portugais continue sa
--     numérotation (DEV-2026-005, puis ORC-2026-006), sans doublon ni trou ;
--   - les numéros déjà émis : aucune ligne n'est lue ni réécrite ;
--   - le reste du corps de la fonction, repris de 20260602 (relevé identique en production le 22/11/2026, aux espaces
--     près) : autorisation (service_role, titulaire de la série, membre actif de son équipe), SECURITY DEFINER,
--     search_path, format PRÉFIXE-AAAA-NNN ;
--   - les droits d'exécution (REVOKE PUBLIC et GRANT authenticated de 20260522) et le propriétaire : CREATE OR REPLACE
--     les garde.
-- Rejouable.

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
  v_portugal       BOOLEAN;
BEGIN
  v_caller := auth.uid();

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

  -- Fiche du titulaire de la série en portugais : préfixes portugais.
  v_portugal := EXISTS (
    SELECT 1 FROM profiles_artisan
    WHERE user_id  = p_artisan_user_id
      AND language = 'pt'
  );

  v_prefix := CASE p_doc_type
    WHEN 'devis'   THEN CASE WHEN v_portugal THEN 'ORC' ELSE 'DEV'  END
    WHEN 'facture' THEN CASE WHEN v_portugal THEN 'FT'  ELSE 'FACT' END
    WHEN 'avoir'   THEN CASE WHEN v_portugal THEN 'NC'  ELSE 'AV'   END
    WHEN 'acompte' THEN CASE WHEN v_portugal THEN 'FA'  ELSE 'AC'   END
  END;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'invalid doc_type: %', p_doc_type USING ERRCODE = '22023';
  END IF;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;
