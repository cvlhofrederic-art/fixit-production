import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FamilleTraitement, Mouvement, Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { defautDuPerimetre, type BorneVerrou } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * États comptables d'un syndicat (cartographie Gestéam, tranche 28), calculés sur les traitements : R6 garantit que
 * tout mouvement appartient à un traitement. Fonctions pures, montants en CENTIMES ENTIERS, sans écran ni édition PDF.
 *
 * Gestéam — Analyses > États comptables : 9 éditions ; paramètres communs : plage de comptes (masque
 * 0000.00000.00000.0 → ZZZZ.ZZZZZ.ZZZZZ.Z), période du / au, journaux du / au, « uniquement les totaux ».
 * Ici : balance, grand livre et journaux. Les éditions propres au cabinet (position des mandants, pointe et caisse de
 * garantie, états d'honoraires) demandent les données de plusieurs syndicats : non calculées ici.
 *
 * Éditions figées (point 27 du bilan) — 🟢 Gestéam, tranche 37 § Mouvements : onglet Statut « Inclus dans une édition »,
 * critère de recherche « Déjà inclus dans une édition ». figerEdition marque les mouvements retenus par l'état
 * (Mouvement.editionId) ; verrouDesEditions en tire les bornes du verrou de saisie (verrou-saisie.ts). Un état calculé
 * sans figerEdition (balance, grand livre, journal) ne marque rien : c'est l'édition provisoire.
 * 🔵 Déduit : une édition ne couvre pas l'avenir (fin de période au plus tard à la date d'édition) ; un mouvement déjà
 * inclus garde sa première édition ; une édition limitée à des comptes ou à des familles ne verrouille que ce qu'elle
 * couvre ; le journal ne filtre pas par comptes (comme journalDesTraitements) ; une édition ne se fige qu'une fois,
 * contrôle fait sur la liste des éditions figées du syndicat (une édition qui ne marque rien ne laisse aucune marque) ;
 * une édition au périmètre vide ou incohérent est refusée (sa borne ne verrouillerait rien : verrou-saisie.ts).
 * 🔴 Non établi : quelle édition Gestéam marque (définitive seulement, ou aussi provisoire) ; sens de « Éditable » et de
 * « Ne pas éditer ». Pas de stockage ici : l'édition et la marque sur le mouvement attendent les tables de Frédéric.
 */

export const ETATS_GESTEAM = [
  { libelle: 'Position des mandants', calcule: false },
  { libelle: 'Pointe de garantie', calcule: false },
  { libelle: 'Grand livre', calcule: true },
  { libelle: 'Balance', calcule: true },
  { libelle: 'Journaux', calcule: true },
  { libelle: 'État des honoraires de gestion syndic', calcule: false },
  { libelle: 'Tableau des honoraires', calcule: false },
  { libelle: 'Évolution des honoraires', calcule: false },
  { libelle: 'Récapitulatif de caisse de garantie', calcule: false },
] as const

export interface ParametresEtat {
  /** Bornes incluses de la plage de comptes (comparaison du numéro complet). */
  compteDu?: string
  compteAu?: string
  du?: string
  au?: string
  /** Familles de traitement retenues ; toutes si absent. */
  familles?: FamilleTraitement[]
  /** Critère « Déjà inclus dans une édition » : oui, non ; tous si absent. */
  inclusDansEdition?: boolean
}

function verifierParametres({ du, au }: ParametresEtat): void {
  for (const date of [du, au]) if (date !== undefined && !estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (du && au && du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
}

const dansPlage = (compte: string, { compteDu, compteAu }: ParametresEtat) =>
  (compteDu === undefined || compte >= compteDu) && (compteAu === undefined || compte <= compteAu)
const dansFamilles = (traitement: Traitement, { familles }: ParametresEtat) => !familles || familles.includes(traitement.famille)
const dansPeriode = (date: string, { du, au }: ParametresEtat) => (du === undefined || date >= du) && (au === undefined || date <= au)
const dansEdition = (m: Mouvement, { inclusDansEdition }: ParametresEtat) =>
  inclusDansEdition === undefined || (m.editionId !== undefined) === inclusDansEdition

type MouvementDate = Mouvement & { date: string; famille: FamilleTraitement }

function mouvements(traitements: Traitement[], parametres: ParametresEtat): MouvementDate[] {
  return traitements
    .filter((t) => dansFamilles(t, parametres))
    .flatMap((t) => t.mouvements.map((m) => ({ ...m, date: t.date, famille: t.famille })))
    .filter((m) => dansPlage(m.compte, parametres) && dansEdition(m, parametres))
}

export interface LigneBalance {
  compte: string
  debitCentimes: number
  creditCentimes: number
  soldeDebiteurCentimes: number
  soldeCrediteurCentimes: number
}

export function balance(
  traitements: Traitement[],
  parametres: ParametresEtat = {},
): { lignes: LigneBalance[]; totaux: { debitCentimes: number; creditCentimes: number; equilibre: boolean } } {
  verifierParametres(parametres)
  const parCompte = new Map<string, { debit: number; credit: number }>()
  for (const m of mouvements(traitements, parametres).filter((x) => dansPeriode(x.date, parametres))) {
    const cumul = parCompte.get(m.compte) ?? { debit: 0, credit: 0 }
    if (m.sens === 'debit') cumul.debit += m.montantCentimes
    else cumul.credit += m.montantCentimes
    parCompte.set(m.compte, cumul)
  }
  const lignes = [...parCompte.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([compte, { debit, credit }]) => ({
      compte,
      debitCentimes: debit,
      creditCentimes: credit,
      soldeDebiteurCentimes: Math.max(debit - credit, 0),
      soldeCrediteurCentimes: Math.max(credit - debit, 0),
    }))
  const debitCentimes = lignes.reduce((s, l) => s + l.debitCentimes, 0)
  const creditCentimes = lignes.reduce((s, l) => s + l.creditCentimes, 0)
  return { lignes, totaux: { debitCentimes, creditCentimes, equilibre: debitCentimes === creditCentimes } }
}

export interface CompteGrandLivre {
  compte: string
  /** Solde (débit − crédit) des mouvements antérieurs à la période. */
  reportCentimes: number
  mouvements: {
    date: string
    traitementId: string
    famille: FamilleTraitement
    debitCentimes: number
    creditCentimes: number
    soldeCentimes: number
  }[]
  soldeFinalCentimes: number
}

/** Grand livre par compte : report, mouvements de la période dans l'ordre des dates, solde progressif (débit positif). */
export function grandLivre(traitements: Traitement[], parametres: ParametresEtat = {}): CompteGrandLivre[] {
  verifierParametres(parametres)
  const tous = mouvements(traitements, { ...parametres, du: undefined }).filter((m) => parametres.au === undefined || m.date <= parametres.au)
  const comptes = [...new Set(tous.map((m) => m.compte))].sort((a, b) => a.localeCompare(b))
  const signe = (m: MouvementDate) => (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes)
  return comptes.map((compte) => {
    const duCompte = tous.filter((m) => m.compte === compte).sort((a, b) => a.date.localeCompare(b.date))
    const avant = duCompte.filter((m) => parametres.du !== undefined && m.date < parametres.du)
    const pendant = duCompte.filter((m) => parametres.du === undefined || m.date >= parametres.du)
    const reportCentimes = avant.reduce((s, m) => s + signe(m), 0)
    let solde = reportCentimes
    const lignes = pendant.map((m) => {
      solde += signe(m)
      return {
        date: m.date,
        traitementId: m.traitementId,
        famille: m.famille,
        debitCentimes: m.sens === 'debit' ? m.montantCentimes : 0,
        creditCentimes: m.sens === 'credit' ? m.montantCentimes : 0,
        soldeCentimes: solde,
      }
    })
    return { compte, reportCentimes, mouvements: lignes, soldeFinalCentimes: solde }
  })
}

/**
 * Journal : les traitements de la période (et des familles retenues), dans l'ordre des dates. Critère « Déjà inclus dans
 * une édition » : un traitement est retenu si l'un de ses mouvements y répond.
 */
export function journalDesTraitements(
  traitements: Traitement[],
  parametres: ParametresEtat = {},
): { traitementId: string; date: string; famille: FamilleTraitement; totalCentimes: number; mouvements: Mouvement[] }[] {
  verifierParametres(parametres)
  return traitements
    .filter(
      (t) =>
        dansFamilles(t, parametres) &&
        dansPeriode(t.date, parametres) &&
        (parametres.inclusDansEdition === undefined || t.mouvements.some((m) => dansEdition(m, parametres))),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      traitementId: t.id,
      date: t.date,
      famille: t.famille,
      totalCentimes: t.mouvements.filter((m) => m.sens === 'debit').reduce((s, m) => s + m.montantCentimes, 0),
      mouvements: t.mouvements,
    }))
}

/** États que VitFix calcule, donc qu'il peut éditer : Grand livre, Balance, Journaux. */
export type EtatEditable = Extract<(typeof ETATS_GESTEAM)[number], { calcule: true }>['libelle']

const ETATS_EDITABLES: ReadonlySet<string> = new Set(ETATS_GESTEAM.filter((e) => e.calcule).map((e) => e.libelle))

export interface SaisieEdition {
  id: string
  etat: EtatEditable
  /** Période éditée, dates comptables incluses (obligatoire : elle fonde la borne du verrou). */
  du: string
  au: string
  compteDu?: string
  compteAu?: string
  familles?: FamilleTraitement[]
  /** Date de l'édition (AAAA-MM-JJ). */
  editeeLe: string
}

export interface EditionComptable extends SaisieEdition {
  /** Mouvements marqués par cette édition (ceux déjà inclus dans une autre ne comptent pas). */
  nbMouvementsMarques: number
}

function verifierSaisieEdition(saisie: SaisieEdition): void {
  const { id, etat, du, au, editeeLe } = saisie
  if (!id.trim()) throw new Error('Édition sans identifiant.')
  if (!ETATS_EDITABLES.has(etat)) throw new Error(`État non calculé par VitFix, donc non éditable : « ${etat} ».`)
  for (const [libelle, date] of Object.entries({ début: du, fin: au, "date d'édition": editeeLe }))
    if (!estDateIsoValide(date)) throw new Error(`Date invalide (${libelle} : ${date}) : AAAA-MM-JJ attendu.`)
  if (du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
  if (au > editeeLe) throw new Error(`L'édition du ${editeeLe} ne peut pas couvrir une période qui finit le ${au}.`)
  if (etat === 'Journaux' && (saisie.compteDu !== undefined || saisie.compteAu !== undefined))
    throw new Error('Le journal ne filtre pas par comptes : plage de comptes refusée pour une édition des journaux.')
  const defaut = defautDuPerimetre(saisie)
  if (defaut) throw new Error(`Édition « ${id} » invalide : ${defaut}.`)
}

/**
 * « Déjà figée » : l'identifiant figure parmi les éditions figées que l'appelant fournit, ou un mouvement porte déjà sa
 * marque. La liste est indispensable : une édition qui n'a marqué aucun mouvement (période vide, ou déjà couverte par
 * une autre édition) ne laisse aucune marque.
 */
function verifierNonFigee(traitements: Traitement[], editionsFigees: readonly EditionComptable[], id: string): void {
  const listee = editionsFigees.some((edition) => edition.id === id)
  if (listee || traitements.some((t) => t.mouvements.some((m) => m.editionId === id))) throw new Error(`Édition « ${id} » déjà figée.`)
}

/**
 * Fige une édition : marque « inclus dans une édition » (editionId) les mouvements que l'état retient (familles, période,
 * plage de comptes), sauf ceux déjà inclus dans une autre édition. `editionsFigees` : les éditions déjà figées du
 * syndicat ; une édition ne se fige qu'une fois, même si elle n'a rien marqué. Fonction pure : renvoie l'édition et des
 * traitements neufs, sans toucher à l'entrée.
 */
export function figerEdition(
  traitements: Traitement[],
  saisie: SaisieEdition,
  editionsFigees: readonly EditionComptable[],
): { edition: EditionComptable; traitements: Traitement[] } {
  verifierSaisieEdition(saisie)
  verifierNonFigee(traitements, editionsFigees, saisie.id)
  let nbMouvementsMarques = 0
  const marquer = (m: Mouvement): Mouvement => {
    if (m.editionId !== undefined || !dansPlage(m.compte, saisie)) return m
    nbMouvementsMarques += 1
    return { ...m, editionId: saisie.id }
  }
  const marques = traitements.map((t) =>
    dansFamilles(t, saisie) && dansPeriode(t.date, saisie) ? { ...t, mouvements: t.mouvements.map(marquer) } : t,
  )
  const edition = { ...saisie, ...(saisie.familles ? { familles: [...saisie.familles] } : {}), nbMouvementsMarques }
  return { edition, traitements: marques }
}

/**
 * Bornes du verrou de saisie tirées des éditions figées : une par édition, jusqu'à la fin de sa période incluse, limitée
 * à sa plage de comptes et à ses familles (verrou-saisie.ts). Deux éditions de même identifiant sont refusées : elles
 * donneraient des bornes en double, voire contradictoires, sous une même référence.
 */
export function verrouDesEditions(editions: readonly EditionComptable[]): BorneVerrou[] {
  const doublon = editions.find((edition, rang) => editions.findIndex((autre) => autre.id === edition.id) !== rang)
  if (doublon) throw new Error(`Édition « ${doublon.id} » en double : un identifiant ne fonde qu'une borne.`)
  return editions.map(
    ({ id, au, compteDu, compteAu, familles }): BorneVerrou => ({
      jusquAu: au,
      origine: 'edition',
      reference: id,
      ...(compteDu === undefined ? {} : { compteDu }),
      ...(compteAu === undefined ? {} : { compteAu }),
      ...(familles ? { familles: [...familles] } : {}),
    }),
  )
}
