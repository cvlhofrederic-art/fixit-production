-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 087 — devis & factures : UNIQUE (numero, artisan_user_id) composite  ║
-- ╠══════════════════════════════════════════════════════════════════════╣
-- ║ BUG IDENTIFIÉ (12/05/2026) :                                         ║
-- ║   - Code /api/devis/sync/route.ts upserte avec                       ║
-- ║     onConflict='numero,artisan_user_id' (composite key).             ║
-- ║   - Migration 038 a créé devis.numero TEXT UNIQUE NOT NULL (simple). ║
-- ║   - Aucune migration depuis n'a corrigé l'écart code ↔ DB.           ║
-- ║                                                                      ║
-- ║ CONSÉQUENCE :                                                        ║
-- ║   - Quand deux artisans génèrent un même numéro chrono local         ║
-- ║     (DEV-2026-001, DEV-2026-002, ...), l'upsert ne match aucune      ║
-- ║     contrainte unique composite → exécute un INSERT pur → viole      ║
-- ║     UNIQUE (numero) simple → 500 silencieux.                         ║
-- ║   - Avant PR #163 (12/05/2026), le client `.catch(() => {})`         ║
-- ║     avalait l'erreur. Aucun signal Sentry. Devis perdu en DB.        ║
-- ║                                                                      ║
-- ║ INCIDENT DOCUMENTÉ :                                                 ║
-- ║   - 22/04/2026 : un devis émis a été perdu. PDF généré localement,   ║
-- ║     synchronisation refusée en silence (numéro déjà pris par un      ║
-- ║     autre compte), puis cache du navigateur vidé : perte définitive, ║
-- ║     confirmée en base (aucune ligne pour ce compte).                 ║
-- ║                                                                      ║
-- ║ FIX :                                                                ║
-- ║   - Drop UNIQUE (numero) simple.                                     ║
-- ║   - Add UNIQUE (numero, artisan_user_id) composite.                  ║
-- ║   - Idem table factures (même schéma).                               ║
-- ║                                                                      ║
-- ║ SAFETY :                                                             ║
-- ║   - Pas de doublons à nettoyer : la contrainte simple était active   ║
-- ║     donc aucun (numero, artisan_user_id) en collision n'a pu être    ║
-- ║     persisté. Migration purement structurelle.                       ║
-- ║   - Le numero chrono côté artisan reste géré par RPC next_doc_number ║
-- ║     qui filtre déjà PAR artisan (cf. supabase/migrations/022_doc_    ║
-- ║     sequences.sql). Le nouveau contrat permet à 2 artisans d'avoir   ║
-- ║     DEV-2026-001 en parallèle, comportement attendu.                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── devis ─────────────────────────────────────────────────────────────
ALTER TABLE public.devis
  DROP CONSTRAINT IF EXISTS devis_numero_key;

ALTER TABLE public.devis
  ADD CONSTRAINT devis_numero_artisan_user_unique
  UNIQUE (numero, artisan_user_id);

-- ── factures ──────────────────────────────────────────────────────────
ALTER TABLE public.factures
  DROP CONSTRAINT IF EXISTS factures_numero_key;

ALTER TABLE public.factures
  ADD CONSTRAINT factures_numero_artisan_user_unique
  UNIQUE (numero, artisan_user_id);

COMMIT;
