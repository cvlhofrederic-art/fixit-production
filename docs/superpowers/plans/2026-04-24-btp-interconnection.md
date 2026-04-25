# BTP Module Interconnection Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all BTP modules to real Supabase data with FK relationships, eliminate localStorage-only silos and string-based matching.

**Architecture:** Add `chantier_id` FK to isolated tables (situations, dc4, retenues). Migrate FacturesSection from localStorage to Supabase dual-write. Replace free-text chantier inputs with dropdown selectors. Update RentabiliteChantier to use single Supabase source with FK joins.

**Tech Stack:** Supabase (PostgreSQL), Next.js API routes, React hooks (useBTPData), TypeScript

---

### Task 1: SQL Migration — chantier_id FK on isolated tables

**Files:**
- Create: `supabase/migrations/061_chantier_fk_interconnection.sql`

- [ ] **Step 1: Write migration SQL**

Add `chantier_id` FK column to `situations_btp`, `dc4_btp`, `retenues_btp`. Backfill existing rows by matching `chantier` text to `chantiers_btp.titre`.

```sql
-- Migration 061 — FK chantier_id on situations/dc4/retenues
ALTER TABLE situations_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE dc4_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE retenues_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);

CREATE INDEX IF NOT EXISTS idx_situations_chantier ON situations_btp(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dc4_chantier ON dc4_btp(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retenues_chantier ON retenues_btp(chantier_id) WHERE chantier_id IS NOT NULL;

-- Backfill: match existing text to chantiers_btp.titre (same owner)
UPDATE situations_btp s SET chantier_id = c.id
FROM chantiers_btp c
WHERE s.chantier_id IS NULL AND s.owner_id = c.owner_id
  AND lower(trim(s.chantier)) = lower(trim(c.titre));

UPDATE dc4_btp d SET chantier_id = c.id
FROM chantiers_btp c
WHERE d.chantier_id IS NULL AND d.owner_id = c.owner_id
  AND lower(trim(d.chantier)) = lower(trim(c.titre));

UPDATE retenues_btp r SET chantier_id = c.id
FROM chantiers_btp c
WHERE r.chantier_id IS NULL AND r.owner_id = c.owner_id
  AND lower(trim(r.chantier)) = lower(trim(c.titre));
```

- [ ] **Step 2: Execute in Supabase Dashboard SQL Editor**
- [ ] **Step 3: Commit migration file**

---

### Task 2: Shared ChantierSelect component

**Files:**
- Create: `components/dashboard/btp/ChantierSelect.tsx`

- [ ] **Step 1: Create reusable dropdown component**

Fetches chantiers from useBTPData and renders a `<select>` with chantier titre + client. On select, calls `onChange(chantierId, chantierTitre, client)`. Supports both V5 and V22 themes.

- [ ] **Step 2: Commit**

---

### Task 3: Wire ChantierSelect into SituationsTravaux

**Files:**
- Modify: `components/dashboard/btp/SituationsTravaux.tsx`

- [ ] **Step 1: Replace free-text chantier input with ChantierSelect**

Form state adds `chantier_id`. On select, auto-fill `chantier` (titre) + `client`. On save, send `chantier_id` to Supabase.

- [ ] **Step 2: Commit**

---

### Task 4: Wire ChantierSelect into RetenuesGarantieSection

**Files:**
- Modify: `components/dashboard/btp/RetenuesGarantieSection.tsx`

- [ ] **Step 1: Same pattern as Task 3**
- [ ] **Step 2: Commit**

---

### Task 5: Wire ChantierSelect into SousTraitanceDC4Section

**Files:**
- Modify: `components/dashboard/btp/SousTraitanceDC4Section.tsx`

- [ ] **Step 1: Same pattern as Task 3**
- [ ] **Step 2: Commit**

---

### Task 6: FacturesSection — Supabase dual-write

**Files:**
- Modify: `components/DevisFactureForm.tsx` (save handler)
- Modify: `components/DevisFactureFormBTP.tsx` (save handler)
- Modify: `components/dashboard/FacturesSection.tsx` (load handler)

- [ ] **Step 1: On save, write document to Supabase `factures`/`devis` table**

After localStorage write (keep for offline), also write to Supabase via `/api/btp` or direct insert. Include `chantier_id` if set, and `frais_annexes` JSONB with MO/Mat/Frais breakdown.

- [ ] **Step 2: On load, merge Supabase + localStorage documents**

FacturesSection.refreshDocuments() should also fetch from Supabase and merge (dedupe by docNumber).

- [ ] **Step 3: Auto-import existing localStorage docs to Supabase on first load**
- [ ] **Step 4: Commit**

---

### Task 7: RentabiliteChantier — Single Supabase source + FK matching

**Files:**
- Modify: `components/dashboard/RentabiliteChantierSection.tsx`

- [ ] **Step 1: Remove localStorage reads for situations and documents**

Replace `load('situations_${id}')` with fetch from `/api/btp?table=situations`. Replace `load('fixit_documents_${id}')` with fetch from Supabase `factures`/`devis` tables.

- [ ] **Step 2: Replace string matching with chantier_id FK**

Change `pointages.filter(p => p.chantier.toLowerCase() === titre)` to `pointages.filter(p => p.chantier_id === ch.id)`. Same for expenses, situations, documents.

- [ ] **Step 3: Commit**

---

### Task 8: Update v_rentabilite_chantier view for situations

**Files:**
- Modify: `supabase/migrations/061_chantier_fk_interconnection.sql`

- [ ] **Step 1: Add situations aggregate to the view**

```sql
LEFT JOIN (
  SELECT chantier_id,
    SUM(travaux_total) AS ca_situations,
    COUNT(*) AS nb_situations
  FROM situations_btp
  WHERE chantier_id IS NOT NULL AND statut IN ('validée', 'payée')
  GROUP BY chantier_id
) sit ON sit.chantier_id = c.id
```

- [ ] **Step 2: Execute updated view in Supabase**
- [ ] **Step 3: Commit**

---

### Task 9: ComptaBTP — Verify real data flow

**Files:**
- Modify: `components/dashboard/ComptaBTPSection.tsx` (if needed)

- [ ] **Step 1: Verify the view returns real facture/devis/situations data**

After Tasks 6-8, `v_rentabilite_chantier` should aggregate real data. Verify `montant_facture_ht_lie`, `total_frais_annexes_factures`, `nb_factures_liees` are populated.

- [ ] **Step 2: Add MO/Mat/Frais breakdown display if missing**

The view already has `cout_main_oeuvre_total`, `total_materiaux`, `total_autres`. Verify these map to the UI cards.

- [ ] **Step 3: Commit**

---

### Task 10: Cross-module verification

- [ ] **Step 1: Create a chantier, add pointages, add depenses, create a facture linked to it**
- [ ] **Step 2: Verify RentabiliteChantier shows real costs**
- [ ] **Step 3: Verify ComptaBTP shows the chantier with correct MO/Mat/Frais**
- [ ] **Step 4: Verify Situations, DC4, Retenues show dropdown with real chantiers**
- [ ] **Step 5: TypeScript check: 0 errors**
- [ ] **Step 6: Run tests: all pass**
- [ ] **Step 7: Final commit + push**
