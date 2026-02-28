-- ══════════════════════════════════════════════════════════════════════
-- Vitfix Pro — Agent Email Max : tables Supabase
-- À exécuter dans l'éditeur SQL de Supabase (dashboard.supabase.com)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Table OAuth tokens Gmail
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'gmail',
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL DEFAULT '',
  token_expiry  TIMESTAMPTZ NOT NULL,
  email_compte  TEXT NOT NULL DEFAULT '',
  scope         TEXT DEFAULT '',
  watch_expiry  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(syndic_id)
);

ALTER TABLE syndic_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_own_tokens" ON syndic_oauth_tokens
  FOR ALL USING (syndic_id = auth.uid());

-- 2. Table emails analysés
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_emails_analysed (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Données brutes Gmail
  gmail_message_id  TEXT NOT NULL,
  gmail_thread_id   TEXT,
  from_email        TEXT NOT NULL DEFAULT '',
  from_name         TEXT DEFAULT '',
  to_email          TEXT DEFAULT '',
  subject           TEXT DEFAULT '(sans objet)',
  body_preview      TEXT DEFAULT '',
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Classification IA (Max)
  urgence           TEXT NOT NULL DEFAULT 'basse'
                    CHECK (urgence IN ('haute', 'moyenne', 'basse')),
  type_demande      TEXT NOT NULL DEFAULT 'autre'
                    CHECK (type_demande IN (
                      'signalement_panne', 'demande_devis', 'reclamation',
                      'ag', 'facturation', 'resiliation', 'information', 'autre'
                    )),
  resume_ia         TEXT DEFAULT '',
  immeuble_detecte  TEXT,
  locataire_detecte TEXT,
  actions_suggerees JSONB DEFAULT '[]',
  reponse_suggeree  TEXT,

  -- État traitement
  statut            TEXT NOT NULL DEFAULT 'nouveau'
                    CHECK (statut IN ('nouveau', 'traite', 'archive', 'mission_cree')),
  note_interne      TEXT DEFAULT '',

  -- Métadonnées
  analyse_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(syndic_id, gmail_message_id)
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_syndic_emails_syndic_id   ON syndic_emails_analysed(syndic_id);
CREATE INDEX IF NOT EXISTS idx_syndic_emails_urgence      ON syndic_emails_analysed(syndic_id, urgence);
CREATE INDEX IF NOT EXISTS idx_syndic_emails_statut       ON syndic_emails_analysed(syndic_id, statut);
CREATE INDEX IF NOT EXISTS idx_syndic_emails_received     ON syndic_emails_analysed(syndic_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_syndic_emails_type         ON syndic_emails_analysed(syndic_id, type_demande);

ALTER TABLE syndic_emails_analysed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_own_emails" ON syndic_emails_analysed
  FOR ALL USING (syndic_id = auth.uid());

-- 3. Vue rapport quotidien
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW syndic_email_daily_report AS
SELECT
  syndic_id,
  DATE(received_at AT TIME ZONE 'Europe/Paris') AS date,
  COUNT(*)                                       AS total,
  COUNT(*) FILTER (WHERE urgence = 'haute')      AS urgences_hautes,
  COUNT(*) FILTER (WHERE urgence = 'moyenne')    AS urgences_moyennes,
  COUNT(*) FILTER (WHERE urgence = 'basse')      AS urgences_basses,
  COUNT(*) FILTER (WHERE statut = 'nouveau')     AS non_traites,
  COUNT(*) FILTER (WHERE statut = 'traite')      AS traites,
  COUNT(*) FILTER (WHERE statut = 'mission_cree') AS missions_crees
FROM syndic_emails_analysed
GROUP BY syndic_id, DATE(received_at AT TIME ZONE 'Europe/Paris')
ORDER BY date DESC;
