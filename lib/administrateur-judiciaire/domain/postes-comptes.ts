import { postesImputables, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { EncaissementEnregistre } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import type { CompteCoproprietaire, Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  estPosteDuBudget,
  postesDepuisAvis,
  soldePoste,
  type LigneImputation,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { PieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import type { LigneMouvement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { avisDAppel, type AnomalieAppel, type CleRepartition } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { planDuCompte } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * Postes des comptes copropriétaires (D2) relus de ce qui est déjà écrit, sans table des postes. Fonctions pures, montants
 * en CENTIMES ENTIERS, sans écran ni base (lecture et écriture : db/encaissements.ts, qui porte la conception).
 *
 * - Le DÛ d'un poste se relit de l'échéancier : chaque échéance appelée par une pièce « Appel de fonds » est répartie de
 *   nouveau sur sa clé et portée au compte redevable à son exigibilité (repartition-appels.avisDAppel, puis
 *   imputation-encaissements.postesDepuisAvis : un poste par échéance et par lot, « <échéance>:<lot> »). La pièce d'appel
 *   ne porte ni l'échéance ni le lot (un débit par compte 450, ou deux avec les sous-comptes) : la répartition relue est
 *   donc RECOUPÉE avec elle, appel par appel et compte par compte (echeancier-appels.ts : « les échéances appelées se
 *   lisent dans l'avis qui l'a produit, recoupé avec l'écriture »).
 * - Le COMPTE 450 d'un poste est celui que SON appel a débité (PosteDette.planCompte) : le 45000, ou le 450-1 du budget
 *   si l'appel a été écrit avec les sous-comptes (J67, R104). Le partage relu (budget / reste) doit être celui de
 *   l'écriture : l'arrêté du 14/03/2005, art. 9, interdit la compensation entre les deux. L'encaissement crédite ce
 *   compte-là, poste par poste : un 450-1 créé en cours d'année laisse les appels antérieurs au 45000.
 * - Un ÉCART (clé ou positions modifiées depuis l'appel, mutation notifiée après l'appel, pièce absente…) ne touche que
 *   les comptes concernés (EcartCompte : série, appel, échéances, lots relus) : leurs postes ne sont pas rendus — plutôt
 *   qu'un dû qui ne serait plus celui du compte 450 — et leurs encaissements sont refusés ; les autres comptes du
 *   syndicat ne sont pas bloqués. Limite : le recoupement se fait au total du compte par appel (et par sous-compte) ; un
 *   déplacement de tantièmes entre deux lots d'un même compte, sur un même appel, ne se voit pas.
 * - Le RÉGLÉ d'un poste est la somme des lignes d'imputation des encaissements non annulés (ImputationEcrite, gardée sur
 *   chaque encaissement : l'imputation est faite le jour du paiement, C. civ. art. 1342-10, elle ne se recalcule pas).
 *   Annuler un encaissement (F110) retire donc ses lignes : le poste redevient dû, à son exigibilité d'origine. Une ligne
 *   sans son poste, un réglé au-delà du dû, une pièce d'encaissement annulée hors de son circuit : écart du compte.
 * - RÉIMPUTATION dans l'ordre des dates (décision du 24/11/2026, question 6, option 3 ; conception : db/encaissements.ts,
 *   point 6) : `imputation` porte TOUJOURS l'imputation COURANTE de l'encaissement, les lecteurs ci-dessous ne changent
 *   pas de sens ; chaque réimputation s'ajoute à `reimputations` avec l'imputation d'avant, copiée, et les lignes de sa
 *   pièce de reclassement (« Correction de mouvements »). Aucune pièce comptable n'est réécrite (arrêté du 14/03/2005,
 *   art. 5) : l'imputation gardée sur l'encaissement est une information d'affectation (lettrage), mise à jour avec son
 *   historique complet, ajouté, jamais effacé. Une pièce de reclassement absente ou « Annulé » : écart du compte (le
 *   réglé ne serait plus celui du compte 450).
 * - Les postes d'un appel annulé sont écartés (echeancier-appels.postesImputables) ; réglés, leur compte est en écart.
 * - `contentieux` vaut toujours false ici : le contentieux se lit encore sur l'ancienne fiche (réponse du référent métier
 *   du 22/11/2026, point ap-06 : il sera porté sur le compte D2 quand le recouvrement passera aux comptes D2). À brancher
 *   ici, sur le poste, à ce moment-là.
 */

/**
 * Ligne d'imputation telle qu'elle a été écrite : le poste et le montant, et ce que son crédit du 450 porte dans la pièce
 * (appel d'origine, R8 ; compte crédité). L'annulation de l'encaissement (F110) contre-passe ces lignes sans relire les
 * postes : elle reste possible quand le compte est en écart (la banque a déjà rejeté le paiement).
 */
export interface LigneImputationEcrite extends LigneImputation {
  /** Appel d'origine du poste ; null : dette sans appel. */
  appelId: PosteDette['appelId']
  typeAppel: PosteDette['typeAppel']
  /** Code du plan du compte 450 crédité : celui que l'appel a débité pour ce poste (45000, ou le 450-1 du budget). */
  planCompte: string
}

/** Imputation d'un encaissement telle qu'elle a été écrite : ResultatImputation sans l'état des postes, qui se relit. */
export interface ImputationEcrite {
  lignes: LigneImputationEcrite[]
  /** Reliquat laissé « à imputer » au crédit du compte. */
  resteAImputerCentimes: number
  /** Postes désignés par le débiteur, ignorés parce que déjà soldés. */
  designationsIgnorees: string[]
  /** Désignation qui ne soldait pas les postes désignés, non acceptée : imputation légale à la place (art. 1342-4). */
  designationPartielleRefusee: boolean
  /** Le débiteur a demandé l'imputation du reliquat sur ses appels à venir (art. 1305-3 : le terme lui profite). */
  imputerSurAVenir: boolean
}

/** Ce qui a causé une réimputation : le ou les paiements saisis en retard, d'une même pièce, sur le compte. */
export interface CauseReimputation {
  type: 'encaissement-en-retard'
  /** Encaissements saisis en retard sur le compte, dans l'ordre reçu. */
  encaissementIds: string[]
  /** Pièce de ces paiements en retard. */
  traitementId: string
  /** Leur date (celle de leur pièce). */
  date: string
}

/**
 * Réimputation d'un encaissement dans l'ordre des dates (décision du 24/11/2026, question 6, option 3), en ajout seul :
 * la pièce de reclassement, sa cause, l'imputation d'avant et les lignes que cet encaissement porte dans la pièce.
 */
export interface ReimputationEcrite {
  /** Pièce « Correction de mouvements » du reclassement. */
  traitementId: string
  /** Date comptable du reclassement : le jour du traitement. */
  le: string
  cause: CauseReimputation
  /** Imputation complète d'avant ce reclassement, copiée. */
  avant: ImputationEcrite
  /** Lignes de CET encaissement dans la pièce de reclassement (ce que son annulation contre-passera). */
  mouvements: LigneMouvement[]
  /** Mention de la pièce justificative (arrêté du 14/03/2005, art. 4 ; décret n° 2005-240, art. 6). */
  mention: string
}

/**
 * Encaissement d'un copropriétaire écrit au journal des traitements, avec son syndicat (D1) et son imputation COURANTE
 * (celle de sa pièce d'origine tant qu'il n'a pas été réimputé).
 */
export type EncaissementImpute = EncaissementEnregistre & {
  coproprieteId: string
  imputation: ImputationEcrite
  /** Place de l'encaissement dans son lot (0, 1, …) : départage l'ordre des encaissements d'une même pièce. */
  rang: number
  /** Réimputations successives, de la plus ancienne à la plus récente ; absent : jamais réimputé. */
  reimputations?: ReimputationEcrite[]
  /** Sur un paiement saisi en retard : les pièces de reclassement qu'il a causées. */
  reclassementIds?: string[]
}

/**
 * Imputation écrite dans la pièce d'ORIGINE de l'encaissement : celle d'avant sa première réimputation, sinon la
 * courante. Elle ne sert qu'à retrouver ses lignes dans la pièce d'origine (rejet de la banque, annulation pour erreur de
 * saisie) ; le réglé et les soldes se lisent sur `imputation`.
 */
export const imputationDOrigine = (encaissement: Pick<EncaissementImpute, 'imputation' | 'reimputations'>): ImputationEcrite =>
  encaissement.reimputations?.[0]?.avant ?? encaissement.imputation

export interface DonneesPostes {
  /** Échéancier complet du syndicat. */
  echeances: EcheanceAppelSuivie[]
  cles: CleRepartition[]
  /** Positions des lots du syndicat, sorties comprises (le redevable est celui de l'exigibilité). */
  positions: Position[]
  comptes: CompteCoproprietaire[]
  /** Pièces du journal des traitements du syndicat (ses appels de fonds, et les pièces de ses encaissements). */
  pieces: Pick<PieceTraitement, 'id' | 'numero' | 'traitement' | 'statut'>[]
  /** Encaissements du syndicat, annulés compris. */
  encaissements: (Pick<EncaissementImpute, 'id' | 'compteId' | 'traitementId' | 'imputation'> & Pick<Partial<EncaissementImpute>, 'annulation' | 'reimputations'>)[]
}

/** Écart d'un compte avec ce qui est écrit : ses postes ne sont pas rendus, ses encaissements sont refusés. */
export interface EcartCompte {
  /** Compte touché ; null : série débitée par un appel, qui n'est plus celle d'aucun compte du syndicat. */
  compteId: string | null
  serie: string
  /** Ce qui ne se recoupe pas : appel, échéances, lots et montants, pour le lever. */
  message: string
}

export interface PostesDuSyndicat {
  /** Postes imputables des comptes sans écart, réglé à jour, dans l'ordre des séries puis des exigibilités. */
  postes: PosteDette[]
  /** Un écart par compte et par cause, dans l'ordre des appels puis des séries. */
  ecarts: EcartCompte[]
}

type PieceLue = DonneesPostes['pieces'][number]
type EcheanceAppelee = EcheanceAppelSuivie & { traitementId: string }

const PLAN_450 = '45000'
const SUITE_ECART = "Les postes de ce compte ne sont pas rendus et ses encaissements sont refusés tant que l'écart n'est pas levé."

const cumuler = (cumuls: Map<string, number>, cle: string, montant: number): void => {
  cumuls.set(cle, (cumuls.get(cle) ?? 0) + montant)
}
const somme = (montants: Iterable<number>): number => [...montants].reduce((s, x) => s + x, 0)
/** « 0 centime relu », « 27000 centimes écrits ». */
const enCentimes = (n: number, participe: string): string => `${n} centime${n > 1 ? 's' : ''} ${participe}${n > 1 ? 's' : ''}`

/** Échéances qu'une pièce « Appel de fonds » a appelées (annulées depuis comprises), par exigibilité puis identifiant. */
const echeancesAppelees = (echeances: EcheanceAppelSuivie[]): EcheanceAppelee[] =>
  echeances
    .filter((e): e is EcheanceAppelee => e.traitementId !== null && (e.statut === 'Appelé' || e.statut === 'Annulé'))
    .sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))

/** Débits des comptes 450 et de leurs sous-comptes (J67, R104) d'une pièce d'appel : par série de compte, puis par plan. */
function debitsParSerie(piece: PieceLue | undefined): Map<string, Map<string, number>> {
  const debits = new Map<string, Map<string, number>>()
  for (const m of piece?.traitement.mouvements ?? []) {
    const plan = planDuCompte(m.compte)
    if (m.sens !== 'debit' || !plan.startsWith('450')) continue
    const serie = m.compte.split('.')[2] ?? ''
    if (!debits.has(serie)) debits.set(serie, new Map())
    cumuler(debits.get(serie) as Map<string, number>, plan, m.montantCentimes)
  }
  return debits
}

/**
 * Plan qui a porté le budget du compte dans l'appel, si le partage relu (budget, reste) est celui de l'écriture : le
 * sous-compte débité, avec le reste au 45000 ; sans sous-compte, tout au 45000. Null : écart.
 */
function planDuBudgetEcrit(ecrits: ReadonlyMap<string, number>, budget: number, reste: number): string | null {
  const sousComptes = [...ecrits.keys()].filter((plan) => plan !== PLAN_450)
  const au450 = ecrits.get(PLAN_450) ?? 0
  if (sousComptes.length > 1) return null
  if (sousComptes.length === 1) return ecrits.get(sousComptes[0]) === budget && au450 === reste ? sousComptes[0] : null
  return au450 === budget + reste ? PLAN_450 : null
}

/** Ce que l'appel a écrit au compte, et ce que la répartition relue lui porte, en clair. */
function constatDeLEcart(ecrits: ReadonlyMap<string, number>, relus: PosteDette[]): string {
  const sousComptes = [...ecrits.keys()].filter((plan) => plan !== PLAN_450)
  const partsDesSousComptes = sousComptes.map((plan) => `${ecrits.get(plan)} au sous-compte ${plan} du budget`).join(', ')
  const detailEcrit = sousComptes.length > 0 ? ` (dont ${partsDesSousComptes})` : ''
  const budget = somme(relus.filter(estPosteDuBudget).map((p) => p.montantCentimes))
  const lots = relus.map((p) => `échéance « ${p.appelId} », lot ${p.lotId} : ${p.montantCentimes}`).join(' ; ')
  const partDuBudget = sousComptes.length > 0 ? `dont ${budget} du budget ; ` : ''
  const detailRelu = relus.length === 0 ? 'aucun lot' : `${partDuBudget}${lots}`
  return `${enCentimes(somme(ecrits.values()), 'écrit')} au compte${detailEcrit}, ${enCentimes(somme(relus.map((p) => p.montantCentimes)), 'relu')} (${detailRelu})`
}

interface AppelRelu {
  traitementId: string
  echeanceIds: string[]
  piece: PieceLue | undefined
  /** Postes relus de l'appel, par série de compte (à défaut de compte connu : son identifiant). */
  relus: Map<string, PosteDette[]>
  anomalies: AnomalieAppel[]
}

/** Écarts d'un appel, et le plan du compte 450 de chacun de ses postes recoupés. */
function recouperAppel(appel: AppelRelu, comptes: CompteCoproprietaire[]): { ecarts: EcartCompte[]; plans: Map<string, string> } {
  const ecrits = debitsParSerie(appel.piece)
  const plans = new Map<string, string>()
  const enEcart: string[] = []
  for (const serie of [...new Set([...ecrits.keys(), ...appel.relus.keys()])].sort((a, b) => a.localeCompare(b))) {
    const relus = appel.relus.get(serie) ?? []
    const budget = somme(relus.filter(estPosteDuBudget).map((p) => p.montantCentimes))
    const planBudget = appel.piece ? planDuBudgetEcrit(ecrits.get(serie) ?? new Map(), budget, somme(relus.map((p) => p.montantCentimes)) - budget) : null
    if (planBudget === null) enEcart.push(serie)
    else for (const poste of relus) plans.set(poste.id, estPosteDuBudget(poste) ? planBudget : PLAN_450)
  }
  return { ecarts: ecartsDeLAppel(appel, comptes, ecrits, enEcart), plans }
}

/** Un écart par série en écart de l'appel, avec son message en clair. */
function ecartsDeLAppel(appel: AppelRelu, comptes: CompteCoproprietaire[], ecrits: ReadonlyMap<string, ReadonlyMap<string, number>>, enEcart: string[]): EcartCompte[] {
  const nom = appel.piece ? `appel n° ${appel.piece.numero}` : `appel ${appel.traitementId}`
  const motEcheance = appel.echeanceIds.length > 1 ? 'échéances' : 'échéance'
  const echeancesCitees = appel.echeanceIds.map((id) => `« ${id} »`).join(', ')
  const echeances = `${motEcheance} ${echeancesCitees}`
  const anomalies = appel.anomalies.map(decrireAnomalie).join(' ; ')
  const anomaliesRelues = anomalies ? ` Anomalies de la répartition relue : ${anomalies}.` : ''
  const suite = `${anomaliesRelues} Séries en écart sur cet appel : ${enEcart.join(', ')}. ${SUITE_ECART}`
  return enEcart.map((serie): EcartCompte => {
    const constat = constatDeLEcart(ecrits.get(serie) ?? new Map(), appel.relus.get(serie) ?? [])
    const motif = appel.piece
      ? `${constat} ; clé de répartition ou positions modifiées depuis l'appel.`
      : `pièce introuvable au journal des traitements du syndicat ; ses postes (${constat}) ne se recoupent avec aucune écriture.`
    return { compteId: comptes.find((c) => c.serie === serie)?.id ?? null, serie, message: `Compte copropriétaire de série ${serie}, ${nom} (${echeances}) : ${motif}${suite}` }
  })
}

/** Une anomalie de la répartition relue, avec son échéance et son lot. */
function decrireAnomalie(a: AnomalieAppel): string {
  const lot = a.lotId ? `, lot ${a.lotId}` : ''
  return `${a.code} (échéance « ${a.echeanceId} »${lot})`
}

/** Appels relus, dans l'ordre de leur première échéance : échéances, pièce, postes par série, anomalies de la répartition. */
function appelsRelus(appelees: EcheanceAppelee[], postes: PosteDette[], anomalies: AnomalieAppel[], { pieces, comptes }: Pick<DonneesPostes, 'pieces' | 'comptes'>): AppelRelu[] {
  const serieDe = new Map(comptes.map((c) => [c.id, c.serie]))
  return [...new Set(appelees.map((e) => e.traitementId))].map((traitementId) => {
    const echeanceIds = appelees.filter((e) => e.traitementId === traitementId).map((e) => e.id)
    const relus = new Map<string, PosteDette[]>()
    for (const poste of postes) {
      if (poste.appelId === null || !echeanceIds.includes(poste.appelId)) continue
      const serie = serieDe.get(poste.compteId) ?? poste.compteId
      relus.set(serie, [...(relus.get(serie) ?? []), poste])
    }
    return { traitementId, echeanceIds, piece: pieces.find((p) => p.id === traitementId), relus, anomalies: anomalies.filter((a) => echeanceIds.includes(a.echeanceId)) }
  })
}

/**
 * Postes nés des appels écrits, non réglés, appels annulés compris, chacun avec le compte 450 que son appel a débité
 * (planCompte) quand il se recoupe avec l'écriture, et les écarts des autres. Une échéance appelée sans écriture (0 €,
 * F108) n'a pas de poste ; une quote-part que la répartition relue ne porte à aucun compte (lot sans compte, clé disparue)
 * se voit au recoupement, sur le compte que l'appel a débité.
 */
function postesAppeles({ echeances, cles, positions, comptes, pieces }: Omit<DonneesPostes, 'encaissements'>): PostesDuSyndicat {
  const appelees = echeancesAppelees(echeances)
  const avis = avisDAppel({ echeances: appelees, cles, positions, comptes })
  const relus = postesDepuisAvis({ ...avis, anomalies: [] }, cles)
  const plans = new Map<string, string>()
  const ecarts: EcartCompte[] = []
  for (const appel of appelsRelus(appelees, relus, avis.anomalies, { pieces, comptes })) {
    const recoupe = recouperAppel(appel, comptes)
    ecarts.push(...recoupe.ecarts)
    for (const [posteId, plan] of recoupe.plans) plans.set(posteId, plan)
  }
  const avecSonCompte = (poste: PosteDette): PosteDette => {
    const planCompte = plans.get(poste.id)
    return planCompte === undefined ? poste : { ...poste, planCompte }
  }
  return { postes: relus.map(avecSonCompte), ecarts }
}

/** Écart propre à un compte, hors recoupement d'un appel. */
const ecartDuCompte = (compteId: string, comptes: CompteCoproprietaire[], motif: string): EcartCompte => ({
  compteId,
  serie: comptes.find((c) => c.id === compteId)?.serie ?? '',
  message: `${motif} ${SUITE_ECART}`,
})

/**
 * Pièces de reclassement d'un encaissement réimputé : chacune doit être au journal du syndicat et ne pas être « Annulé » ;
 * sinon l'imputation courante gardée sur l'encaissement n'est plus celle que le compte 450 porte : écart du compte.
 */
function ecartsDesReclassements(e: DonneesPostes['encaissements'][number], pieces: DonneesPostes['pieces'], comptes: CompteCoproprietaire[]): EcartCompte[] {
  return (e.reimputations ?? []).flatMap((reimputation) => {
    const piece = pieces.find((p) => p.id === reimputation.traitementId)
    if (piece && piece.statut !== 'Annulé') return []
    const constat = piece
      ? `sa pièce de reclassement n° ${piece.numero} a été annulée hors du circuit des encaissements`
      : `sa pièce de reclassement ${reimputation.traitementId} est introuvable au journal des traitements du syndicat`
    return [ecartDuCompte(e.compteId, comptes, `Encaissement ${e.id} : ${constat} ; son imputation courante, réimputée dans l'ordre des dates, n'est plus celle que porte le compte ${e.compteId}.`)]
  })
}

/**
 * Réglé de chaque poste : somme des lignes d'imputation des encaissements non annulés des comptes sans écart. Écart du
 * compte de l'encaissement : pièce annulée hors du circuit des encaissements, pièce de reclassement d'une de ses
 * réimputations absente ou annulée, ligne sans son poste ou d'un autre compte.
 */
function reglesParPoste(
  postes: PosteDette[],
  { encaissements, pieces, comptes }: Pick<DonneesPostes, 'encaissements' | 'pieces' | 'comptes'>,
  dejaEnEcart: ReadonlySet<string | null>,
): { regles: Map<string, number>; ecarts: EcartCompte[] } {
  const compteDe = new Map(postes.map((p) => [p.id, p.compteId]))
  const regles = new Map<string, number>()
  const ecarts: EcartCompte[] = []
  for (const e of encaissements) {
    if (e.annulation || dejaEnEcart.has(e.compteId)) continue
    const piece = pieces.find((p) => p.id === e.traitementId)
    if (piece?.statut === 'Annulé')
      ecarts.push(ecartDuCompte(e.compteId, comptes, `Encaissement ${e.id} : sa pièce n° ${piece.numero} a été annulée hors du circuit des encaissements (annulerEncaissementEcrit) ; son imputation compte encore dans le réglé du compte ${e.compteId}.`))
    ecarts.push(...ecartsDesReclassements(e, pieces, comptes))
    for (const ligne of e.imputation.lignes) {
      const compteId = compteDe.get(ligne.posteId)
      if (compteId === e.compteId) cumuler(regles, ligne.posteId, ligne.montantCentimes)
      else if (compteId === undefined)
        ecarts.push(ecartDuCompte(e.compteId, comptes, `Encaissement ${e.id} : poste imputé « ${ligne.posteId} » introuvable parmi les postes des appels écrits (clé ou positions modifiées depuis l'imputation).`))
      else ecarts.push(ecartDuCompte(e.compteId, comptes, `Encaissement ${e.id} du compte ${e.compteId} : poste imputé « ${ligne.posteId} » d'un autre compte (${compteId}).`))
    }
  }
  return { regles, ecarts }
}

/** Postes d'un compte sur lesquels imputer (appels annulés écartés), ou l'écart que postesImputables lève. */
function imputablesDuCompte(compteId: string, postes: PosteDette[], echeances: EcheanceAppelSuivie[], comptes: CompteCoproprietaire[]): PosteDette[] | EcartCompte {
  const depasse = postes.find((p) => p.regleCentimes > p.montantCentimes)
  if (depasse)
    return ecartDuCompte(compteId, comptes, `Poste ${depasse.id} : réglé de ${depasse.regleCentimes} centimes pour ${depasse.montantCentimes} centimes appelés (clé ou positions modifiées depuis l'imputation).`)
  try {
    return postesImputables(postes, echeances)
  } catch (erreur) {
    return ecartDuCompte(compteId, comptes, erreur instanceof Error ? erreur.message : String(erreur))
  }
}

/**
 * Postes du syndicat sur lesquels un encaissement peut s'imputer, réglé à jour, et écarts : postes des appels écrits,
 * recoupés avec leur écriture et portant le compte 450 que leur appel a débité ; réglés des lignes d'imputation des
 * encaissements non annulés ; sans ceux d'un appel annulé ; sans ceux des comptes en écart. C'est l'entrée de
 * imputation-encaissements.imputerEncaissement(s). Ne lève pas d'erreur pour un écart : l'appelant refuse, compte par compte.
 */
export function postesDesComptes(donnees: DonneesPostes): PostesDuSyndicat {
  const appeles = postesAppeles(donnees)
  const ecarts = [...appeles.ecarts]
  const enEcart = new Set(ecarts.map((e) => e.compteId))
  const lus = reglesParPoste(appeles.postes, donnees, enEcart)
  for (const ecart of lus.ecarts) {
    ecarts.push(ecart)
    enEcart.add(ecart.compteId)
  }
  const postes: PosteDette[] = []
  for (const compteId of new Set(appeles.postes.map((p) => p.compteId))) {
    if (enEcart.has(compteId)) continue
    const duCompte = appeles.postes.filter((p) => p.compteId === compteId).map((p) => ({ ...p, regleCentimes: lus.regles.get(p.id) ?? 0 }))
    const imputables = imputablesDuCompte(compteId, duCompte, donnees.echeances, donnees.comptes)
    if (Array.isArray(imputables)) postes.push(...imputables)
    else ecarts.push(imputables)
  }
  return { postes, ecarts }
}

/** Solde d'un compte copropriétaire sur ses postes appelés ; positif : il doit, négatif : crédit « à imputer ». */
export interface SoldeCompte {
  compteId: string
  /** Total des postes appelés (appels annulés exclus), échus ou non. */
  appeleCentimes: number
  regleCentimes: number
  resteDuCentimes: number
  /** Reliquats des encaissements non annulés, laissés « à imputer » au crédit du compte. */
  creditAImputerCentimes: number
  /** Reste dû moins crédit à imputer. */
  soldeCentimes: number
}

/**
 * Soldes des comptes qui ont un poste ou un crédit « à imputer », dans l'ordre des séries. `horsAppels` : échéances à
 * laisser de côté — celles de l'avis en préparation, pour le « solde antérieur » de cet avis (réponse du référent métier
 * du 22/11/2026, point ap-02). `comptesEnEcart` : comptes dont les postes ne sont pas rendus (postesDesComptes) ; aucun
 * solde ne leur est donné, leur crédit « à imputer » seul serait faux.
 * À valider (référent métier) : le solde compte tous les postes appelés, échus ou non, et ne compte pas le solde repris de
 * l'ancienne fiche, qui n'a aucune écriture (migration-d2.RepriseSoldeCompte).
 */
export function soldesDesComptes(
  postes: PosteDette[],
  { encaissements, comptes }: Pick<DonneesPostes, 'encaissements' | 'comptes'>,
  { horsAppels = [], comptesEnEcart = new Set() }: { horsAppels?: readonly string[]; comptesEnEcart?: ReadonlySet<string | null> } = {},
): SoldeCompte[] {
  const exclues = new Set(horsAppels)
  const appeles = new Map<string, number>()
  const regles = new Map<string, number>()
  const credits = new Map<string, number>()
  for (const p of postes) {
    if (p.appelId !== null && exclues.has(p.appelId)) continue
    cumuler(appeles, p.compteId, p.montantCentimes)
    cumuler(regles, p.compteId, p.montantCentimes - soldePoste(p))
  }
  for (const e of encaissements) if (!e.annulation) cumuler(credits, e.compteId, e.imputation.resteAImputerCentimes)
  return [...comptes]
    .sort((a, b) => a.serie.localeCompare(b.serie))
    .filter((c) => !comptesEnEcart.has(c.id) && (appeles.has(c.id) || (credits.get(c.id) ?? 0) > 0))
    .map((c) => {
      const [appeleCentimes, regleCentimes, creditAImputerCentimes] = [appeles.get(c.id) ?? 0, regles.get(c.id) ?? 0, credits.get(c.id) ?? 0]
      const resteDuCentimes = appeleCentimes - regleCentimes
      return { compteId: c.id, appeleCentimes, regleCentimes, resteDuCentimes, creditAImputerCentimes, soldeCentimes: resteDuCentimes - creditAImputerCentimes }
    })
}

/** Lignes d'imputation à garder sur l'encaissement : celles du résultat, avec l'appel et le compte 450 de leur poste. */
export function lignesEcrites(lignes: readonly LigneImputation[], postes: readonly PosteDette[]): LigneImputationEcrite[] {
  return lignes.map((ligne) => {
    const poste = postes.find((p) => p.id === ligne.posteId)
    if (!poste) throw new Error(`Poste imputé introuvable (id=${ligne.posteId}).`)
    return { ...ligne, appelId: poste.appelId, typeAppel: poste.typeAppel, planCompte: poste.planCompte ?? PLAN_450 }
  })
}

/**
 * Postes d'un encaissement tels que ses lignes écrites les décrivent (un par poste imputé, réglé de la part imputée) : ce
 * qu'il faut à l'écriture contraire de son annulation (encaissements-pieces.annulerEncaissement : appel d'origine et
 * compte crédité de chaque ligne), sans relire l'échéancier ni les clés. Ils ne disent pas le dû du poste : jamais une
 * entrée de l'imputation. Refuse des lignes d'un même poste qui ne portent pas le même appel ou le même compte.
 */
export function postesDeLImputation(encaissement: Pick<EncaissementImpute, 'id' | 'compteId' | 'date' | 'imputation'>): PosteDette[] {
  const postes = new Map<string, PosteDette>()
  for (const ligne of encaissement.imputation.lignes) {
    const deja = postes.get(ligne.posteId)
    if (deja && (deja.appelId !== ligne.appelId || deja.typeAppel !== ligne.typeAppel || deja.planCompte !== ligne.planCompte))
      throw new Error(`Encaissement ${encaissement.id} : lignes du poste « ${ligne.posteId} » incohérentes (appel ou compte crédité différents).`)
    const impute = (deja?.regleCentimes ?? 0) + ligne.montantCentimes
    postes.set(ligne.posteId, {
      id: ligne.posteId,
      compteId: encaissement.compteId,
      appelId: ligne.appelId,
      typeAppel: ligne.typeAppel,
      libelle: '',
      exigibilite: encaissement.date,
      montantCentimes: impute,
      regleCentimes: impute,
      contentieux: false,
      planCompte: ligne.planCompte,
    })
  }
  return [...postes.values()]
}
