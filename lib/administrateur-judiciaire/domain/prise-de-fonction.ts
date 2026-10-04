import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

export type StatutDiligence = 'Fait' | 'En cours' | 'À faire' | 'Bloqué'

export interface DiligencePriseFonction {
  id: number
  label: string
  art: string
  role: RoleCabinet
  statut: StatutDiligence
}

/** Champs de la copropriété lus pour établir la check-list. */
export interface CoproPriseFonction {
  code: string
  fondement?: string | null
  notifOrdonnance?: string
  impayes: number
}

/**
 * Check-list de prise de fonction (8 diligences). Régime art. 29-1 si le fondement contient « 29-1 » ;
 * compte séparé et immatriculation « À faire » pour Villa Montaigne (code VM), « Fait » sinon.
 * Aucune diligence n'est « Bloqué » au départ.
 */
export const construireChecklistPriseFonction = (copro: CoproPriseFonction): DiligencePriseFonction[] => {
  const ap291 = (copro.fondement || '').includes('29-1')
  return [
    {
      id: 1,
      label: "Notifier l'ordonnance à tous les copropriétaires",
      art: `art. ${ap291 ? '62-5' : '59'} décret 1967 · 1 mois après le prononcé`,
      role: 'Secrétariat',
      statut: copro.notifOrdonnance === 'Effectuée' ? 'Fait' : 'En cours',
    },
    {
      id: 2,
      label: "Se faire remettre archives, fonds et documents par l'ancien syndic",
      art: 'art. 18-2 L. 1965 · trésorerie et références bancaires sous 15 jours, archives sous 1 mois, à défaut référé sous astreinte',
      role: 'Direction',
      statut: 'En cours',
    },
    {
      id: 3,
      label: 'Ouvrir le compte bancaire séparé au nom du syndicat',
      art: ap291
        ? 'art. 18 L. 1965'
        : 'art. 18 II L. 1965 · 3 mois après la désignation, sous peine de nullité du mandat (à confirmer)',
      role: 'Comptabilité',
      statut: copro.code === 'VM' ? 'À faire' : 'Fait',
    },
    {
      id: 4,
      label: "Récupérer le carnet d'entretien et les contrats en cours",
      art: 'décret 2001-477',
      role: 'Gestion',
      statut: 'En cours',
    },
    {
      id: 5,
      label: "Établir l'état daté des impayés et des créances",
      art: 'gestion de la trésorerie reprise',
      role: 'Comptabilité',
      statut: copro.impayes > 0 ? 'En cours' : 'Fait',
    },
    {
      id: 6,
      label: "Vérifier / reprendre l'assurance RC de la copropriété",
      art: 'art. 9-1 L. 1965',
      role: 'Comptabilité',
      statut: 'À faire',
    },
    {
      id: 7,
      label: "Mettre à jour l'immatriculation au registre national",
      art: 'loi ALUR · L.711-2 CCH',
      role: 'Juridique',
      statut: copro.code === 'VM' ? 'À faire' : 'Fait',
    },
    {
      id: 8,
      label: 'Informer fournisseurs et prestataires du changement de gestionnaire',
      art: 'continuité de gestion',
      role: 'Secrétariat',
      statut: 'En cours',
    },
  ]
}
