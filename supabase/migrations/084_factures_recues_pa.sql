-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 084 — Factures reçues via PA (FR-V6, stub)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Réforme française e-invoicing (1er sept 2026) : toutes les entreprises FR
-- doivent être capables de RECEVOIR des factures électroniques via une
-- Plateforme Agréée (PA). Cette migration prépare la table de stockage
-- + RLS owner-only.
--
-- Ne signe AUCUN contrat avec une PA pour l'instant — c'est une décision
-- commerciale (cf. docs/conformite/pa-reception-roadmap.md). Le webhook
-- /api/pa-incoming est en stub : il valide une signature HMAC partagée
-- (DOC_HASH_SECRET pour le moment, à remplacer par PA_INBOUND_SECRET
-- spécifique au moment du choix Docaposte/Pennylane).

-- ── 1. Table factures_recues ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factures_recues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Émetteur de la facture (entreprise qui facture l'artisan)
  emetteur_siret TEXT NOT NULL,
  emetteur_name TEXT NOT NULL,
  emetteur_email TEXT,

  -- Identifiants document
  numero TEXT NOT NULL,
  date_emission DATE NOT NULL,
  date_echeance DATE,

  -- Montants en cents (cohérent avec devis/factures)
  total_ht_cents BIGINT NOT NULL DEFAULT 0,
  total_tva_cents BIGINT NOT NULL DEFAULT 0,
  total_ttc_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Métadonnées PA
  format TEXT NOT NULL CHECK (format IN ('factur-x', 'ubl', 'cii')),
  source_pa TEXT NOT NULL,                  -- 'docaposte' | 'pennylane' | etc
  pa_message_id TEXT NOT NULL,              -- identifiant unique côté PA

  -- Contenu brut pour audit
  raw_xml TEXT,
  pdf_url TEXT,                             -- Supabase Storage URL

  -- Workflow artisan
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','validated','disputed','paid','rejected')),
  artisan_notes TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  UNIQUE(source_pa, pa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_factures_recues_artisan
  ON factures_recues(artisan_user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_factures_recues_status
  ON factures_recues(artisan_user_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_factures_recues_emetteur
  ON factures_recues(emetteur_siret);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE factures_recues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factures_recues_owner_select" ON factures_recues;
CREATE POLICY "factures_recues_owner_select" ON factures_recues
  FOR SELECT USING (artisan_user_id = auth.uid());

DROP POLICY IF EXISTS "factures_recues_owner_update" ON factures_recues;
CREATE POLICY "factures_recues_owner_update" ON factures_recues
  FOR UPDATE
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- INSERT réservé au service_role uniquement (webhook PA appelle via supabaseAdmin)
DROP POLICY IF EXISTS "factures_recues_service_insert" ON factures_recues;
CREATE POLICY "factures_recues_service_insert" ON factures_recues
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Pas de DELETE policy (immutable, conservation 10 ans)

COMMENT ON TABLE factures_recues IS
  'Factures électroniques reçues via Plateforme Agréée (e-invoicing FR 2026/2027). RLS owner-only.';
