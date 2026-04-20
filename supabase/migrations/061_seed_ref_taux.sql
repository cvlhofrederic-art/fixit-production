-- Migration 061 — Seed ref_taux with 2026 rates for FR and PT

-- FRANCE — Cotisations sociales
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('FR', 'cotisations_sociales', 'auto_entrepreneur', 22.0000, '2026-01-01', 'URSSAF barème 2026 — activité artisanale BTP', 'Cotisation forfaitaire auto-entrepreneur artisan'),
  ('FR', 'versement_liberatoire', 'auto_entrepreneur', 1.7000, '2026-01-01', 'CGI art. 151-0', 'Versement libératoire IR optionnel'),
  ('FR', 'cotisations_sociales', 'micro_bic', 22.0000, '2026-01-01', 'URSSAF barème 2026', 'Cotisations micro-BIC artisan'),
  ('FR', 'abattement_micro', 'micro_bic', 50.0000, '2026-01-01', 'CGI art. 50-0', 'Abattement forfaitaire BIC'),
  -- Micro-BNC
  ('FR', 'cotisations_sociales', 'micro_bnc', 22.0000, '2026-01-01', 'URSSAF barème 2026', 'Cotisations micro-BNC artisan'),
  ('FR', 'abattement_micro', 'micro_bnc', 34.0000, '2026-01-01', 'CGI art. 102 ter', 'Abattement forfaitaire BNC'),
  ('FR', 'cotisations_sociales', 'ei', 45.0000, '2026-01-01', 'SSI barème 2026 — fourchette haute', 'Cotisations SSI sur bénéfice (variable 40-45%)'),
  -- EURL IS
  ('FR', 'charges_patronales', 'eurl_is', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard sur masse salariale'),
  ('FR', 'cotisations_sociales', 'eurl_is', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant TNS', 'Cotisations SSI gérant majoritaire'),
  ('FR', 'is', 'eurl_is', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'eurl_is', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- EURL IR
  ('FR', 'charges_patronales', 'eurl_ir', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard'),
  ('FR', 'cotisations_sociales', 'eurl_ir', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant TNS', 'Cotisations SSI gérant majoritaire'),
  -- SARL
  ('FR', 'charges_patronales', 'sarl', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard'),
  ('FR', 'cotisations_sociales', 'sarl', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant majoritaire', 'Cotisations SSI gérant majoritaire'),
  ('FR', 'is', 'sarl', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sarl', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SASU
  ('FR', 'charges_patronales', 'sasu', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sasu', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sasu', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sasu', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SAS
  ('FR', 'charges_patronales', 'sas', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sas', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sas', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sas', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SA FR
  ('FR', 'charges_patronales', 'sa_fr', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sa_fr', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sa_fr', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sa_fr', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal');

-- IS seuils PME
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, seuil_min, seuil_max, date_debut_validite, source_reglementaire, description) VALUES
  ('FR', 'is_seuil_pme', 'all', 15.0000, 0, 42500.00, '2026-01-01', 'CGI art. 219 I-b — seuil PME 2026', 'IS 15% applicable jusqu''à 42 500 € de bénéfice'),
  ('FR', 'is_seuil_pme', 'all', 25.0000, 42500.01, NULL, '2026-01-01', 'CGI art. 219 I', 'IS 25% au-delà du seuil PME');

-- Contributions BTP FR
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('FR', 'cibtp', 'all', 19.8000, '2026-01-01', 'CIBTP barème 2026', 'Congés payés BTP'),
  ('FR', 'intemperies', 'all', 0.6800, '2026-01-01', 'CIBTP barème 2026', 'Cotisation intempéries BTP'),
  ('FR', 'oppbtp', 'all', 0.1100, '2026-01-01', 'OPPBTP 2026', 'Formation et prévention BTP'),
  ('FR', 'pro_btp', 'all', 3.2000, '2026-01-01', 'PRO BTP barème 2026', 'Prévoyance et mutuelle BTP');

-- TVA France
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('FR', 'tva', 'normal', 20.0000, '2026-01-01', 'CGI art. 278', 'TVA taux normal'),
  ('FR', 'tva', 'intermediaire', 10.0000, '2026-01-01', 'CGI art. 279-0 bis', 'TVA travaux rénovation logement > 2 ans'),
  ('FR', 'tva', 'reduit', 5.5000, '2026-01-01', 'CGI art. 278-0 bis A', 'TVA taux réduit — travaux amélioration énergétique');

-- PORTUGAL
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('PT', 'cotisations_sociales', 'eni', 21.4000, '2026-01-01', 'Código dos Regimes Contributivos art. 168', 'Segurança Social ENI'),
  ('PT', 'cotisations_sociales', 'trabalhador_independente', 21.4000, '2026-01-01', 'Código dos Regimes Contributivos art. 168', 'Segurança Social — taux sur 70% du revenu'),
  ('PT', 'base_incidence', 'trabalhador_independente', 70.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 162', 'Base d''incidence: 70% du revenu relevante'),
  ('PT', 'tsu_patronal', 'unipessoal_lda', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal'),
  ('PT', 'tsu_salarial', 'unipessoal_lda', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'unipessoal_lda', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT'),
  ('PT', 'irc', 'unipessoal_lda', 17.0000, '2026-01-01', 'CIRC art. 87 n.2', 'IRC taux réduit PME'),
  ('PT', 'irc', 'unipessoal_lda', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal'),
  ('PT', 'tsu_patronal', 'lda', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal'),
  ('PT', 'tsu_salarial', 'lda', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'lda', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT'),
  ('PT', 'irc', 'lda', 17.0000, '2026-01-01', 'CIRC art. 87 n.2', 'IRC taux réduit PME'),
  ('PT', 'irc', 'lda', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal'),
  ('PT', 'tsu_patronal', 'sa_pt', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal'),
  ('PT', 'tsu_salarial', 'sa_pt', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'sa_pt', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT'),
  ('PT', 'irc', 'sa_pt', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal');

-- IRC seuils PME PT
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, seuil_min, seuil_max, date_debut_validite, source_reglementaire, description) VALUES
  ('PT', 'irc_seuil_pme', 'all', 17.0000, 0, 50000.00, '2026-01-01', 'CIRC art. 87 n.2', 'IRC 17% sur premiers 50 000 € — PME'),
  ('PT', 'irc_seuil_pme', 'all', 21.0000, 50000.01, NULL, '2026-01-01', 'CIRC art. 87 n.1', 'IRC 21% au-delà');

-- Contributions BTP PT
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('PT', 'seguro_acidentes', 'all', 2.5000, '2026-01-01', 'Lei 98/2009 — Seguro de Acidentes de Trabalho', 'Assurance accidents du travail (taux moyen BTP)'),
  ('PT', 'derrama_municipal', 'all', 1.5000, '2026-01-01', 'Lei das Finanças Locais — taxa média', 'Derrama municipal (taux moyen)');

-- IVA Portugal
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description) VALUES
  ('PT', 'iva', 'normal', 23.0000, '2026-01-01', 'CIVA art. 18 n.1-c', 'IVA taxa normal'),
  ('PT', 'iva', 'intermediaire', 13.0000, '2026-01-01', 'CIVA Lista II', 'IVA taxa intermédia'),
  ('PT', 'iva', 'reduit', 6.0000, '2026-01-01', 'CIVA Lista I', 'IVA taxa reduzida');
