# Spécialités Granulaires BTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux sociétés BTP et artisans multi-métiers d'être trouvables par chaque spécialité (ferronnerie, façadier, maçon…) via un modèle M:N indexé avec source de vérification.

**Architecture:** Nouvelle table `specialties` (catalogue master BTP) + table pivot `profile_specialties` (M:N entre user_id et specialty_id, avec `verified_source`). L'inscription enregistre les spécialités choisies dans ce pivot. Un endpoint de recherche retourne tous les profils ayant une spécialité donnée.

**Tech Stack:** PostgreSQL (Supabase), Next.js App Router, TypeScript, React, Tailwind CSS

---

## File Map

| Action | Fichier | Rôle |
|--------|---------|------|
| Créer | `supabase/migrations/035_specialties.sql` | Tables specialties + profile_specialties + seed + index |
| Créer | `app/api/specialties/route.ts` | GET /api/specialties — liste publique des spécialités |
| Créer | `app/api/profile/specialties/route.ts` | POST — enregistre les spécialités d'un profil |
| Créer | `app/api/companies/search/route.ts` | GET /api/companies/search?specialty=ferronnerie |
| Modifier | `app/pro/register/page.tsx` | Appel POST /api/profile/specialties après inscription réussie (artisan + societe_btp) |
| Créer | `tests/api/specialties.test.ts` | Tests Vitest pour les 3 endpoints |

---

## Task 1: DB Migration — specialties + profile_specialties

**Files:**
- Create: `supabase/migrations/035_specialties.sql`

- [ ] **Step 1: Write the failing test (schema check)**

Créer `tests/api/specialties.test.ts` avec un premier test qui vérifie que les tables existent :

```typescript
// tests/api/specialties.test.ts
import { describe, it, expect } from 'vitest'

// Ces tests vérifient la structure de l'API, pas la DB directement.
// Ils seront complétés au fur et à mesure des tâches.
describe('specialties API', () => {
  it('placeholder — will be replaced in later tasks', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/elgato_fofo/Desktop/fixit-production
npm run test -- tests/api/specialties.test.ts
```

Expected: PASS (placeholder)

- [ ] **Step 3: Write the migration SQL**

Créer `supabase/migrations/035_specialties.sql` :

```sql
-- ============================================================
-- 035 — Modèle Spécialités granulaires BTP
-- ============================================================

-- ── 1. Table master des spécialités ──────────────────────────
CREATE TABLE IF NOT EXISTS specialties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,           -- ex: 'ferronnerie', 'facadier'
  label_fr    TEXT NOT NULL,                  -- ex: 'Ferronnerie / Métallerie'
  label_pt    TEXT,                           -- ex: 'Serralharia / Metalurgia'
  code_ape     TEXT,                          -- Code NAF/APE principal associé (nullable)
  applies_to  TEXT NOT NULL DEFAULT 'both',   -- 'artisan' | 'societe_btp' | 'both'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Pivot profiles ↔ spécialités ──────────────────────────
CREATE TABLE IF NOT EXISTS profile_specialties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id    UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  verified_source TEXT NOT NULL DEFAULT 'self_declared',
  -- 'kbis' | 'pappers' | 'self_declared'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, specialty_id)
);

-- ── 3. Index pour la recherche par spécialité ────────────────
CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty
  ON profile_specialties(specialty_id);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_user
  ON profile_specialties(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_source
  ON profile_specialties(verified_source);

-- ── 4. RLS ───────────────────────────────────────────────────
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_specialties ENABLE ROW LEVEL SECURITY;

-- Lecture publique des spécialités (catalogue)
CREATE POLICY "specialties_public_read"
  ON specialties FOR SELECT USING (true);

-- Un utilisateur peut lire ses propres spécialités
CREATE POLICY "profile_specialties_own_read"
  ON profile_specialties FOR SELECT
  USING (auth.uid() = user_id);

-- Lecture publique des spécialités de profil (pour la recherche)
CREATE POLICY "profile_specialties_public_read"
  ON profile_specialties FOR SELECT USING (true);

-- Insert/update uniquement par le service admin ou l'utilisateur lui-même
CREATE POLICY "profile_specialties_own_insert"
  ON profile_specialties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Seed — catalogue master des spécialités BTP ───────────
INSERT INTO specialties (slug, label_fr, label_pt, code_ape, applies_to, sort_order) VALUES
  ('gros-oeuvre',          'Gros-œuvre / Maçonnerie',           'Alvenaria / Obra bruta',           '4312A', 'both',        1),
  ('facadier',             'Façadier / Ravalement',              'Fachadas / Reboco',                 '4391A', 'both',        2),
  ('ferronnerie',          'Ferronnerie / Métallerie',           'Serralharia / Metalurgia',          '4399C', 'both',        3),
  ('charpente',            'Charpente (bois/métal)',             'Carpintaria estrutural',            '4399A', 'both',        4),
  ('couverture',           'Couverture / Zinguerie',             'Coberturas / Telhados',             '4391A', 'both',        5),
  ('etancheite',           'Étanchéité',                         'Impermeabilização',                 '4391B', 'both',        6),
  ('isolation',            'Isolation thermique / acoustique',   'Isolamento térmico / acústico',     '4329A', 'both',        7),
  ('platrerie',            'Plâtrerie / Staff',                  'Estuques / Gesso',                  '4331Z', 'both',        8),
  ('carrelage',            'Carrelage / Faïence',                'Azulejos / Pavimentos',             '4333Z', 'both',        9),
  ('peinture',             'Peinture intérieure/extérieure',     'Pintura',                           '4334Z', 'both',       10),
  ('menuiserie-bois',      'Menuiserie bois',                    'Carpintaria madeira',               '4332A', 'both',       11),
  ('menuiserie-alu-pvc',   'Menuiserie alu/PVC',                 'Caixilharia alu/PVC',              '4332A', 'both',       12),
  ('serrurerie',           'Serrurerie / Sécurité',              'Serralharia / Segurança',           '4399C', 'artisan',    13),
  ('electricite',          'Électricité',                        'Eletricidade',                      '4321A', 'both',       14),
  ('plomberie',            'Plomberie / Sanitaire',              'Canalização / Sanitários',          '4322A', 'both',       15),
  ('chauffage',            'Chauffage / Climatisation',          'Aquecimento / Climatização',        '4322B', 'both',       16),
  ('vrd',                  'VRD / Terrassement',                 'VRD / Terraplenagem',               '4312B', 'societe_btp', 17),
  ('demolition',           'Démolition',                         'Demolição',                         '4311Z', 'societe_btp', 18),
  ('paysagisme',           'Paysagisme / Espaces verts',         'Paisagismo / Espaços verdes',       '8130Z', 'both',       19),
  ('renovation-generale',  'Rénovation générale / TCE',          'Remodelação geral',                 '4120A', 'both',       20),
  ('nettoyage',            'Nettoyage industriel',               'Limpeza industrial',                '8122Z', 'both',       21),
  ('debouchage',           'Débouchage / Assainissement',        'Desentupimento / Saneamento',       '4322A', 'artisan',    22),
  ('piscine',              'Piscine / Spa',                      'Piscinas / Spa',                    '4329B', 'artisan',    23),
  ('espaces-verts',        'Espaces verts / Jardinage',          'Jardinagem',                        '8130Z', 'artisan',    24),
  ('ramonage',             'Ramonage / Entretien',               'Limpeza de chaminés',               '8122Z', 'artisan',    25),
  ('demenagement',         'Déménagement',                       'Mudanças',                          '4942Z', 'artisan',    26)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 4: Appliquer la migration en local**

```bash
# Option A — Supabase CLI local
cd /Users/elgato_fofo/Desktop/fixit-production
npx supabase db push

# Option B — Supabase Studio (copier-coller le SQL dans l'éditeur SQL)
# URL : https://supabase.com/dashboard/project/<project-id>/sql
```

Expected: Tables créées sans erreur.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/035_specialties.sql tests/api/specialties.test.ts
git commit -m "feat: migration 035 — specialties master table + profile_specialties pivot"
```

---

## Task 2: GET /api/specialties — liste publique

**Files:**
- Create: `app/api/specialties/route.ts`

- [ ] **Step 1: Write the failing test**

Remplacer le placeholder dans `tests/api/specialties.test.ts` :

```typescript
// tests/api/specialties.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase admin
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        { id: 'uuid-1', slug: 'ferronnerie', label_fr: 'Ferronnerie / Métallerie', applies_to: 'both', sort_order: 3 },
        { id: 'uuid-2', slug: 'facadier',    label_fr: 'Façadier / Ravalement',    applies_to: 'both', sort_order: 2 },
      ],
      error: null,
    }),
  },
}))

describe('GET /api/specialties', () => {
  it('returns all specialties', async () => {
    // Import après le mock
    const { GET } = await import('@/app/api/specialties/route')
    const req = new Request('http://localhost/api/specialties')
    const res = await GET(req as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.specialties).toHaveLength(2)
    expect(json.specialties[0].slug).toBe('ferronnerie')
  })

  it('filters by applies_to=artisan', async () => {
    const { GET } = await import('@/app/api/specialties/route')
    const req = new Request('http://localhost/api/specialties?applies_to=artisan')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/specialties/route'"

- [ ] **Step 3: Implement the endpoint**

Créer `app/api/specialties/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const appliesTo = searchParams.get('applies_to') // 'artisan' | 'societe_btp' | null

  let query = supabaseAdmin
    .from('specialties')
    .select('id, slug, label_fr, label_pt, code_ape, applies_to, sort_order')
    .order('sort_order', { ascending: true })

  if (appliesTo === 'artisan') {
    query = query.in('applies_to', ['artisan', 'both'])
  } else if (appliesTo === 'societe_btp') {
    query = query.in('applies_to', ['societe_btp', 'both'])
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to load specialties' }, { status: 500 })
  }

  return NextResponse.json(
    { specialties: data ?? [] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/specialties/route.ts tests/api/specialties.test.ts
git commit -m "feat: GET /api/specialties — liste publique des spécialités BTP"
```

---

## Task 3: POST /api/profile/specialties — enregistrement après inscription

**Files:**
- Create: `app/api/profile/specialties/route.ts`

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/api/specialties.test.ts` :

```typescript
// Ajouter après les tests existants

// Mock pour le POST
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('POST /api/profile/specialties', () => {
  it('saves specialties for a user', async () => {
    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'user-uuid-123',
        slugs: ['ferronnerie', 'facadier'],
        verified_source: 'kbis',
      }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 400 when user_id missing', async () => {
    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: ['ferronnerie'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/profile/specialties/route'"

- [ ] **Step 3: Implement the endpoint**

Créer `app/api/profile/specialties/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.user_id || !Array.isArray(body.slugs) || body.slugs.length === 0) {
    return NextResponse.json({ error: 'user_id and slugs are required' }, { status: 400 })
  }

  const { user_id, slugs, verified_source = 'self_declared' } = body as {
    user_id: string
    slugs: string[]
    verified_source?: 'kbis' | 'pappers' | 'self_declared'
  }

  // Résoudre les slugs → UUIDs
  const { data: specialties, error: fetchError } = await supabaseAdmin
    .from('specialties')
    .select('id, slug')
    .in('slug', slugs)

  if (fetchError || !specialties?.length) {
    return NextResponse.json({ error: 'No matching specialties found' }, { status: 400 })
  }

  const rows = specialties.map(s => ({
    user_id,
    specialty_id: s.id,
    verified_source,
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('profile_specialties')
    .upsert(rows, { onConflict: 'user_id,specialty_id' })

  if (upsertError) {
    console.error('[profile/specialties/POST]', upsertError)
    return NextResponse.json({ error: 'Failed to save specialties' }, { status: 500 })
  }

  return NextResponse.json({ success: true, saved: specialties.length })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/profile/specialties/route.ts tests/api/specialties.test.ts
git commit -m "feat: POST /api/profile/specialties — enregistrement spécialités profil"
```

---

## Task 4: GET /api/companies/search — recherche par spécialité

**Files:**
- Create: `app/api/companies/search/route.ts`

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/api/specialties.test.ts` :

```typescript
describe('GET /api/companies/search', () => {
  it('returns profiles matching a specialty slug', async () => {
    const { GET } = await import('@/app/api/companies/search/route')
    const req = new Request('http://localhost/api/companies/search?specialty=ferronnerie&limit=5')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.results)).toBe(true)
  })

  it('returns 400 when specialty missing', async () => {
    const { GET } = await import('@/app/api/companies/search/route')
    const req = new Request('http://localhost/api/companies/search')
    const res = await GET(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/companies/search/route'"

- [ ] **Step 3: Implement the search endpoint**

Créer `app/api/companies/search/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const specialty = searchParams.get('specialty')
  const verifiedSource = searchParams.get('verified_source') // 'kbis' | 'pappers' | null = tous
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const city = searchParams.get('city') // filtre optionnel par ville

  if (!specialty) {
    return NextResponse.json({ error: 'specialty parameter is required' }, { status: 400 })
  }

  // 1. Résoudre le slug → specialty_id
  const { data: spec } = await supabaseAdmin
    .from('specialties')
    .select('id, label_fr')
    .eq('slug', specialty)
    .single()

  if (!spec) {
    return NextResponse.json({ error: `Unknown specialty: ${specialty}` }, { status: 404 })
  }

  // 2. Trouver les user_ids ayant cette spécialité
  let pivotQuery = supabaseAdmin
    .from('profile_specialties')
    .select('user_id, verified_source')
    .eq('specialty_id', spec.id)

  if (verifiedSource) {
    pivotQuery = pivotQuery.eq('verified_source', verifiedSource)
  }

  const { data: pivotRows, error: pivotError } = await pivotQuery
  if (pivotError) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  if (!pivotRows?.length) {
    return NextResponse.json({ results: [], specialty: spec.label_fr })
  }

  const userIds = pivotRows.map(r => r.user_id)
  const verifiedSourceMap = Object.fromEntries(pivotRows.map(r => [r.user_id, r.verified_source]))

  // 3. Récupérer les profils artisans
  let artisanQuery = supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, company_name, first_name, last_name, email, phone, company_city, naf_code, naf_label, verified, kyc_status, categories')
    .in('user_id', userIds)
    .eq('kyc_status', 'approved')
    .limit(limit)

  if (city) {
    artisanQuery = artisanQuery.ilike('company_city', `%${city}%`)
  }

  const { data: artisans } = await artisanQuery

  // 4. Agréger avec verified_source depuis le pivot
  const results = (artisans ?? []).map(a => ({
    ...a,
    verified_source: verifiedSourceMap[a.user_id] ?? 'self_declared',
    profile_type: 'artisan',
  }))

  return NextResponse.json(
    {
      results,
      specialty: spec.label_fr,
      total: results.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/api/specialties.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/companies/search/route.ts tests/api/specialties.test.ts
git commit -m "feat: GET /api/companies/search?specialty=ferronnerie — recherche par spécialité"
```

---

## Task 5: Mapping secteurs → slugs + save après inscription artisan

**Files:**
- Modify: `app/pro/register/page.tsx`

Contexte : `FormulaireArtisan` a déjà `selectedCategories: string[]` (slugs artisan). Il faut mapper ces slugs vers les slugs de la table `specialties` et appeler `POST /api/profile/specialties` après l'inscription.

- [ ] **Step 1: Ajouter le mapping et l'appel dans handleRegister**

Dans `app/pro/register/page.tsx`, localiser la fonction `handleRegister` de `FormulaireArtisan` (ligne ~309). Après le bloc `await Promise.all([...])` (upload documents, ligne ~334), ajouter l'appel aux spécialités.

Chercher ce bloc exact dans la fonction `handleRegister` de `FormulaireArtisan` :

```typescript
        await Promise.all([
            kbisFile ? uploadDocument(kbisFile, 'kbis', profileData.id, 'kbis_url') : Promise.resolve(),
            idFile ? uploadDocument(idFile, 'identity', profileData.id, 'id_document_url') : Promise.resolve(),
            insuranceFile ? uploadDocument(insuranceFile, 'insurance', profileData.id, 'insurance_url') : Promise.resolve(),
          ])

          // ── Motifs par défaut : insérer selon le métier (silencieux, non-bloquant) ──
          try {
            await fetch('/api/seed-motifs', {
```

Le remplacer par :

```typescript
        await Promise.all([
            kbisFile ? uploadDocument(kbisFile, 'kbis', profileData.id, 'kbis_url') : Promise.resolve(),
            idFile ? uploadDocument(idFile, 'identity', profileData.id, 'id_document_url') : Promise.resolve(),
            insuranceFile ? uploadDocument(insuranceFile, 'insurance', profileData.id, 'insurance_url') : Promise.resolve(),
          ])

          // ── Spécialités granulaires BTP ──────────────────────────────────────────
          try {
            await fetch('/api/profile/specialties', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: authData.user.id,
                slugs: selectedCategories,
                verified_source: kbisFile ? 'kbis' : 'self_declared',
              }),
            })
          } catch { /* non-bloquant */ }

          // ── Motifs par défaut : insérer selon le métier (silencieux, non-bloquant) ──
          try {
            await fetch('/api/seed-motifs', {
```

- [ ] **Step 2: Vérifier que le build TypeScript passe**

```bash
cd /Users/elgato_fofo/Desktop/fixit-production
npx tsc --noEmit
```

Expected: 0 erreurs

- [ ] **Step 3: Commit**

```bash
git add app/pro/register/page.tsx
git commit -m "feat: enregistrement spécialités artisan après inscription"
```

---

## Task 6: Mapping secteurs BTP → slugs + save après inscription societe_btp

**Files:**
- Modify: `app/pro/register/page.tsx`

Contexte : `FormulaireProGenerique` utilise `form.secteurs: string[]` avec des labels textuels comme "Gros-œuvre", "Métallerie". Il faut mapper ces labels vers les slugs de `specialties` et appeler `POST /api/profile/specialties` après inscription.

- [ ] **Step 1: Ajouter la constante de mapping en tête du fichier**

Dans `app/pro/register/page.tsx`, après la ligne 12 (après la définition de `type SiretStatus`), ajouter :

```typescript
// ─── Mapping secteur BTP label → specialty slug ───────────────────────────────
const SECTEUR_TO_SLUG: Record<string, string> = {
  // Clés = valeurs i18n de register.sectorBtp* (en français courant)
  'Gros-œuvre':             'gros-oeuvre',
  'Élec. / Plomb.':         'electricite',
  'Électricité / Plomberie':'electricite',
  'Peinture':               'peinture',
  'Menuiserie':             'menuiserie-bois',
  'CVC':                    'chauffage',
  'Toiture':                'couverture',
  'Métallerie':             'ferronnerie',
  'Générale / TCE':         'renovation-generale',
  'Bureau d\'études':       'renovation-generale',
  'Autre':                  'renovation-generale',
}

function secteursToSlugs(secteurs: string[]): string[] {
  return secteurs
    .map(s => SECTEUR_TO_SLUG[s] ?? s.toLowerCase().replace(/[\s/().'']/g, '-').replace(/-+/g, '-'))
    .filter(Boolean)
}
```

- [ ] **Step 2: Appeler POST /api/profile/specialties dans handleSubmit de FormulaireProGenerique**

Localiser la fonction `handleSubmit` dans `FormulaireProGenerique` (vers ligne 730). Chercher le bloc de fin juste avant `setSuccess(true)` :

```typescript
      setSuccess(true)
    } catch {
      setError(t('register.genericError'))
```

Ajouter l'appel avant `setSuccess(true)` :

```typescript
      // ── Spécialités granulaires BTP (non-bloquant) ─────────────────────────
      if (orgType === 'societe_btp') {
        try {
          await fetch('/api/profile/specialties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: authData.user.id,
              slugs: secteursToSlugs(form.secteurs),
              verified_source: kbisFile ? 'kbis' : 'self_declared',
            }),
          })
        } catch { /* non-bloquant */ }
      }

      setSuccess(true)
    } catch {
      setError(t('register.genericError'))
```

- [ ] **Step 3: Vérifier le build TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erreurs

- [ ] **Step 4: Run tous les tests**

```bash
npm run test
```

Expected: PASS (tous les tests existants + 6 nouveaux)

- [ ] **Step 5: Commit**

```bash
git add app/pro/register/page.tsx
git commit -m "feat: mapping secteurs BTP → slugs spécialités + enregistrement societe_btp"
```

---

## Task 7: Déploiement

- [ ] **Step 1: Push vers production**

```bash
git push origin main
```

Vercel déploie automatiquement. La migration DB (035_specialties.sql) doit être appliquée manuellement en production via Supabase Dashboard → SQL Editor.

- [ ] **Step 2: Appliquer la migration en production**

1. Aller sur https://supabase.com/dashboard/project/\<project-id\>/sql
2. Copier-coller le contenu de `supabase/migrations/035_specialties.sql`
3. Exécuter

Expected: "Success. No rows returned"

- [ ] **Step 3: Vérifier les endpoints en production**

```bash
# Tester le catalogue des spécialités
curl https://vitfix.io/api/specialties | jq '.specialties | length'
# Expected: 26

# Tester la recherche (aucun résultat si pas encore de profils)
curl "https://vitfix.io/api/companies/search?specialty=ferronnerie" | jq '.specialty'
# Expected: "Ferronnerie / Métallerie"
```

- [ ] **Step 4: Commit final**

```bash
git tag v1.0.0-specialties
```

---

## Self-Review — Spec Coverage

| Requirement | Task |
|-------------|------|
| Table `specialties` (id, code_ape, label) | Task 1 |
| Relation M:N `company_specialties` / `profile_specialties` | Task 1 |
| `verified_source` (Kbis, Pappers, auto-déclaration) | Tasks 1, 3 |
| Multi-select spécialités à l'inscription (artisan) | Task 5 |
| Multi-select spécialités à l'inscription (societe_btp) | Task 6 |
| Index par spécialité | Task 1 |
| `GET /companies?speciality=ferronnerie` | Task 4 |
| Filtre `verified_source` dans la recherche | Task 4 |
| Même logique artisan + societe_btp | Tasks 5, 6 |
| Validation via Kbis (source = 'kbis' si doc uploadé) | Tasks 5, 6 |
| Tests | Tasks 2, 3, 4 |
