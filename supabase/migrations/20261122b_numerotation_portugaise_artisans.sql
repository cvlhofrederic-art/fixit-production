-- ── Numérotation portugaise étendue aux artisans portugais (22/11/2026) ──
-- Suite de 20261122_numerotation_portugaise.sql (appliquée en production le 22/11/2026), qui réservait ORC, FT, NC et FA
-- aux sociétés BTP (app_metadata.role = 'pro_societe') dont la fiche est en portugais. Demande de Frédéric : « Numérotation
-- ORC pour PT, DEV pour FR, faut que ça ait du sens ! Pareil les factures », puis, sur la question des artisans
-- portugais : « Fais au mieux, sois logique ». Le critère devient le marché du titulaire de la série, quel que soit son
-- rôle : un compte dont une fiche (profiles_artisan.language) est en portugais reçoit ORC (orçamento), FT (fatura),
-- NC (nota de crédito), FA (fatura de adiantamento) ; tout autre compte garde DEV, FACT, AV et AC.
-- Relevé en production le 22/11/2026 : 5 comptes ont une fiche en portugais (2 sociétés BTP, 2 artisans, 1 syndic), aucun
-- n'a de seconde fiche dans une autre langue ; ni les artisans ni le syndic n'ont de compteur : aucune série déjà
-- commencée ne change de préfixe (les sociétés BTP l'ont déjà depuis 20261122). Un titulaire qui numérotait déjà ses
-- orçamentos hors de Vitfix doit voir son compteur amorcé AVANT sa première émission (sinon ORC-2026-001 refait un
-- numéro déjà envoyé).
-- Ces préfixes servent à la lecture : aucune série n'est communiquée à l'AT, Vitfix n'est pas un programme certifié
-- (Decreto-Lei n.º 28/2019), les documents n'ont ni ATCUD ni hash.
--
-- Ce qui ne change pas (comme 20261122) : les compteurs (doc_sequences, par compte, type et année : un compte qui passe
-- au portugais continue sa numérotation) ; les numéros déjà émis ; le reste du corps de la fonction (autorisation,
-- SECURITY DEFINER, search_path, format PRÉFIXE-AAAA-NNN) ; les droits d'exécution et le propriétaire (CREATE OR REPLACE
-- les garde). La fonction ne lit plus auth.users.
-- Garde : la fonction doit pouvoir lire profiles_artisan sans être filtrée par la RLS, sinon tout retomberait en silence
-- sur DEV- ; la migration s'arrête alors sans rien appliquer. Rejouable.

DO $$
DECLARE
  v_proprietaire oid;
BEGIN
  SELECT p.proowner INTO v_proprietaire
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.next_doc_number(uuid,text,integer)');
  IF v_proprietaire IS NULL THEN
    RETURN;
  END IF;
  IF NOT has_table_privilege(v_proprietaire, 'public.profiles_artisan', 'SELECT') THEN
    RAISE EXCEPTION 'Numérotation portugaise : le propriétaire de next_doc_number ne peut pas lire profiles_artisan ; rien n''est appliqué';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = v_proprietaire AND (r.rolsuper OR r.rolbypassrls))
     AND EXISTS (
       SELECT 1 FROM pg_class c
       WHERE c.oid = 'public.profiles_artisan'::regclass
         AND c.relrowsecurity
         AND (c.relowner <> v_proprietaire OR c.relforcerowsecurity)
     ) THEN
    RAISE EXCEPTION 'Numérotation portugaise : next_doc_number serait filtrée par la RLS de profiles_artisan ; rien n''est appliqué';
  END IF;
END $$;

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

  -- Titulaire de la série dont une fiche est en portugais (artisan ou société) → préfixes portugais.
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
