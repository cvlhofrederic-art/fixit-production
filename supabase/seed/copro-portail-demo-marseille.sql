-- ════════════════════════════════════════════════════════════════════════════
-- Seed démo PORTAIL COPROPRIÉTAIRE — complément du seed Syndic v54 Marseille.
-- Ajoute à la « Résidence Le Prado » du cabinet de démo tout ce que le portail
-- (app/coproprietaire/dashboard → /api/coproprietaire/espace) lit pour le profil
-- de démo Géraldine Xavier (lib/copro-demo-data.ts, PROFILE_DEMO) : fiche de lot,
-- appels de charges, factures, assemblées et votes, annonces, demandes et travaux.
--
-- MODE D'EMPLOI
--   1. Avoir lancé AVANT syndic-v54-demo-seed-marseille.sql sur le même compte :
--      l'immeuble « Résidence Le Prado » doit exister, sinon le script s'arrête.
--   2. Ouvrir Supabase > SQL Editor (écriture DB → action manuelle assumée, rôle postgres).
--   3. Remplacer <EMAIL_COMPTE_DEMO> ci-dessous (v_email_compte) par l'e-mail du compte de démo
--      (super_admin ou syndic : pour ces rôles, cabinet_id = id du compte, resolveCabinetId
--      dans lib/auth-helpers.ts). Le script s'arrête tant que le paramètre n'est pas remplacé.
--   4. Lancer le bloc DO en entier (bouton Run). Message attendu :
--      « Seed démo portail copropriétaire OK pour cabinet <uuid> … ».
--   5. Ouvrir le portail : il demande la fiche dont email_proprietaire =
--      geraldine.xavier@email.com (profil de démo) dans le cabinet du compte.
--   6. À lancer la veille ou le matin de la démo : les dates des demandes, des annonces
--      et de l'AG convoquée sont relatives à CURRENT_DATE / now().
--
-- CE QUE ÇA CRÉE (cabinet du compte, immeuble « Résidence Le Prado ») :
--   - mise à jour de l'immeuble (48 lots, gestionnaire Hugo Carvalho, budget, règlement) ;
--   - la fiche de Géraldine Xavier (bât. D, 4e étage, lot 12, 450 tantièmes, solde -855 €) ;
--   - 6 appels de charges (T1 à T4 2026, fonds de travaux, 1er appel ravalement) ;
--   - 2 factures copropriétaire réglées, aucun impayé ;
--   - 1 AG extraordinaire convoquée (J+33, 3 résolutions ouvertes au vote) et
--     1 AG ordinaire 2026 clôturée (4 résolutions adoptées, PV, 1 vote par correspondance) ;
--   - 2 annonces (coupure d'eau Le Prado ; convocation AG pour tous les immeubles) ;
--   - 1 assurance multirisque AXA si l'immeuble n'en a aucune (le seed Marseille en crée une) ;
--   - zone signalée + partie commune sur les 12 missions du seed Marseille ;
--   - 2 demandes de Géraldine (ascenseur en attente ; fuite terminée avec 3 messages et
--     la mission liée, rapport d'intervention compris).
--
-- IDEMPOTENCE
--   Relançable sans doublon : toutes les lignes créées portent un marqueur (e-mail
--   geraldine.xavier@email.com, notes / description commençant par « [Démo portail] »,
--   numéros de facture FC-2026-0042 et FC-2025-0117) et sont supprimées en tête de script
--   avant d'être recréées. Les UPDATE (immeuble, missions du seed) sont rejouables.
--   Aucune autre ligne n'est touchée. Tout le bloc est transactionnel : en cas d'erreur,
--   rien n'est modifié.
--
-- PRÉREQUIS DE SCHÉMA
--   Migrations 001 (immeubles, signalements, messages, missions), 004 (coproprios),
--   005 (assemblées, résolutions, votes), 20260516 (appels de charges, factures copro,
--   impayés), 20260602 (avisos, seguros). La migration 20261017_portail_coproprietaire.sql
--   (acces_portail_locataire, origine du signalement, source du vote) est facultative : le script
--   n'écrit pas ces colonnes, sauf origine = 'portail' sur les deux demandes de Géraldine si la
--   colonne existe (sinon le portail les présenterait comme déposées sans connexion).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_email_compte text := '<EMAIL_COMPTE_DEMO>';     -- compte de connexion (super_admin) = cabinet
  v_email        text := 'geraldine.xavier@email.com'; -- profil de démo du portail (PROFILE_DEMO), en minuscules
  v_immeuble     text := 'Résidence Le Prado';
  -- Les 4 copropriétés du seed Marseille (borne les UPDATE des missions)
  v_noms  text[] := ARRAY['Résidence Le Prado', 'Copropriété Les Terrasses du Vieux-Port', 'Résidence Castellane', 'Résidence Euroméditerranée'];
  v_cab   uuid;
  v_i1    uuid;   -- Résidence Le Prado
  v_ger   uuid;   -- fiche syndic_coproprios de Géraldine Xavier
  v_ag1   uuid;   -- AG extraordinaire convoquée
  v_ag2   uuid;   -- AG ordinaire 2026 clôturée
  v_res3  uuid;   -- résolution 3 (ravalement) de l'AG clôturée
  v_sig1  uuid;   -- demande ascenseur (en attente)
  v_sig2  uuid;   -- demande fuite (terminée)
  v_nb    integer;
BEGIN
  -- ── 1. Résoudre le cabinet (compte de connexion) et l'immeuble ────────────
  SELECT id INTO v_cab FROM auth.users WHERE email = v_email_compte LIMIT 1;
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable (%) — corrige v_email_compte en tête du bloc.', v_email_compte;
  END IF;

  SELECT id INTO v_i1 FROM syndic_immeubles WHERE cabinet_id = v_cab AND nom = v_immeuble LIMIT 1;
  IF v_i1 IS NULL THEN
    RAISE EXCEPTION 'Immeuble « % » introuvable pour le cabinet % — lance d''abord syndic-v54-demo-seed-marseille.sql.', v_immeuble, v_cab;
  END IF;

  -- ── Pré-contrôle : FK héritée cabinet_id → syndic_cabinets(id) (migrations 024/036) ──
  -- Même garde que le seed Marseille : si la contrainte existe sur les signalements ou les
  -- missions, la ligne cabinet du compte (id = user_id = id du compte) doit exister.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid IN ('public.syndic_signalements'::regclass, 'public.syndic_missions'::regclass)
      AND contype = 'f'
      AND confrelid = to_regclass('public.syndic_cabinets')
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM syndic_cabinets WHERE id = v_cab) THEN
      INSERT INTO syndic_cabinets (id, user_id, nom, adresse, ville, code_postal)
      VALUES (v_cab, v_cab, 'Cabinet VitFix', '42 rue de la République', 'Marseille', '13002');
      RAISE NOTICE 'Ligne syndic_cabinets créée pour le cabinet % (clé étrangère des signalements / missions).', v_cab;
    END IF;
  END IF;

  -- ── 2. Nettoyage des lignes de démo (idempotence) ─────────────────────────
  -- Ordre : enfants avant parents, et tout ce qui référence la fiche de Géraldine avant
  -- la fiche elle-même (les FK coproprio_id sont en ON DELETE SET NULL : sans cela, des
  -- lignes orphelines resteraient en base).
  DELETE FROM syndic_votes_correspondance
   WHERE cabinet_id = v_cab
     AND coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND lower(email_proprietaire) = v_email);
  -- AG de démo : la suppression cascade sur résolutions, votes et présences.
  DELETE FROM syndic_assemblees WHERE cabinet_id = v_cab AND notes LIKE '[Démo portail]%';

  DELETE FROM syndic_missions
   WHERE cabinet_id = v_cab
     AND (description LIKE '[Démo portail]%'
          OR lower(demandeur_email) = v_email
          OR signalement_id IN (SELECT id FROM syndic_signalements WHERE cabinet_id = v_cab AND lower(demandeur_email) = v_email));
  DELETE FROM syndic_signalement_messages
   WHERE signalement_id IN (SELECT id FROM syndic_signalements
                             WHERE cabinet_id = v_cab AND (lower(demandeur_email) = v_email OR description LIKE '[Démo portail]%'));
  DELETE FROM syndic_signalements
   WHERE cabinet_id = v_cab AND (lower(demandeur_email) = v_email OR description LIKE '[Démo portail]%');

  DELETE FROM syndic_appels_charges
   WHERE cabinet_id = v_cab
     AND (notes LIKE '[Démo portail]%'
          OR coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND lower(email_proprietaire) = v_email));
  -- Numéros de facture uniques par cabinet (idx_factures_copro_numero) : on les retire aussi par numéro.
  DELETE FROM syndic_factures_copro
   WHERE cabinet_id = v_cab
     AND (numero_facture IN ('FC-2026-0042', 'FC-2025-0117')
          OR coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND lower(email_proprietaire) = v_email));
  DELETE FROM syndic_impayes
   WHERE cabinet_id = v_cab
     AND coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND lower(email_proprietaire) = v_email);

  DELETE FROM syndic_avisos  WHERE cabinet_id = v_cab AND notes LIKE '[Démo portail]%';
  DELETE FROM syndic_seguros WHERE cabinet_id = v_cab AND notes LIKE '[Démo portail]%';

  DELETE FROM syndic_coproprios WHERE cabinet_id = v_cab AND lower(email_proprietaire) = v_email;

  -- ── 3. Immeuble « Résidence Le Prado » : taille réelle et règlement de copropriété ──
  UPDATE syndic_immeubles SET
    nb_lots                       = 48,
    gestionnaire                  = 'Hugo Carvalho',
    budget_annuel                 = 45000,
    depenses_annee                = 31200,
    reglement_pdf_nom             = 'Règlement de copropriété — Résidence Le Prado.pdf',
    reglement_date_maj            = DATE '2020-03-10',
    reglement_charges_repartition = 'Charges générales réparties aux tantièmes généraux ; ascenseur et chauffage selon les tantièmes spéciaux par bâtiment.',
    reglement_majorite_ag         = 'Majorité de l''article 24 pour les décisions courantes ; article 25 pour les travaux.',
    reglement_fonds_travaux       = true,
    reglement_fonds_roulement_pct = 5,
    updated_at                    = now()
  WHERE id = v_i1;

  -- ── 4. Fiche de Géraldine Xavier (PROFILE_DEMO : bât. D, 4e étage, lot 12, 450 tantièmes) ──
  -- etage est INTEGER ici (TEXT dans signalements / missions). acces_portail_locataire
  -- (migration 20261017) n'est pas écrit : sa valeur par défaut est déjà false.
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail, notes)
  VALUES (v_cab, v_immeuble, 'D', 4, '12', 'Xavier', 'Géraldine', v_email, '+33 6 12 34 56 78', false, 450, -855.00, true,
          '[Démo portail] Profil de démonstration du portail copropriétaire (lib/copro-demo-data.ts).')
  RETURNING id INTO v_ger;

  -- ── 5. Appels de charges (provision trimestrielle 855 € ; T4 exigible, T1 à T3 soldés) ──
  INSERT INTO syndic_appels_charges (cabinet_id, immeuble_id, coproprio_id, exercice, periode_debut, periode_fin, montant_total, montant_paye, statut, echeance, iban, reference_paiement, notes) VALUES
    (v_cab, v_i1, v_ger, '2026-T4', DATE '2026-10-01', DATE '2026-12-31', 855.00, 0.00,   'a_payer', DATE '2026-10-15', 'FR76 3000 6000 0112 3456 7890 189', 'PAY-2026-004-LOT12', '[Démo portail] Appel de provisions du 4e trimestre 2026 — budget prévisionnel'),
    (v_cab, v_i1, v_ger, '2026-T3', DATE '2026-07-01', DATE '2026-09-30', 855.00, 855.00, 'solde',   DATE '2026-07-15', 'FR76 3000 6000 0112 3456 7890 189', 'PAY-2026-003-LOT12', '[Démo portail] Appel de provisions du 3e trimestre 2026 — réglé le 10/07/2026'),
    (v_cab, v_i1, v_ger, '2026-T2', DATE '2026-04-01', DATE '2026-06-30', 855.00, 855.00, 'solde',   DATE '2026-04-15', 'FR76 3000 6000 0112 3456 7890 189', 'PAY-2026-002-LOT12', '[Démo portail] Appel de provisions du 2e trimestre 2026 — réglé le 11/04/2026'),
    (v_cab, v_i1, v_ger, '2026-T1', DATE '2026-01-01', DATE '2026-03-31', 855.00, 855.00, 'solde',   DATE '2026-01-15', 'FR76 3000 6000 0112 3456 7890 189', 'PAY-2026-001-LOT12', '[Démo portail] Appel de provisions du 1er trimestre 2026 — réglé le 12/01/2026'),
    (v_cab, v_i1, v_ger, 'Fonds de travaux 2026 (art. 14-2-1)',    DATE '2026-01-01', DATE '2026-12-31', 220.00,  0.00, 'a_payer', DATE '2026-11-05', 'FR76 3000 6000 0112 3456 7890 189', 'FDT-2026-001-LOT12', '[Démo portail] Cotisation annuelle au fonds de travaux (art. 14-2-1 de la loi du 10 juillet 1965)'),
    (v_cab, v_i1, v_ger, 'Ravalement façade — 1er appel de fonds', DATE '2026-12-01', DATE '2027-02-28', 1462.50, 0.00, 'a_payer', DATE '2026-12-01', 'FR76 3000 6000 0112 3456 7890 189', 'TRX-2026-001-LOT12', '[Démo portail] Ravalement de la façade du bâtiment D voté en AG ordinaire 2026 — 1er appel (1/3)');

  -- ── 6. Factures copropriétaire réglées (aucun impayé pour Géraldine) ──────
  INSERT INTO syndic_factures_copro (cabinet_id, coproprio_id, immeuble_id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut) VALUES
    (v_cab, v_ger, v_i1, 'FC-2026-0042', DATE '2026-03-20', DATE '2026-04-20', 125.00, 0,  125.00, 'Régularisation des charges 2025 — trop-perçu remboursé', 'reglee'),
    (v_cab, v_ger, v_i1, 'FC-2025-0117', DATE '2025-12-10', DATE '2026-01-10', 10.00,  20, 12.00,  'Frais de relance — charges du 4e trimestre 2025', 'reglee');

  -- ── 7. Assemblées générales (statuts avec accents imposés par le CHECK) ───
  -- 7a. AG extraordinaire convoquée à J+33, 18 h (Europe/Paris) : vote par correspondance ouvert.
  INSERT INTO syndic_assemblees (cabinet_id, titre, immeuble, date_ag, lieu, type_ag, statut, ordre_du_jour, quorum, total_tantiemes, presents, convocation_sent_at, convocation_count, notes)
  VALUES (
    v_cab,
    'AG extraordinaire — Chaudière collective',
    v_immeuble,
    ((CURRENT_DATE + 33) + TIME '18:00') AT TIME ZONE 'Europe/Paris',
    'Salle polyvalente, 182 avenue du Prado, 13008 Marseille',
    'extraordinaire',
    'convoquée',
    jsonb_build_array(
      'Remplacement de la chaudière collective (gaz à condensation) : choix du devis',
      'Financement des travaux par appels de fonds et recours au fonds de travaux',
      'Réalisation du diagnostic de performance énergétique (DPE) collectif',
      'Questions diverses'
    ),
    50, 10000, 0,
    now() - interval '12 days', 1,
    '[Démo portail] AG extraordinaire convoquée — vote par correspondance ouvert sur le portail.'
  )
  RETURNING id INTO v_ag1;

  INSERT INTO syndic_resolutions (assemblee_id, cabinet_id, titre, description, numero_ordre, majorite, vote_pour, vote_contre, vote_abstention, statut) VALUES
    (v_ag1, v_cab, 'Remplacement de la chaudière collective', 'Remplacement de la chaudière collective du bâtiment D par une chaudière gaz à condensation, selon le devis de Plomberie du Vieux-Port (38 400 € TTC).', 1, 'art25', 0, 0, 0, 'en_cours'),
    (v_ag1, v_cab, 'Financement de la chaudière', 'Financement par trois appels de fonds (janvier, mars et mai 2027) et prélèvement de 6 000 € sur le fonds de travaux.', 2, 'art24', 0, 0, 0, 'en_cours'),
    (v_ag1, v_cab, 'DPE collectif', 'Réalisation du diagnostic de performance énergétique collectif de la résidence (obligation loi Climat et résilience).', 3, 'art24', 0, 0, 0, 'en_cours');

  -- 7b. AG ordinaire 2026 clôturée (11 juin 2026, 18 h) : 4 résolutions adoptées, PV, 8 200 tantièmes présents ou représentés.
  INSERT INTO syndic_assemblees (cabinet_id, titre, immeuble, date_ag, lieu, type_ag, statut, ordre_du_jour, quorum, total_tantiemes, presents, signataire_nom, signataire_role, signature_ts, convocation_sent_at, convocation_count, pv_content, notes)
  VALUES (
    v_cab,
    'AG ordinaire 2026',
    v_immeuble,
    TIMESTAMP '2026-06-11 18:00' AT TIME ZONE 'Europe/Paris',
    'Salle polyvalente, 182 avenue du Prado, 13008 Marseille',
    'ordinaire',
    'clôturée',
    jsonb_build_array(
      'Approbation des comptes de l''exercice 2025',
      'Vote du budget prévisionnel 2026',
      'Ravalement de la façade du bâtiment D : travaux et appels de fonds',
      'Renouvellement du contrat de syndic',
      'Questions diverses'
    ),
    50, 10000, 8200,
    'Laurent Moreau', 'Président de séance', TIMESTAMP '2026-06-11 20:15' AT TIME ZONE 'Europe/Paris',
    TIMESTAMP '2026-05-20 10:00' AT TIME ZONE 'Europe/Paris', 1,
    'PROCÈS-VERBAL DE L''ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 11 JUIN 2026
Syndicat des copropriétaires de la Résidence Le Prado — 182 avenue du Prado, 13008 Marseille

La séance est ouverte à 18 h 10 sous la présidence de M. Laurent Moreau, élu président de séance. Le cabinet VitFix, syndic, assure le secrétariat. Sont présents ou représentés 8 200 tantièmes sur 10 000, dont 450 tantièmes exprimés par correspondance.

Résolution n° 1 — Approbation des comptes de l''exercice 2025 (art. 24) : adoptée (pour 7 150, contre 450, abstention 600).
Résolution n° 2 — Vote du budget prévisionnel 2026, soit 45 000 € (art. 24) : adoptée (pour 6 800, contre 900, abstention 500).
Résolution n° 3 — Ravalement de la façade du bâtiment D selon le devis de Façades de Provence, 97 500 € TTC, financé par trois appels de fonds (art. 25) : adoptée (pour 6 100, contre 1 650, abstention 450).
Résolution n° 4 — Renouvellement du contrat de syndic du cabinet VitFix pour trois ans (art. 25) : adoptée (pour 5 600, contre 1 900, abstention 700).

Questions diverses : les copropriétaires demandent un contrôle du bruit de l''ascenseur du bâtiment D ; le syndic saisira l''ascensoriste.
L''ordre du jour étant épuisé, la séance est levée à 20 h 05.',
    '[Démo portail] AG ordinaire 2026 clôturée — PV consultable sur le portail.'
  )
  RETURNING id INTO v_ag2;

  INSERT INTO syndic_resolutions (assemblee_id, cabinet_id, titre, description, numero_ordre, majorite, vote_pour, vote_contre, vote_abstention, statut) VALUES
    (v_ag2, v_cab, 'Approbation des comptes de l''exercice 2025', 'Approbation des comptes de l''exercice clos le 31 décembre 2025 et quitus au syndic.', 1, 'art24', 7150, 450, 600, 'adoptée'),
    (v_ag2, v_cab, 'Vote du budget prévisionnel 2026', 'Budget prévisionnel de 45 000 € pour l''exercice 2026, appelé en quatre provisions trimestrielles.', 2, 'art24', 6800, 900, 500, 'adoptée');
  INSERT INTO syndic_resolutions (assemblee_id, cabinet_id, titre, description, numero_ordre, majorite, vote_pour, vote_contre, vote_abstention, statut)
  VALUES (v_ag2, v_cab, 'Ravalement de la façade du bâtiment D', 'Ravalement de la façade du bâtiment D selon le devis de Façades de Provence (97 500 € TTC), financé par trois appels de fonds à compter de décembre 2026.', 3, 'art25', 6100, 1650, 450, 'adoptée')
  RETURNING id INTO v_res3;
  INSERT INTO syndic_resolutions (assemblee_id, cabinet_id, titre, description, numero_ordre, majorite, vote_pour, vote_contre, vote_abstention, statut) VALUES
    (v_ag2, v_cab, 'Renouvellement du contrat de syndic', 'Renouvellement du contrat de syndic du cabinet VitFix pour une durée de trois ans.', 4, 'art25', 5600, 1900, 700, 'adoptée');

  -- Vote par correspondance de Géraldine sur la résolution 3 (ravalement). La colonne
  -- « copropriétaire » porte un accent : identifiant entre guillemets doubles.
  -- source / horodatage (migration 20261017) non écrits : défaut « papier ».
  INSERT INTO syndic_votes_correspondance (resolution_id, cabinet_id, "copropriétaire", coproprio_id, tantiemes, vote, date_reception)
  VALUES (v_res3, v_cab, 'Géraldine Xavier', v_ger, 450, 'pour', DATE '2026-06-05');

  -- ── 8. Annonces (quadro de avisos : categoria / prioridade imposées par le CHECK) ──
  INSERT INTO syndic_avisos (cabinet_id, immeuble, titulo, descricao, categoria, prioridade, fixado, notes, created_at) VALUES
    (v_cab, v_immeuble, 'Coupure d''eau froide — mardi 20 octobre',
     'En raison du remplacement de la vanne générale du bâtiment D, l''eau froide sera coupée mardi 20 octobre de 9 h à 12 h. Merci de prévoir une réserve d''eau et de fermer vos robinets avant la remise en service. Intervention : Plomberie du Vieux-Port.',
     'manutencao', 'urgente', false, '[Démo portail] Annonce Résidence Le Prado', now() - interval '2 days'),
    (v_cab, '', 'Convocation — AG extraordinaire',
     'Les convocations à l''assemblée générale extraordinaire (remplacement de la chaudière collective, financement, DPE collectif) ont été adressées à tous les copropriétaires. Le vote par correspondance est ouvert sur votre espace jusqu''à la veille de la séance.',
     'assembleia', 'importante', true, '[Démo portail] Annonce pour tous les immeubles', now() - interval '12 days');

  -- ── 9. Assurance (tipo / statut imposés par le CHECK) — seulement si l'immeuble n'en a aucune ──
  -- Le seed Marseille en crée déjà une (Mutuelle Provence Habitat) : dans ce cas rien n'est ajouté.
  IF NOT EXISTS (SELECT 1 FROM syndic_seguros WHERE cabinet_id = v_cab AND immeuble = v_immeuble) THEN
    INSERT INTO syndic_seguros (cabinet_id, immeuble, seguradora, tipo, apolice, premio_anual, capital, data_inicio, data_fim, statut, notes)
    VALUES (v_cab, v_immeuble, 'AXA', 'multirriscos', 'MRI-2026-4471', 4800, 2000000, DATE '2026-01-01', DATE '2026-12-31', 'ativa',
            '[Démo portail] Multirisque immeuble : incendie, dégâts des eaux, responsabilité civile du syndicat');
  END IF;

  -- ── 10. Missions du seed Marseille : partie commune + zone signalée ────────
  -- Le portail n'affiche à un copropriétaire que les travaux des parties communes (ou de son
  -- lot) : sans ces colonnes, les 12 missions du seed resteraient invisibles. Chaque mission
  -- est reconnue par le début de sa description (seed Marseille, section 4).
  UPDATE syndic_missions SET
    est_partie_commune = true,
    zone_signalee = CASE
      WHEN description LIKE 'Fuite sur la colonne d''eau froide%'              THEN 'Gaine technique / colonne d''eau froide'
      WHEN description LIKE 'Ascenseur bloqué entre le 3e et le 4e étage%'     THEN 'Ascenseur'
      WHEN description LIKE 'Disjonctions répétées du tableau%'                THEN 'Escalier'
      WHEN description LIKE 'Ravalement de la façade sur rue%'                 THEN 'Façade extérieure'
      WHEN description LIKE 'Réfection de l''étanchéité de la toiture-terrasse%' THEN 'Toiture / terrasse'
      WHEN description LIKE 'Visite d''entretien semestrielle%'                THEN 'Ascenseur'
      WHEN description LIKE 'Remise en peinture du hall d''entrée%'            THEN 'Hall d''entrée'
      WHEN description LIKE 'Remplacement du ferme-porte%'                     THEN 'Porte d''entrée de l''immeuble'
      WHEN description LIKE 'Remplacement de 6 blocs d''éclairage%'            THEN 'Parking / garage'
      WHEN description LIKE 'Désembouage du réseau de chauffage%'              THEN 'Chaufferie'
      WHEN description LIKE 'Taille des haies%'                                THEN 'Espaces verts'
      WHEN description LIKE 'Remplacement du vitrage fissuré%'                 THEN 'Hall d''entrée'
      ELSE zone_signalee
    END,
    updated_at = now()
  WHERE cabinet_id = v_cab
    AND immeuble = ANY (v_noms)
    AND signalement_id IS NULL
    AND num_lot IS NULL
    AND est_partie_commune IS DISTINCT FROM true
    AND description LIKE ANY (ARRAY[
      'Fuite sur la colonne d''eau froide%', 'Ascenseur bloqué entre le 3e et le 4e étage%', 'Disjonctions répétées du tableau%',
      'Ravalement de la façade sur rue%', 'Réfection de l''étanchéité de la toiture-terrasse%', 'Visite d''entretien semestrielle%',
      'Remise en peinture du hall d''entrée%', 'Remplacement du ferme-porte%', 'Remplacement de 6 blocs d''éclairage%',
      'Désembouage du réseau de chauffage%', 'Taille des haies%', 'Remplacement du vitrage fissuré%'
    ]);
  GET DIAGNOSTICS v_nb = ROW_COUNT;

  -- ── 11. Demandes de Géraldine (signalements) ───────────────────────────────
  -- etage et num_lot sont TEXT ici. demandeur_email en minuscules : le portail cherche
  -- l'e-mail exact (route /api/coproprietaire/espace).
  -- 11a. Bruit d'ascenseur — en attente, un message du syndic.
  INSERT INTO syndic_signalements (cabinet_id, immeuble_nom, demandeur_nom, demandeur_role, demandeur_email, demandeur_telephone, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee, created_at, updated_at)
  VALUES (v_cab, v_immeuble, 'Géraldine Xavier', 'coproprio', v_email, '+33 6 12 34 56 78', 'Ascenseur',
          '[Démo portail] Bruit anormal de l''ascenseur du bâtiment D entre le 3e et le 4e étage, surtout le matin.',
          'normale', 'en_attente', 'D', '4', '12', true, 'Ascenseur', now() - interval '6 days', now() - interval '5 days')
  RETURNING id INTO v_sig1;

  INSERT INTO syndic_signalement_messages (signalement_id, auteur, role, texte, created_at) VALUES
    (v_sig1, 'Syndic', 'syndic', 'Demande bien reçue : nous contactons l''ascensoriste pour une visite de contrôle.', now() - interval '5 days');

  -- 11b. Fuite au plafond du palier — terminée, 3 messages, mission liée avec rapport d'intervention.
  INSERT INTO syndic_signalements (cabinet_id, immeuble_nom, demandeur_nom, demandeur_role, demandeur_email, demandeur_telephone, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee, artisan_assigne, created_at, updated_at)
  VALUES (v_cab, v_immeuble, 'Géraldine Xavier', 'coproprio', v_email, '+33 6 12 34 56 78', 'Plomberie',
          '[Démo portail] Fuite d''eau au plafond du palier du 4e étage',
          'urgente', 'terminee', 'D', '4', '12', true, 'Couloir / palier', 'Plomberie du Vieux-Port', now() - interval '30 days', now() - interval '28 days')
  RETURNING id INTO v_sig2;

  INSERT INTO syndic_signalement_messages (signalement_id, auteur, role, texte, created_at) VALUES
    (v_sig2, 'Géraldine Xavier', 'coproprio', 'Merci de faire vite : l''eau goutte du plafond du palier devant ma porte et une auréole s''agrandit depuis ce matin.', now() - interval '30 days' + interval '1 hour'),
    (v_sig2, 'Syndic', 'syndic', 'Mission confiée à Plomberie du Vieux-Port — intervention prévue le ' || to_char(CURRENT_DATE - 29, 'DD/MM/YYYY') || ' dans la matinée. L''accès au palier est libre, aucune présence n''est nécessaire.', now() - interval '30 days' + interval '3 hours'),
    (v_sig2, 'Syndic', 'syndic', 'Intervention terminée : le joint défectueux de la colonne d''évacuation a été remplacé et le plafond est sec. Le rapport de l''artisan est joint à votre demande.', now() - interval '28 days');

  INSERT INTO syndic_missions (cabinet_id, signalement_id, immeuble, artisan, type, description, priorite, statut, date_creation, date_intervention, montant_devis, montant_facture, batiment, etage, num_lot, demandeur_nom, demandeur_role, demandeur_email, est_partie_commune, zone_signalee, travail_effectue, materiaux_utilises, problemes_constates, recommandations, date_rapport, duree_intervention, created_at, updated_at)
  VALUES (v_cab, v_sig2, v_immeuble, 'Plomberie du Vieux-Port', 'Plomberie',
          '[Démo portail] Fuite d''eau au plafond du palier du 4e étage du bâtiment D : recherche de fuite et réparation',
          'urgente', 'terminee', CURRENT_DATE - 30, CURRENT_DATE - 29, 420, 420,
          'D', '4', '12', 'Géraldine Xavier', 'coproprio', v_email, true, 'Couloir / palier',
          'Ouverture d''une trappe dans le faux plafond du palier, localisation de la fuite sur le raccord de la colonne d''évacuation des eaux usées du 5e étage, remplacement du joint et du collier de serrage, essai en charge, séchage et contrôle du plafond.',
          'Joint EPDM Ø 100, collier de serrage inox, mastic sanitaire, 1 plaque de faux plafond',
          'Joint d''origine (2008) durci et fendu ; traces d''humidité anciennes sur l''isolant du faux plafond, remplacé sur 0,5 m².',
          'Programmer le contrôle des raccords des colonnes d''évacuation des bâtiments C et D (même génération) lors de la prochaine visite d''entretien.',
          CURRENT_DATE - 29, '2 h',
          now() - interval '30 days' + interval '4 hours', now() - interval '28 days');

  -- Provenance (migration 20261017) : les deux demandes sont « déposées depuis le portail ». Colonne
  -- absente → rien (SQL dynamique : une référence directe échouerait à la préparation du bloc).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'syndic_signalements' AND column_name = 'origine') THEN
    EXECUTE 'UPDATE syndic_signalements SET origine = ''portail'' WHERE id = ANY ($1)' USING ARRAY[v_sig1, v_sig2];
  END IF;

  RAISE NOTICE 'Seed démo portail copropriétaire OK pour cabinet % — immeuble % (%), fiche Géraldine Xavier % ; % mission(s) du seed Marseille passée(s) en partie commune.', v_cab, v_immeuble, v_i1, v_ger, v_nb;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à lancer APRÈS le bloc ci-dessus (même e-mail de compte).
--
-- 1) Lignes de démo du portail pour le cabinet. Attendu : coproprios 1 · appels 6 ·
--    factures 2 · impayes 0 · assemblees 2 · resolutions 7 · votes 1 · avisos 2 ·
--    signalements 2 · messages 4 · missions liées 1 · missions parties communes ≥ 13.
--
-- WITH cab AS (SELECT id FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1),
--      ger AS (SELECT c.id FROM syndic_coproprios c, cab WHERE c.cabinet_id = cab.id AND lower(c.email_proprietaire) = 'geraldine.xavier@email.com')
-- SELECT 'syndic_coproprios' AS table_demo, (SELECT count(*) FROM ger) AS nb
-- UNION ALL SELECT 'syndic_appels_charges',  (SELECT count(*) FROM syndic_appels_charges t WHERE t.coproprio_id IN (SELECT id FROM ger))
-- UNION ALL SELECT 'syndic_factures_copro',  (SELECT count(*) FROM syndic_factures_copro t WHERE t.coproprio_id IN (SELECT id FROM ger))
-- UNION ALL SELECT 'syndic_impayes',         (SELECT count(*) FROM syndic_impayes t WHERE t.coproprio_id IN (SELECT id FROM ger))
-- UNION ALL SELECT 'syndic_assemblees',      (SELECT count(*) FROM syndic_assemblees t, cab WHERE t.cabinet_id = cab.id AND t.notes LIKE '[Démo portail]%')
-- UNION ALL SELECT 'syndic_resolutions',     (SELECT count(*) FROM syndic_resolutions r WHERE r.assemblee_id IN (SELECT t.id FROM syndic_assemblees t, cab WHERE t.cabinet_id = cab.id AND t.notes LIKE '[Démo portail]%'))
-- UNION ALL SELECT 'syndic_votes_correspondance', (SELECT count(*) FROM syndic_votes_correspondance v WHERE v.coproprio_id IN (SELECT id FROM ger))
-- UNION ALL SELECT 'syndic_avisos',          (SELECT count(*) FROM syndic_avisos t, cab WHERE t.cabinet_id = cab.id AND t.notes LIKE '[Démo portail]%')
-- UNION ALL SELECT 'syndic_signalements',    (SELECT count(*) FROM syndic_signalements t, cab WHERE t.cabinet_id = cab.id AND lower(t.demandeur_email) = 'geraldine.xavier@email.com')
-- UNION ALL SELECT 'syndic_signalement_messages', (SELECT count(*) FROM syndic_signalement_messages m WHERE m.signalement_id IN (SELECT t.id FROM syndic_signalements t, cab WHERE t.cabinet_id = cab.id AND lower(t.demandeur_email) = 'geraldine.xavier@email.com'))
-- UNION ALL SELECT 'syndic_missions (liées)', (SELECT count(*) FROM syndic_missions t, cab WHERE t.cabinet_id = cab.id AND t.signalement_id IS NOT NULL AND lower(t.demandeur_email) = 'geraldine.xavier@email.com')
-- UNION ALL SELECT 'syndic_missions (parties communes)', (SELECT count(*) FROM syndic_missions t, cab WHERE t.cabinet_id = cab.id AND t.est_partie_commune = true);
--
-- 2) L'immeuble vu par le portail :
--
-- SELECT nom, nb_lots, gestionnaire, budget_annuel, depenses_annee, reglement_pdf_nom, reglement_fonds_travaux
-- FROM syndic_immeubles WHERE cabinet_id = (SELECT id FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1) AND nom = 'Résidence Le Prado';
-- ════════════════════════════════════════════════════════════════════════════
