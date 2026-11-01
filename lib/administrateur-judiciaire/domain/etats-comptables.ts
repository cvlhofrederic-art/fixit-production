import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FamilleTraitement, Mouvement, Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * États comptables d'un syndicat (cartographie Gestéam, tranche 28), calculés sur les traitements : R6 garantit que
 * tout mouvement appartient à un traitement. Fonctions pures, montants en CENTIMES ENTIERS, sans écran ni édition PDF.
 *
 * Gestéam — Analyses > États comptables : 9 éditions ; paramètres communs : plage de comptes (masque
 * 0000.00000.00000.0 → ZZZZ.ZZZZZ.ZZZZZ.Z), période du / au, journaux du / au, « uniquement les totaux ».
 * Ici : balance, grand livre et journaux. Les éditions propres au cabinet (position des mandants, pointe et caisse de
 * garantie, états d'honoraires) demandent les données de plusieurs syndicats : non calculées ici.
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
}

function verifierParametres({ du, au }: ParametresEtat): void {
  for (const date of [du, au]) if (date !== undefined && !estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (du && au && du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
}

const dansPlage = (compte: string, { compteDu, compteAu }: ParametresEtat) =>
  (compteDu === undefined || compte >= compteDu) && (compteAu === undefined || compte <= compteAu)
const dansFamilles = (traitement: Traitement, { familles }: ParametresEtat) => !familles || familles.includes(traitement.famille)
const dansPeriode = (date: string, { du, au }: ParametresEtat) => (du === undefined || date >= du) && (au === undefined || date <= au)

type MouvementDate = Mouvement & { date: string; famille: FamilleTraitement }

function mouvements(traitements: Traitement[], parametres: ParametresEtat): MouvementDate[] {
  return traitements
    .filter((t) => dansFamilles(t, parametres))
    .flatMap((t) => t.mouvements.map((m) => ({ ...m, date: t.date, famille: t.famille })))
    .filter((m) => dansPlage(m.compte, parametres))
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

/** Journal : les traitements de la période (et des familles retenues), dans l'ordre des dates. */
export function journalDesTraitements(
  traitements: Traitement[],
  parametres: ParametresEtat = {},
): { traitementId: string; date: string; famille: FamilleTraitement; totalCentimes: number; mouvements: Mouvement[] }[] {
  verifierParametres(parametres)
  return traitements
    .filter((t) => dansFamilles(t, parametres) && dansPeriode(t.date, parametres))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      traitementId: t.id,
      date: t.date,
      famille: t.famille,
      totalCentimes: t.mouvements.filter((m) => m.sens === 'debit').reduce((s, m) => s + m.montantCentimes, 0),
      mouvements: t.mouvements,
    }))
}
