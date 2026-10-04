import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

export type TeinteRecouvrement = 'sage' | 'amber' | 'rust'

/** Ligne du tableau des appels de fonds : montants formatés par formatEuros, taux « 94 % » (espace ordinaire). */
export type QuotePartAppelFonds = [
  copropriete: string,
  budgetVote: string,
  quotePartMoyenne: string,
  emis: string,
  recouvre: string,
  taux: string,
  teinte: TeinteRecouvrement,
]

/**
 * Calculé au chargement du module à partir des copropriétés de démonstration.
 * Bizarrerie conservée : le montant « émis » est le budget voté lui-même.
 */
export const DEMO_QUOTES_PARTS_APPELS_FONDS: QuotePartAppelFonds[] = DEMO_COPROPRIETES.map((copro) => {
  const emis = copro.budget
  const recouvre = copro.budget - copro.impayes
  const taux = Math.round((recouvre / emis) * 100)
  return [
    copro.nom,
    formatEuros(copro.budget),
    formatEuros(Math.round(copro.budget / copro.lots)),
    formatEuros(emis),
    formatEuros(recouvre),
    taux + ' %',
    taux >= 90 ? 'sage' : taux >= 75 ? 'amber' : 'rust',
  ]
})
