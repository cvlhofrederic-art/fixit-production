-- ── Numérotation SERVEUR gapless : créer + amorcer doc_sequences ──
-- Constat : la table doc_sequences (migration 022) n'était PAS présente en prod
-- → next_doc_number échouait → numérotation assurée côté client (localStorage),
-- non gapless (problème art. 242 nonies A I 2° CGI : continuité sans rupture).
--
-- Cette migration :
--   1. crée doc_sequences (idempotent),
--   2. l'AMORCE au MAX des numéros DÉJÀ ÉMIS par (artisan, type, année) — donc
--      ni doublon ni trou avec l'existant (les acomptes restent en FACT-, les
--      nouvelles séries AV-/AC- démarrent à 001),
--   3. réémet next_doc_number avec le préfixe acompte → AC-.
-- À déployer AVEC le Plan B client (numéro définitif attribué uniquement à la
-- validation) : sinon la RPC consommerait un numéro à chaque ouverture de form.

-- 1) Table de séquences gapless (structure de la migration 022 + doc_type 'acompte')
CREATE TABLE IF NOT EXISTS doc_sequences (
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('devis', 'facture', 'avoir', 'acompte')),
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artisan_user_id, doc_type, year)
);

ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;

-- RLS : lecture par le propriétaire ; les écritures passent par la RPC SECURITY DEFINER.
DROP POLICY IF EXISTS "doc_sequences_owner_access" ON doc_sequences;
CREATE POLICY "doc_sequences_owner_access" ON doc_sequences
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- 2) AMORÇAGE : last_seq = MAX(séquence déjà émise) par (artisan, type, année),
--    parsé depuis les numéros comptables existants (factures + devis). Les
--    brouillons BR-… sont ignorés (série non comptable). GREATEST = idempotent
--    (ré-exécutable sans jamais abaisser un compteur).
INSERT INTO doc_sequences (artisan_user_id, doc_type, year, last_seq)
SELECT artisan_user_id,
  CASE split_part(numero, '-', 1)
    WHEN 'DEV' THEN 'devis' WHEN 'FACT' THEN 'facture'
    WHEN 'AV' THEN 'avoir' WHEN 'AC' THEN 'acompte' END,
  split_part(numero, '-', 2)::int,
  max(split_part(numero, '-', 3)::int)
FROM (
  SELECT numero, artisan_user_id FROM factures WHERE numero ~ '^(DEV|FACT|AV|AC)-[0-9]{4}-[0-9]+$'
  UNION ALL
  SELECT numero, artisan_user_id FROM devis    WHERE numero ~ '^(DEV|FACT|AV|AC)-[0-9]{4}-[0-9]+$'
) u
GROUP BY artisan_user_id, 2, 3
ON CONFLICT (artisan_user_id, doc_type, year)
  DO UPDATE SET last_seq = GREATEST(doc_sequences.last_seq, EXCLUDED.last_seq);

-- 3) next_doc_number avec préfixe acompte → 'AC'. Corps d'autorisation repris
--    VERBATIM de 20260522_rls_critical_fixes.sql (ownership service_role /
--    artisan / membre d'équipe) ; seul ajout : WHEN 'acompte' + garde-fou NULL.
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

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'invalid doc_type: %', p_doc_type USING ERRCODE = '22023';
  END IF;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;
