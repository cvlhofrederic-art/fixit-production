-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 011 — Ajout colonnes rapport IA sur bookings
-- Permet le stockage du texte généré par Groq/fallback pour les rapports
-- ══════════════════════════════════════════════════════════════════════════════

-- Source de génération du texte rapport
-- 'groq' = généré par Llama 3.3 70B via Groq API
-- 'fallback_structurel' = généré structurellement sans IA
-- 'manuel' = rédigé manuellement par l'artisan
-- NULL = pas encore de rapport IA généré
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rapport_ia_source TEXT
    CHECK (rapport_ia_source IN ('groq', 'fallback_structurel', 'manuel'));

-- Timestamp de génération du texte IA
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rapport_ia_genere_le TIMESTAMPTZ;

-- Texte brut JSON généré par l'IA (introduction, travaux, observations, conclusion)
-- Stocké pour debug, re-génération, et traçabilité
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rapport_ia_texte_brut TEXT;
