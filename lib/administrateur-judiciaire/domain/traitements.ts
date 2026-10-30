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
 *
 * Gestéam — fiche mouvement (tranche 37 § Mouvements) : onglet Montants (Récup. locataire %, Non récupérable, Non
 * déductible, Hono. base, Clé, Analytique), onglet Liens (Fournisseur, Client, Travaux, Contrat, Sinistre, Lot), onglet
 * Totaux (Répartition « À répartir »). VitFix porte ces données sur la ligne (attributs, liens), toutes facultatives,
 * avec la rubrique et le code fiscal de la ligne de facture ; « Non récupérable » n'est pas repris (il se déduit de la
 * part récupérable). L'annulation (R6) les conserve, sauf l'état de répartition : la contre-passation, mouvement neuf,
 * est toujours « à répartir ». ⚪ Sens exact de « Non déductible » (fiscal, pour le copropriétaire bailleur ?) non
 * établi : simple marque.
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

export const ETATS_REPARTITION = ['a_repartir', 'reparti'] as const
export type EtatRepartition = (typeof ETATS_REPARTITION)[number]

/** Attributs d'une ligne (Gestéam, onglets Montants et Totaux). */
export interface AttributsMouvement {
  /** Code de la clé de répartition. */
  cle?: string | null
  analytique?: string | null
  /** Rubrique budgétaire (réalisé du budget). */
  rubrique?: string | null
  codeFiscal?: string | null
  /** Part récupérable sur le locataire, en %. */
  recupLocatairePct?: number
  nonDeductible?: boolean
  /** Base de calcul des honoraires, en centimes. */
  baseHonorairesCentimes?: number | null
  /** Taux d'honoraires appliqué à la base, en %. */
  tauxHonorairesPct?: number | null
  /** Charge à répartir entre les copropriétaires, ou déjà répartie. */
  etatRepartition?: EtatRepartition
}

/** Liens métier d'une ligne (Gestéam, onglet Liens). */
export interface LiensMouvement {
  lotId?: string | null
  compteCoproprietaireId?: string | null
  fournisseurId?: string | null
  contratId?: string | null
  travauxId?: string | null
  contentieuxId?: string | null
  sinistreId?: string | null
}

/** Ligne de mouvement avant rattachement à un traitement. */
export interface LigneMouvement {
  compte: string
  sens: SensMouvement
  montantCentimes: number
  origine?: OrigineMouvement
  attributs?: AttributsMouvement
  liens?: LiensMouvement
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

/** Pourcentage entre 0 et 100 (refuse NaN, les textes et les booléens). */
export const estPourcentage = (valeur: unknown): boolean => typeof valeur === 'number' && valeur >= 0 && valeur <= 100

function verifierAttributs(attributs: AttributsMouvement | undefined): void {
  if (!attributs) return
  const { recupLocatairePct, nonDeductible, baseHonorairesCentimes, tauxHonorairesPct, etatRepartition } = attributs
  if (recupLocatairePct !== undefined && !estPourcentage(recupLocatairePct))
    throw new Error(`Part récupérable de ${recupLocatairePct} % : entre 0 et 100 attendue.`)
  if (nonDeductible !== undefined && typeof nonDeductible !== 'boolean') throw new Error('Marque « non déductible » : oui ou non attendu.')
  if (baseHonorairesCentimes != null && (!Number.isInteger(baseHonorairesCentimes) || baseHonorairesCentimes < 0))
    throw new Error(`Base d'honoraires invalide (${baseHonorairesCentimes}) : centimes entiers positifs ou nuls attendus.`)
  if (tauxHonorairesPct != null && !estPourcentage(tauxHonorairesPct))
    throw new Error(`Taux d'honoraires de ${tauxHonorairesPct} % : entre 0 et 100 attendu.`)
  if (etatRepartition !== undefined && !(ETATS_REPARTITION as readonly string[]).includes(etatRepartition))
    throw new Error(`État de répartition inconnu : « ${etatRepartition} ».`)
}

const total = (lignes: LigneMouvement[], sens: SensMouvement) =>
  lignes.filter((ligne) => ligne.sens === sens).reduce((somme, ligne) => somme + ligne.montantCentimes, 0)

/**
 * Seul constructeur de mouvements : vérifie la famille, la date, les montants (centimes entiers > 0), les origines
 * (R8), les attributs (part récupérable, marque non déductible, base et taux d'honoraires, état de répartition) et
 * l'équilibre débit = crédit, puis rattache chaque mouvement au traitement (R6).
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
    verifierAttributs(ligne.attributs)
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

const attributsContrePasses = (attributs: AttributsMouvement): AttributsMouvement =>
  attributs.etatRepartition === undefined ? { ...attributs } : { ...attributs, etatRepartition: 'a_repartir' }

/**
 * R6 — annulation : un NOUVEAU traitement, de la famille d'annulation observée, aux mouvements inversés. Le traitement
 * d'origine n'est jamais modifié (fonction pure). Refuse une famille sans annulation observée. Attributs et liens sont
 * repris ; une ligne qui portait un état de répartition est « à répartir » (la contre-passation n'a jamais été répartie).
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
    mouvements: traitement.mouvements.map(({ compte, sens, montantCentimes, origine, attributs, liens }) => ({
      compte,
      sens: sens === 'debit' ? 'credit' : 'debit',
      montantCentimes,
      ...(origine ? { origine } : {}),
      ...(attributs ? { attributs: attributsContrePasses(attributs) } : {}),
      ...(liens ? { liens: { ...liens } } : {}),
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

/** Code du plan d'un compte « <syndicat>.<plan>.<auxiliaire>.0 », ou le compte lui-même s'il n'a pas de segment. */
const planDuCompte = (compte: string): string => compte.split('.')[1] ?? compte

/** Une ligne est à répartir si elle est marquée ainsi, ou si c'est une charge (classe 6) sans état de répartition. */
const estARepartir = (m: Mouvement): boolean => {
  const etat = m.attributs?.etatRepartition
  return etat === 'a_repartir' || (etat === undefined && planDuCompte(m.compte).startsWith('6'))
}

/**
 * Mouvements à répartir d'une période (dates comptables du … au, incluses) : base de la répartition des charges
 * (point 25). Toutes les charges (classe 6), quelle que soit l'écriture qui les a passées, sauf celles déjà réparties ;
 * les autres lignes seulement si elles sont marquées « à répartir ». 🔵 Les produits (classe 7) à déduire des charges
 * ne sont pas choisis ici ; une charge sans clé de répartition remonte telle quelle (contrôle du point 25).
 */
export function mouvementsARepartir(traitements: Traitement[], { du, au }: { du: string; au: string }): Mouvement[] {
  if (!estDateIsoValide(du) || !estDateIsoValide(au) || du > au) throw new Error(`Période invalide (du ${du} au ${au}).`)
  return traitements.filter((t) => t.date >= du && t.date <= au).flatMap((t) => t.mouvements.filter(estARepartir))
}
