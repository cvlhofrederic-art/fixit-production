# Simulateur de devis FR 2026 — Refonte précision et anti-hallucination

**Date** : 2026-04-27
**Périmètre** : partie FR uniquement (PT et EN dans une phase ultérieure)
**Composants impactés** : `app/api/simulateur-travaux/route.ts`, `lib/prix-travaux.ts` (deprecated), `components/simulateur/SimulateurChat.tsx`, `components/client-dashboard/pages/ClientSimulateurSection.tsx`

## Contexte et objectifs

Le simulateur de devis actuel utilise Groq Llama 3.3 70B avec un system prompt embarquant les prix et coefficients. Cette architecture présente trois faiblesses majeures :

1. **Hallucinations** : le LLM invente régulièrement des chiffres ou applique mal les coefficients
2. **Fourchettes larges** : certaines tâches affichent des spreads de 80-100 % (ex: PAC air-eau 8 000-15 000 €), peu utilisables pour le client
3. **Données 2024-2025** vieillissantes, sans traçabilité des sources, et MO seule (matériaux exclus)

**Objectifs de la refonte** :

- Tous les prix mis à jour en **2026** (MO chargée + matériaux + charges société + marge), all-in TTC
- **Fourchettes serrées : 20 % d'écart maximum** entre `priceMin` et `priceMax` sur chaque ligne
- **Couverture France entière** avec coefficients régionaux pour expansion territoriale
- **Architecture anti-hallucination cryptographique** : les chiffres ne viennent jamais du LLM
- **Traçabilité par source** : chaque ligne audit-able vers ≥2 sources fiables (Tier 1+2)
- **Aides 2026 intégrées** : MaPrimeRénov', CEE, TVA réduite, éco-PTZ → affichage "net après aides"
- **20 corps de métier Vitfix FR**, ~326 sous-variantes pour respecter le 20 %

## Décisions architecturales validées

| Décision | Choix | Justification |
|---|---|---|
| Stratégie de précision | **A : sous-segmentation par variante** | Sous-types fins (PAC 8/11/14 kW) au lieu de coefficients larges |
| Couverture géographique | **France entière + 9 zones régionales** | Expansion territoriale visée à terme |
| Source des prix | **Tier 1 (Batiprix, INSEE BT, Capeb, FFB) + Tier 2 (France Rénov', plateformes pros) + Tier 3 (distributeurs)** | Cross-check 3 niveaux, médiane Tier 1 si divergence >25 % |
| Architecture IA | **Strict tool-calling, prix jamais dans le prompt** | Élimine les hallucinations à la racine |
| Anti-hallucination renforcée | **Token substitution post-stream** | Le LLM utilise des placeholders, le serveur substitue les vrais chiffres |
| Aides | **Intégrées dès Phase 1** | Différenciation forte vs concurrents qui n'affichent que le brut |
| Calibration interne Vitfix | **Reportée Phase 2 ultérieure** | Volume de devis insuffisant aujourd'hui, à reprendre dans ~12 mois |
| Source acquisition | **Hybride : Batiprix payant Y1 + free Tier 1** | 600 € de Batiprix la 1re année pour qualité maximale |

## 1. Modèle de données — `lib/prix-travaux-2026.ts`

### Schema TypeScript

```typescript
// lib/prix-travaux-2026.ts

export type Metier =
  | 'plomberie' | 'electricite' | 'peinture' | 'plaquiste' | 'carrelage'
  | 'maconnerie' | 'couverture' | 'menuiserie' | 'serrurerie' | 'vitrerie'
  | 'chauffage' | 'climatisation' | 'paysagisme' | 'piscine' | 'ramonage'
  | 'nettoyage' | 'store-banne' | 'desamiantage' | 'photovoltaique' | 'ite'

export type Unit = 'm2' | 'ml' | 'unite' | 'forfait' | 'jour' | 'm3' | 'heure'

export type Gamme = 'economique' | 'standard' | 'premium'
export type Etat = 'bon' | 'use' | 'tres-degrade'
export type TvaRate = 5.5 | 10 | 20

export type Source = {
  name: string                    // ex: "Batiprix 2026 — Édition janvier"
  tier: 1 | 2 | 3
  url?: string
  excerpt?: string                // citation directe du chiffre extrait
  accessedAt?: string             // ISO date d'accès source
}

export type CostBreakdown = {
  mainOeuvreHeures: number        // ex: 24
  mainOeuvreTauxHoraire: number   // ex: 55 (€/h chargé PACA standard)
  materiaux: number               // ex: 9800 (€)
  chargesEntreprise: number       // % inclus dans MO chargée (info seulement, ex: 60)
  margeNette: number              // % marge artisan, ex: 10
}

export type AidesEligibles = {
  maPrimeRenov?: {
    barème: 'bleu' | 'jaune' | 'violet' | 'rose'
    forfaits: { bleu: number; jaune: number; violet: number; rose: number }
    plafonds?: number             // plafond travaux éligible
  }
  cee?: {
    forfaitParUnite: number       // ex: 4500 € pour PAC air-eau
    operationStandard: string     // ex: "BAR-TH-104"
  }
  tvaReduite?: 5.5 | 10           // TVA applicable au lieu de 20%
  ecoPTZ?: boolean
}

export type PriceLine = {
  // Identité
  metier: Metier
  taskId: string                  // ex: "pac-air-eau-11kw"
  label: string                   // ex: "PAC air-eau 11 kW (maison 120-160 m²)"
  unit: Unit
  description?: string            // détail technique pour l'IA

  // Décomposition coût (auditabilité)
  cost: CostBreakdown

  // Fourchette finale all-in PACA standard bon état
  priceMin: number
  priceMax: number
  priceUnit: 'EUR_HT' | 'EUR_TTC'
  tva: TvaRate

  // Conditions de matching
  conditions?: {
    surfaceMin?: number
    surfaceMax?: number
    keywords?: string[]
    requiresFollowUp?: string[]   // questions IA si la ligne match
  }

  // Aides éligibles (rénovation énergétique)
  aidesEligibles?: AidesEligibles

  // Auditabilité
  sources: Source[]               // ≥2 sources, ≥1 Tier 1
  lastVerified: string            // ISO date "2026-04-27"
  confidence: 'high' | 'medium' | 'low'
  notes?: string
}

export type ZoneCoefficient = {
  code: 'IDF-PARIS' | 'IDF-GRANDE-COURONNE' | 'PACA' | 'AURA-METROPOLES'
        | 'OCC-METROPOLES' | 'GRAND-OUEST' | 'RURAL-FRANCE' | 'DOM' | 'STANDARD-FRANCE'
  label: string
  departements: string[]          // codes INSEE
  multiplier: number
  source: string
  lastVerified: string
}

export type GammeCoefficient = {
  level: Gamme
  multiplier: 0.90 | 1.00 | 1.15  // resserré pour préserver le 20% combiné
  description: string
}

export type EtatCoefficient = {
  level: Etat
  multiplier: 1.00 | 1.10 | 1.25
  description: string
}

export const PRIX_2026: PriceLine[] = [/* ~326 lignes */]
export const COEFFICIENTS_ZONE_2026: ZoneCoefficient[] = [/* 9 zones */]
export const COEFFICIENTS_GAMME_2026: GammeCoefficient[] = [/* 3 niveaux */]
export const COEFFICIENTS_ETAT_2026: EtatCoefficient[] = [/* 3 niveaux */]
```

### Décomposition coût — formule

Pour chaque ligne, le `priceMin/Max` est dérivé du `cost` selon :

```
coûtBrut    = (mainOeuvreHeures × mainOeuvreTauxHoraire) + materiaux
coûtFinal   = coûtBrut × (1 + margeNette/100)
TTC         = coûtFinal × (1 + tva/100)
priceMin    = TTC × 0.92        // borne basse (artisans plus compétitifs)
priceMax    = TTC × 1.08        // borne haute (≤20% spread)
```

Le spread `(priceMax − priceMin) / priceMin` est ainsi garanti ≤ 17,4 % en théorie, ≤ 20 % en pratique avec arrondis.

### Coefficients zones France

| Code | Régions | Coef |
|---|---|---|
| `IDF-PARIS` | 75, 92, 93, 94 | 1.30 |
| `IDF-GRANDE-COURONNE` | 77, 78, 91, 95 | 1.18 |
| `AURA-METROPOLES` | 69 (Lyon), 38 (Grenoble) | 1.10 |
| `PACA` | 13, 83, 84, 06, 04, 05 | 1.05 |
| `OCC-METROPOLES` | 31 (Toulouse), 34 (Montpellier) | 1.02 |
| `GRAND-OUEST` | 44, 35, 33 | 1.00 |
| `STANDARD-FRANCE` | tout le reste | 1.00 |
| `RURAL-FRANCE` | départements <100 hab/km² | 0.92 |
| `DOM` | 971, 972, 973, 974, 976 | 1.40 |

### Coefficients gamme et état (resserrés)

```typescript
GAMME_2026 = [
  { level: 'economique', multiplier: 0.90, description: 'Matériaux d\'entrée de gamme, finitions standard' },
  { level: 'standard',   multiplier: 1.00, description: 'Milieu de gamme, marques reconnues' },
  { level: 'premium',    multiplier: 1.15, description: 'Haut de gamme, finitions soignées' }
]

ETAT_2026 = [
  { level: 'bon',           multiplier: 1.00 },
  { level: 'use',           multiplier: 1.10, description: 'Travaux préparatoires modérés' },
  { level: 'tres-degrade',  multiplier: 1.25, description: 'Reprises lourdes, dépose préalable' }
]
```

## 2. Architecture IA — tool-calling anti-hallucination

### Stack et flux

- **Provider** : Groq Llama 3.3 70B avec tool-calling natif (déjà supporté)
- **Streaming** : SSE conservé pour l'UX actuelle
- **System prompt** : ~600 tokens (vs ~2000 actuels), aucun chiffre

### Les 3 outils exposés au LLM

```typescript
// app/api/simulateur-travaux/tools.ts

/**
 * Recherche les variantes de prix pertinentes pour une description
 */
export function lookupVariants(args: {
  description: string
  metierHint?: Metier
  surface?: number
  keywords?: string[]
}): Array<{
  taskId: string
  label: string
  unit: Unit
  conditions?: PriceLine['conditions']
  description?: string
  metier: Metier
}>

/**
 * Calcule un devis déterministe à partir d'items et paramètres
 */
export function computeQuote(args: {
  items: Array<{ taskId: string; qty: number }>
  region: string                  // code dpt INSEE ou nom région
  postalCode?: string             // alternative au code dpt
  gamme: Gamme
  etat: Etat
  aidesContext?: {
    foyerTaille?: number
    revenusFiscaux?: number       // pour barème MPR
    typeLogement?: 'principal' | 'locatif'
    ageLogement?: number          // pour TVA 10%
  }
}): {
  totalMin: number                // brut TTC
  totalMax: number
  totalNetMin?: number            // après aides estimées
  totalNetMax?: number
  spreadPercent: number           // ≤ 20
  breakdown: Array<{
    taskId: string
    label: string
    qty: number
    unit: Unit
    unitPriceMin: number
    unitPriceMax: number
    lineMin: number
    lineMax: number
    aidesLineMax?: number
  }>
  aidesDeduites?: {
    maPrimeRenov: number
    cee: number
    tvaEconomie: number           // économie vs TVA 20%
    ecoPTZ: { eligible: boolean; montantMax?: number }
    total: number
  }
  aidesConditions?: string[]      // explications affichées
  zoneCoef: number
  gammeCoef: number
  etatCoef: number
  zoneDetected: ZoneCoefficient['code']
  tvaApplicable: TvaRate
  sources: Source[]
  warnings?: string[]
  mode: 'normal' | 'out-of-catalog'
  artisanRate?: { min: number; max: number; unit: 'EUR_TTC_par_heure' }
}

/**
 * Vérifie la cohérence d'un devis avant affichage (garde-fou final)
 */
export function validateQuote(quote: ReturnType<typeof computeQuote>): {
  ok: boolean
  reasons?: string[]
}
```

### Anti-hallucination par token substitution

**Principe** : le LLM streame ses réponses avec des **placeholders typés**. Le serveur intercepte le SSE, substitue les placeholders par les valeurs réelles issues du dernier `computeQuote`, puis flush vers le client.

**Format des placeholders** :

| Placeholder | Substitué par |
|---|---|
| `{TOTAL_MIN}` / `{TOTAL_MAX}` | totaux bruts TTC |
| `{TOTAL_NET_MIN}` / `{TOTAL_NET_MAX}` | totaux nets après aides |
| `{LINE_<taskId>_MIN}` / `{LINE_<taskId>_MAX}` | montants par poste |
| `{AIDES_TOTAL}` | montant total aides déduites |
| `{ARTISAN_RATE_MIN}` / `{ARTISAN_RATE_MAX}` | taux horaire en mode out-of-catalog |

**System prompt règle stricte** :
> Tu dois utiliser EXCLUSIVEMENT les placeholders fournis dans tes messages contenant des chiffres. Tout nombre tapé directement (ex: "1000") déclenchera un rejet de ton message. Format autorisé pour les chiffres : uniquement `{PLACEHOLDER}`. Format interdit pour les chiffres : tout chiffre brut, "à partir de X", "environ Y", etc.

**Validation serveur** (pseudo-code illustratif — la regex finale devra distinguer les chiffres-prix des dates/unités/quantités via contexte symbole € ou mot-clé prix) :

```typescript
// app/api/simulateur-travaux/route.ts (extrait)

const PLACEHOLDER_PATTERN = /\{([A-Z_]+)\}/g
// Capture les chiffres SUIVIS du symbole € (avec espace/insécable optionnel)
// Évite de matcher dates "2026", surfaces "30 m²", puissances "8 kW"
const RAW_PRICE_PATTERN = /\b\d{2,}(?:[  ]\d{3})*(?:[.,]\d+)?\s*€/g

function validateAndSubstitute(streamChunk: string, ctx: ComputeQuoteResult): string {
  // 1. Rejette si prix-en-euros brut détecté hors placeholder
  const rawMatches = streamChunk.match(RAW_PRICE_PATTERN)
  if (rawMatches && rawMatches.length > 0) {
    logger.warn('LLM hallucinated raw price', { chunk: streamChunk, matches: rawMatches })
    Sentry.captureMessage('simulateur-hallucination', { extra: { chunk: streamChunk } })
    return '' // skip ce chunk
  }
  // 2. Substitue les placeholders par les vraies valeurs
  return streamChunk.replace(PLACEHOLDER_PATTERN, (m, key) => {
    const value = resolvePlaceholder(key, ctx)
    return value !== null ? formatEUR(value) : m  // garde tel quel si inconnu (détecté en QA)
  })
}
```

### Auto-fill profil connecté

Pour un client connecté avec `user.user_metadata.postal_code` rempli :

```typescript
// components/simulateur/SimulateurChat.tsx (extrait)

const initialContext = user?.user_metadata?.postal_code ? {
  postalCode: user.user_metadata.postal_code,
  city: user.user_metadata.city,
  region: detectRegion(user.user_metadata.postal_code),  // → 'PACA'
} : null

// Passé en hidden context au système IA dans la 1re requête.
// Confidentialité : seul le code postal (5 chiffres) atteint le LLM, pas l'adresse rue.
```

Comportement IA :

- Connecté + adresse complète → ouvre par *"J'ai bien noté que votre projet concerne **Marseille (13008)**. Vous confirmez ?"* (1 question évitée)
- Connecté sans adresse → demande comme aujourd'hui, propose CTA *"Enregistrer cette adresse à votre profil"*
- Anonyme → demande comme aujourd'hui

## 3. Périmètre — 20 métiers, ~326 sous-variantes

### Métiers couverts

| # | Métier | Sous-variantes |
|---|---|---|
| 1 | Plomberie (incl. débouchage) | ~25 |
| 2 | Électricité (incl. borne recharge) | ~25 |
| 3 | Peinture | ~20 |
| 4 | Plaquiste (incl. isolation int.) | ~15 |
| 5 | Carrelage | ~20 |
| 6 | Maçonnerie / Ravalement | ~25 |
| 7 | Couverture / Toiture | ~20 |
| 8 | Menuiserie | ~25 |
| 9 | Serrurerie | ~12 |
| 10 | Vitrerie *(nouveau)* | ~10 |
| 11 | Chauffage | ~25 |
| 12 | Climatisation *(extrait du chauffage)* | ~12 |
| 13 | Paysagisme / Élagage | ~25 |
| 14 | Pisciniste | ~15 |
| 15 | Ramonage | ~8 |
| 16 | Nettoyage / Débarras | ~12 |
| 17 | Store Banne / Pergola | ~10 |
| 18 | Désamiantage / Diagnostic plomb *(nouveau)* | ~6 |
| 19 | Photovoltaïque *(nouveau)* | ~10 |
| 20 | Isolation Thermique Extérieure *(nouveau)* | ~8 |

### Méta-catégories (bundles)

- **Rénovation complète** : 3 niveaux (légère / moyenne / lourde) au m², bundle de taskIds
- **Rénovation cuisine complète** : 3 niveaux (économique / standard / premium)
- **Rénovation SdB complète** : déjà couvert par Plomberie
- **Petits Travaux** : forfait artisan polyvalent ½ journée / journée / 2 jours

### Mode "out-of-catalog"

Si `lookupVariants` retourne vide, `computeQuote` renvoie `mode: 'out-of-catalog'` avec un `artisanRate` régional. UI affiche un bandeau ambre avec CTA Bourse aux Marchés.

## 4. Sources, fiabilité, maintenance

### Hiérarchie de sources

**Tier 1 — Référence absolue**
- **Batiprix** (édition Le Moniteur 2026) — bordereau de référence du BTP français (acquisition payante ~600 €/an Y1)
- **CAPEB** — taux horaires régionaux officiels
- **FFB** — observatoire des prix
- **INSEE** — index BT01-BT53 2026

**Tier 2 — Plateformes pros**
- **France Rénov'** (govt) — barèmes officiels rénovation énergétique
- **Travaux.com** (Habitatpresto) — agrégat 600k devis/an
- **Quotatis** — agrégat
- **MaPrimeRénov'** (govt) — barèmes officiels

**Tier 3 — Distributeurs (cross-check matériaux)**
- Point.P, Cedeo, Lapeyre, Castorama, Leroy Merlin, ManoMano Pro

**Sources exclues** : forums (Forum Construire), blogs personnels, sites US/UK/CA convertis, comparateurs sponsorisés.

### Méthodologie de production d'une ligne

1. Extraire ≥2 sources Tier 1 avec citation directe
2. Cross-check Tier 2 ; si écart >25 % avec Tier 1, retenir médiane Tier 1 et logger l'écart en `notes`
3. Décomposer en `cost` (MO chargée + matériaux + marge)
4. Appliquer formule : `priceMin = TTC × 0.92`, `priceMax = TTC × 1.08`
5. Renseigner `aidesEligibles` si métier de rénovation énergétique
6. Tagger `confidence: high | medium | low` selon convergence des sources
7. `lastVerified` = ISO date du jour

### Tests CI — `tests/prix-travaux-2026.test.ts`

```typescript
describe('prix-travaux-2026 data integrity', () => {
  it('every line has spread ≤ 20%', () => {
    PRIX_2026.forEach(line => {
      const spread = (line.priceMax - line.priceMin) / line.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('every line has ≥2 sources, with ≥1 Tier 1', () => {
    PRIX_2026.forEach(line => {
      expect(line.sources.length).toBeGreaterThanOrEqual(2)
      expect(line.sources.some(s => s.tier === 1)).toBe(true)
    })
  })

  it('every line has lastVerified within 730 days', () => { /* ... */ })
  it('warns on lines older than 365 days', () => { /* warning, not error */ })
  it('every taskId is unique', () => { /* ... */ })
  it('every metier has at least 3 variants', () => { /* ... */ })
  it('cost decomposition sums match priceMin within ±5%', () => { /* ... */ })
  it('TVA value is 5.5, 10, or 20 only', () => { /* ... */ })
  it('aidesEligibles only on energy renovation metiers', () => { /* ... */ })
})
```

Tests bloquants en CI via `tests.yml` (workflow existant). PR ne peut merger si 20 % cassé.

### Workflow `prix-freshness.yml` (nouveau, hebdomadaire)

- Tourne tous les lundis 8h
- Liste les `taskId` dont `lastVerified > 90 jours`, par lot de 5-10
- Crée une issue GitHub `[Prix 2026 — Refresh hebdo] X lignes à reviewer`
- Issue auto-fermée quand checklist à 0
- Cible : <30 lignes obsolètes en permanence

### Cadence de mise à jour

| Cadence | Action |
|---|---|
| Hebdomadaire | Issue auto pour 5-10 lignes en rotation (~30 sem pour couvrir 326 lignes) |
| Trimestrielle | Revue indices INSEE BT01-BT53 publiés (T1, T2, T3, T4) |
| Annuelle (Q1) | Refresh complet : édition Batiprix + Capeb taux régionaux |

### Documentation `docs/prix-2026-methodology.md`

- Liste exhaustive des sources Tier 1/2/3 avec liens
- Formule de calcul détaillée
- Process de mise à jour pour le futur mainteneur
- Procédure d'audit pour répondre aux litiges client

## 5. UI/UX

### Bandeau d'estimation enrichi

```
┌──────────────────────────────────────────────────────┐
│  💰  Estimation 2026                                 │
│      14 600 € — 17 300 € TTC                         │
│      (PACA, gamme standard, état moyen)              │
│      ─────────────────────────────                   │
│      💚 Aides éligibles : -8 200 €                   │
│      Net estimé : 6 400 € — 9 100 €                  │
│                                                       │
│      ⓘ Voir les sources (3)                          │
└──────────────────────────────────────────────────────┘
```

Tooltip sources : popover affichant les sources Tier 1+2 utilisées avec URLs et `lastVerified`. Critique pour la confiance et la défense en cas de litige.

### Récap final enrichi

| Poste | Détail | Brut TTC | Aide max | Net |
|---|---|---|---|---|
| PAC air-eau 11 kW | Pose + matériel | 12 200-14 500 € | -7 500 € | 4 700-7 000 € |
| Plancher chauffant 80 m² | Pose | 6 400-7 600 € | -700 € | 5 700-6 900 € |
| **TOTAL** | | **18 600-22 100 €** | **-8 200 €** | **10 400-13 900 €** |

### Mode "out-of-catalog" — bandeau ambre

```
┌──────────────────────────────────────────────────────┐
│  ⚠  Projet hors catalogue simulateur                  │
│      Estimation à partir du tarif horaire artisan    │
│      PACA standard : 50-75 € TTC/h                   │
│      Pour 12-16 h estimées : 600 € — 1 200 €         │
│                                                       │
│      → Publier dans la Bourse aux Marchés            │
│        pour devis personnalisé                        │
└──────────────────────────────────────────────────────┘
```

### Composant inchangé structurellement

`ClientSimulateurSection.tsx` continue de monter `<SimulateurChat>`. Le contexte connecté (postal code, city, region) est passé via `initialContext` prop déjà supportée.

## 6. Plan de migration en 6 phases

| Phase | Durée | Contenu |
|---|---|---|
| **0 — Spec & infra** | session courante | Document spec + plan implémentation. **Action utilisateur (non-dev)** : acquisition abonnement Batiprix 2026 (~600 €) avant Phase 1 |
| **1 — Data file bootstrap** | 3-5 j | `lib/prix-travaux-2026.ts` schema + 50 lignes prioritaires + `lib/coefficients-2026.ts` + `lib/aides-2026.ts` + tests CI + `docs/prix-2026-methodology.md` |
| **2 — Tool-calling backend** | 2-3 j | Refactor `app/api/simulateur-travaux/route.ts` + tools + token substitution + tests Vitest + tests E2E + feature flag `SIMULATEUR_V2_ENABLED` |
| **3 — Data file complet** | 5-7 j | Lignes restantes (~276) + bundles méta. Parallélisable Phase 2. |
| **4 — UI enrichie** | 2 j | Bandeau aides + popover sources + récap enrichi + mode out-of-catalog + auto-fill connecté |
| **5 — Bascule production** | 1 j active + 30 j observation | Activation feature flag progressive 10 % → 25 % → 50 % → 100 % avec palier 24-72h chacun, monitoring Langfuse + Sentry, suppression `lib/prix-travaux.ts` après 30 j sans rollback |
| **6 — Maintenance workflow** | 1 j | `prix-freshness.yml` GitHub Actions + issue templates + doc mainteneur |

**Estimation totale : 14-19 jours-homme.** En série : ~3-4 semaines.

## 7. Risques

| Risque | Mitigation |
|---|---|
| Llama 3.3 ne respecte pas le format placeholder | Validation regex stricte serveur, retry 1×, fallback computeQuote direct |
| Sources Tier 1 inaccessibles pour métiers récents (photovoltaïque) | `confidence: low`, spread élargi à 25 % avec disclaimer affiché |
| Coût Groq tool-calling supérieur vs prompt actuel | Mesure perf Phase 2, switch Llama 3.3 70B versatile si coût explose |
| Régression UX sur utilisateurs habitués | Feature flag, bascule progressive 10→25→50→100 %, monitoring Langfuse |
| Désynchronisation prix vs marché réel | Issue refresh hebdo + revue trimestrielle INSEE BT + refresh annuel Batiprix |
| Token substitution incomplète si LLM invente une clé | Placeholders inconnus restent visibles `{LINE_X_MIN}` → détecté en QA, signal d'alarme |
| Aides barèmes mal interprétés (impact financier client) | Disclaimer obligatoire "Estimation indicative, validation finale par opérateur agréé France Rénov'" |

## 8. Définition de done (DoD) Phase 1+2

Le simulateur V2 est considéré shippable quand :

- [ ] 326 lignes saisies, toutes avec ≥2 sources Tier 1+, spread ≤20 %, `lastVerified` <90 jours
- [ ] Tests CI `prix-travaux-2026.test.ts` passent sans warning
- [ ] Token substitution validée : 0 chiffre brut détecté sur 100 conversations test
- [ ] Couverture E2E Playwright sur 5 scénarios canoniques (rénov SdB, rénov complète, PAC, élagage, hors-catalogue)
- [ ] Feature flag `SIMULATEUR_V2_ENABLED` opérationnel
- [ ] Monitoring Langfuse trace 100 % des conversations
- [ ] `docs/prix-2026-methodology.md` complet et reviewé
- [ ] Aucune mention de `lib/prix-travaux.ts` (deprecated) dans le code, hormis fallback feature-flagged

## 9. Phase 2 future (référencée, non scopée ici)

Dans ~12 mois, quand le volume Vitfix de devis signés atteint un seuil critique (~5 000 devis), une Phase 2 sera lancée pour :

- Job nocturne SQL agrégeant les devis signés par `taskId`
- Comparaison médiane Vitfix interne vs `priceMin/priceMax` simulateur
- Issue auto si écart >15 % → recalibration ligne
- À horizon 18 mois, sources externes deviennent sanity-check, donnée Vitfix devient référence
- Suppression progressive de l'abonnement Batiprix payant (économie 600 €/an)

Cette Phase 2 fera l'objet d'un spec séparé.
