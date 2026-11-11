-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (06/11/2026) — qualité du déclarant, adresse proposée d'après sa position, signalement lié.
--
-- Demandes de Hugo du 06/11/2026, enregistrées avec chaque dépôt par QR code :
--   qualite_declarant  : « Vous êtes : Propriétaire / Locataire » (champ obligatoire du formulaire) ;
--   adresse_proposee   : adresse de la copropriété proposée d'après la position de la personne (géocodage inverse
--                        par le serveur, service de l'État), seulement quand la copropriété n'a pas d'adresse ;
--                        texte seul : les coordonnées ne sont jamais conservées ;
--   signalement_lie_id : signalement déjà fait au même endroit que la personne a désigné comme « le même
--                        problème » (résolu par le serveur dans la même copropriété) ; la suppression du signalement
--                        lié remet le lien à NULL.
-- Index de la recherche des signalements semblables (même copropriété, parties communes, zone, statuts ouverts).
--
-- Migration additive et rejouable : ADD COLUMN IF NOT EXISTS (colonnes nullables, aucune valeur par défaut),
-- contraintes nommées créées seulement si elles manquent, en NOT VALID puis VALIDATE, CREATE INDEX IF NOT EXISTS ;
-- aucune suppression, aucune écriture de données : les signalements déjà reçus gardent des colonnes nulles
-- (« qualité non indiquée »).
-- À appliquer par Frédéric (Supabase > SQL Editor) AVANT la fusion de la PR, après
-- 20261106_signalements_qr_confirmation.sql. D'ici là, les routes se replient sur les colonnes d'origine.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS qualite_declarant TEXT;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS adresse_proposee TEXT;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS signalement_lie_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signalements_qr_qualite_declarant_valeurs'
      AND conrelid = 'signalements_qr'::regclass
  ) THEN
    ALTER TABLE signalements_qr
      ADD CONSTRAINT signalements_qr_qualite_declarant_valeurs
      CHECK (qualite_declarant IS NULL OR qualite_declarant IN ('proprietaire', 'locataire')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signalements_qr_adresse_proposee_longueur'
      AND conrelid = 'signalements_qr'::regclass
  ) THEN
    -- Même borne que l'adresse d'une copropriété (route : 300 caractères).
    ALTER TABLE signalements_qr
      ADD CONSTRAINT signalements_qr_adresse_proposee_longueur
      CHECK (adresse_proposee IS NULL OR char_length(adresse_proposee) <= 300) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signalements_qr_signalement_lie_fk'
      AND conrelid = 'signalements_qr'::regclass
  ) THEN
    ALTER TABLE signalements_qr
      ADD CONSTRAINT signalements_qr_signalement_lie_fk
      FOREIGN KEY (signalement_lie_id) REFERENCES signalements_qr(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signalements_qr_signalement_lie_distinct'
      AND conrelid = 'signalements_qr'::regclass
  ) THEN
    -- Un signalement n'est jamais lié à lui-même.
    ALTER TABLE signalements_qr
      ADD CONSTRAINT signalements_qr_signalement_lie_distinct
      CHECK (signalement_lie_id IS NULL OR signalement_lie_id <> id) NOT VALID;
  END IF;
END $$;

-- Les lignes existantes ont ces colonnes à NULL : la validation passe et reste rejouable.
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_qualite_declarant_valeurs;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_adresse_proposee_longueur;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_signalement_lie_fk;
ALTER TABLE signalements_qr VALIDATE CONSTRAINT signalements_qr_signalement_lie_distinct;

-- Recherche des signalements déjà faits au même endroit (GET /api/aj-signalement/similaires et lien au dépôt) :
-- mêmes filtres que la route (lib/aj-signalement/serveur.ts, lireSemblablesQr).
CREATE INDEX IF NOT EXISTS idx_signalements_qr_semblables
  ON signalements_qr (copropriete_id, zone_signalee, created_at DESC)
  WHERE est_partie_commune AND statut IN ('en_attente', 'acceptee', 'en_cours');

-- ON DELETE SET NULL : retrouver vite les signalements liés à celui qu'on supprime.
CREATE INDEX IF NOT EXISTS idx_signalements_qr_signalement_lie
  ON signalements_qr (signalement_lie_id)
  WHERE signalement_lie_id IS NOT NULL;

COMMENT ON COLUMN signalements_qr.qualite_declarant IS 'Qualité déclarée par la personne : proprietaire ou locataire ; NULL pour les dépôts antérieurs au 06/11/2026.';
COMMENT ON COLUMN signalements_qr.adresse_proposee IS 'Adresse de la copropriété proposée d''après la position du déclarant (texte seul, jamais les coordonnées), quand la copropriété n''avait pas d''adresse ; appliquée seulement par le super admin.';
COMMENT ON COLUMN signalements_qr.signalement_lie_id IS 'Signalement déjà fait au même endroit que le déclarant a désigné comme « le même problème » (même copropriété, contrôlé par le serveur) ; NULL sinon.';

-- PostgREST relit le schéma : les nouvelles colonnes sont utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
