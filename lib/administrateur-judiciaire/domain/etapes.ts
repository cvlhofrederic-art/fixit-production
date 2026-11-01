import { ajouterJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Étapes — le moteur de tâches (cartographie Gestéam, tranche 35 : fiche étape). Fonctions pures, dates ISO, sans écran.
 * Prépare le remplacement de la « Tâche » de VitFix (libellé, échéance, assigné) par l'étape de Gestéam.
 *
 * Gestéam — Le, Statut, Titre, Étape type ; Demandeur, Limite ; Instructions ; Réalisation (à faire le, collaborateur, fait
 * le, accusé au demandeur) ; Validation (collaborateur, prévue le, validée le, sans objet le, alerte de sécurité) ; Compte
 * rendu ; bouton Enchaînement.
 * 🔵 Enchaînement modélisé comme une suite ordonnée d'étapes types avec un délai après la réalisation de la précédente.
 */

export interface Etape {
  id: string
  titre: string
  etapeType: string | null
  demandeurId: string
  realisateurId: string | null
  /** Null : pas de validation prévue. */
  validateurId: string | null
  limite: string | null
  alerteSecurite: string | null
  faitLe: string | null
  valideeLe: string | null
  validationSansObjet: boolean
  compteRendu: string
}

export type StatutEtape = 'a_faire' | 'a_valider' | 'validee' | 'terminee'

/** Statut de l'étape et alertes au jour donné. */
export function etatEtape(etape: Etape, aujourdhui: string): { statut: StatutEtape; enRetard: boolean; alerte: boolean } {
  let statut: StatutEtape
  if (!etape.faitLe) statut = 'a_faire'
  else if (!etape.validateurId || etape.validationSansObjet) statut = 'terminee'
  else statut = etape.valideeLe ? 'validee' : 'a_valider'
  const ouverte = statut === 'a_faire'
  return {
    statut,
    enRetard: ouverte && etape.limite !== null && aujourdhui > etape.limite,
    alerte: ouverte && etape.alerteSecurite !== null && aujourdhui >= etape.alerteSecurite,
  }
}

export function realiserEtape(etape: Etape, { date, compteRendu }: { date: string; compteRendu: string }): Etape {
  if (!estDateIsoValide(date)) throw new Error(`Date de réalisation invalide (${date}) : AAAA-MM-JJ attendu.`)
  return { ...etape, faitLe: date, compteRendu: compteRendu.trim() || etape.compteRendu }
}

export function validerEtape(etape: Etape, date: string): Etape {
  if (!etape.faitLe) throw new Error('Validation refusée : l’étape n’est pas encore réalisée.')
  if (!estDateIsoValide(date)) throw new Error(`Date de validation invalide (${date}) : AAAA-MM-JJ attendu.`)
  return { ...etape, valideeLe: date }
}

export interface EtapeTypeProcessus {
  etapeType: string
  titre: string
  /** Délai, en jours, après la réalisation de l'étape précédente. */
  delaiJours: number
}

/** Étape suivante du processus après une étape réalisée ; null en fin de processus ou pour une étape hors processus. */
export function enchainer(etape: Etape, processus: EtapeTypeProcessus[], { id }: { id: string }): Etape | null {
  if (!etape.faitLe) throw new Error('Enchaînement refusé : réaliser d’abord l’étape en cours.')
  const rang = processus.findIndex((p) => p.etapeType === etape.etapeType)
  const suivante = rang >= 0 ? processus[rang + 1] : undefined
  if (!suivante) return null
  return {
    ...etape,
    id,
    titre: suivante.titre,
    etapeType: suivante.etapeType,
    limite: ajouterJours(etape.faitLe, suivante.delaiJours),
    alerteSecurite: null,
    faitLe: null,
    valideeLe: null,
    compteRendu: '',
  }
}
