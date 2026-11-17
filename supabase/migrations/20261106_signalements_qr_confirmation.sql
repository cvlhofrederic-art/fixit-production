-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (06/11/2026) — e-mail de confirmation envoyé au déclarant.
--
-- Après chaque dépôt par QR code, la route POST /api/aj-signalement/signalements envoie au déclarant
-- un récapitulatif (langue de la page, FR ou PT). Comme pour l'e-mail de l'administrateur, son échec
-- n'annule jamais le dépôt : l'état est conservé sur la ligne et affiché dans le détail du tableau de bord.
--
-- Migration additive et rejouable : ADD COLUMN IF NOT EXISTS, contrainte nommée créée seulement si elle
-- manque ; ni DROP, ni UPDATE : les signalements déjà reçus gardent des colonnes nulles (« confirmation
-- non envoyée »). À appliquer par Frédéric (Supabase > SQL Editor) AVANT la fusion de la PR : sans ces
-- colonnes, la mise à jour de l'état des e-mails et la lecture du tableau de bord échouent.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS confirmation_envoyee_le TIMESTAMPTZ;
ALTER TABLE signalements_qr ADD COLUMN IF NOT EXISTS confirmation_erreur TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signalements_qr_confirmation_erreur_longueur'
      AND conrelid = 'signalements_qr'::regclass
  ) THEN
    -- La route tronque l'erreur à 500 caractères.
    ALTER TABLE signalements_qr
      ADD CONSTRAINT signalements_qr_confirmation_erreur_longueur
      CHECK (confirmation_erreur IS NULL OR char_length(confirmation_erreur) <= 500);
  END IF;
END $$;

COMMENT ON COLUMN signalements_qr.confirmation_envoyee_le IS 'Horodatage de l''e-mail de confirmation accepté pour le déclarant ; NULL avec confirmation_erreur renseigné quand l''envoi a échoué ou a été limité.';
COMMENT ON COLUMN signalements_qr.confirmation_erreur IS 'Raison de l''absence de confirmation au déclarant (refus de Resend, limite par adresse) ; NULL pour les dépôts antérieurs au 06/11/2026.';

-- PostgREST relit le schéma : les nouvelles colonnes sont utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
