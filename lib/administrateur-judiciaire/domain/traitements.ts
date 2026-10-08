import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  FAMILLE_TRAITEMENT,
  TYPE_APPEL_LIE_AU_MOUVEMENT,
  type TypeAppelLieAuMouvement,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Traitements et mouvements en partie double (intégration Gestéam, T23 — règles pures, sans table : les clés
 * étrangères des tables comptables dépendent de la décision D1). Montants en CENTIMES ENTIERS.
 *
 * R6 — tout mouvement appartient à un traitement ; annuler = créer un traitement symétrique, jamais supprimer.
 * R7 — encaissement : débit banque / crédit copropriétaire ; décaissement : crédit banque / débit du compte de
 *      charge donné par l'ANALYTIQUE de la ligne.
 * R8 — un mouvement porte son lien d'origine : un appel de fonds (et son type parmi 9), ou une répartition de charges.
 */

/** Famille de traitement : une valeur de FAMILLE_TRAITEMENT (tous blocs confondus). */
export type FamilleTraitement = (typeof FAMILLE_TRAITEMENT)[keyof typeof FAMILLE_TRAITEMENT][number]

const FAMILLES: ReadonlySet<string> = new Set(Object.values(FAMILLE_TRAITEMENT).flat())

/**
 * Annulations observées dans le référentiel (paires présentes dans FAMILLE_TRAITEMENT). Une famille absente de cette
 * table n'a pas d'annulation observée : son annulation est refusée plutôt qu'inventée.
 */
const ANNULATION_PAR_FAMILLE: Partial<Record<FamilleTraitement, FamilleTraitement>> = {
  'Appel de fonds': "Annulation d'appel de fonds",
  'Répartition de charges': 'Annulation répartition de charges',
  Encaissement: "Annulation d'encaissement",
  'Règlement de factures': 'Annulation de règlements',
  'Règlement de soldes de compte': 'Annulation de règlements',
}

export type SensMouvement = 'debit' | 'credit'

/** R8 — lien d'origine d'un mouvement. */
export type OrigineMouvement =
  | { type: 'appel'; appelId: string; typeAppel: TypeAppelLieAuMouvement }
  | { type: 'repartition'; repartitionId: string }

/** Ligne de mouvement avant rattachement à un traitement. */
export interface LigneMouvement {
  compte: string
  sens: SensMouvement
  montantCentimes: number
  origine?: OrigineMouvement
}

/** Mouvement enregistré : toujours rattaché à son traitement (R6). */
export interface Mouvement extends LigneMouvement {
  traitementId: string
}

export interface Traitement {
  id: string
  famille: FamilleTraitement
  /** Date comptable (AAAA-MM-JJ). */
  date: string
  mouvements: Mouvement[]
  /** Identifiant du traitement annulé, pour un traitement d'annulation. */
  annule?: string
}

export interface SaisieTraitement {
  id: string
  famille: FamilleTraitement
  date: string
  mouvements: LigneMouvement[]
  annule?: string
}

const total = (lignes: LigneMouvement[], sens: SensMouvement) =>
  lignes.filter((ligne) => ligne.sens === sens).reduce((somme, ligne) => somme + ligne.montantCentimes, 0)

/**
 * Seul constructeur de mouvements : vérifie la famille, la date, les montants (centimes entiers > 0), les origines
 * (R8) et l'équilibre débit = crédit, puis rattache chaque mouvement au traitement (R6).
 */
export function creerTraitement(saisie: SaisieTraitement): Traitement {
  if (!FAMILLES.has(saisie.famille)) throw new Error(`Famille de traitement inconnue : « ${saisie.famille} ».`)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date comptable invalide : « ${saisie.date} » (AAAA-MM-JJ).`)
  if (saisie.mouvements.length < 2) throw new Error('Un traitement comporte au moins un débit et un crédit.')
  for (const ligne of saisie.mouvements) {
    if (!Number.isInteger(ligne.montantCentimes) || ligne.montantCentimes <= 0)
      throw new Error(`Montant invalide (${ligne.montantCentimes}) : centimes entiers strictement positifs attendus.`)
    if (!ligne.compte) throw new Error('Mouvement sans compte.')
    if (ligne.origine?.type === 'appel' && !TYPE_APPEL_LIE_AU_MOUVEMENT.includes(ligne.origine.typeAppel))
      throw new Error(`Type d'appel inconnu : « ${ligne.origine.typeAppel} ».`)
  }
  const debit = total(saisie.mouvements, 'debit')
  const credit = total(saisie.mouvements, 'credit')
  if (debit !== credit)
    throw new Error(`Traitement non équilibré : débit ${debit} centimes, crédit ${credit} centimes.`)
  return {
    id: saisie.id,
    famille: saisie.famille,
    date: saisie.date,
    mouvements: saisie.mouvements.map((ligne) => ({ ...ligne, traitementId: saisie.id })),
    ...(saisie.annule ? { annule: saisie.annule } : {}),
  }
}

/**
 * R6 — annulation : un NOUVEAU traitement, de la famille d'annulation observée, aux mouvements inversés. Le traitement
 * d'origine n'est jamais modifié (fonction pure). Refuse une famille sans annulation observée.
 */
export function annulerTraitement(traitement: Traitement, { id, date }: { id: string; date: string }): Traitement {
  const famille = ANNULATION_PAR_FAMILLE[traitement.famille]
  if (!famille)
    throw new Error(`Aucune annulation observée pour la famille « ${traitement.famille} » : annulation refusée.`)
  return creerTraitement({
    id,
    famille,
    date,
    annule: traitement.id,
    mouvements: traitement.mouvements.map(({ compte, sens, montantCentimes, origine }) => ({
      compte,
      sens: sens === 'debit' ? 'credit' : 'debit',
      montantCentimes,
      ...(origine ? { origine } : {}),
    })),
  })
}

/** R7 — encaissement : débit banque / crédit compte du copropriétaire. */
export function mouvementsEncaissement({
  montantCentimes,
  compteBanque,
  compteCoproprietaire,
}: {
  montantCentimes: number
  compteBanque: string
  compteCoproprietaire: string
}): LigneMouvement[] {
  return [
    { compte: compteBanque, sens: 'debit', montantCentimes },
    { compte: compteCoproprietaire, sens: 'credit', montantCentimes },
  ]
}

/** R7 — décaissement : débit du compte de charge porté par l'analytique de la ligne / crédit banque. */
export function mouvementsDecaissement({
  montantCentimes,
  compteBanque,
  analytique,
}: {
  montantCentimes: number
  compteBanque: string
  analytique: { id: string; comptePlanCharge: string }
}): LigneMouvement[] {
  return [
    { compte: analytique.comptePlanCharge, sens: 'debit', montantCentimes },
    { compte: compteBanque, sens: 'credit', montantCentimes },
  ]
}
