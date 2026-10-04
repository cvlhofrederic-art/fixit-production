import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Date « JJ/MM/AAAA » de la dernière contribution au fonds de travaux, par nom complet de copropriété. */
export const DEMO_DERNIERE_CONTRIBUTION_FONDS_TRAVAUX: Record<string, string> = {
  'Résidence Le Méridien': '12/03/2026',
  'Le Clos des Vignes': '22/04/2026',
  'Copropriété Les Tilleuls': '05/05/2026',
  'Villa Montaigne': '28/01/2026',
}

export type EtatFondsTravaux = 'suffisant' | 'insuffisant'

export type LigneFondsTravaux = [
  copropriete: string,
  solde: string,
  cotisationAnnuelle: string,
  derniereContribution: string,
  etat: EtatFondsTravaux,
]

/**
 * Calculé au chargement du module : cotisation annuelle = 5 % du budget (arrondie à l'euro) ;
 * « suffisant » si le fonds atteint au moins la cotisation.
 */
export const DEMO_LIGNES_FONDS_TRAVAUX: LigneFondsTravaux[] = DEMO_COPROPRIETES.map((copro) => {
  const cotisation = Math.round(copro.budget * 0.05)
  return [
    copro.nom,
    formatEuros(copro.fondsTravaux),
    formatEuros(cotisation),
    DEMO_DERNIERE_CONTRIBUTION_FONDS_TRAVAUX[copro.nom] || '—',
    copro.fondsTravaux >= cotisation ? 'suffisant' : 'insuffisant',
  ]
})
