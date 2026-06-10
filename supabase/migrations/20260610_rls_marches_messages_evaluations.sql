-- ═══════════════════════════════════════════════════════════════
-- RLS — Verrouillage marches_messages / marches_evaluations
-- ═══════════════════════════════════════════════════════════════
-- Audit 2026-06-10 (Vague 1 sécurité).
--
-- AVANT : 008_marches_v3_features.sql posait des policies permissives :
--   marches_messages_read   FOR SELECT USING (true)
--   marches_messages_insert FOR INSERT WITH CHECK (true)
--   evaluations_read        FOR SELECT USING (true)
-- → tout utilisateur authentifié pouvait lire/écrire TOUS les messages
--   (sender_email + contenu = exposition RGPD) et toutes les évaluations.
--   La migration 20260522_rls_critical_fixes.sql documentait l'exposition
--   mais ne corrigeait que l'INSERT des évaluations.
--
-- ACCÈS LÉGITIME : 100 % via les routes API (app/api/marches/[id]/messages,
-- /evaluation) qui utilisent supabaseAdmin (service_role → bypass RLS) et
-- vérifient déjà l'appartenance (publisher via access_token, artisan via
-- candidature.artisan_user_id === auth.uid()). Aucun accès client-direct.
-- → verrouiller la RLS au seul participant authentifié ne casse rien et
--   ajoute une défense en profondeur.
--
-- Le publisher anonyme (publisher_user_id NULL, accès par access_token) passe
-- par l'API/service_role : non concerné par ces policies `authenticated`.
--
-- auth.uid() encapsulé dans (SELECT auth.uid()) pour éviter la ré-évaluation
-- par ligne (cf. advisor perf auth_rls_initplan).
-- ═══════════════════════════════════════════════════════════════

-- ── marches_messages ────────────────────────────────────────────
DROP POLICY IF EXISTS "marches_messages_read" ON public.marches_messages;
DROP POLICY IF EXISTS "marches_messages_insert" ON public.marches_messages;

CREATE POLICY "marches_messages_select" ON public.marches_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marches m
      WHERE m.id = marche_id AND m.publisher_user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.marches_candidatures c
      WHERE c.id = candidature_id AND c.artisan_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "marches_messages_insert" ON public.marches_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marches m
      WHERE m.id = marche_id AND m.publisher_user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.marches_candidatures c
      WHERE c.id = candidature_id AND c.artisan_user_id = (SELECT auth.uid())
    )
  );

-- ── marches_evaluations (SELECT seul ; l'INSERT scoping vient de 20260522) ──
DROP POLICY IF EXISTS "evaluations_read" ON public.marches_evaluations;

CREATE POLICY "evaluations_select" ON public.marches_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marches m
      WHERE m.id = marche_id AND m.publisher_user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.marches_candidatures c
      WHERE c.id = candidature_id AND c.artisan_user_id = (SELECT auth.uid())
    )
  );
