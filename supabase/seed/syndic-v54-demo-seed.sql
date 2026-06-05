-- ════════════════════════════════════════════════════════════════════════════
-- Seed démo Syndic v54 — peuple le cabinet d'un compte pour une démo « vivante ».
--
-- À LANCER dans le SQL Editor Supabase (écriture DB → action manuelle assumée).
-- Le cabinet_id est résolu par EMAIL ci-dessous : ajuste-le si besoin.
--
-- Couvre les modules câblés : Edifícios, Condóminos, Ordens, Contratos, Elevadores,
-- Seguros, Faturação, Impayés/Cobrança + tous les rapports calculés (ContabTec,
-- Urgencias, HistEdificio, MapaFiscal, DashCond, RelGestão, RelatorioMensal).
--
-- Idempotence : décommente le bloc RESET pour repartir propre (⚠️ supprime les
-- données syndic de CE cabinet uniquement).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cab  uuid;
  v_i1   uuid;  v_i2   uuid;  v_i3   uuid;
  v_c1   uuid;  v_c2   uuid;  v_c3   uuid;
BEGIN
  -- ── 1. Résoudre le cabinet (compte de connexion) ──────────────────────────
  SELECT id INTO v_cab FROM auth.users WHERE email = 'admincvlho@gmail.com' LIMIT 1;
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable — ajuste l''email dans le seed.';
  END IF;

  -- ── RESET optionnel (décommenter pour repartir propre) ────────────────────
  -- DELETE FROM syndic_impayes        WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_factures_copro WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_seguros        WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_elevadores     WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_contrats       WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_missions       WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_coproprios     WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_immeubles      WHERE cabinet_id = v_cab;

  -- ── 2. Édifices ───────────────────────────────────────────────────────────
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Edifício Aurora', 'Rua de Santa Catarina 120', 'Porto', '4000-447', 24, 2008, 'Copropriété', 'Frédéric C.', 28, 96000, 52800)
  RETURNING id INTO v_i1;
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Condomínio Boavista Center', 'Av. da Boavista 1203', 'Porto', '4100-130', 40, 2015, 'Copropriété', 'Frédéric C.', 41, 158000, 88600)
  RETURNING id INTO v_i2;
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Residencial Cedofeita', 'Rua de Cedofeita 305', 'Porto', '4050-179', 16, 1998, 'Copropriété', 'Frédéric C.', 19, 61000, 33200)
  RETURNING id INTO v_i3;

  -- ── 3. Copropriétaires ────────────────────────────────────────────────────
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Edifício Aurora', 'A', 2, '2D', 'Sousa', 'Ana', 'ana.sousa@example.pt', '+351 912 345 678', true, 85.5, -420.00, true)
  RETURNING id INTO v_c1;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Edifício Aurora', 'A', 3, '3E', 'Ferreira', 'João', 'joao.ferreira@example.pt', '+351 913 222 111', true, 78.0, 0.00, true)
  RETURNING id INTO v_c2;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Condomínio Boavista Center', 'B', 5, '5A', 'Martins', 'Beatriz', 'b.martins@example.pt', '+351 914 555 333', false, 92.3, -1180.00, false)
  RETURNING id INTO v_c3;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail) VALUES
    (v_cab, 'Condomínio Boavista Center', 'B', 1, '1C', 'Costa', 'Rui', 'rui.costa@example.pt', '+351 915 888 222', true, 70.0, 0.00, true),
    (v_cab, 'Residencial Cedofeita', '', 4, '4B', 'Pereira', 'Marta', 'm.pereira@example.pt', '+351 916 444 777', true, 110.0, -250.00, true);

  -- ── 4. Missions / Ordens (statuts variés : urgente+en_cours → Urgencias) ───
  INSERT INTO syndic_missions (cabinet_id, immeuble, artisan, type, description, priorite, statut, date_creation, date_intervention, montant_devis, montant_facture) VALUES
    (v_cab, 'Edifício Aurora', 'HidroPro Lda', 'Canalização', 'Fuga de água na garagem B2', 'urgente', 'en_cours', CURRENT_DATE - 2, NULL, 480, NULL),
    (v_cab, 'Condomínio Boavista Center', 'ElevaTech', 'Manutenção elevador', 'Inspeção anual elevador A', 'normale', 'terminee', CURRENT_DATE - 20, CURRENT_DATE - 14, 1250, 1250),
    (v_cab, 'Edifício Aurora', 'ConstruFix', 'Pintura', 'Pintura do hall de entrada', 'normale', 'terminee', CURRENT_DATE - 45, CURRENT_DATE - 30, 2100, 2100),
    (v_cab, 'Residencial Cedofeita', 'EletroPorto', 'Eletricidade', 'Curto-circuito no hall', 'urgente', 'acceptee', CURRENT_DATE - 1, NULL, 320, NULL),
    (v_cab, 'Condomínio Boavista Center', 'JardimVerde', 'Jardinagem', 'Manutenção espaços verdes', 'planifiee', 'en_attente', CURRENT_DATE - 5, NULL, 600, NULL),
    (v_cab, 'Edifício Aurora', 'HidroPro Lda', 'Manutenção corrente', 'Substituição bomba de água', 'normale', 'terminee', CURRENT_DATE - 60, CURRENT_DATE - 55, 890, 890);

  -- ── 5. Contrats (categoria variée → MapaFiscal) ───────────────────────────
  INSERT INTO syndic_contrats (cabinet_id, immeuble, fornecedor, categoria, custo_mensal, custo_anual, data_inicio, data_fim, statut, notes) VALUES
    (v_cab, 'Edifício Aurora', 'ElevaTech', 'elevadores', 0, 1250, CURRENT_DATE - 200, CURRENT_DATE + 530, 'ativo', 'Manutenção 2 elevadores'),
    (v_cab, 'Edifício Aurora', 'CleanPro', 'limpezas', 380, 4560, CURRENT_DATE - 150, CURRENT_DATE + 30, 'renovacao', 'Limpeza áreas comuns'),
    (v_cab, 'Condomínio Boavista Center', 'SeguraMax', 'seguranca', 250, 3000, CURRENT_DATE - 90, CURRENT_DATE + 640, 'ativo', 'CCTV + rondas'),
    (v_cab, 'Condomínio Boavista Center', 'JardimVerde', 'jardinagem', 180, 2160, CURRENT_DATE - 300, CURRENT_DATE + 60, 'ativo', 'Espaços verdes'),
    (v_cab, 'Residencial Cedofeita', 'MultiServ', 'outros', 90, 1080, CURRENT_DATE - 400, CURRENT_DATE - 10, 'expirado', 'Diversos');

  -- ── 6. Elevadores ─────────────────────────────────────────────────────────
  INSERT INTO syndic_elevadores (cabinet_id, immeuble, marca, categoria, ema, ultima_inspecao, proxima_inspecao, estado, notes) VALUES
    (v_cab, 'Edifício Aurora', 'OTIS Gen2', 'habitacional', 'EMA-Porto-01', CURRENT_DATE - 60, CURRENT_DATE + 700, 'conforme', ''),
    (v_cab, 'Condomínio Boavista Center', 'Schindler 3300', 'misto', 'EMA-Porto-02', CURRENT_DATE - 120, CURRENT_DATE + 30, 'prazo', 'Inspeção bientôt'),
    (v_cab, 'Residencial Cedofeita', 'KONE MonoSpace', 'habitacional', 'EMA-Porto-03', CURRENT_DATE - 400, CURRENT_DATE - 35, 'atraso', 'Inspeção en retard');

  -- ── 7. Seguros ────────────────────────────────────────────────────────────
  INSERT INTO syndic_seguros (cabinet_id, immeuble, seguradora, tipo, apolice, premio_anual, capital, data_inicio, data_fim, statut, notes) VALUES
    (v_cab, 'Edifício Aurora', 'Fidelidade', 'multirriscos', 'FID-2026-AUR', 2400, 1500000, CURRENT_DATE - 100, CURRENT_DATE + 265, 'ativa', ''),
    (v_cab, 'Condomínio Boavista Center', 'Tranquilidade', 'multirriscos', 'TRQ-2026-BOA', 3800, 2800000, CURRENT_DATE - 50, CURRENT_DATE + 315, 'ativa', '');

  -- ── 8. Faturação (TVA PT 23%) ─────────────────────────────────────────────
  INSERT INTO syndic_factures_copro (cabinet_id, coproprio_id, immeuble_id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut) VALUES
    (v_cab, v_c1, v_i1, 'FT-2026-001', CURRENT_DATE - 30, CURRENT_DATE - 0, 300.00, 23, 369.00, 'Quotas trimestrais T1', 'a_regler'),
    (v_cab, v_c2, v_i1, 'FT-2026-002', CURRENT_DATE - 30, CURRENT_DATE - 0, 280.00, 23, 344.40, 'Quotas trimestrais T1', 'reglee'),
    (v_cab, v_c3, v_i2, 'FT-2026-003', CURRENT_DATE - 15, CURRENT_DATE + 15, 450.00, 23, 553.50, 'Quotas + fundo de reserva', 'a_regler');

  -- ── 9. Impayés (statut ouvert → DashCond + Cobrança) ──────────────────────
  INSERT INTO syndic_impayes (cabinet_id, immeuble_id, coproprio_id, montant, nature, depuis, nb_relances, statut, notes) VALUES
    (v_cab, v_i1, v_c1, 420.00, 'charges_courantes', CURRENT_DATE - 75, 2, 'ouvert', 'Relances envoyées'),
    (v_cab, v_i2, v_c3, 1180.00, 'charges_courantes', CURRENT_DATE - 130, 3, 'en_recouvrement', 'Dossier transmis'),
    (v_cab, v_i3, v_c1, 250.00, 'travaux', CURRENT_DATE - 40, 1, 'ouvert', '');

  RAISE NOTICE 'Seed démo Syndic v54 OK pour cabinet %', v_cab;
END $$;
