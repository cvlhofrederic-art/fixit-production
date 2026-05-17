-- ════════════════════════════════════════════════════════════════════════════
-- Nettoyage + seed PT cohérent pour le super admin syndic
-- cabinet_id : 389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4
-- Exécuté en prod via Supabase SQL Editor le 2026-05-17 — Success
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotence : DELETE par artisan IN (Bruno, Diogo, Tiago) sur les 4 immeubles PT
-- Le canal_interne (table syndic_messages) ne peut pas être seedé via DB direct :
-- check constraint syndic_messages_message_type_check n'accepte que
-- text|rapport|proof_of_work|devis|photo. Les "demandes résidents" du canal
-- s'affichent en fait via les missions avec demandeur_role='copro'.

BEGIN;

-- ─── 1. PURGE missions FR contaminées ────────────────────────────────────────
DELETE FROM syndic_missions
WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
  AND (artisan = 'Lepore Sebastien' OR immeuble ILIKE 'La Sauvag%' OR type = 'Espaces verts');

-- ─── 2. PURGE seed antérieur (relances) ──────────────────────────────────────
DELETE FROM syndic_missions
WHERE cabinet_id = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
  AND artisan IN ('Bruno Tavares', 'Diogo Pereira', 'Tiago Mendes')
  AND immeuble IN ('Edifício Atlântico', 'Condomínio Boavista Center', 'Residencial Cedofeita', 'Edifício Foz Douro');

-- ─── 3. INSERT missions internes + demandes résidents ────────────────────────
INSERT INTO syndic_missions
  (cabinet_id, immeuble, artisan, type, description, priorite, statut,
   date_creation, date_intervention, batiment, etage, num_lot, locataire,
   telephone_locataire, demandeur_nom, demandeur_role, demandeur_email, est_partie_commune, zone_signalee)
VALUES
  -- Bruno Tavares (Gestor Técnico) — pilotage technique
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Atlântico','Bruno Tavares','Vistoria técnica',
   'Vistoria trimestral das partes comuns — verificação extintores, sinalética e iluminação de emergência piso 0 e 1.',
   'normale','en_cours',CURRENT_DATE - INTERVAL '5 days',CURRENT_DATE + INTERVAL '2 days',
   'A','R/C',NULL,NULL,NULL,'Administração','syndic_admin',NULL,TRUE,'Partes comuns'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Condomínio Boavista Center','Bruno Tavares','Coordenação de obras',
   'Acompanhamento da impermeabilização da cobertura — supervisão diária dos trabalhos do prestador externo.',
   'normale','en_cours',CURRENT_DATE - INTERVAL '12 days',CURRENT_DATE + INTERVAL '3 days',
   NULL,'Cobertura',NULL,NULL,NULL,'Administração','syndic_admin',NULL,TRUE,'Cobertura'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Residencial Cedofeita','Bruno Tavares','Inspeção técnica',
   'Verificação periódica do sistema de gás das partes comuns — relatório para o seguro do condomínio.',
   'normale','terminee',CURRENT_DATE - INTERVAL '40 days',CURRENT_DATE - INTERVAL '35 days',
   NULL,NULL,NULL,NULL,NULL,'Administração','syndic_admin',NULL,TRUE,'Instalação de gás'),

  -- Diogo Pereira (Técnico) — petites réparations
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Condomínio Boavista Center','Diogo Pereira','Pequenas reparações',
   'Substituição de 4 lâmpadas LED na garagem + ajuste da fechadura da porta de acesso à zona técnica. Reportado pela condómina Joana Ribeiro.',
   'normale','en_attente',CURRENT_DATE - INTERVAL '2 days',CURRENT_DATE + INTERVAL '1 day',
   NULL,'-1',NULL,NULL,NULL,'Joana Ribeiro','copro','joana.ribeiro@boavista-cdom.pt',TRUE,'Garagem'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Atlântico','Diogo Pereira','Manutenção corrente',
   'Aperto de parafusos do corrimão da escada principal + lubrificação da fechadura da porta de entrada.',
   'normale','terminee',CURRENT_DATE - INTERVAL '20 days',CURRENT_DATE - INTERVAL '18 days',
   'A','Todos',NULL,NULL,NULL,'Administração','syndic_admin',NULL,TRUE,'Escadas e entrada'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Atlântico','Diogo Pereira','Pequenas reparações',
   'URGENTE — verificação de infiltração reportada pelo condómino do 3.º Dto: humidade visível no tecto da casa de banho. Possível fuga do andar superior.',
   'urgente','en_cours',CURRENT_DATE - INTERVAL '1 day',CURRENT_DATE,
   'A','3.º','Dto','André Marques','961 555 123','André Marques','copro','andre.marques@atlantico-cdom.pt',FALSE,'Fração 3.º Dto'),

  -- Tiago Mendes (Técnico) — petites réparations
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Residencial Cedofeita','Tiago Mendes','Manutenção corrente',
   'Reparação de campainha avariada no R/C esquerdo + colocação de batente em falta na porta do hall. Pedido pela Maria Costa.',
   'normale','en_attente',CURRENT_DATE - INTERVAL '3 days',CURRENT_DATE + INTERVAL '4 days',
   'A','R/C','Esq','Maria Costa','917 234 567','Maria Costa','copro','maria.costa@cedofeita-cdom.pt',FALSE,'Fração R/C Esq'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Foz Douro','Tiago Mendes','Pequenas reparações',
   'Pintura de retoque na zona da entrada + substituição da iluminação avariada no corredor do 2.º andar.',
   'normale','en_cours',CURRENT_DATE - INTERVAL '7 days',CURRENT_DATE - INTERVAL '1 day',
   NULL,'2.º',NULL,NULL,NULL,'Administração','syndic_admin',NULL,TRUE,'Entrada e 2.º andar'),

  -- Demandes condóminos sans assignation — affichées dans tab "Residentes"
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Foz Douro',NULL,'Manutenção corrente',
   'Portão automático da garagem fecha muito devagar — pode precisar de revisão do motor.',
   'normale','en_attente',CURRENT_DATE - INTERVAL '8 days',NULL,
   NULL,'-1',NULL,NULL,NULL,'Paulo Fernandes','copro','paulo.fernandes@foz-cdom.pt',TRUE,'Garagem'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Edifício Foz Douro',NULL,'Eletricidade',
   'Iluminação do corredor do 2.º pisca constantemente há dois dias.',
   'normale','en_attente',CURRENT_DATE - INTERVAL '4 days',NULL,
   NULL,'2.º',NULL,NULL,NULL,'Inês Silva','copro','ines.silva@foz-cdom.pt',TRUE,'Corredor 2.º andar'),
  ('389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4','Residencial Cedofeita',NULL,'Construção',
   'Fissura nova no muro lateral do edifício, lado norte. Visível desde há cerca de uma semana.',
   'normale','en_attente',CURRENT_DATE - INTERVAL '10 days',NULL,
   NULL,'Exterior',NULL,NULL,NULL,'Rui Mendes','copro','rui.mendes@cedofeita-cdom.pt',TRUE,'Muro lateral norte');

COMMIT;
