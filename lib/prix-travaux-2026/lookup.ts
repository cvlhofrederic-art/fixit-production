// lib/prix-travaux-2026/lookup.ts

import { PRIX_2026 } from '@/lib/prix-travaux-2026'
import type { Metier, PriceLine, Unit, PriceLineConditions } from './types'

export type LookupArgs = {
  description: string
  metierHint?: Metier
  surface?: number
  keywords?: string[]
}

export type VariantCandidate = {
  taskId: string
  label: string
  unit: Unit
  conditions?: PriceLineConditions
  description?: string
  metier: Metier
}

// Normalise une chaîne pour matching insensible aux accents (peinturé → peinture).
// NFD décompose les caractères accentués (é → e + ́), puis on supprime les diacritiques
// (range U+0300-U+036F = combining diacritical marks).
function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function lookupVariants(args: LookupArgs): VariantCandidate[] {
  const desc = normalizeForMatch((args.description || '').trim())
  if (!desc && !args.metierHint) return []

  const hintedMetiers = new Set<string>([
    'plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage',
    'maconnerie', 'couverture', 'menuiserie', 'chauffage', 'paysagisme',
  ])
  if (args.metierHint && !hintedMetiers.has(args.metierHint)) return []

  let candidates: PriceLine[] = PRIX_2026
  if (args.metierHint) {
    candidates = candidates.filter(l => l.metier === args.metierHint)
  }

  if (typeof args.surface === 'number' && args.surface > 0) {
    const s = args.surface
    candidates = candidates.filter(l => {
      const min = l.conditions?.surfaceMin ?? 0
      const max = l.conditions?.surfaceMax ?? Infinity
      return s >= min && s <= max
    })
  }

  const scored = candidates
    .map(line => ({ line, score: scoreLine(line, desc, args.keywords) }))
    .filter(s => s.score > 0 || !!args.metierHint)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return scored.map(({ line }) => ({
    taskId: line.taskId,
    label: line.label,
    unit: line.unit,
    conditions: line.conditions,
    description: line.description,
    metier: line.metier,
  }))
}

function scoreLine(line: PriceLine, desc: string, extraKw?: string[]): number {
  let score = 0
  // desc est déjà normalisé par lookupVariants ; normaliser aussi label/description/keywords.
  const haystackLabel = normalizeForMatch(line.label)
  const haystackDesc = normalizeForMatch(line.description ?? '')
  const lineKw = line.conditions?.keywords?.map(normalizeForMatch) ?? []

  // Mots-clés explicites de la ligne (pondération 3)
  for (const k of lineKw) {
    if (desc.includes(k)) score += 3
  }
  // Tokens du label (pondération 2)
  for (const tok of haystackLabel.split(/\s+/).filter(t => t.length > 3)) {
    if (desc.includes(tok)) score += 2
  }
  // Tokens de la description (pondération 1)
  for (const tok of haystackDesc.split(/\s+/).filter(t => t.length > 3)) {
    if (desc.includes(tok)) score += 1
  }
  // Keywords passés en argument (pondération 2)
  if (extraKw) {
    for (const k of extraKw) {
      const kl = k.toLowerCase()
      if (lineKw.some(lk => lk.includes(kl) || kl.includes(lk))) score += 2
    }
  }
  return score
}
