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
import { segmentComptableSyndicat } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { postesDesComptes, soldesDesComptes, type DonneesPostes, type SoldeCompte } from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import type { SousComptes450 } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import type { Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

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
 *    l'exigibilité), recoupé compte par compte avec les débits 450 de la pièce d'appel ; le réglé est la somme des lignes
 *    d'imputation des encaissements non annulés (domain/postes-comptes.ts). Pourquoi pas une table des postes : le dû est
 *    déjà dans la pièce d'appel et le réglé dans les encaissements ; une table les recopierait, et un réglé tenu à jour à
 *    chaque encaissement et à chaque annulation pourrait s'écarter de ce qui est écrit. Le prix : une clé ou des positions
 *    modifiées après un appel rendent la répartition relue différente de l'écriture ; le recoupement le voit et REFUSE
 *    (lecture et écriture), au lieu de rendre des postes faux.
 * 2. Ce qui est enregistré, dans UNE transaction (une erreur n'écrit rien) : la pièce du journal des traitements
 *    (enregistrerPieceTraitement : numéro de la séquence du cabinet, syndicat et mandat, D1) et, pour chaque encaissement,
 *    une ligne de la table `encaissements` (version 4) : l'encaissement du domaine (pièce, journal de banque, statut,
 *    traitement : encaissements-pieces.EncaissementEnregistre), son syndicat et son imputation (lignes par poste, reliquat,
 *    signalements). La pièce de traitement ne peut pas porter ces données : elle ne dit ni le lot d'un poste (deux lots
 *    d'un même compte sur une même échéance), ni la pièce de banque, ni le statut « Rapproché », ni l'annulation.
 * 3. Comment un encaissement est enregistré puis imputé (ecrireEncaissements) : contrôles (syndicat, compte du syndicat,
 *    compte bancaire du syndicat, solde repris), enregistrerEncaissement (pièce et journal), imputation sur les postes
 *    relus dans la transaction (imputation-encaissements.imputerEncaissements : désignation du débiteur, puis dettes
 *    échues de la plus ancienne à la plus récente, au prorata à ancienneté égale, C. civ. art. 1342-10 ; reliquat « à
 *    imputer » ; fonds de travaux non échu jamais servi d'office), chaque encaissement d'un même lot partant des soldes
 *    laissés par le précédent, puis écriture R7 et R8 (traitementEncaissements : débit du 512, crédit du 450, l'appel
 *    d'origine sur chaque crédit). Deux écritures successives s'enchaînent de la même façon : la seconde relit le réglé.
 * 4. Comment il est annulé (annulerEncaissementEcrit, F110) : écriture contraire de ses seules lignes, prises dans la
 *    pièce d'origine (encaissements-pieces.annulerEncaissement), enregistrée comme une pièce « Annulation d'encaissement » ;
 *    l'encaissement passe « Annulé » et garde son imputation pour mémoire ; ses lignes ne comptent plus dans le réglé :
 *    les postes redeviennent dus à leur exigibilité d'origine. La pièce d'origine ne change pas (elle peut porter d'autres
 *    encaissements).
 *
 * Hors de ce fichier, à brancher plus tard : écran et hooks ; remise de chèques (rattacherRemise) ; statut « Rapproché »
 * (rapprocherEncaissements, avec les arrêtés de rapprochement) ; part du fonds de travaux à virer (F112) ; recettes hors
 * copropriétaires ; verrou de saisie du syndicat (aucun n'est encore enregistré) ; réimputation du reliquat (F105) ;
 * contentieux porté par le compte D2 (ap-06).
 *
 * À VALIDER (référent métier ; solutions prudentes codées ici) :
 * - compte repris d'une ancienne fiche avec un solde dû : l'encaissement est REFUSÉ tant que ce solde n'a aucune écriture
 *   (verifierSoldeRepris) ;
 * - numéro du compte 512 de chaque compte bancaire : donné par l'appelant (journal.compteEncaissement), aucun n'est
 *   attribué ici ;
 * - la pièce « Encaissement » reste « Enregistré » : son passage à « Imputé » n'est pas écrit ;
 * - sous-comptes du 450 : le réglage est passé par l'appelant, comme à l'appel (ap-07 : tout au 45000 par défaut).
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
  /** Postes imputables du syndicat, réglé à jour, dans l'ordre des comptes puis des exigibilités. */
  postes: PosteDette[]
  /** Encaissements du syndicat, annulés compris, par date puis ordre d'écriture. */
  encaissements: EncaissementCoproprietaireEnregistre[]
  soldes: SoldeCompte[]
  /** Comptes repris d'une ancienne fiche, dans l'ordre des séries (à valider : voir l'en-tête). */
  soldesRepris: SoldeRepris[]
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

function etatDe(donnees: DonneesSyndicat): EtatDesComptes {
  const postes = postesDesComptes(donnees)
  return {
    postes,
    encaissements: [...donnees.encaissements].sort(parDatePuisEcriture),
    soldes: soldesDesComptes(postes, donnees),
    soldesRepris: [...donnees.comptes]
      .sort((a, b) => a.serie.localeCompare(b.serie))
      .flatMap((c) => (c.reprise ? [{ compteId: c.id, soldeDuCentimes: c.reprise.soldeDuCentimes, releveLe: c.reprise.releveLe }] : [])),
  }
}

/** État des comptes copropriétaires du syndicat : postes imputables, encaissements, soldes. */
export function lireEtatDesComptes(coproprieteId: string): Promise<EtatDesComptes> {
  return ajDb.transaction('r', tablesLues(), async () => etatDe(await lireDonnees(coproprieteId)))
}

/**
 * Soldes antérieurs des comptes pour un avis d'appel (repartition-appels.avisDAppel, `soldesAnterieurs` : centimes par
 * compte, négatif pour un crédit) : le solde de chaque compte sur ses postes appelés, sans les échéances de l'avis
 * (`horsAppels`, quand elles sont déjà appelées). Lecture seule ; l'avis ne la lit pas encore (branchement de l'écran
 * « Appels de fonds » : PR de suite, avant toute diffusion d'avis — point ap-02).
 * À valider (référent métier) : voir postes-comptes.soldesDesComptes (postes non échus comptés, solde repris non compté).
 */
export function lireSoldesAnterieurs(coproprieteId: string, { horsAppels = [] }: { horsAppels?: readonly string[] } = {}): Promise<Record<string, number>> {
  return ajDb.transaction('r', tablesLues(), async () => {
    const donnees = await lireDonnees(coproprieteId)
    return Object.fromEntries(soldesDesComptes(postesDesComptes(donnees), donnees, { horsAppels }).map((s) => [s.compteId, s.soldeCentimes]))
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

/** Postes imputables d'un compte du syndicat, réglé à jour, par exigibilité. */
export function lirePostesDuCompte(coproprieteId: string, compteId: string): Promise<PosteDette[]> {
  return ajDb.transaction('r', tablesLues(), async () => {
    await compteDuSyndicat(compteId, coproprieteId, 'ses postes ne se lisent que dans son syndicat')
    return etatDe(await lireDonnees(coproprieteId)).postes.filter((p) => p.compteId === compteId)
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
  /** Sous-comptes du 450 créés par l'AG (J67, R104), les mêmes qu'à l'appel ; null par défaut : tout au 45000. */
  sousComptes450?: SousComptes450 | null
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

/**
 * Chaque crédit qui porte un appel d'origine (R8) va au compte que cet appel a débité : le 450, ou le 450-1 du budget si
 * l'appel a été écrit avec les sous-comptes (J67, R104 ; arrêté du 14/03/2005, art. 9 : aucune compensation entre les
 * deux). Refuse un réglage des sous-comptes différent de celui de l'appel.
 */
function verifierComptesDesAppels(traitement: Traitement, { echeances, pieces }: Pick<DonneesSyndicat, 'echeances' | 'pieces'>): void {
  for (const m of traitement.mouvements) {
    if (m.sens !== 'credit' || m.origine?.type !== 'appel') continue
    const { appelId } = m.origine
    const appel = pieces.find((p) => p.id === echeances.find((e) => e.id === appelId)?.traitementId)
    if (!appel?.traitement.mouvements.some((d) => d.sens === 'debit' && d.compte === m.compte))
      throw new Error(
        `Encaissement : le compte ${m.compte} n'a pas été débité par l'appel${appel ? ` n° ${appel.numero}` : ''} de l'échéance « ${appelId} » ; un encaissement crédite le compte que l'appel a débité (même réglage des sous-comptes du 450 qu'à l'appel : J67, R104).`,
      )
  }
}

/**
 * Enregistre, impute et écrit des encaissements de copropriétaires d'un même jour, dans une seule pièce et une seule
 * transaction qui relit les postes : voir la conception en tête. Refus, rien n'est écrit : syndicat, compte ou compte
 * bancaire introuvable ou d'un autre syndicat (D1), compte bancaire clôturé, mandat d'un autre syndicat, compte repris
 * avec un solde dû (à valider), aucun encaissement, identifiant en double ou déjà pris, montant qui n'est pas un nombre
 * entier de centimes positif, date invalide, pièce ou journal refusés par le domaine (chèque sans numéro, espèces, 512
 * d'un autre syndicat, mode étranger à la famille), poste désigné inconnu ou d'un autre compte, postes qui ne se
 * recoupent plus avec l'écriture de leur appel.
 */
export function ecrireEncaissements(
  coproprieteId: string,
  saisies: readonly SaisieEncaissement[],
  { date, mandatId, journal, famille = 'Encaissement', sousComptes450 = null }: OptionsEncaissements,
  { actor = null }: OptionsEcriture = {},
): Promise<ResultatEncaissements> {
  return ajDb.transaction('rw', tablesEcrites(), async () => {
    const donnees = await lireDonnees(coproprieteId)
    if (saisies.length === 0) throw new Error('Aucun encaissement à écrire.')
    await verifierCompteBancaire(journal.banqueId, coproprieteId)
    const ids = await identifiants(saisies)
    const segmentSyndicat = segmentComptableSyndicat(donnees.copropriete.code)

    let postes = etatDe(donnees).postes
    const imputes: { encaissement: EncaissementEnregistre; resultat: ResultatImputation; imputerSurAVenir: boolean }[] = []
    for (const [i, saisie] of saisies.entries()) {
      verifierSoldeRepris(await compteDuSyndicat(saisie.compteId, coproprieteId, 'un encaissement ne crédite que les comptes de son syndicat'))
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

    const ecrit = traitementEncaissements(
      { encaissements: imputes },
      { id: `encaissement-${genererId()}`, date, famille, segmentSyndicat, comptes: donnees.comptes, sousComptes450 },
    )
    verifierComptesDesAppels(ecrit.traitement, donnees)
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
          sousComptes450,
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

/**
 * Annule un encaissement écrit (décision du 20/11/2026, partie C, F110) : voir la conception en tête. Refus, rien n'est
 * écrit : encaissement introuvable ou d'un autre syndicat (D1), déjà annulé, pièce d'origine absente, débit de la banque
 * antérieur à l'écriture, sans motif ou sans pièce, date invalide, mandat d'un autre syndicat, écriture d'origine qui ne
 * porte pas ses lignes.
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
    const origine = donnees.pieces.find((p) => p.id === avant.traitementId)
    if (!origine) throw new Error(`Encaissement ${encaissementId} : pièce d'origine ${avant.traitementId} introuvable au journal des traitements du syndicat.`)

    const { postes } = etatDe(donnees)
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
      {
        ecriture: origine.traitement,
        resultat,
        postes,
        comptes: donnees.comptes,
        segmentSyndicat: segmentComptableSyndicat(donnees.copropriete.code),
        sousComptes450: imputation.sousComptes450,
      },
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
