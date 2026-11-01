import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Exercices et budgets d'un syndicat (cartographie Gestéam, tranches 25 et 27). Fonctions pures, montants en CENTIMES
 * ENTIERS, sans écran.
 *
 * D1 (27/10/2026) — exercices et budgets appartiennent au SYNDICAT (la copropriété), pas au mandat : ils survivent au
 * changement de mandataire.
 *
 * Gestéam — statut d'exercice : Préparation · Budgété · Voté · Répart. en cours · Réparti · Non géré ; statut IRC
 * (registre d'immatriculation) : Non déclaré · Commencé · Validé · Transmis · Déclaré · En erreur. L'exercice est relié
 * à l'assemblée qui l'approuve et à une résolution par objet (budget, complément, honoraires, travaux votés). Budget :
 * lignes (clé, compte, rubrique) → prévu TTC ; réalisé lu sur les mouvements imputés.
 * 🔵 Le cycle (ordre des cinq premiers statuts) et « Non géré » pour un exercice hors mission sont DÉDUITS.
 */

export const STATUTS_EXERCICE = ['Préparation', 'Budgété', 'Voté', 'Répart. en cours', 'Réparti', 'Non géré'] as const
export type StatutExercice = (typeof STATUTS_EXERCICE)[number]

export const STATUTS_IRC = ['Non déclaré', 'Commencé', 'Validé', 'Transmis', 'Déclaré', 'En erreur'] as const
export type StatutIrc = (typeof STATUTS_IRC)[number]

const CYCLE_EXERCICE: readonly StatutExercice[] = ['Préparation', 'Budgété', 'Voté', 'Répart. en cours', 'Réparti']

export interface ResolutionsExercice {
  budget: string | null
  complement: string | null
  honoraires: string | null
  travaux: string | null
}

export interface SaisieExercice {
  /** D1 : le syndicat. */
  coproprieteId: string
  /** Désignation de l'exercice (l'année chez Gestéam). */
  nom: string
  ouverture: string
  cloture: string
  statut: StatutExercice
  statutIrc: StatutIrc
  /** Assemblée qui approuve le budget. */
  agId: string | null
  resolutions: ResolutionsExercice
}

export type Exercice = SaisieExercice

export function creerExercice(saisie: SaisieExercice): Exercice {
  if (!saisie.coproprieteId.trim()) throw new Error('Exercice sans syndicat : D1 rattache l’exercice à la copropriété.')
  for (const [champ, valeur] of [
    ['ouverture', saisie.ouverture],
    ['clôture', saisie.cloture],
  ] as const)
    if (!estDateIsoValide(valeur)) throw new Error(`Date d'${champ} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
  if (saisie.cloture <= saisie.ouverture) throw new Error('Date de clôture antérieure ou égale à l’ouverture.')
  if (!(STATUTS_EXERCICE as readonly string[]).includes(saisie.statut)) throw new Error(`Statut d'exercice inconnu : « ${saisie.statut} ».`)
  if (!(STATUTS_IRC as readonly string[]).includes(saisie.statutIrc)) throw new Error(`Statut IRC inconnu : « ${saisie.statutIrc} ».`)
  return { ...saisie, nom: saisie.nom.trim() }
}

/**
 * Fait avancer le statut d'une étape. « Voté » exige l'assemblée et la résolution du budget ; « Non géré » ne s'applique
 * qu'à un exercice encore en préparation. Renvoie un nouvel exercice.
 */
export function changerStatutExercice(
  exercice: Exercice,
  nouveau: StatutExercice,
  { agId, resolutionBudget }: { agId?: string; resolutionBudget?: string } = {},
): Exercice {
  if (nouveau === 'Non géré') {
    if (exercice.statut !== 'Préparation') throw new Error('« Non géré » ne s’applique qu’à un exercice en préparation.')
    return { ...exercice, statut: nouveau }
  }
  const rang = CYCLE_EXERCICE.indexOf(exercice.statut)
  if (rang < 0 || CYCLE_EXERCICE.indexOf(nouveau) !== rang + 1)
    throw new Error(`Changement refusé : « ${exercice.statut} » → « ${nouveau} » (une étape en avant seulement).`)
  if (nouveau !== 'Voté') return { ...exercice, statut: nouveau }
  const ag = agId ?? exercice.agId
  const resolution = resolutionBudget ?? exercice.resolutions.budget
  if (!ag?.trim()) throw new Error('Budget voté : rattacher l’assemblée générale qui l’approuve.')
  if (!resolution?.trim()) throw new Error('Budget voté : indiquer la résolution qui l’approuve.')
  return { ...exercice, statut: nouveau, agId: ag, resolutions: { ...exercice.resolutions, budget: resolution } }
}

export interface LigneBudget {
  cle: string
  /** Code du plan comptable, 5 caractères (ex. 61500). */
  compte: string
  rubrique: string
  prevuCentimes: number
}

export interface Budget {
  lignes: LigneBudget[]
  totalPrevuCentimes: number
}

const cleLigne = (l: Pick<LigneBudget, 'cle' | 'compte' | 'rubrique'>) => `${l.cle}|${l.compte}|${l.rubrique}`

export function creerBudget(lignes: LigneBudget[]): Budget {
  const vues = new Set<string>()
  for (const ligne of lignes) {
    if (!/^[0-9A-Z]{5}$/.test(ligne.compte)) throw new Error(`Compte « ${ligne.compte} » : code du plan sur 5 caractères attendu.`)
    if (!Number.isInteger(ligne.prevuCentimes) || ligne.prevuCentimes < 0)
      throw new Error(`Montant prévu invalide (${ligne.prevuCentimes}) : centimes entiers positifs attendus.`)
    const cle = cleLigne(ligne)
    if (vues.has(cle)) throw new Error(`Ligne de budget en doublon : ${ligne.cle} · ${ligne.compte} · ${ligne.rubrique}.`)
    vues.add(cle)
  }
  return { lignes, totalPrevuCentimes: lignes.reduce((s, l) => s + l.prevuCentimes, 0) }
}

export interface MouvementBudget {
  /** Numéro complet (<syndicat>.<plan>.<auxiliaire>.<repère>) ou code du plan seul. */
  compte: string
  cle: string
  rubrique: string
  sens: 'debit' | 'credit'
  montantCentimes: number
}

export interface LigneRealisee extends LigneBudget {
  realiseCentimes: number
  ecartCentimes: number
  /** Réalisé / prévu en %, une décimale ; 0 si rien n'est prévu. */
  tauxPct: number
  alerte: boolean
}

export interface RealiseBudget {
  lignes: LigneRealisee[]
  totalRealiseCentimes: number
  horsBudget: { cle: string; compte: string; rubrique: string; realiseCentimes: number }[]
}

const codePlan = (compte: string) => (compte.includes('.') ? compte.split('.')[1] : compte)

/** Réalisé par ligne (débits − crédits), écart au prévu, taux et alerte de dépassement (seuil de gestion, 100 % par défaut). */
export function realiseBudget(
  budget: Budget,
  mouvements: MouvementBudget[],
  { seuilAlertePct = 100 }: { seuilAlertePct?: number } = {},
): RealiseBudget {
  const realise = new Map<string, number>()
  for (const m of mouvements) {
    const cle = cleLigne({ cle: m.cle, compte: codePlan(m.compte), rubrique: m.rubrique })
    realise.set(cle, (realise.get(cle) ?? 0) + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes))
  }
  const lignes = budget.lignes.map((ligne): LigneRealisee => {
    const realiseCentimes = realise.get(cleLigne(ligne)) ?? 0
    realise.delete(cleLigne(ligne))
    const tauxPct = ligne.prevuCentimes ? Math.round((realiseCentimes / ligne.prevuCentimes) * 1000) / 10 : 0
    return { ...ligne, realiseCentimes, ecartCentimes: ligne.prevuCentimes - realiseCentimes, tauxPct, alerte: tauxPct >= seuilAlertePct }
  })
  const horsBudget = [...realise.entries()].map(([cle, realiseCentimes]) => {
    const [cleRepartition, compte, rubrique] = cle.split('|')
    return { cle: cleRepartition, compte, rubrique, realiseCentimes }
  })
  return { lignes, totalRealiseCentimes: lignes.reduce((s, l) => s + l.realiseCentimes, 0), horsBudget }
}
