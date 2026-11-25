-- 20261125_pro_team_members_job_title.sql
--
-- Catégorie professionnelle d'un membre d'équipe BTP (« Encarregado geral », « Chefe de equipa », « Servente »…) :
-- titre libre saisi par le gérant dans « Comptes utilisateurs », affiché à la place du rôle (rappelé dessous), SANS EFFET SUR LES DROITS
-- (ceux-ci viennent de la colonne role et de pro_role_permissions). Voir lib/equipe/categorie-professionnelle.ts.
--
-- À appliquer AVANT le déploiement du code qui lit la colonne (GET /api/pro/team la sélectionne).
-- Rejouable : colonne et contrainte ne sont créées que si elles manquent. Aucune ligne existante n'est modifiée
-- (la colonne naît vide pour tout le monde). Retour arrière : docs/rollback-procedures.md, section « Migration 20261125 ».
-- Ordre : l'export RGPD (app/api/user/export-data) sélectionne aussi la colonne : appliquer avant de fusionner.

-- ALTER TABLE prend un verrou exclusif sur une table lue à chaque requête d'un salarié (resolveCompanyId) : ne pas
-- attendre derrière une transaction longue ; en cas d'expiration, rien n'est appliqué, relancer.
set local lock_timeout = '5s';

ALTER TABLE public.pro_team_members ADD COLUMN IF NOT EXISTS job_title text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pro_team_members_job_title_longueur'
      AND conrelid = 'public.pro_team_members'::regclass
  ) THEN
    ALTER TABLE public.pro_team_members
      ADD CONSTRAINT pro_team_members_job_title_longueur
      CHECK (job_title IS NULL OR char_length(job_title) BETWEEN 1 AND 80);
  END IF;
END $$;

COMMENT ON COLUMN public.pro_team_members.job_title IS
  'Catégorie professionnelle affichée (titre libre, 80 caractères au plus) ; sans effet sur les droits.';
