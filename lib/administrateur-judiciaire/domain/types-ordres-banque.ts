import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  verifierEmission,
  type OrdreBanque,
  type OrdreVirement,
  type RemiseCheques,
  type StatutOrdre,
} from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { reglementsDeLigne, type ReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import type { ModeReglement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Types d'ordre de banque, rang, tiers et état imputé (point 39 du bilan 2). Fonctions pures, montants en CENTIMES
 * ENTIERS, dates ISO, sans écran ni table.
 *
 * Gestéam —
 * - tranche 43 § 12 (Syndic → Finances → Banque → 4 « Consulter les ORDRES de banque ») : sélecteur « Type d'ordre de
 *   banque » à dix valeurs ; liste Date · Compte (512 du mandat) · Type · Tiers · Libellé · No pièce · « Or. » (rang de
 *   l'ordre dans le lot) · Montant · Statut (Émis, Enregistré) ; fiche Émis le · Type · Statut · Imputé · N° · Nombre de
 *   pièces · Libellé · Montant · Traitement (n° + rang) · Compte 512 · Banque · Encaissement · Règlement · IBAN ;
 * - tranche 29 § Banque 4 : l'ordre regroupe des encaissements (remise de chèques, n° de bordereau) ou des règlements
 *   (virement fournisseur avec IBAN), rattaché au traitement qui l'a produit ;
 * - tranche 43 § 10 : axe Imputé / Non imputé, distinct du statut.
 *
 * 🟢 Lu (Gestéam) : les dix types et leur ordre ; un ordre est UNE LIGNE d'un lot, numérotée par son rang dans le
 *   traitement qui l'a produit, avec ses pièces ; il passe d'« Enregistré » à « Émis » quand le fichier part ; le virement
 *   de banque à banque est un traitement distinct (virement-interne.ts).
 * 🔵 Déduit :
 * - correspondance : l'« ordre » Gestéam est une LigneVirement de VitFix (un bénéficiaire, ses règlements) ; le lot est le
 *   traitement producteur, porté par OrdreBanque.traitementId ; le rang est la position de la ligne dans le lot ; le tiers
 *   est le bénéficiaire de la ligne ; une remise de chèques est un seul ordre, sans tiers (plusieurs tireurs) ;
 * - sens de chaque type : les dix valeurs suivent l'ordre de MODE_REGLEMENT, d'abord en sortie (Chèque émis, Ordre de
 *   virement, Prélèvement, TIP émis), puis en entrée (Remise de chèques, Virement reçu, Prélèvement émis, TIP encaissé,
 *   Remise d'espèces), suivies du Virement CAF. « Prélèvement » serait donc un prélèvement subi par le syndicat (un
 *   fournisseur débite son compte) et « Prélèvement émis » un prélèvement que le syndicat présente à ses copropriétaires
 *   (fichier pain.008 de prelevements-sepa.ts) ;
 * - état imputé d'un ordre de virement : déduit de ses règlements, écrits tous ensemble sous le traitement de l'ordre émis
 *   (reglements-fournisseurs.ts, traitementReglements) ; ordresDuLot le calcule par etatImputeOrdreVirement, jamais fourni
 *   par l'appelant ; une imputation partielle est incohérente ;
 * - statut d'un ordre d'un lot (ordre de virement, remise de chèques, lot de virements internes) : celui du lot, émis
 *   entier par lui-même (emettreOrdre, emettreLotVirementsInternes) ; seul un ordre constaté s'émet seul
 *   (emettreOrdreConstate) ;
 * - un chèque émis constaté existe déjà : son n° est exigé à la saisie, comme pour un règlement par chèque hors ordre
 *   (reglements-fournisseurs.ts : « référence du paiement », arrêté du 14 mars 2005, art. 4) ;
 * - les six types sans constructeur dans ordres-banque.ts sont CONSTATÉS (aucun fichier produit par VitFix) ;
 * - rangs, traitement unique et syndicat unique d'un lot : règles de GESTION (Gestéam), aucun texte.
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - Frédéric (relevé Gestéam) : « Prélèvement » et « Prélèvement émis », « TIP émis » et « TIP encaissé » ont-ils bien
 *   le sens déduit ci-dessus (sortie subie, puis encaissement présenté par le syndicat) ? Quel traitement produit chacun ?
 * - Frédéric ou Hugo : « Virement CAF » existe-t-il en copropriété, ou relève-t-il de la gérance (allocations de logement
 *   versées au bailleur) ? Refusé ici tant que ce n'est pas établi ;
 * - Hugo : « Remise d'espèces » suppose le compte 53 « Caisse » (arrêté du 14 mars 2005, art. 7), que le domaine ne tient
 *   pas, et le contrôle des mouvements en espèces de l'administrateur judiciaire (arrêté du 16 août 1999) : faut-il la
 *   modéliser ? Refusée ici, comme le paiement en espèces (reglements-fournisseurs.ts) ;
 * - Frédéric : un ordre sans fichier (chèque émis, virement reçu) passe-t-il « Émis » ? Non observé ;
 *   emettreOrdreConstate l'accepte, sans l'exiger ;
 * - Frédéric : Gestéam tient une série de chèques par compte (« Émission de chèques : N° prochain / N° dernier »,
 *   tranche 29) : un chèque émis peut-il s'enregistrer avant d'avoir son n° ? VitFix l'exige à la saisie du constat ;
 * - état imputé d'une remise de chèques : il dépend de l'imputation de ses encaissements (axe non encore modélisé) ;
 *   l'appelant le fournit.
 */

export type SensOrdre = 'sortie' | 'entree'

/**
 * Prise en charge par VitFix : « ordres-banque » (constructeur dans ordres-banque.ts, vue par ordresDuLot), « constat »
 * (creerOrdreConstate), « refuse » ou « a_confirmer » (motif donné).
 */
export type PriseEnChargeOrdre = 'ordres-banque' | 'constat' | 'refuse' | 'a_confirmer'

export interface DefinitionTypeOrdre {
  sens: SensOrdre
  mode: ModeReglement
  /** Colonne Tiers renseignée : un bénéficiaire ou un payeur identifié. */
  tiers: boolean
  priseEnCharge: PriseEnChargeOrdre
  /** Raison de la prise en charge hors constat ; null pour un constat. */
  motif: string | null
}

const MOTIF_ESPECES =
  "remise refusée : elle entrerait au compte 53 « Caisse » (arrêté du 14 mars 2005, art. 7), que VitFix ne tient pas, avec le contrôle des espèces de l'administrateur judiciaire (arrêté du 16 août 1999) ; à trancher."

/** Les dix types d'ordre de Gestéam, dans l'ordre du sélecteur (tranche 43 § 12). */
export const TYPES_ORDRE_BANQUE = {
  'Chèque émis': { sens: 'sortie', mode: 'Chèque', tiers: true, priseEnCharge: 'constat', motif: null },
  'Ordre de virement': {
    sens: 'sortie',
    mode: 'Virement',
    tiers: true,
    priseEnCharge: 'ordres-banque',
    motif: 'ordre créé par creerOrdreVirement (ordres-banque.ts), ses ordres lus par ordresDuLot.',
  },
  Prélèvement: { sens: 'sortie', mode: 'Prélèvement', tiers: true, priseEnCharge: 'constat', motif: null },
  'TIP émis': { sens: 'sortie', mode: 'TIP', tiers: true, priseEnCharge: 'constat', motif: null },
  'Remise de chèques': {
    sens: 'entree',
    mode: 'Chèque',
    tiers: false,
    priseEnCharge: 'ordres-banque',
    motif: 'bordereau créé par creerRemiseCheques (ordres-banque.ts), lu par ordresDuLot.',
  },
  'Virement reçu': { sens: 'entree', mode: 'Virement', tiers: true, priseEnCharge: 'constat', motif: null },
  'Prélèvement émis': { sens: 'entree', mode: 'Prélèvement', tiers: true, priseEnCharge: 'constat', motif: null },
  'TIP encaissé': { sens: 'entree', mode: 'TIP', tiers: true, priseEnCharge: 'constat', motif: null },
  "Remise d'espèces": { sens: 'entree', mode: 'Espèces', tiers: false, priseEnCharge: 'refuse', motif: MOTIF_ESPECES },
  'Virement CAF': {
    sens: 'entree',
    mode: 'Virement',
    tiers: true,
    priseEnCharge: 'a_confirmer',
    motif: 'existence en copropriété à confirmer (relève peut-être de la gérance : allocations de logement versées au bailleur).',
  },
} as const satisfies Record<string, DefinitionTypeOrdre>
export type TypeOrdreBanque = keyof typeof TYPES_ORDRE_BANQUE

/** Virement de banque à banque entre comptes du syndicat : type VitFix à part, hors des dix, sans tiers (virement-interne.ts). */
export const TYPE_VIREMENT_INTERNE = 'Virement interne' as const
export type TypeOrdreDuLot = TypeOrdreBanque | typeof TYPE_VIREMENT_INTERNE

/** Tiers d'un ordre (colonne Tiers de Gestéam) : libellé et, s'il est connu, IBAN. */
export interface TiersOrdre {
  libelle: string
  iban: string | null
}

/** Ordre de banque au sens de Gestéam : une ligne d'un lot (le traitement producteur), avec son rang. */
export interface OrdreDuLot {
  id: string
  /** Objet VitFix lu : l'OrdreBanque du lot, le virement interne, ou l'ordre constaté lui-même. */
  sourceId: string
  /** N° de l'ordre (fiche Gestéam « N° »). */
  numero: string
  /** Le lot : traitement qui a produit l'ordre (fiche Gestéam « Traitement n° + rang »). */
  traitementId: string
  /** Rang dans le lot (colonne « Or. »), à partir de 1. */
  rang: number
  type: TypeOrdreDuLot
  date: string
  coproprieteId: string
  /** Compte bancaire du syndicat mouvementé (colonne Compte, 512 du mandat). */
  banqueId: string
  tiers: TiersOrdre | null
  libelle: string
  /** N° de pièce : identifiant de bout en bout d'un virement, n° de chèque ou de bordereau. */
  numeroPiece: string | null
  nombrePieces: number
  montantCentimes: number
  statut: StatutOrdre
  dateEmission: string | null
  impute: boolean
}

// ─── Ordres d'un lot existant ───────────────────────────────────────────────────────────────

/** Ce que l'état imputé d'un ordre de virement lit de chaque règlement. */
export type ReglementDeLOrdre = Pick<ReglementFournisseur, 'id' | 'ordreId' | 'impute' | 'traitementId'>

/** Exactement les règlements de l'ordre : chacun une fois, aucun d'un autre ordre, aucun manquant. */
function reglementsDeLOrdre(lot: OrdreVirement, reglements: ReglementDeLOrdre[]): ReglementDeLOrdre[] {
  const attendus = new Set(lot.lignes.flatMap(reglementsDeLigne))
  const fournis = new Map<string, ReglementDeLOrdre>()
  for (const r of reglements) {
    if (!attendus.has(r.id) || r.ordreId !== lot.id) throw new Error(`Règlement ${r.id} hors de l'ordre ${lot.numero}.`)
    if (fournis.has(r.id)) throw new Error(`Règlement ${r.id} en double.`)
    fournis.set(r.id, r)
  }
  for (const id of attendus)
    if (!fournis.has(id)) throw new Error(`Règlement ${id} de l'ordre ${lot.numero} non fourni : passer tous ses règlements.`)
  return [...fournis.values()]
}

/**
 * État imputé d'un ordre de virement, déduit de ses règlements (tous, et eux seuls) : imputé si tous le sont sous le
 * traitement de l'ordre, non imputé si aucun ne l'est. Refuse une imputation sous un autre traitement, une imputation
 * avant l'émission et une imputation partielle : l'ordre émis s'écrit en une fois (traitementReglements).
 */
export function etatImputeOrdreVirement(lot: OrdreVirement, reglements: ReglementDeLOrdre[]): boolean {
  const siens = reglementsDeLOrdre(lot, reglements)
  const imputes = siens.filter((r) => r.impute)
  const ailleurs = imputes.find((r) => r.traitementId !== lot.traitementId)
  if (ailleurs)
    throw new Error(`Règlement ${ailleurs.id} imputé sous le traitement ${ailleurs.traitementId}, pas sous celui de l'ordre ${lot.numero} (${lot.traitementId}).`)
  if (imputes.length === 0) return false
  if (lot.statut !== 'Émis') throw new Error(`Ordre ${lot.numero} pas émis : aucun de ses règlements ne peut être imputé.`)
  if (imputes.length < siens.length)
    throw new Error(`Ordre ${lot.numero} : imputation partielle (${imputes.length} règlements sur ${siens.length}) ; l'ordre s'écrit en une fois.`)
  return true
}

/** État imputé d'un lot : déduit des règlements pour un ordre de virement, fourni pour une remise de chèques (🔴). */
export type EtatImputeDuLot = { reglements: ReglementDeLOrdre[] } | { impute: boolean }

function etatImputeDuLot(lot: OrdreBanque, etat: EtatImputeDuLot): boolean {
  if (lot.type === 'Ordre de virement') {
    if ('reglements' in etat) return etatImputeOrdreVirement(lot, etat.reglements)
    throw new Error(
      `Ordre ${lot.numero} : l'état imputé d'un ordre de virement se déduit de ses règlements (etatImputeOrdreVirement) ; passer ses règlements, pas un état.`,
    )
  }
  if ('impute' in etat) return etat.impute
  throw new Error(`Remise ${lot.numero} : état imputé attendu (celui de ses encaissements).`)
}

/**
 * Ordres d'un lot d'ordres-banque.ts. Ordre de virement : un ordre par ligne, rang 1 à n dans l'ordre des lignes, tiers =
 * bénéficiaire et IBAN, n° de pièce = identifiant de bout en bout, pièces = règlements de la ligne ; état imputé déduit de
 * ses règlements (etatImputeOrdreVirement : refus d'une imputation avant l'émission ou partielle). Remise de chèques : un
 * seul ordre, rang 1, sans tiers, pièces = chèques du bordereau ; état imputé fourni (celui de ses encaissements). Statut
 * et date d'émission sont ceux du lot : ces ordres ne s'émettent pas seuls.
 */
export function ordresDuLot(lot: OrdreVirement, etat: { reglements: ReglementDeLOrdre[] }): OrdreDuLot[]
export function ordresDuLot(lot: RemiseCheques, etat: { impute: boolean }): OrdreDuLot[]
export function ordresDuLot(lot: OrdreBanque, etat: EtatImputeDuLot): OrdreDuLot[] {
  const commun = {
    sourceId: lot.id,
    traitementId: lot.traitementId,
    type: lot.type,
    date: lot.date,
    coproprieteId: lot.coproprieteId,
    banqueId: lot.banqueId,
    statut: lot.statut,
    dateEmission: lot.dateEmission,
    impute: etatImputeDuLot(lot, etat),
  }
  if (lot.type === 'Remise de chèques')
    return [
      {
        ...commun,
        id: lot.id,
        numero: lot.numero,
        rang: 1,
        tiers: null,
        libelle: `Remise de chèques ${lot.numero}`,
        numeroPiece: lot.numero,
        nombrePieces: lot.nombrePieces,
        montantCentimes: lot.totalCentimes,
      },
    ]
  return lot.lignes.map((l, i) => ({
    ...commun,
    id: `${lot.id}-${i + 1}`,
    numero: `${lot.numero}-${i + 1}`,
    rang: i + 1,
    tiers: { libelle: l.beneficiaire, iban: l.iban },
    libelle: l.libelle,
    numeroPiece: l.reglementId,
    nombrePieces: reglementsDeLigne(l).length,
    montantCentimes: l.montantCentimes,
  }))
}

// ─── Ordres constatés ───────────────────────────────────────────────────────────────────────

export interface SaisieOrdreConstate {
  id: string
  numero: string
  traitementId: string
  rang: number
  type: TypeOrdreBanque
  date: string
  coproprieteId: string
  banqueId: string
  tiers: TiersOrdre | null
  libelle: string
  numeroPiece?: string | null
  /** Une pièce par défaut. */
  nombrePieces?: number
  montantCentimes: number
}

const entierAuMoins = (valeur: number, minimum: number): boolean => Number.isInteger(valeur) && valeur >= minimum

/** Rang d'un ordre dans son lot (colonne « Or. ») : entier à partir de 1. */
export function verifierRang(rang: number): void {
  if (!entierAuMoins(rang, 1)) throw new Error(`Rang invalide (${rang}) : entier à partir de 1 attendu.`)
}

function texteRequis(valeur: string | null | undefined, message: string): void {
  if (!valeur?.trim()) throw new Error(message)
}

function definitionConstat(type: string): DefinitionTypeOrdre {
  if (!Object.hasOwn(TYPES_ORDRE_BANQUE, type)) throw new Error(`Type d'ordre inconnu : « ${type} ».`)
  const definition: DefinitionTypeOrdre = TYPES_ORDRE_BANQUE[type as TypeOrdreBanque]
  if (definition.priseEnCharge !== 'constat') throw new Error(`${type} : ${definition.motif}`)
  return definition
}

function verifierTiers(type: string, definition: DefinitionTypeOrdre, tiers: TiersOrdre | null): void {
  if (definition.tiers && !tiers?.libelle.trim()) throw new Error(`${type} : tiers attendu (colonne Tiers de l'ordre).`)
  if (tiers?.iban != null && !validerIban(tiers.iban)) throw new Error(`${type} : IBAN du tiers invalide.`)
}

/** Chèque émis : son n° est la référence du paiement (comme enregistrerHorsOrdre, reglements-fournisseurs.ts). */
function verifierPiece(type: string, definition: DefinitionTypeOrdre, piece: string | undefined): void {
  if (definition.mode === 'Chèque' && definition.sens === 'sortie' && !piece)
    throw new Error(`${type} : n° de chèque exigé (référence du paiement).`)
}

function verifierConstat(saisie: SaisieOrdreConstate, nombrePieces: number): void {
  texteRequis(saisie.id, 'Ordre sans identifiant.')
  texteRequis(saisie.numero, 'Ordre sans numéro.')
  texteRequis(saisie.coproprieteId, 'Ordre sans syndicat : D1 le rattache au compte du syndicat.')
  texteRequis(saisie.banqueId, 'Ordre sans compte bancaire du syndicat.')
  texteRequis(saisie.traitementId, "Ordre sans traitement : le lot est le traitement qui l'a produit.")
  texteRequis(saisie.libelle, "Libellé de l'ordre attendu.")
  verifierRang(saisie.rang)
  if (!entierAuMoins(nombrePieces, 1)) throw new Error(`Nombre de pièces invalide (${nombrePieces}) : entier à partir de 1 attendu.`)
  if (!entierAuMoins(saisie.montantCentimes, 1))
    throw new Error(`Montant invalide (${saisie.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
}

/**
 * Ordre constaté d'un des six types sans constructeur dans ordres-banque.ts (chèque émis, prélèvement, TIP émis,
 * virement reçu, prélèvement émis, TIP encaissé) : « Enregistré », non émis, non imputé. Refuse un type inconnu, un
 * ordre de virement ou une remise de chèques (constructeurs d'ordres-banque.ts), une remise d'espèces et un virement CAF
 * (🔴), un tiers absent, un IBAN de tiers invalide, un chèque émis sans n° de chèque, un rang ou un nombre de pièces qui
 * n'est pas un entier ≥ 1, un montant qui n'est pas un nombre entier de centimes > 0, une date non ISO.
 */
export function creerOrdreConstate(saisie: SaisieOrdreConstate): OrdreDuLot {
  const definition = definitionConstat(saisie.type)
  const nombrePieces = saisie.nombrePieces ?? 1
  verifierConstat(saisie, nombrePieces)
  verifierTiers(saisie.type, definition, saisie.tiers)
  const piece = saisie.numeroPiece?.trim()
  verifierPiece(saisie.type, definition, piece)
  return {
    id: saisie.id,
    sourceId: saisie.id,
    numero: saisie.numero.trim(),
    traitementId: saisie.traitementId,
    rang: saisie.rang,
    type: saisie.type,
    date: saisie.date,
    coproprieteId: saisie.coproprieteId,
    banqueId: saisie.banqueId,
    tiers: saisie.tiers === null ? null : { libelle: saisie.tiers.libelle.trim(), iban: saisie.tiers.iban },
    libelle: saisie.libelle.trim(),
    numeroPiece: piece ? piece : null,
    nombrePieces,
    montantCentimes: saisie.montantCentimes,
    statut: 'Enregistré',
    dateEmission: null,
    impute: false,
  }
}

/** Types dont l'état imputé se déduit de l'écriture de leur propre traitement, jamais posé à la main. */
const IMPUTATION_DEDUITE: ReadonlyMap<TypeOrdreDuLot, string> = new Map([
  ['Ordre de virement', 'etatImputeOrdreVirement (règlements écrits par traitementReglements)'],
  [TYPE_VIREMENT_INTERNE, 'traitementVirementsInternes (virement-interne.ts)'],
])

/**
 * Imputation d'un ordre constaté ou d'une remise de chèques : l'écriture du traitement de l'ordre est passée. Refuse un
 * ordre déjà imputé, un autre traitement, et un ordre de virement ou un virement interne (état déduit, voir ci-dessus).
 */
export function imputerOrdre(ordre: OrdreDuLot, traitement: { id: string }): OrdreDuLot {
  const deduit = IMPUTATION_DEDUITE.get(ordre.type)
  if (deduit) throw new Error(`${ordre.type} : l'état imputé se déduit de l'écriture de son traitement, par ${deduit}.`)
  if (ordre.impute) throw new Error(`Ordre ${ordre.numero} déjà imputé (traitement ${ordre.traitementId}).`)
  if (traitement.id !== ordre.traitementId)
    throw new Error(`Ordre ${ordre.numero} : traitement ${ordre.traitementId}, pas ${traitement.id}.`)
  return { ...ordre, impute: true }
}

/** Types dont l'émission est celle de leur lot ou de leur virement : leurs ordres en sont des vues. */
const EMISSION_PROPRE: ReadonlyMap<TypeOrdreDuLot, string> = new Map([
  ['Ordre de virement', "emettreOrdre sur l'ordre de virement (ordres-banque.ts)"],
  ['Remise de chèques', 'emettreOrdre sur la remise (ordres-banque.ts)'],
  [TYPE_VIREMENT_INTERNE, 'emettreLotVirementsInternes sur le lot de virements internes (virement-interne.ts)'],
])

/**
 * Émission d'un ordre constaté : une seule fois, à une date ISO ; renvoie un nouvel ordre. Refuse un ordre d'un lot ou
 * d'un virement interne (son statut est celui du lot ou du virement : l'émettre, puis relire ses ordres), et un type qui
 * n'est pas constaté.
 */
export function emettreOrdreConstate(ordre: OrdreDuLot, dateEmission: string): OrdreDuLot {
  const emission = EMISSION_PROPRE.get(ordre.type)
  if (emission)
    throw new Error(`${ordre.type} ${ordre.numero} : ordre d'un lot, il prend le statut du lot ; émettre par ${emission}, puis relire ses ordres.`)
  definitionConstat(ordre.type)
  verifierEmission(ordre, dateEmission)
  return { ...ordre, statut: 'Émis', dateEmission }
}

// ─── Contrôle d'un lot ──────────────────────────────────────────────────────────────────────

export type CodeAnomalieOrdre = 'rang_invalide' | 'rang_double' | 'rang_manquant' | 'traitements_differents' | 'syndicats_differents'

export interface AnomalieOrdre {
  code: CodeAnomalieOrdre
  message: string
  /** Règles de gestion (Gestéam) : aucun texte. */
  fondement: null
}

const anomalie = (code: CodeAnomalieOrdre, message: string): AnomalieOrdre => ({ code, message, fondement: null })

function anomaliesRangs(ordres: OrdreDuLot[]): AnomalieOrdre[] {
  const anomalies: AnomalieOrdre[] = []
  const vus = new Set<number>()
  for (const o of ordres) {
    if (!entierAuMoins(o.rang, 1)) anomalies.push(anomalie('rang_invalide', `Ordre ${o.numero} : rang ${o.rang}, entier à partir de 1 attendu.`))
    else if (vus.has(o.rang)) anomalies.push(anomalie('rang_double', `Ordre ${o.numero} : rang ${o.rang} déjà pris dans le lot.`))
    vus.add(o.rang)
  }
  for (let rang = 1; rang <= ordres.length; rang++)
    if (!vus.has(rang)) anomalies.push(anomalie('rang_manquant', `Rang ${rang} absent du lot : rangs 1 à ${ordres.length} attendus.`))
  return anomalies
}

/**
 * Contrôle d'un lot d'ordres : rangs entiers de 1 à n, chacun une fois ; un seul traitement (le lot) ; un seul syndicat
 * (D1). Anomalies de gestion, sans fondement légal ; aucune pour un lot vide.
 */
export function controlerRangsDuLot(ordres: OrdreDuLot[]): AnomalieOrdre[] {
  const anomalies = anomaliesRangs(ordres)
  if (new Set(ordres.map((o) => o.traitementId)).size > 1)
    anomalies.push(anomalie('traitements_differents', "Ordres de plusieurs traitements : un lot est le traitement qui l'a produit."))
  if (new Set(ordres.map((o) => o.coproprieteId)).size > 1)
    anomalies.push(anomalie('syndicats_differents', "Ordres de plusieurs syndicats dans un lot : chaque ordre porte sur un compte d'un seul syndicat (D1)."))
  return anomalies
}
