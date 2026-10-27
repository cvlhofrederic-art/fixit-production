import { ajouterMois, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { FAMILLE_EQUIPEMENT, type FamilleEquipement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Équipements de l'immeuble (cartographie Gestéam, tranche 35 : fiche équipement). Fonctions pures, dates ISO, sans écran.
 *
 * Gestéam — Nature, Famille (FAMILLE_EQUIPEMENT), localisation et clé ; Garantie (durée, début, fin, entreprise) ;
 * Entretien / contrôle (périodicité, dernier, prochain, bouton Effectuer, contrat) ; Remplacement (mise en service,
 * périodicité, hors service).
 * Périodicités et seuil « proche » : données saisies et réglage de gestion ; aucune périodicité légale n'est calculée ici
 * (les contrôles réglementaires relèvent de calendrier-reglementaire.ts).
 */

export interface FicheEquipement {
  nature: string
  famille: FamilleEquipement
  garantie: { debut: string; dureeMois: number } | null
  entretien: { periodiciteMois: number; dernier: string } | null
  remplacement: { miseEnService: string; periodiciteMois: number } | null
}

export type TypeEcheanceEquipement = 'garantie' | 'entretien' | 'remplacement'

export interface EcheanceEquipement {
  type: TypeEcheanceEquipement
  date: string
  jours: number
  statut: 'depassee' | 'proche' | 'a_venir'
}

const verifierDate = (date: string) => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/** Fin de garantie, prochain entretien et remplacement prévu, classés au jour donné (proche : 30 jours par défaut). */
export function echeancesEquipement(
  equipement: FicheEquipement,
  aujourdhui: string,
  { seuilJours = 30 }: { seuilJours?: number } = {},
): EcheanceEquipement[] {
  if (!(FAMILLE_EQUIPEMENT as readonly string[]).includes(equipement.famille))
    throw new Error(`Famille d'équipement inconnue : « ${equipement.famille} ».`)
  verifierDate(aujourdhui)
  const dates: [TypeEcheanceEquipement, string][] = []
  if (equipement.garantie) {
    verifierDate(equipement.garantie.debut)
    dates.push(['garantie', ajouterMois(equipement.garantie.debut, equipement.garantie.dureeMois)])
  }
  if (equipement.entretien) {
    verifierDate(equipement.entretien.dernier)
    dates.push(['entretien', ajouterMois(equipement.entretien.dernier, equipement.entretien.periodiciteMois)])
  }
  if (equipement.remplacement) {
    verifierDate(equipement.remplacement.miseEnService)
    dates.push(['remplacement', ajouterMois(equipement.remplacement.miseEnService, equipement.remplacement.periodiciteMois)])
  }
  return dates
    .map(([type, date]): EcheanceEquipement => {
      const jours = ecartJours(aujourdhui, date)
      return { type, date, jours, statut: jours < 0 ? 'depassee' : jours <= seuilJours ? 'proche' : 'a_venir' }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** « Effectuer » : enregistre un entretien fait à la date, ce qui avance le prochain contrôle. */
export function effectuerEntretien(equipement: FicheEquipement, date: string): FicheEquipement {
  if (!equipement.entretien) throw new Error('Équipement sans entretien périodique défini.')
  verifierDate(date)
  return { ...equipement, entretien: { ...equipement.entretien, dernier: date } }
}
