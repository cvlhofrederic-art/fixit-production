-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (10/11/2026) — cabinets clients, gestionnaires, attributions, journal, création unique et import.
--
-- Demandes de Hugo du 10/11/2026 : chaque cabinet client a sa ligne (le premier client n'est qu'un cabinet parmi
-- d'autres) : son nom, l'identifiant de son chemin public (vitfix.io/<identifiant>/signalement/<jeton>/), la langue de
-- ses pages et les domaines e-mail de ses gestionnaires. Chaque gestionnaire reçoit par e-mail les signalements des
-- copropriétés qui lui sont attribuées, une fois son adresse confirmée. Tout se saisit dans l'espace AJ Signalement par
-- le super admin : AUCUNE valeur ici (ni cabinet, ni domaine, ni gestionnaire, ni drapeau sur une copropriété), car le
-- dépôt est public et une migration rejouée écraserait un choix fait à l'écran.
--
-- Tables nouvelles (7) : signalements_qr_cabinets, signalements_qr_domaines_autorises, signalements_qr_gestionnaires,
-- signalements_qr_invitations, signalements_qr_attributions, signalements_qr_journal, signalements_qr_operations.
-- RLS activée sans politique, droits retirés à anon et authenticated : clé service seulement (routes
-- app/api/aj-signalement/*). 14 fonctions appelées par les routes (EXECUTE donné à service_role seul) et 2 fonctions de
-- trigger (gel de l'identifiant d'un cabinet, rattachement définitif d'une copropriété).
--
-- Règles :
--   - un gestionnaire et un domaine appartiennent toujours à un cabinet (cabinet_id NOT NULL) ; un domaine à un seul ;
--   - une copropriété sans cabinet (cabinet_id NULL : la copropriété de test et les copropriétés existantes) garde
--     l'adresse /fr/signalement/<jeton>/ et n'a aucun gestionnaire ; son rattachement à un cabinet est définitif ;
--   - l'identifiant d'un cabinet est figé dès qu'il a une copropriété ou un gestionnaire (QR codes imprimés, liens de
--     confirmation envoyés) ; il n'est jamais réattribué (UNIQUE, cabinet non supprimable tant qu'il est utilisé) ;
--   - toute comparaison « même cabinet » sur les copropriétés passe par coalesce(cabinet_id, UUID nul) : le groupe
--     « sans cabinet » est isolé comme un cabinet (doublons, verrous, budget d'e-mails).
-- Erreurs levées par les fonctions : P0001 (doublon, a_reverifier, sans_cabinet, identifiant_pris, identifiant_fige,
-- domaine_pris, cabinet_fige, hors_domaine : codes publics 409 des routes), 42501 (interdit), 22023 (paramètre
-- invalide) ; jamais renvoyées telles quelles au navigateur.
--
-- Additive et rejouable (modèle 20261106_signalements_qr_geoloc_qualite.sql) : CREATE TABLE / INDEX IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, contraintes nommées des tables existantes créées seulement si absentes de pg_constraint, en
-- NOT VALID puis VALIDATE, CREATE OR REPLACE FUNCTION et CREATE OR REPLACE TRIGGER (PostgreSQL 14+, sans DROP) ; aucune
-- écriture de données. Le fichier n'a jamais été appliqué avant cette version : aucun rattrapage de colonnes sur les
-- tables nouvelles. À appliquer par Frédéric (Supabase > SQL Editor) APRÈS les deux migrations du 06/11/2026, AVANT la
-- fusion de la PR. D'ici là, les routes se replient (42P01, 42703, PGRST204, PGRST202, PGRST200).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Cabinets clients ──
CREATE TABLE IF NOT EXISTS signalements_qr_cabinets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 200),
  -- Chemin public du cabinet : vitfix.io/<identifiant>/… (minuscules, chiffres, tirets simples, commence par une
  -- lettre). Les identifiants réservés (routes du site) sont refusés à la saisie, côté serveur.
  identifiant TEXT NOT NULL,
  langue      TEXT NOT NULL DEFAULT 'fr',
  cree_par    UUID,                                   -- super admin, sans clé étrangère (la trace survit au compte)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signalements_qr_cabinets_identifiant_unique UNIQUE (identifiant),
  CONSTRAINT signalements_qr_cabinets_identifiant_format
    CHECK (char_length(identifiant) BETWEEN 3 AND 40 AND identifiant ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  CONSTRAINT signalements_qr_cabinets_langue_valeurs CHECK (langue IN ('fr', 'pt'))
);
COMMENT ON TABLE signalements_qr_cabinets IS 'AJ Signalement : cabinets clients (nom, identifiant du chemin public, langue des pages), saisis par le super admin.';
COMMENT ON COLUMN signalements_qr_cabinets.identifiant IS 'Chemin public du cabinet : /<identifiant>/signalement/<jeton>/. Figé (trigger) dès que le cabinet a une copropriété ou un gestionnaire.';
COMMENT ON COLUMN signalements_qr_cabinets.langue IS 'Langue de la page publique de signalement du cabinet (fr ou pt).';

-- Domaines e-mail du cabinet : une fiche gestionnaire n'est créée que sur l'un d'eux (sauf forçage du super admin,
-- journalisé). Un domaine appartient à un seul cabinet.
CREATE TABLE IF NOT EXISTS signalements_qr_domaines_autorises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES signalements_qr_cabinets(id) ON DELETE CASCADE,
  domaine     TEXT NOT NULL,
  ajoute_par  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signalements_qr_domaines_domaine_unique UNIQUE (domaine),
  CONSTRAINT signalements_qr_domaines_domaine_format CHECK (
    domaine = lower(domaine) AND char_length(domaine) <= 253
    AND domaine ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_domaines_cabinet
  ON signalements_qr_domaines_autorises (cabinet_id);
COMMENT ON TABLE signalements_qr_domaines_autorises IS 'AJ Signalement : domaines e-mail des gestionnaires de chaque cabinet client (un domaine, un seul cabinet).';

-- ── 2. Gestionnaires ──
CREATE TABLE IF NOT EXISTS signalements_qr_gestionnaires (
  id                    UUID PRIMARY KEY,  -- PAS de DEFAULT : tiré par la route et signé dans le lien AVANT l'insertion
  cabinet_id            UUID NOT NULL REFERENCES signalements_qr_cabinets(id) ON DELETE RESTRICT,
  nom                   TEXT CHECK (nom IS NULL OR char_length(btrim(nom)) BETWEEN 1 AND 120),
  email                 TEXT CHECK (email IS NULL OR (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254)),
  actif                 BOOLEAN NOT NULL DEFAULT true,
  adresse_confirmee_le  TIMESTAMPTZ,      -- le titulaire de la boîte a confirmé : seuil des e-mails de signalement
  adresse_contestee_le  TIMESTAMPTZ,      -- « Ce n'est pas moi » : aucun e-mail, aucun nouvel envoi
  domaine_force         BOOLEAN NOT NULL DEFAULT false,   -- adresse hors des domaines du cabinet, forcée par le super admin
  cree_par              UUID NOT NULL,    -- compte super admin
  desactive_le          TIMESTAMPTZ,
  desactive_par         UUID,
  pseudonymise_le       TIMESTAMPTZ,      -- RGPD : nom et e-mail effacés, fiche gardée pour le journal
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signalements_qr_gestionnaires_identite
    CHECK (pseudonymise_le IS NOT NULL OR (nom IS NOT NULL AND email IS NOT NULL)),
  -- Une fiche pseudonymisée est toujours inactive (et ne peut plus être réactivée).
  CONSTRAINT signalements_qr_gestionnaires_pseudonymise_inactif
    CHECK (pseudonymise_le IS NULL OR NOT actif)
);
-- Un salarié = une fiche, même désactivée (on réactive, on ne recrée pas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_gestionnaires_email
  ON signalements_qr_gestionnaires (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signalements_qr_gestionnaires_cabinet
  ON signalements_qr_gestionnaires (cabinet_id, actif);
COMMENT ON TABLE signalements_qr_gestionnaires IS 'AJ Signalement : gestionnaires d''un cabinet client (fiches tenues par le super admin ; aucun compte en PR 1).';
COMMENT ON COLUMN signalements_qr_gestionnaires.adresse_confirmee_le IS 'Date à laquelle le gestionnaire a prouvé détenir la boîte (lien signé) ; NULL = aucun e-mail de signalement.';

-- Envois (une ligne par envoi, format lu par lib/equipe : la validité de 7 jours court depuis created_at).
CREATE TABLE IF NOT EXISTS signalements_qr_invitations (
  id               UUID PRIMARY KEY,               -- tiré et signé par nouvelleInvitation, AVANT l'insertion
  gestionnaire_id  UUID NOT NULL REFERENCES signalements_qr_gestionnaires(id) ON DELETE CASCADE,
  objet            TEXT NOT NULL CHECK (objet IN ('confirmation_adresse', 'acces')),
  email            TEXT NOT NULL CHECK (email = lower(btrim(email))),
  full_name        TEXT,
  role             TEXT NOT NULL DEFAULT 'gestionnaire_signalement' CHECK (role = 'gestionnaire_signalement'),
  invite_token     TEXT UNIQUE CHECK (invite_token IS NULL OR invite_token ~ '^[a-f0-9]{48}$'),
  invite_sent_at   TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  user_id          UUID,                           -- rempli à l'acceptation d'un accès (PR 2)
  refus            TEXT CHECK (refus IS NULL OR refus IN ('compte_autre_espace', 'pas_moi')),
  envoye_par       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_invitations_gestionnaire
  ON signalements_qr_invitations (gestionnaire_id, objet, created_at DESC);
COMMENT ON TABLE signalements_qr_invitations IS 'AJ Signalement : envois de confirmation d''adresse (et d''accès en PR 2) aux gestionnaires, une ligne par envoi.';

-- ── 3. Colonnes ajoutées aux tables existantes ──
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS cabinet_id UUID;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS code_postal TEXT NOT NULL DEFAULT '';
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS ville TEXT NOT NULL DEFAULT '';
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS immatriculation TEXT;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS reference_cabinet TEXT;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS batiments TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS attribuee_a_tous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS cle_nom TEXT;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS cree_par_gestionnaire_id UUID;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS operation_id UUID;

ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS statut_modifie_le TIMESTAMPTZ;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS statut_modifie_par UUID;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS statut_modifie_profil TEXT;
-- Budget d'e-mails : messages réservés pour ce dépôt, et dépôt retenu faute de budget (le dépôt reste enregistré).
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS nb_emails_envoyes SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS email_retenu BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_cabinet_fk'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_cabinet_fk
      FOREIGN KEY (cabinet_id) REFERENCES signalements_qr_cabinets(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_createur_fk'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_createur_fk
      FOREIGN KEY (cree_par_gestionnaire_id) REFERENCES signalements_qr_gestionnaires(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_tous_cabinet'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    -- « Attribuée à tous » vaut pour les gestionnaires d'UN cabinet : jamais sans cabinet.
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_tous_cabinet
      CHECK (NOT attribuee_a_tous OR cabinet_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_code_postal_format'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    -- France (5 chiffres) ; format portugais toléré ; vide permis (copropriétés existantes).
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_code_postal_format
      CHECK (code_postal ~ '^([0-9]{5}|[0-9]{4}-[0-9]{3})?$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_champs_longueurs'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_champs_longueurs
      CHECK (char_length(ville) <= 100
             AND (reference_cabinet IS NULL OR char_length(reference_cabinet) BETWEEN 1 AND 50)
             AND (cle_nom IS NULL OR char_length(cle_nom) <= 200)
             AND cardinality(batiments) <= 50) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_immatriculation_format'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    -- Volontairement souple tant que le format du registre n'est pas confirmé.
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_immatriculation_format
      CHECK (immatriculation IS NULL OR immatriculation ~ '^[A-Z0-9]{1,20}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_statut_modifie_profil_valeurs'
                 AND conrelid = 'signalements_qr'::regclass) THEN
    ALTER TABLE signalements_qr ADD CONSTRAINT signalements_qr_statut_modifie_profil_valeurs
      CHECK (statut_modifie_profil IS NULL OR statut_modifie_profil IN ('super_admin', 'gestionnaire')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_nb_emails_bornes'
                 AND conrelid = 'signalements_qr'::regclass) THEN
    ALTER TABLE signalements_qr ADD CONSTRAINT signalements_qr_nb_emails_bornes
      CHECK (nb_emails_envoyes BETWEEN 0 AND 100) NOT VALID;
  END IF;
END $$;

-- Les lignes existantes ont les nouvelles colonnes à NULL ou à leur valeur par défaut : la validation passe.
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_cabinet_fk;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_createur_fk;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_tous_cabinet;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_code_postal_format;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_champs_longueurs;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_immatriculation_format;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_statut_modifie_profil_valeurs;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_nb_emails_bornes;

COMMENT ON COLUMN signalements_qr_coproprietes.cabinet_id IS 'Cabinet client ; NULL = sans cabinet (adresse /fr/signalement/<jeton>/, aucun gestionnaire). Rattachement définitif (trigger).';
COMMENT ON COLUMN signalements_qr_coproprietes.attribuee_a_tous IS 'Copropriété vue par tous les gestionnaires actifs de son cabinet (copropriété de test) ; posé à l''écran par le super admin seulement.';
COMMENT ON COLUMN signalements_qr_coproprietes.cle_nom IS 'Nom normalisé (calculé côté serveur, lib/aj-signalement/doublons.ts) pour le contrôle des doublons ; NULL pour les lignes antérieures.';
COMMENT ON COLUMN signalements_qr.nb_emails_envoyes IS 'Messages réservés pour ce dépôt dans le budget d''e-mails (par copropriété et par cabinet, sur une heure).';
COMMENT ON COLUMN signalements_qr.email_retenu IS 'Dépôt enregistré mais e-mail non envoyé : budget d''e-mails atteint.';

-- Doublons garantis par la base, par cabinet (sans cabinet = UUID nul : coalesce est immuable).
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_copros_immatriculation
  ON signalements_qr_coproprietes ((coalesce(cabinet_id, '00000000-0000-0000-0000-000000000000'::uuid)), immatriculation)
  WHERE immatriculation IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_copros_reference
  ON signalements_qr_coproprietes ((coalesce(cabinet_id, '00000000-0000-0000-0000-000000000000'::uuid)), reference_cabinet)
  WHERE reference_cabinet IS NOT NULL;
-- Nom + code postal : PAS d'unicité en base (homonymes légitimes, forçage du super admin) ; course fermée par le verrou
-- de la fonction de création.
CREATE INDEX IF NOT EXISTS idx_signalements_qr_copros_cle_nom
  ON signalements_qr_coproprietes ((coalesce(cabinet_id, '00000000-0000-0000-0000-000000000000'::uuid)), cle_nom, code_postal)
  WHERE cle_nom IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signalements_qr_copros_cabinet
  ON signalements_qr_coproprietes (cabinet_id);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_statut_ouverts
  ON signalements_qr (copropriete_id, statut, created_at DESC);

-- ── 4. Attributions copropriété ↔ gestionnaire (plusieurs-à-plusieurs) ──
CREATE TABLE IF NOT EXISTS signalements_qr_attributions (
  copropriete_id   UUID NOT NULL REFERENCES signalements_qr_coproprietes(id) ON DELETE CASCADE,
  gestionnaire_id  UUID NOT NULL REFERENCES signalements_qr_gestionnaires(id) ON DELETE CASCADE,
  origine          TEXT NOT NULL CHECK (origine IN ('super_admin', 'creation', 'import', 'reattribution')),
  attribue_par     UUID NOT NULL,     -- compte auteur (super admin ; le gestionnaire lui-même à la création, PR 2)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (copropriete_id, gestionnaire_id)
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_attributions_gestionnaire
  ON signalements_qr_attributions (gestionnaire_id);
COMMENT ON TABLE signalements_qr_attributions IS 'AJ Signalement : copropriétés attribuées à chaque gestionnaire (même cabinet, contrôlé par les fonctions).';

-- ── 5. Journal et opérations ──
CREATE TABLE IF NOT EXISTS signalements_qr_journal (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cabinet_id              UUID,
  acteur_id               UUID,                       -- compte auteur, sans FK ; NULL = système ou titulaire d'une boîte
  acteur_profil           TEXT NOT NULL,
  acteur_gestionnaire_id  UUID,
  action                  TEXT NOT NULL,
  copropriete_id          UUID,                       -- sans FK : la trace survit à la suppression
  gestionnaire_id         UUID,
  signalement_id          UUID,
  operation_id            UUID,
  champs                  TEXT[] NOT NULL DEFAULT '{}',          -- NOMS des champs modifiés, jamais les valeurs
  details                 JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(details) <= 2048),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signalements_qr_journal_acteur_profil_valeurs CHECK (acteur_profil IN ('super_admin', 'gestionnaire', 'systeme')),
  -- Liste fermée posée une seule fois : actions de la PR 1, et celles de la PR 2 (accès des gestionnaires).
  CONSTRAINT signalements_qr_journal_action_valeurs CHECK (action IN (
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
    'signalement.statut', 'doublon.refuse', 'doublon.force', 'import.realise', 'journal.purge'))
);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_journal_date   ON signalements_qr_journal (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_journal_cabinet ON signalements_qr_journal (cabinet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_journal_copro  ON signalements_qr_journal (copropriete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_journal_gest   ON signalements_qr_journal (gestionnaire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_qr_journal_acteur ON signalements_qr_journal (acteur_gestionnaire_id, created_at DESC);
COMMENT ON TABLE signalements_qr_journal IS 'AJ Signalement : traçabilité (qui a créé ou changé quoi), sans donnée personnelle ; 12 mois glissants.';
COMMENT ON COLUMN signalements_qr_journal.details IS 'Énumérations, identifiants et nombres seulement (exception : nom d''une copropriété supprimée).';

-- Un lot de création (saisie = lot d'une ligne, ou import) = un identifiant tiré par le navigateur : rejeu sans effet,
-- seulement pour le même auteur, le même cabinet et le même lot (empreinte des lignes reçues).
CREATE TABLE IF NOT EXISTS signalements_qr_operations (
  id             UUID PRIMARY KEY,
  cabinet_id     UUID,
  acteur_id      UUID NOT NULL,
  acteur_profil  TEXT NOT NULL CHECK (acteur_profil IN ('super_admin', 'gestionnaire')),
  type           TEXT NOT NULL CHECK (type IN ('creation', 'import')),
  empreinte_lignes TEXT NOT NULL,                     -- sha256 (hex) du lot reçu : aucun contenu de fichier en clair
  resultat       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- identifiants et jetons créés ; aucun contenu de fichier
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE signalements_qr_operations IS 'AJ Signalement : lots de création de copropriétés (saisie ou import), pour rejouer un double clic sans effet.';

-- ── 6. Fonctions de trigger : identifiant figé, rattachement définitif ──
CREATE OR REPLACE FUNCTION signalements_qr_identifiant_fige() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
BEGIN
  -- Une copropriété porte l'identifiant dans son QR code, un gestionnaire dans son lien de confirmation.
  IF NEW.identifiant IS DISTINCT FROM OLD.identifiant
     AND (EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.cabinet_id = OLD.id)
          OR EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.cabinet_id = OLD.id)) THEN
    RAISE EXCEPTION 'identifiant_fige' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION signalements_qr_cabinet_copro_fige() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
BEGIN
  -- Changer de cabinet changerait l'adresse du QR code : les affiches imprimées ne répondraient plus.
  IF OLD.cabinet_id IS NOT NULL AND NEW.cabinet_id IS DISTINCT FROM OLD.cabinet_id THEN
    RAISE EXCEPTION 'cabinet_fige' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

-- ── 7. Fonctions appelées par les routes (clé service) ──

-- Création unique des copropriétés (saisie du super admin = lot d'une ligne, import, saisie d'un gestionnaire en PR 2).
-- p_lignes : [{ numeroLigne, action: 'creer' | 'completer', origine?: 'import', coproprieteId?, nom, cleNom, adresse, codePostal, ville,
-- immatriculation?, referenceCabinet?, batiments[], emails[], gestionnaireIds[], forcerDoublon }] ; « compléter » porte
-- cleNomExistante (clé du nom de la fiche existante, calculée par la route) au lieu de cleNom.
-- p_cabinet NULL = copropriétés sans cabinet (super admin seulement, aucun gestionnaire possible).
-- Rendu : créées { numeroLigne, id, jeton, nom, adresse, codePostal, ville } relues en base, complétées { numeroLigne, id }.
CREATE OR REPLACE FUNCTION signalements_qr_creer_coproprietes(
  p_operation uuid, p_acteur uuid, p_profil text, p_gestionnaire uuid, p_cabinet uuid, p_lignes jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_zero    CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  v_cab     uuid := coalesce(p_cabinet, v_zero);
  v_nb      int;
  v_type    text;
  v_deja    jsonb;
  v_auteur  uuid;
  v_cab_op  uuid;
  v_empreinte     text;
  v_empreinte_op  text;
  v_l       jsonb;
  v_num     text;
  v_id      uuid;
  v_jeton   text;
  v_g       uuid;
  v_creees  jsonb := '[]'::jsonb;
  v_compl   jsonb := '[]'::jsonb;
  v_rendu   jsonb;
BEGIN
  IF p_operation IS NULL OR p_acteur IS NULL OR p_profil IS NULL OR p_profil NOT IN ('super_admin', 'gestionnaire')
     OR p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  -- Empreinte du lot : le texte d'un jsonb est canonique (clés triées, sans doublon), le même lot donne la même empreinte.
  v_empreinte := encode(sha256(convert_to(p_lignes::text, 'UTF8')), 'hex');
  v_nb := jsonb_array_length(p_lignes);
  IF v_nb NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  -- Un fichier d'import d'UNE ligne reste un import (journal import.realise, attributions d'origine « import ») : la
  -- route d'import marque ses lignes origine = 'import' ; la saisie (lot d'une ligne) ne le fait pas.
  v_type := CASE WHEN v_nb = 1 AND coalesce(p_lignes->0->>'origine', '') <> 'import' THEN 'creation' ELSE 'import' END;

  IF p_profil = 'gestionnaire' THEN
    -- PR 2 : un gestionnaire crée une copropriété à la fois, dans le cabinet de SA fiche active (jamais un import).
    IF p_gestionnaire IS NULL OR p_cabinet IS NULL OR v_nb <> 1 OR v_type <> 'creation' THEN
      RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                    WHERE g.id = p_gestionnaire AND g.actif AND g.cabinet_id = p_cabinet) THEN
      RAISE EXCEPTION 'interdit' USING ERRCODE = '42501';
    END IF;
  ELSIF p_gestionnaire IS NOT NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  IF p_cabinet IS NOT NULL AND NOT EXISTS (SELECT 1 FROM signalements_qr_cabinets k WHERE k.id = p_cabinet) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  -- Toutes les créations d'un cabinet sont sérialisées : la course nom + code postal est fermée sans index unique.
  PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_creation:' || v_cab::text, 0));

  SELECT o.resultat, o.acteur_id, o.cabinet_id, o.empreinte_lignes INTO v_deja, v_auteur, v_cab_op, v_empreinte_op
    FROM signalements_qr_operations o WHERE o.id = p_operation;
  IF FOUND THEN
    -- Double clic, nouvel essai réseau : le résultat du premier appel, seulement à son auteur, pour le MÊME cabinet et
    -- le MÊME lot. Un autre lot sous le même identifiant (autre feuille, autre cabinet) n'est pas un rejeu : rien n'est
    -- rendu ni créé, l'écran revérifie (sinon ses affiches porteraient les jetons d'autres copropriétés).
    IF v_auteur IS DISTINCT FROM p_acteur OR v_cab_op IS DISTINCT FROM p_cabinet OR v_empreinte_op IS DISTINCT FROM v_empreinte THEN
      RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
    END IF;
    -- Noms, adresses et jetons d'aujourd'hui (un QR code remplacé depuis rend son nouveau jeton), relus en base.
    SELECT coalesce(jsonb_agg(jsonb_build_object('numeroLigne', (e.val->>'numeroLigne')::int, 'id', c.id,
             'jeton', c.jeton, 'nom', c.nom, 'adresse', c.adresse, 'codePostal', c.code_postal, 'ville', c.ville)
             ORDER BY (e.val->>'numeroLigne')::int), '[]'::jsonb)
      INTO v_rendu
      FROM jsonb_array_elements(coalesce(v_deja->'creees', '[]'::jsonb)) AS e(val)
      JOIN signalements_qr_coproprietes c ON c.id = (e.val->>'id')::uuid;
    RETURN jsonb_build_object('creees', v_rendu, 'completees', coalesce(v_deja->'completees', '[]'::jsonb), 'rejeu', true);
  END IF;

  FOR v_l IN SELECT e.val FROM jsonb_array_elements(p_lignes) AS e(val) LOOP
    v_num := coalesce(v_l->>'numeroLigne', '');
    IF jsonb_typeof(v_l) <> 'object' OR coalesce(v_l->>'action', '') NOT IN ('creer', 'completer') THEN
      RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023', DETAIL = v_num;
    END IF;

    IF v_l->>'action' = 'completer' THEN
      IF p_profil <> 'super_admin' THEN
        RAISE EXCEPTION 'interdit' USING ERRCODE = '42501';
      END IF;
      UPDATE signalements_qr_coproprietes c SET          -- ne remplit QUE les champs vides
        adresse           = CASE WHEN c.adresse = '' THEN coalesce(v_l->>'adresse', '') ELSE c.adresse END,
        code_postal       = CASE WHEN c.code_postal = '' THEN coalesce(v_l->>'codePostal', '') ELSE c.code_postal END,
        ville             = CASE WHEN c.ville = '' THEN coalesce(v_l->>'ville', '') ELSE c.ville END,
        immatriculation   = coalesce(c.immatriculation, nullif(v_l->>'immatriculation', '')),
        reference_cabinet = coalesce(c.reference_cabinet, nullif(v_l->>'referenceCabinet', '')),
        batiments         = CASE WHEN cardinality(c.batiments) = 0
                              THEN ARRAY(SELECT b.val FROM jsonb_array_elements_text(coalesce(v_l->'batiments', '[]'::jsonb)) AS b(val))
                              ELSE c.batiments END,
        -- Clé du nom EXISTANT (le nom n'est pas changé) : celle de la ligne fausserait le contrôle nom + code postal.
        cle_nom           = coalesce(c.cle_nom, nullif(v_l->>'cleNomExistante', ''))
      WHERE c.id = (v_l->>'coproprieteId')::uuid AND coalesce(c.cabinet_id, v_zero) = v_cab;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001', DETAIL = v_num;
      END IF;
      v_id := (v_l->>'coproprieteId')::uuid;
      v_compl := v_compl || jsonb_build_object('numeroLigne', (v_l->>'numeroLigne')::int, 'id', v_id);
    ELSE
      IF NOT (p_profil = 'super_admin' AND coalesce((v_l->>'forcerDoublon')::boolean, false))
         AND coalesce(v_l->>'codePostal', '') <> ''
         AND EXISTS (SELECT 1 FROM signalements_qr_coproprietes c
                      WHERE coalesce(c.cabinet_id, v_zero) = v_cab
                        AND c.cle_nom = v_l->>'cleNom' AND c.code_postal = v_l->>'codePostal') THEN
        RAISE EXCEPTION 'doublon' USING ERRCODE = 'P0001', DETAIL = v_num;
      END IF;
      v_jeton := replace(gen_random_uuid()::text, '-', '');   -- même entropie que genererJetonQr et le seed
      INSERT INTO signalements_qr_coproprietes (
        nom, adresse, code_postal, ville, immatriculation, reference_cabinet, batiments, emails_destinataires,
        jeton, cabinet_id, cle_nom, cree_par, cree_par_gestionnaire_id, operation_id)
      VALUES (
        v_l->>'nom', coalesce(v_l->>'adresse', ''), coalesce(v_l->>'codePostal', ''), coalesce(v_l->>'ville', ''),
        nullif(v_l->>'immatriculation', ''), nullif(v_l->>'referenceCabinet', ''),
        ARRAY(SELECT b.val FROM jsonb_array_elements_text(coalesce(v_l->'batiments', '[]'::jsonb)) AS b(val)),
        -- Une adresse de gestionnaire n'est jamais une adresse saisie (filet sous le contrôle de la route).
        ARRAY(SELECT lower(btrim(m.val)) FROM jsonb_array_elements_text(coalesce(v_l->'emails', '[]'::jsonb)) AS m(val)
               WHERE lower(btrim(m.val)) NOT IN (SELECT g.email FROM signalements_qr_gestionnaires g
                                                  WHERE g.email IS NOT NULL)),
        v_jeton, p_cabinet, v_l->>'cleNom', p_acteur, p_gestionnaire, p_operation)
      RETURNING id INTO v_id;                     -- 23505 (immatriculation, référence) : toute la transaction est annulée
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action,
                                           copropriete_id, operation_id, details)
      VALUES (p_cabinet, p_acteur, p_profil, p_gestionnaire, 'copropriete.creee', v_id, p_operation,
              jsonb_build_object('origine', CASE WHEN p_profil = 'gestionnaire' THEN 'gestionnaire'
                                                 WHEN v_type = 'creation' THEN 'saisie' ELSE 'import' END));
      IF p_profil = 'super_admin' AND coalesce((v_l->>'forcerDoublon')::boolean, false) THEN
        INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, operation_id, details)
        VALUES (p_cabinet, p_acteur, 'super_admin', 'doublon.force', v_id, p_operation, '{"critere": "nom_code_postal"}'::jsonb);
      END IF;
      v_creees := v_creees || jsonb_build_object('numeroLigne', (v_l->>'numeroLigne')::int, 'id', v_id, 'jeton', v_jeton);
    END IF;

    -- Attributions : le gestionnaire auteur, d'office ; sinon celles de la ligne (fiches actives du MÊME cabinet :
    -- aucune pour une copropriété sans cabinet).
    IF p_profil = 'gestionnaire' THEN
      INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
      VALUES (v_id, p_gestionnaire, 'creation', p_acteur)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action,
                                             copropriete_id, gestionnaire_id, operation_id, details)
        VALUES (p_cabinet, p_acteur, 'gestionnaire', p_gestionnaire, 'attribution.ajoutee', v_id, p_gestionnaire,
                p_operation, '{"origine": "creation"}'::jsonb);
      END IF;
    ELSE
      FOR v_g IN SELECT DISTINCT x.val::uuid FROM jsonb_array_elements_text(coalesce(v_l->'gestionnaireIds', '[]'::jsonb)) AS x(val) LOOP
        IF NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                        WHERE g.id = v_g AND g.actif AND g.cabinet_id = p_cabinet) THEN
          RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001', DETAIL = v_num;
        END IF;
        INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
        VALUES (v_id, v_g, CASE WHEN v_type = 'creation' THEN 'super_admin' ELSE 'import' END, p_acteur)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id,
                                               gestionnaire_id, operation_id, details)
          VALUES (p_cabinet, p_acteur, 'super_admin', 'attribution.ajoutee', v_id, v_g, p_operation,
                  jsonb_build_object('origine', CASE WHEN v_type = 'creation' THEN 'super_admin' ELSE 'import' END));
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  INSERT INTO signalements_qr_operations (id, cabinet_id, acteur_id, acteur_profil, type, empreinte_lignes, resultat)
  VALUES (p_operation, p_cabinet, p_acteur, p_profil, v_type, v_empreinte, jsonb_build_object('creees', v_creees, 'completees', v_compl));
  IF v_type = 'import' THEN
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, operation_id, details)
    VALUES (p_cabinet, p_acteur, p_profil, 'import.realise', p_operation,
            jsonb_build_object('creees', jsonb_array_length(v_creees), 'completees', jsonb_array_length(v_compl)));
  END IF;
  -- Même rendu qu'au rejeu : ce que la base a enregistré (les affiches et l'export n'utilisent jamais les saisies).
  SELECT coalesce(jsonb_agg(jsonb_build_object('numeroLigne', (e.val->>'numeroLigne')::int, 'id', c.id,
           'jeton', c.jeton, 'nom', c.nom, 'adresse', c.adresse, 'codePostal', c.code_postal, 'ville', c.ville)
           ORDER BY (e.val->>'numeroLigne')::int), '[]'::jsonb)
    INTO v_rendu
    FROM jsonb_array_elements(v_creees) AS e(val)
    JOIN signalements_qr_coproprietes c ON c.id = (e.val->>'id')::uuid;
  RETURN jsonb_build_object('creees', v_rendu, 'completees', v_compl, 'rejeu', false);
END $fn$;

-- Compteurs par copropriété, calculés en base (une réponse PostgREST est bornée à 1 000 lignes).
CREATE OR REPLACE FUNCTION signalements_qr_compteurs(p_ids uuid[])
RETURNS TABLE(copropriete_id uuid, total bigint, en_attente bigint, ouverts bigint, urgents_ouverts bigint, attente_48h bigint, dernier timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT s.copropriete_id,
         count(*),
         count(*) FILTER (WHERE s.statut = 'en_attente'),
         count(*) FILTER (WHERE s.statut IN ('en_attente', 'acceptee', 'en_cours')),
         count(*) FILTER (WHERE s.statut IN ('en_attente', 'acceptee', 'en_cours') AND s.priorite = 'urgente'),
         count(*) FILTER (WHERE s.statut = 'en_attente' AND s.created_at < now() - interval '48 hours'),
         max(s.created_at)
    FROM signalements_qr s
   WHERE s.copropriete_id = ANY (p_ids)
   GROUP BY s.copropriete_id
$fn$;

-- Gestionnaires d'une copropriété (fiche de la copropriété) : ensemble complet, « à tous » si p_tous n'est pas NULL.
CREATE OR REPLACE FUNCTION signalements_qr_remplacer_attributions(
  p_copropriete uuid, p_gestionnaires uuid[], p_tous boolean, p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab         uuid;
  v_tous_avant  boolean;
  v_tous_apres  boolean;
  v_nouveaux    uuid[] := ARRAY(SELECT DISTINCT t.x FROM unnest(coalesce(p_gestionnaires, '{}'::uuid[])) AS t(x) WHERE t.x IS NOT NULL);
  v_avant       uuid[];
  v_perdus      uuid[];
  v_email       text;
  v_retirees    int := 0;
BEGIN
  IF p_copropriete IS NULL OR p_acteur IS NULL OR cardinality(v_nouveaux) > 100 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT c.cabinet_id, c.attribuee_a_tous INTO v_cab, v_tous_avant
    FROM signalements_qr_coproprietes c WHERE c.id = p_copropriete FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'sans_cabinet' USING ERRCODE = 'P0001';
  END IF;
  v_tous_apres := coalesce(p_tous, v_tous_avant);
  IF EXISTS (SELECT 1 FROM unnest(v_nouveaux) AS t(x)
              WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                                 WHERE g.id = t.x AND g.actif AND g.cabinet_id = v_cab)) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  v_avant := ARRAY(SELECT a.gestionnaire_id FROM signalements_qr_attributions a WHERE a.copropriete_id = p_copropriete);

  -- Insertion AVANT suppression : la copropriété n'est jamais un instant sans gestionnaire.
  WITH ajoutees AS (
    INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
    SELECT p_copropriete, t.x, 'super_admin', p_acteur FROM unnest(v_nouveaux) AS t(x)
    ON CONFLICT DO NOTHING
    RETURNING gestionnaire_id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', p_copropriete, a.gestionnaire_id, '{"origine": "super_admin"}'::jsonb
    FROM ajoutees a;

  IF v_tous_apres IS DISTINCT FROM v_tous_avant THEN
    UPDATE signalements_qr_coproprietes SET attribuee_a_tous = v_tous_apres WHERE id = p_copropriete;
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id)
    VALUES (v_cab, p_acteur, 'super_admin',
            CASE WHEN v_tous_apres THEN 'copropriete.tous_active' ELSE 'copropriete.tous_retire' END, p_copropriete);
  END IF;

  WITH retirees AS (
    DELETE FROM signalements_qr_attributions a
     WHERE a.copropriete_id = p_copropriete AND NOT (a.gestionnaire_id = ANY (v_nouveaux))
    RETURNING a.gestionnaire_id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.retiree', p_copropriete, r.gestionnaire_id FROM retirees r;

  -- Une fiche qui perd la copropriété (attribution retirée, ou « à tous » retiré sans attribution) n'y reste pas comme
  -- adresse saisie : sinon elle recevrait encore ses signalements.
  v_perdus := ARRAY(
    SELECT g.id FROM signalements_qr_gestionnaires g
     WHERE g.cabinet_id = v_cab
       AND (v_tous_avant OR g.id = ANY (v_avant))
       AND NOT (v_tous_apres OR g.id = ANY (v_nouveaux)));
  FOR v_email IN SELECT g.email FROM signalements_qr_gestionnaires g WHERE g.id = ANY (v_perdus) AND g.email IS NOT NULL LOOP
    UPDATE signalements_qr_coproprietes
       SET emails_destinataires = array_remove(emails_destinataires, v_email)
     WHERE id = p_copropriete AND v_email = ANY (emails_destinataires);
    IF FOUND THEN
      v_retirees := v_retirees + 1;
    END IF;
  END LOOP;
  IF v_retirees > 0 THEN
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, champs, details)
    VALUES (v_cab, p_acteur, 'super_admin', 'copropriete.modifiee', p_copropriete, ARRAY['emails_destinataires'],
            jsonb_build_object('motif', CASE WHEN v_tous_avant AND NOT v_tous_apres THEN 'tous_retire' ELSE 'retrait' END,
                               'adresses', v_retirees));
  END IF;
  RETURN jsonb_build_object('gestionnaires', to_jsonb(v_nouveaux), 'attribueeATous', v_tous_apres, 'adressesRetirees', v_retirees);
END $fn$;

-- Copropriétés d'un gestionnaire (page profil) : ensemble complet de ses attributions explicites.
CREATE OR REPLACE FUNCTION signalements_qr_attribuer_au_gestionnaire(
  p_gestionnaire uuid, p_coproprietes uuid[], p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab       uuid;
  v_actif     boolean;
  v_email     text;
  v_cibles    uuid[] := ARRAY(SELECT DISTINCT t.x FROM unnest(coalesce(p_coproprietes, '{}'::uuid[])) AS t(x) WHERE t.x IS NOT NULL);
  v_perdues   uuid[];
  v_c         uuid;
  v_retirees  int := 0;
BEGIN
  IF p_gestionnaire IS NULL OR p_acteur IS NULL OR cardinality(v_cibles) > 1000 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT g.cabinet_id, g.actif, g.email INTO v_cab, v_actif, v_email
    FROM signalements_qr_gestionnaires g WHERE g.id = p_gestionnaire FOR UPDATE;
  IF NOT FOUND OR (NOT v_actif AND cardinality(v_cibles) > 0) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Copropriétés du MÊME cabinet seulement (une copropriété sans cabinet n'a pas de gestionnaire).
  IF EXISTS (SELECT 1 FROM unnest(v_cibles) AS t(x)
              WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.id = t.x AND c.cabinet_id = v_cab)) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  WITH ajoutees AS (
    INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
    SELECT t.x, p_gestionnaire, 'super_admin', p_acteur FROM unnest(v_cibles) AS t(x)
    ON CONFLICT DO NOTHING
    RETURNING copropriete_id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', a.copropriete_id, p_gestionnaire, '{"origine": "super_admin"}'::jsonb
    FROM ajoutees a;

  v_perdues := ARRAY(SELECT a.copropriete_id FROM signalements_qr_attributions a
                      WHERE a.gestionnaire_id = p_gestionnaire AND NOT (a.copropriete_id = ANY (v_cibles)));
  DELETE FROM signalements_qr_attributions a
   WHERE a.gestionnaire_id = p_gestionnaire AND a.copropriete_id = ANY (v_perdues);
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.retiree', t.x, p_gestionnaire FROM unnest(v_perdues) AS t(x);

  -- Son adresse quitte les adresses saisies des copropriétés qu'il perd (sauf « à tous » : il les voit encore).
  IF v_email IS NOT NULL AND cardinality(v_perdues) > 0 THEN
    FOR v_c IN
      UPDATE signalements_qr_coproprietes
         SET emails_destinataires = array_remove(emails_destinataires, v_email)
       WHERE id = ANY (v_perdues) AND NOT attribuee_a_tous AND v_email = ANY (emails_destinataires)
      RETURNING id
    LOOP
      v_retirees := v_retirees + 1;
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id,
                                           champs, details)
      VALUES (v_cab, p_acteur, 'super_admin', 'copropriete.modifiee', v_c, p_gestionnaire, ARRAY['emails_destinataires'],
              '{"motif": "retrait"}'::jsonb);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('coproprietes', to_jsonb(v_cibles), 'adressesRetirees', v_retirees);
END $fn$;

-- Départ d'un gestionnaire : une succession (un successeur actif du même cabinet, ou NULL) pour CHACUNE de ses
-- attributions. p_successions = [{ coproprieteId, versGestionnaireId | null }].
CREATE OR REPLACE FUNCTION signalements_qr_desactiver_gestionnaire(
  p_id uuid, p_successions jsonb, p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab        uuid;
  v_actif      boolean;
  v_email      text;
  v_succ       jsonb := coalesce(p_successions, '[]'::jsonb);
  v_attr       uuid[];
  v_s          jsonb;
  v_copro      uuid;
  v_vers       uuid;
  v_deplacees  int := 0;
  v_sans       int := 0;
  v_retirees   int := 0;
  v_c          uuid;
  v_ccab       uuid;
BEGIN
  IF p_id IS NULL OR p_acteur IS NULL OR jsonb_typeof(v_succ) <> 'array' THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT g.cabinet_id, g.actif, g.email INTO v_cab, v_actif, v_email
    FROM signalements_qr_gestionnaires g WHERE g.id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT v_actif THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  v_attr := ARRAY(SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id);
  -- Une entrée, et une seule, pour chacune de ses attributions ; aucune autre.
  IF jsonb_array_length(v_succ) <> cardinality(v_attr)
     OR (SELECT count(DISTINCT e.val->>'coproprieteId') FROM jsonb_array_elements(v_succ) AS e(val)) <> cardinality(v_attr)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_succ) AS e(val)
                 WHERE e.val->>'coproprieteId' IS NULL OR NOT ((e.val->>'coproprieteId')::uuid = ANY (v_attr))) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  FOR v_s IN SELECT e.val FROM jsonb_array_elements(v_succ) AS e(val) LOOP
    v_copro := (v_s->>'coproprieteId')::uuid;
    v_vers := nullif(v_s->>'versGestionnaireId', '')::uuid;
    IF v_vers IS NULL THEN
      v_sans := v_sans + 1;
    ELSE
      IF v_vers = p_id OR NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                                       WHERE g.id = v_vers AND g.actif AND g.cabinet_id = v_cab) THEN
        RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
      VALUES (v_copro, v_vers, 'reattribution', p_acteur)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
        VALUES (v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', v_copro, v_vers, '{"origine": "reattribution"}'::jsonb);
      END IF;
      v_deplacees := v_deplacees + 1;
    END IF;
  END LOOP;

  -- Successeurs posés d'abord, puis retrait : la copropriété n'est jamais un instant sans son successeur.
  DELETE FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.retiree', t.x, p_id, '{"motif": "depart"}'::jsonb FROM unnest(v_attr) AS t(x);

  UPDATE signalements_qr_gestionnaires SET actif = false, desactive_le = now(), desactive_par = p_acteur WHERE id = p_id;
  -- Les liens envoyés et pas encore ouverts ne valent plus rien.
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = p_id AND accepted_at IS NULL AND invite_token IS NOT NULL;

  -- Son adresse quitte les adresses saisies de TOUTES les copropriétés qui la contiennent (quel que soit leur cabinet).
  IF v_email IS NOT NULL THEN
    FOR v_c, v_ccab IN
      UPDATE signalements_qr_coproprietes
         SET emails_destinataires = array_remove(emails_destinataires, v_email)
       WHERE v_email = ANY(emails_destinataires)
      RETURNING id, cabinet_id
    LOOP
      v_retirees := v_retirees + 1;
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id,
                                           champs, details)
      VALUES (v_ccab, p_acteur, 'super_admin', 'copropriete.modifiee', v_c, p_id, ARRAY['emails_destinataires'],
              '{"motif": "depart"}'::jsonb);
    END LOOP;
  END IF;

  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id, details)
  VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.desactive', p_id,
          jsonb_build_object('deplacees', v_deplacees, 'sansGestionnaire', v_sans, 'adressesRetirees', v_retirees));
  RETURN jsonb_build_object('deplacees', v_deplacees, 'laisseesSansGestionnaire', v_sans, 'adressesRetirees', v_retirees);
END $fn$;

-- Retour d'un ancien gestionnaire : même fiche (jamais une fiche pseudonymisée) ; ses attributions sont à refaire.
CREATE OR REPLACE FUNCTION signalements_qr_reactiver_gestionnaire(p_id uuid, p_acteur uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab uuid;
BEGIN
  IF p_id IS NULL OR p_acteur IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE signalements_qr_gestionnaires SET actif = true, desactive_le = NULL, desactive_par = NULL
   WHERE id = p_id AND NOT actif AND pseudonymise_le IS NULL
  RETURNING cabinet_id INTO v_cab;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id)
  VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.reactive', p_id);
  RETURN true;
END $fn$;

-- Création d'une fiche et de son premier envoi de confirmation d'adresse.
-- p_gestionnaire = { id, cabinetId, nom, email, domaineForce } ; p_invitation = { id, invite_token, email }.
-- L'id de la fiche et celui de l'envoi sont signés dans le lien (lib/equipe, nouvelleInvitation) AVANT cet appel :
-- ils sont insérés tels quels, jamais tirés ici, et l'adresse n'est pas transformée (la signature ne vaudrait plus).
CREATE OR REPLACE FUNCTION signalements_qr_inviter_gestionnaire(
  p_gestionnaire jsonb, p_invitation jsonb, p_coproprietes uuid[], p_acteur uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_id      uuid := nullif(p_gestionnaire->>'id', '')::uuid;
  v_cab     uuid := nullif(p_gestionnaire->>'cabinetId', '')::uuid;
  v_nom     text := btrim(p_gestionnaire->>'nom');
  v_email   text := p_gestionnaire->>'email';
  v_force   boolean := coalesce((p_gestionnaire->>'domaineForce')::boolean, false);
  v_inv     uuid := nullif(p_invitation->>'id', '')::uuid;
  v_copros  uuid[] := ARRAY(SELECT DISTINCT t.x FROM unnest(coalesce(p_coproprietes, '{}'::uuid[])) AS t(x) WHERE t.x IS NOT NULL);
BEGIN
  IF v_id IS NULL OR v_inv IS NULL OR p_acteur IS NULL OR v_email IS NULL OR v_nom IS NULL
     OR p_invitation->>'invite_token' IS NULL OR cardinality(v_copros) > 500 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  -- L'adresse signée est celle de la fiche, à l'identique ; le cabinet existe.
  IF p_invitation->>'email' IS DISTINCT FROM v_email OR v_cab IS NULL
     OR NOT EXISTS (SELECT 1 FROM signalements_qr_cabinets k WHERE k.id = v_cab) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Domaine déclaré par un AUTRE cabinet client : refusé, forçage compris (son titulaire est salarié d'un autre client).
  IF EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d
              WHERE d.cabinet_id <> v_cab AND d.domaine = split_part(v_email, '@', 2)) THEN
    RAISE EXCEPTION 'domaine_autre_cabinet' USING ERRCODE = 'P0001';
  END IF;
  -- Une fiche n'est créée que dans les domaines de SON cabinet, sauf forçage du super admin (journalisé).
  IF NOT v_force AND NOT EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d
                                  WHERE d.cabinet_id = v_cab AND d.domaine = split_part(v_email, '@', 2)) THEN
    RAISE EXCEPTION 'hors_domaine' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_copros) AS t(x)
              WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.id = t.x AND c.cabinet_id = v_cab)) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, domaine_force, cree_par)
  VALUES (v_id, v_cab, v_nom, v_email, v_force, p_acteur);      -- 23505 : adresse déjà en table (existe_deja)
  INSERT INTO signalements_qr_invitations (id, gestionnaire_id, objet, email, full_name, invite_token, envoye_par)
  VALUES (v_inv, v_id, 'confirmation_adresse', v_email, v_nom, p_invitation->>'invite_token', p_acteur);
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id)
  VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.cree', v_id);
  IF v_force THEN
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id)
    VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.domaine_force', v_id);
  END IF;

  WITH ajoutees AS (
    INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
    SELECT t.x, v_id, 'super_admin', p_acteur FROM unnest(v_copros) AS t(x)
    ON CONFLICT DO NOTHING
    RETURNING copropriete_id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', a.copropriete_id, v_id, '{"origine": "super_admin"}'::jsonb
    FROM ajoutees a;
  RETURN v_id;
END $fn$;

-- « C'est moi » : l'envoi (déjà relu et vérifié par la route, lireInvitationValide) confirme l'adresse de la fiche.
CREATE OR REPLACE FUNCTION signalements_qr_confirmer_adresse(p_invitation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_g    uuid;
  v_cab  uuid;
BEGIN
  UPDATE signalements_qr_invitations i SET accepted_at = now(), invite_token = NULL
   WHERE i.id = p_invitation AND i.objet = 'confirmation_adresse' AND i.accepted_at IS NULL AND i.refus IS NULL
     AND i.invite_token IS NOT NULL AND i.created_at > now() - interval '7 days'
     AND EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                  WHERE g.id = i.gestionnaire_id AND g.actif AND g.adresse_contestee_le IS NULL AND g.email = i.email)
  RETURNING i.gestionnaire_id INTO v_g;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE signalements_qr_gestionnaires SET adresse_confirmee_le = coalesce(adresse_confirmee_le, now())
   WHERE id = v_g
  RETURNING cabinet_id INTO v_cab;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id)
  VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_confirmee', v_g);
  RETURN true;
END $fn$;

-- « Ce n'est pas moi » : la fiche est figée (non confirmée, aucun e-mail, aucun nouvel envoi), pas désactivée : le
-- super admin choisit les successions en créant la bonne fiche.
CREATE OR REPLACE FUNCTION signalements_qr_contester_adresse(p_invitation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_g    uuid;
  v_cab  uuid;
BEGIN
  UPDATE signalements_qr_invitations i SET refus = 'pas_moi', invite_token = NULL
   WHERE i.id = p_invitation AND i.objet = 'confirmation_adresse' AND i.accepted_at IS NULL AND i.refus IS NULL
     AND i.invite_token IS NOT NULL AND i.created_at > now() - interval '7 days'
     AND EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                  WHERE g.id = i.gestionnaire_id AND g.actif AND g.adresse_contestee_le IS NULL AND g.email = i.email)
  RETURNING i.gestionnaire_id INTO v_g;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE signalements_qr_gestionnaires SET adresse_contestee_le = now() WHERE id = v_g
  RETURNING cabinet_id INTO v_cab;
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = v_g AND accepted_at IS NULL AND invite_token IS NOT NULL;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id)
  VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_contestee', v_g);
  RETURN true;
END $fn$;

-- Destinataires gestionnaires d'un dépôt. Lignes exclu = false : fiches actives à adresse confirmée et non contestée,
-- attribuées à la copropriété, ou toutes celles du même cabinet si elle est « à tous ». Lignes exclu = true : fiches
-- inactives ou contestées (de tout cabinet) dont l'adresse est restée dans les adresses saisies, à retirer de l'envoi.
-- Signature figée dès la PR 1 (CREATE OR REPLACE ne change pas un type de retour) : acces_ouvert vaut false jusqu'à la
-- PR 2, qui ne remplace que le corps.
CREATE OR REPLACE FUNCTION signalements_qr_emails_gestionnaires(p_copropriete uuid)
RETURNS TABLE(gestionnaire_id uuid, email text, acces_ouvert boolean, exclu boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT t.gestionnaire_id, t.email, t.acces_ouvert, t.exclu FROM (
    SELECT g.id AS gestionnaire_id, g.email AS email, false AS acces_ouvert, false AS exclu
      FROM signalements_qr_coproprietes c
      JOIN signalements_qr_gestionnaires g ON g.cabinet_id = c.cabinet_id
     WHERE c.id = p_copropriete
       AND g.actif AND g.email IS NOT NULL AND g.adresse_confirmee_le IS NOT NULL AND g.adresse_contestee_le IS NULL
       AND (c.attribuee_a_tous OR EXISTS (SELECT 1 FROM signalements_qr_attributions a
                                           WHERE a.copropriete_id = c.id AND a.gestionnaire_id = g.id))
    UNION ALL
    SELECT g.id, g.email, false, true
      FROM signalements_qr_coproprietes c
      JOIN signalements_qr_gestionnaires g ON g.email = ANY (c.emails_destinataires)
     WHERE c.id = p_copropriete
       AND (NOT g.actif OR g.adresse_contestee_le IS NOT NULL)
  ) AS t
  ORDER BY t.exclu DESC, t.gestionnaire_id
  LIMIT 100
$fn$;

-- Budget d'e-mails d'un dépôt : messages de la dernière heure de la copropriété, puis de tout son cabinet (le groupe
-- « sans cabinet » compte comme un cabinet), sous le verrou du cabinet : deux dépôts simultanés ne dépassent pas
-- ensemble. Accordé : nb_emails_envoyes = p_nombre ; refusé : email_retenu, le dépôt reste enregistré.
-- retenus = dépôts de la copropriété retenus depuis le dernier e-mail parti (mention de rattrapage, alerte unique).
CREATE OR REPLACE FUNCTION signalements_qr_reserver_emails(
  p_signalement uuid, p_nombre int, p_max_copro int, p_max_cabinet int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_zero           CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  v_copro          uuid;
  v_cab            uuid;
  v_depuis         timestamptz := now() - interval '1 hour';
  v_somme_copro    bigint;
  v_somme_cabinet  bigint;
  v_dernier_envoi  timestamptz;
  v_retenus        bigint;
BEGIN
  IF p_signalement IS NULL OR p_nombre IS NULL OR p_nombre NOT BETWEEN 0 AND 100
     OR p_max_copro IS NULL OR p_max_copro < 0 OR p_max_cabinet IS NULL OR p_max_cabinet < 0 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT s.copropriete_id, c.cabinet_id INTO v_copro, v_cab
    FROM signalements_qr s JOIN signalements_qr_coproprietes c ON c.id = s.copropriete_id
   WHERE s.id = p_signalement;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_emails:' || coalesce(v_cab, v_zero)::text, 0));

  SELECT coalesce(sum(s.nb_emails_envoyes), 0) INTO v_somme_copro
    FROM signalements_qr s
   WHERE s.copropriete_id = v_copro AND s.created_at > v_depuis AND s.id <> p_signalement;
  SELECT coalesce(sum(s.nb_emails_envoyes), 0) INTO v_somme_cabinet
    FROM signalements_qr s JOIN signalements_qr_coproprietes c ON c.id = s.copropriete_id
   WHERE coalesce(c.cabinet_id, v_zero) = coalesce(v_cab, v_zero) AND s.created_at > v_depuis AND s.id <> p_signalement;
  SELECT max(s.created_at) INTO v_dernier_envoi
    FROM signalements_qr s
   WHERE s.copropriete_id = v_copro AND s.email_envoye_le IS NOT NULL AND s.id <> p_signalement;
  SELECT count(*) INTO v_retenus
    FROM signalements_qr s
   WHERE s.copropriete_id = v_copro AND s.email_retenu AND s.id <> p_signalement
     AND (v_dernier_envoi IS NULL OR s.created_at > v_dernier_envoi);

  IF v_somme_copro + p_nombre <= p_max_copro AND v_somme_cabinet + p_nombre <= p_max_cabinet THEN
    UPDATE signalements_qr SET nb_emails_envoyes = p_nombre, email_retenu = false WHERE id = p_signalement;
    RETURN jsonb_build_object('accorde', true, 'retenus', v_retenus);
  END IF;
  UPDATE signalements_qr SET nb_emails_envoyes = 0, email_retenu = true WHERE id = p_signalement;
  RETURN jsonb_build_object('accorde', false, 'retenus', v_retenus);
END $fn$;

-- Journal : 12 mois glissants (purge lancée à l'ouverture du journal, au plus une fois par jour, par la route).
CREATE OR REPLACE FUNCTION signalements_qr_purger_journal() RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_n bigint;
BEGIN
  DELETE FROM signalements_qr_journal WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO signalements_qr_journal (acteur_profil, action, details)
    VALUES ('systeme', 'journal.purge', jsonb_build_object('lignes', v_n));
  END IF;
  RETURN v_n;
END $fn$;

-- Création (p_id NULL) ou modification d'un cabinet client. Paramètres NULL = inchangés ; p_domaines non NULL
-- remplace toute la liste. Identifiant ou domaine d'un autre cabinet refusés ; identifiant figé par trigger.
CREATE OR REPLACE FUNCTION signalements_qr_enregistrer_cabinet(
  p_id uuid, p_nom text, p_identifiant text, p_langue text, p_domaines text[], p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_id        uuid := p_id;
  v_ancien    signalements_qr_cabinets%ROWTYPE;
  v_nom       text := nullif(btrim(p_nom), '');
  v_champs    text[] := '{}';
  v_domaines  text[];
  v_avant     text[] := '{}';
BEGIN
  IF p_acteur IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  IF p_domaines IS NOT NULL THEN
    v_domaines := ARRAY(SELECT DISTINCT lower(btrim(t.x)) FROM unnest(p_domaines) AS t(x)
                         WHERE nullif(btrim(t.x), '') IS NOT NULL ORDER BY 1);
    IF cardinality(v_domaines) > 20 THEN
      RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_identifiant IS NOT NULL AND EXISTS (SELECT 1 FROM signalements_qr_cabinets k
                                            WHERE k.identifiant = p_identifiant AND k.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'identifiant_pris' USING ERRCODE = 'P0001';
  END IF;
  IF v_domaines IS NOT NULL AND EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d
                                         WHERE d.domaine = ANY (v_domaines) AND d.cabinet_id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'domaine_pris' USING ERRCODE = 'P0001';
  END IF;

  IF p_id IS NULL THEN
    IF v_nom IS NULL OR p_identifiant IS NULL THEN
      RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
    END IF;
    INSERT INTO signalements_qr_cabinets (nom, identifiant, langue, cree_par)
    VALUES (v_nom, p_identifiant, coalesce(p_langue, 'fr'), p_acteur)
    RETURNING id INTO v_id;                        -- 23505 si un autre appel a pris l'identifiant entre-temps
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action)
    VALUES (v_id, p_acteur, 'super_admin', 'cabinet.cree');
  ELSE
    SELECT * INTO v_ancien FROM signalements_qr_cabinets k WHERE k.id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
    END IF;
    IF v_nom IS NOT NULL AND v_nom IS DISTINCT FROM v_ancien.nom THEN
      v_champs := array_append(v_champs, 'nom');
    END IF;
    IF p_identifiant IS NOT NULL AND p_identifiant IS DISTINCT FROM v_ancien.identifiant THEN
      v_champs := array_append(v_champs, 'identifiant');
    END IF;
    IF p_langue IS NOT NULL AND p_langue IS DISTINCT FROM v_ancien.langue THEN
      v_champs := array_append(v_champs, 'langue');
    END IF;
    IF cardinality(v_champs) > 0 THEN
      UPDATE signalements_qr_cabinets
         SET nom = coalesce(v_nom, nom), identifiant = coalesce(p_identifiant, identifiant), langue = coalesce(p_langue, langue)
       WHERE id = p_id;                            -- identifiant_fige (trigger) si le cabinet est déjà utilisé
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, champs)
      VALUES (p_id, p_acteur, 'super_admin', 'cabinet.modifie', v_champs);
    END IF;
    v_avant := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = p_id ORDER BY 1);
  END IF;

  IF v_domaines IS NOT NULL AND v_domaines IS DISTINCT FROM v_avant THEN
    DELETE FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_id AND NOT (d.domaine = ANY (v_domaines));
    INSERT INTO signalements_qr_domaines_autorises (cabinet_id, domaine, ajoute_par)
    SELECT v_id, t.x, p_acteur FROM unnest(v_domaines) AS t(x)
     WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_id AND d.domaine = t.x);
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, details)
    VALUES (v_id, p_acteur, 'super_admin', 'cabinet.domaines_modifies', jsonb_build_object('nombre', cardinality(v_domaines)));
  END IF;
  RETURN jsonb_build_object('id', v_id, 'cree', p_id IS NULL, 'champs', to_jsonb(v_champs));
END $fn$;

-- Rattachement de copropriétés sans cabinet à un cabinet (définitif) : toutes ou aucune.
-- p_cles_nom : { "<id>": "<clé du nom>" } calculée par la route (cleNomCoproQr), posée là où cle_nom manque (anciennes
-- copropriétés). Doublon nom + code postal avec le cabinet ou dans le lot (RG-08) refusé sous le verrou, sauf
-- p_forcer_doublon (« Ce n'est pas un doublon », super admin), journalisé doublon.force.
CREATE OR REPLACE FUNCTION signalements_qr_rattacher_coproprietes(
  p_cabinet uuid, p_coproprietes uuid[], p_acteur uuid, p_cles_nom jsonb, p_forcer_doublon boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_ids       uuid[] := ARRAY(SELECT DISTINCT t.x FROM unnest(coalesce(p_coproprietes, '{}'::uuid[])) AS t(x) WHERE t.x IS NOT NULL);
  v_n         bigint;
  v_doublons  uuid[];
BEGIN
  IF p_cabinet IS NULL OR p_acteur IS NULL OR cardinality(v_ids) NOT BETWEEN 1 AND 500
     OR p_cles_nom IS NULL OR jsonb_typeof(p_cles_nom) <> 'object' THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM signalements_qr_cabinets k WHERE k.id = p_cabinet FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Même verrou que la création : aucun contrôle de doublon du cabinet ne court pendant le rattachement.
  PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_creation:' || p_cabinet::text, 0));
  PERFORM 1 FROM signalements_qr_coproprietes c WHERE c.id = ANY (v_ids) ORDER BY c.id FOR UPDATE;
  IF (SELECT count(*) FROM signalements_qr_coproprietes c WHERE c.id = ANY (v_ids) AND c.cabinet_id IS NULL)
     <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Clé du nom posée où elle manque : ce contrôle et celui de la création la comparent ensuite.
  UPDATE signalements_qr_coproprietes c SET cle_nom = coalesce(c.cle_nom, nullif(p_cles_nom->>c.id::text, ''))
   WHERE c.id = ANY (v_ids) AND c.cle_nom IS NULL;
  -- Doublon nom + code postal (RG-08) avec une copropriété du cabinet ou une autre du lot, sous le verrou.
  v_doublons := ARRAY(SELECT c.id FROM signalements_qr_coproprietes c
                       WHERE c.id = ANY (v_ids) AND c.code_postal <> '' AND c.cle_nom IS NOT NULL
                         AND EXISTS (SELECT 1 FROM signalements_qr_coproprietes d
                                      WHERE d.id <> c.id AND (d.cabinet_id = p_cabinet OR d.id = ANY (v_ids))
                                        AND d.cle_nom = c.cle_nom AND d.code_postal = c.code_postal)
                       ORDER BY c.id);
  IF cardinality(v_doublons) > 0 AND NOT coalesce(p_forcer_doublon, false) THEN
    RAISE EXCEPTION 'doublon' USING ERRCODE = 'P0001';
  END IF;
  WITH rattachees AS (
    UPDATE signalements_qr_coproprietes c SET cabinet_id = p_cabinet
     WHERE c.id = ANY (v_ids) AND c.cabinet_id IS NULL
    RETURNING c.id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id)
  SELECT p_cabinet, p_acteur, 'super_admin', 'copropriete.rattachee', r.id FROM rattachees r;
  GET DIAGNOSTICS v_n = ROW_COUNT;               -- 23505 : immatriculation ou référence déjà prise dans le cabinet
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, details)
  SELECT p_cabinet, p_acteur, 'super_admin', 'doublon.force', x.id, '{"critere": "nom_code_postal"}'::jsonb FROM unnest(v_doublons) AS x(id);
  RETURN jsonb_build_object('rattachees', v_n);
END $fn$;

-- ── 8. Droits : EXECUTE réservé à service_role (signatures complètes) ──
REVOKE EXECUTE ON FUNCTION signalements_qr_creer_coproprietes(uuid, uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_creer_coproprietes(uuid, uuid, text, uuid, uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_compteurs(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_compteurs(uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_remplacer_attributions(uuid, uuid[], boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_remplacer_attributions(uuid, uuid[], boolean, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_attribuer_au_gestionnaire(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_attribuer_au_gestionnaire(uuid, uuid[], uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_desactiver_gestionnaire(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_desactiver_gestionnaire(uuid, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_reactiver_gestionnaire(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_reactiver_gestionnaire(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_confirmer_adresse(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_confirmer_adresse(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_reserver_emails(uuid, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_reserver_emails(uuid, int, int, int) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_purger_journal() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_purger_journal() TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_enregistrer_cabinet(uuid, text, text, text, text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_enregistrer_cabinet(uuid, text, text, text, text[], uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_rattacher_coproprietes(uuid, uuid[], uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_rattacher_coproprietes(uuid, uuid[], uuid, jsonb, boolean) TO service_role;
-- Fonctions de trigger : jamais appelables directement (le trigger s'exécute sans ce droit).
REVOKE EXECUTE ON FUNCTION signalements_qr_identifiant_fige() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION signalements_qr_cabinet_copro_fige() FROM PUBLIC, anon, authenticated;

-- ── 9. RLS sans politique et retrait des droits par défaut de Supabase, sur les 7 tables nouvelles ──
ALTER TABLE signalements_qr_cabinets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_domaines_autorises ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_gestionnaires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_attributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_journal            ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr_operations         ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signalements_qr_cabinets, signalements_qr_domaines_autorises, signalements_qr_gestionnaires,
              signalements_qr_invitations, signalements_qr_attributions, signalements_qr_journal,
              signalements_qr_operations FROM anon, authenticated;

-- ── 10. Triggers (set_updated_at existe : migration 056, ou créée par 20261104_signalements_qr.sql) ──
CREATE OR REPLACE TRIGGER trg_signalements_qr_cabinets_updated_at
  BEFORE UPDATE ON signalements_qr_cabinets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_signalements_qr_gestionnaires_updated_at
  BEFORE UPDATE ON signalements_qr_gestionnaires FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_signalements_qr_cabinets_identifiant_fige
  BEFORE UPDATE OF identifiant ON signalements_qr_cabinets FOR EACH ROW EXECUTE FUNCTION signalements_qr_identifiant_fige();
CREATE OR REPLACE TRIGGER trg_signalements_qr_copros_cabinet_fige
  BEFORE UPDATE OF cabinet_id ON signalements_qr_coproprietes FOR EACH ROW EXECUTE FUNCTION signalements_qr_cabinet_copro_fige();

-- PostgREST relit le schéma : tables, colonnes et fonctions sont utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
