import { ajouterEcheancesAppel, echeancesAppelDuSyndicat, ecrireEcheancesModifiees } from '@/lib/administrateur-judiciaire/db/echeances-appel'
import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { planDeReprise } from '@/lib/administrateur-judiciaire/db/migration-d2'
import { repoClesRepartition, repoExercices } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import {
  ajDb,
  type Banque,
  type CleRepartitionEnregistree,
  type CompteCoproprietaireEnregistre,
  type EcheanceAppelEnregistree,
  type Exercice as ExerciceEnregistre,
  type IdentiteEnregistree,
  type Lot,
  type PieceTraitementEnregistree,
  type PositionEnregistree,
} from '@/lib/administrateur-judiciaire/db/schema'
import { enregistrerPieceTraitement } from '@/lib/administrateur-judiciaire/db/traitements'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  bornesDesExercices,
  controlerDateComptableAppel,
  dateComptableAppel,
  echeancesAAppeler,
  marquerAppelees,
  type AnomalieDateComptableAppel,
  type BornesExercice,
} from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { segmentComptableSyndicat } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import type { FicheEcarteeDetaillee } from '@/lib/administrateur-judiciaire/domain/migration-d2'
import { lireStatutRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import {
  avisDAppel,
  creerCleRepartition,
  traitementAppelDeFonds,
  type NatureEcheance,
  type SousComptes450,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { DATE_DU_JOUR_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Écran « Appels de fonds » en données réelles (plan des écrans, § 5.5 et 5.6) : lecture des tables D2 du syndicat et
 * trois écritures, chacune dans une transaction (une erreur n'écrit rien), hors du store (sa forme est figée par l'oracle
 * de la base locale), comme db/sinistres.ts :
 * - « Nouvel appel de fonds » (enregistrerNouvelAppel) : une échéance « Prévu » (ajouterEcheancesAppel), sur une clé du
 *   syndicat, ou sur la clé générale « 001 » tirée des tantièmes des lots, créée dans la même transaction (saisie
 *   minimale validée le 20/11/2026 : question 3 du plan), refusée si les tantièmes des lots sont incomplets
 *   (lotsDeLaCleGenerale) ;
 * - « Écrire l'appel » (ecrireAppelDeFonds) : la pièce « Appel de fonds » (enregistrerPieceTraitement : numéro de la
 *   séquence du cabinet, mandat du syndicat, D1) et le passage « Appelé » des échéances (marquerAppelees : date
 *   comptable contrôlée sur les exercices du syndicat, J67, R96), ensemble ;
 * - « Ouvrir l'exercice » (ouvrirExercice) : un exercice du syndicat « Préparation », sans chevauchement, qui comprend
 *   l'exigibilité à couvrir, pour que la date comptable de l'appel se contrôle (aucun autre écran n'écrit encore
 *   d'exercice, ni n'en supprime).
 * Identifiant d'une échéance saisie : « A-<exigibilité AAAAMMJJ>-<code de la clé>-<n° d'ordre> » (sur le modèle des
 * échéances du budget, « B-<exercice>-<clé>-<n°> », appels-budget.ts), unique au sein du syndicat.
 * À brancher (hors de ce fichier) : annulation d'un appel (annulerAppelees), mandats SEPA et règlement des comptes, clés
 * autres que la clé générale, mutations de lots, diffusion des avis.
 */

/** Clé générale tirée des tantièmes des lots (Gestéam : clé « 001 »). */
export const CODE_CLE_GENERALE = '001'
export const LIBELLE_CLE_GENERALE = 'Charges communes générales'

const NATURES: ReadonlySet<NatureEcheance> = new Set<NatureEcheance>(['budget', 'fonds_travaux', 'travaux'])

/** Données lues pour l'écran : tables D2 du syndicat, sans copie dans le store. */
export interface DonneesAppelsLues {
  lots: Lot[]
  positions: PositionEnregistree[]
  identites: IdentiteEnregistree[]
  comptes: CompteCoproprietaireEnregistre[]
  cles: CleRepartitionEnregistree[]
  echeances: EcheanceAppelEnregistree[]
  /** Exercices du syndicat dont les bornes sont connues. */
  exercices: BornesExercice[]
  banques: Banque[]
  /** Pièces du journal des traitements du syndicat. */
  pieces: PieceTraitementEnregistree[]
  /**
   * Anciennes fiches copropriétaire des lots du syndicat que la reprise D2 créerait (planDeReprise : même règle que la
   * reprise ; ni les fiches écartées, ni celles déjà reprises, décision du 22/11/2026).
   */
  fichesAReprendre: number
  /** Fiches des lots du syndicat que la reprise écarte, avec leur motif. */
  fichesEcartees: FicheEcarteeDetaillee[]
  /** Comptes repris d'une fiche dont le dossier de recouvrement est à l'étape « Action en justice ». */
  comptesEnContentieux: Set<string>
}

/** Règle commune aux appels et aux encaissements (echeancier-appels.bornesDesExercices). */
const bornesDe = (exercices: readonly ExerciceEnregistre[]): BornesExercice[] => bornesDesExercices(exercices)

const parLots = <T>(lotIds: string[], lire: (ids: string[]) => Promise<T[]>): Promise<T[]> => (lotIds.length > 0 ? lire(lotIds) : Promise.resolve([]))

/** Comptes repris d'une fiche en contentieux (« procedure » : action en justice, recouvrement.ts). */
async function comptesEnContentieux(comptes: readonly CompteCoproprietaireEnregistre[]): Promise<Set<string>> {
  const parFiche = new Map(comptes.flatMap((c) => (c.reprise ? [[c.reprise.coproprietaireId, c.id] as const] : [])))
  if (parFiche.size === 0) return new Set()
  const impayes = await ajDb.impayes.where('coproprietaireId').anyOf([...parFiche.keys()]).toArray()
  return new Set(impayes.filter((i) => lireStatutRecouvrement(i.statut).etape === 'procedure').flatMap((i) => parFiche.get(i.coproprietaireId) ?? []))
}

export async function lireDonneesAppels(coproprieteId: string): Promise<DonneesAppelsLues> {
  const lots = await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray()
  const lotIds = lots.map((l) => l.id)
  const [positions, fiches, comptes, cles, echeances, exercices, banques, pieces] = await Promise.all([
    parLots(lotIds, (ids) => ajDb.positions.where('lotId').anyOf(ids).toArray()),
    parLots(lotIds, (ids) => ajDb.coproprietaires.where('lotId').anyOf(ids).toArray()),
    ajDb.comptesCoproprietaires.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.clesRepartition.where('coproprieteId').equals(coproprieteId).toArray(),
    echeancesAppelDuSyndicat(coproprieteId),
    ajDb.exercices.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.banques.where('coproprieteId').equals(coproprieteId).toArray(),
    ajDb.traitements.where('coproprieteId').equals(coproprieteId).toArray(),
  ])
  // Plan de la reprise lu en même temps que les identités et le contentieux : la relecture de l'écran n'attend qu'une fois.
  const [identites, reprise, enContentieux] = await Promise.all([
    ajDb.identites.bulkGet([...new Set(positions.map((p) => p.identiteId))]).then((lues) => lues.filter((i) => i !== undefined)),
    planDeReprise(fiches, { aujourdhui: DATE_DU_JOUR_ISO }),
    comptesEnContentieux(comptes),
  ])
  return {
    lots,
    positions,
    identites,
    comptes,
    cles,
    echeances,
    exercices: bornesDe(exercices),
    banques,
    pieces,
    fichesAReprendre: reprise.aCreer.length,
    fichesEcartees: reprise.ecartees,
    comptesEnContentieux: enContentieux,
  }
}

// ─── « Nouvel appel de fonds » ────────────────────────────────────────────────────────────────────────────────────

export interface SaisieNouvelAppel {
  libelle: string
  nature: NatureEcheance
  exigibilite: string
  montantCentimes: number
  /** Clé du syndicat ; null : clé générale « 001 », créée depuis les tantièmes des lots. */
  cleId: string | null
}

function verifierSaisie(s: SaisieNouvelAppel): void {
  if (!s.libelle.trim()) throw new Error("Libellé de l'appel attendu.")
  if (!NATURES.has(s.nature)) throw new Error(`Nature d'appel inconnue : « ${s.nature} ».`)
  if (!estDateIsoValide(s.exigibilite)) throw new Error(`Date d'exigibilité invalide (${s.exigibilite}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(s.montantCentimes) || s.montantCentimes <= 0)
    throw new Error(`Montant invalide (${s.montantCentimes} centimes) : un montant positif, au centime près, est attendu.`)
}

const A_SAISIR = 'à saisir ou corriger dans « Lots & copropriétaires »'

/**
 * Lots de la clé générale, par n° de lot : TOUS les lots du syndicat, chacun avec des tantièmes positifs, sur une même
 * base, dont la somme est cette base. La clé répartit le montant entier sur ses lots : un lot sans tantièmes ou absent de
 * la base ferait payer sa part aux lots saisis. Refus sinon (rien n'est écrit).
 */
function lotsDeLaCleGenerale(lots: readonly Lot[]): Lot[] {
  if (lots.length === 0) throw new Error(`Clé générale impossible : aucun lot du syndicat avec des tantièmes (${A_SAISIR}).`)
  const tries = [...lots].sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
  const sansTantiemes = tries.filter((l) => !(Number.isInteger(l.tantiemes?.numerateur) && l.tantiemes.numerateur > 0)).map((l) => `lot ${l.numero}`)
  if (sansTantiemes.length > 0)
    throw new Error(`Clé générale impossible : ${sansTantiemes.join(', ')} sans tantièmes (${A_SAISIR}) ; leur part serait appelée aux autres lots.`)
  const bases = [...new Set(tries.map((l) => l.tantiemes.denominateur))]
  if (bases.length > 1) throw new Error(`Clé générale impossible : tantièmes des lots sur des bases différentes (${bases.join(', ')}) (${A_SAISIR}).`)
  const total = tries.reduce((s, l) => s + l.tantiemes.numerateur, 0)
  if (total !== bases[0])
    throw new Error(
      `Clé générale impossible : les lots enregistrés totalisent ${total}/${bases[0]} tantièmes (lot manquant ou tantièmes ${A_SAISIR}) ; la part manquante serait appelée aux lots saisis.`,
    )
  return tries
}

/** Clé générale « 001 » : tous les lots du syndicat et leurs tantièmes (lotsDeLaCleGenerale), par n° de lot. */
async function creerCleGenerale(coproprieteId: string, actor: string | null): Promise<CleRepartitionEnregistree> {
  const existante = await ajDb.clesRepartition.where('[coproprieteId+code]').equals([coproprieteId, CODE_CLE_GENERALE]).first()
  if (existante) throw new Error(`La clé générale « ${CODE_CLE_GENERALE} » existe déjà dans ce syndicat : la choisir.`)
  const lots = lotsDeLaCleGenerale(await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray())
  const { id, ...cle } = creerCleRepartition({
    id: genererId(),
    coproprieteId,
    code: CODE_CLE_GENERALE,
    libelle: LIBELLE_CLE_GENERALE,
    lots: lots.map((l) => ({ lotId: l.id, tantiemes: l.tantiemes.numerateur })),
  })
  return repoClesRepartition.create(cle, { id, actor })
}

async function cleDeLAppel(coproprieteId: string, cleId: string | null, actor: string | null): Promise<{ cle: CleRepartitionEnregistree; cleCreee: boolean }> {
  if (cleId === null) return { cle: await creerCleGenerale(coproprieteId, actor), cleCreee: true }
  const cle = await ajDb.clesRepartition.get(cleId)
  if (cle?.coproprieteId !== coproprieteId)
    throw new Error(`Clé de répartition « ${cleId} » introuvable dans ce syndicat (D1 : les clés appartiennent au syndicat).`)
  return { cle, cleCreee: false }
}

/** Identifiant suivant « A-<AAAAMMJJ>-<clé>-<n> » au sein du syndicat. */
function identifiantEcheance(existantes: readonly { id: string }[], exigibilite: string, code: string): string {
  const prefixe = `A-${exigibilite.replaceAll('-', '')}-${code}-`
  const rangs = existantes.flatMap((e) => (e.id.startsWith(prefixe) ? [Number(e.id.slice(prefixe.length))] : [])).filter(Number.isInteger)
  return `${prefixe}${Math.max(0, ...rangs) + 1}`
}

/** Enregistre l'échéance saisie (« Prévu ») ; crée la clé générale si demandée. */
export async function enregistrerNouvelAppel(
  coproprieteId: string,
  saisie: SaisieNouvelAppel,
  { actor = null }: OptionsEcriture = {},
): Promise<{ echeance: EcheanceAppelEnregistree; cle: CleRepartitionEnregistree; cleCreee: boolean }> {
  // Saisie refusée : promesse rejetée (fonction asynchrone), jamais une erreur levée à l'appel.
  verifierSaisie(saisie)
  const enregistre = await ajDb.transaction('rw', ajDb.lots, ajDb.clesRepartition, ajDb.echeancesAppel, ajDb.activityLog, async () => {
    const { cle, cleCreee } = await cleDeLAppel(coproprieteId, saisie.cleId, actor)
    const id = identifiantEcheance(await echeancesAppelDuSyndicat(coproprieteId), saisie.exigibilite, cle.code)
    const [echeance] = await ajouterEcheancesAppel(
      [
        {
          id,
          coproprieteId,
          cleId: cle.id,
          exigibilite: saisie.exigibilite,
          libelle: saisie.libelle.trim(),
          montantCentimes: saisie.montantCentimes,
          nature: saisie.nature,
        },
      ],
      { actor },
    )
    return { echeance, cle, cleCreee }
  })
  return enregistre
}

// ─── « Ouvrir l'exercice » ────────────────────────────────────────────────────────────────────────────────────────

const annee = (date: string): string => date.slice(0, 4)

export interface BornesNouvelExercice {
  ouverture: string
  cloture: string
  /**
   * Exigibilité que l'exercice doit comprendre (écran « Appels de fonds » : exercice ouvert pour une échéance hors des
   * exercices) ; absente : non contrôlée. Aucun écran ne supprime un exercice : un exercice qui ne la comprend pas resterait
   * en base sans débloquer l'appel, et pourrait chevaucher le bon.
   */
  exigibilite?: string | null
}

/**
 * Exercice « Préparation » du syndicat ; nom : l'année, ou « AAAA-AAAA » à cheval sur deux années. Refuse un chevauchement
 * et, si elle est donnée, une exigibilité hors de ses bornes.
 */
export function ouvrirExercice(
  coproprieteId: string,
  { ouverture, cloture, exigibilite = null }: BornesNouvelExercice,
  { actor = null }: OptionsEcriture = {},
): Promise<ExerciceEnregistre> {
  return ajDb.transaction('rw', ajDb.exercices, ajDb.activityLog, async () => {
    const exercice = creerExercice({
      coproprieteId,
      nom: annee(ouverture) === annee(cloture) ? annee(ouverture) : `${annee(ouverture)}-${annee(cloture)}`,
      ouverture,
      cloture,
      statut: 'Préparation',
      statutIrc: 'Non déclaré',
      agId: null,
      resolutions: { budget: null, complement: null, honoraires: null, travaux: null },
    })
    if (exigibilite !== null && !(ouverture <= exigibilite && exigibilite <= cloture))
      throw new Error(
        `L'exercice du ${dateIsoVersFr(ouverture)} au ${dateIsoVersFr(cloture)} ne comprend pas l'exigibilité du ${dateIsoVersFr(exigibilite)} : l'appel resterait bloqué.`,
      )
    const existants = bornesDe(await ajDb.exercices.where('coproprieteId').equals(coproprieteId).toArray())
    const chevauche = existants.find((x) => ouverture <= x.cloture && x.ouverture <= cloture)
    if (chevauche)
      throw new Error(
        `L'exercice du ${dateIsoVersFr(ouverture)} au ${dateIsoVersFr(cloture)} chevauche l'exercice ${chevauche.nom} (${dateIsoVersFr(chevauche.ouverture)} – ${dateIsoVersFr(chevauche.cloture)}).`,
      )
    return repoExercices.create({ ...exercice, annee: Number(annee(ouverture)) }, { actor })
  })
}

// ─── « Écrire l'appel » ───────────────────────────────────────────────────────────────────────────────────────────

export interface OptionsAppel {
  /** Échéances « Prévu » exigibles jusqu'à ce jour. */
  jusquAu: string
  /** Mandat auteur de la pièce (D1), sur ce syndicat. */
  mandatId: string
  /** Sous-comptes du 450 créés par l'AG (J67, R104) : réglage à brancher, null par défaut. */
  sousComptes450?: SousComptes450 | null
}

export interface ResultatAppel {
  piece: PieceTraitementEnregistree
  appelees: EcheanceAppelEnregistree[]
  /** Avertissements du contrôle de la date comptable (exigibilité autre que la date de l'appel, même exercice). */
  avertissements: AnomalieDateComptableAppel[]
}

/**
 * Écrit l'appel des échéances « Prévu » exigibles jusqu'à `jusquAu` : avis (avisDAppel), écriture
 * (traitementAppelDeFonds, datée de la plus ancienne exigibilité : dateComptableAppel), pièce et « Appelé », dans une
 * seule transaction qui relit tout. Refus, rien n'est écrit : aucune échéance, anomalie de répartition (lot sans compte,
 * clé inconnue…), date comptable hors des exercices du syndicat, mandat d'un autre syndicat.
 */
export function ecrireAppelDeFonds(
  coproprieteId: string,
  { jusquAu, mandatId, sousComptes450 = null }: OptionsAppel,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatAppel> {
  const tables = [
    ajDb.echeancesAppel,
    ajDb.clesRepartition,
    ajDb.lots,
    ajDb.positions,
    ajDb.comptesCoproprietaires,
    ajDb.exercices,
    ajDb.traitements,
    ajDb.coproprietes,
    ajDb.mandats,
    ajDb.activityLog,
  ]
  return ajDb.transaction('rw', tables, async () => {
    const copropriete = await ajDb.coproprietes.get(coproprieteId)
    if (!copropriete) throw new Error(`Copropriété introuvable (id=${coproprieteId}).`)
    const echeances = await echeancesAppelDuSyndicat(coproprieteId)
    const aAppeler = echeancesAAppeler(echeances, { jusquAu })
    if (aAppeler.length === 0) throw new Error(`Aucune échéance à appeler jusqu'au ${dateIsoVersFr(jusquAu)}.`)
    const lotIds = (await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray()).map((l) => l.id)
    const [positions, comptes, cles, exercices] = await Promise.all([
      parLots(lotIds, (ids) => ajDb.positions.where('lotId').anyOf(ids).toArray()),
      ajDb.comptesCoproprietaires.where('coproprieteId').equals(coproprieteId).toArray(),
      ajDb.clesRepartition.where('coproprieteId').equals(coproprieteId).toArray(),
      ajDb.exercices.where('coproprieteId').equals(coproprieteId).toArray().then(bornesDe),
    ])
    const avis = avisDAppel({ echeances: aAppeler, cles, positions, comptes })
    const traitement = traitementAppelDeFonds(avis, {
      id: `appel-${genererId()}`,
      date: dateComptableAppel(avis),
      segmentSyndicat: segmentComptableSyndicat(copropriete.code),
      comptes,
      sousComptes450,
    })
    const apres = marquerAppelees(echeances, traitement, avis, { exercices })
    const piece = await enregistrerPieceTraitement({ traitement, coproprieteId, mandatId }, { actor })
    const appelees = await ecrireEcheancesModifiees(echeances, apres, actor)
    const avertissements = controlerDateComptableAppel(traitement, avis, exercices).filter((a) => a.gravite === 'avertissement')
    return { piece, appelees, avertissements }
  })
}
