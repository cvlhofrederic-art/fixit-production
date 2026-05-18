-- =============================================================================
-- Migration : RLS critical fixes — Angle 1 (durcissement pré-lancement) — 1/2
-- Date     : 2026-05-18
-- =============================================================================
-- Ferme :
--   D) Exposition RPC de fonctions SECURITY DEFINER (6 fonctions).
--   D-bis) Branche `v_caller IS NULL` dans next_doc_number autorisait anon à
--          incrémenter la séquence légale de numérotation de n'importe quel artisan
--          (UUID = pas un secret). Conséquence réglementaire en FR (numérotation
--          devis/factures continue obligatoire).
--   B) 3 vues SECURITY DEFINER court-circuitent le RLS des tables sous-jacentes
--      (chaînes de hash de tous les artisans visibles depuis n'importe quel user
--      qui peut lire la vue). Passage en SECURITY INVOKER + REVOKE FROM anon.
--   C-partiel) marches.marches_insert et marches_evaluations.evaluations_insert
--      avaient WITH CHECK (true) → tout user authentifié pouvait s'attribuer un
--      marché ou évaluer n'importe quelle candidature. Lien avec auth.uid().
--   A) 5 tables server-only (Stripe webhooks, idempotency, subscription metrics,
--      cron heartbeats) : passage en FORCE ROW LEVEL SECURITY pour expliciter
--      l'intention (verrouillage total, accès service_role uniquement).
--
-- NE FERME PAS (= migration 2, en attente) :
--   marches_messages : SELECT USING (true) expose sender_email + content RGPD.
--   Correction exige le schéma de marches_candidatures + décision design sur
--   les messages externes anonymes. Hors scope de cette migration.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- BLOC 1 — Piège D : REVOKE EXECUTE sur les fonctions SECURITY DEFINER exposées
-- ----------------------------------------------------------------------------
-- next_doc_number : reste callable par 'authenticated' (le corps protège,
-- voir BLOC 2 pour la suppression de la branche v_caller IS NULL).
-- REVOKE anon ferme l'appel RPC non authentifié.
REVOKE EXECUTE ON FUNCTION public.next_doc_number(uuid, text, integer) FROM anon;

-- Purge RGPD : service_role uniquement, déclenchées par cron, jamais via RPC client.
REVOKE EXECUTE ON FUNCTION public.anonymize_old_devis()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymize_old_factures() FROM anon, authenticated;

-- Fonctions trigger / audit : jamais censées être appelées en RPC.
REVOKE EXECUTE ON FUNCTION public.audit_devis_changes()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_factures_changes() FROM anon, authenticated;

-- update_conv_metadata : trigger-only (AFTER INSERT ON syndic_ai_messages).
REVOKE EXECUTE ON FUNCTION public.update_conv_metadata()   FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- BLOC 2 — Piège D-bis : retirer la branche `v_caller IS NULL` de next_doc_number
-- ----------------------------------------------------------------------------
-- Avant : `IF v_caller IS NULL OR (current_setting(...) = 'service_role')`
--         → un appel anon (v_caller = NULL) autorisait l'incrémentation de la
--         séquence pour N'IMPORTE QUEL artisan, en connaissant juste son UUID.
-- Après : seul `service_role` peut bypass le check d'autorisation. Les appels
--         authentifiés doivent satisfaire v_caller = p_artisan_user_id OU être
--         membre actif de la team Pro de cet artisan.
-- Le reste du corps est strictement identique à la version actuelle (à confronter
-- ligne à ligne avant déploiement — un CREATE OR REPLACE écrase la fonction entière).
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
  END;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;


-- ----------------------------------------------------------------------------
-- BLOC 3 — Piège B : vues SECURITY DEFINER → SECURITY INVOKER + REVOKE anon
-- ----------------------------------------------------------------------------
-- Ces vues d'audit (chain check + retention status) sont des outils internes.
-- En SECURITY DEFINER, elles court-circuitent le RLS des tables sous-jacentes :
-- un user qui peut lire la vue voit les chaînes de hash de tous les artisans.
-- INVOKER + REVOKE anon = RLS appliqué + non-lisibles par non-authentifié.
ALTER VIEW public.v_factures_chain_check          SET (security_invoker = true);
ALTER VIEW public.v_devis_chain_check             SET (security_invoker = true);
ALTER VIEW public.v_documents_retention_status    SET (security_invoker = true);

REVOKE SELECT ON public.v_factures_chain_check       FROM anon;
REVOKE SELECT ON public.v_devis_chain_check          FROM anon;
REVOKE SELECT ON public.v_documents_retention_status FROM anon;


-- ----------------------------------------------------------------------------
-- BLOC 4 — Piège C (partiel) : INSERT scopés sur marches / marches_evaluations
-- ----------------------------------------------------------------------------
-- marches.marches_insert : forcer publisher_user_id = auth.uid() pour les inserts
-- authentifiés. Le scraping cron (BOAMP/DECP/TED) passe en service_role qui bypass
-- RLS, donc les marches scrapés avec publisher_user_id=NULL continuent de passer.
ALTER POLICY marches_insert ON public.marches
  WITH CHECK (publisher_user_id = auth.uid());

-- marches_evaluations.evaluations_insert : l'appelant doit être soit le publisher
-- du marché, soit l'artisan de la candidature évaluée.
DROP POLICY IF EXISTS evaluations_insert ON public.marches_evaluations;
CREATE POLICY evaluations_insert ON public.marches_evaluations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marches m
      WHERE m.id = marche_id
        AND m.publisher_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.marches_candidatures mc
      WHERE mc.id = candidature_id
        AND mc.artisan_user_id = auth.uid()
    )
  );

-- marches_messages : NON TOUCHÉE dans cette migration.
-- Le défaut grave est le SELECT USING (true) qui expose sender_email + content
-- de tous les marchés (RGPD). Correction → migration 2 séparée.
-- syndic_signalements (module dormant) : hors scope.


-- ----------------------------------------------------------------------------
-- BLOC 5 — Piège A : sceller explicitement les 5 tables server-only
-- ----------------------------------------------------------------------------
-- RLS activé sans policy = inaccessibles au client, accessibles via service_role
-- uniquement. FORCE RLS rend ce statut explicite plutôt que dépendant de l'absence
-- de policy. N'affecte aucun accès légitime (les routes API utilisent service_role).
ALTER TABLE public.stripe_webhook_events  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_metrics   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cron_heartbeats        FORCE ROW LEVEL SECURITY;


COMMIT;
