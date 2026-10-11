-- ════════════════════════════════════════════════════════════════════════════
-- Seed démo Syndic v54 — version MARSEILLE (cabinet marseillais fictif).
-- Même structure que syndic-v54-demo-seed-fr.sql (Lyon), données transposées à Marseille.
--
-- MODE D'EMPLOI
--   1. Ouvrir Supabase > SQL Editor (écriture DB → action manuelle assumée, rôle postgres).
--   2. Remplacer TOUTES les occurrences de <EMAIL_COMPTE_DEMO> (Ctrl+H) par l'e-mail du compte
--      qui fera la démo. Ce compte doit avoir le rôle syndic ou super_admin : pour ces rôles,
--      le cabinet = id du compte (resolveCabinetId, lib/auth-helpers.ts). Un compte employé
--      (syndic_*) verrait le cabinet de son employeur, pas ces données.
--      Sans remplacement, le script s'arrête (« Compte introuvable ») avant toute insertion.
--   3. Lancer le bloc DO en entier (bouton Run). Message attendu :
--      « Seed démo Syndic v54 Marseille OK pour cabinet <uuid> ».
--   4. Lancer les requêtes de vérification en fin de fichier (commentées).
--   5. À lancer la veille ou le matin de la démo : toutes les dates sont relatives à
--      CURRENT_DATE (urgences d'hier, échéances à 30 jours, trimestre en cours…).
--
-- CE QUE ÇA CRÉE (cabinet « Cabinet VitFix », Marseille 2e) :
--   - 4 copropriétés : Résidence Le Prado (8e), Copropriété Les Terrasses du Vieux-Port (7e),
--     Résidence Castellane (6e), Résidence Euroméditerranée (2e) ;
--   - 14 copropriétaires (tantièmes en millièmes ; 4 débiteurs, 1 créditeur) ;
--   - 12 missions d'artisans (3 urgentes en cours ou acceptées, ravalement, toiture…) ;
--   - 10 contrats (ascenseur, nettoyage, espaces verts, sécurité incendie, dératisation) ;
--   - 4 ascenseurs (contrôle technique quinquennal : conforme / échéance proche / en retard) ;
--   - 5 polices d'assurance (4 multirisques immeuble + 1 dommages-ouvrage) ;
--   - 17 factures copropriétaires (appels de provisions sans TVA, frais et état daté à 20 %) ;
--   - 6 impayés (charges courantes, travaux, frais ; dont 1 en recouvrement et 1 soldé).
--   Les noms, adresses, entreprises, assureurs, e-mails (@example.fr) et téléphones
--   (+33 6 00 00 00 xx) sont fictifs.
--
-- IDEMPOTENCE
--   - Le script refuse de tourner deux fois sur le même cabinet (« Garde d'idempotence ») :
--     décommenter le RESET, variante A (ciblée), pour repartir propre — elle ne supprime que
--     les lignes de ces 4 copropriétés de démo.
--   - Si le compte porte déjà le seed portugais (Porto) ou d'autres données de test, le RESET
--     COMPLET (variante B) vide les 8 tables syndic de CE cabinet uniquement.
--     ATTENTION, irréversible : il supprime aussi les données saisies à la main sur ce cabinet.
--   - Tout le bloc est transactionnel : en cas d'erreur, rien n'est inséré.
--   - La ligne syndic_cabinets éventuellement créée (voir LIMITES CONNUES) n'est supprimée par
--     aucun RESET : ne pas la supprimer à la main, la clé étrangère des missions est en
--     ON DELETE CASCADE (toutes les missions du cabinet seraient effacées).
--
-- LIMITES CONNUES
--   - Tables non couvertes (absentes du seed PT) : syndic_artisans, syndic_appels_charges,
--     syndic_recouvrement, syndic_team_members… Les artisans des missions sont du texte libre.
--   - L'écran « Assurance obligatoire du syndicat » (ModSeguroObr) ne liste que les polices
--     de type 'incendio' : volontairement aucune police « incendie » séparée (en France la
--     garantie incendie est incluse dans la multirisque immeuble) → écran vide en démo.
--   - Clé étrangère héritée fk_syndic_missions_cabinet (migrations 024/036) : si elle existe
--     en base, les missions exigent une ligne syndic_cabinets.id = id du compte. Le script
--     crée alors cette ligne (« Cabinet VitFix », Lyon) si elle manque (« Pré-contrôle »).
--
-- Valeurs imposées par les CHECK (gardées en portugais) : contrats.categoria / statut,
-- elevadores.categoria / estado, seguros.tipo / statut.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cab   uuid;
  -- Les 4 copropriétés de démo (sert à la garde d'idempotence et au RESET ciblé)
  v_noms  text[] := ARRAY['Résidence Le Prado', 'Copropriété Les Terrasses du Vieux-Port', 'Résidence Castellane', 'Résidence Euroméditerranée'];
  -- Trimestre en cours / précédent (provisions exigibles le 1er jour du trimestre, art. 14-1 loi 1965)
  v_annee          text := to_char(CURRENT_DATE, 'YYYY');
  v_trim           date := date_trunc('quarter', CURRENT_DATE)::date;
  v_trim_prec      date := (date_trunc('quarter', CURRENT_DATE) - interval '3 months')::date;
  v_lib_trim       text := 'T' || extract(quarter FROM CURRENT_DATE)::int || ' ' || to_char(CURRENT_DATE, 'YYYY');
  v_lib_trim_prec  text := 'T' || extract(quarter FROM CURRENT_DATE - interval '3 months')::int || ' ' || to_char(CURRENT_DATE - interval '3 months', 'YYYY');
  v_lib_trim_prec2 text := 'T' || extract(quarter FROM CURRENT_DATE - interval '6 months')::int || ' ' || to_char(CURRENT_DATE - interval '6 months', 'YYYY');
  v_i1  uuid;  v_i2  uuid;  v_i3  uuid;  v_i4  uuid;
  v_c1  uuid;  v_c2  uuid;  v_c3  uuid;  v_c4  uuid;  v_c5  uuid;  v_c6  uuid;  v_c7  uuid;
  v_c8  uuid;  v_c9  uuid;  v_c10 uuid;  v_c11 uuid;  v_c12 uuid;  v_c13 uuid;  v_c14 uuid;
BEGIN
  -- ── 1. Résoudre le cabinet (compte de connexion) ──────────────────────────
  SELECT id INTO v_cab FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1;
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable — remplace <EMAIL_COMPTE_DEMO> par l''e-mail du compte de démo.';
  END IF;

  -- ── RESET optionnel (décommenter UNE des deux variantes) ──────────────────
  -- Variante A — RESET CIBLÉ : uniquement les lignes des 4 copropriétés de démo FR.
  -- (impayés et factures d'abord : leurs FK passent à NULL si l'immeuble est supprimé avant)
  -- DELETE FROM syndic_impayes        WHERE cabinet_id = v_cab AND (immeuble_id IN (SELECT id FROM syndic_immeubles WHERE cabinet_id = v_cab AND nom = ANY (v_noms)) OR coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms)));
  -- DELETE FROM syndic_factures_copro WHERE cabinet_id = v_cab AND (immeuble_id IN (SELECT id FROM syndic_immeubles WHERE cabinet_id = v_cab AND nom = ANY (v_noms)) OR coproprio_id IN (SELECT id FROM syndic_coproprios WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms)));
  -- DELETE FROM syndic_seguros        WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms);
  -- DELETE FROM syndic_elevadores     WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms);
  -- DELETE FROM syndic_contrats       WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms);
  -- DELETE FROM syndic_missions       WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms);
  -- DELETE FROM syndic_coproprios     WHERE cabinet_id = v_cab AND immeuble = ANY (v_noms);
  -- DELETE FROM syndic_immeubles      WHERE cabinet_id = v_cab AND nom = ANY (v_noms);
  --
  -- Variante B — RESET COMPLET (ATTENTION : supprime TOUTES les données syndic de CE cabinet, y compris
  -- le seed portugais et toute saisie manuelle) :
  -- DELETE FROM syndic_impayes        WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_factures_copro WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_seguros        WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_elevadores     WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_contrats       WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_missions       WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_coproprios     WHERE cabinet_id = v_cab;
  -- DELETE FROM syndic_immeubles      WHERE cabinet_id = v_cab;

  -- ── Garde d'idempotence : pas de doublons si le script est relancé ────────
  IF EXISTS (SELECT 1 FROM syndic_immeubles WHERE cabinet_id = v_cab AND nom = ANY (v_noms)) THEN
    RAISE EXCEPTION 'Seed FR déjà appliqué sur le cabinet % — décommente le RESET (variante A, ciblée) puis relance.', v_cab;
  END IF;

  -- ── Pré-contrôle : FK héritée syndic_missions.cabinet_id → syndic_cabinets(id) ──
  -- L'application écrit cabinet_id = id du compte (auth.users). Si la contrainte des
  -- migrations 024/036 est en base, l'insertion des missions échouerait plus bas : on crée
  -- la ligne cabinet du compte (id = user_id = id du compte) si elle n'existe pas encore.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.syndic_missions'::regclass
      AND contype = 'f'
      AND confrelid = to_regclass('public.syndic_cabinets')
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM syndic_cabinets WHERE id = v_cab) THEN
      INSERT INTO syndic_cabinets (id, user_id, nom, adresse, ville, code_postal)
      VALUES (v_cab, v_cab, 'Cabinet VitFix', '42 rue de la République', 'Marseille', '13002');
      RAISE NOTICE 'Ligne syndic_cabinets créée pour le cabinet % (clé étrangère des missions).', v_cab;
    END IF;
  END IF;

  -- ── 2. Immeubles (copropriétés marseillaises) ──
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Résidence Le Prado', '182 avenue du Prado', 'Marseille', '13008', 12, 2008, 'Copropriété', 'Cabinet VitFix', 8, 30000, 21850)
  RETURNING id INTO v_i1;
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Copropriété Les Terrasses du Vieux-Port', '24 quai de Rive-Neuve', 'Marseille', '13007', 8, 2015, 'Copropriété', 'Cabinet VitFix', 5, 26000, 18700)
  RETURNING id INTO v_i2;
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Résidence Castellane', '42 boulevard Baille', 'Marseille', '13006', 10, 1998, 'Copropriété', 'Cabinet VitFix', 11, 27000, 23940)
  RETURNING id INTO v_i3;
  INSERT INTO syndic_immeubles (cabinet_id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, nb_interventions, budget_annuel, depenses_annee)
  VALUES (v_cab, 'Résidence Euroméditerranée', '78 boulevard de Dunkerque', 'Marseille', '13002', 10, 2020, 'Copropriété', 'Cabinet VitFix', 4, 28000, 16900)
  RETURNING id INTO v_i4;

  -- ── 3. Copropriétaires (tantièmes en millièmes ; solde < 0 = débiteur) ─────
  -- Provision trimestrielle = budget annuel × tantièmes / 1000 / 4 (ex. 30 000 × 92 / 1000 / 4 = 690,00 €).
  -- Résidence Le Prado (budget 30 000 €)
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Le Prado', 'A', 2, '2B', 'Martin', 'Sophie', 'sophie.martin@example.fr', '+33 6 00 00 00 01', true, 92, -690.00, true)
  RETURNING id INTO v_c1;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Le Prado', 'A', 3, '3A', 'Bernard', 'Philippe', 'philippe.bernard@example.fr', '+33 6 00 00 00 02', true, 88, 0.00, true)
  RETURNING id INTO v_c2;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Le Prado', 'B', 1, '1C', 'Dubois', 'Claire', 'claire.dubois@example.fr', '+33 6 00 00 00 03', false, 71, 0.00, false)
  RETURNING id INTO v_c3;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Le Prado', 'B', 4, '4A', 'Moreau', 'Laurent', 'laurent.moreau@example.fr', '+33 6 00 00 00 04', true, 104, 125.00, true)
  RETURNING id INTO v_c4;
  -- Copropriété Les Terrasses du Vieux-Port (budget 26 000 € ; commerces en rez-de-chaussée)
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Copropriété Les Terrasses du Vieux-Port', '', 5, '5A', 'Lefèvre', 'Thomas', 'thomas.lefevre@example.fr', '+33 6 00 00 00 05', false, 131, -1739.00, false)
  RETURNING id INTO v_c5;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Copropriété Les Terrasses du Vieux-Port', '', 0, 'Commerce 1', 'Fontaine', 'Isabelle', 'isabelle.fontaine@example.fr', '+33 6 00 00 00 06', true, 168, 0.00, true)
  RETURNING id INTO v_c6;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Copropriété Les Terrasses du Vieux-Port', '', 3, '3B', 'Garnier', 'Antoine', 'antoine.garnier@example.fr', '+33 6 00 00 00 07', true, 112, 0.00, true)
  RETURNING id INTO v_c7;
  -- Résidence Castellane (budget 27 000 € ; bâtiments A et B)
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Castellane', 'A', 3, '3G', 'Girard', 'Nathalie', 'nathalie.girard@example.fr', '+33 6 00 00 00 08', true, 97, -1571.40, true)
  RETURNING id INTO v_c8;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Castellane', 'A', 0, 'RDC G', 'Roux', 'Michel', 'michel.roux@example.fr', '+33 6 00 00 00 09', true, 84, 0.00, false)
  RETURNING id INTO v_c9;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Castellane', 'B', 2, '2D', 'Faure', 'Élodie', 'elodie.faure@example.fr', '+33 6 00 00 00 10', true, 101, 0.00, true)
  RETURNING id INTO v_c10;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Castellane', 'B', 4, '4D', 'Mercier', 'Jean-Pierre', 'jean-pierre.mercier@example.fr', '+33 6 00 00 00 11', false, 118, 0.00, true)
  RETURNING id INTO v_c11;
  -- Résidence Euroméditerranée (budget 28 000 €)
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Euroméditerranée', '', 4, '4B', 'Rousseau', 'Julien', 'julien.rousseau@example.fr', '+33 6 00 00 00 12', true, 106, -742.00, true)
  RETURNING id INTO v_c12;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Euroméditerranée', '', 2, '2A', 'Blanc', 'Camille', 'camille.blanc@example.fr', '+33 6 00 00 00 13', true, 94, 0.00, true)
  RETURNING id INTO v_c13;
  INSERT INTO syndic_coproprios (cabinet_id, immeuble, batiment, etage, numero_porte, nom_proprietaire, prenom_proprietaire, email_proprietaire, tel_proprietaire, est_occupe, tantieme, solde, acces_portail)
  VALUES (v_cab, 'Résidence Euroméditerranée', '', 6, '6C', 'Chevalier', 'Marc', 'marc.chevalier@example.fr', '+33 6 00 00 00 14', true, 121, 0.00, false)
  RETURNING id INTO v_c14;

  -- ── 4. Missions (statuts variés : urgente + en_cours/acceptee → Urgences) ──
  INSERT INTO syndic_missions (cabinet_id, immeuble, artisan, type, description, priorite, statut, date_creation, date_intervention, montant_devis, montant_facture) VALUES
    (v_cab, 'Résidence Euroméditerranée', 'Plomberie du Vieux-Port', 'Plomberie', 'Fuite sur la colonne d''eau froide (partie commune) au droit du lot 4B, infiltration chez le voisin du 3e étage', 'urgente', 'en_cours', CURRENT_DATE - 2, CURRENT_DATE - 1, 640, NULL),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Provence Élévation', 'Ascenseur', 'Ascenseur bloqué entre le 3e et le 4e étage : personne dégagée par l''ascensoriste, appareil à l''arrêt en attente de la carte de manœuvre', 'urgente', 'en_cours', CURRENT_DATE - 1, CURRENT_DATE - 1, 1180, NULL),
    (v_cab, 'Résidence Castellane', 'Élec Services Phocéens', 'Électricité', 'Disjonctions répétées du tableau des services généraux : cage d''escalier du bâtiment B sans éclairage', 'urgente', 'acceptee', CURRENT_DATE, NULL, 380, NULL),
    (v_cab, 'Résidence Castellane', 'Façades de Provence', 'Ravalement de façade', 'Ravalement de la façade sur rue voté en assemblée générale : échafaudage posé, traitement des fissures et enduit à la chaux en cours', 'normale', 'en_cours', CURRENT_DATE - 75, CURRENT_DATE - 12, 48600, NULL),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Toitures du Roucas', 'Toiture', 'Réfection de l''étanchéité de la toiture-terrasse : reprise des relevés et des évacuations d''eaux pluviales', 'normale', 'en_cours', CURRENT_DATE - 21, CURRENT_DATE - 6, 7850, NULL),
    (v_cab, 'Résidence Le Prado', 'Ascenseurs Phocéens', 'Ascenseur', 'Visite d''entretien semestrielle et remplacement des patins de guidage de la cabine', 'normale', 'terminee', CURRENT_DATE - 25, CURRENT_DATE - 18, 1240, 1240),
    (v_cab, 'Résidence Le Prado', 'Peinture & Décor Méditerranée', 'Peinture', 'Remise en peinture du hall d''entrée et de la cage d''escalier du bâtiment A', 'normale', 'terminee', CURRENT_DATE - 62, CURRENT_DATE - 41, 3480, 3480),
    (v_cab, 'Résidence Castellane', 'Serrurerie du Panier', 'Serrurerie', 'Remplacement du ferme-porte et de la ventouse électromagnétique de la porte d''entrée', 'normale', 'terminee', CURRENT_DATE - 48, CURRENT_DATE - 44, 540, 565),
    (v_cab, 'Résidence Euroméditerranée', 'Élec Services Phocéens', 'Électricité', 'Remplacement de 6 blocs d''éclairage de sécurité (BAES) au parking du niveau -1', 'normale', 'terminee', CURRENT_DATE - 90, CURRENT_DATE - 82, 690, 690),
    (v_cab, 'Résidence Le Prado', 'Plomberie du Vieux-Port', 'Chauffage / Clim', 'Désembouage du réseau de chauffage collectif avant la remise en route de la chaufferie', 'planifiee', 'acceptee', CURRENT_DATE - 10, CURRENT_DATE + 4, 1980, NULL),
    (v_cab, 'Résidence Euroméditerranée', 'Les Jardins des Calanques', 'Espaces verts', 'Taille des haies, ramassage des feuilles et préparation des massifs pour l''hiver', 'planifiee', 'en_attente', CURRENT_DATE - 5, CURRENT_DATE + 12, 620, NULL),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Vitrerie de la Canebière', 'Vitrerie', 'Remplacement du vitrage fissuré de la porte du hall — annulé : pris en charge par l''assureur du responsable', 'normale', 'annulee', CURRENT_DATE - 30, NULL, 720, NULL);

  -- ── 5. Contrats (categoria / statut imposés par CHECK → MapaFiscal) ───────
  INSERT INTO syndic_contrats (cabinet_id, immeuble, fornecedor, categoria, custo_mensal, custo_anual, data_inicio, data_fim, statut, notes) VALUES
    (v_cab, 'Résidence Le Prado', 'Ascenseurs Phocéens', 'elevadores', 165, 1980, CURRENT_DATE - 420, CURRENT_DATE + 310, 'ativo', 'Contrat d''entretien ascenseur : visites, dépannage 24 h/24, pièces d''usure'),
    (v_cab, 'Résidence Le Prado', 'Net''Immo Services', 'limpezas', 420, 5040, CURRENT_DATE - 335, CURRENT_DATE + 30, 'renovacao', 'Nettoyage des parties communes 3 passages par semaine et sortie des conteneurs — échéance dans 30 jours'),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Provence Élévation', 'elevadores', 180, 2160, CURRENT_DATE - 150, CURRENT_DATE + 580, 'ativo', 'Contrat d''entretien étendu (cabine et portes palières)'),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Prévention Incendie Provence', 'seguranca', 0, 890, CURRENT_DATE - 200, CURRENT_DATE + 165, 'ativo', 'Vérification annuelle des extincteurs, du désenfumage et de l''éclairage de sécurité'),
    (v_cab, 'Résidence Castellane', 'Propreté Phocéenne', 'limpezas', 310, 3720, CURRENT_DATE - 500, CURRENT_DATE + 230, 'ativo', 'Nettoyage des parties communes des bâtiments A et B'),
    (v_cab, 'Résidence Castellane', 'Provence Élévation', 'elevadores', 175, 2100, CURRENT_DATE - 700, CURRENT_DATE + 395, 'ativo', 'Contrat d''entretien ascenseur'),
    (v_cab, 'Résidence Castellane', 'Sécurité Incendie Marseille Nord', 'seguranca', 0, 640, CURRENT_DATE - 380, CURRENT_DATE - 15, 'expirado', 'Contrat échu : consulter de nouveaux prestataires avant la prochaine assemblée générale'),
    (v_cab, 'Résidence Euroméditerranée', 'Les Jardins des Calanques', 'jardinagem', 145, 1740, CURRENT_DATE - 260, CURRENT_DATE + 105, 'ativo', 'Entretien des espaces verts et de la toiture végétalisée'),
    (v_cab, 'Résidence Euroméditerranée', 'Ascenseurs Phocéens', 'elevadores', 160, 1920, CURRENT_DATE - 300, CURRENT_DATE + 430, 'ativo', 'Contrat d''entretien ascenseur'),
    (v_cab, 'Résidence Euroméditerranée', 'Hygiène 3D Provence', 'outros', 0, 480, CURRENT_DATE - 90, CURRENT_DATE + 275, 'ativo', 'Dératisation et désinsectisation des locaux poubelles et des caves (2 passages par an)');

  -- ── 6. Ascenseurs (contrôle technique quinquennal : prochain = dernier + 1 825 jours) ──
  INSERT INTO syndic_elevadores (cabinet_id, immeuble, marca, categoria, ema, ultima_inspecao, proxima_inspecao, estado, notes) VALUES
    (v_cab, 'Résidence Le Prado', 'Otis Gen2', 'habitacional', 'Ascenseurs Phocéens', CURRENT_DATE - 400, CURRENT_DATE + 1425, 'conforme', ''),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Schindler 3300', 'misto', 'Provence Élévation', CURRENT_DATE - 1790, CURRENT_DATE + 35, 'prazo', 'Contrôle technique quinquennal dans 35 jours : organisme de contrôle à mandater'),
    (v_cab, 'Résidence Castellane', 'KONE MonoSpace 500', 'habitacional', 'Provence Élévation', CURRENT_DATE - 1860, CURRENT_DATE - 35, 'atraso', 'Contrôle technique quinquennal dépassé de 35 jours : relance de l''organisme de contrôle'),
    (v_cab, 'Résidence Euroméditerranée', 'Otis Gen2 Life', 'habitacional', 'Ascenseurs Phocéens', CURRENT_DATE - 300, CURRENT_DATE + 1525, 'conforme', 'Appareil mis en service à la livraison de l''immeuble (2020)');

  -- ── 7. Assurances (tipo / statut imposés par CHECK) ───────────────────────
  INSERT INTO syndic_seguros (cabinet_id, immeuble, seguradora, tipo, apolice, premio_anual, capital, data_inicio, data_fim, statut, notes) VALUES
    (v_cab, 'Résidence Le Prado', 'Mutuelle Provence Habitat', 'multirriscos', 'MRI-PRA-26-0412', 4150, 3800000, CURRENT_DATE - 100, CURRENT_DATE + 265, 'ativa', 'Multirisque immeuble : incendie, dégâts des eaux, responsabilité civile du syndicat'),
    (v_cab, 'Copropriété Les Terrasses du Vieux-Port', 'Assurances Méditerranée', 'multirriscos', 'MRI-TVP-26-0187', 3480, 3200000, CURRENT_DATE - 50, CURRENT_DATE + 315, 'ativa', 'Multirisque immeuble avec extension pour les locaux commerciaux'),
    (v_cab, 'Résidence Castellane', 'Mutuelle Provence Habitat', 'multirriscos', 'MRI-CAS-25-0933', 3920, 3500000, CURRENT_DATE - 335, CURRENT_DATE + 30, 'renovacao', 'Échéance dans 30 jours : deux devis concurrents demandés (sinistralité dégâts des eaux)'),
    (v_cab, 'Résidence Euroméditerranée', 'Assurances de la Joliette', 'multirriscos', 'MRI-EUR-26-0058', 3650, 4100000, CURRENT_DATE - 200, CURRENT_DATE + 165, 'ativa', 'Multirisque immeuble'),
    (v_cab, 'Résidence Euroméditerranée', 'Assurances de la Joliette', 'outros', 'DO-EUR-2020-117', 0, 6200000, CURRENT_DATE - 1900, CURRENT_DATE + 1750, 'ativa', 'Dommages-ouvrage souscrite par le promoteur : couverture de 10 ans à compter de la réception des travaux');

  -- ── 8. Factures copropriétaires ───────────────────────────────────────────
  -- Appels de provisions et de fonds travaux : pas de TVA (tva_taux 0, TTC = HT).
  -- Prestations particulières du syndic (frais de mise en demeure, état daté) : TVA 20 %.
  INSERT INTO syndic_factures_copro (cabinet_id, coproprio_id, immeuble_id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut) VALUES
    (v_cab, v_c1,  v_i1, 'FC-' || v_annee || '-0001', v_trim_prec - 15, v_trim_prec, 690.00, 0, 690.00, 'Appel de provisions ' || v_lib_trim_prec || ' — budget prévisionnel', 'a_regler'),
    (v_cab, v_c5,  v_i2, 'FC-' || v_annee || '-0002', v_trim_prec - 15, v_trim_prec, 851.50, 0, 851.50, 'Appel de provisions ' || v_lib_trim_prec || ' — budget prévisionnel', 'a_regler'),
    (v_cab, v_c2,  v_i1, 'FC-' || v_annee || '-0003', v_trim - 15, v_trim, 660.00, 0, 660.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c3,  v_i1, 'FC-' || v_annee || '-0004', v_trim - 15, v_trim, 532.50, 0, 532.50, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c4,  v_i1, 'FC-' || v_annee || '-0005', v_trim - 15, v_trim, 780.00, 0, 780.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c6,  v_i2, 'FC-' || v_annee || '-0006', v_trim - 15, v_trim, 1092.00, 0, 1092.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c7,  v_i2, 'FC-' || v_annee || '-0007', v_trim - 15, v_trim, 728.00, 0, 728.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c7,  v_i2, 'FC-' || v_annee || '-0008', v_trim - 15, v_trim, 728.00, 0, 728.00, 'Appel de provisions ' || v_lib_trim || ' — émis en double, annulé', 'annulee'),
    (v_cab, v_c9,  v_i3, 'FC-' || v_annee || '-0009', v_trim - 15, v_trim, 567.00, 0, 567.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c10, v_i3, 'FC-' || v_annee || '-0010', v_trim - 15, v_trim, 681.75, 0, 681.75, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c12, v_i4, 'FC-' || v_annee || '-0011', v_trim - 15, v_trim, 742.00, 0, 742.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'a_regler'),
    (v_cab, v_c13, v_i4, 'FC-' || v_annee || '-0012', v_trim - 15, v_trim, 658.00, 0, 658.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c14, v_i4, 'FC-' || v_annee || '-0013', v_trim - 15, v_trim, 847.00, 0, 847.00, 'Appel de provisions ' || v_lib_trim || ' — budget prévisionnel', 'reglee'),
    (v_cab, v_c8,  v_i3, 'FC-' || v_annee || '-0014', CURRENT_DATE - 55, CURRENT_DATE - 40, 1571.40, 0, 1571.40, 'Appel de fonds travaux — ravalement de façade, 1er appel (1/3)', 'a_regler'),
    (v_cab, v_c5,  v_i2, 'FC-' || v_annee || '-0015', CURRENT_DATE - 60, CURRENT_DATE - 30, 30.00, 20, 36.00, 'Frais de mise en demeure (art. 10-1 de la loi du 10 juillet 1965)', 'a_regler'),
    (v_cab, v_c11, v_i3, 'FC-' || v_annee || '-0016', CURRENT_DATE - 20, CURRENT_DATE - 5, 316.67, 20, 380.00, 'État daté — mutation du lot 4D (plafond réglementaire 380 € TTC)', 'reglee'),
    (v_cab, v_c5,  v_i2, 'FC-' || v_annee || '-0017', (v_trim_prec - interval '3 months')::date - 15, (v_trim_prec - interval '3 months')::date, 851.50, 0, 851.50, 'Appel de provisions ' || v_lib_trim_prec2 || ' — budget prévisionnel', 'a_regler');

  -- ── 9. Impayés (ouvert / en_recouvrement → DashCond + Cobrança ; soldé → « récupérés ») ──
  -- Somme des impayés ouverts d'un copropriétaire = son solde débiteur (section 3).
  INSERT INTO syndic_impayes (cabinet_id, immeuble_id, coproprio_id, montant, nature, depuis, nb_relances, statut, notes) VALUES
    (v_cab, v_i1, v_c1,  690.00,  'charges_courantes', v_trim_prec, 2, 'ouvert', 'Provision ' || v_lib_trim_prec || ' impayée : relance simple puis lettre de relance envoyées'),
    (v_cab, v_i2, v_c5,  1703.00, 'charges_courantes', (v_trim_prec - interval '3 months')::date, 3, 'en_recouvrement', 'Deux trimestres impayés : mise en demeure LRAR restée sans effet, transmission au commissaire de justice à décider'),
    (v_cab, v_i2, v_c5,  36.00,   'frais_relance', CURRENT_DATE - 30, 0, 'ouvert', 'Frais de mise en demeure imputables au copropriétaire défaillant'),
    (v_cab, v_i3, v_c8,  1571.40, 'travaux', CURRENT_DATE - 40, 1, 'ouvert', 'Premier appel de fonds du ravalement non réglé'),
    (v_cab, v_i4, v_c12, 742.00,  'charges_courantes', v_trim, 1, 'ouvert', 'Provision ' || v_lib_trim || ' : relance automatique envoyée'),
    (v_cab, v_i3, v_c10, 681.75,  'charges_courantes', (v_trim_prec - interval '3 months')::date, 3, 'solde', 'Régularisé après un échéancier amiable de 3 mois');

  RAISE NOTICE 'Seed démo Syndic v54 Marseille OK pour cabinet %', v_cab;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — à lancer APRÈS le bloc ci-dessus (remplacer aussi <EMAIL_COMPTE_DEMO>).
--
-- 1) Comptage par table pour le cabinet. Attendu sur un cabinet vide au départ :
--    immeubles 4 · coproprios 14 · missions 12 · contrats 10 · elevadores 4 · seguros 5 ·
--    factures_copro 17 · impayes 6.
--
-- WITH cab AS (SELECT id FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1)
-- SELECT 'syndic_immeubles' AS table_demo, (SELECT count(*) FROM syndic_immeubles t, cab WHERE t.cabinet_id = cab.id) AS nb
-- UNION ALL SELECT 'syndic_coproprios',     (SELECT count(*) FROM syndic_coproprios t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_missions',       (SELECT count(*) FROM syndic_missions t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_contrats',       (SELECT count(*) FROM syndic_contrats t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_elevadores',     (SELECT count(*) FROM syndic_elevadores t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_seguros',        (SELECT count(*) FROM syndic_seguros t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_factures_copro', (SELECT count(*) FROM syndic_factures_copro t, cab WHERE t.cabinet_id = cab.id)
-- UNION ALL SELECT 'syndic_impayes',        (SELECT count(*) FROM syndic_impayes t, cab WHERE t.cabinet_id = cab.id);
--
-- 2) Corpus juridique de Max (agent juridique) : s'il est vide, Max refuse de répondre
--    (« corpus gap »). La migration 20260519_max_legal_corpus.sql n'en insère que 4 articles ;
--    le corpus complet se charge avec `npm run seed:legal-corpus -- <fichier.json>`
--    (scripts/seed-max-legal-corpus.ts, clé service_role). Attendu : nettement plus que 0.
--
-- SELECT count(*) FROM syndic_legal_corpus_fr;
--
-- 3) Ligne cabinet (créée par le pré-contrôle seulement si la clé étrangère des missions l'exige) :
--
-- SELECT id, user_id, nom FROM syndic_cabinets WHERE id = (SELECT id FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1);
-- ════════════════════════════════════════════════════════════════════════════
