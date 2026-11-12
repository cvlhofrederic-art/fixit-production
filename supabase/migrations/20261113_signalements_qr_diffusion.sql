-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (13/11/2026) — diffusion de messages d'exploitation de l'immeuble aux déclarants d'une copropriété.
--
-- Demandes et décisions de Hugo du 11/11/2026 (cahier des charges de la PR 3, § 2, § 3 et § 14) : messages
-- d'EXPLOITATION seulement (« fuite en cours », « coupure d'eau demain de 9 h à 10 h »), par e-mail seulement ; ciblage :
-- toute la copropriété, un bâtiment, un étage d'un bâtiment, ou les déclarants d'un signalement précis ; désinscription
-- immédiate, pour CETTE copropriété, sans aucune exception (même urgente) ; destinataire tant que le cabinet gère la
-- copropriété ; aucun plafond d'envoi.
--   H1 = option C : les déclarants antérieurs à la diffusion reçoivent d'abord un message d'annonce unique (modèle
--        « annonce », copropriété entière, adresses jamais annoncées), daté par signalement ; ils n'entrent dans la
--        diffusion que 15 jours après l'envoi de cette annonce, s'ils n'ont pas refusé (RGPD art. 13.3). Les nouveaux
--        déclarants, à qui l'accusé de réception annonce la diffusion, y entrent aussitôt (art. 13.4) ;
--   H7 = date facultative de fin de mission sur la copropriété : à cette date, plus aucune diffusion (aperçu, création,
--        lots), sans geste humain ; désactiver la copropriété la coupe aussi ;
--   H11 = un gestionnaire ne diffuse que sur une copropriété qui lui est attribuée NOMMÉMENT (jamais par « attribuée à
--        tous ») : contrôlé aussi par la base (signalements_qr_diffusion_gestionnaire_autorise).
--
-- Contenu : 8 colonnes de réglages de diffusion sur le cabinet (contact, politique de confidentialité et sa déclaration
-- datée, contrat de sous-traitance référencé et daté, téléphones autorisés, activation), 2 colonnes sur le signalement
-- (date et origine de l'annonce), 1 sur la copropriété (fin de mission) ; 3 tables (diffusions, destinataires par
-- diffusion, oppositions par empreinte SHA-256 de l'adresse normalisée et par copropriété, SANS clé étrangère : la preuve
-- de l'opposition survit au signalement) ; 22 fonctions SECURITY INVOKER (search_path figé, EXECUTE à service_role seul) ;
-- liste fermée des actions du journal REMPLACÉE (34 actions de la 20261111 + 7 de la diffusion).
-- Aucune adresse en clair hors de signalements_qr : l'envoi relit l'adresse du signalement source et la compare à
-- l'empreinte. Aucune colonne ni paramètre de passe-droit à une opposition.
-- Erreurs levées par les fonctions : P0001 (a_reverifier, diffusion_inactive, aucun_destinataire, perimetre_change : codes
-- publics 409 des routes), 42501 (interdit), 22023 (paramètre invalide) ; jamais renvoyées telles quelles au navigateur.
-- Le remplacement de la liste du journal s'arrête (55000, journal_action_perdue) plutôt que de retirer une action que
-- la contrainte en place connaîtrait et que la nouvelle liste n'aurait pas.
--
-- Additive et rejouable (modèle 20261111) : CREATE TABLE / INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, contraintes
-- nommées des tables existantes créées seulement si absentes de pg_constraint, en NOT VALID puis VALIDATE, CREATE OR
-- REPLACE FUNCTION ; aucune écriture de données. Seul DROP : la liste fermée du journal (la 20261111 est appliquée en
-- production et ne peut plus la recevoir), remplacée dans la MÊME instruction, seulement si les 7 actions y manquent.
-- À appliquer par Frédéric (Supabase > SQL Editor) APRÈS 20261112_signalements_qr_acces_gestionnaires.sql, avant la
-- fusion de la PR 3. Rejouer la 20261111 ou la 20261112 après celle-ci ne touche à rien de ce qu'elle pose (tables et
-- fonctions propres à la diffusion ; la 20261111 ne recrée pas la contrainte du journal d'une table existante).
-- Règles exécutées sur un vrai PostgreSQL : tests/migrations/signalements_qr_diffusion.execution.test.ts (PGlite).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Réglages de diffusion du cabinet ──
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_contact_email TEXT;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_politique_url TEXT;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_politique_verifiee_le TIMESTAMPTZ;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_contrat_reference TEXT;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_contrat_signe_le DATE;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_telephones TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_activee_le TIMESTAMPTZ;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS diffusion_activee_par UUID;

-- ── 2. Annonce de la diffusion (H1 = option C) et fin de mission (H7) ──
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS diffusion_annoncee_le TIMESTAMPTZ;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS diffusion_annonce_origine TEXT;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS diffusion_fin_gestion_le DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_diffusion_contact_format'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    -- Reply-To des messages et contact affiché : adresse professionnelle du cabinet, en minuscules.
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_diffusion_contact_format
      CHECK (diffusion_contact_email IS NULL OR (diffusion_contact_email = lower(btrim(diffusion_contact_email))
             AND char_length(diffusion_contact_email) <= 254
             AND diffusion_contact_email ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_diffusion_politique_format'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    -- https seulement ; ni espace, ni guillemet, ni chevron, ni apostrophe : la valeur est recopiée dans un href.
    -- Longueur par char_length : une répétition {4,500} dépasse la borne des expressions de PostgreSQL (255) et ferait
    -- échouer toute écriture sur la table (essai PGlite du 12/11).
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_diffusion_politique_format
      CHECK (diffusion_politique_url IS NULL OR (char_length(diffusion_politique_url) BETWEEN 12 AND 508
             AND diffusion_politique_url ~ '^https://[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_diffusion_complete'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    -- Pas d'activation sans contact, politique déclarée décrivant la diffusion, ni contrat référencé et daté.
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_diffusion_complete
      CHECK (diffusion_activee_le IS NULL OR (diffusion_contact_email IS NOT NULL AND diffusion_politique_url IS NOT NULL
             AND diffusion_politique_verifiee_le IS NOT NULL AND diffusion_contrat_reference IS NOT NULL
             AND diffusion_contrat_signe_le IS NOT NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_diffusion_contrat_format'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_diffusion_contrat_format
      CHECK (diffusion_contrat_reference IS NULL OR (char_length(diffusion_contrat_reference) BETWEEN 3 AND 100
             AND diffusion_contrat_reference !~ '[[:cntrl:]]')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_diffusion_telephones_format'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    -- Numéros autorisés dans les messages (astreinte, gardiens ; H2) : chiffres seuls, forme normalisée par la route.
    -- Une seule dimension (cardinality compte tous les éléments d'un tableau à deux dimensions, array_to_string les met à
    -- plat) ; un élément NULL devient « * », que l'expression refuse (array_to_string l'ignorerait sinon).
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_diffusion_telephones_format
      CHECK (cardinality(diffusion_telephones) <= 10 AND coalesce(array_ndims(diffusion_telephones), 1) = 1
             AND array_to_string(diffusion_telephones, ',', '*') ~ '^([0-9]{6,15}(,[0-9]{6,15})*)?$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_diffusion_annonce_origine_valeurs'
                 AND conrelid = 'signalements_qr'::regclass) THEN
    -- accuse : l'accusé de réception a porté les deux phrases (inclusion aussitôt) ; message : le message d'annonce
    -- unique est parti (inclusion 15 jours après). Date et origine vont ensemble.
    ALTER TABLE signalements_qr ADD CONSTRAINT signalements_qr_diffusion_annonce_origine_valeurs
      CHECK ((diffusion_annonce_origine IS NULL OR diffusion_annonce_origine IN ('accuse', 'message'))
             AND (diffusion_annoncee_le IS NULL) = (diffusion_annonce_origine IS NULL)) NOT VALID;
  END IF;
END $$;
-- Les lignes existantes ont les nouvelles colonnes à NULL ou à leur valeur par défaut : la validation passe.
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_diffusion_contact_format;
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_diffusion_politique_format;
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_diffusion_complete;
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_diffusion_contrat_format;
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_diffusion_telephones_format;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_diffusion_annonce_origine_valeurs;

COMMENT ON COLUMN signalements_qr_cabinets.diffusion_contact_email IS 'Diffusion : adresse de contact du cabinet (Reply-To des messages, contact affiché).';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_politique_url IS 'Diffusion : politique de confidentialité du cabinet (responsable du traitement), lien des messages, du formulaire et de l''accusé.';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_politique_verifiee_le IS 'Diffusion : déclaration datée du super admin que cette politique décrit la diffusion (finalité, base légale, durée, opposition).';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_contrat_reference IS 'Diffusion : référence courte du contrat de sous-traitance (art. 28 RGPD) couvrant la diffusion.';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_contrat_signe_le IS 'Diffusion : date de signature de ce contrat.';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_telephones IS 'Diffusion : seuls numéros de téléphone acceptés dans un message (astreinte, gardiens), chiffres seuls, 10 au plus.';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_activee_le IS 'Diffusion activée (NULL : aucun envoi, aucune annonce dans l''accusé) ; impossible sans contact, politique déclarée et contrat.';
COMMENT ON COLUMN signalements_qr_cabinets.diffusion_activee_par IS 'Compte super admin qui a activé la diffusion (sans clé étrangère).';
COMMENT ON COLUMN signalements_qr.diffusion_annoncee_le IS 'Date à laquelle la diffusion a été annoncée pour ce dépôt (accusé de réception, ou message d''annonce unique) : preuve de l''information préalable.';
COMMENT ON COLUMN signalements_qr.diffusion_annonce_origine IS 'accuse : annoncée par l''accusé (inclusion aussitôt) ; message : par le message d''annonce (inclusion 15 jours après, sans refus).';
COMMENT ON COLUMN signalements_qr_coproprietes.diffusion_fin_gestion_le IS 'Fin de mission prévue (facultative) : à partir de cette date (heure de Paris), plus aucune diffusion.';

-- ── 3. Normalisation unique de l'adresse (dédoublonnage, oppositions, repli) : SQL seulement, jamais recalculée en TS ──
CREATE OR REPLACE FUNCTION signalements_qr_empreinte_email(p_email text) RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT sha256(convert_to(lower(btrim(p_email, E' \t\r\n')), 'UTF8'))
$fn$;
-- Recherche d'une adresse dans une copropriété par son empreinte (datation du message d'annonce, adresse déjà annoncée,
-- purge des oppositions) : index d'expression, sans quoi chaque recherche recalcule l'empreinte de tous les signalements
-- de la copropriété (relecture du 12/11 : 10 s, puis 20 s, puis 30 s par lot d'annonce pour 10 000 signalements).
-- La fonction est IMMUTABLE et jamais « inlinée » (SET search_path) : les requêtes portent la même expression que
-- l'index. Changer un jour la normalisation de l'adresse exigera un REINDEX de cet index. Écrire dans signalements_qr
-- exige désormais le droit EXECUTE sur la fonction (calcul de l'index) : service_role et le propriétaire l'ont ; anon et
-- authenticated n'écrivent pas cette table (RLS sans politique).
CREATE INDEX IF NOT EXISTS idx_signalements_qr_copro_empreinte
  ON signalements_qr (copropriete_id, signalements_qr_empreinte_email(email));

-- ── 4. Diffusions (un message composé) ──
CREATE TABLE IF NOT EXISTS signalements_qr_diffusions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copropriete_id           UUID NOT NULL REFERENCES signalements_qr_coproprietes(id) ON DELETE CASCADE,
  cabinet_id               UUID NOT NULL REFERENCES signalements_qr_cabinets(id) ON DELETE RESTRICT,
  operation_id             UUID NOT NULL,                      -- tiré par l'écran : un double clic est sans effet
  acteur_id                UUID NOT NULL,                      -- compte auteur, sans clé étrangère
  acteur_profil            TEXT NOT NULL CHECK (acteur_profil IN ('super_admin', 'gestionnaire')),
  acteur_gestionnaire_id   UUID,                               -- fiche du gestionnaire auteur, sans clé étrangère
  -- Super admin : instruction écrite du cabinet (référence courte, sans adresse e-mail) et date de réception.
  instruction_reference    TEXT CHECK (instruction_reference IS NULL OR (char_length(instruction_reference) BETWEEN 5 AND 200
                                       AND instruction_reference !~ '[[:cntrl:]]' AND position('@' IN instruction_reference) = 0)),
  instruction_recue_le     DATE,
  modele                   TEXT NOT NULL CHECK (modele IN ('libre', 'fuite', 'coupure_eau', 'coupure_electricite', 'intervention', 'fin_incident', 'ascenseur_arret', 'annonce')),
  langue                   TEXT NOT NULL CHECK (langue IN ('fr', 'pt')),   -- celle du cabinet, figée à la création
  -- Valeurs figées à la création : un lot rejoué produit exactement le même contenu (idempotence du service d'e-mail).
  fige_cabinet_nom         TEXT NOT NULL,
  fige_cabinet_identifiant TEXT NOT NULL,
  fige_copropriete_nom     TEXT NOT NULL,
  fige_contact_email       TEXT NOT NULL,
  fige_politique_url       TEXT NOT NULL,
  fige_expediteur          TEXT NOT NULL CHECK (char_length(fige_expediteur) BETWEEN 3 AND 400 AND fige_expediteur !~ '[[:cntrl:]]'),
  perimetre_jusqu_au       TIMESTAMPTZ NOT NULL,               -- signalements déposés jusqu'à l'instant de l'aperçu
  objet                    TEXT NOT NULL CHECK (char_length(objet) BETWEEN 3 AND 120 AND objet !~ '[[:cntrl:]]'),
  texte                    TEXT NOT NULL CHECK (char_length(texte) BETWEEN 10 AND 2000 AND texte !~ '[\x01-\x09\x0b-\x1f\x7f-\x9f]'),
  portee                   TEXT NOT NULL CHECK (portee IN ('copropriete', 'batiment', 'etage', 'signalement')),
  cle_batiment             TEXT CHECK (cle_batiment IS NULL OR char_length(cle_batiment) BETWEEN 1 AND 60),
  cle_etage                TEXT CHECK (cle_etage IS NULL OR char_length(cle_etage) BETWEEN 1 AND 60),
  signalement_id           UUID REFERENCES signalements_qr(id) ON DELETE SET NULL,
  libelle_perimetre        TEXT NOT NULL CHECK (char_length(libelle_perimetre) BETWEEN 1 AND 200 AND libelle_perimetre !~ '[[:cntrl:]]'),
  nb_destinataires         INTEGER NOT NULL CHECK (nb_destinataires >= 1),   -- aucun plafond (décision de Hugo)
  nb_exclus_opposition     INTEGER NOT NULL DEFAULT 0 CHECK (nb_exclus_opposition >= 0),
  dernier_lot              INTEGER NOT NULL DEFAULT 0 CHECK (dernier_lot >= 0),   -- numérotation des lots (clé d'idempotence)
  copie_cabinet_le         TIMESTAMPTZ,                         -- copie envoyée au contact du cabinet
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signalements_qr_diffusions_operation_unique UNIQUE (operation_id),
  CONSTRAINT signalements_qr_diffusions_instruction CHECK (
    acteur_profil <> 'super_admin' OR (instruction_reference IS NOT NULL AND instruction_recue_le IS NOT NULL)),
  CONSTRAINT signalements_qr_diffusions_gestionnaire CHECK ((acteur_profil = 'gestionnaire') = (acteur_gestionnaire_id IS NOT NULL)),
  CONSTRAINT signalements_qr_diffusions_annonce CHECK (modele <> 'annonce' OR portee = 'copropriete'),
  CONSTRAINT signalements_qr_diffusions_portee_coherente CHECK (
       (portee = 'copropriete' AND cle_batiment IS NULL AND cle_etage IS NULL AND signalement_id IS NULL)
    OR (portee = 'batiment'    AND cle_batiment IS NOT NULL AND cle_etage IS NULL AND signalement_id IS NULL)
    OR (portee = 'etage'       AND cle_batiment IS NOT NULL AND cle_etage IS NOT NULL AND signalement_id IS NULL)
    OR (portee = 'signalement' AND cle_batiment IS NULL AND cle_etage IS NULL))   -- signalement_id peut repasser à NULL
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusions_copro   ON signalements_qr_diffusions (copropriete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusions_cabinet ON signalements_qr_diffusions (cabinet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusions_date    ON signalements_qr_diffusions (created_at);
-- Clé étrangère signalement_id (ON DELETE SET NULL) : sans index, chaque effacement d'un signalement (RGPD, suppression
-- d'une copropriété) parcourait toute la table (lint Supabase 0001 ; relecture du 12/11 : 5,6 s contre 0,6 s).
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusions_signalement
  ON signalements_qr_diffusions (signalement_id) WHERE signalement_id IS NOT NULL;
COMMENT ON TABLE signalements_qr_diffusions IS 'AJ Signalement : messages d''exploitation diffusés aux déclarants d''une copropriété (auteur, périmètre, valeurs figées) ; 3 ans.';

-- ── 5. Destinataires d'une diffusion (un par adresse normalisée), état d'envoi ──
CREATE TABLE IF NOT EXISTS signalements_qr_diffusion_destinataires (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- tiré au hasard : il entre dans le lien signé
  diffusion_id          UUID NOT NULL REFERENCES signalements_qr_diffusions(id) ON DELETE CASCADE,
  copropriete_id        UUID NOT NULL,                                -- recopié : annulation immédiate à l'opposition
  email_empreinte       BYTEA NOT NULL CHECK (octet_length(email_empreinte) = 32),
  signalement_source_id UUID REFERENCES signalements_qr(id) ON DELETE SET NULL,  -- adresse relue ici au moment d'envoyer
  etat                  TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (etat IN ('en_attente', 'en_cours', 'envoye', 'refuse', 'annule', 'incertain')),
  -- deja_annoncee : message d'annonce (H1) écarté, l'adresse ayant été annoncée depuis sa création (une seule annonce).
  code                  TEXT CHECK (code IS NULL OR code IN ('adresse_refusee', 'adresse_absente', 'adresse_changee',
                                                             'opposition', 'diffusion_inactive', 'limite_service',
                                                             'quota_service', 'perime', 'issue_inconnue', 'deja_annoncee')),
  lot                   INTEGER,
  tentatives            SMALLINT NOT NULL DEFAULT 0,
  tente_le              TIMESTAMPTZ,
  envoye_le             TIMESTAMPTZ,
  CONSTRAINT signalements_qr_diffusion_dest_unique UNIQUE (diffusion_id, email_empreinte)
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusion_dest_etat   ON signalements_qr_diffusion_destinataires (diffusion_id, etat, lot);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusion_dest_boite  ON signalements_qr_diffusion_destinataires (copropriete_id, email_empreinte);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusion_dest_source ON signalements_qr_diffusion_destinataires (signalement_source_id);
COMMENT ON TABLE signalements_qr_diffusion_destinataires IS 'AJ Signalement : une ligne par adresse (empreinte, jamais l''adresse) et par diffusion, avec l''état d''envoi.';

-- ── 6. Oppositions (liste repoussoir) ──
CREATE TABLE IF NOT EXISTS signalements_qr_diffusion_oppositions (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  copropriete_id        UUID NOT NULL,                                -- sans clé étrangère : la preuve survit
  cabinet_id            UUID,
  email_empreinte       BYTEA NOT NULL CHECK (octet_length(email_empreinte) = 32),
  origine               TEXT NOT NULL CHECK (origine IN ('page', 'un_clic', 'lien_expire', 'plainte', 'demande_cabinet')),
  destinataire_id       UUID,                                         -- message dont le lien a servi, sans clé étrangère
  acteur_id             UUID,                                         -- auteur d'une « demande_cabinet »
  demande_recue_le      DATE,                                         -- date de la demande écrite reçue par le cabinet
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  levee_le              TIMESTAMPTZ,                                  -- « Recevoir à nouveau »
  levee_destinataire_id UUID,
  CONSTRAINT signalements_qr_diffusion_opp_levee_apres CHECK (levee_le IS NULL OR levee_le >= created_at),
  CONSTRAINT signalements_qr_diffusion_opp_acteur CHECK ((origine = 'demande_cabinet') = (acteur_id IS NOT NULL)),
  CONSTRAINT signalements_qr_diffusion_opp_demande CHECK ((origine = 'demande_cabinet') = (demande_recue_le IS NOT NULL)),
  -- Levée par lien : seulement le lien de la page qui a servi à l'opposition (origine page ou un clic).
  CONSTRAINT signalements_qr_diffusion_opp_levee_origine CHECK (levee_le IS NULL
    OR (origine IN ('page', 'un_clic') AND levee_destinataire_id IS NOT NULL AND levee_destinataire_id = destinataire_id))
);
-- Une seule opposition active par adresse et par copropriété ; l'historique (levées) reste.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_diffusion_opp_active
  ON signalements_qr_diffusion_oppositions (copropriete_id, email_empreinte) WHERE levee_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_signalements_qr_diffusion_opp_date ON signalements_qr_diffusion_oppositions (created_at);
COMMENT ON TABLE signalements_qr_diffusion_oppositions IS 'AJ Signalement : oppositions à la diffusion par copropriété et empreinte de l''adresse (preuve gardée au moins 3 ans, sans clé étrangère).';

-- ── 7. Règles communes ──

-- Pourquoi la copropriété ne peut pas (ou plus) diffuser ; NULL : elle le peut. Seule définition, lue par l'aperçu, la
-- création, chaque lot et l'annonce de l'accusé. Fin de mission (H7) : à partir de la date, heure de Paris.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_raison_inactive(p_copropriete uuid) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT CASE
           WHEN c.id IS NULL THEN 'introuvable'
           WHEN NOT c.actif THEN 'copropriete_inactive'
           WHEN c.cabinet_id IS NULL OR k.id IS NULL THEN 'sans_cabinet'
           WHEN k.diffusion_activee_le IS NULL THEN 'diffusion_non_activee'
           WHEN c.diffusion_fin_gestion_le IS NOT NULL
                AND (now() AT TIME ZONE 'Europe/Paris')::date >= c.diffusion_fin_gestion_le THEN 'fin_gestion'
         END
    FROM (SELECT p_copropriete AS id) AS p
    LEFT JOIN signalements_qr_coproprietes c ON c.id = p.id
    LEFT JOIN signalements_qr_cabinets k ON k.id = c.cabinet_id
$fn$;

-- Paramètres d'un périmètre cohérents, sinon 22023 : portée connue, tableaux de valeurs brutes de même longueur, message
-- d'annonce réservé à la copropriété entière.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_controler_portee(
  p_portee text, p_batiments text[], p_etages text[], p_signalement uuid, p_annonce boolean
) RETURNS void
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_nb_bat int := coalesce(cardinality(p_batiments), 0);
  v_nb_eta int := coalesce(cardinality(p_etages), 0);
BEGIN
  IF p_portee IS NULL OR p_annonce IS NULL
     OR p_portee NOT IN ('copropriete', 'batiment', 'etage', 'signalement')
     OR (p_annonce AND p_portee <> 'copropriete')
     OR (p_portee = 'copropriete' AND (v_nb_bat > 0 OR v_nb_eta > 0 OR p_signalement IS NOT NULL))
     OR (p_portee = 'batiment' AND (v_nb_bat NOT BETWEEN 1 AND 1000 OR v_nb_eta > 0 OR p_signalement IS NOT NULL))
     OR (p_portee = 'etage' AND (v_nb_bat NOT BETWEEN 1 AND 1000 OR v_nb_eta <> v_nb_bat OR p_signalement IS NOT NULL))
     OR (p_portee = 'signalement' AND (p_signalement IS NULL OR v_nb_bat > 0 OR v_nb_eta > 0))
     OR array_position(p_batiments, NULL) IS NOT NULL OR array_position(p_etages, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
END $fn$;

-- H11 : la fiche est active, reliée à ce compte, non bloquée, du cabinet de la copropriété, et la copropriété lui est
-- attribuée NOMMÉMENT (« attribuée à tous » ne suffit pas).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_gestionnaire_autorise(
  p_gestionnaire uuid, p_acteur uuid, p_copropriete uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM signalements_qr_gestionnaires g
      JOIN signalements_qr_coproprietes c ON c.id = p_copropriete AND c.cabinet_id = g.cabinet_id
      JOIN signalements_qr_attributions a ON a.gestionnaire_id = g.id AND a.copropriete_id = c.id
     WHERE g.id = p_gestionnaire AND g.actif AND g.user_id = p_acteur AND g.connexion_bloquee_le IS NULL)
$fn$;

-- ── 8. Destinataires : SEULE définition, partagée par l'aperçu et la création ──
-- Signalements de la copropriété déposés jusqu'à l'instant de l'aperçu, quel que soit leur statut ; adresse sans « @ »
-- ignorée ; une ligne par adresse normalisée (celle du signalement le plus récent du périmètre) ; oppositions actives de
-- CETTE copropriété signalées (oppose), jamais levées par un nouveau dépôt.
-- Annonce (H1 = option C) : message ordinaire → adresses incluses (accusé, ou message d'annonce parti depuis 15 jours) ;
-- message d'annonce (p_annonce) → adresses jamais annoncées, une seule fois (condition 5 de la note : « une seule
-- annonce, sans relance ») : ni datées, ni visées par une autre annonce de la copropriété encore en attente, en cours,
-- envoyée ou incertaine (peut-être partie). Seule une annonce qui n'a pas pu partir (refusée ou annulée : périmée,
-- copropriété inactive, opposition) laisse l'adresse à annoncer.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_cible(
  p_copropriete uuid, p_portee text, p_batiments text[], p_etages text[], p_signalement uuid,
  p_jusqu_au timestamptz, p_annonce boolean
) RETURNS TABLE(email_empreinte bytea, signalement_source_id uuid, oppose boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  WITH racine AS (       -- « même problème que » : le signalement et ceux qui sont liés à sa racine (un niveau)
    SELECT coalesce(s.signalement_lie_id, s.id) AS id FROM signalements_qr s
     WHERE p_portee = 'signalement' AND s.id = p_signalement AND s.copropriete_id = p_copropriete
  ), annonces AS (
    SELECT signalements_qr_empreinte_email(s.email) AS empreinte,
           bool_or((s.diffusion_annonce_origine = 'accuse' AND s.diffusion_annoncee_le <= p_jusqu_au)
                   OR (s.diffusion_annonce_origine = 'message' AND s.diffusion_annoncee_le <= p_jusqu_au - interval '15 days')) AS incluse
      FROM signalements_qr s
     WHERE s.copropriete_id = p_copropriete AND s.diffusion_annoncee_le IS NOT NULL
     GROUP BY 1
  ), choisis AS (
    SELECT s.id, s.created_at, signalements_qr_empreinte_email(s.email) AS empreinte
      FROM signalements_qr s
     WHERE s.copropriete_id = p_copropriete
       AND s.created_at <= p_jusqu_au
       AND position('@' IN s.email) > 1
       AND CASE p_portee
             WHEN 'copropriete' THEN true
             WHEN 'batiment'    THEN btrim(s.batiment) = ANY (p_batiments)
             WHEN 'etage'       THEN (btrim(s.batiment), btrim(s.etage)) IN (SELECT u.b, u.e FROM unnest(p_batiments, p_etages) AS u(b, e))
             WHEN 'signalement' THEN s.id IN (SELECT r.id FROM racine r) OR s.signalement_lie_id IN (SELECT r.id FROM racine r)
             ELSE false
           END
  )
  SELECT DISTINCT ON (c.empreinte) c.empreinte, c.id,
         EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                  WHERE o.copropriete_id = p_copropriete AND o.email_empreinte = c.empreinte AND o.levee_le IS NULL)
    FROM choisis c
    LEFT JOIN annonces a ON a.empreinte = c.empreinte
   WHERE CASE WHEN p_annonce THEN a.empreinte IS NULL
                AND NOT EXISTS (SELECT 1 FROM signalements_qr_diffusion_destinataires y
                                  JOIN signalements_qr_diffusions e ON e.id = y.diffusion_id
                                 WHERE y.copropriete_id = p_copropriete AND y.email_empreinte = c.empreinte
                                   AND e.modele = 'annonce' AND y.etat IN ('en_attente', 'en_cours', 'envoye', 'incertain'))
              ELSE coalesce(a.incluse, false) END
   ORDER BY c.empreinte, c.created_at DESC, c.id
$fn$;

-- Couples (bâtiment, étage) bruts présents (rognés), avec le nombre d'adresses ; 1 000 au plus (limite de PostgREST).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_valeurs(p_copropriete uuid)
RETURNS TABLE(batiment text, etage text, nb_adresses bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT btrim(s.batiment), btrim(s.etage), count(DISTINCT signalements_qr_empreinte_email(s.email))
    FROM signalements_qr s
   WHERE s.copropriete_id = p_copropriete AND position('@' IN s.email) > 1
   GROUP BY 1, 2
   ORDER BY 3 DESC, 1, 2
   LIMIT 1000
$fn$;

-- Aperçu (aucune écriture) : nombre exact, nombre exclu par opposition, possibilité et raison, instant de l'aperçu
-- (repassé à la création : les dépôts suivants n'entrent pas dans le périmètre affiché).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_apercu(
  p_copropriete uuid, p_portee text, p_batiments text[], p_etages text[], p_signalement uuid, p_annonce boolean
) RETURNS TABLE(nb_destinataires integer, nb_exclus_opposition integer, possible boolean, raison text, instant timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
#variable_conflict use_column
DECLARE
  v_raison text;
BEGIN
  IF p_copropriete IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  PERFORM signalements_qr_diffusion_controler_portee(p_portee, p_batiments, p_etages, p_signalement, p_annonce);
  v_raison := signalements_qr_diffusion_raison_inactive(p_copropriete);
  RETURN QUERY
    SELECT (count(*) FILTER (WHERE NOT c.oppose))::integer, (count(*) FILTER (WHERE c.oppose))::integer,
           v_raison IS NULL, v_raison, now()
      FROM signalements_qr_diffusion_cible(p_copropriete, p_portee, p_batiments, p_etages, p_signalement, now(), p_annonce) AS c;
END $fn$;

-- Diffusions du mois civil en cours (heure de Paris) dont au moins une personne a reçu le message ; l'annonce n'est
-- pas comptée.
CREATE OR REPLACE FUNCTION signalements_qr_diffusions_mois(p_copropriete uuid)
RETURNS TABLE(nb integer, dernier_le timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT count(*)::integer, max(d.created_at)
    FROM signalements_qr_diffusions d
   WHERE d.copropriete_id = p_copropriete AND d.modele <> 'annonce'
     AND d.created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')
     AND EXISTS (SELECT 1 FROM signalements_qr_diffusion_destinataires x WHERE x.diffusion_id = d.id AND x.etat = 'envoye')
$fn$;

-- ── 9. Création atomique ──
-- Verrou de la copropriété (deux envois simultanés se suivent) ; rejeu d'un double clic ; copropriété et cabinet relus
-- sous verrou partagé (une désactivation attend la fin) ; nombre réel jamais au-dessus du nombre affiché
-- (perimetre_change), au-dessous (opposition survenue depuis l'aperçu) : création au nombre réel ; valeurs figées ;
-- destinataires non opposés en attente ; journal diffusion.envoyee (énumérations et nombres seulement).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_creer(
  p_operation uuid, p_copropriete uuid, p_acteur uuid, p_profil text, p_gestionnaire uuid,
  p_instruction_reference text, p_instruction_recue_le date, p_modele text, p_objet text, p_texte text,
  p_portee text, p_cle_batiment text, p_cle_etage text, p_batiments text[], p_etages text[], p_signalement uuid,
  p_libelle text, p_jusqu_au timestamptz, p_attendu integer, p_expediteur text
) RETURNS TABLE(diffusion_id uuid, nb_destinataires integer, rejeu boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
#variable_conflict use_column
DECLARE
  v_existante  signalements_qr_diffusions%ROWTYPE;
  v_copro      signalements_qr_coproprietes%ROWTYPE;
  v_cab        signalements_qr_cabinets%ROWTYPE;
  v_empreintes bytea[];
  v_sources    uuid[];
  v_exclus     integer;
  v_nb         integer;
  v_id         uuid;
BEGIN
  IF p_operation IS NULL OR p_copropriete IS NULL OR p_acteur IS NULL OR p_profil IS NULL
     OR p_profil NOT IN ('super_admin', 'gestionnaire') OR (p_profil = 'super_admin') <> (p_gestionnaire IS NULL)
     OR p_modele IS NULL OR p_objet IS NULL OR p_texte IS NULL OR p_jusqu_au IS NULL OR p_attendu IS NULL OR p_attendu < 1
     OR nullif(btrim(p_expediteur), '') IS NULL OR nullif(btrim(p_libelle), '') IS NULL
     OR (p_portee IN ('batiment', 'etage')) <> (p_cle_batiment IS NOT NULL)
     OR (p_portee = 'etage') <> (p_cle_etage IS NOT NULL)
     OR (p_profil = 'super_admin' AND (nullif(btrim(p_instruction_reference), '') IS NULL OR p_instruction_recue_le IS NULL
         OR p_instruction_recue_le > (now() AT TIME ZONE 'Europe/Paris')::date)) THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  PERFORM signalements_qr_diffusion_controler_portee(p_portee, p_batiments, p_etages, p_signalement, p_modele = 'annonce');

  PERFORM pg_advisory_xact_lock(hashtextextended('aj-diffusion:' || p_copropriete::text, 0));

  -- Double clic, onglets multiples : même opération, même auteur, même copropriété → la diffusion déjà créée.
  SELECT * INTO v_existante FROM signalements_qr_diffusions d WHERE d.operation_id = p_operation;
  IF FOUND THEN
    IF v_existante.acteur_id = p_acteur AND v_existante.copropriete_id = p_copropriete THEN
      RETURN QUERY SELECT v_existante.id, v_existante.nb_destinataires, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_copro FROM signalements_qr_coproprietes c WHERE c.id = p_copropriete FOR SHARE;
  IF FOUND AND v_copro.cabinet_id IS NOT NULL THEN
    SELECT * INTO v_cab FROM signalements_qr_cabinets k WHERE k.id = v_copro.cabinet_id FOR SHARE;
  END IF;
  IF signalements_qr_diffusion_raison_inactive(p_copropriete) IS NOT NULL THEN
    RAISE EXCEPTION 'diffusion_inactive' USING ERRCODE = 'P0001';
  END IF;
  IF p_profil = 'gestionnaire'
     AND NOT signalements_qr_diffusion_gestionnaire_autorise(p_gestionnaire, p_acteur, p_copropriete) THEN
    RAISE EXCEPTION 'interdit' USING ERRCODE = '42501';
  END IF;
  -- Instant de l'aperçu : passé, et de moins de 30 minutes (au-delà, l'écran refait l'aperçu).
  IF p_jusqu_au > now() OR p_jusqu_au < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'perimetre_change' USING ERRCODE = 'P0001';
  END IF;

  -- Destinataires calculés UNE fois : la même liste sert au nombre et à l'insertion.
  SELECT coalesce(array_agg(c.email_empreinte ORDER BY c.email_empreinte) FILTER (WHERE NOT c.oppose), '{}'),
         coalesce(array_agg(c.signalement_source_id ORDER BY c.email_empreinte) FILTER (WHERE NOT c.oppose), '{}'),
         count(*) FILTER (WHERE c.oppose)
    INTO v_empreintes, v_sources, v_exclus
    FROM signalements_qr_diffusion_cible(p_copropriete, p_portee, p_batiments, p_etages, p_signalement, p_jusqu_au,
                                         p_modele = 'annonce') AS c;
  v_nb := cardinality(v_empreintes);
  IF v_nb = 0 THEN
    RAISE EXCEPTION 'aucun_destinataire' USING ERRCODE = 'P0001';
  END IF;
  IF v_nb > p_attendu THEN
    RAISE EXCEPTION 'perimetre_change' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO signalements_qr_diffusions (
    copropriete_id, cabinet_id, operation_id, acteur_id, acteur_profil, acteur_gestionnaire_id,
    instruction_reference, instruction_recue_le, modele, langue,
    fige_cabinet_nom, fige_cabinet_identifiant, fige_copropriete_nom, fige_contact_email, fige_politique_url, fige_expediteur,
    perimetre_jusqu_au, objet, texte, portee, cle_batiment, cle_etage, signalement_id, libelle_perimetre,
    nb_destinataires, nb_exclus_opposition)
  VALUES (
    p_copropriete, v_cab.id, p_operation, p_acteur, p_profil, p_gestionnaire,
    CASE WHEN p_profil = 'super_admin' THEN btrim(p_instruction_reference) END,
    CASE WHEN p_profil = 'super_admin' THEN p_instruction_recue_le END,
    p_modele, v_cab.langue,
    v_cab.nom, v_cab.identifiant, v_copro.nom, v_cab.diffusion_contact_email, v_cab.diffusion_politique_url, p_expediteur,
    p_jusqu_au, p_objet, p_texte, p_portee, p_cle_batiment, p_cle_etage, p_signalement, p_libelle,
    v_nb, v_exclus)
  RETURNING id INTO v_id;

  INSERT INTO signalements_qr_diffusion_destinataires (diffusion_id, copropriete_id, email_empreinte, signalement_source_id)
  SELECT v_id, p_copropriete, t.e, t.s FROM unnest(v_empreintes, v_sources) AS t(e, s);

  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action, copropriete_id,
                                       signalement_id, operation_id, details)
  VALUES (v_cab.id, p_acteur, p_profil, p_gestionnaire, 'diffusion.envoyee', p_copropriete, p_signalement, p_operation,
          jsonb_build_object('diffusion', v_id, 'portee', p_portee, 'modele', p_modele, 'nb_destinataires', v_nb,
                             'nb_exclus', v_exclus));
  RETURN QUERY SELECT v_id, v_nb, false;
END $fn$;

-- ── 10. Envoi par lots ──

-- Lignes d'un lot qui ne peuvent plus partir : opposition active (annule, opposition) ; signalement source supprimé ou
-- adresse dont l'empreinte a changé (refuse, adresse_absente / adresse_changee) ; message d'annonce dont l'adresse a été
-- annoncée depuis sa création (annule, deja_annoncee : condition 5 de la note, une seule annonce) — un signalement de
-- l'adresse est daté (accusé d'un nouveau dépôt, autre annonce partie), ou une autre annonce de la copropriété l'a en
-- cours, envoyée ou incertaine. Rend le nombre de lignes écartées.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_ecarter(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_opposees integer;
  v_adresses integer;
  v_annoncees integer;
BEGIN
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'opposition'
   WHERE x.id = ANY (p_ids) AND x.etat IN ('en_attente', 'en_cours')
     AND EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                  WHERE o.copropriete_id = x.copropriete_id AND o.email_empreinte = x.email_empreinte AND o.levee_le IS NULL);
  GET DIAGNOSTICS v_opposees = ROW_COUNT;
  UPDATE signalements_qr_diffusion_destinataires x
     SET etat = 'refuse', code = CASE WHEN q.source_id IS NULL THEN 'adresse_absente' ELSE 'adresse_changee' END
    FROM (SELECT y.id, s.id AS source_id, s.email
            FROM signalements_qr_diffusion_destinataires y
            LEFT JOIN signalements_qr s ON s.id = y.signalement_source_id
           WHERE y.id = ANY (p_ids)) AS q
   WHERE q.id = x.id AND x.etat IN ('en_attente', 'en_cours')
     AND (q.source_id IS NULL OR signalements_qr_empreinte_email(q.email) <> x.email_empreinte);
  GET DIAGNOSTICS v_adresses = ROW_COUNT;
  -- Adresse cherchée par idx_signalements_qr_copro_empreinte et idx_signalements_qr_diffusion_dest_boite.
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'deja_annoncee'
    FROM signalements_qr_diffusions d
   WHERE d.id = x.diffusion_id AND d.modele = 'annonce'
     AND x.id = ANY (p_ids) AND x.etat IN ('en_attente', 'en_cours')
     AND (EXISTS (SELECT 1 FROM signalements_qr s
                   WHERE s.copropriete_id = x.copropriete_id AND s.diffusion_annoncee_le IS NOT NULL
                     AND signalements_qr_empreinte_email(s.email) = x.email_empreinte)
          OR EXISTS (SELECT 1 FROM signalements_qr_diffusion_destinataires y
                       JOIN signalements_qr_diffusions e ON e.id = y.diffusion_id
                      WHERE y.copropriete_id = x.copropriete_id AND y.email_empreinte = x.email_empreinte
                        AND y.diffusion_id <> x.diffusion_id AND e.modele = 'annonce'
                        AND y.etat IN ('en_cours', 'envoye', 'incertain')));
  GET DIAGNOSTICS v_annoncees = ROW_COUNT;
  RETURN v_opposees + v_adresses + v_annoncees;
END $fn$;

-- Réserve le lot suivant d'une diffusion (au plus p_taille lignes) et rend l'adresse relue de chaque ligne :
--   - plus rien ne part 24 h après la création (en attente → annule/perime ; lot interrompu → incertain) ;
--   - copropriété ou cabinet qui ne permet plus la diffusion → lignes restantes annule/diffusion_inactive ;
--   - en cours depuis plus de 23 h (clé d'idempotence expirée) → incertain, jamais renvoyé ;
--   - lot interrompu (en cours depuis plus de 10 minutes) : chaque ligne revérifiée ; toutes éligibles → rejoué à
--     l'identique (même numéro, reprise = true) ; sinon les inéligibles sont écartées et les autres partent sous un
--     NOUVEAU numéro (nouvelle clé : jamais un message après une opposition) ;
--   - sinon, lignes en attente : oppositions, adresses et (message d'annonce) annonce déjà faite revérifiées
--     (signalements_qr_diffusion_ecarter), le reste en cours sous un nouveau numéro.
-- La ligne de la diffusion est le verrou : un seul appel à la fois par diffusion (lots et résultats).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_lot(p_diffusion uuid, p_taille integer)
RETURNS TABLE(destinataire_id uuid, email text, lot integer, reprise boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
#variable_conflict use_column
DECLARE
  v_d        signalements_qr_diffusions%ROWTYPE;
  v_lot      integer;
  v_total    integer;
  v_ids      uuid[];
  v_num      integer;
  v_reprise  boolean := false;
BEGIN
  IF p_diffusion IS NULL OR p_taille IS NULL OR p_taille NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_d FROM signalements_qr_diffusions d WHERE d.id = p_diffusion FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_d.created_at < now() - interval '24 hours' THEN
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'perime'
     WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_attente';
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'incertain', code = 'issue_inconnue'
     WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_cours' AND x.tente_le < now() - interval '10 minutes';
    RETURN;
  END IF;
  IF signalements_qr_diffusion_raison_inactive(v_d.copropriete_id) IS NOT NULL THEN
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'diffusion_inactive'
     WHERE x.diffusion_id = p_diffusion
       AND (x.etat = 'en_attente' OR (x.etat = 'en_cours' AND x.tente_le < now() - interval '10 minutes'));
    RETURN;
  END IF;
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'incertain', code = 'issue_inconnue'
   WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_cours' AND x.tente_le < now() - interval '23 hours';

  -- Lot interrompu : le plus ancien numéro, entier (aucune de ses lignes tenue par un autre appel).
  SELECT min(x.lot) INTO v_lot FROM signalements_qr_diffusion_destinataires x
   WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_cours' AND x.tente_le < now() - interval '10 minutes';
  IF v_lot IS NOT NULL THEN
    SELECT count(*) INTO v_total FROM signalements_qr_diffusion_destinataires x
     WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_cours' AND x.lot = v_lot;
    v_ids := ARRAY(SELECT x.id FROM signalements_qr_diffusion_destinataires x
                    WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_cours' AND x.lot = v_lot
                    ORDER BY x.id FOR UPDATE SKIP LOCKED);
    IF cardinality(v_ids) = v_total THEN
      IF signalements_qr_diffusion_ecarter(v_ids) = 0 THEN
        v_reprise := true;
        v_num := v_lot;
      ELSE
        v_ids := ARRAY(SELECT x.id FROM signalements_qr_diffusion_destinataires x
                        WHERE x.id = ANY (v_ids) AND x.etat = 'en_cours' ORDER BY x.id);
        IF cardinality(v_ids) > 0 THEN
          v_num := v_d.dernier_lot + 1;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_num IS NULL THEN
    -- Oppositions survenues depuis la création : ces lignes en attente ne partent pas.
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'opposition'
     WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_attente'
       AND EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                    WHERE o.copropriete_id = x.copropriete_id AND o.email_empreinte = x.email_empreinte AND o.levee_le IS NULL);
    LOOP
      v_ids := ARRAY(SELECT x.id FROM signalements_qr_diffusion_destinataires x
                      WHERE x.diffusion_id = p_diffusion AND x.etat = 'en_attente'
                      ORDER BY x.id LIMIT p_taille FOR UPDATE SKIP LOCKED);
      IF cardinality(v_ids) = 0 THEN
        RETURN;
      END IF;
      PERFORM signalements_qr_diffusion_ecarter(v_ids);
      v_ids := ARRAY(SELECT x.id FROM signalements_qr_diffusion_destinataires x
                      WHERE x.id = ANY (v_ids) AND x.etat = 'en_attente' ORDER BY x.id);
      EXIT WHEN cardinality(v_ids) > 0;
    END LOOP;
    v_num := v_d.dernier_lot + 1;
  END IF;

  IF NOT v_reprise THEN
    UPDATE signalements_qr_diffusions d SET dernier_lot = v_num WHERE d.id = p_diffusion;
  END IF;
  UPDATE signalements_qr_diffusion_destinataires x
     SET etat = 'en_cours', code = NULL, lot = v_num, tente_le = now(), tentatives = x.tentatives + 1
   WHERE x.id = ANY (v_ids);
  RETURN QUERY
    SELECT x.id, lower(btrim(s.email, E' \t\r\n')), x.lot, v_reprise
      FROM signalements_qr_diffusion_destinataires x
      JOIN signalements_qr s ON s.id = x.signalement_source_id
     WHERE x.id = ANY (v_ids)
     ORDER BY x.id;
END $fn$;

-- Issue d'un lot, seulement sur les lignes EN COURS de ce lot : acceptées → envoye ; refusées à l'unité → refuse
-- (adresse_refusee) ; non parties : limite_service ou quota_service → en attente (relance par le filet de reprise),
-- issue_inconnue (contenu refusé au rejeu) → incertain. Message d'annonce : les signalements de chaque adresse servie par
-- CE lot sont datés dans la même transaction (H1). Rend { envoyes, refuses, nonPartis, reste }.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_resultats(
  p_diffusion uuid, p_lot integer, p_envoyes uuid[], p_refuses uuid[], p_non_partis uuid[], p_code text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_modele      text;
  v_envoyes     integer;
  v_refuses     integer;
  v_non_partis  integer;
  v_reste       integer;
BEGIN
  IF p_diffusion IS NULL OR p_lot IS NULL
     OR (coalesce(cardinality(p_non_partis), 0) > 0
         AND (p_code IS NULL OR p_code NOT IN ('limite_service', 'quota_service', 'issue_inconnue'))) THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT d.modele INTO v_modele FROM signalements_qr_diffusions d WHERE d.id = p_diffusion FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('envoyes', 0, 'refuses', 0, 'nonPartis', 0, 'reste', 0);
  END IF;
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'envoye', code = NULL, envoye_le = now()
   WHERE x.diffusion_id = p_diffusion AND x.lot = p_lot AND x.etat = 'en_cours' AND x.id = ANY (coalesce(p_envoyes, '{}'));
  GET DIAGNOSTICS v_envoyes = ROW_COUNT;
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'refuse', code = 'adresse_refusee'
   WHERE x.diffusion_id = p_diffusion AND x.lot = p_lot AND x.etat = 'en_cours' AND x.id = ANY (coalesce(p_refuses, '{}'));
  GET DIAGNOSTICS v_refuses = ROW_COUNT;
  UPDATE signalements_qr_diffusion_destinataires x
     SET etat = CASE WHEN p_code = 'issue_inconnue' THEN 'incertain' ELSE 'en_attente' END,
         code = p_code,
         lot = CASE WHEN p_code = 'issue_inconnue' THEN x.lot END
   WHERE x.diffusion_id = p_diffusion AND x.lot = p_lot AND x.etat = 'en_cours' AND x.id = ANY (coalesce(p_non_partis, '{}'));
  GET DIAGNOSTICS v_non_partis = ROW_COUNT;
  IF v_modele = 'annonce' AND v_envoyes > 0 THEN
    PERFORM signalements_qr_diffusion_annonce_envoyee(p_diffusion, p_lot);
  END IF;
  SELECT count(*) INTO v_reste FROM signalements_qr_diffusion_destinataires x
   WHERE x.diffusion_id = p_diffusion AND x.etat IN ('en_attente', 'en_cours');
  RETURN jsonb_build_object('envoyes', v_envoyes, 'refuses', v_refuses, 'nonPartis', v_non_partis, 'reste', v_reste);
END $fn$;

-- Filet de reprise (route appelée toutes les 5 minutes) : diffusions de MOINS d'une heure ayant des lignes en attente,
-- ou un lot interrompu (en cours depuis plus de 10 minutes) ; au-delà d'une heure, reprise manuelle confirmée seulement.
CREATE OR REPLACE FUNCTION signalements_qr_diffusions_a_reprendre(p_limite integer)
RETURNS TABLE(diffusion_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT d.id FROM signalements_qr_diffusions d
   WHERE d.created_at > now() - interval '1 hour'
     AND EXISTS (SELECT 1 FROM signalements_qr_diffusion_destinataires x
                  WHERE x.diffusion_id = d.id
                    AND (x.etat = 'en_attente' OR (x.etat = 'en_cours' AND x.tente_le < now() - interval '10 minutes')))
   ORDER BY d.created_at, d.id
   LIMIT least(greatest(coalesce(p_limite, 10), 1), 50)
$fn$;

-- Historique d'une copropriété (20 par page par défaut, 100 au plus) : nombres agrégés depuis les destinataires.
CREATE OR REPLACE FUNCTION signalements_qr_diffusions_liste(p_copropriete uuid, p_avant timestamptz, p_limite integer)
RETURNS TABLE(id uuid, cree_le timestamptz, acteur_profil text, acteur_id uuid, acteur_gestionnaire_id uuid, modele text,
              objet text, portee text, libelle_perimetre text, nb_destinataires integer, nb_exclus_opposition integer,
              nb_envoyes integer, nb_refuses integer, nb_attente integer, nb_annules integer, nb_incertains integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT d.id, d.created_at, d.acteur_profil, d.acteur_id, d.acteur_gestionnaire_id, d.modele, d.objet, d.portee,
         d.libelle_perimetre, d.nb_destinataires, d.nb_exclus_opposition,
         (count(x.id) FILTER (WHERE x.etat = 'envoye'))::integer,
         (count(x.id) FILTER (WHERE x.etat = 'refuse'))::integer,
         (count(x.id) FILTER (WHERE x.etat IN ('en_attente', 'en_cours')))::integer,
         (count(x.id) FILTER (WHERE x.etat = 'annule'))::integer,
         (count(x.id) FILTER (WHERE x.etat = 'incertain'))::integer
    FROM signalements_qr_diffusions d
    LEFT JOIN signalements_qr_diffusion_destinataires x ON x.diffusion_id = d.id
   WHERE d.copropriete_id = p_copropriete AND (p_avant IS NULL OR d.created_at < p_avant)
   GROUP BY d.id
   ORDER BY d.created_at DESC, d.id DESC
   LIMIT least(greatest(coalesce(p_limite, 20), 1), 100)
$fn$;

-- ── 11. Désinscription (la route a vérifié la signature du lien) ──

-- Lecture d'un lien, sans effet : noms figés du message, contact et politique du cabinet, adresse (seulement si elle
-- correspond encore à l'empreinte : l'écran la masque), opposée, levable ; jamais la date d'une opposition.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_lien(p_destinataire uuid)
RETURNS TABLE(diffusion_id uuid, copropriete_id uuid, copropriete_nom text, cabinet_nom text, cabinet_identifiant text,
              langue text, politique_url text, contact_email text, diffusion_cree_le timestamptz, email text,
              oppose boolean, levable boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT d.id, d.copropriete_id, d.fige_copropriete_nom, d.fige_cabinet_nom, d.fige_cabinet_identifiant, d.langue,
         coalesce(k.diffusion_politique_url, d.fige_politique_url), coalesce(k.diffusion_contact_email, d.fige_contact_email),
         d.created_at,
         CASE WHEN signalements_qr_empreinte_email(s.email) = x.email_empreinte THEN lower(btrim(s.email, E' \t\r\n')) END,
         EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                  WHERE o.copropriete_id = x.copropriete_id AND o.email_empreinte = x.email_empreinte AND o.levee_le IS NULL),
         EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                  WHERE o.copropriete_id = x.copropriete_id AND o.email_empreinte = x.email_empreinte AND o.levee_le IS NULL
                    AND o.destinataire_id = x.id AND o.origine IN ('page', 'un_clic')
                    AND o.created_at > now() - interval '24 hours')
    FROM signalements_qr_diffusion_destinataires x
    JOIN signalements_qr_diffusions d ON d.id = x.diffusion_id
    LEFT JOIN signalements_qr_cabinets k ON k.id = d.cabinet_id
    LEFT JOIN signalements_qr s ON s.id = x.signalement_source_id
   WHERE x.id = p_destinataire
$fn$;

-- Opposition par lien (page, un clic), repli (lien expiré + adresse saisie) ou plainte du service d'e-mail. Repli : la
-- MÊME insertion s'exécute que l'adresse soit juste ou fausse ; fausse → aucune ligne, false. Une opposition créée annule,
-- dans la même transaction, les lignes en attente de cette adresse dans toutes les diffusions de la copropriété (les
-- lignes en cours sont revérifiées par le lot). Idempotente.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_opposer(p_destinataire uuid, p_origine text, p_email_saisi text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_copro     uuid;
  v_cab       uuid;
  v_empreinte bytea;
  v_saisie    bytea;
  v_cree      bigint;
BEGIN
  IF p_destinataire IS NULL OR p_origine IS NULL OR p_origine NOT IN ('page', 'un_clic', 'lien_expire', 'plainte')
     OR (p_origine = 'lien_expire') <> (p_email_saisi IS NOT NULL) THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  v_saisie := signalements_qr_empreinte_email(p_email_saisi);
  SELECT x.copropriete_id, d.cabinet_id, x.email_empreinte INTO v_copro, v_cab, v_empreinte
    FROM signalements_qr_diffusion_destinataires x
    JOIN signalements_qr_diffusions d ON d.id = x.diffusion_id
   WHERE x.id = p_destinataire;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO signalements_qr_diffusion_oppositions (copropriete_id, cabinet_id, email_empreinte, origine, destinataire_id)
  SELECT v_copro, v_cab, v_empreinte, p_origine, p_destinataire
   WHERE p_email_saisi IS NULL OR v_saisie = v_empreinte
  ON CONFLICT (copropriete_id, email_empreinte) WHERE levee_le IS NULL DO NOTHING
  RETURNING id INTO v_cree;
  IF v_cree IS NOT NULL THEN
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'opposition'
     WHERE x.copropriete_id = v_copro AND x.email_empreinte = v_empreinte AND x.etat = 'en_attente';
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, action, copropriete_id, details)
    VALUES (v_cab, 'systeme', 'diffusion.opposition', v_copro, jsonb_build_object('origine', p_origine));
  END IF;
  RETURN p_email_saisi IS NULL OR v_saisie = v_empreinte;
END $fn$;

-- « Recevoir à nouveau » : seulement l'opposition ACTIVE faite avec CE lien (page ou un clic du même message), dans les
-- 24 h ; sinon false, sans écriture (une opposition plainte, demande_cabinet ou lien_expire ne se lève jamais par un lien).
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_lever(p_destinataire uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_copro     uuid;
  v_cab       uuid;
  v_empreinte bytea;
  v_levee     bigint;
BEGIN
  IF p_destinataire IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT x.copropriete_id, d.cabinet_id, x.email_empreinte INTO v_copro, v_cab, v_empreinte
    FROM signalements_qr_diffusion_destinataires x
    JOIN signalements_qr_diffusions d ON d.id = x.diffusion_id
   WHERE x.id = p_destinataire;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE signalements_qr_diffusion_oppositions o SET levee_le = now(), levee_destinataire_id = p_destinataire
   WHERE o.copropriete_id = v_copro AND o.email_empreinte = v_empreinte AND o.levee_le IS NULL
     AND o.destinataire_id = p_destinataire AND o.origine IN ('page', 'un_clic')
     AND o.created_at > now() - interval '24 hours'
  RETURNING o.id INTO v_levee;
  IF v_levee IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, action, copropriete_id)
  VALUES (v_cab, 'systeme', 'diffusion.opposition_levee', v_copro);
  RETURN true;
END $fn$;

-- Opposition enregistrée par le cabinet à la demande écrite de la personne (date de la demande gardée, non future) ; le
-- signalement doit appartenir à la copropriété (sinon false, rien d'écrit) ; gestionnaire : règle H11.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_opposer_signalement(
  p_signalement uuid, p_copropriete uuid, p_acteur uuid, p_profil text, p_gestionnaire uuid, p_demande_recue_le date
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab       uuid;
  v_empreinte bytea;
  v_cree      bigint;
BEGIN
  IF p_signalement IS NULL OR p_copropriete IS NULL OR p_acteur IS NULL OR p_profil IS NULL
     OR p_profil NOT IN ('super_admin', 'gestionnaire') OR (p_profil = 'super_admin') <> (p_gestionnaire IS NULL)
     OR p_demande_recue_le IS NULL OR p_demande_recue_le > (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  IF p_profil = 'gestionnaire'
     AND NOT signalements_qr_diffusion_gestionnaire_autorise(p_gestionnaire, p_acteur, p_copropriete) THEN
    RAISE EXCEPTION 'interdit' USING ERRCODE = '42501';
  END IF;
  SELECT c.cabinet_id, signalements_qr_empreinte_email(s.email) INTO v_cab, v_empreinte
    FROM signalements_qr s JOIN signalements_qr_coproprietes c ON c.id = s.copropriete_id
   WHERE s.id = p_signalement AND s.copropriete_id = p_copropriete;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO signalements_qr_diffusion_oppositions (copropriete_id, cabinet_id, email_empreinte, origine, acteur_id, demande_recue_le)
  VALUES (p_copropriete, v_cab, v_empreinte, 'demande_cabinet', p_acteur, p_demande_recue_le)
  ON CONFLICT (copropriete_id, email_empreinte) WHERE levee_le IS NULL DO NOTHING
  RETURNING id INTO v_cree;
  IF v_cree IS NOT NULL THEN
    UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'opposition'
     WHERE x.copropriete_id = p_copropriete AND x.email_empreinte = v_empreinte AND x.etat = 'en_attente';
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action, copropriete_id,
                                         signalement_id, details)
    VALUES (v_cab, p_acteur, p_profil, p_gestionnaire, 'diffusion.opposition', p_copropriete, p_signalement,
            jsonb_build_object('origine', 'demande_cabinet'));
  END IF;
  RETURN true;
END $fn$;

-- ── 12. Annonce de la diffusion (H1 = option C) ──

-- L'accusé de ce dépôt doit-il porter les deux phrases ? Copropriété qui peut diffuser et adresse sans opposition active
-- dans cette copropriété : jamais l'annonce d'une diffusion qui n'existe pas, ni à une personne qui s'y est opposée.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_annonce(p_signalement uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT coalesce((
    SELECT signalements_qr_diffusion_raison_inactive(s.copropriete_id) IS NULL
           AND position('@' IN s.email) > 1
           AND NOT EXISTS (SELECT 1 FROM signalements_qr_diffusion_oppositions o
                            WHERE o.copropriete_id = s.copropriete_id
                              AND o.email_empreinte = signalements_qr_empreinte_email(s.email) AND o.levee_le IS NULL)
      FROM signalements_qr s WHERE s.id = p_signalement), false)
$fn$;

-- Après acceptation de l'accusé par le service d'e-mail : annonce datée (origine accuse), une fois, si elle était due.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_annonce_faite(p_signalement uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF p_signalement IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE signalements_qr s SET diffusion_annoncee_le = now(), diffusion_annonce_origine = 'accuse'
   WHERE s.id = p_signalement AND s.diffusion_annoncee_le IS NULL AND signalements_qr_diffusion_annonce(p_signalement);
  RETURN FOUND;
END $fn$;

-- Message d'annonce parti : chaque signalement (déposé avant l'envoi, pas encore annoncé) d'une adresse servie par le
-- lot p_lot est daté de l'envoi, origine message (preuve de l'information préalable ; inclusion 15 jours après). Appelée
-- par les résultats de ce lot ; rejouable. Coût borné par le lot (100 lignes au plus), chaque adresse cherchée par
-- idx_signalements_qr_copro_empreinte : jamais (lignes envoyées de la diffusion × signalements de la copropriété).
-- Rend le nombre de signalements datés.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_annonce_envoyee(p_diffusion uuid, p_lot integer) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_diffusion IS NULL OR p_lot IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE signalements_qr s SET diffusion_annoncee_le = x.envoye_le, diffusion_annonce_origine = 'message'
    FROM signalements_qr_diffusion_destinataires x
    JOIN signalements_qr_diffusions d ON d.id = x.diffusion_id
   WHERE x.diffusion_id = p_diffusion AND x.lot = p_lot AND d.modele = 'annonce' AND x.etat = 'envoye'
     AND x.envoye_le IS NOT NULL
     AND s.copropriete_id = d.copropriete_id AND s.diffusion_annoncee_le IS NULL AND s.created_at <= x.envoye_le
     AND signalements_qr_empreinte_email(s.email) = x.email_empreinte;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $fn$;

-- ── 13. Conservation (H10) ──
-- Diffusions et destinataires : 3 ans. Oppositions levées : 3 ans après la levée. Oppositions actives : 3 ans au moins,
-- puis tant qu'un signalement de cette adresse existe dans la copropriété. Lignes non parties 24 h après la création :
-- annule/perime (lot interrompu : incertain). Lancée par le filet de reprise (une fois par jour) et l'historique.
CREATE OR REPLACE FUNCTION signalements_qr_diffusion_purger()
RETURNS TABLE(diffusions integer, oppositions integer, perimees integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
#variable_conflict use_column
DECLARE
  v_diffusions  integer;
  v_oppositions integer;
  v_perimees    integer;
  v_incertaines integer;
BEGIN
  DELETE FROM signalements_qr_diffusions d WHERE d.created_at < now() - interval '3 years';
  GET DIAGNOSTICS v_diffusions = ROW_COUNT;
  DELETE FROM signalements_qr_diffusion_oppositions o
   WHERE (o.levee_le IS NOT NULL AND o.levee_le < now() - interval '3 years')
      OR (o.levee_le IS NULL AND o.created_at < now() - interval '3 years'
          AND NOT EXISTS (SELECT 1 FROM signalements_qr s
                           WHERE s.copropriete_id = o.copropriete_id
                             AND signalements_qr_empreinte_email(s.email) = o.email_empreinte));
  GET DIAGNOSTICS v_oppositions = ROW_COUNT;
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'annule', code = 'perime'
    FROM signalements_qr_diffusions d
   WHERE d.id = x.diffusion_id AND x.etat = 'en_attente' AND d.created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_perimees = ROW_COUNT;
  UPDATE signalements_qr_diffusion_destinataires x SET etat = 'incertain', code = 'issue_inconnue'
    FROM signalements_qr_diffusions d
   WHERE d.id = x.diffusion_id AND x.etat = 'en_cours' AND d.created_at < now() - interval '24 hours'
     AND x.tente_le < now() - interval '10 minutes';
  GET DIAGNOSTICS v_incertaines = ROW_COUNT;
  IF v_diffusions + v_oppositions + v_perimees + v_incertaines > 0 THEN
    INSERT INTO signalements_qr_journal (acteur_profil, action, details)
    VALUES ('systeme', 'diffusion.purge', jsonb_build_object('diffusions', v_diffusions, 'oppositions', v_oppositions,
                                                             'perimees', v_perimees, 'incertaines', v_incertaines));
  END IF;
  RETURN QUERY SELECT v_diffusions, v_oppositions, v_perimees + v_incertaines;
END $fn$;

-- ── 14. Journal : liste fermée des actions remplacée (la 20261111, appliquée, ne peut plus la recevoir) ──
-- En UNE instruction (DROP et ADD dans le même ALTER), seulement si les 7 actions de la diffusion manquent à la
-- définition en place (rejeu : rien). La nouvelle liste = les 34 actions de la 20261111 (aucune migration postérieure ne
-- l'a changée) + les 7 de la diffusion. Garde : si la définition en place connaissait une action absente de la nouvelle
-- liste, tout s'arrête (55000) au lieu de la retirer en silence.
DO $$
DECLARE
  v_avant  text[];
  v_apres  text[];
  v_perdue text;
BEGIN
  v_avant := ARRAY(SELECT m.v[1] FROM pg_constraint k
                     CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(k.oid), '''([^'']+)''', 'g') AS m(v)
                    WHERE k.conname = 'signalements_qr_journal_action_valeurs' AND k.conrelid = 'signalements_qr_journal'::regclass);
  IF v_avant @> ARRAY['cabinet.diffusion_activee', 'cabinet.diffusion_suspendue', 'diffusion.envoyee', 'diffusion.reprise',
                      'diffusion.opposition', 'diffusion.opposition_levee', 'diffusion.purge'] THEN
    RETURN;
  END IF;
  ALTER TABLE signalements_qr_journal
    DROP CONSTRAINT IF EXISTS signalements_qr_journal_action_valeurs,
    ADD CONSTRAINT signalements_qr_journal_action_valeurs CHECK (action IN (
      'cabinet.cree', 'cabinet.modifie', 'cabinet.domaines_modifies',
      'copropriete.creee', 'copropriete.modifiee', 'copropriete.desactivee', 'copropriete.reactivee',
      'copropriete.jeton_remplace', 'copropriete.supprimee', 'copropriete.tous_active', 'copropriete.tous_retire',
      'copropriete.rattachee',
      'attribution.ajoutee', 'attribution.retiree',
      'gestionnaire.cree', 'gestionnaire.modifie', 'gestionnaire.confirmation_envoyee', 'gestionnaire.adresse_confirmee',
      'gestionnaire.adresse_contestee', 'gestionnaire.domaine_force', 'gestionnaire.desactive', 'gestionnaire.reactive',
      'gestionnaire.pseudonymise', 'gestionnaire.exporte',
      'gestionnaire.acces_envoye', 'gestionnaire.acces_ouvert', 'gestionnaire.refus_autre_espace',
      'gestionnaire.connexion_bloquee', 'gestionnaire.effacement_demande',
      'signalement.statut', 'doublon.refuse', 'doublon.force', 'import.realise', 'journal.purge',
      'cabinet.diffusion_activee', 'cabinet.diffusion_suspendue',
      'diffusion.envoyee', 'diffusion.reprise', 'diffusion.opposition', 'diffusion.opposition_levee',
      'diffusion.purge')) NOT VALID;
  v_apres := ARRAY(SELECT m.v[1] FROM pg_constraint k
                     CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(k.oid), '''([^'']+)''', 'g') AS m(v)
                    WHERE k.conname = 'signalements_qr_journal_action_valeurs' AND k.conrelid = 'signalements_qr_journal'::regclass);
  SELECT a.v INTO v_perdue FROM unnest(v_avant) AS a(v) WHERE NOT (a.v = ANY (v_apres)) LIMIT 1;
  IF v_perdue IS NOT NULL THEN
    RAISE EXCEPTION 'journal_action_perdue' USING ERRCODE = '55000', DETAIL = v_perdue;
  END IF;
END $$;
ALTER TABLE signalements_qr_journal VALIDATE CONSTRAINT signalements_qr_journal_action_valeurs;

-- ── 15. Droits : EXECUTE réservé à service_role (signatures complètes) ──
REVOKE EXECUTE ON FUNCTION signalements_qr_empreinte_email(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_empreinte_email(text) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_raison_inactive(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_raison_inactive(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_controler_portee(text, text[], text[], uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_controler_portee(text, text[], text[], uuid, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_gestionnaire_autorise(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_gestionnaire_autorise(uuid, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_cible(uuid, text, text[], text[], uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_cible(uuid, text, text[], text[], uuid, timestamptz, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_valeurs(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_valeurs(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_apercu(uuid, text, text[], text[], uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_apercu(uuid, text, text[], text[], uuid, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusions_mois(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusions_mois(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_creer(uuid, uuid, uuid, text, uuid, text, date, text, text, text, text, text, text, text[], text[], uuid, text, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_creer(uuid, uuid, uuid, text, uuid, text, date, text, text, text, text, text, text, text[], text[], uuid, text, timestamptz, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_ecarter(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_ecarter(uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_lot(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_lot(uuid, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_resultats(uuid, integer, uuid[], uuid[], uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_resultats(uuid, integer, uuid[], uuid[], uuid[], text) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusions_a_reprendre(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusions_a_reprendre(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusions_liste(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusions_liste(uuid, timestamptz, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_lien(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_lien(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_opposer(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_opposer(uuid, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_lever(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_lever(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_opposer_signalement(uuid, uuid, uuid, text, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_opposer_signalement(uuid, uuid, uuid, text, uuid, date) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_annonce(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_annonce(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_annonce_faite(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_annonce_faite(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_annonce_envoyee(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_annonce_envoyee(uuid, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_diffusion_purger() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_diffusion_purger() TO service_role;

-- ── 16. RLS sans politique et retrait des droits par défaut de Supabase, sur les 3 tables nouvelles ──
ALTER TABLE signalements_qr_diffusions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_diffusion_destinataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_diffusion_oppositions   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signalements_qr_diffusions, signalements_qr_diffusion_destinataires, signalements_qr_diffusion_oppositions FROM anon, authenticated;
-- Séquence de l'identité des oppositions : Supabase y donne USAGE, SELECT et UPDATE à anon et authenticated.
REVOKE ALL ON SEQUENCE signalements_qr_diffusion_oppositions_id_seq FROM PUBLIC, anon, authenticated;

-- PostgREST relit le schéma : tables, colonnes et fonctions sont utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
