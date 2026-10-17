-- ══════════════════════════════════════════════════════════════════════════════
-- Portail copropriétaire (17/10/2026) — publication explicite des documents,
-- accès du locataire, unicité du vote par correspondance.
--
-- À appliquer en production par Frédéric (Supabase > SQL Editor). Le code du
-- portail tolère son absence : sans ces colonnes, aucun document n'est publié
-- (lecture en erreur → liste vide) et l'accès du locataire suit acces_portail.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Documents : rien n'est visible des copropriétaires sans décision du syndic ──
-- Décret n° 67-223 art. 33-1-1 (extranet, décret 2019-502) : espace commun (tous les
-- copropriétaires) ou espace personnel (un copropriétaire). Jamais publié par défaut.
ALTER TABLE syndic_documents
  ADD COLUMN IF NOT EXISTS publie_extranet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS espace_extranet TEXT NOT NULL DEFAULT 'commun',
  ADD COLUMN IF NOT EXISTS coproprio_id UUID REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categorie_extranet TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndic_documents_espace_extranet_check') THEN
    ALTER TABLE syndic_documents
      ADD CONSTRAINT syndic_documents_espace_extranet_check
      CHECK (espace_extranet IN ('commun', 'personnel'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndic_documents_categorie_extranet_check') THEN
    ALTER TABLE syndic_documents
      ADD CONSTRAINT syndic_documents_categorie_extranet_check
      CHECK (categorie_extranet IS NULL OR categorie_extranet IN (
        'reglement', 'edd', 'fiche_synthetique', 'carnet_entretien', 'diagnostic', 'assurance',
        'contrat_marche', 'contrat_entretien', 'pv_ag', 'devis_approuve', 'contrat_syndic',
        'convocation', 'budget', 'compte_individuel', 'appel_fonds', 'autre'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_syndic_documents_extranet
  ON syndic_documents (cabinet_id, immeuble_id)
  WHERE publie_extranet;

COMMENT ON COLUMN syndic_documents.publie_extranet IS 'Visible des copropriétaires de l''immeuble (portail) : décision explicite du syndic, jamais par défaut.';
COMMENT ON COLUMN syndic_documents.espace_extranet IS 'commun = tous les copropriétaires de l''immeuble ; personnel = le seul copropriétaire coproprio_id.';
COMMENT ON COLUMN syndic_documents.categorie_extranet IS 'Rubrique de l''art. 33-1-1 du décret du 17 mars 1967 (extranet).';

-- ── 2. Locataire : accès distinct de celui du propriétaire ──
ALTER TABLE syndic_coproprios
  ADD COLUMN IF NOT EXISTS acces_portail_locataire BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN syndic_coproprios.acces_portail_locataire IS 'Accès du locataire du lot au portail (demandes, règlement, annonces) ; indépendant de acces_portail (propriétaire).';

-- ── 2 bis. Signalements : provenance (compte rattaché au portail, ou dépôt public sans compte) ──
ALTER TABLE syndic_signalements
  ADD COLUMN IF NOT EXISTS origine TEXT NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndic_signalements_origine_check') THEN
    ALTER TABLE syndic_signalements
      ADD CONSTRAINT syndic_signalements_origine_check
      CHECK (origine IN ('portail', 'public'));
  END IF;
END $$;

COMMENT ON COLUMN syndic_signalements.origine IS 'portail = déposé par un compte rattaché à sa fiche (identité vérifiée) ; public = dépôt sans compte (QR code, portail léger).';

-- ── 3. Vote par correspondance : un seul vote par copropriétaire et par résolution ──
-- Les votes saisis par le syndic sans fiche (coproprio_id NULL) ne sont pas concernés.
-- Doublons existants : seul le plus récent est conservé avant la création de l'index.
DELETE FROM syndic_votes_correspondance v
USING syndic_votes_correspondance plus_recent
WHERE v.coproprio_id IS NOT NULL
  AND plus_recent.resolution_id = v.resolution_id
  AND plus_recent.coproprio_id = v.coproprio_id
  AND plus_recent.created_at > v.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_syndic_votes_correspondance_resolution_coproprio
  ON syndic_votes_correspondance (resolution_id, coproprio_id)
  WHERE coproprio_id IS NOT NULL;

-- Provenance et horodatage d'un vote reçu par le portail (le syndic saisit les votes papier).
ALTER TABLE syndic_votes_correspondance
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'papier',
  ADD COLUMN IF NOT EXISTS horodatage TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndic_votes_correspondance_source_check') THEN
    ALTER TABLE syndic_votes_correspondance
      ADD CONSTRAINT syndic_votes_correspondance_source_check
      CHECK (source IN ('papier', 'portail'));
  END IF;
END $$;
