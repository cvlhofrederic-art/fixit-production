import { postesImputables, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { EncaissementEnregistre } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import type { CompteCoproprietaire, Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  postesDepuisAvis,
  soldePoste,
  type LigneImputation,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { PieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { avisDAppel, type CleRepartition, type SousComptes450 } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { planDuCompte } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * Postes des comptes copropriétaires (D2) relus de ce qui est déjà écrit, sans table des postes. Fonctions pures, montants
 * en CENTIMES ENTIERS, sans écran ni base (lecture et écriture : db/encaissements.ts, qui porte la conception).
 *
 * - Le DÛ d'un poste se relit de l'échéancier : chaque échéance appelée par une pièce « Appel de fonds » est répartie de
 *   nouveau sur sa clé et portée au compte redevable à son exigibilité (repartition-appels.avisDAppel, puis
 *   imputation-encaissements.postesDepuisAvis : un poste par échéance et par lot, « <échéance>:<lot> »). La pièce d'appel
 *   ne porte ni l'échéance ni le lot (un débit par compte 450) : la répartition relue est donc RECOUPÉE avec elle, compte
 *   par compte (echeancier-appels.ts : « les échéances appelées se lisent dans l'avis qui l'a produit, recoupé avec
 *   l'écriture »). Un écart (clé ou positions modifiées depuis l'appel) est un refus : aucun poste n'est rendu, plutôt
 *   qu'un dû qui ne serait plus celui du compte 450.
 * - Le RÉGLÉ d'un poste est la somme des lignes d'imputation des encaissements non annulés (ImputationEcrite, gardée sur
 *   chaque encaissement : l'imputation est faite le jour du paiement, C. civ. art. 1342-10, elle ne se recalcule pas).
 *   Annuler un encaissement (F110) retire donc ses lignes : le poste redevient dû, à son exigibilité d'origine.
 * - Les postes d'un appel annulé sont écartés (echeancier-appels.postesImputables, qui refuse un poste réglé d'un appel
 *   annulé).
 * - `contentieux` vaut toujours false ici : le contentieux se lit encore sur l'ancienne fiche (réponse du référent métier
 *   du 22/11/2026, point ap-06 : il sera porté sur le compte D2 quand le recouvrement passera aux comptes D2). À brancher
 *   ici, sur le poste, à ce moment-là.
 */

/** Imputation d'un encaissement telle qu'elle a été écrite : ResultatImputation sans l'état des postes, qui se relit. */
export interface ImputationEcrite {
  lignes: LigneImputation[]
  /** Reliquat laissé « à imputer » au crédit du compte. */
  resteAImputerCentimes: number
  /** Postes désignés par le débiteur, ignorés parce que déjà soldés. */
  designationsIgnorees: string[]
  /** Désignation qui ne soldait pas les postes désignés, non acceptée : imputation légale à la place (art. 1342-4). */
  designationPartielleRefusee: boolean
  /** Le débiteur a demandé l'imputation du reliquat sur ses appels à venir (art. 1305-3 : le terme lui profite). */
  imputerSurAVenir: boolean
  /** Sous-comptes du 450 appliqués à l'écriture (J67, R104) ; null : tout au 45000. L'annulation contre-passe avec eux. */
  sousComptes450: SousComptes450 | null
}

/** Encaissement d'un copropriétaire écrit au journal des traitements, avec son syndicat (D1) et son imputation. */
export type EncaissementImpute = EncaissementEnregistre & { coproprieteId: string; imputation: ImputationEcrite }

export interface DonneesPostes {
  /** Échéancier complet du syndicat. */
  echeances: EcheanceAppelSuivie[]
  cles: CleRepartition[]
  /** Positions des lots du syndicat, sorties comprises (le redevable est celui de l'exigibilité). */
  positions: Position[]
  comptes: CompteCoproprietaire[]
  /** Pièces du journal des traitements du syndicat (au moins ses appels de fonds). */
  pieces: Pick<PieceTraitement, 'id' | 'numero' | 'traitement'>[]
  /** Encaissements du syndicat, annulés compris. */
  encaissements: Pick<EncaissementImpute, 'id' | 'compteId' | 'annulation' | 'imputation'>[]
}

const cumuler = (cumuls: Map<string, number>, cle: string, montant: number): void => {
  cumuls.set(cle, (cumuls.get(cle) ?? 0) + montant)
}

type EcheanceAppelee = EcheanceAppelSuivie & { traitementId: string }

/** Échéances qu'une pièce « Appel de fonds » a appelées (annulées depuis comprises), par exigibilité puis identifiant. */
const echeancesAppelees = (echeances: EcheanceAppelSuivie[]): EcheanceAppelee[] =>
  echeances
    .filter((e): e is EcheanceAppelee => e.traitementId !== null && (e.statut === 'Appelé' || e.statut === 'Annulé'))
    .sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))

/** Débits des comptes 450 (et de leurs sous-comptes, J67, R104) d'une pièce d'appel, cumulés par série de compte. */
function debitsParSerie(piece: Pick<PieceTraitement, 'traitement'>): Map<string, number> {
  const debits = new Map<string, number>()
  for (const m of piece.traitement.mouvements)
    if (m.sens === 'debit' && planDuCompte(m.compte).startsWith('450')) cumuler(debits, m.compte.split('.')[2] ?? '', m.montantCentimes)
  return debits
}

/** Répartition relue des échéances d'un appel, cumulée par série de compte (à défaut de compte connu : son identifiant). */
function relusParSerie(postes: PosteDette[], echeancesDeLAppel: ReadonlySet<string>, serieDe: ReadonlyMap<string, string>): Map<string, number> {
  const relus = new Map<string, number>()
  for (const poste of postes)
    if (poste.appelId !== null && echeancesDeLAppel.has(poste.appelId)) cumuler(relus, serieDe.get(poste.compteId) ?? poste.compteId, poste.montantCentimes)
  return relus
}

/** Recoupe, pour chaque pièce d'appel, la répartition relue avec ses débits, compte par compte ; refuse tout écart. */
function recouperAvecLesAppels(postes: PosteDette[], appelees: EcheanceAppelee[], { pieces, comptes }: Pick<DonneesPostes, 'pieces' | 'comptes'>): void {
  const serieDe = new Map(comptes.map((c) => [c.id, c.serie]))
  for (const traitementId of new Set(appelees.map((e) => e.traitementId))) {
    const piece = pieces.find((p) => p.id === traitementId)
    if (!piece) throw new Error(`Appel ${traitementId} : pièce introuvable au journal des traitements du syndicat ; ses postes ne se recoupent avec aucune écriture.`)
    const ecrits = debitsParSerie(piece)
    const relus = relusParSerie(postes, new Set(appelees.filter((e) => e.traitementId === traitementId).map((e) => e.id)), serieDe)
    for (const serie of new Set([...ecrits.keys(), ...relus.keys()])) {
      const [relu, ecrit] = [relus.get(serie) ?? 0, ecrits.get(serie) ?? 0]
      if (relu !== ecrit)
        throw new Error(
          `Compte copropriétaire de série ${serie} : la répartition relue (${relu} centimes) ne correspond pas à l'écriture de l'appel n° ${piece.numero} (${ecrit} centimes) : clé de répartition ou positions modifiées depuis l'appel ; aucun poste n'est rendu tant que l'écart n'est pas levé.`,
        )
    }
  }
}

/**
 * Postes nés des appels écrits, non réglés (regleCentimes 0), appels annulés compris : un poste par échéance appelée et
 * par lot, au compte redevable à l'exigibilité, recoupé avec l'écriture de chaque appel. Une échéance appelée sans
 * écriture (0 €, F108) n'a pas de poste. Refuse une répartition relue qui porte une anomalie (lot sans compte, clé
 * disparue), une pièce d'appel absente et tout écart avec l'écriture.
 */
export function postesAppeles({ echeances, cles, positions, comptes, pieces }: Omit<DonneesPostes, 'encaissements'>): PosteDette[] {
  const appelees = echeancesAppelees(echeances)
  if (appelees.length === 0) return []
  const avis = avisDAppel({ echeances: appelees, cles, positions, comptes })
  if (avis.anomalies.length > 0) {
    const detail = avis.anomalies.map((a) => `${a.code} (échéance « ${a.echeanceId} »${a.lotId ? `, lot ${a.lotId}` : ''})`).join(' ; ')
    throw new Error(`Postes des appels écrits : la répartition relue porte ${avis.anomalies.length} anomalie(s) — ${detail} : clé ou positions modifiées depuis l'appel.`)
  }
  const postes = postesDepuisAvis(avis, cles)
  recouperAvecLesAppels(postes, appelees, { pieces, comptes })
  return postes
}

/** Réglé de chaque poste : somme des lignes d'imputation des encaissements non annulés. Refuse une ligne sans son poste. */
function reglesParPoste(postes: PosteDette[], encaissements: DonneesPostes['encaissements']): Map<string, number> {
  const compteDe = new Map(postes.map((p) => [p.id, p.compteId]))
  const regles = new Map<string, number>()
  for (const e of encaissements) {
    if (e.annulation) continue
    for (const ligne of e.imputation.lignes) {
      const compteId = compteDe.get(ligne.posteId)
      if (compteId === undefined)
        throw new Error(`Encaissement ${e.id} : poste imputé « ${ligne.posteId} » introuvable parmi les postes des appels écrits (clé ou positions modifiées depuis l'imputation).`)
      if (compteId !== e.compteId) throw new Error(`Encaissement ${e.id} du compte ${e.compteId} : poste imputé « ${ligne.posteId} » d'un autre compte (${compteId}).`)
      cumuler(regles, ligne.posteId, ligne.montantCentimes)
    }
  }
  return regles
}

/**
 * Postes du syndicat sur lesquels un encaissement peut s'imputer, réglé à jour : postes des appels écrits (postesAppeles),
 * réglés des lignes d'imputation des encaissements non annulés, sans ceux d'un appel annulé (postesImputables). C'est
 * l'entrée de imputation-encaissements.imputerEncaissement(s). Refuse un réglé qui dépasse le dû du poste.
 */
export function postesDesComptes(donnees: DonneesPostes): PosteDette[] {
  const postes = postesAppeles(donnees)
  const regles = reglesParPoste(postes, donnees.encaissements)
  const regler = (poste: PosteDette): PosteDette => {
    const regleCentimes = regles.get(poste.id) ?? 0
    if (regleCentimes > poste.montantCentimes)
      throw new Error(`Poste ${poste.id} : réglé de ${regleCentimes} centimes pour ${poste.montantCentimes} centimes appelés (clé ou positions modifiées depuis l'imputation).`)
    return { ...poste, regleCentimes }
  }
  return postesImputables(postes.map(regler), donnees.echeances)
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
 * du 22/11/2026, point ap-02).
 * À valider (référent métier) : le solde compte tous les postes appelés, échus ou non, et ne compte pas le solde repris de
 * l'ancienne fiche, qui n'a aucune écriture (migration-d2.RepriseSoldeCompte).
 */
export function soldesDesComptes(
  postes: PosteDette[],
  { encaissements, comptes }: Pick<DonneesPostes, 'encaissements' | 'comptes'>,
  { horsAppels = [] }: { horsAppels?: readonly string[] } = {},
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
    .filter((c) => appeles.has(c.id) || (credits.get(c.id) ?? 0) > 0)
    .map((c) => {
      const [appeleCentimes, regleCentimes, creditAImputerCentimes] = [appeles.get(c.id) ?? 0, regles.get(c.id) ?? 0, credits.get(c.id) ?? 0]
      const resteDuCentimes = appeleCentimes - regleCentimes
      return { compteId: c.id, appeleCentimes, regleCentimes, resteDuCentimes, creditAImputerCentimes, soldeCentimes: resteDuCentimes - creditAImputerCentimes }
    })
}
