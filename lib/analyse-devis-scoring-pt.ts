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
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
export function has(
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
// Les implémentations complètes arrivent dans Tasks 5-8.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  void extracted; void rawText; void options
  return {
    conformite: { total: 0, max: 0, details: [] },
    prix: { ecart_moyen_pct: 0, details: [] },
    confiance: 0,
    action_recommandee: 'valider',
    messages_negociation: [],
  }
}

export type { ConformiteCritere, PrixDetail, ScoreConformite, ScorePrix, AnalyseScores }
