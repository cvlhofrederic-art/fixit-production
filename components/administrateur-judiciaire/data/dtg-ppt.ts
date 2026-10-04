export type StatutDtgPpt = 'approuvé' | 'en préparation' | 'à lancer'

/** Diagnostic technique global et plan pluriannuel de travaux : montants en chaînes (« 185 000 € »). */
export type DtgPptCoproprieteDemo = [
  copropriete: string,
  dtg: string,
  horizonPpt: string,
  budgetEstime: string,
  statut: StatutDtgPpt,
]

export const DEMO_DTG_PPT_COPROPRIETES: DtgPptCoproprieteDemo[] = [
  ['Résidence Le Méridien', 'Réalisé (2024)', '10 ans · 2025-2035', '185 000 €', 'approuvé'],
  ['Le Clos des Vignes', 'Réalisé (2025)', '10 ans · 2026-2036', '240 000 €', 'en préparation'],
  ['Copropriété Les Tilleuls', 'À réaliser', '—', '—', 'à lancer'],
  ['Villa Montaigne', 'Réalisé (2023)', '10 ans · 2024-2034', '95 000 €', 'approuvé'],
]

export const PILL_PAR_STATUT_DTG_PPT: Record<StatutDtgPpt, 'sage' | 'amber' | 'rust'> = {
  approuvé: 'sage',
  'en préparation': 'amber',
  'à lancer': 'rust',
}
