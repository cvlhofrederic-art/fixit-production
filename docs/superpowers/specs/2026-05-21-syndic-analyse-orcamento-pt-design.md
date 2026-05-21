# Design — Refonte du module Análise Orçamentos/Faturas (côté syndic) — pipeline PT propre

Date : 2026-05-21
Auteur : Claude (Opus 4.7) sur demande de Frédéric
Scope : `/pt/syndic/dashboard` → menu **Análise Orçamentos/Faturas**
Statut : draft pour relecture

## 1. Problème observé

Test du 21/05/2026 avec `Orcamento-Lobao-Motorline-Lince.pdf` (PDF Vitfix Artisan, NIF `276 873 297`, format PT‑PT) sur `vitfix.io/pt/syndic/dashboard` :

- Conformidade legal = **0/100** alors que le PDF est légalement très conforme PT
- Detalhe da conformidade affiche **13 critères en français** : SIRET, RC pro, décennale, pénalités 40€, médiateur, SARL/SAS…
- NIF présent dans le PDF → non détecté (le code cherche un SIRET 14 chiffres)
- Nível de preço = **0%** alors que l'analyse texte montre que le LLM a bien calculé des écarts cohérents
- Confiança = **40%** (par défaut, faute de match)
- Bas de page : analyse markdown **en PT correcte** ✅

Le LLM fait son travail. Le moteur de scoring `lib/analyse-devis-scoring.ts` est 100% FR hardcodé et ne reçoit jamais l'info de locale.

## 2. Cause racine (verbatim code)

| Fichier:ligne | Problème |
|---|---|
| `lib/analyse-devis-scoring.ts:240-319` | 13 critères FR hardcodés (SIRET, RC pro, médiateur, statut juridique SARL/SAS…) |
| `lib/analyse-devis-scoring.ts:45-188` | `PRIX_MARCHE` = clés FR uniquement (`debouchage`, `tableau electrique`…) |
| `lib/analyse-devis-scoring.ts:237-238` | `siretValid = /^\d{14}$/` → NIF PT (9 chiffres) jamais validé |
| `lib/analyse-devis-scoring.ts:432-437` | Messages négo `Votre devis ne mentionne pas…` FR |
| `app/api/syndic/analyse-devis/route.ts:480` | `calculateScores(...)` appelé sans paramètre `locale` |
| `app/api/syndic/analyse-devis/route.ts:471-478` | Pas de vérification NIF PT — `siretResult = { verified: false }` par défaut |
| `components/syndic-dashboard/config.ts:40` | Label sidebar `Analyse Devis/Factures` FR uniquement |

## 3. Objectifs

- Côté PT autonome, complet, fidèle au cadre juridique portugais
- **Aucun impact sur le côté FR** (séparation stricte demandée par l'utilisateur)
- Scoring exploitable par un syndic portugais : NIF, CAE, IVA, garantia legal, alvará conditionnel, livre resolução, CNIACC, livro reclamações, RGPD, REEE
- Fourchettes prix marché PT‑PT 2025‑2026
- Validation NIF locale (modulo 11 officiel AT)
- Messages de négociation localisés
- TDD : un test de référence avec le PDF `Orcamento-Lobao-Motorline-Lince.pdf` doit obtenir un score ≥ 80/100

Non‑objectif (sera traité dans une PR séparée) :
- Refonte du côté FR
- API Portal das Finanças (NIF lookup) — checksum local suffit pour ce sprint
- Mode BTP (clé `useBtpDesign`) — sera ajouté plus tard, ce design ne casse pas la voie BTP

## 4. Architecture cible

### Pipeline (identique sauf encadré)

```
PDF Upload
   ↓
/api/syndic/extract-pdf (unpdf)                              ← inchangé
   ↓ text
POST /api/syndic/analyse-devis { content, filename, locale } ← inchangé
   ↓
   ├── Groq #1 : SYSTEM_PROMPT_PT  → texte analyse (markdown PT) ← inchangé
   └── Groq #2 : EXTRACT_PROMPT_PT → JSON extraction              ← inchangé
   ↓
┌────────────────── DISPATCH PAR LOCALE ──────────────────┐
│  locale === 'pt'                                        │
│    → calculateScoresPt(extracted)                       │
│      [NEW lib/analyse-devis-scoring-pt.ts]              │
│  sinon                                                  │
│    → calculateScores(extracted)                         │
│      [lib/analyse-devis-scoring.ts — INTACT]            │
└─────────────────────────────────────────────────────────┘
   ↓
return { analysis, extracted, scores }
   ↓
UI affiche scores localisés + analyse markdown PT
```

### Fichiers touchés

| Fichier | État | Action |
|---|---|---|
| `lib/analyse-devis-scoring.ts` | existant FR | **INTACT** (côté FR conservé tel quel) |
| `lib/analyse-devis-scoring-pt.ts` | nouveau | **CRÉER** — moteur PT autonome (critères, prix, NIF, messages) |
| `lib/nif-pt.ts` | nouveau | **CRÉER** — validation NIF modulo 11 + extraction depuis texte |
| `app/api/syndic/analyse-devis/route.ts` | existant | **PATCH** — dispatch FR/PT à L.480 |
| `components/syndic-dashboard/reporting/AnalyseDevisSection.tsx` | existant | **MINIMAL** — affichage tolère déjà la forme `{id,label,status,poids}`, vérifier libellés PT en cohérence |
| `components/syndic-dashboard/config.ts` | existant | **PATCH** — label sidebar localisé |
| `tests/lib/analyse-devis-scoring-pt.test.ts` | nouveau | **CRÉER** — TDD fixtures (PDF Lobão + cas dégradés) |
| `tests/lib/nif-pt.test.ts` | nouveau | **CRÉER** — checksum modulo 11 sur NIFs connus |

Aucun import circulaire : `scoring-pt.ts` peut réutiliser les types (`ConformiteCritere`, `AnalyseScores`, …) en les ré‑exportant ou via `lib/analyse-devis-types.ts` partagé. Décision : **réexporter les types depuis `lib/analyse-devis-types.ts`** (extraction minimale) pour éviter cycle et clarifier l'API publique.

## 5. Détail — moteur PT

### 5.1 Critères de conformidade

17 critères standards + 2 spécifiques fatura, alignés sur `SYSTEM_PROMPT_PT` + ce que le PDF Vitfix Artisan PT produit légalement :

| ID | Label PT | Poids | Detection |
|---|---|---|---|
| `nif` | NIF/NIPC válido | 12 | `validateNif(extracted.artisan_siret)` → `ok` si checksum OK, `partial` si format OK sans checksum, `missing` sinon |
| `cae` | CAE (Código de Atividade Económica) | 5 | Regex `\bCAE\b.*?\d{4,5}` dans `extracted.mentions_presentes` ou texte brut |
| `iva` | IVA mencionado (taxa ou regime) | 10 | Mots‑clés : `iva`, `isento`, `regime de iva`, `23%`, `13%`, `6%` |
| `garantia_legal` | Garantia legal (DL 84/2021 ou DL 67/2003) | 12 | Mots‑clés : `garantia legal`, `dl 84/2021`, `dl 67/2003`, `3 anos sobre o equipamento`, `5 anos` |
| `alvara` | Alvará de construção (se aplicável) | 8 — **n/a si montant < 16 750 € ou trabalho não‑construção** | Mots‑clés `alvará`. Si `montant_ht < 16750`, status `na` (sortie du calcul) |
| `seguro_rc` | Seguro de responsabilidade civil profissional | 8 — **adaptatif** | Mots‑clés `seguro`, `responsabilidade civil`. Si absent ET `statut = recibos verdes / trabalhador independente` → `partial` (pas obligatoire), sinon `missing` |
| `condicoes_pagamento` | Condições de pagamento | 5 | Mots‑clés `pagamento`, `adiantamento`, `tranches`, `iban` |
| `prazo_execucao` | Prazo de execução | 4 | Mots‑clés `prazo`, `execução`, `dia da intervenção` |
| `validade_orcamento` | Validade do orçamento | 4 | Mots‑clés `validade`, présence champ `extracted.validade_dias` ou regex `\d+\s*dias` |
| `livre_resolucao` | Direito de livre resolução (DL 24/2014) | 10 | Mots‑clés `livre resolução`, `dl 24/2014`, `14 dias` |
| `cniacc_ral` | Entidade RAL (CNIACC ou equivalente) | 5 | Mots‑clés `cniacc`, `ral`, `resolução alternativa de litígios` |
| `livro_reclamacoes` | Livro de Reclamações (eletrónico) | 4 | Mots‑clés `livro de reclamações`, `livroreclamacoes.pt` |
| `rgpd` | Tratamento de dados (RGPD) | 4 | Mots‑clés `rgpd`, `dados pessoais`, `2016/679`, `cnpd` |
| `numero_orcamento` | Número sequencial único | 4 | `extracted.numero_document` non vide OU regex `ORC[-\s]?\d{4}` |
| `data_emissao` | Data de emissão | 4 | `extracted.date_document` non vide |
| `detalhe_prestacoes` | Detalhe das prestações (qtd, unid, preço) | 8 | `extracted.prestations.length > 0` ET majorité avec `prix_unitaire_ht > 0` |
| `iban_titular` | IBAN + titular | 3 | Regex `\bPT\d{2}(\s?\d{4}){5,}` |

**Items spécifiques fatura** (ajoutés conditionnellement si `type_document === 'fatura'`) :
- `atcud` (Portaria 195/2020) — poids 8
- `saft_pt` (DL 28/2019) — poids 5

**Total max poids orçamento standard** : `12+5+10+12+8+8+5+4+4+10+5+4+4+4+4+8+3 = 110` (les `n/a` retirent leur poids du `max`, comme la version FR).

### 5.2 Détection — fonction `has(keywords)`

Même esprit que la version FR : normalise (NFD, lowercase, strip ponctuation) puis cherche `mp.some(m => m.includes(k))`. Mais on traite aussi le texte brut `pdf_text` en fallback car le LLM peut omettre certaines mentions dans son JSON.

```ts
function has(keywords: string[], mp: string[], mm: string[], rawText: string): Status {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const inMp = keywords.some(k => mp.map(norm).some(m => m.includes(norm(k))))
  const inMm = keywords.some(k => mm.map(norm).some(m => m.includes(norm(k))))
  const inRaw = keywords.some(k => norm(rawText).includes(norm(k)))
  if (inMp || (inRaw && !inMm)) return 'ok'
  if (inRaw && inMm) return 'partial'
  return 'missing'
}
```

Le fallback `rawText` est crucial pour des items que le LLM rate parfois (RGPD, livro reclamações).

### 5.3 Fourchettes prix marché PT‑PT 2025‑2026

Issues de `SYSTEM_PROMPT_PT` (lignes 162‑198) déjà rédigées par l'utilisateur, élargies pour couvrir motorisations / portões (cas du PDF Lobão) :

```ts
const PRIX_MARCHE_PT: Record<string, [number, number]> = {
  // Canalização
  'desentupimento simples': [60, 150],
  'fuga torneira': [50, 100],
  'termoacumulador': [600, 1200],
  'cilindro': [600, 1200],
  // Eletricidade
  'quadro eletrico monofasico': [500, 1000],
  'quadro eletrico trifasico': [800, 2000],
  'videoporteiro': [150, 700],
  'inspecao previa sistema eletrico': [50, 150],
  'inspecao sistema eletrico': [50, 150],
  // Portões / motorisations (PDF Lobão)
  'motorizacao portao batente': [500, 1200],
  'motorline lince': [500, 1200],
  'mao de obra instalacao portao': [350, 800],
  'mao de obra instalacao': [200, 600],
  'deslocacao materiais diversos': [50, 200],
  // Pintura
  'pintura interior': [15, 40],
  'pintura fachada': [20, 60],
  // Carpintaria
  'porta entrada': [1500, 5000],
  'janela vidro duplo': [350, 1000],
  'portao automatico': [1500, 5000],
  // Coberturas
  'substituicao telhas': [60, 130],
  // Limpeza, alvenaria, espaços verdes…
  // …
}
```

Liste complète couvrant les domaines présents dans `SYSTEM_PROMPT_PT` (canalização, eletricidade, pintura, carpintaria/serralharia, fechaduras, elevadores, coberturas, espaços verdes, limpeza, alvenaria) — ~80 entrées. Granularité = mots‑clés normalisés sans accent, matching `>= 50%` des mots de la clé.

### 5.4 Validation NIF PT (lib/nif-pt.ts)

Algorithme officiel AT — modulo 11 — décrit dans le décret‑lei du système NIF :

```ts
export function validateNif(raw: string): boolean {
  const nif = (raw || '').replace(/\D/g, '')
  if (nif.length !== 9) return false
  if (!/^[125689]/.test(nif)) return false  // chiffre 1 valide pour particuliers/PJ/EI
  const digits = nif.split('').map(Number)
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0)
  const check = 11 - (sum % 11)
  const expected = check >= 10 ? 0 : check
  return digits[8] === expected
}

export function extractNif(text: string): string | null {
  const m = text.match(/\b(\d{3})\s?(\d{3})\s?(\d{3})\b/g) || []
  for (const candidate of m) {
    const clean = candidate.replace(/\s/g, '')
    if (validateNif(clean)) return clean
  }
  return null
}
```

Premiers chiffres officiels :
- 1, 2 → particulier
- 5 → personne morale (NIPC)
- 6 → administration publique
- 8 → empresário em nome individual (EI)
- 9 → autres pessoas coletivas (associações, condomínios)

Pas d'appel réseau → testable offline.

### 5.5 Messages de négociation (PT)

```ts
function negoMessage(critereId: string, label: string): string {
  return `O seu orçamento não menciona : ${label}. Pode acrescentar esta informação ?`
}
function negoPriceMessage(p: PrixDetail): string {
  const intensite = p.status === 'excessif' ? 'muito ' : ''
  return `O preço de "${p.designation}" (${p.prix} €) parece ${intensite}elevado face ao mercado PT (${p.fourchette_min}-${p.fourchette_max} €). É negociável ?`
}
```

### 5.6 Signature publique

```ts
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean }
): AnalyseScores
```

`rawText` (le texte du PDF) est passé en plus parce que la détection avec fallback texte brut le requiert.

## 6. Patch route API

[app/api/syndic/analyse-devis/route.ts:476-485](app/api/syndic/analyse-devis/route.ts:476)

Avant :
```ts
const siretResult = isPt ? { verified: false } : await verifySiret(...)
const scores = calculateScores(presentes, manquantes, extracted, siretResult.verified)
```

Après :
```ts
let scores: AnalyseScores
if (isPt) {
  const { validateNif } = await import('@/lib/nif-pt')
  const nifRaw = (extracted.artisan_siret as string) || ''
  const nifVerified = validateNif(nifRaw)
  const { calculateScoresPt } = await import('@/lib/analyse-devis-scoring-pt')
  scores = calculateScoresPt(extracted, content, { nifVerified })
} else {
  const siretResult = await verifySiret((extracted.artisan_siret as string) || '', req)
  scores = calculateScores(
    (extracted.mentions_presentes || []) as string[],
    (extracted.mentions_manquantes || []) as string[],
    extracted,
    siretResult.verified,
  )
}
```

Le `siret` field de la réponse devient `{ verified: nifVerified }` côté PT — pas besoin de modifier le typage TS partagé.

## 7. Patch sidebar

[components/syndic-dashboard/config.ts:40](components/syndic-dashboard/config.ts:40) — utiliser la clé `t('syndic.menu.analyse_orcamento')` (français : "Analyse Devis/Factures", portugais : "Análise Orçamentos/Faturas"). Si le composant ne lit pas déjà la traduction, on patche au point de rendu (vérification en phase implémentation).

## 8. UI — composant existant

`AnalyseDevisSection.tsx` lit déjà `scores.conformite.details[].label` et l'affiche tel quel : **aucun changement nécessaire** car les `label` PT viennent désormais directement du backend. Vérifier néanmoins :
- Les sous‑titres ("Pontuações da análise", "Detalhe da conformidade", etc.) sont déjà traduits via `t()` (à confirmer)
- Le seuil d'affichage du badge "negocier/devis_vitfix" reste cohérent (la logique d'action est partagée)

Si certains sous‑titres restent FR (ex. "Detalhe da conformidade" est PT mais "Pontuações da análise" peut sortir d'un autre chemin), on les corrige dans le même PR avec `t()`.

## 9. Plan de tests (TDD)

### 9.1 `tests/lib/nif-pt.test.ts`

```ts
describe('validateNif', () => {
  it('accepts a real PT NIF (Frédéric)', () => expect(validateNif('276873297')).toBe(true))
  it('accepts spaces', () => expect(validateNif('276 873 297')).toBe(true))
  it('rejects wrong checksum', () => expect(validateNif('276873298')).toBe(false))
  it('rejects too short', () => expect(validateNif('123456')).toBe(false))
  it('rejects FR SIRET 14 chiffres', () => expect(validateNif('12345678901234')).toBe(false))
  it('rejects empty', () => expect(validateNif('')).toBe(false))
})
describe('extractNif', () => {
  it('extracts NIF from PDF body', () => expect(extractNif('NIF : 276 873 297\nMorada : …')).toBe('276873297'))
  it('returns null when no valid NIF', () => expect(extractNif('Random text 111 222 333')).toBeNull())
})
```

### 9.2 `tests/lib/analyse-devis-scoring-pt.test.ts`

Fixture 1 — PDF Lobão Motorline (extrait minimal collé en const) :
```ts
it('PDF Vitfix Artisan PT conforme obtient score ≥ 80/100', () => {
  const result = calculateScoresPt(extractedLobao, rawTextLobao, { nifVerified: true })
  expect(result.conformite.total / result.conformite.max).toBeGreaterThanOrEqual(0.8)
  expect(result.conformite.details.find(c => c.id === 'nif')?.status).toBe('ok')
  expect(result.conformite.details.find(c => c.id === 'iva')?.status).toBe('ok')
  expect(result.conformite.details.find(c => c.id === 'garantia_legal')?.status).toBe('ok')
  expect(result.conformite.details.find(c => c.id === 'livre_resolucao')?.status).toBe('ok')
  expect(result.conformite.details.find(c => c.id === 'rgpd')?.status).toBe('ok')
})

it('Alvará non applicable pour montant < 16750 €', () => {
  const result = calculateScoresPt({...lobao, montant_ht: 1350}, raw, { nifVerified: true })
  expect(result.conformite.details.find(c => c.id === 'alvara')?.status).toBe('na')
})

it('Seguro RC absent + Recibos Verdes → partial (pas missing)', () => {
  const result = calculateScoresPt(lobaoSansSeguro, rawWithRecibos, { nifVerified: true })
  expect(result.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('partial')
})

it('NIF invalide → status missing', () => {
  const result = calculateScoresPt({...lobao, artisan_siret: '111111111'}, raw, { nifVerified: false })
  expect(result.conformite.details.find(c => c.id === 'nif')?.status).toBe('missing')
})

it('Messages de négociation sortent en PT', () => {
  const result = calculateScoresPt(degradeExtracted, degradeRaw)
  expect(result.messages_negociation[0]).toMatch(/orçamento|preço/i)
  expect(result.messages_negociation.join(' ')).not.toMatch(/votre|prix/i)
})

it('Fourchettes prix matchent les prestations PT', () => {
  const result = calculateScoresPt(lobaoExt, raw, { nifVerified: true })
  const motoriz = result.prix.details.find(d => /motorline|motorizac/i.test(d.designation))
  expect(motoriz?.status).not.toBe('inconnu')
})
```

Cible : 8‑10 tests, RED en l'absence de code → GREEN après implémentation.

### 9.3 Régression FR — non‑touchée

`tests/lib/analyse-devis-scoring.test.ts` (si existe) reste tel quel. Si absent, on n'en crée pas dans ce PR (hors scope).

## 10. Critères de succès

1. Re‑test manuel avec `Orcamento-Lobao-Motorline-Lince.pdf` :
   - Conformidade legal ≥ 80/100
   - NIF détecté ✅ `276 873 297`
   - IVA, garantia legal, livre resolução, RGPD, REEE tous ✅
   - Detalhe affiche les **labels PT** uniquement
   - Messages négo en PT
2. Tests unitaires verts : `npm run test -- analyse-devis-scoring-pt` et `nif-pt`
3. Build prod OK : `npm run build:cloudflare`
4. Lint OK : `npm run lint`
5. Aucun changement de comportement côté FR — un grep `'analyse-devis-scoring'` montre 0 modif sur le fichier original

## 11. Hors scope explicite

- Refonte côté FR
- API NIF AT/Portal das Finanças (futur)
- Cas BTP (`useBtpDesign`) — sera adressé après
- Refonte UI de la card "Verificação da empresa" — séparé
- Sidebar i18n complète — patch minimal seulement

## 12. Risques

| Risque | Mitigation |
|---|---|
| Faux positifs sur détection par mots‑clés brut texte | Fallback `rawText` seulement quand `mentions_presentes` ne contient pas l'item ; status `partial` si signal ambigu |
| Fourchettes PT incomplètes (cas réel non couvert) | Status `inconnu` ne pénalise pas le score prix (déjà géré côté FR) |
| LLM extrait NIF dans `artisan_siret` mais avec parasites | `extractNif()` + `validateNif()` filtrent |
| Régression côté FR | Aucune ligne touchée dans `analyse-devis-scoring.ts` (FR). Diff = 0 sur ce fichier |

## 13. Commit / PR

Branche : `claude/gracious-golick-3e570b` (worktree courant)
Préfixe commit : `fix(shared): syndic analyse orçamento PT — moteur scoring localisé, NIF PT, fourchettes PT`
(`shared` car la route API touche les deux branches via dispatch, même si la logique métier PT est isolée)
