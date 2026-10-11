-- ════════════════════════════════════════════════════════════════════════════
-- E-mails de démo d'Alfredo (agent e-mails IA, Syndic v54) — cabinet marseillais fictif.
-- Complète syndic-v54-demo-seed-marseille.sql : mêmes copropriétés, copropriétaires et
-- prestataires (Résidence Le Prado, Les Terrasses du Vieux-Port, Castellane, Euroméditerranée).
--
-- MODE D'EMPLOI
--   1. Supabase > SQL Editor ; remplacer <EMAIL_COMPTE_DEMO> par l'e-mail du compte de démo
--      (rôle syndic ou super_admin : le cabinet = id du compte).
--   2. Lancer le bloc. Message attendu : « E-mails Alfredo Marseille : 8 ajoutés pour le cabinet <uuid> ».
--
-- CE QUE ÇA CRÉE (table syndic_emails_analysed, AJOUTS SEULEMENT — aucune suppression)
--   - 8 e-mails reçus le lundi 12 octobre 2026 entre 6 h 42 et 8 h 31 (heure de Paris) :
--     Alfredo répond à « résume ma boîte du jour » (période « today » = 24 dernières heures).
--   - 7 brouillons de réponse « pending_review » (à valider : rien n'est envoyé), 1 publicité sans brouillon.
--   - Identifiants gmail_message_id préfixés « demo-mrs- » ; adresses en @example.fr (fictives).
--   - Valeurs de urgence / type_demande / statut / draft_status conformes aux CHECK de la table.
--   Relancer le script ne crée pas de doublon (garde sur le préfixe).
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cab uuid;
  v_n   int;
BEGIN
  SELECT id INTO v_cab FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1;
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable — remplace <EMAIL_COMPTE_DEMO> par l''e-mail du compte de démo.';
  END IF;

  IF EXISTS (SELECT 1 FROM syndic_emails_analysed WHERE syndic_id = v_cab AND gmail_message_id LIKE 'demo-mrs-%') THEN
    RAISE NOTICE 'E-mails Alfredo Marseille déjà présents pour le cabinet % : rien à faire.', v_cab;
    RETURN;
  END IF;

  INSERT INTO syndic_emails_analysed (
    syndic_id, gmail_message_id, gmail_thread_id, from_email, from_name, to_email, subject, body_preview,
    received_at, urgence, type_demande, resume_ia, immeuble_detecte, locataire_detecte, actions_suggerees,
    statut, draft_subject, draft_body_text, draft_body_html, draft_status, draft_meta, draft_generated_at, analyse_at
  )
  SELECT v_cab, e.id, e.id, e.de, e.nom, 'gestion@cabinet-vitfix.example.fr', e.objet, e.apercu,
         e.recu, e.urgence, e.type_demande, e.resume, e.immeuble, e.locataire, e.actions::jsonb,
         'nouveau', e.brouillon_objet, e.brouillon,
         CASE WHEN e.brouillon IS NULL THEN NULL
              ELSE '<p>' || replace(replace(e.brouillon, E'\n\n', '</p><p>'), E'\n', '<br>') || '</p>' END,
         CASE WHEN e.brouillon IS NULL THEN 'none' ELSE 'pending_review' END,
         CASE WHEN e.brouillon IS NULL THEN NULL ELSE '{"modele": "claude-sonnet-5-5", "demo": true}'::jsonb END,
         CASE WHEN e.brouillon IS NULL THEN NULL ELSE e.recu + interval '2 minutes' END,
         e.recu + interval '1 minute'
  FROM (VALUES
    ('demo-mrs-001', 'julien.rousseau@example.fr', 'Julien Rousseau',
     'Fuite colonne : l''eau coule toujours chez ma voisine du 3e',
     'Bonjour, malgré le passage du plombier samedi, l''eau continue de couler au plafond de l''appartement du 3e, sous mon lot 4B. Ma voisine a dû poser des bassines toute la nuit. Quand l''entreprise revient-elle ? Faut-il déclarer le sinistre à l''assurance ?',
     timestamptz '2026-10-12 06:42:00+02', 'haute', 'signalement_panne',
     'Fuite persistante sur la colonne d''eau froide commune au droit du lot 4B ; infiltration chez le voisin du 3e. Le copropriétaire demande la date de retour du plombier et la marche à suivre pour l''assurance.',
     'Résidence Euroméditerranée', 'Julien Rousseau (lot 4B)',
     '["Relancer Plomberie du Vieux-Port pour une intervention ce matin", "Déclarer le dégât des eaux à l''assureur de l''immeuble", "Envoyer un constat amiable dégât des eaux aux deux occupants"]',
     'Re: Fuite colonne — intervention ce matin',
     'Bonjour Monsieur Rousseau,

Merci pour votre message et toutes nos excuses pour la gêne occasionnée. L''entreprise Plomberie du Vieux-Port intervient ce matin pour réparer définitivement la colonne d''eau froide, qui est une partie commune.

Nous déclarons dès aujourd''hui le dégât des eaux à l''assureur de l''immeuble. Pour accélérer l''indemnisation, merci de remplir avec votre voisine du 3e le constat amiable dégât des eaux que nous vous envoyons en pièce jointe.

Nous vous tenons informé de la fin de l''intervention.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-002', 'elodie.faure@example.fr', 'Élodie Faure',
     'Cage d''escalier du bâtiment B toujours dans le noir',
     'Bonjour, depuis vendredi soir il n''y a plus aucune lumière dans la cage d''escalier du bâtiment B. Hier soir une personne âgée a failli tomber. C''est dangereux, pouvez-vous faire intervenir quelqu''un en urgence ?',
     timestamptz '2026-10-12 07:05:00+02', 'haute', 'signalement_panne',
     'Plus d''éclairage dans la cage d''escalier du bâtiment B depuis vendredi (disjonctions du tableau des services généraux) ; risque de chute signalé.',
     'Résidence Castellane', 'Élodie Faure (bât. B, lot 2D)',
     '["Confirmer l''intervention d''Élec Services Phocéens aujourd''hui", "Afficher une note d''information dans le hall du bâtiment B", "Prévoir un éclairage provisoire"]',
     'Re: Cage d''escalier du bâtiment B — électricien aujourd''hui',
     'Bonjour Madame Faure,

Merci de nous avoir alertés. Le problème vient du tableau électrique des services généraux, qui disjoncte à répétition. L''entreprise Élec Services Phocéens est mandatée et intervient aujourd''hui.

En attendant la réparation, un éclairage provisoire sera installé dans la cage d''escalier et une note d''information sera affichée dans le hall du bâtiment B.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-003', 'isabelle.fontaine@example.fr', 'Isabelle Fontaine',
     'Ascenseur à l''arrêt depuis jeudi : situation intenable',
     'Bonjour, l''ascenseur est toujours à l''arrêt. Mes livraisons pour la réserve à l''étage ne peuvent plus se faire et plusieurs clients âgés ne peuvent pas accéder au cabinet de kinésithérapie du 2e. Quand sera-t-il réparé ? Je souhaite que ce point soit abordé à la prochaine assemblée.',
     timestamptz '2026-10-12 07:20:00+02', 'haute', 'reclamation',
     'Réclamation d''une copropriétaire (local commercial) : ascenseur à l''arrêt depuis jeudi après un blocage en cabine ; demande une date de remise en service et l''inscription du sujet à l''ordre du jour de l''AG.',
     'Copropriété Les Terrasses du Vieux-Port', 'Isabelle Fontaine (commerce 1)',
     '["Obtenir de Provence Élévation la date de livraison de la carte de manœuvre", "Informer les occupants de la date de remise en service", "Inscrire la fiabilité de l''ascenseur à l''ordre du jour de la prochaine AG"]',
     'Re: Ascenseur à l''arrêt — remise en service prévue',
     'Bonjour Madame Fontaine,

Nous comprenons parfaitement la gêne pour votre activité et pour les occupants. Après le blocage de jeudi, l''ascensoriste Provence Élévation a mis l''appareil à l''arrêt par sécurité : la carte de manœuvre défectueuse est commandée et la remise en service est prévue dès sa réception, au plus tard en fin de semaine.

Nous informerons l''ensemble des occupants par affichage. Votre demande sera inscrite à l''ordre du jour de la prochaine assemblée générale, avec un point sur l''état de l''appareil et son contrat d''entretien.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-004', 'thomas.lefevre@example.fr', 'Thomas Lefèvre',
     'Demande d''échéancier pour mes charges en retard',
     'Bonjour, j''ai bien reçu votre mise en demeure. Je traverse une période difficile et je ne peux pas régler la totalité d''un coup. Serait-il possible d''étaler le paiement de mes charges sur plusieurs mois ?',
     timestamptz '2026-10-12 07:48:00+02', 'moyenne', 'facturation',
     'Copropriétaire débiteur (lot 5A, solde de 1 739 €, mise en demeure envoyée) qui demande un échéancier de paiement.',
     'Copropriété Les Terrasses du Vieux-Port', 'Thomas Lefèvre (lot 5A)',
     '["Proposer un échéancier amiable sur 6 mois", "Suspendre la transmission au commissaire de justice si l''échéancier est signé", "Rappeler que les provisions courantes restent exigibles"]',
     'Re: Demande d''échéancier — proposition',
     'Bonjour Monsieur Lefèvre,

Merci pour votre message. Votre solde débiteur s''élève à 1 739 €. Nous pouvons vous proposer un échéancier amiable sur 6 mois, soit environ 290 € par mois, en plus des provisions courantes qui restent exigibles à chaque trimestre.

Si cette proposition vous convient, nous vous adresserons un accord écrit à signer ; tant qu''il sera respecté, le dossier ne sera pas transmis au commissaire de justice.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-005', 'marc.chevalier@example.fr', 'Marc Chevalier',
     'Installation d''une borne de recharge sur ma place de parking',
     'Bonjour, je viens d''acheter une voiture électrique et je souhaite installer une borne de recharge sur ma place au parking du niveau -1. Quelles sont les démarches ? Faut-il un vote de l''assemblée générale ?',
     timestamptz '2026-10-12 08:02:00+02', 'moyenne', 'ag',
     'Demande d''installation d''une borne de recharge individuelle sur une place de parking privative ; le copropriétaire demande la procédure et si un vote en AG est nécessaire.',
     'Résidence Euroméditerranée', 'Marc Chevalier (lot 6C)',
     '["Expliquer la procédure du droit à la prise", "Demander le descriptif des travaux et le devis de l''installateur", "Vérifier la puissance disponible au tableau du parking"]',
     'Re: Borne de recharge — démarches',
     'Bonjour Monsieur Chevalier,

Bonne nouvelle : au titre du « droit à la prise », vous pouvez faire installer à vos frais une borne sur votre place de stationnement, sans attendre un vote de l''assemblée générale. Il suffit d''informer le syndic par lettre recommandée avec accusé de réception, accompagnée d''un descriptif détaillé des travaux, d''un plan et du devis de l''installateur.

L''assemblée générale ne serait saisie que si le syndicat souhaitait s''y opposer pour un motif sérieux et légitime. Nous vérifierons de notre côté la puissance disponible au tableau électrique du parking.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-006', 'office.garcia@example.fr', 'Maître Hélène Garcia, notaire',
     'Vente du lot 4A — Résidence Le Prado : demande d''état daté',
     'Maître, je suis chargée de la vente du lot 4A appartenant à M. Laurent Moreau, Résidence Le Prado, 182 avenue du Prado. Pouvez-vous m''adresser l''état daté ainsi que les trois derniers procès-verbaux d''assemblée générale ? La signature est prévue le 20 novembre.',
     timestamptz '2026-10-12 08:15:00+02', 'moyenne', 'information',
     'Demande d''état daté et des 3 derniers PV d''AG par l''office notarial pour la vente du lot 4A (signature le 20 novembre).',
     'Résidence Le Prado', 'Laurent Moreau (lot 4A, vendeur)',
     '["Établir l''état daté du lot 4A", "Joindre les procès-verbaux des 3 dernières AG", "Facturer l''état daté au vendeur (plafond réglementaire 380 € TTC)"]',
     'Re: Vente du lot 4A — état daté',
     'Maître,

Nous accusons réception de votre demande concernant la vente du lot 4A de la Résidence Le Prado. L''état daté vous sera adressé dans les meilleurs délais, avec les procès-verbaux des trois dernières assemblées générales.

Conformément à la réglementation, les frais d''état daté, plafonnés à 380 € TTC, sont à la charge du copropriétaire vendeur.

Nous restons à votre disposition.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-007', 'sinistres@example.fr', 'Assurances de la Joliette — Service sinistres',
     'Sinistre dégât des eaux — Résidence Euroméditerranée : passage de l''expert',
     'Madame, Monsieur, suite à votre déclaration, notre expert se rendra à la Résidence Euroméditerranée, 78 boulevard de Dunkerque, le jeudi 15 octobre à 10 h. Merci de permettre l''accès aux appartements concernés (lots 4B et 3B) et aux gaines techniques.',
     timestamptz '2026-10-12 08:31:00+02', 'moyenne', 'information',
     'L''assureur de l''immeuble annonce le passage de l''expert jeudi 15 octobre à 10 h pour le dégât des eaux (lots 4B et 3B) ; accès aux logements et aux gaines techniques à organiser.',
     'Résidence Euroméditerranée', NULL,
     '["Confirmer le rendez-vous à l''assureur", "Prévenir les occupants des lots 4B et 3B", "Ajouter le rendez-vous au planning"]',
     'Re: Expertise dégât des eaux — confirmation jeudi 10 h',
     'Madame, Monsieur,

Nous vous confirmons le rendez-vous d''expertise du jeudi 15 octobre à 10 h à la Résidence Euroméditerranée. Un gestionnaire du cabinet sera présent ; les occupants des lots 4B et 3B sont prévenus et l''accès aux gaines techniques sera assuré.

Bien cordialement,
Le service gestion — Cabinet VitFix'),

    ('demo-mrs-008', 'promo@example.fr', 'Sécuri-Pro Équipements',
     'Offre spéciale : -30 % sur les détecteurs de fumée connectés',
     'Profitez de notre offre exceptionnelle réservée aux syndics : -30 % sur toute la gamme de détecteurs connectés jusqu''au 31 octobre.',
     timestamptz '2026-10-12 06:55:00+02', 'basse', 'autre',
     'E-mail publicitaire, aucune action nécessaire.',
     NULL, NULL, '[]', NULL, NULL)
  ) AS e(id, de, nom, objet, apercu, recu, urgence, type_demande, resume, immeuble, locataire, actions, brouillon_objet, brouillon);

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'E-mails Alfredo Marseille : % ajoutés pour le cabinet %', v_n, v_cab;
END $$;

-- VÉRIFICATION (après le bloc) :
-- SELECT received_at, from_name, subject, urgence, draft_status
-- FROM syndic_emails_analysed
-- WHERE syndic_id = (SELECT id FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1)
-- ORDER BY received_at DESC;
