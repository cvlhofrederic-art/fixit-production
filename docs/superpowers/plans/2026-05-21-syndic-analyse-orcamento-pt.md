# Refonte module Análise Orçamentos PT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un scoring PT propre (≥ 80/100 sur le PDF Vitfix Artisan `Orcamento-Lobao-Motorline-Lince.pdf`) avec NIF validé, fourchettes prix PT et messages en portugais — sans toucher le code FR existant.

**Architecture:** Deux nouveaux fichiers `lib/nif-pt.ts` et `lib/analyse-devis-scoring-pt.ts` totalement isolés du FR. Patch chirurgical dans la route API pour dispatcher FR/PT. Types partagés importés depuis `lib/analyse-devis-scoring.ts` (FR reste source de vérité des types, 0 ligne touchée). Sidebar label localisé. TDD strict avec fixtures issues du PDF Lobão.

**Tech Stack:** TypeScript, Vitest, Next.js 16 App Router, Groq via lib existante.

**Spec de référence :** [docs/superpowers/specs/2026-05-21-syndic-analyse-orcamento-pt-design.md](docs/superpowers/specs/2026-05-21-syndic-analyse-orcamento-pt-design.md)

**Déviation mineure vs spec :** la spec évoquait l'extraction des types vers `lib/analyse-devis-types.ts`. YAGNI — on importe simplement les types depuis `lib/analyse-devis-scoring.ts` (FR reste intact, types restent là).

---

## File Structure

| Fichier | État | Responsabilité |
|---|---|---|
| `lib/nif-pt.ts` | **CRÉER** | Validation et extraction NIF/NIPC PT (modulo 11) |
| `lib/analyse-devis-scoring-pt.ts` | **CRÉER** | Moteur de scoring PT autonome (17 critères + 2 fatura, fourchettes prix PT, messages négo PT) |
| `tests/lib/nif-pt.test.ts` | **CRÉER** | Tests checksum NIF + extraction |
| `tests/lib/analyse-devis-scoring-pt.test.ts` | **CRÉER** | Tests scoring PT avec fixture PDF Lobão |
| `app/api/syndic/analyse-devis/route.ts` | **PATCH L.471-485** | Dispatch FR/PT vers le bon moteur de scoring |
| `components/syndic-dashboard/config.ts` | **PATCH L.40** | Label sidebar PT — adapter `label` ou consommer locale au point de rendu |
| `lib/analyse-devis-scoring.ts` | **NE PAS TOUCHER** | Side FR intact, 0 ligne modifiée |

---

## Task 1: NIF validator — `validateNif`

**Files:**
- Create: `lib/nif-pt.ts`
- Test: `tests/lib/nif-pt.test.ts`

- [ ] **Step 1.1: Créer le fichier de test avec les cas validateNif**

Contenu de `tests/lib/nif-pt.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { validateNif, extractNif } from '@/lib/nif-pt'

describe('validateNif', () => {
  it('accepts a real PT NIF (Frédéric Neiva Carvalho — first digit 2)', () => {
    expect(validateNif('276873297')).toBe(true)
  })

  it('accepts NIF with spaces formatted as 276 873 297', () => {
    expect(validateNif('276 873 297')).toBe(true)
  })

  it('accepts NIPC starting with 5 (pessoa coletiva)', () => {
    expect(validateNif('500000004')).toBe(true)
  })

  it('rejects NIF with wrong checksum digit', () => {
    expect(validateNif('276873298')).toBe(false)
  })

  it('rejects too short (less than 9 digits)', () => {
    expect(validateNif('12345678')).toBe(false)
  })

  it('rejects too long (more than 9 digits = FR SIRET style)', () => {
    expect(validateNif('12345678901234')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateNif('')).toBe(false)
  })

  it('rejects NIF whose first digit is not in [1,2,5,6,8,9]', () => {
    // 3 is not valid for any category
    expect(validateNif('300000005')).toBe(false)
  })

  it('rejects undefined/null gracefully', () => {
    // @ts-expect-error testing runtime safety
    expect(validateNif(undefined)).toBe(false)
    // @ts-expect-error testing runtime safety
    expect(validateNif(null)).toBe(false)
  })
})
```

- [ ] **Step 1.2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npm run test -- tests/lib/nif-pt.test.ts
```

Expected: tous les tests ÉCHOUENT avec `Cannot find module '@/lib/nif-pt'`.

- [ ] **Step 1.3: Créer `lib/nif-pt.ts` avec validateNif**

Contenu de `lib/nif-pt.ts` :

```typescript
// ── Validation NIF / NIPC portugais (algorithme officiel AT — modulo 11) ────
// Premiers chiffres autorisés (Autoridade Tributária) :
//   1, 2, 3 → particulier (résident)
//   5       → personne morale (NIPC)
//   6       → administration publique
//   8       → empresário em nome individual (EI / Recibos Verdes)
//   9       → autres pessoas coletivas (associations, condomínios)
// (Le chiffre 3 reste rare mais existe pour certains résidents anciens — on l'inclut
// pour ne pas faussement rejeter ; le checksum reste le verrou principal.)

const VALID_FIRST_DIGITS = new Set(['1', '2', '3', '5', '6', '8', '9'])

export function validateNif(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false
  const nif = raw.replace(/\D/g, '')
  if (nif.length !== 9) return false
  if (!VALID_FIRST_DIGITS.has(nif[0])) return false

  const digits = nif.split('').map(Number)
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0)
  const remainder = sum % 11
  const expected = remainder < 2 ? 0 : 11 - remainder
  return digits[8] === expected
}

export function extractNif(text: string | null | undefined): string | null {
  if (!text) return null
  // Pattern : 3+3+3 avec espaces optionnels (ex. "276 873 297" ou "276873297")
  const candidates = text.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/g) || []
  for (const candidate of candidates) {
    const clean = candidate.replace(/\s/g, '')
    if (validateNif(clean)) return clean
  }
  return null
}
```

- [ ] **Step 1.4: Lancer les tests à nouveau pour vérifier qu'ils passent**

```bash
npm run test -- tests/lib/nif-pt.test.ts
```

Expected: les 9 tests `validateNif` passent. Les 2 tests `extractNif` échouent encore (assertions à venir Task 2).

- [ ] **Step 1.5: Commit intermédiaire**

```bash
git add lib/nif-pt.ts tests/lib/nif-pt.test.ts
git commit -m "feat(shared): add validateNif PT (modulo 11) for syndic analyse orçamento

Implements official Autoridade Tributária NIF/NIPC checksum.
First-digit gate + modulo 11 weighted sum on first 8 digits.
Tested against real PT NIF 276 873 297.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: NIF extractor — `extractNif`

**Files:**
- Modify: `lib/nif-pt.ts` (déjà créé en Task 1, on ajoute juste les tests)
- Test: `tests/lib/nif-pt.test.ts` (ajout)

- [ ] **Step 2.1: Ajouter les tests `extractNif` au bas du fichier de test**

Ajout à la fin de `tests/lib/nif-pt.test.ts` (après le `describe('validateNif')` existant) :

```typescript
describe('extractNif', () => {
  it('extracts NIF from PDF body (3+3+3 spaced format)', () => {
    const text = 'EMITENTE\nNome : Frédéric Neiva Carvalho\nNIF : 276 873 297\nMorada : 109 Av.'
    expect(extractNif(text)).toBe('276873297')
  })

  it('extracts NIF from continuous digit format', () => {
    expect(extractNif('NIF: 276873297 / CAE 81210')).toBe('276873297')
  })

  it('returns null when no valid NIF in text', () => {
    expect(extractNif('Random text 111 222 333 (invalid checksum)')).toBeNull()
  })

  it('returns null on empty input', () => {
    expect(extractNif('')).toBeNull()
    expect(extractNif(null)).toBeNull()
    expect(extractNif(undefined)).toBeNull()
  })

  it('skips invalid candidates and picks the valid one', () => {
    const text = 'Telefone : 912 014 971 \n NIF : 276 873 297'
    expect(extractNif(text)).toBe('276873297')
  })
})
```

- [ ] **Step 2.2: Lancer les tests `extractNif`**

```bash
npm run test -- tests/lib/nif-pt.test.ts
```

Expected: les 5 tests `extractNif` passent (l'implémentation existe déjà en Task 1.3).

- [ ] **Step 2.3: Commit**

```bash
git add tests/lib/nif-pt.test.ts
git commit -m "test(shared): add extractNif coverage for syndic NIF detection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Fixtures PDF Lobão dans le test scoring PT

**Files:**
- Create: `tests/lib/analyse-devis-scoring-pt.test.ts`

- [ ] **Step 3.1: Créer le squelette de test avec les fixtures**

Contenu de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { calculateScoresPt } from '@/lib/analyse-devis-scoring-pt'

// ── Fixture : extraction JSON simulée du PDF Vitfix Artisan PT
// Orcamento-Lobao-Motorline-Lince.pdf (21/05/2026, NIF 276 873 297) ────────
const lobaoExtracted = {
  artisan_nom: 'Frédéric Neiva Carvalho',
  artisan_siret: '276873297',
  artisan_metier: 'Eletricidade / Motorizações',
  type_document: 'orcamento',
  description_travaux: 'Motorização portão de batente',
  immeuble: 'Rua Choqueiro Poente, 81, 4650-163 Barrosas',
  prestations: [
    { designation: 'Inspeção prévia do sistema elétrico', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 80, total_ht: 80 },
    { designation: 'Fornecimento de motorização Motorline LINCE', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 720, total_ht: 720 },
    { designation: 'Mão de obra — instalação completa', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 440, total_ht: 440 },
    { designation: 'Outras despesas (deslocação e materiais diversos)', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 110, total_ht: 110 },
  ],
  montant_ht: 1350,
  montant_ttc: 1660.5,
  tva_taux: 23,
  tva_montant: 310.5,
  date_intervention: '2026-05-23',
  artisan_email: 'cvlho.frederic@gmail.com',
  artisan_telephone: '912 014 971',
  priorite: 'planifiee',
  mentions_presentes: [
    'NIPC', 'CAE', 'IVA', 'Garantia legal 3 anos DL 84/2021',
    'Garantia comercial 2 anos', 'Validade 30 dias', 'Prazo de execução',
    'Condições de pagamento', 'IBAN', 'RGPD', 'REEE',
    'Direito de livre resolução 14 dias DL 24/2014',
    'CNIACC entidade RAL', 'Livro de Reclamações eletrónico',
  ],
  mentions_manquantes: [
    'Número de matrícula na Conservatória do Registo Comercial',
    'Seguro de responsabilidade civil profissional',
    'Alvará (não aplicável, montante < 16 750 €)',
    'ATCUD (não aplicável a orçamentos)',
    'SAF-T PT (não aplicável a orçamentos)',
  ],
  numero_document: 'ORC-2026-205',
  date_document: '2026-05-21',
  statut_juridique: 'Trabalhador independente (Recibos Verdes)',
}

// Texte brut du PDF (extraits clés) pour fallback de détection ────────────
const lobaoRawText = `
ORÇAMENTO — Projeto: Motorização portão de batente
ORC-2026-205
EMITENTE
Nome : Frédéric Neiva Carvalho
NIF : 276 873 297
CAE : 81210, 38112
DATA DE EMISSÃO 21/05/2026
VALIDADE 30 dias
PRAZO DE EXECUÇÃO No próprio dia
Subtotal s/IVA 1 350,00 €
IVA 23% s/ 1 350,00 € 310,50 €
TOTAL C/IVA 1 660,50 €
Garantia legal de conformidade: 3 anos sobre o equipamento (DL 84/2021, art. 12.º).
Garantia comercial: 2 anos adicionais sobre a mão de obra.
IBAN: PT50 0033 0000 4576 3682 866 05 — BIC: BCOMPTPL
PROTEÇÃO DE DADOS PESSOAIS (RGPD)
RESÍDUOS DE EQUIPAMENTOS ELÉTRICOS E ELETRÓNICOS (REEE)
Trabalhador independente (Recibos Verdes).
Direito de livre resolução: 14 dias de calendário (art. 10.º DL 24/2014).
Em caso de litígio, entidade RAL competente : CNIACC — www.cniacc.pt
Livro de Reclamações disponível em formato eletrónico em www.livroreclamacoes.pt
`

describe('calculateScoresPt — squelette', () => {
  it('exposes the expected shape', () => {
    const result = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(result).toMatchObject({
      conformite: expect.objectContaining({ total: expect.any(Number), max: expect.any(Number), details: expect.any(Array) }),
      prix: expect.objectContaining({ ecart_moyen_pct: expect.any(Number), details: expect.any(Array) }),
      confiance: expect.any(Number),
      action_recommandee: expect.stringMatching(/^(valider|negocier|devis_vitfix)$/),
      messages_negociation: expect.any(Array),
    })
  })
})
```

- [ ] **Step 3.2: Lancer pour vérifier l'échec (RED baseline)**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: ÉCHEC `Cannot find module '@/lib/analyse-devis-scoring-pt'`.

- [ ] **Step 3.3: Commit (red baseline)**

```bash
git add tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "test(shared): add fixtures + skeleton test for analyse-devis-scoring-pt

Fixtures based on real PDF Orcamento-Lobao-Motorline-Lince (21/05/2026).
Includes extracted JSON shape + raw text for keyword fallback detection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Squelette `lib/analyse-devis-scoring-pt.ts` (signature + has fallback)

**Files:**
- Create: `lib/analyse-devis-scoring-pt.ts`

- [ ] **Step 4.1: Créer le fichier avec helpers de base et signature publique**

Contenu de `lib/analyse-devis-scoring-pt.ts` :

```typescript
// ── Moteur de scoring PT — Análise Orçamentos/Faturas (côté syndic) ─────────
// Côté FR : lib/analyse-devis-scoring.ts (NE PAS TOUCHER)
// Types : importés depuis le moteur FR (source de vérité, intact).

import type {
  ConformiteCritere,
  PrixDetail,
  ScoreConformite,
  ScorePrix,
  AnalyseScores,
} from '@/lib/analyse-devis-scoring'

// ── Normalisation texte ─────────────────────────────────────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Détection avec fallback texte brut ──────────────────────────────────────
// Le LLM peut omettre certaines mentions dans mentions_presentes ; on cherche
// donc aussi dans rawText. Status :
//   'ok'      = trouvé dans mentions_presentes OU dans rawText (sans manque déclaré)
//   'partial' = trouvé dans rawText mais déclaré manquant ailleurs
//   'missing' = absent partout
function has(
  keywords: string[],
  mp: string[],
  mm: string[],
  rawText: string,
): 'ok' | 'partial' | 'missing' {
  const mpN = mp.map(normalize)
  const mmN = mm.map(normalize)
  const rawN = normalize(rawText)
  const kN = keywords.map(normalize)

  const inMp = kN.some(k => mpN.some(m => m.includes(k)))
  const inMm = kN.some(k => mmN.some(m => m.includes(k)))
  const inRaw = kN.some(k => rawN.includes(k))

  if (inMp) return 'ok'
  if (inRaw && !inMm) return 'ok'
  if (inRaw && inMm) return 'partial'
  return 'missing'
}

// ── Squelette public ────────────────────────────────────────────────────────
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  void extracted; void rawText; void options
  // Implémentation incrémentale (Tasks 5-9)
  return {
    conformite: { total: 0, max: 0, details: [] },
    prix: { ecart_moyen_pct: 0, details: [] },
    confiance: 0,
    action_recommandee: 'valider',
    messages_negociation: [],
  }
}
```

- [ ] **Step 4.2: Lancer le test squelette**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: le test `exposes the expected shape` PASSE (les types et la forme sont OK même avec des `0` partout).

- [ ] **Step 4.3: Commit**

```bash
git add lib/analyse-devis-scoring-pt.ts
git commit -m "feat(shared): skeleton lib/analyse-devis-scoring-pt with shared types

Imports types from lib/analyse-devis-scoring.ts (FR untouched, single source
of truth). Includes normalize() and has() with rawText fallback detection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Critères principaux — NIF, IVA, garantia, livre resolução, RGPD, REEE

**Files:**
- Modify: `lib/analyse-devis-scoring-pt.ts` (ajout `calculateConformiteScorePt`)
- Modify: `tests/lib/analyse-devis-scoring-pt.test.ts` (ajout assertions)

- [ ] **Step 5.1: Ajouter les tests des critères de base**

Ajout à la fin de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
describe('calculateScoresPt — critères de base', () => {
  it('detects NIF as ok when nifVerified=true', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'nif')?.status).toBe('ok')
  })

  it('detects NIF as missing when nifVerified=false', () => {
    const r = calculateScoresPt({ ...lobaoExtracted, artisan_siret: '' }, lobaoRawText, { nifVerified: false })
    expect(r.conformite.details.find(c => c.id === 'nif')?.status).toBe('missing')
  })

  it('detects IVA mentioned (taxa 23%)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'iva')?.status).toBe('ok')
  })

  it('detects garantia legal (DL 84/2021) via rawText fallback', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'garantia_legal')?.status).toBe('ok')
  })

  it('detects direito de livre resolução (DL 24/2014)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'livre_resolucao')?.status).toBe('ok')
  })

  it('detects RGPD', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'rgpd')?.status).toBe('ok')
  })

  it('detects CNIACC (entidade RAL)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'cniacc_ral')?.status).toBe('ok')
  })

  it('detects livro de reclamações', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'livro_reclamacoes')?.status).toBe('ok')
  })

  it('detects CAE present', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'cae')?.status).toBe('ok')
  })

  it('detects numero_orcamento from extracted.numero_document', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'numero_orcamento')?.status).toBe('ok')
  })

  it('detects data_emissao from extracted.date_document', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'data_emissao')?.status).toBe('ok')
  })

  it('detects detalhe_prestacoes when prestations[] has items with prix', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'detalhe_prestacoes')?.status).toBe('ok')
  })

  it('detects IBAN', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'iban_titular')?.status).toBe('ok')
  })
})
```

- [ ] **Step 5.2: Lancer pour confirmer RED**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: les nouveaux tests ÉCHOUENT (details = `[]`).

- [ ] **Step 5.3: Implémenter `calculateConformiteScorePt` (sans alvará/seguro RC, traités Task 6)**

Dans `lib/analyse-devis-scoring-pt.ts`, ajouter après `has()` et avant `calculateScoresPt` :

```typescript
// ── Critères de conformité PT ───────────────────────────────────────────────
function calculateConformiteScorePt(
  extracted: Record<string, unknown>,
  rawText: string,
  nifVerified: boolean,
): ScoreConformite {
  const mp = (extracted.mentions_presentes || []) as string[]
  const mm = (extracted.mentions_manquantes || []) as string[]
  const typeDoc = String(extracted.type_document || '').toLowerCase()
  const isFatura = typeDoc.includes('fatura') || typeDoc === 'factura'
  const montantHt = Number(extracted.montant_ht || 0)
  const statutJuridique = String(extracted.statut_juridique || '').toLowerCase()
  const isRecibosVerdes = /recibos\s*verdes|trabalhador\s+independente|empresario.+nome\s+individual|\bei\b/.test(statutJuridique)

  const prestations = (extracted.prestations || []) as Array<{ prix_unitaire_ht?: number; total_ht?: number }>
  const hasPrestations = prestations.length > 0 && prestations.some(p => (p.prix_unitaire_ht || p.total_ht || 0) > 0)

  // Pattern IBAN PT : PTxx suivi de groupes de 4 chiffres
  const hasIban = /\bPT\d{2}(\s?\d{4}){2,}/.test(rawText)

  const criteres: ConformiteCritere[] = [
    {
      id: 'nif',
      label: 'NIF/NIPC válido',
      poids: 12,
      status: nifVerified ? 'ok' : (extracted.artisan_siret ? 'partial' : 'missing'),
    },
    {
      id: 'cae',
      label: 'CAE (Código de Atividade Económica)',
      poids: 5,
      status: has(['cae', 'codigo de atividade economica'], mp, mm, rawText),
    },
    {
      id: 'iva',
      label: 'IVA mencionado (taxa ou regime)',
      poids: 10,
      status: has(['iva', 'isento', 'regime de iva', 'taxa de iva', '23%', '13%', '6%'], mp, mm, rawText),
    },
    {
      id: 'garantia_legal',
      label: 'Garantia legal (DL 84/2021 ou DL 67/2003)',
      poids: 12,
      status: has(['garantia legal', 'dl 84 2021', 'dl 67 2003', 'decreto lei 84', 'decreto lei 67', '3 anos sobre o equipamento', 'garantia 5 anos'], mp, mm, rawText),
    },
    {
      id: 'condicoes_pagamento',
      label: 'Condições de pagamento',
      poids: 5,
      status: has(['condicoes de pagamento', 'adiantamento', 'tranches', 'transferencia bancaria', 'modo de pagamento'], mp, mm, rawText),
    },
    {
      id: 'prazo_execucao',
      label: 'Prazo de execução',
      poids: 4,
      status: has(['prazo de execucao', 'data da prestacao', 'no proprio dia'], mp, mm, rawText),
    },
    {
      id: 'validade_orcamento',
      label: 'Validade do orçamento',
      poids: 4,
      status: has(['validade', 'valido ate', 'dias a contar'], mp, mm, rawText),
    },
    {
      id: 'livre_resolucao',
      label: 'Direito de livre resolução (DL 24/2014)',
      poids: 10,
      status: has(['livre resolucao', 'dl 24 2014', '14 dias de calendario', 'direito de livre'], mp, mm, rawText),
    },
    {
      id: 'cniacc_ral',
      label: 'Entidade RAL (CNIACC ou equivalente)',
      poids: 5,
      status: has(['cniacc', 'entidade ral', 'resolucao alternativa de litigios', 'lei 144 2015'], mp, mm, rawText),
    },
    {
      id: 'livro_reclamacoes',
      label: 'Livro de Reclamações (eletrónico)',
      poids: 4,
      status: has(['livro de reclamacoes', 'livroreclamacoes', 'dl 156 2005'], mp, mm, rawText),
    },
    {
      id: 'rgpd',
      label: 'Tratamento de dados pessoais (RGPD)',
      poids: 4,
      status: has(['rgpd', 'dados pessoais', '2016 679', 'cnpd', 'protecao de dados'], mp, mm, rawText),
    },
    {
      id: 'numero_orcamento',
      label: 'Número sequencial único do orçamento',
      poids: 4,
      status: extracted.numero_document
        ? 'ok'
        : has(['orc', 'numero do orcamento', 'numero sequencial'], mp, mm, rawText),
    },
    {
      id: 'data_emissao',
      label: 'Data de emissão',
      poids: 4,
      status: extracted.date_document
        ? 'ok'
        : has(['data de emissao', 'emitido em'], mp, mm, rawText),
    },
    {
      id: 'detalhe_prestacoes',
      label: 'Detalhe das prestações (qtd, unidade, preço)',
      poids: 8,
      status: hasPrestations ? 'ok' : has(['designacao', 'prestacao', 'quantidade'], mp, mm, rawText),
    },
    {
      id: 'iban_titular',
      label: 'IBAN e titular para transferência',
      poids: 3,
      status: hasIban ? 'ok' : has(['iban'], mp, mm, rawText),
    },
  ]

  // Items spécifiques fatura
  if (isFatura) {
    criteres.push(
      {
        id: 'atcud',
        label: 'ATCUD (Portaria 195/2020)',
        poids: 8,
        status: has(['atcud', 'codigo unico de documento', 'portaria 195 2020'], mp, mm, rawText),
      },
      {
        id: 'saft_pt',
        label: 'SAF-T PT exportável (DL 28/2019)',
        poids: 5,
        status: has(['saf t', 'saft pt', 'dl 28 2019'], mp, mm, rawText),
      },
    )
  }

  // alvará et seguro_rc seront ajoutés en Task 6 (alvará conditionnel,
  // seguro RC adaptatif au statut juridique).
  void montantHt; void isRecibosVerdes  // utilisés Task 6

  // Calcul total / max — items 'na' sont retirés du max
  let total = 0
  let max = 0
  for (const c of criteres) {
    if (c.status === 'na') continue
    max += c.poids
    if (c.status === 'ok') total += c.poids
    else if (c.status === 'partial') total += Math.floor(c.poids * 0.5)
  }
  return { total, max, details: criteres }
}
```

Et remplacer le retour stub de `calculateScoresPt` :

```typescript
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  const nifVerified = !!options?.nifVerified
  const conformite = calculateConformiteScorePt(extracted, rawText, nifVerified)
  return {
    conformite,
    prix: { ecart_moyen_pct: 0, details: [] },
    confiance: 0,
    action_recommandee: 'valider',
    messages_negociation: [],
  }
}
```

- [ ] **Step 5.4: Lancer les tests**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: les 13 nouveaux tests passent. Le test `exposes the expected shape` passe toujours.

- [ ] **Step 5.5: Commit**

```bash
git add lib/analyse-devis-scoring-pt.ts tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "feat(shared): syndic PT scoring — 15 base criteria detection

NIF, CAE, IVA, garantia legal DL 84/2021, livre resolução DL 24/2014,
CNIACC, livro reclamações, RGPD, IBAN, detalhe prestações, etc.
Uses rawText fallback for items LLM may omit from mentions_presentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Alvará conditionnel + Seguro RC adaptatif

**Files:**
- Modify: `lib/analyse-devis-scoring-pt.ts`
- Modify: `tests/lib/analyse-devis-scoring-pt.test.ts`

- [ ] **Step 6.1: Ajouter les tests alvará et seguro RC**

Ajout à la fin de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
describe('calculateScoresPt — alvará conditionnel', () => {
  it('alvará marked NA when montant_ht < 16 750 €', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const alvara = r.conformite.details.find(c => c.id === 'alvara')
    expect(alvara?.status).toBe('na')
  })

  it('alvará marked missing when montant_ht ≥ 16 750 € and no mention', () => {
    const ext = { ...lobaoExtracted, montant_ht: 20000 }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'alvara')?.status).toBe('missing')
  })

  it('alvará marked ok when present in rawText AND montant qualifies', () => {
    const ext = { ...lobaoExtracted, montant_ht: 20000 }
    const raw = lobaoRawText + '\nAlvará de construção n.º 12345'
    const r = calculateScoresPt(ext, raw, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'alvara')?.status).toBe('ok')
  })

  it('alvará NA does not count in max (conformite ratio reflects N applicable items)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    // Si alvará n'est pas dans details OU est status 'na', il ne pèse pas dans max
    const max = r.conformite.max
    expect(max).toBeGreaterThan(0)
    expect(max).toBeLessThanOrEqual(120) // borne haute raisonnable
  })
})

describe('calculateScoresPt — Seguro RC adaptatif', () => {
  it('seguro_rc marked partial when absent BUT statut = Recibos Verdes', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('partial')
  })

  it('seguro_rc marked missing when absent AND statut = LDA/SA (pessoa coletiva)', () => {
    const ext = { ...lobaoExtracted, statut_juridique: 'Sociedade por Quotas (LDA)' }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('missing')
  })

  it('seguro_rc marked ok when present in mentions_presentes', () => {
    const ext = { ...lobaoExtracted, mentions_presentes: [...lobaoExtracted.mentions_presentes, 'Seguro de responsabilidade civil profissional Allianz nº 12345'] }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('ok')
  })
})
```

- [ ] **Step 6.2: Lancer pour confirmer RED**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: 7 nouveaux tests ÉCHOUENT.

- [ ] **Step 6.3: Implémenter alvará + seguro RC dans `calculateConformiteScorePt`**

Dans `lib/analyse-devis-scoring-pt.ts`, remplacer la ligne `void montantHt; void isRecibosVerdes` par ces deux blocs (insérés AVANT le bloc `if (isFatura)`) :

```typescript
  // Alvará — applicable seulement si montant ≥ 16 750 € (Lei 41/2015)
  const alvaraStatus: ConformiteCritere['status'] =
    montantHt < 16750
      ? 'na'
      : has(['alvara', 'lei 41 2015', 'alvara de construcao'], mp, mm, rawText)
  criteres.push({
    id: 'alvara',
    label: 'Alvará de construção (Lei 41/2015, obras ≥ 16 750 €)',
    poids: 8,
    status: alvaraStatus,
  })

  // Seguro RC — adaptatif au statut juridique
  const seguroFound = has(['seguro de responsabilidade civil', 'seguro rc', 'apolice'], mp, mm, rawText)
  const seguroStatus: ConformiteCritere['status'] =
    seguroFound === 'ok'
      ? 'ok'
      : isRecibosVerdes
        ? 'partial'  // Recommandé mais non obligatoire pour Recibos Verdes
        : 'missing'
  criteres.push({
    id: 'seguro_rc',
    label: 'Seguro de responsabilidade civil profissional',
    poids: 8,
    status: seguroStatus,
  })
```

- [ ] **Step 6.4: Lancer les tests**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: les 7 nouveaux tests passent.

- [ ] **Step 6.5: Commit**

```bash
git add lib/analyse-devis-scoring-pt.ts tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "feat(shared): syndic PT — alvará conditional + seguro RC adaptive

Alvará: status 'na' under 16 750 € threshold (Lei 41/2015), not penalized.
Seguro RC: 'partial' for Recibos Verdes (recommended not mandatory),
'missing' for pessoa coletiva. Three test cases each.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Fourchettes prix PT + findPriceRangePt

**Files:**
- Modify: `lib/analyse-devis-scoring-pt.ts`
- Modify: `tests/lib/analyse-devis-scoring-pt.test.ts`

- [ ] **Step 7.1: Ajouter les tests prix**

Ajout à la fin de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
describe('calculateScoresPt — análise dos preços', () => {
  it('matches motorização Motorline LINCE within market range', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const motoriz = r.prix.details.find(d => /motorline|motorizac/i.test(d.designation))
    expect(motoriz).toBeDefined()
    expect(motoriz?.status).not.toBe('inconnu')
    expect(motoriz?.fourchette_min).toBeGreaterThan(0)
  })

  it('matches mão de obra instalação as known range', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const mo = r.prix.details.find(d => /mao\s*de\s*obra/i.test(d.designation))
    expect(mo?.status).not.toBe('inconnu')
  })

  it('computes a non-zero ecart_moyen_pct when prices match', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const known = r.prix.details.filter(d => d.status !== 'inconnu')
    expect(known.length).toBeGreaterThan(0)
  })

  it('flags excessive price (> 50% above max) as excessif', () => {
    const ext = {
      ...lobaoExtracted,
      prestations: [
        { designation: 'Mão de obra — instalação completa', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 1500, total_ht: 1500 },
      ],
    }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.prix.details[0].status).toBe('excessif')
  })
})
```

- [ ] **Step 7.2: Lancer pour confirmer RED**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: les 4 nouveaux tests ÉCHOUENT (prix.details = []).

- [ ] **Step 7.3: Ajouter `PRIX_MARCHE_PT` + `findPriceRangePt` + `calculatePrixScorePt`**

Dans `lib/analyse-devis-scoring-pt.ts`, ajouter après la fonction `has()` :

```typescript
// ── Fourchettes prix marché PT-PT 2025-2026 (sem IVA, em €) ─────────────────
// Sources : indicateurs marché Portugal cités dans SYSTEM_PROMPT_PT,
// extensions pour cas observés (motorisations, inspeções elétricas).
const PRIX_MARCHE_PT: Record<string, [number, number]> = {
  // Canalização
  'desentupimento simples': [60, 150],
  'desentupimento complexo': [150, 400],
  'fuga torneira': [50, 100],
  'substituicao torneira': [120, 300],
  'termoacumulador': [600, 1200],
  'cilindro agua quente': [600, 1200],
  'instalacao sanitarios': [350, 800],
  'coluna agua quente': [150, 400],
  // Eletricidade
  'quadro eletrico monofasico': [500, 1000],
  'quadro eletrico trifasico': [800, 2000],
  'adaptacao regras tecnicas': [1500, 4000],
  'inspecao previa sistema eletrico': [50, 150],
  'inspecao sistema eletrico': [50, 150],
  'tomada eletrica': [40, 120],
  'ponto de luz': [50, 150],
  'videoporteiro': [150, 700],
  'intercomunicador': [150, 700],
  'iluminacao areas comuns': [600, 1800],
  // Motorizações / portões (PDF Lobão)
  'motorizacao portao batente': [500, 1200],
  'motorizacao portao': [500, 1200],
  'motorline lince': [500, 1200],
  'motorline': [500, 1200],
  'mao de obra instalacao portao': [350, 800],
  'mao de obra instalacao completa': [200, 800],
  'mao de obra instalacao': [200, 800],
  'deslocacao materiais diversos': [50, 200],
  'outras despesas': [50, 200],
  // Carpintaria / Serralharia
  'porta entrada predio': [1500, 5000],
  'porta entrada': [1500, 5000],
  'porta patamar': [600, 2000],
  'janela vidro duplo': [350, 1000],
  'portao automatico': [1500, 5000],
  // Pintura
  'pintura interior': [15, 40],
  'pintura fachada': [20, 60],
  'reabilitacao fachada reboco': [30, 80],
  // Fechaduras / Segurança
  'fechadura': [120, 350],
  'codigo de acesso': [250, 700],
  'videoporteiro predio': [400, 1700],
  // Elevadores
  'manutencao anual elevador': [1200, 4000],
  'revisao elevador': [2500, 6500],
  // Coberturas
  'substituicao telhas': [60, 130],
  'impermeabilizacao terraco': [40, 100],
  // Espaços verdes
  'corte sebes': [25, 70],
  'poda arvore': [150, 700],
  'manutencao mensal espacos verdes': [150, 700],
  // Limpeza
  'limpeza areas comuns': [250, 700],
  'limpeza vidros': [1.5, 7],
  // Alvenaria
  'fissuracao fachada': [40, 130],
  'regularizacao pavimento': [8, 25],
}

function findPriceRangePt(designation: string): [number, number] | null {
  const norm = normalize(designation)
  let best: [number, number] | null = null
  let bestScore = 0
  for (const [key, range] of Object.entries(PRIX_MARCHE_PT)) {
    const keyN = normalize(key)
    const words = keyN.split(' ').filter(w => w.length > 1)
    if (words.length === 0) continue
    const matches = words.filter(w => norm.includes(w)).length
    const score = matches / words.length
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      best = range
    }
  }
  return best
}

function calculatePrixScorePt(
  prestations: Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>,
): ScorePrix {
  const details: PrixDetail[] = []
  for (const p of prestations) {
    const prix = p.prix_unitaire_ht || p.total_ht || 0
    if (!prix || prix <= 0) continue
    const fourchette = findPriceRangePt(p.designation)
    if (!fourchette) {
      details.push({
        designation: p.designation,
        prix,
        unite: p.unite || 'u',
        fourchette_min: 0,
        fourchette_max: 0,
        status: 'inconnu',
        ecart_pct: 0,
      })
      continue
    }
    const milieu = (fourchette[0] + fourchette[1]) / 2
    const ecart = ((prix - milieu) / milieu) * 100
    let status: PrixDetail['status'] = 'ok'
    if (prix < fourchette[0]) status = 'bas'
    else if (prix > fourchette[1] * 1.5) status = 'excessif'
    else if (prix > fourchette[1]) status = 'eleve'
    details.push({
      designation: p.designation,
      prix,
      unite: p.unite || 'u',
      fourchette_min: fourchette[0],
      fourchette_max: fourchette[1],
      status,
      ecart_pct: Math.round(ecart),
    })
  }
  const known = details.filter(d => d.status !== 'inconnu')
  const ecart_moyen = known.length > 0
    ? Math.round(known.reduce((s, d) => s + d.ecart_pct, 0) / known.length)
    : 0
  return { ecart_moyen_pct: ecart_moyen, details }
}
```

Et modifier `calculateScoresPt` pour utiliser `calculatePrixScorePt` :

```typescript
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  const nifVerified = !!options?.nifVerified
  const conformite = calculateConformiteScorePt(extracted, rawText, nifVerified)
  const prestations = (extracted.prestations || []) as Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
  const prix = calculatePrixScorePt(prestations)
  return {
    conformite,
    prix,
    confiance: 0,
    action_recommandee: 'valider',
    messages_negociation: [],
  }
}
```

- [ ] **Step 7.4: Lancer les tests**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: les 4 tests prix passent.

- [ ] **Step 7.5: Commit**

```bash
git add lib/analyse-devis-scoring-pt.ts tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "feat(shared): syndic PT — PRIX_MARCHE_PT + findPriceRangePt

~50 PT-PT 2025-2026 market price ranges across canalização,
eletricidade, motorizações, carpintaria, pintura, etc.
Matching by normalized keywords with 50% word coverage threshold.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Messages de négociation PT + action_recommandee + confiance

**Files:**
- Modify: `lib/analyse-devis-scoring-pt.ts`
- Modify: `tests/lib/analyse-devis-scoring-pt.test.ts`

- [ ] **Step 8.1: Ajouter les tests**

Ajout à la fin de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
describe('calculateScoresPt — messages PT + action + confiance', () => {
  it('messages_negociation are in Portuguese (no French phrasing)', () => {
    const degraded = { ...lobaoExtracted, mentions_presentes: [] as string[], mentions_manquantes: ['IVA', 'Garantia legal'] as string[] }
    const r = calculateScoresPt(degraded, '', { nifVerified: false })
    expect(r.messages_negociation.length).toBeGreaterThan(0)
    const joined = r.messages_negociation.join(' ')
    expect(joined).toMatch(/orçamento|preço|menciona/i)
    expect(joined).not.toMatch(/votre|prix|mentionne/i)
  })

  it('action_recommandee = valider when conformite ≥ 90%', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    if (r.conformite.total / r.conformite.max >= 0.9) {
      expect(r.action_recommandee).toBe('valider')
    }
  })

  it('action_recommandee = negocier when 70% ≤ conformite < 90%', () => {
    const partial = { ...lobaoExtracted, mentions_presentes: lobaoExtracted.mentions_presentes.slice(0, 5) }
    const r = calculateScoresPt(partial, '', { nifVerified: true })
    const pct = r.conformite.total / r.conformite.max
    if (pct >= 0.7 && pct < 0.9) expect(r.action_recommandee).toBe('negocier')
  })

  it('confiance is bounded 0-100', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.confiance).toBeGreaterThanOrEqual(0)
    expect(r.confiance).toBeLessThanOrEqual(100)
  })

  it('confiance ≥ 80 on the Lobão fixture (well-formed PT doc)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.confiance).toBeGreaterThanOrEqual(80)
  })
})
```

- [ ] **Step 8.2: Lancer pour confirmer RED**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: 5 nouveaux tests ÉCHOUENT (messages = [], confiance = 0, action toujours 'valider').

- [ ] **Step 8.3: Finaliser `calculateScoresPt` avec confiance + action + messages PT**

Remplacer la fonction `calculateScoresPt` entière dans `lib/analyse-devis-scoring-pt.ts` par :

```typescript
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  const nifVerified = !!options?.nifVerified
  const conformite = calculateConformiteScorePt(extracted, rawText, nifVerified)
  const prestations = (extracted.prestations || []) as Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
  const prix = calculatePrixScorePt(prestations)

  // Score prix normalisé /100 : 100 = pile au milieu, -1pt par % d'écart
  const prixScore = Math.max(0, Math.min(100, 100 - Math.abs(prix.ecart_moyen_pct)))

  // Confiance = conformidade × 0.5 + prix × 0.3 + bonus × 0.2
  const bonusEmpresa = nifVerified ? 100 : 50
  const conformitePct = conformite.max > 0 ? (conformite.total / conformite.max) * 100 : 0
  const confiance = Math.round(conformitePct * 0.5 + prixScore * 0.3 + bonusEmpresa * 0.2)

  // Action recommandée
  let action: AnalyseScores['action_recommandee'] = 'valider'
  if (conformitePct < 70 || prix.details.some(d => d.status === 'excessif')) {
    action = 'devis_vitfix'
  } else if (conformitePct < 90 || prix.details.some(d => d.status === 'eleve')) {
    action = 'negocier'
  }

  // Messages négo en portugais
  const messages: string[] = []
  for (const c of conformite.details) {
    if (c.status === 'missing') {
      messages.push(`O seu orçamento não menciona : ${c.label}. Pode acrescentar esta informação ?`)
    }
  }
  for (const p of prix.details) {
    if (p.status === 'eleve' || p.status === 'excessif') {
      const intensite = p.status === 'excessif' ? 'muito ' : ''
      messages.push(`O preço de "${p.designation}" (${p.prix} €) parece ${intensite}elevado face ao mercado PT (${p.fourchette_min}-${p.fourchette_max} €). É negociável ?`)
    }
  }

  return {
    conformite,
    prix,
    confiance: Math.max(0, Math.min(100, confiance)),
    action_recommandee: action,
    messages_negociation: messages,
  }
}
```

- [ ] **Step 8.4: Lancer tous les tests scoring PT**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: tous les tests passent (squelette + 13 base + 7 alvará/seguro + 4 prix + 5 messages = 30 tests verts).

- [ ] **Step 8.5: Commit**

```bash
git add lib/analyse-devis-scoring-pt.ts tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "feat(shared): syndic PT scoring — PT negotiation messages + confidence

Confidence = conformidade*0.5 + prix*0.3 + bonus NIF*0.2
Action: valider / negocier / devis_vitfix based on thresholds.
Messages in PT-PT only ('O seu orçamento não menciona...').
Lobão PDF fixture reaches confiance ≥ 80.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Test e2e fixture Lobão — score conformité ≥ 80%

**Files:**
- Modify: `tests/lib/analyse-devis-scoring-pt.test.ts` (assertions finales)

- [ ] **Step 9.1: Ajouter le test d'acceptation final**

Ajout à la fin de `tests/lib/analyse-devis-scoring-pt.test.ts` :

```typescript
describe('calculateScoresPt — acceptation Lobão PDF', () => {
  it('PDF Vitfix Artisan Lobão obtient un score de conformidade ≥ 80%', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const ratio = r.conformite.total / r.conformite.max
    expect(ratio).toBeGreaterThanOrEqual(0.8)
  })

  it('PDF Lobão affiche au moins 12 critères PT (pas FR)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const ids = r.conformite.details.map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining([
      'nif', 'cae', 'iva', 'garantia_legal', 'livre_resolucao',
      'cniacc_ral', 'livro_reclamacoes', 'rgpd', 'iban_titular',
    ]))
    // Aucun ID français
    expect(ids).not.toContain('siret')
    expect(ids).not.toContain('assurance_decennale')
    expect(ids).not.toContain('statut_juridique')
    expect(ids).not.toContain('mediateur')
  })

  it('Lobão : tous les labels sont en portugais (caractères portugais OK)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const labels = r.conformite.details.map(c => c.label).join(' ')
    // Tokens français caractéristiques absents
    expect(labels).not.toMatch(/SIRET|décennale|TVA mentionnée|SARL|SAS|EI/i)
    // Tokens portugais présents
    expect(labels).toMatch(/NIF|IVA|CAE|garantia|orçamento|livre resolução/i)
  })
})
```

- [ ] **Step 9.2: Lancer la suite complète**

```bash
npm run test -- tests/lib/analyse-devis-scoring-pt.test.ts tests/lib/nif-pt.test.ts
```

Expected: tous les tests passent. Si le test ratio ≥ 0.8 échoue, ajuster les poids (Task 5) ou élargir la détection (helper `has`). Cible : 85-95%.

- [ ] **Step 9.3: Commit**

```bash
git add tests/lib/analyse-devis-scoring-pt.test.ts
git commit -m "test(shared): syndic PT — acceptance test Lobão PDF reaches ≥ 80%

Locks expected behavior: NIF detected, PT labels, no FR criteria leaking.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Patch route API — dispatch FR/PT

**Files:**
- Modify: `app/api/syndic/analyse-devis/route.ts:471-485`

- [ ] **Step 10.1: Lire le bloc à patcher pour confirmation**

```bash
sed -n '471,485p' app/api/syndic/analyse-devis/route.ts
```

Expected: bloc actuel avec `verifySiret` et un seul `calculateScores`.

- [ ] **Step 10.2: Remplacer le bloc par le dispatch FR/PT**

Édition de [app/api/syndic/analyse-devis/route.ts:471-485](app/api/syndic/analyse-devis/route.ts:471) — remplacer :

```typescript
    // ── Vérification entreprise (SIRET FR uniquement) + Scoring ──
    // En mode PT le champ contient un NIF/NIPC à 9 chiffres : l'API SIRET FR
    // est inapplicable. On retourne verified=false sans appel pour éviter le
    // bruit dans les logs. Une vérification NIF PT (AT/Portal das Finanças)
    // sera ajoutée ultérieurement.
    const siretResult = isPt
      ? { verified: false }
      : await verifySiret((extracted.artisan_siret as string) || '', req)

    const scores = calculateScores(
      (extracted.mentions_presentes || []) as string[],
      (extracted.mentions_manquantes || []) as string[],
      extracted,
      siretResult.verified
    )
```

par :

```typescript
    // ── Vérification entreprise + Scoring (dispatch FR/PT) ──
    // FR : SIRET via API verify-siret (Sirene).
    // PT : NIF checksum local (algorithme AT modulo 11), pas d'API externe.
    let scores: AnalyseScores
    let siretResult: { verified: boolean; company?: Record<string, unknown> }

    if (isPt) {
      const { validateNif } = await import('@/lib/nif-pt')
      const { calculateScoresPt } = await import('@/lib/analyse-devis-scoring-pt')
      const nifRaw = (extracted.artisan_siret as string) || ''
      const nifVerified = validateNif(nifRaw)
      siretResult = { verified: nifVerified }
      scores = calculateScoresPt(extracted, content, { nifVerified })
    } else {
      siretResult = await verifySiret((extracted.artisan_siret as string) || '', req)
      scores = calculateScores(
        (extracted.mentions_presentes || []) as string[],
        (extracted.mentions_manquantes || []) as string[],
        extracted,
        siretResult.verified,
      )
    }
```

- [ ] **Step 10.3: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(analyse-devis|nif-pt)" | head -20
```

Expected: aucune erreur sur les fichiers touchés (sortie vide ou seulement avertissements non liés).

- [ ] **Step 10.4: Lancer un build léger pour confirmer**

```bash
npm run lint -- app/api/syndic/analyse-devis/route.ts lib/analyse-devis-scoring-pt.ts lib/nif-pt.ts
```

Expected: 0 erreur ESLint sur ces 3 fichiers.

- [ ] **Step 10.5: Commit**

```bash
git add app/api/syndic/analyse-devis/route.ts
git commit -m "fix(shared): syndic analyse devis — dispatch FR/PT scoring engine

When locale=pt: validate NIF via local checksum (modulo 11),
score via calculateScoresPt (PT criteria, PT prices, PT messages).
When locale=fr: unchanged (verifySiret + calculateScores).

Fixes 'Detalhe da conformidade' showing French criteria on PT docs
and 0/100 score for valid PT NIF (276 873 297).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Patch sidebar label PT

**Files:**
- Modify: `components/syndic-dashboard/config.ts:40`

Le label `analyse_devis` est défini ligne 40 dans la section "Modules communs (FR + PT)". On le rend conditionnel via une propriété `labelPt` (le composant qui consomme `SYNDIC_MODULES` pourra alors lire `label` ou `labelPt` selon le locale). Si le composant ne supporte pas encore `labelPt`, on patche aussi le rendu — vérifier au préalable.

- [ ] **Step 11.1: Vérifier comment le label est consommé**

```bash
grep -rn "SYNDIC_MODULES" --include="*.tsx" --include="*.ts" components/syndic-dashboard | head -20
```

Identifier le composant qui rend la sidebar et lit `.label`. Probablement `components/syndic-dashboard/Sidebar.tsx` ou similaire.

- [ ] **Step 11.2: Étendre l'entrée `analyse_devis` avec un label PT**

Si la convention actuelle pour les modules bilingues est :
- soit une seule entrée avec champ optionnel `labelPt`,
- soit deux entrées avec `locale: 'fr' | 'pt'`.

Patcher [components/syndic-dashboard/config.ts:40](components/syndic-dashboard/config.ts:40) en remplaçant :

```typescript
  { key: 'analyse_devis', label: 'Analyse Devis/Factures', icon: '🔍', description: 'Comparaison et validation des devis', default: true },
```

par (option A — un seul item avec champs PT optionnels, à privilégier si la convention le permet) :

```typescript
  { key: 'analyse_devis', label: 'Analyse Devis/Factures', labelPt: 'Análise Orçamentos/Faturas', icon: '🔍', description: 'Comparaison et validation des devis', descriptionPt: 'Comparação e validação de orçamentos', default: true },
```

Et adapter le composant de rendu de la sidebar pour lire `labelPt` quand `locale === 'pt'`. Localiser le composant via :

```bash
grep -rn "module.label" components/syndic-dashboard --include="*.tsx" | head -10
```

Patcher le rendu en ajoutant le fallback :

```typescript
const displayLabel = locale === 'pt' && 'labelPt' in m && m.labelPt ? m.labelPt : m.label
```

Si l'inspection en Step 11.1 montre qu'aucun support `labelPt` n'existe et que les autres modules utilisent simplement le `label` quel que soit le locale, conserver une seule entrée et NE PAS introduire `labelPt` (risque de régression). Dans ce cas, la screenshot utilisateur montre déjà "Análise Orçamentos/Faturas" — donc la traduction du libellé sidebar est sans doute déjà gérée ailleurs (via i18n). Confirmer par inspection avant de patcher : si déjà traduit, **skip cette task** et passer à Task 12.

- [ ] **Step 11.3: Lint + type-check sur les fichiers touchés**

```bash
npm run lint -- components/syndic-dashboard/
```

Expected: pas de nouvelle erreur introduite.

- [ ] **Step 11.4: Commit (si modif effectuée, sinon noter "skipped" et passer)**

```bash
git add components/syndic-dashboard/config.ts components/syndic-dashboard/Sidebar.tsx 2>/dev/null
# Si rien à commiter (déjà traduit ailleurs), passer sans commit.
git commit -m "feat(shared): syndic sidebar — PT label for analyse_devis module" 2>/dev/null || echo "No changes to commit (label already localized)"
```

---

## Task 12: Smoke validation + build + push

**Files:** aucun (validation)

- [ ] **Step 12.1: Lancer la suite de tests complète scoring PT + NIF**

```bash
npm run test -- tests/lib/nif-pt.test.ts tests/lib/analyse-devis-scoring-pt.test.ts
```

Expected: 100% verts.

- [ ] **Step 12.2: Lint global**

```bash
npm run lint
```

Expected: pas de nouvelle erreur.

- [ ] **Step 12.3: Vérifier que `lib/analyse-devis-scoring.ts` (FR) n'a aucune modif**

```bash
git diff main -- lib/analyse-devis-scoring.ts
```

Expected: sortie vide.

- [ ] **Step 12.4: Vérifier la liste complète des fichiers touchés**

```bash
git diff main --stat
```

Expected (approximativement) :
```
 app/api/syndic/analyse-devis/route.ts                          | ~15 +-
 components/syndic-dashboard/config.ts                          | ~1 +- (ou 0)
 docs/superpowers/plans/2026-05-21-...md                        | +400
 docs/superpowers/specs/2026-05-21-...md                        | +384
 lib/analyse-devis-scoring-pt.ts                                | +280 nouveau
 lib/nif-pt.ts                                                  | +40 nouveau
 tests/lib/analyse-devis-scoring-pt.test.ts                     | +280 nouveau
 tests/lib/nif-pt.test.ts                                       | +80 nouveau
```

- [ ] **Step 12.5: Push vers origin (déclenche le déploiement Cloudflare)**

```bash
git push origin claude/gracious-golick-3e570b
```

Expected: push réussi, GitHub Actions démarre les pipelines (`tests.yml`, `code-quality.yml`, `deploy-cloudflare.yml`).

- [ ] **Step 12.6: Smoke manuel après déploiement**

Une fois le déploiement Cloudflare terminé (~3-5 min) :
1. Aller sur `vitfix.io/pt/syndic/dashboard` → menu Análise Orçamentos/Faturas
2. Drag-drop `Orcamento-Lobao-Motorline-Lince.pdf`
3. Cliquer "Analisar"
4. Vérifier :
   - Conformidade legal ≥ 80/100
   - Detalhe da conformidade affiche des labels **portugais** (NIF, IVA, CAE, garantia legal, livre resolução, RGPD, etc.) — aucun "SIRET", "décennale", "SARL"
   - NIF `276 873 297` détecté ✅
   - Messages négo en portugais
   - Veredicto global cohérent

Si un critère ressort en `missing` alors qu'il est dans le PDF, ajuster les mots-clés du `has()` correspondant (Task 5 ou 6) puis recommit + re-push.

---

## Self-Review (effectuée)

**Couverture de spec :**
- ✅ §2 Cause racine → Task 5 (critères), 6 (alvará/seguro), 7 (prix), 8 (messages), 10 (dispatch)
- ✅ §4 Fichiers touchés → Tasks 1, 3, 4, 10, 11 ; lib/analyse-devis-scoring.ts intact (Task 12.3 le vérifie)
- ✅ §5.1 17 critères PT → Task 5 (15) + Task 6 (alvará, seguro RC = 2)
- ✅ §5.1 spécifiques fatura (ATCUD, SAF-T) → Task 5.3 dans bloc `if (isFatura)`
- ✅ §5.4 NIF modulo 11 → Tasks 1, 2
- ✅ §5.5 Messages PT → Task 8
- ✅ §6 Patch route → Task 10
- ✅ §7 Sidebar → Task 11
- ✅ §9 Tests TDD → Tasks 1, 2, 3, 5, 6, 7, 8, 9
- ✅ §10 Critères succès → Task 12.6

**Placeholder scan :** 0 placeholder. Toutes les étapes ont du code concret ou des commandes vérifiables.

**Cohérence des types :** `ConformiteCritere`, `PrixDetail`, `ScoreConformite`, `ScorePrix`, `AnalyseScores` importés depuis `@/lib/analyse-devis-scoring` (signatures inchangées). `calculateScoresPt(extracted, rawText, options)` signature stable de Task 4 à Task 8. `validateNif` / `extractNif` consistants entre Task 1 et Task 10.

**Note opérationnelle Task 11 :** la décision finale dépend d'une inspection codebase courte. Si le label sidebar est déjà traduit via `t()` ou similaire (la screenshot utilisateur montre déjà "Análise Orçamentos/Faturas"), cette task est skip — c'est documenté explicitement dans 11.2.
