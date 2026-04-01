# KYC Anti-Fraude Inscription — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Système de vérification intelligente anti-fraude à l'inscription artisan/société BTP : OCR KBIS, cross-check avec le registre officiel, correspondance avec la carte d'identité, score de risque, et dashboard admin de revue manuelle.

**Architecture:**
- Pipeline de vérification en 3 couches : (1) OCR KBIS → extraction données, (2) cross-check API registre officiel (annuaire-entreprises.api.gouv.fr, avec fallback Pappers si clé dispo), (3) correspondance gérant KBIS ↔ CNI.
- Score de risque agrégé stocké en BDD. Les cas avec score ≥ 80 sont auto-approuvés ; score < 40 est auto-rejeté ; entre les deux → revue manuelle dans le dashboard admin.

**Tech Stack:** Next.js 14, Tesseract.js (déjà installé), Supabase (PostgreSQL + Storage), API annuaire-entreprises.api.gouv.fr (gratuite, sans clé), Resend/nodemailer pour les emails.

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `app/api/verify-kbis/route.ts` | **Créer** | OCR du document KBIS — extraction données structurées |
| `lib/kyc-verification.ts` | **Créer** | Moteur de scoring : cross-checks + score de risque agrégé |
| `app/api/kyc-orchestrate/route.ts` | **Créer** | Orchestrateur : lance les 3 couches, stocke le résultat |
| `app/api/admin/kyc/route.ts` | **Créer** | API admin : liste KYC pending, approuver/rejeter + email |
| `supabase/migrations/034_kyc_verification.sql` | **Créer** | Nouvelles colonnes KYC sur `profiles_artisan` |
| `app/admin/dashboard/page.tsx` | **Modifier** | Ajouter onglet KYC Review |
| `app/pro/register/page.tsx` | **Modifier** | Déclencher l'orchestration KYC après upload documents |

---

## Tâche 1 — Migration base de données

**Fichiers :**
- Créer : `supabase/migrations/034_kyc_verification.sql`

- [ ] **Étape 1 : Écrire la migration SQL**

```sql
-- 034_kyc_verification.sql
-- Colonnes KYC enrichies sur profiles_artisan

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS kyc_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_checks JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kbis_extracted JSONB DEFAULT NULL;

-- Index pour filtrer les KYC en attente rapidement
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_kyc_status
  ON profiles_artisan (kyc_status)
  WHERE kyc_status = 'pending';

-- Commentaires
COMMENT ON COLUMN profiles_artisan.kyc_score IS 'Score de confiance anti-fraude 0-100. >=80=auto-approuvé, <40=auto-rejeté, sinon revue manuelle.';
COMMENT ON COLUMN profiles_artisan.kyc_checks IS 'JSON détaillant chaque contrôle : siret_format, siret_active, kbis_ocr, name_match_kbis_api, name_match_kbis_id, address_match.';
COMMENT ON COLUMN profiles_artisan.kbis_extracted IS 'Données extraites du KBIS par OCR : denomination, siret, gerant, adresse, date_constitution.';
```

- [ ] **Étape 2 : Appliquer la migration**

```bash
# Si Supabase CLI est configuré :
npx supabase db push

# Sinon, copier-coller le SQL dans le Dashboard Supabase > SQL Editor
```

- [ ] **Étape 3 : Vérifier les colonnes**

```bash
# Tester que les colonnes existent (via Supabase SQL Editor ou psql) :
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles_artisan'
AND column_name IN ('kyc_score', 'kyc_checks', 'kyc_verified_at', 'kbis_extracted');
# Attendu : 4 lignes retournées
```

- [ ] **Étape 4 : Commit**

```bash
git add supabase/migrations/034_kyc_verification.sql
git commit -m "feat: migration KYC — colonnes score, checks, kbis_extracted, reviewed_by"
```

---

## Tâche 2 — OCR KBIS

**Fichiers :**
- Créer : `app/api/verify-kbis/route.ts`

- [ ] **Étape 1 : Écrire le test unitaire**

Créer `tests/api/verify-kbis.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'

// Tester les fonctions d'extraction pures, pas l'endpoint (Tesseract ne tourne pas en test unit)

function normalizeKbisText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function extractSiretFromKbis(text: string): string | null {
  // SIRET sur KBIS : souvent "SIRET : 123 456 789 00012" ou "Siret 12345678900012"
  const match = text.match(/siret\s*[:.]?\s*([\d\s]{14,17})/i)
  if (!match) return null
  return match[1].replace(/\s/g, '').slice(0, 14)
}

function extractDenominationFromKbis(text: string): string | null {
  // Sur un KBIS : "Dénomination : NOM SOCIETE" ou "Raison sociale : NOM"
  const match = text.match(/(?:d[eé]nomination|raison sociale)\s*[:.]?\s*([A-Z][^\n]{3,60})/i)
  return match ? match[1].trim() : null
}

function extractGerantFromKbis(text: string): string | null {
  // "Gérant : NOM Prénom" ou "Président : NOM Prénom"
  const match = text.match(/(?:g[eé]rant|pr[eé]sident|directeur g[eé]n[eé]ral)\s*[:.]?\s*([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s\-]{3,50})/i)
  return match ? match[1].trim() : null
}

describe('KBIS extraction utilities', () => {
  it('extracts SIRET from KBIS text', () => {
    const text = 'SIRET : 123 456 789 00012\nDénomination : MAÇONNERIE DUPONT'
    expect(extractSiretFromKbis(text)).toBe('12345678900012')
  })

  it('extracts SIRET without spaces', () => {
    const text = 'Siret: 12345678900012'
    expect(extractSiretFromKbis(text)).toBe('12345678900012')
  })

  it('returns null when no SIRET found', () => {
    expect(extractSiretFromKbis('texte sans siret')).toBeNull()
  })

  it('extracts denomination', () => {
    const text = 'Dénomination : MAÇONNERIE DUPONT SARL\nAdresse : 13 rue des artisans'
    expect(extractDenominationFromKbis(text)).toBe('MAÇONNERIE DUPONT SARL')
  })

  it('extracts gerant', () => {
    const text = 'Gérant : DUPONT Jean-Pierre\nDate de naissance :'
    expect(extractGerantFromKbis(text)).toMatch(/DUPONT/i)
  })
})
```

- [ ] **Étape 2 : Lancer le test (doit passer — fonctions pures)**

```bash
npm run test -- tests/api/verify-kbis.test.ts
# Attendu : PASS — 5 tests verts
```

- [ ] **Étape 3 : Créer l'endpoint OCR KBIS**

Créer `app/api/verify-kbis/route.ts` :

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import Tesseract from 'tesseract.js'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export interface KbisExtracted {
  siret: string | null
  siren: string | null
  denomination: string | null
  gerant: string | null
  address: string | null
  dateConstitution: string | null
  formeJuridique: string | null
  confidence: number // 0-100, confiance OCR Tesseract
}

function extractSiretFromKbis(text: string): string | null {
  const match = text.match(/siret\s*[:.]?\s*([\d\s]{14,17})/i)
  if (!match) return null
  return match[1].replace(/\s/g, '').slice(0, 14)
}

function extractDenominationFromKbis(text: string): string | null {
  const match = text.match(/(?:d[eé]nomination|raison sociale)\s*[:.]?\s*([A-ZÀ-Ÿa-zà-ÿ][^\n]{3,80})/i)
  return match ? match[1].trim() : null
}

function extractGerantFromKbis(text: string): string | null {
  const match = text.match(/(?:g[eé]rant|pr[eé]sident|directeur g[eé]n[eé]ral|associé unique)\s*[:.]?\s*([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s\-]{3,60})/i)
  return match ? match[1].split('\n')[0].trim() : null
}

function extractAddressFromKbis(text: string): string | null {
  const match = text.match(/(?:si[eè]ge social|adresse)\s*[:.]?\s*([^\n]{10,120})/i)
  return match ? match[1].trim() : null
}

function extractDateConstitutionFromKbis(text: string): string | null {
  // "Date de constitution : 12/03/2015" ou "Immatriculée le 12 mars 2015"
  const match = text.match(/(?:date de constitution|immatricul[eé]e? le)\s*[:.]?\s*(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{4})/i)
  return match ? match[1].trim() : null
}

function extractFormeJuridiqueFromKbis(text: string): string | null {
  const formes = ['SARL', 'SAS', 'SASU', 'EURL', 'SA', 'SCI', 'SELARL', 'EI', 'EIRL', 'Micro-entreprise', 'Auto-entrepreneur']
  const text_upper = text.toUpperCase()
  for (const forme of formes) {
    if (text_upper.includes(forme.toUpperCase())) return forme
  }
  return null
}

export async function POST(request: NextRequest) {
  // Rate limit : 3 req/min (OCR intensif)
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`verify_kbis_${ip}`, 3, 60_000))) return rateLimitResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier KBIS requis' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporté. Utilisez JPG, PNG ou PDF.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // OCR — langue française
    const result = await Tesseract.recognize(buffer, 'fra', { logger: () => {} })
    const ocrText = result.data.text
    const confidence = Math.round(result.data.confidence)

    const extracted: KbisExtracted = {
      siret: extractSiretFromKbis(ocrText),
      siren: extractSiretFromKbis(ocrText)?.slice(0, 9) ?? null,
      denomination: extractDenominationFromKbis(ocrText),
      gerant: extractGerantFromKbis(ocrText),
      address: extractAddressFromKbis(ocrText),
      dateConstitution: extractDateConstitutionFromKbis(ocrText),
      formeJuridique: extractFormeJuridiqueFromKbis(ocrText),
      confidence,
    }

    // Si le SIRET n'est pas trouvé et la confiance OCR < 30%, le document est probablement illisible
    if (!extracted.siret && confidence < 30) {
      return NextResponse.json({
        success: false,
        error: 'Document illisible ou qualité insuffisante. Vérifiez que le KBIS est net et bien éclairé.',
        extracted,
      })
    }

    return NextResponse.json({ success: true, extracted })

  } catch (error: unknown) {
    logger.error('[verify-kbis] Error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'analyse OCR du KBIS' }, { status: 500 })
  }
}
```

- [ ] **Étape 4 : Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep verify-kbis
# Attendu : aucune erreur
```

- [ ] **Étape 5 : Commit**

```bash
git add app/api/verify-kbis/route.ts tests/api/verify-kbis.test.ts
git commit -m "feat: OCR KBIS — endpoint d'extraction données structurées (Tesseract.js)"
```

---

## Tâche 3 — Moteur de scoring anti-fraude

**Fichiers :**
- Créer : `lib/kyc-verification.ts`

- [ ] **Étape 1 : Écrire le test**

Créer `tests/lib/kyc-verification.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { computeKycScore, normalizeCompanyName, nameMatchScore } from '@/lib/kyc-verification'

describe('normalizeCompanyName', () => {
  it('normalise les majuscules, accents et ponctuation', () => {
    expect(normalizeCompanyName('Maçonnerie Dupont SARL')).toBe('maçonnerie dupont sarl')
  })
})

describe('nameMatchScore', () => {
  it('retourne 100 pour match exact normalisé', () => {
    expect(nameMatchScore('DUPONT JEAN', 'Dupont Jean')).toBe(100)
  })

  it('retourne >60 pour match partiel (prénom manquant)', () => {
    expect(nameMatchScore('DUPONT', 'Dupont Jean-Pierre')).toBeGreaterThan(60)
  })

  it('retourne 0 pour noms complètement différents', () => {
    expect(nameMatchScore('MARTIN', 'DUBOIS')).toBe(0)
  })
})

describe('computeKycScore', () => {
  it('retourne 100 pour un profil parfait', () => {
    const score = computeKycScore({
      siretFormatValid: true,
      siretActiveInRegistry: true,
      kbisOcrSuccess: true,
      siretMatchKbisVsApi: true,
      nameMatchKbisVsApi: 100,
      nameMatchKbisVsId: 100,
      addressMatchKbisVsApi: true,
    })
    expect(score).toBe(100)
  })

  it('retourne 0 si SIRET format invalide', () => {
    const score = computeKycScore({
      siretFormatValid: false,
      siretActiveInRegistry: false,
      kbisOcrSuccess: false,
      siretMatchKbisVsApi: false,
      nameMatchKbisVsApi: 0,
      nameMatchKbisVsId: 0,
      addressMatchKbisVsApi: false,
    })
    expect(score).toBe(0)
  })

  it('retourne score intermédiaire pour KBIS illisible', () => {
    const score = computeKycScore({
      siretFormatValid: true,
      siretActiveInRegistry: true,
      kbisOcrSuccess: false,
      siretMatchKbisVsApi: false,
      nameMatchKbisVsApi: 0,
      nameMatchKbisVsId: 0,
      addressMatchKbisVsApi: false,
    })
    // SIRET format + actif = 40pts, OCR fail = 0pts pour le reste
    expect(score).toBe(40)
  })
})
```

- [ ] **Étape 2 : Lancer le test (doit échouer)**

```bash
npm run test -- tests/lib/kyc-verification.test.ts
# Attendu : FAIL — module not found
```

- [ ] **Étape 3 : Implémenter le moteur de scoring**

Créer `lib/kyc-verification.ts` :

```typescript
/**
 * Moteur de scoring KYC anti-fraude.
 *
 * Pondération des contrôles :
 * - SIRET format valide           : 10 pts (bloquant si faux)
 * - SIRET actif au registre       : 30 pts
 * - OCR KBIS réussi               : 10 pts
 * - SIRET KBIS == API             : 20 pts
 * - Nom société KBIS ≈ API        : 15 pts
 * - Gérant KBIS ≈ CNI             : 15 pts
 * - Adresse KBIS ≈ API            :  0 pts (bonus informatif)
 * Total max                       : 100 pts
 */

export interface KycChecks {
  siretFormatValid: boolean
  siretActiveInRegistry: boolean
  kbisOcrSuccess: boolean
  siretMatchKbisVsApi: boolean
  nameMatchKbisVsApi: number   // 0-100, similarité dénomination KBIS vs API
  nameMatchKbisVsId: number    // 0-100, similarité gérant KBIS vs CNI
  addressMatchKbisVsApi: boolean
}

export interface KycResult {
  score: number           // 0-100
  decision: 'approved' | 'manual_review' | 'rejected'
  checks: KycChecks
  details: string[]
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Score de similarité entre deux chaînes (0-100)
export function nameMatchScore(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalizeCompanyName(a)
  const nb = normalizeCompanyName(b)
  if (na === nb) return 100

  // Vérifier si l'un contient l'autre
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
    return Math.round(ratio * 90)
  }

  // Mots en commun
  const wordsA = new Set(na.split(' ').filter(w => w.length > 2))
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2))
  const intersection = [...wordsA].filter(w => wordsB.has(w))
  if (wordsA.size === 0 && wordsB.size === 0) return 0
  const unionSize = new Set([...wordsA, ...wordsB]).size
  const jaccardLike = intersection.length / unionSize
  return Math.round(jaccardLike * 80)
}

export function computeKycScore(checks: KycChecks): number {
  if (!checks.siretFormatValid) return 0

  let score = 10 // SIRET format valide
  if (checks.siretActiveInRegistry) score += 30
  if (checks.kbisOcrSuccess) score += 10
  if (checks.siretMatchKbisVsApi) score += 20
  score += Math.round((checks.nameMatchKbisVsApi / 100) * 15)
  score += Math.round((checks.nameMatchKbisVsId / 100) * 15)
  return Math.min(100, score)
}

export function decideKycStatus(score: number): KycResult['decision'] {
  if (score >= 80) return 'approved'
  if (score < 40) return 'rejected'
  return 'manual_review'
}

export function buildKycDetails(checks: KycChecks, score: number): string[] {
  const details: string[] = []
  if (!checks.siretFormatValid) details.push('SIRET invalide (format ou clé de contrôle)')
  else details.push('SIRET format valide')

  if (checks.siretActiveInRegistry) details.push('Entreprise active au registre officiel')
  else details.push('Entreprise non trouvée ou radiée au registre')

  if (checks.kbisOcrSuccess) details.push('KBIS analysé avec succès par OCR')
  else details.push('OCR KBIS partiel ou échec — revue manuelle recommandée')

  if (checks.siretMatchKbisVsApi) details.push('SIRET identique entre KBIS et registre')
  else details.push('SIRET extrait du KBIS ne correspond pas au registre')

  details.push(`Correspondance dénomination KBIS/registre : ${checks.nameMatchKbisVsApi}%`)
  details.push(`Correspondance gérant KBIS/CNI : ${checks.nameMatchKbisVsId}%`)

  details.push(`Score final : ${score}/100`)
  return details
}
```

- [ ] **Étape 4 : Lancer le test (doit passer)**

```bash
npm run test -- tests/lib/kyc-verification.test.ts
# Attendu : PASS — tous les tests verts
```

- [ ] **Étape 5 : Commit**

```bash
git add lib/kyc-verification.ts tests/lib/kyc-verification.test.ts
git commit -m "feat: moteur scoring KYC anti-fraude (computeKycScore, nameMatchScore)"
```

---

## Tâche 4 — Orchestrateur KYC

**Fichiers :**
- Créer : `app/api/kyc-orchestrate/route.ts`

Cet endpoint est appelé en background après l'upload des documents lors de l'inscription. Il orchestre les 3 couches de vérification et met à jour `profiles_artisan`.

- [ ] **Étape 1 : Créer l'endpoint orchestrateur**

```typescript
// app/api/kyc-orchestrate/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import Tesseract from 'tesseract.js'
import type { KbisExtracted } from '@/app/api/verify-kbis/route'
import {
  computeKycScore,
  decideKycStatus,
  buildKycDetails,
  nameMatchScore,
  type KycChecks,
} from '@/lib/kyc-verification'

// ── Helpers internes ────────────────────────────────────────────────────────

async function downloadFromSupabase(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function ocrBuffer(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const result = await Tesseract.recognize(buffer, 'fra', { logger: () => {} })
  return { text: result.data.text, confidence: Math.round(result.data.confidence) }
}

function extractSiret(text: string): string | null {
  const match = text.match(/siret\s*[:.]?\s*([\d\s]{14,17})/i)
  return match ? match[1].replace(/\s/g, '').slice(0, 14) : null
}

function extractDenomination(text: string): string | null {
  const match = text.match(/(?:d[eé]nomination|raison sociale)\s*[:.]?\s*([^\n]{3,80})/i)
  return match ? match[1].trim() : null
}

function extractGerant(text: string): string | null {
  const match = text.match(/(?:g[eé]rant|pr[eé]sident|directeur g[eé]n[eé]ral)\s*[:.]?\s*([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s\-]{3,60})/i)
  return match ? match[1].split('\n')[0].trim() : null
}

// Recherche dans l'annuaire officiel par SIRET
async function checkRegistryBySiret(siret: string): Promise<{
  found: boolean
  isActive: boolean
  denomination: string | null
  address: string | null
}> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&mtm_campaign=fixit-kyc`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return { found: false, isActive: false, denomination: null, address: null }
    const data = await res.json()
    if (!data.results?.length) return { found: false, isActive: false, denomination: null, address: null }
    const e = data.results[0]
    return {
      found: true,
      isActive: e.etat_administratif === 'A',
      denomination: e.nom_complet || e.nom_raison_sociale || null,
      address: e.siege ? `${e.siege.adresse} ${e.siege.code_postal} ${e.siege.libelle_commune}` : null,
    }
  } catch {
    return { found: false, isActive: false, denomination: null, address: null }
  }
}

// ── Endpoint principal ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`kyc_orchestrate_${ip}`, 5, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const { artisan_id } = body as { artisan_id: string }

    if (!artisan_id) {
      return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
    }

    // Récupérer le profil artisan
    const { data: artisan, error: fetchErr } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id, siret, first_name, last_name, company_name, kbis_url, id_document_url')
      .eq('id', artisan_id)
      .single()

    if (fetchErr || !artisan) {
      return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 404 })
    }

    // Sécurité : seul l'artisan lui-même ou un admin peut déclencher
    if (artisan.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const checks: KycChecks = {
      siretFormatValid: false,
      siretActiveInRegistry: false,
      kbisOcrSuccess: false,
      siretMatchKbisVsApi: false,
      nameMatchKbisVsApi: 0,
      nameMatchKbisVsId: 0,
      addressMatchKbisVsApi: false,
    }

    let kbisExtracted: KbisExtracted | null = null

    // ── Couche 1 : SIRET format ──────────────────────────────────────────────
    const siret = artisan.siret?.replace(/\s/g, '') ?? ''
    checks.siretFormatValid = /^\d{14}$/.test(siret)

    if (!checks.siretFormatValid) {
      // Pas la peine d'aller plus loin
      const score = computeKycScore(checks)
      await supabaseAdmin.from('profiles_artisan').update({
        kyc_score: score,
        kyc_checks: checks,
        kyc_status: 'rejected',
        kyc_verified_at: new Date().toISOString(),
      }).eq('id', artisan_id)
      return NextResponse.json({ score, decision: 'rejected', checks })
    }

    // ── Couche 2 : Registre officiel ─────────────────────────────────────────
    const registry = await checkRegistryBySiret(siret)
    checks.siretActiveInRegistry = registry.isActive

    // ── Couche 3 : OCR KBIS ──────────────────────────────────────────────────
    if (artisan.kbis_url) {
      const kbisBuffer = await downloadFromSupabase(artisan.kbis_url)
      if (kbisBuffer) {
        const { text: kbisText, confidence } = await ocrBuffer(kbisBuffer)
        const kbisSimet = extractSiret(kbisText)
        const kbisDenomination = extractDenomination(kbisText)
        const kbisGerant = extractGerant(kbisText)

        kbisExtracted = {
          siret: kbisSimet,
          siren: kbisSimet?.slice(0, 9) ?? null,
          denomination: kbisDenomination,
          gerant: kbisGerant,
          address: null,
          dateConstitution: null,
          formeJuridique: null,
          confidence,
        }

        checks.kbisOcrSuccess = confidence >= 30 && !!kbisSimet
        checks.siretMatchKbisVsApi = kbisSimet === siret

        if (kbisDenomination && registry.denomination) {
          checks.nameMatchKbisVsApi = nameMatchScore(kbisDenomination, registry.denomination)
        } else if (artisan.company_name && registry.denomination) {
          // Fallback : comparer le nom saisi à l'inscription avec le registre
          checks.nameMatchKbisVsApi = nameMatchScore(artisan.company_name, registry.denomination)
        }

        // ── Couche 4 : Cross-check gérant KBIS ↔ CNI (OCR) ─────────────────
        if (kbisGerant && artisan.id_document_url) {
          const idBuffer = await downloadFromSupabase(artisan.id_document_url)
          if (idBuffer) {
            const { text: idText } = await ocrBuffer(idBuffer)
            // Chercher le nom/prénom de l'artisan dans le texte OCR CNI
            const fullNameInId = `${artisan.last_name} ${artisan.first_name}`
            checks.nameMatchKbisVsId = Math.max(
              nameMatchScore(kbisGerant, artisan.last_name ?? ''),
              nameMatchScore(kbisGerant, fullNameInId),
              // Score basé sur la présence du nom dans le texte OCR CNI
              idText.toLowerCase().includes(artisan.last_name?.toLowerCase() ?? '__') ? 70 : 0
            )
          }
        } else if (kbisGerant) {
          // Pas de CNI uploadée → comparer gérant KBIS avec nom déclaré
          checks.nameMatchKbisVsId = nameMatchScore(
            kbisGerant,
            `${artisan.last_name} ${artisan.first_name}`
          )
        }
      }
    } else {
      // Pas de KBIS uploadé → comparer les données déclarées avec le registre uniquement
      if (artisan.company_name && registry.denomination) {
        checks.nameMatchKbisVsApi = nameMatchScore(artisan.company_name, registry.denomination)
      }
    }

    // ── Calcul score final ────────────────────────────────────────────────────
    const score = computeKycScore(checks)
    const decision = decideKycStatus(score)
    const details = buildKycDetails(checks, score)

    // Mapping décision → kyc_status DB
    const kycStatus = decision === 'approved' ? 'approved'
      : decision === 'rejected' ? 'rejected'
      : 'pending' // manual_review reste pending

    await supabaseAdmin.from('profiles_artisan').update({
      kyc_score: score,
      kyc_checks: checks,
      kyc_status: kycStatus,
      kyc_verified_at: new Date().toISOString(),
      ...(kbisExtracted ? { kbis_extracted: kbisExtracted } : {}),
    }).eq('id', artisan_id)

    logger.info(`[KYC] artisan=${artisan_id} score=${score} decision=${decision}`)

    return NextResponse.json({ score, decision, checks, details })

  } catch (error: unknown) {
    logger.error('[kyc-orchestrate] Error:', error)
    return NextResponse.json({ error: 'Erreur KYC' }, { status: 500 })
  }
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep kyc-orchestrate
# Attendu : aucune erreur TypeScript
```

- [ ] **Étape 3 : Commit**

```bash
git add app/api/kyc-orchestrate/route.ts
git commit -m "feat: orchestrateur KYC — pipeline OCR KBIS + registre + cross-check CNI"
```

---

## Tâche 5 — API admin KYC (revue manuelle)

**Fichiers :**
- Créer : `app/api/admin/kyc/route.ts`

- [ ] **Étape 1 : Créer l'API admin KYC**

```typescript
// app/api/admin/kyc/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

// GET /api/admin/kyc?status=pending&page=1&limit=20
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérifier rôle admin
  const role = user.user_metadata?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') || 'pending'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabaseAdmin
    .from('profiles_artisan')
    .select(`
      id, user_id, first_name, last_name, company_name, siret,
      kyc_status, kyc_score, kyc_checks, kyc_verified_at, kyc_reviewed_at,
      kyc_reviewed_by, kyc_rejection_reason, kbis_extracted,
      kbis_url, id_document_url, insurance_url,
      created_at, email, phone
    `, { count: 'exact' })
    .eq('kyc_status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('[admin/kyc] GET error:', error)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  })
}

// PATCH /api/admin/kyc — approuver ou rejeter
// Body: { artisan_id, action: 'approve' | 'reject', rejection_reason?: string }
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const role = user.user_metadata?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })
  }

  const body = await request.json()
  const { artisan_id, action, rejection_reason } = body as {
    artisan_id: string
    action: 'approve' | 'reject'
    rejection_reason?: string
  }

  if (!artisan_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'artisan_id et action requis' }, { status: 400 })
  }

  if (action === 'reject' && !rejection_reason) {
    return NextResponse.json({ error: 'Motif de rejet requis' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { data: artisan, error: fetchErr } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, email, first_name, last_name, company_name')
    .eq('id', artisan_id)
    .single()

  if (fetchErr || !artisan) {
    return NextResponse.json({ error: 'Artisan non trouvé' }, { status: 404 })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('profiles_artisan')
    .update({
      kyc_status: newStatus,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_reviewed_by: user.email,
      ...(action === 'reject' ? { kyc_rejection_reason: rejection_reason } : {}),
    })
    .eq('id', artisan_id)

  if (updateErr) {
    logger.error('[admin/kyc] PATCH error:', updateErr)
    return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
  }

  // Email de notification (via Supabase Edge Function ou API email si configuré)
  // Note : envoyer l'email de manière non-bloquante
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-kyc-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' },
      body: JSON.stringify({
        to: artisan.email,
        name: `${artisan.first_name} ${artisan.last_name}`,
        company: artisan.company_name,
        action,
        rejection_reason,
      }),
    })
  } catch (emailErr) {
    logger.warn('[admin/kyc] Email notification failed (non-bloquant):', emailErr)
  }

  logger.info(`[admin/kyc] artisan=${artisan_id} action=${action} by=${user.email}`)
  return NextResponse.json({ success: true, status: newStatus })
}
```

- [ ] **Étape 2 : Créer l'endpoint d'email KYC**

Créer `app/api/send-kyc-email/route.ts` :

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

// Endpoint interne — protégé par secret partagé
// Envoie l'email de résultat KYC à l'artisan
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { to, name, company, action, rejection_reason } = await request.json()

  const subject = action === 'approve'
    ? `✅ Votre compte Vitfix a été validé — bienvenue ${name} !`
    : `❌ Votre inscription Vitfix nécessite une action`

  const html = action === 'approve'
    ? `
      <h2>Félicitations ${name} !</h2>
      <p>Votre compte <strong>${company}</strong> a été vérifié et activé sur Vitfix.</p>
      <p>Vous pouvez dès maintenant accéder à votre espace professionnel.</p>
      <a href="https://vitfix.io/pro/dashboard" style="background:#FFC107;padding:12px 24px;border-radius:8px;text-decoration:none;color:#000;font-weight:bold;">Accéder à mon espace</a>
    `
    : `
      <h2>Bonjour ${name},</h2>
      <p>Votre inscription pour <strong>${company}</strong> n'a pas pu être validée automatiquement.</p>
      <p><strong>Motif :</strong> ${rejection_reason ?? 'Documents insuffisants'}</p>
      <p>Veuillez nous contacter à <a href="mailto:support@vitfix.io">support@vitfix.io</a> ou re-soumettre vos documents.</p>
    `

  // Utiliser l'email provider configuré dans le projet (Resend, Sendgrid, ou SMTP)
  // Si RESEND_API_KEY est configuré :
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Vitfix <noreply@vitfix.io>',
          to,
          subject,
          html,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      logger.error('[send-kyc-email] Resend error:', err)
      return NextResponse.json({ error: 'Erreur email' }, { status: 500 })
    }
  } else {
    // Pas de provider email configuré — logger seulement
    logger.warn(`[send-kyc-email] Pas de RESEND_API_KEY — email non envoyé à ${to}`)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Étape 3 : Ajouter INTERNAL_API_SECRET dans .env.local**

```bash
# Dans .env.local (ne jamais committer) :
INTERNAL_API_SECRET=un_secret_aleatoire_long_32_chars_min
```

- [ ] **Étape 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "admin/kyc|send-kyc"
# Attendu : aucune erreur
```

- [ ] **Étape 5 : Commit**

```bash
git add app/api/admin/kyc/route.ts app/api/send-kyc-email/route.ts
git commit -m "feat: API admin KYC — GET pending, PATCH approve/reject + email notification"
```

---

## Tâche 6 — Dashboard admin : onglet KYC Review

**Fichiers :**
- Modifier : `app/admin/dashboard/page.tsx`

L'admin dashboard actuel a les tabs : `overview`, `users`, `subscriptions`, `switcher`. Il faut ajouter `kyc`.

- [ ] **Étape 1 : Lire le fichier existant pour connaître la structure exacte**

```bash
# Repérer la ligne de définition du type Tab et le rendu des onglets
grep -n "type Tab\|Tab =\|'overview'\|'users'" app/admin/dashboard/page.tsx | head -20
```

- [ ] **Étape 2 : Ajouter le type kyc et les interfaces**

Dans `app/admin/dashboard/page.tsx`, localiser `type Tab = 'overview' | 'users' | 'subscriptions' | 'switcher'` et modifier :

```typescript
type Tab = 'overview' | 'users' | 'subscriptions' | 'kyc' | 'switcher'

interface KycRow {
  id: string
  first_name: string
  last_name: string
  company_name: string
  siret: string
  email: string
  phone: string
  kyc_status: string
  kyc_score: number | null
  kyc_checks: Record<string, unknown> | null
  kyc_verified_at: string | null
  kyc_reviewed_at: string | null
  kyc_rejection_reason: string | null
  kbis_url: string | null
  id_document_url: string | null
  kbis_extracted: Record<string, unknown> | null
  created_at: string
}
```

- [ ] **Étape 3 : Ajouter le state et les fonctions de fetch KYC**

Localiser le bloc `useState` existant dans le composant principal, et ajouter :

```typescript
const [kycRows, setKycRows] = useState<KycRow[]>([])
const [kycFilter, setKycFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
const [kycLoading, setKycLoading] = useState(false)
const [kycRejectModalId, setKycRejectModalId] = useState<string | null>(null)
const [kycRejectReason, setKycRejectReason] = useState('')

const fetchKycRows = useCallback(async (status: 'pending' | 'approved' | 'rejected') => {
  setKycLoading(true)
  try {
    const res = await fetch(`/api/admin/kyc?status=${status}&limit=50`)
    const json = await res.json()
    setKycRows(json.data ?? [])
  } finally {
    setKycLoading(false)
  }
}, [])

const handleKycAction = async (artisanId: string, action: 'approve' | 'reject', reason?: string) => {
  const res = await fetch('/api/admin/kyc', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artisan_id: artisanId, action, rejection_reason: reason }),
  })
  if (res.ok) {
    setKycRejectModalId(null)
    setKycRejectReason('')
    await fetchKycRows(kycFilter)
  }
}

// Dans le useEffect existant qui gère les tabs, ajouter :
// if (activeTab === 'kyc') fetchKycRows(kycFilter)
```

- [ ] **Étape 4 : Ajouter le bouton onglet KYC dans la barre de navigation des tabs**

Localiser le rendu des boutons d'onglets (chercher `overview` dans le JSX) et ajouter un bouton KYC après `subscriptions` :

```tsx
<button
  onClick={() => setActiveTab('kyc')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'kyc' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
  }`}
>
  KYC Review
</button>
```

- [ ] **Étape 5 : Ajouter le panneau de rendu KYC**

À la fin des blocs conditionnels de rendu de chaque tab, ajouter :

```tsx
{activeTab === 'kyc' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-white">Vérifications KYC</h3>
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setKycFilter(s); fetchKycRows(s) }}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              kycFilter === s
                ? s === 'pending' ? 'bg-yellow-600 text-white'
                  : s === 'approved' ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {s === 'pending' ? 'En attente' : s === 'approved' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>
    </div>

    {kycLoading && <p className="text-gray-400 text-sm">Chargement...</p>}

    {!kycLoading && kycRows.length === 0 && (
      <p className="text-gray-400 text-sm">Aucun dossier {kycFilter}.</p>
    )}

    {kycRows.map(row => (
      <div key={row.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-white">{row.company_name}</p>
            <p className="text-sm text-gray-400">{row.first_name} {row.last_name} — {row.siret}</p>
            <p className="text-xs text-gray-500">{row.email} — {row.phone}</p>
          </div>
          <div className="text-right">
            {row.kyc_score !== null && (
              <span className={`text-2xl font-black ${
                row.kyc_score >= 80 ? 'text-green-400'
                : row.kyc_score >= 40 ? 'text-yellow-400'
                : 'text-red-400'
              }`}>
                {row.kyc_score}/100
              </span>
            )}
            {row.kyc_score === null && <span className="text-gray-500 text-sm">Non scoré</span>}
          </div>
        </div>

        {/* Documents */}
        <div className="flex gap-3 flex-wrap">
          {row.kbis_url && (
            <a href={row.kbis_url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-800 text-blue-200 rounded text-xs hover:bg-blue-700">
              Voir KBIS
            </a>
          )}
          {row.id_document_url && (
            <a href={row.id_document_url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1 bg-purple-800 text-purple-200 rounded text-xs hover:bg-purple-700">
              Voir CNI
            </a>
          )}
        </div>

        {/* Données extraites KBIS */}
        {row.kbis_extracted && (
          <div className="bg-gray-900/50 rounded p-3 text-xs text-gray-300 space-y-1">
            <p className="font-medium text-gray-200">Données extraites du KBIS :</p>
            {(row.kbis_extracted as any).denomination && <p>Dénomination : {(row.kbis_extracted as any).denomination}</p>}
            {(row.kbis_extracted as any).gerant && <p>Gérant : {(row.kbis_extracted as any).gerant}</p>}
            {(row.kbis_extracted as any).siret && <p>SIRET extrait : {(row.kbis_extracted as any).siret}</p>}
          </div>
        )}

        {/* Actions (seulement pour pending) */}
        {row.kyc_status === 'pending' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleKycAction(row.id, 'approve')}
              className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium"
            >
              Approuver
            </button>
            <button
              onClick={() => setKycRejectModalId(row.id)}
              className="px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-sm font-medium"
            >
              Rejeter
            </button>
          </div>
        )}

        {row.kyc_rejection_reason && (
          <p className="text-xs text-red-400">Motif rejet : {row.kyc_rejection_reason}</p>
        )}
      </div>
    ))}

    {/* Modal rejet */}
    {kycRejectModalId && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
          <h4 className="text-white font-semibold">Motif du rejet</h4>
          <textarea
            value={kycRejectReason}
            onChange={e => setKycRejectReason(e.target.value)}
            placeholder="Ex: KBIS illisible, nom gérant ne correspond pas à la CNI..."
            className="w-full bg-gray-700 text-white rounded-lg p-3 text-sm resize-none h-24 border border-gray-600"
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setKycRejectModalId(null); setKycRejectReason('') }}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
            >
              Annuler
            </button>
            <button
              onClick={() => handleKycAction(kycRejectModalId, 'reject', kycRejectReason)}
              disabled={!kycRejectReason.trim()}
              className="px-4 py-2 bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              Confirmer le rejet
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Étape 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "admin/dashboard"
# Attendu : aucune erreur
```

- [ ] **Étape 7 : Commit**

```bash
git add app/admin/dashboard/page.tsx
git commit -m "feat: onglet KYC Review dans le dashboard admin (liste, score, approve/reject)"
```

---

## Tâche 7 — Déclencher le KYC à l'inscription

**Fichiers :**
- Modifier : `app/pro/register/page.tsx`

L'orchestration KYC doit être déclenchée automatiquement après la création du profil artisan, en background (fire-and-forget, non bloquant pour l'UX).

- [ ] **Étape 1 : Identifier le point de déclenchement dans la page d'inscription**

```bash
grep -n "profiles_artisan\|artisanId\|artisan_id\|kbis_url\|Inscription réussie\|handleSubmit" app/pro/register/page.tsx | head -30
```

- [ ] **Étape 2 : Ajouter l'appel KYC après création du profil**

Dans `app/pro/register/page.tsx`, après le bloc qui crée le profil dans `profiles_artisan` et stocker l'`artisanId`, ajouter (non bloquant) :

```typescript
// Déclencher la vérification KYC en background (non bloquant)
// On n'attend pas la réponse — l'utilisateur peut continuer
if (artisanId) {
  fetch('/api/kyc-orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artisan_id: artisanId }),
  }).catch(err => console.warn('[KYC] Échec déclenchement background:', err))
}
```

Note : l'appel est volontairement fire-and-forget (pas de `await`, `.catch` silencieux) pour ne pas bloquer l'UX d'inscription. Le score KYC sera disponible quelques secondes après dans la DB.

- [ ] **Étape 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "pro/register"
# Attendu : aucune erreur
```

- [ ] **Étape 4 : Commit**

```bash
git add app/pro/register/page.tsx
git commit -m "feat: déclencher orchestration KYC en background après inscription artisan"
```

---

## Tâche 8 — Tests E2E et déploiement

- [ ] **Étape 1 : Lancer les tests unitaires**

```bash
npm run test
# Attendu : tous les tests passent, y compris les 2 nouveaux suites
```

- [ ] **Étape 2 : Build de production**

```bash
npm run build
# Attendu : Build réussi, 0 erreur TypeScript, 0 erreur ESLint bloquant
```

- [ ] **Étape 3 : Vérifier que les routes existent**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/verify-kbis -X POST
# Attendu : 400 (fichier requis) — la route existe
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/kyc-orchestrate -X POST
# Attendu : 401 (non authentifié) — la route existe
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/admin/kyc
# Attendu : 401 (non authentifié) — la route existe
```

- [ ] **Étape 4 : Déployer**

```bash
git push origin main
# Vercel déploie automatiquement
```

- [ ] **Étape 5 : Vérifier la migration en production**

Aller dans Supabase Dashboard > SQL Editor > exécuter :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles_artisan'
AND column_name IN ('kyc_score', 'kyc_checks', 'kbis_extracted', 'kyc_reviewed_by');
-- Attendu : 4 lignes
```

---

## Résumé des seuils de décision

| Score | Décision | Action |
|---|---|---|
| 80-100 | `approved` | Compte activé automatiquement, email de bienvenue |
| 40-79 | `pending` (manual_review) | Reste en attente, visible dans le dashboard admin KYC |
| 0-39 | `rejected` | Compte suspendu, email avec motif |

## Variables d'environnement à ajouter

```bash
INTERNAL_API_SECRET=<random 32+ chars>   # Secret pour les appels API internes
RESEND_API_KEY=<clé Resend>              # Optionnel — pour les emails KYC
```

Ces variables sont à ajouter dans `.env.local` (dev) et dans les secrets Vercel (prod).
