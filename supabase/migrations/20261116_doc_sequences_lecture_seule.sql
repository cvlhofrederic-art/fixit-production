-- ══════════════════════════════════════════════════════════════════════════════
-- Compteurs de numérotation des devis et factures (doc_sequences) : lecture seule pour les comptes (16/11/2026)
--
-- Audit des fondations BTP du 11/11/2026, constats api-coeur-10 et base-de-donnees-9. Défaut côté serveur, identique
-- pour tous les rôles (artisan comme société BTP) : la policy doc_sequences_owner_access (022, 20260602, reprise par
-- 20260610) ne précise aucune commande ; elle vaut donc pour la lecture ET pour l'écriture. Une session connectée
-- pouvait modifier elle-même sa ligne de compteur, sans passer par l'application, alors que la numérotation des
-- factures doit rester continue, sans réutilisation de numéro.
-- Les numéros n'avancent que par la fonction next_doc_number (SECURITY DEFINER : elle s'exécute avec les droits de
-- son propriétaire ; ni cette policy ni les droits des comptes ne la concernent).
--
-- 1. La policy doc_sequences_owner_access est remplacée par doc_sequences_lecture_proprietaire : lecture (SELECT)
--    seule, même condition (artisan_user_id = auth.uid()).
-- 2. Droits INSERT, UPDATE, DELETE et TRUNCATE retirés aux rôles anon et authenticated sur la table : une policy
--    d'écriture recréée à la main ne rouvrirait rien (TRUNCATE n'est jamais soumis à la RLS). Lecture inchangée ;
--    service_role et le propriétaire gardent tous leurs droits. Gardes d'existence de la table et des rôles, pour
--    que la migration passe aussi dans le job CI (rôles absents) et sur une base sans cette table.
-- 3. Contrôle final : s'il reste une policy autre que la lecture, ou un droit d'écriture à anon ou authenticated
--    (rôle exécutant non propriétaire, droit accordé à PUBLIC…), erreur : rien n'est appliqué. Même arrêt si
--    next_doc_number, seule à écrire dans la table, ne le pourrait plus après la fermeture de la policy : fonction non
--    SECURITY DEFINER, ou propriétaire soumis à la RLS de la table (ni superutilisateur, ni BYPASSRLS, ni propriétaire
--    de la table sans FORCE ROW LEVEL SECURITY). Sinon plus aucun numéro ne serait attribué.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée, aucun compteur remis à zéro ; la fonction
-- next_doc_number n'est pas touchée (son corps réel en production n'a pas été relevé). L'application ne lit ni
-- n'écrit jamais cette table avec la session d'un compte (elle passe par next_doc_number : route /api/doc-number et
-- appel direct de la fonction) : elle fonctionne de la même façon avant et après cette migration.
-- Contrôle sur une base PGlite : tests/migrations/doc_sequences_lecture_seule.execution.test.ts.
--
-- À appliquer seule (éditeur SQL), par un rôle propriétaire de la table. DROP POLICY prend un verrou exclusif sur la
-- table, gardé jusqu'à la fin du script (une seule transaction) : lock_timeout évite d'attendre derrière une
-- transaction longue (une numérotation en cours, par exemple) ; en cas d'expiration, rien n'est appliqué, relancer.
-- Juste après l'exécution : valider un devis de test, pour vérifier qu'un numéro est toujours attribué, sur un compte
-- de démonstration ou de test, jamais sur celui d'une société ou d'un artisan inscrits (le devis y prendrait un vrai
-- numéro de leur série et s'ajouterait à leurs pièces).
-- Retour arrière, si nécessaire : recréer la policy d'origine (CREATE POLICY "doc_sequences_owner_access" ON
-- public.doc_sequences USING (artisan_user_id = (select auth.uid())) WITH CHECK (artisan_user_id = (select
-- auth.uid()))) et rendre les droits retirés (GRANT INSERT, UPDATE, DELETE, TRUNCATE … TO authenticated).
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

DO $$
BEGIN
  -- Base où la table n'existe pas : rien à fermer.
  IF to_regclass('public.doc_sequences') IS NULL THEN
    RAISE NOTICE 'Numérotation : table public.doc_sequences absente, rien à faire';
    RETURN;
  END IF;

  -- 1. Policy en lecture seule (rejouable : les deux noms sont retirés avant la création).
  DROP POLICY IF EXISTS "doc_sequences_owner_access" ON public.doc_sequences;
  DROP POLICY IF EXISTS "doc_sequences_lecture_proprietaire" ON public.doc_sequences;
  CREATE POLICY "doc_sequences_lecture_proprietaire" ON public.doc_sequences
    FOR SELECT
    USING (artisan_user_id = (SELECT auth.uid()));

  -- 2. Droits d'écriture des rôles des comptes (lecture inchangée).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.doc_sequences FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.doc_sequences FROM authenticated;
  END IF;

  -- 3. Contrôle du résultat.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_sequences' AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Numérotation : une policy autre que la lecture reste sur doc_sequences, rien n''est appliqué';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) AS r
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)
    WHERE has_table_privilege(r.rolname, 'public.doc_sequences', d.droit)
  ) THEN
    RAISE EXCEPTION 'Numérotation : un droit d''écriture reste à anon ou authenticated sur doc_sequences, rien n''est appliqué (lancer la migration avec le rôle propriétaire de la table)';
  END IF;
  -- next_doc_number doit toujours pouvoir écrire dans la table une fois la policy en lecture seule.
  IF to_regprocedure('public.next_doc_number(uuid,text,integer)') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_roles o ON o.oid = p.proowner
    JOIN pg_class t ON t.oid = to_regclass('public.doc_sequences')
    WHERE p.oid = to_regprocedure('public.next_doc_number(uuid,text,integer)')
      AND p.prosecdef
      AND (o.rolsuper OR o.rolbypassrls OR (o.oid = t.relowner AND NOT t.relforcerowsecurity))
  ) THEN
    RAISE EXCEPTION 'Numérotation : next_doc_number ne pourrait plus écrire dans doc_sequences (fonction non SECURITY DEFINER, ou propriétaire soumis à la RLS de la table), rien n''est appliqué';
  END IF;
END
$$;
