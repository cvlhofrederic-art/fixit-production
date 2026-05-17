-- ════════════════════════════════════════════════════════════════════════════
-- Nettoyage + seed PT cohérent pour le super admin syndic
-- cabinet_id : 389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4
-- ════════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase SQL Editor (prod).
-- Idempotent : peut être relancé, supprime/réinsère ce qui est marqué 'pt-demo-v1'.

BEGIN;

-- ─── 1. PURGE missions FR contaminées (Lepore Sebastien / La Sauvagère / Espaces verts) ──
DELETE FROM syndic_missions
WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
  AND (
    artisan = 'Lepore Sebastien'
    OR immeuble ILIKE 'La Sauvag%'
    OR type = 'Espaces verts'
  );

-- ─── 2. PURGE seed démo PT antérieur (relances) ──
DELETE FROM syndic_missions
WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
  AND demandeur_role = 'pt-demo-v1';

DELETE FROM syndic_messages
WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
  AND message_type = 'canal_interne'
  AND sender_role LIKE '%|pt-demo-v1';

-- ─── 3. INSERT nouvelles missions PT cohérentes ─────────────────────────────
-- Assignées à Bruno Tavares (Gestor Técnico) + Diogo Pereira / Tiago Mendes (Técnicos)
-- Sur les 4 immeubles PT cohérents : Atlântico / Boavista Center / Cedofeita / Foz Douro

INSERT INTO syndic_missions
  (cabinet_id, immeuble, artisan, type, description, priorite, statut,
   date_creation, date_intervention, batiment, etage, num_lot, locataire,
   telephone_locataire, demandeur_nom, demandeur_role, est_partie_commune, zone_signalee)
VALUES
  -- Bruno Tavares (Gestor Técnico) — pilotage technique
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Edifício Atlântico', 'Bruno Tavares', 'Vistoria técnica',
   'Vistoria trimestral das partes comuns — verificação extintores, sinalética e iluminação de emergência piso 0 e 1.',
   'normale', 'en_cours',
   CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '2 days',
   'A', 'R/C', NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Partes comuns'),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Condomínio Boavista Center', 'Bruno Tavares', 'Coordenação de obras',
   'Acompanhamento da impermeabilização da cobertura — supervisão diária dos trabalhos do prestador externo.',
   'normale', 'en_cours',
   CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '3 days',
   NULL, 'Cobertura', NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Cobertura'),

  -- Diogo Pereira (Técnico) — petites réparations
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Condomínio Boavista Center', 'Diogo Pereira', 'Pequenas reparações',
   'Substituição de 4 lâmpadas LED na garagem + ajuste da fechadura da porta de acesso à zona técnica.',
   'normale', 'en_attente',
   CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '1 day',
   NULL, '-1', NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Garagem'),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Edifício Atlântico', 'Diogo Pereira', 'Manutenção corrente',
   'Aperto de parafusos do corrimão da escada principal + lubrificação da fechadura da porta de entrada.',
   'normale', 'terminee',
   CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '18 days',
   'A', 'Todos', NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Escadas e entrada'),

  -- Tiago Mendes (Técnico) — petites réparations
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Residencial Cedofeita', 'Tiago Mendes', 'Manutenção corrente',
   'Reparação de campainha avariada no R/C esquerdo + colocação de batente em falta na porta do hall.',
   'normale', 'en_attente',
   CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days',
   'A', 'R/C', 'Esq', 'Maria Costa', '917 234 567',
   'Maria Costa', 'pt-demo-v1', FALSE, 'Fração R/C Esq'),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Edifício Foz Douro', 'Tiago Mendes', 'Pequenas reparações',
   'Pintura de retoque na zona da entrada + substituição da iluminação avariada no corredor do 2.º andar.',
   'normale', 'en_cours',
   CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day',
   NULL, '2.º', NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Entrada e 2.º andar'),

  -- Mission terminée Bruno (auditoria légère gás)
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Residencial Cedofeita', 'Bruno Tavares', 'Inspeção técnica',
   'Verificação periódica do sistema de gás das partes comuns — relatório para o seguro do condomínio.',
   'normale', 'terminee',
   CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '35 days',
   NULL, NULL, NULL, NULL, NULL,
   'Administração', 'pt-demo-v1', TRUE, 'Instalação de gás'),

  -- Mission urgente Diogo (fuga reportée par condómino)
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Edifício Atlântico', 'Diogo Pereira', 'Pequenas reparações',
   'Verificação de infiltração reportada pelo condómino do 3.º Dto — humidade visível no tecto da casa de banho.',
   'urgente', 'en_cours',
   CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE,
   'A', '3.º', 'Dto', 'André Marques', '961 555 123',
   'André Marques', 'pt-demo-v1', FALSE, 'Fração 3.º Dto');

-- ─── 4. INSERT messages canal_interne — demandes d'intervention de condóminos ──
-- Sender_role suffixe 'pt-demo-v1' pour repérage / idempotence
-- Le content est un JSON sérialisé du CanalInterneMsg complet (cf. front parsing)

INSERT INTO syndic_messages
  (cabinet_id, sender_id, sender_role, content, message_type, read_at)
VALUES
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Maria Costa|pt-demo-v1',
   '{"contenu":"Olá, no R/C Esq do Cedofeita a campainha deixou de funcionar e a porta do hall já não fecha bem. Podem mandar alguém?","de":"Maria Costa","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '3 days')::text || '","lu":false}',
   'canal_interne', NULL),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'André Marques|pt-demo-v1',
   '{"contenu":"URGENTE — tenho uma mancha de humidade no tecto da casa de banho do 3.º Dto do Atlântico. Pode ser fuga do andar de cima. Agradeço intervenção rápida.","de":"André Marques","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '1 day')::text || '","lu":false}',
   'canal_interne', NULL),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Joana Ribeiro|pt-demo-v1',
   '{"contenu":"Bom dia, as lâmpadas da garagem do Boavista Center estão fundidas há uma semana. É perigoso entrar de noite.","de":"Joana Ribeiro","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '6 days')::text || '","lu":false}',
   'canal_interne', NULL),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Paulo Fernandes|pt-demo-v1',
   '{"contenu":"O portão automático da garagem do Foz Douro tem fechado muito devagar. Acho que precisa de revisão.","de":"Paulo Fernandes","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '8 days')::text || '","lu":true}',
   'canal_interne', NOW() - INTERVAL '7 days'),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Inês Silva|pt-demo-v1',
   '{"contenu":"A iluminação do corredor do 2.º do Foz Douro pisca constantemente. Já faz dois dias.","de":"Inês Silva","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '4 days')::text || '","lu":true}',
   'canal_interne', NOW() - INTERVAL '3 days'),

  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
   'Rui Mendes|pt-demo-v1',
   '{"contenu":"Há uma fissura nova no muro lateral do Cedofeita, lado norte. Pode pedir-se a alguém para vir ver?","de":"Rui Mendes","deRole":"condomino","type":"message","date":"' || (NOW() - INTERVAL '10 days')::text || '","lu":true}',
   'canal_interne', NOW() - INTERVAL '9 days');

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Vérifications post-exécution :
--   SELECT artisan, immeuble, type, statut FROM syndic_missions
--     WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
--     ORDER BY date_creation DESC;
--
--   SELECT sender_role, substring(content, 1, 80) AS preview
--     FROM syndic_messages
--     WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
--       AND message_type = 'canal_interne'
--     ORDER BY created_at DESC;
-- ════════════════════════════════════════════════════════════════════════════
