import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { journaliserActivite, type OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import {
  ajDb,
  type CleRepartitionEnregistree,
  type CompteCoproprietaireEnregistre,
  type Copropriete,
  type EcheanceAppelEnregistree,
  type EncaissementCoproprietaireEnregistre,
  type PieceTraitementEnregistree,
  type PositionEnregistree,
} from '@/lib/administrateur-judiciaire/db/schema'
import { enregistrerPieceTraitement } from '@/lib/administrateur-judiciaire/db/traitements'
import { dateIsoVersFr, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  annulerEncaissement,
  enregistrerEncaissement,
  traitementEncaissements,
  type EncaissementEnregistre,
  type FamilleEncaissement,
  type JournalEncaissement,
  type SaisiePieceEncaissement,
} from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { CleRapprochement } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import {
  imputerEncaissements,
  type Encaissement,
  type PosteDette,
  type ResultatImputation,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { segmentComptableSyndicat, STATUT_PIECE_ANNULEE } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import {
  postesDesComptes,
  soldesDesComptes,
  type DonneesPostes,
  type EcartCompte,
  type SoldeCompte,
} from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import { DATE_DU_JOUR_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Imputation des encaissements aux comptes copropriétaires D2 : lecture des postes d'un compte, écriture d'un encaissement
 * imputé, annulation. Couche données seulement, sans écran ni hook (réponses du référent métier du 22/11/2026 sur l'écran
 * « Appels de fonds », points ap-h02 et ap-02 : première PR de suite, avant toute diffusion d'avis). L'écran d'où
 * viendront les encaissements (Trésorerie, import du relevé) se branchera ensuite ; l'ancien circuit
 * (donnees-store.imputerEncaissement : ancienne fiche copropriétaire et table `impayes`) reste en place jusque-là.
 *
 * CONCEPTION
 * 1. D'où viennent les postes d'un compte : ils ne sont PAS dans une table. Le dû se relit de l'échéancier appelé
 *    (échéances « Appelé » par une pièce « Appel de fonds », réparties de nouveau sur leur clé, au compte redevable à
 *    l'exigibilité), recoupé appel par appel et compte par compte avec les débits 450 de la pièce d'appel ; le réglé est
 *    la somme des lignes d'imputation des encaissements non annulés (domain/postes-comptes.ts). Pourquoi pas une table des
 *    postes : le dû est déjà dans la pièce d'appel et le réglé dans les encaissements ; une table les recopierait, et un
 *    réglé tenu à jour à chaque encaissement et à chaque annulation pourrait s'écarter de ce qui est écrit. Le prix : une
 *    clé ou des positions modifiées après un appel rendent la répartition relue différente de l'écriture ; le recoupement
 *    le voit et met les SEULS comptes touchés en écart (EtatDesComptes.ecarts : série, appel, échéances, lots) : leurs
 *    postes ne sont pas rendus, leurs encaissements et leurs annulations sont refusés ; les autres comptes du syndicat
 *    continuent.
 * 2. Ce qui est enregistré, dans UNE transaction (une erreur n'écrit rien) : la pièce du journal des traitements
 *    (enregistrerPieceTraitement : numéro de la séquence du cabinet, syndicat et mandat, D1) et, pour chaque encaissement,
 *    une ligne de la table `encaissements` (version 4) : l'encaissement du domaine (pièce, journal de banque, statut,
 *    traitement : encaissements-pieces.EncaissementEnregistre), son syndicat et son imputation (lignes par poste, reliquat,
 *    signalements). La pièce de traitement ne peut pas porter ces données : elle ne dit ni le lot d'un poste (deux lots
 *    d'un même compte sur une même échéance), ni la pièce de banque, ni le statut « Rapproché », ni l'annulation.
 * 3. Comment un encaissement est enregistré puis imputé (ecrireEncaissements) : contrôles (syndicat, compte du syndicat
 *    sans écart, compte bancaire du syndicat, solde repris, date), enregistrerEncaissement (pièce et journal), imputation
 *    sur les postes relus dans la transaction (imputation-encaissements.imputerEncaissements : désignation du débiteur,
 *    puis dettes échues de la plus ancienne à la plus récente, au prorata à ancienneté égale, C. civ. art. 1342-10 ;
 *    reliquat « à imputer » ; fonds de travaux non échu jamais servi d'office), chaque encaissement d'un même lot partant
 *    des soldes laissés par le précédent, puis écriture R7 et R8 (traitementEncaissements : débit du 512, crédit du 450,
 *    l'appel d'origine sur chaque crédit). Deux écritures successives s'enchaînent de la même façon : la seconde relit le
 *    réglé.
 * 4. Quel compte 450 est crédité : pour chaque poste, celui que SON appel a débité (PosteDette.planCompte, relu de la
 *    pièce d'appel) : le 45000, ou le 450-1 du budget si l'appel a été écrit avec les sous-comptes (J67, R104). Aucun
 *    réglage n'est passé ici : un 450-1 créé en cours d'année laisse les appels antérieurs au 45000, et un même
 *    encaissement peut créditer les deux sans compensation (arrêté du 14/03/2005, art. 9). Le reliquat va au 45000.
 * 5. Comment il est annulé (annulerEncaissementEcrit, F110) : écriture contraire de ses seules lignes, prises dans la
 *    pièce d'origine (encaissements-pieces.annulerEncaissement), enregistrée comme une pièce « Annulation d'encaissement » ;
 *    l'encaissement passe « Annulé » et garde son imputation pour mémoire ; ses lignes ne comptent plus dans le réglé :
 *    les postes redeviennent dus à leur exigibilité d'origine. La pièce d'origine ne change pas (elle peut porter d'autres
 *    encaissements). C'est le SEUL circuit d'annulation : l'annulation générique des pièces (db/traitements.ts) refuse les
 *    familles d'encaissement, et une pièce d'origine déjà « Annulé » interdit une seconde écriture contraire.
 *
 * Hors de ce fichier, à brancher plus tard : écran et hooks ; remise de chèques (rattacherRemise) ; statut « Rapproché »
 * (rapprocherEncaissements, avec les arrêtés de rapprochement) ; part du fonds de travaux à virer (F112) ; recettes hors
 * copropriétaires ; verrou de saisie du syndicat (aucun n'est encore enregistré) ; réimputation du reliquat (F105) ;
 * contentieux porté par le compte D2 (ap-06) ; intérêts avant le capital (C. civ. art. 1343-1), avec le contentieux.
 *
 * À VALIDER (référent métier ; solutions prudentes codées ici) :
 * - compte repris d'une ancienne fiche avec un solde dû : l'encaissement est REFUSÉ tant que ce solde n'a aucune écriture
 *   (verifierSoldeRepris) ;
 * - ordre des dates : un encaissement daté avant le dernier encaissement non annulé du même compte est REFUSÉ
 *   (verifierOrdreDesDates) ; une date d'une année improbable ou postérieure au jour de la saisie aussi (verifierDate) ;
 * - numéro du compte 512 de chaque compte bancaire : donné par l'appelant (journal.compteEncaissement), aucun n'est
 *   attribué ici ;
 * - la pièce « Encaissement » reste « Enregistré » : son passage à « Imputé » n'est pas écrit.
 */

// ─── Lecture ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Solde de l'ancienne fiche relevé à la migration, sans écriture : rendu à part, jamais ajouté aux soldes des postes. */
export interface SoldeRepris {
  compteId: string
  /** Positif : dû. */
  soldeDuCentimes: number
  releveLe: string
}

export interface EtatDesComptes {
  /** Postes imputables des comptes sans écart, réglé à jour, dans l'ordre des séries puis des exigibilités. */
  postes: PosteDette[]
  /** Encaissements du syndicat, annulés compris, par date puis ordre d'écriture. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  /** Soldes des comptes sans écart. */
  soldes: SoldeCompte[]
  /** Comptes repris d'une ancienne fiche, dans l'ordre des séries (à valider : voir l'en-tête). */
  soldesRepris: SoldeRepris[]
  /** Comptes dont les postes ne se recoupent plus avec ce qui est écrit : ni postes, ni solde, ni encaissement. */
  ecarts: EcartCompte[]
}

interface DonneesSyndicat extends DonneesPostes {
  copropriete: Copropriete
  positions: PositionEnregistree[]
  comptes: CompteCoproprietaireEnregistre[]
  cles: CleRepartitionEnregistree[]
  echeances: EcheanceAppelEnregistree[]
  pieces: PieceTraitementEnregistree[]
  encaissements: EncaissementCoproprietaireEnregistre[]
}

const tablesLues = () => [
  ajDb.coproprietes,
  ajDb.lots,
  ajDb.positions,
  ajDb.comptesCoproprietaires,
  ajDb.clesRepartition,
  ajDb.echeancesAppel,
  ajDb.traitements,
  ajDb.encaissements,
]
const tablesEcrites = () => [...tablesLues(), ajDb.banques, ajDb.mandats, ajDb.activityLog]

/** Tables D2 du syndicat, ses pièces et ses encaissements. À appeler dans une transaction. */
async function lireDonnees(coproprieteId: string): Promise<DonneesSyndicat> {
  const copropriete = await ajDb.coproprietes.get(coproprieteId)
  if (!copropriete) throw new Error(`Copropriété introuvable (id=${coproprieteId}).`)
  const lotIds = (await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray()).map((l) => l.id)
  const [positions, comptes, cles, echeances, pieces, encaissements] = await Promise.all([
    lotIds.length > 0 ? ajDb.positions.where('lotId').anyOf(lotIds).toArray() : Promise.resolve([]),
    ajDb.comptesCoproprietaires.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.clesRepartition.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.echeancesAppel.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.traitements.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.encaissements.where('coproprieteId').equals(coproprieteId).toArray(),
  ])
  return { copropriete, positions, comptes, cles, echeances, pieces, encaissements }
}

const parDatePuisEcriture = (a: EncaissementCoproprietaireEnregistre, b: EncaissementCoproprietaireEnregistre): number =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

function etatDe(donnees: DonneesSyndicat, { horsAppels = [] }: { horsAppels?: readonly string[] } = {}): EtatDesComptes {
  const { postes, ecarts } = postesDesComptes(donnees)
  return {
    postes,
    encaissements: [...donnees.encaissements].sort(parDatePuisEcriture),
    soldes: soldesDesComptes(postes, donnees, { horsAppels, comptesEnEcart: new Set(ecarts.map((e) => e.compteId)) }),
    soldesRepris: [...donnees.comptes]
      .sort((a, b) => a.serie.localeCompare(b.serie))
      .flatMap((c) => (c.reprise ? [{ compteId: c.id, soldeDuCentimes: c.reprise.soldeDuCentimes, releveLe: c.reprise.releveLe }] : [])),
    ecarts,
  }
}

/** Refuse un compte en écart : ses postes ne se recoupent plus avec ce qui est écrit (le message dit quoi). */
function verifierSansEcart(compteId: string, ecarts: readonly EcartCompte[]): void {
  const ecart = ecarts.find((e) => e.compteId === compteId)
  if (ecart) throw new Error(ecart.message)
}

/** État des comptes copropriétaires du syndicat : postes imputables, encaissements, soldes, comptes en écart. */
export function lireEtatDesComptes(coproprieteId: string): Promise<EtatDesComptes> {
  return ajDb.transaction('r', tablesLues(), async () => etatDe(await lireDonnees(coproprieteId)))
}

/**
 * Soldes antérieurs des comptes pour un avis d'appel (repartition-appels.avisDAppel, `soldesAnterieurs` : centimes par
 * compte, négatif pour un crédit) : le solde de chaque compte sur ses postes appelés, sans les échéances de l'avis
 * (`horsAppels`, quand elles sont déjà appelées). Un compte en écart n'a PAS de solde : `ecarts` les nomme, l'avis ne doit
 * pas leur afficher 0. Lecture seule ; l'avis ne la lit pas encore (branchement de l'écran « Appels de fonds » : PR de
 * suite, avant toute diffusion d'avis — point ap-02).
 * À valider (référent métier) : voir postes-comptes.soldesDesComptes (postes non échus comptés, solde repris non compté).
 */
export function lireSoldesAnterieurs(
  coproprieteId: string,
  options: { horsAppels?: readonly string[] } = {},
): Promise<{ soldes: Record<string, number>; ecarts: EcartCompte[] }> {
  return ajDb.transaction('r', tablesLues(), async () => {
    const { soldes, ecarts } = etatDe(await lireDonnees(coproprieteId), options)
    return { soldes: Object.fromEntries(soldes.map((s) => [s.compteId, s.soldeCentimes])), ecarts }
  })
}

/** D1 : le compte existe et appartient au syndicat. */
async function compteDuSyndicat(compteId: string, coproprieteId: string, objet: string): Promise<CompteCoproprietaireEnregistre> {
  const compte = await ajDb.comptesCoproprietaires.get(compteId)
  if (!compte) throw new Error(`Compte copropriétaire « ${compteId} » introuvable.`)
  if (compte.coproprieteId !== coproprieteId)
    throw new Error(`Compte copropriétaire « ${compteId} » d'un autre syndicat (${compte.coproprieteId}) que ${coproprieteId} : ${objet} (D1).`)
  return compte
}

/** Postes imputables d'un compte du syndicat, réglé à jour, par exigibilité. Refuse un compte en écart. */
export function lirePostesDuCompte(coproprieteId: string, compteId: string): Promise<PosteDette[]> {
  return ajDb.transaction('r', tablesLues(), async () => {
    await compteDuSyndicat(compteId, coproprieteId, 'ses postes ne se lisent que dans son syndicat')
    const { postes, ecarts } = etatDe(await lireDonnees(coproprieteId))
    verifierSansEcart(compteId, ecarts)
    return postes.filter((p) => p.compteId === compteId)
  })
}

// ─── Écriture d'encaissements imputés ─────────────────────────────────────────────────────────────────────────────

export interface SaisieEncaissement {
  /** Identifiant de l'encaissement ; absent : tiré au hasard. */
  id?: string
  /** Compte copropriétaire (450) crédité, du syndicat. */
  compteId: string
  montantCentimes: number
  /** Pièce de banque : mode, n° (exigé pour un chèque), banque émettrice, libellé. */
  piece: SaisiePieceEncaissement
  /** Postes que le débiteur désigne en payant, dans l'ordre (C. civ. art. 1342-10, al. 1). Seul le débiteur désigne. */
  postesDesignes?: string[]
  /** Le gestionnaire accepte une désignation qui ne solde pas les postes désignés (C. civ. art. 1342-4, al. 1). */
  designationPartielleAcceptee?: boolean
  /** Le débiteur demande l'imputation du reliquat sur ses appels à venir ; jamais un fonds de travaux non échu. */
  imputerSurAVenir?: boolean
  /** Payeur lu sur la pièce (il peut être un tiers). */
  payeur?: string | null
  /** Clé de rapprochement retenue à l'import du relevé. */
  cleRapprochement?: CleRapprochement | null
  /** Date de valeur du relevé : pour le rapprochement seulement (F111). */
  dateValeur?: string | null
}

export interface OptionsEncaissements {
  /** Jour de l'opération sur le relevé (F111), le même pour tous les encaissements de la pièce (C. com. R. 123-174). */
  date: string
  /** Mandat auteur de la pièce (D1), sur ce syndicat. */
  mandatId: string
  /** Journal de banque : compte bancaire du syndicat (D-BANQUE) et compte 512 débité, dans son segment (D1). */
  journal: JournalEncaissement
  /** Famille de la pièce ; « Encaissement » par défaut (tout mode). */
  famille?: FamilleEncaissement
  /** Jour de la saisie (AAAA-MM-JJ), pour refuser une date à venir ; par défaut le jour courant de l'application. */
  aujourdhui?: string
}

export interface ResultatEncaissements {
  piece: PieceTraitementEnregistree
  /** Encaissements écrits, dans l'ordre reçu, chacun avec son imputation. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  /** Postes imputables du syndicat après l'écriture. */
  postes: PosteDette[]
}

/** D-BANQUE et D1 : le compte bancaire du journal existe, appartient au syndicat et n'est pas clôturé. */
async function verifierCompteBancaire(banqueId: string, coproprieteId: string): Promise<void> {
  const banque = await ajDb.banques.get(banqueId)
  if (!banque) throw new Error(`Compte bancaire « ${banqueId} » introuvable.`)
  if (banque.coproprieteId !== coproprieteId)
    throw new Error(`Compte bancaire « ${banqueId} » d'un autre syndicat (${banque.coproprieteId}) que ${coproprieteId} : un encaissement entre sur un compte de son syndicat (D1, D-BANQUE).`)
  if (banque.actif === false) throw new Error(`Compte bancaire « ${banqueId} » clôturé : aucun encaissement ne s'y enregistre.`)
}

/** Identifiants des encaissements du lot : donnés ou tirés, sans doublon, pas encore enregistrés. */
async function identifiants(saisies: readonly SaisieEncaissement[]): Promise<string[]> {
  const ids = saisies.map((s) => s.id?.trim() || `enc-${genererId()}`)
  const double = ids.find((id, i) => ids.indexOf(id) !== i)
  if (double) throw new Error(`Encaissement ${double} en double dans le lot.`)
  const pris = (await ajDb.encaissements.bulkGet(ids)).find((e) => e !== undefined)
  if (pris) throw new Error(`Encaissement ${pris.id} déjà enregistré (traitement ${pris.traitementId}).`)
  return ids
}

/**
 * À valider (référent métier) — date d'un encaissement, fait accompli : refusée si elle n'est pas une date, si son année
 * est improbable (faute de frappe : dates.estAnneeImprobable) ou si elle est postérieure au jour de la saisie. Non
 * contrôlé : une date hors des exercices du syndicat, ou antérieure à l'écriture de l'appel.
 */
function verifierDate(date: string, aujourdhui: string): void {
  const anomalie = plausibiliteDate(date, aujourdhui, { futurAdmis: false })
  if (anomalie) throw new Error(`${messagePlausibilite('Encaissement daté', date, anomalie)} Encaissement refusé : corriger la date.`)
}

/**
 * À valider (référent métier) — ordre des paiements d'un compte : l'imputation se fait le jour du paiement, sur les dettes
 * échues ce jour-là (C. civ. art. 1342-10), et chaque encaissement part du réglé laissé par les précédents. Un
 * encaissement daté AVANT le dernier encaissement non annulé du même compte s'imputerait sur ce que les paiements
 * postérieurs ont laissé (un chèque de décembre saisi après un virement de janvier partirait en reliquat, l'appel de
 * janvier restant dû). Solution prudente : refuser ; pour le saisir, annuler les encaissements postérieurs du compte, puis
 * tout ressaisir dans l'ordre des dates. Le même jour que le dernier : admis, dans l'ordre de saisie.
 */
function verifierOrdreDesDates(compteId: string, date: string, encaissements: readonly EncaissementCoproprietaireEnregistre[]): void {
  const dernier = encaissements.filter((e) => e.compteId === compteId && !e.annulation).sort(parDatePuisEcriture).at(-1)
  if (dernier && date < dernier.date)
    throw new Error(
      `Encaissement du ${dateIsoVersFr(date)} sur le compte « ${compteId} » : antérieur au dernier encaissement de ce compte (${dernier.id} du ${dateIsoVersFr(dernier.date)}), déjà imputé ; l'imputation suit l'ordre des paiements (C. civ. art. 1342-10). Pour le saisir : annuler les encaissements postérieurs de ce compte, puis les ressaisir avec celui-ci dans l'ordre des dates.`,
    )
}

/**
 * À valider (référent métier) — compte repris d'une ancienne fiche avec un solde dû (migration-d2.RepriseSoldeCompte :
 * relevé « sans aucune écriture comptable ») : ce solde est une dette plus ancienne que les postes D2, que l'imputation ne
 * voit pas ; servir d'abord un appel récent irait contre l'ordre de l'art. 1342-10 du code civil. Solution prudente :
 * refuser, jusqu'à ce que la reprise des soldes ait son écriture (ou qu'il soit décidé de ne pas en tenir compte).
 */
function verifierSoldeRepris(compte: CompteCoproprietaireEnregistre): void {
  const du = compte.reprise?.soldeDuCentimes ?? 0
  if (du > 0)
    throw new Error(
      `Compte copropriétaire « ${compte.id} » : solde repris de ${formatEurosCentimes(du / 100)} dû sur l'ancienne fiche (relevé du ${compte.reprise?.releveLe}), sans aucune écriture au compte ; un encaissement s'imputerait sur des appels plus récents que cette dette (C. civ. art. 1342-10). Encaissement refusé tant que le solde repris n'est pas écrit.`,
    )
}

/** Encaissement du domaine tiré de la saisie : seuls les champs renseignés sont posés. */
function encaissementSaisi(id: string, saisie: SaisieEncaissement, date: string): Encaissement {
  return {
    id,
    compteId: saisie.compteId,
    date,
    montantCentimes: saisie.montantCentimes,
    ...(saisie.postesDesignes?.length ? { postesDesignes: [...saisie.postesDesignes] } : {}),
    ...(saisie.designationPartielleAcceptee ? { designationPartielleAcceptee: true } : {}),
    ...(saisie.payeur?.trim() ? { payeur: saisie.payeur.trim() } : {}),
    ...(saisie.cleRapprochement ? { cleRapprochement: saisie.cleRapprochement } : {}),
  }
}

/** Contrôles du compte crédité : du syndicat (D1), sans écart, sans solde repris dû, dans l'ordre des dates. */
async function verifierCompteCredite(compteId: string, date: string, coproprieteId: string, donnees: DonneesSyndicat, ecarts: readonly EcartCompte[]): Promise<void> {
  const compte = await compteDuSyndicat(compteId, coproprieteId, 'un encaissement ne crédite que les comptes de son syndicat')
  verifierSansEcart(compteId, ecarts)
  verifierSoldeRepris(compte)
  verifierOrdreDesDates(compteId, date, donnees.encaissements)
}

/**
 * Enregistre, impute et écrit des encaissements de copropriétaires d'un même jour, dans une seule pièce et une seule
 * transaction qui relit les postes : voir la conception en tête. Chaque poste est crédité au compte 450 que son appel a
 * débité. Refus, rien n'est écrit (un seul encaissement refusé refuse tout le lot) : syndicat, compte ou compte bancaire
 * introuvable ou d'un autre syndicat (D1), compte bancaire clôturé, mandat d'un autre syndicat, compte en écart avec
 * l'écriture de ses appels, compte repris avec un solde dû (à valider), date invalide, d'une année improbable, à venir,
 * ou antérieure au dernier encaissement non annulé du compte (à valider), aucun encaissement, identifiant en double ou
 * déjà pris, montant qui n'est pas un nombre entier de centimes positif, pièce ou journal refusés par le domaine (chèque
 * sans numéro, espèces, 512 d'un autre syndicat, mode étranger à la famille), poste désigné inconnu ou d'un autre compte.
 */
export function ecrireEncaissements(
  coproprieteId: string,
  saisies: readonly SaisieEncaissement[],
  { date, mandatId, journal, famille = 'Encaissement', aujourdhui = DATE_DU_JOUR_ISO }: OptionsEncaissements,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatEncaissements> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    const donnees = await lireDonnees(coproprieteId)
    if (saisies.length === 0) throw new Error('Aucun encaissement à écrire.')
    verifierDate(date, aujourdhui)
    await verifierCompteBancaire(journal.banqueId, coproprieteId)
    const ids = await identifiants(saisies)
    const segmentSyndicat = segmentComptableSyndicat(donnees.copropriete.code)
    const etat = etatDe(donnees)

    let postes = etat.postes
    const imputes: { encaissement: EncaissementEnregistre; resultat: ResultatImputation; imputerSurAVenir: boolean }[] = []
    for (const [i, saisie] of saisies.entries()) {
      await verifierCompteCredite(saisie.compteId, date, coproprieteId, donnees, etat.ecarts)
      const encaissement = enregistrerEncaissement(encaissementSaisi(ids[i], saisie, date), {
        piece: saisie.piece,
        journal,
        segmentSyndicat,
        dateValeur: saisie.dateValeur,
      })
      const imputerSurAVenir = saisie.imputerSurAVenir === true
      // Un encaissement à la fois : chacun part des soldes laissés par le précédent, avec sa propre demande d'imputation à venir.
      const { resultats, postes: apres } = imputerEncaissements([encaissement], postes, { imputerSurAVenir })
      imputes.push({ encaissement, resultat: resultats[0], imputerSurAVenir })
      postes = apres
    }

    // Aucun réglage des sous-comptes : chaque poste porte le compte que son appel a débité (planCompte).
    const ecrit = traitementEncaissements({ encaissements: imputes }, { id: `encaissement-${genererId()}`, date, famille, segmentSyndicat, comptes: donnees.comptes })
    const piece = await enregistrerPieceTraitement({ traitement: ecrit.traitement, coproprieteId, mandatId }, { actor })

    const maintenant = new Date().toISOString()
    const lignes = ecrit.encaissements.map((encaissement, i): EncaissementCoproprietaireEnregistre => {
      const { resultat, imputerSurAVenir } = imputes[i]
      return {
        ...encaissement,
        coproprieteId,
        imputation: {
          lignes: resultat.lignes,
          resteAImputerCentimes: resultat.resteAImputerCentimes,
          designationsIgnorees: resultat.designationsIgnorees,
          designationPartielleRefusee: resultat.designationPartielleRefusee,
          imputerSurAVenir,
        },
        createdAt: maintenant,
        updatedAt: maintenant,
        createdBy: actor,
        updatedBy: actor,
      }
    })
    await ajDb.encaissements.bulkAdd(lignes)
    for (const ligne of lignes) await journaliserActivite({ entite: 'encaissements', entiteId: ligne.id, action: 'create', qui: actor, avant: null, apres: ligne })
    return { piece, encaissements: lignes, postes }
  })
}

// ─── Annulation (F110) ────────────────────────────────────────────────────────────────────────────────────────────

/** Débit de la banque qui annule l'encaissement : chèque impayé, virement reçu retourné. */
export interface SaisieAnnulationEncaissementEcrit {
  /** Jour où la banque débite le compte (AAAA-MM-JJ). */
  date: string
  /** Motif donné par la banque. */
  motif: string
  /** Référence de l'avis de la banque (arrêté du 14 mars 2005, art. 4). */
  piece: string
  /** Mandat qui annule (D1), sur le même syndicat ; par défaut celui de la pièce d'origine. */
  mandatId?: string
}

export interface ResultatAnnulationEncaissement {
  /** Pièce « Annulation d'encaissement » : l'écriture contraire. */
  piece: PieceTraitementEnregistree
  encaissement: EncaissementCoproprietaireEnregistre
  /** Postes imputables du syndicat après l'annulation : ceux que l'encaissement avait réglés sont de nouveau dus. */
  postes: PosteDette[]
}

/** Pièce d'origine de l'encaissement : présente au journal du syndicat, et jamais annulée par un autre circuit. */
function pieceDOrigine(encaissement: EncaissementCoproprietaireEnregistre, pieces: readonly PieceTraitementEnregistree[]): PieceTraitementEnregistree {
  const origine = pieces.find((p) => p.id === encaissement.traitementId)
  if (!origine) throw new Error(`Encaissement ${encaissement.id} : pièce d'origine ${encaissement.traitementId} introuvable au journal des traitements du syndicat.`)
  if (origine.statut === STATUT_PIECE_ANNULEE || origine.annuleePar !== undefined)
    throw new Error(
      `Encaissement ${encaissement.id} : sa pièce n° ${origine.numero} est déjà annulée (écriture contraire ${origine.annuleePar ?? 'inconnue'}) ; aucune seconde écriture contraire n'est passée.`,
    )
  return origine
}

/**
 * Annule un encaissement écrit (décision du 20/11/2026, partie C, F110) : voir la conception en tête. Refus, rien n'est
 * écrit : encaissement introuvable ou d'un autre syndicat (D1), déjà annulé, pièce d'origine absente ou déjà annulée par
 * un autre circuit, compte en écart avec l'écriture de ses appels, débit de la banque antérieur à l'écriture, sans motif
 * ou sans pièce, date invalide, mandat d'un autre syndicat, écriture d'origine qui ne porte pas ses lignes.
 */
export function annulerEncaissementEcrit(
  coproprieteId: string,
  encaissementId: string,
  { date, motif, piece: avis, mandatId }: SaisieAnnulationEncaissementEcrit,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatAnnulationEncaissement> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    const avant = await ajDb.encaissements.get(encaissementId)
    if (!avant) throw new Error(`Encaissement introuvable (id=${encaissementId}).`)
    if (avant.coproprieteId !== coproprieteId)
      throw new Error(`Encaissement ${encaissementId} d'un autre syndicat (${avant.coproprieteId}) que ${coproprieteId} (D1).`)
    const donnees = await lireDonnees(coproprieteId)
    const origine = pieceDOrigine(avant, donnees.pieces)
    const { postes, ecarts } = etatDe(donnees)
    // Déjà annulé : le domaine le refuse plus bas, avec la date et le motif ; ses lignes ne comptent plus, aucun écart à lire.
    if (!avant.annulation) verifierSansEcart(avant.compteId, ecarts)

    const { imputation } = avant
    const resultat: ResultatImputation = {
      encaissementId: avant.id,
      lignes: imputation.lignes,
      resteAImputerCentimes: imputation.resteAImputerCentimes,
      designationsIgnorees: imputation.designationsIgnorees,
      designationPartielleRefusee: imputation.designationPartielleRefusee,
      postes,
    }
    const annule = annulerEncaissement(
      avant,
      { ecriture: origine.traitement, resultat, postes, comptes: donnees.comptes, segmentSyndicat: segmentComptableSyndicat(donnees.copropriete.code) },
      { id: `annulation-encaissement-${genererId()}`, date, motif, piece: avis },
    )
    const piece = await enregistrerPieceTraitement({ traitement: annule.traitement, coproprieteId, mandatId: mandatId ?? origine.mandatId }, { actor })
    const apres: EncaissementCoproprietaireEnregistre = {
      ...avant,
      statut: annule.encaissement.statut,
      annulation: annule.encaissement.annulation,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    }
    await ajDb.encaissements.put(apres)
    await journaliserActivite({ entite: 'encaissements', entiteId: apres.id, action: 'update', qui: actor, avant, apres })
    return { piece, encaissement: apres, postes: annule.postes }
  })
}
