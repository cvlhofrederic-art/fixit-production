-- Seed DEV uniquement — 7 membres de l'équipe syndic V5.4 PT (HTML V5.7)
--
-- Usage :
--   1. Remplacer <DEV_CABINET_ID> par l'UUID du cabinet syndic dev
--      (ex : SELECT id FROM syndic_cabinets WHERE email = 'dev-syndic-pt@vitfix.io';
--       ou table auth.users si le cabinet est représenté côté auth seulement).
--   2. Exécuter dans Supabase SQL Editor (env dev/staging) ou via psql.
--
-- Idempotent : INSERT ... ON CONFLICT DO NOTHING sur (cabinet_id, initials)
-- via la combinaison email partielle. Re-exécutable en sécurité.
--
-- Mapping rôles : Administrador → syndic_admin, Gestor Técnico/Técnico →
-- syndic_tech, Secretária → syndic_secretaire, Contabilista → syndic_comptable,
-- Jurista → syndic_juriste.
--
-- Couleurs : matchent les noms CSS vars V5.4 (gold/sage/amber/rust). L'UI
-- map ces tokens vers les hex effectifs au rendu de l'avatar.

INSERT INTO syndic_team_members
  (cabinet_id, initials, full_name, role, color, display_order, is_active, email)
VALUES
  ('<DEV_CABINET_ID>'::uuid, 'HC', 'Helena Carvalho',   'syndic_admin',        'gold',  1, TRUE, 'helena.carvalho@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'BT', 'Bruno Tavares',     'syndic_tech',         'sage',  2, TRUE, 'bruno.tavares@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'DP', 'Diogo Pereira',     'syndic_tech',         'sage',  3, TRUE, 'diogo.pereira@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'TM', 'Tiago Mendes',      'syndic_tech',         'sage',  4, TRUE, 'tiago.mendes@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'MS', 'Margarida Sousa',   'syndic_secretaire',   'sage',  5, TRUE, 'margarida.sousa@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'RA', 'Ricardo Almeida',   'syndic_comptable',    'sage',  6, TRUE, 'ricardo.almeida@vitfix.dev'),
  ('<DEV_CABINET_ID>'::uuid, 'IM', 'Inês Monteiro',     'syndic_juriste',      'amber', 7, TRUE, 'ines.monteiro@vitfix.dev')
ON CONFLICT (email) WHERE email IS NOT NULL DO NOTHING;
