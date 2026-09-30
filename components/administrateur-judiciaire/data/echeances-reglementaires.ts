import type { StatutEcheanceReglementaire } from '@/lib/administrateur-judiciaire/domain/calendrier-reglementaire'

/**
 * Échéance réglementaire : date « JJ/MM/AAAA ». Le statut initial n'est retenu que s'il vaut « conforme » :
 * les autres sont recalculés à l'affichage par statutEcheanceReglementaire selon le jour courant.
 */
export type EcheanceReglementaireDemo = [
  obligation: string,
  fondement: string,
  copropriete: string,
  date: string,
  statutInitial: StatutEcheanceReglementaire,
]

export const DEMO_ECHEANCES_REGLEMENTAIRES: EcheanceReglementaireDemo[] = [
  ['Assemblée générale annuelle', 'Loi 1965, art. 14-1', 'Le Clos des Vignes', '22/07/2026', 'à venir'],
  ['Approbation des comptes', 'Loi 1965, art. 14-3', 'Le Méridien', '08/06/2026', 'proche'],
  ['Contrôle technique ascenseur', 'Décret 2004-964', 'Villa Montaigne', '18/01/2026', 'en retard'],
  ['DPE collectif', 'Loi Climat & Résilience', 'Les Tilleuls', '31/12/2026', 'à venir'],
  ['Télédéclaration registre', 'CCH L711-1', 'Le Clos des Vignes', '30/06/2026', 'proche'],
  ['Vérification sécurité incendie', 'Arrêté 31/01/1986', 'Le Méridien', '15/09/2026', 'conforme'],
]

export const PILL_PAR_STATUT_ECHEANCE_REGLEMENTAIRE: Record<StatutEcheanceReglementaire, 'gold' | 'amber' | 'rust' | 'sage'> = {
  'à venir': 'gold',
  proche: 'amber',
  'en retard': 'rust',
  conforme: 'sage',
}
