import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { FAMILLE_CORRECTION_MOUVEMENTS } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  desimputerEncaissement,
  imputerEncaissements,
  type Encaissement,
  type LigneImputation,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { lignesEcrites, type ImputationEcrite } from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import { creerTraitement, type LigneMouvement, type OrigineMouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Réimputation des encaissements d'un compte copropriétaire dans l'ordre des dates, quand un paiement est saisi en retard
 * (décision du 24/11/2026, question 6, option 3 : « réimputer les encaissements du compte dans l'ordre des dates, par un
 * reclassement interne au compte 450, sans toucher à la banque »). Fonctions pures, montants en CENTIMES ENTIERS, dates
 * ISO, sans écran ni base : la lecture, les contrôles de date et l'écriture sont dans db/encaissements.ts, qui porte la
 * conception (point 6) et la liste « À VALIDER ».
 *
 * Fondement : C. civ. art. 1342-10 et arrêté du 14/03/2005, art. 9 (les versements sont affectés, à défaut d'indication
 * contraire, à la dette la plus ancienne). 🔵 Déduit : l'imputation légale opère à chaque paiement, sur les dettes échues
 * au jour de ce paiement ; une imputation écrite sans connaître un paiement antérieur est une constatation inexacte, que
 * le rejeu rectifie. Application mécanique : aucun choix de destination n'est offert à l'appelant.
 *
 * CONCEPTION
 * 1. Ordre des encaissements d'un compte (ordreDesEncaissements) : date, puis numéro de la pièce d'origine (séquence
 *    unique du cabinet, strictement croissante), puis rang dans le lot, puis identifiant. Jamais l'horodatage : deux lots
 *    du même jour peuvent être écrits dans la même milliseconde.
 * 2. Suffixe : les encaissements NON annulés du compte, de date STRICTEMENT postérieure à celle du paiement en retard (le
 *    même jour, ils restent avant : l'ordre de saisie fait foi). L'appelant le compose.
 * 3. postesSansSuffixe : les postes relus, moins les lignes courantes de chaque encaissement du suffixe.
 * 4. Garde du rejeu à blanc (verifierRejeuABlanc) : chaque encaissement du suffixe est rejoué SANS le paiement en retard,
 *    un à la fois, à SA date, avec ses postes désignés, sa désignation partielle acceptée et sa demande d'imputation sur
 *    l'à-venir. Si ce rejeu ne redonne pas son imputation courante (montant par poste, reliquat, désignations ignorées,
 *    désignation partielle refusée), la réimputation est REFUSÉE et le refus nomme l'encaissement et dit pourquoi ; une
 *    erreur levée pendant ce rejeu (poste désigné inconnu) est rendue comme ce refus, avec sa cause. Toute différence
 *    constatée après le vrai rejeu est donc due au seul paiement en retard. Cas que cette garde refuse (non décidés) :
 *    appel écrit après coup mais exigible avant la date de l'encaissement (réimputation du reliquat, F105) ; encaissement
 *    « à imputer sur l'à-venir » suivi d'un appel écrit après coup ; encaissement antérieur rejeté par la banque (F110)
 *    sans réimputation des suivants ; poste désigné disparu (appel annulé).
 * 5. Vrai rejeu (rejouerSuffixe) : depuis les postes laissés par le ou les paiements en retard (imputés par l'appelant à
 *    leur date : seules les dettes échues ce jour-là), chaque encaissement du suffixe à SA date, dans l'ordre.
 * 6. Désignation du débiteur (C. civ. art. 1342-10, al. 1 : elle prime, et seul le débiteur désigne) : refus si, pour un
 *    encaissement du suffixe qui porte des postes désignés, les désignations ignorées ou la désignation partielle refusée
 *    changent, ou si la désignation a joué (non refusée avant) et que les montants sur ses postes désignés changent. Une
 *    désignation refusée avant et après ne refuse rien ; la part imputée par la règle légale peut bouger. 🔴 Non établi :
 *    le sort d'une désignation devenue sans objet (poste désigné soldé par le paiement en retard).
 * 7. Lignes du reclassement (mouvementsReclassement), par encaissement réimputé : crédits d'avant et d'après comparés par
 *    clé (numéro du compte 450 de la ligne, calculé comme imputation-encaissements.mouvementsEncaissementImpute le fait,
 *    planCompte compris ; appel d'origine ; le reliquat au 45000 du compte, sans origine), agrégés par clé (deux lots d'un
 *    même appel). Écart négatif : DÉBIT du 450 avec l'origine perdue ; positif : CRÉDIT avec l'origine gagnée ; nul :
 *    aucune ligne. Équilibré par encaissement, le compte copropriétaire en lien sur chaque ligne, AUCUNE ligne 512.
 *    Insérer un paiement antérieur ne peut qu'augmenter le reliquat d'un encaissement postérieur : un débit du 45000
 *    sans origine est impossible dans ce circuit.
 * 8. Postes appelés après un encaissement du suffixe mais exigibles avant sa date : le vrai rejeu peut y imputer l'argent
 *    libéré par le paiement en retard (ordre légal) — à valider, voir db/encaissements.ts.
 */

/** Encaissement du suffixe à rejouer : tel qu'il a été saisi, et son imputation courante. */
export interface EncaissementARejouer {
  /** Date, montant, postes désignés et désignation partielle acceptée de la saisie. */
  encaissement: Encaissement
  /** Imputation courante, avec la demande d'imputation sur l'à-venir (`imputerSurAVenir`). */
  courante: ImputationEcrite
}

/** Résultat du vrai rejeu d'un encaissement du suffixe. */
export interface Rejeu {
  encaissementId: string
  /** Imputation courante avant la réimputation. */
  avant: ImputationEcrite
  /** Imputation après l'insertion du paiement en retard. */
  apres: ImputationEcrite
  /** Faux : le paiement en retard ne change rien à cet encaissement (ni ligne de reclassement, ni mise à jour). */
  change: boolean
}

type EncaissementOrdonne = { id: string; date: string; traitementId: string | null; rang?: number }

/**
 * Ordre des encaissements d'un compte : date, numéro de la pièce d'origine (`numeros` : numéro par identifiant de pièce ;
 * une pièce absente passe après les pièces numérotées), rang dans le lot, identifiant.
 */
export function ordreDesEncaissements(numeros: ReadonlyMap<string, number>): (a: EncaissementOrdonne, b: EncaissementOrdonne) => number {
  const numeroDe = (e: EncaissementOrdonne): number => (e.traitementId === null ? undefined : numeros.get(e.traitementId)) ?? Number.MAX_SAFE_INTEGER
  return (a, b) => a.date.localeCompare(b.date) || numeroDe(a) - numeroDe(b) || (a.rang ?? 0) - (b.rang ?? 0) || a.id.localeCompare(b.id)
}

const eurosDe = (centimes: number): string => formatEurosCentimes(centimes / 100)
const nommer = (e: Encaissement): string => `Encaissement ${e.id} du ${dateIsoVersFr(e.date)}`
/** Fin commune des refus de la réimputation (domaine et db/encaissements.ts). */
export const SUITE_REFUS_REIMPUTATION = "Réimputation refusée, rien n'est écrit"

/** Postes relus, moins les lignes courantes de chaque encaissement du suffixe (imputation-encaissements.desimputerEncaissement). */
export function postesSansSuffixe(suffixe: readonly EncaissementARejouer[], postes: PosteDette[]): PosteDette[] {
  return suffixe.reduce(
    (courants, { encaissement, courante }) =>
      desimputerEncaissement(
        { encaissementId: encaissement.id, lignes: courante.lignes, resteAImputerCentimes: courante.resteAImputerCentimes, designationsIgnorees: [], designationPartielleRefusee: false, postes: [] },
        courants,
      ),
    postes,
  )
}

function parPoste(lignes: readonly LigneImputation[]): Map<string, number> {
  const montants = new Map<string, number>()
  for (const ligne of lignes) montants.set(ligne.posteId, (montants.get(ligne.posteId) ?? 0) + ligne.montantCentimes)
  return montants
}

const ouiNon = (valeur: boolean): string => (valeur ? 'oui' : 'non')
const listeOuAucune = (ids: readonly string[]): string => (ids.length > 0 ? ids.join(', ') : 'aucune')

/** Ce qui distingue deux imputations d'un même encaissement, en clair ; vide : identiques. `ecrit`, `rejoue` : accords. */
function differences(avant: ImputationEcrite, apres: ImputationEcrite, [ecrit, rejoue]: readonly [string, string]): string[] {
  const [montantsAvant, montantsApres] = [parPoste(avant.lignes), parPoste(apres.lignes)]
  const constats: string[] = []
  for (const posteId of new Set([...montantsAvant.keys(), ...montantsApres.keys()])) {
    const [a, b] = [montantsAvant.get(posteId) ?? 0, montantsApres.get(posteId) ?? 0]
    if (a !== b) constats.push(`poste « ${posteId} » : ${eurosDe(a)} ${ecrit}, ${eurosDe(b)} ${rejoue}`)
  }
  if (avant.resteAImputerCentimes !== apres.resteAImputerCentimes)
    constats.push(`reliquat « à imputer » : ${eurosDe(avant.resteAImputerCentimes)} ${ecrit}, ${eurosDe(apres.resteAImputerCentimes)} ${rejoue}`)
  if (avant.designationsIgnorees.join('|') !== apres.designationsIgnorees.join('|'))
    constats.push(`désignations ignorées (postes déjà soldés) : ${listeOuAucune(avant.designationsIgnorees)} ${ecrit}, ${listeOuAucune(apres.designationsIgnorees)} ${rejoue}`)
  if (avant.designationPartielleRefusee !== apres.designationPartielleRefusee)
    constats.push(`désignation partielle refusée : ${ouiNon(avant.designationPartielleRefusee)} ${ecrit}, ${ouiNon(apres.designationPartielleRefusee)} ${rejoue}`)
  return constats
}

/** Rejoue un encaissement à sa date, comme à sa saisie (mêmes postes désignés, même demande sur l'à-venir). */
function rejouerUn({ encaissement, courante }: EncaissementARejouer, postes: PosteDette[]): { apres: ImputationEcrite; postes: PosteDette[] } {
  const { resultats, postes: suivants } = imputerEncaissements([encaissement], postes, { imputerSurAVenir: courante.imputerSurAVenir })
  const [resultat] = resultats
  return {
    apres: {
      lignes: lignesEcrites(resultat.lignes, resultat.postes),
      resteAImputerCentimes: resultat.resteAImputerCentimes,
      designationsIgnorees: resultat.designationsIgnorees,
      designationPartielleRefusee: resultat.designationPartielleRefusee,
      imputerSurAVenir: courante.imputerSurAVenir,
    },
    postes: suivants,
  }
}

function refusDuRejeuABlanc(encaissement: Encaissement, cause: string): Error {
  return new Error(
    `${nommer(encaissement)} : son imputation écrite ne se rejoue pas à l'identique sur les postes d'aujourd'hui (${cause}). ${SUITE_REFUS_REIMPUTATION} : la réimputation dans l'ordre des dates ne rejoue que des imputations qu'elle retrouve telles qu'elles ont été écrites ; un appel écrit après coup, une demande d'imputation sur les appels à venir suivie d'un appel, un encaissement antérieur rejeté par la banque ou un poste désigné disparu demandent une décision (à valider) ; signaler cet encaissement pour qu'il soit traité.`,
  )
}

/**
 * Garde du rejeu à blanc (conception, point 4) : rejoue le suffixe, dans l'ordre reçu, SANS le paiement en retard, depuis
 * `sansSuffixe` (postesSansSuffixe), et refuse dès qu'un encaissement ne retrouve pas son imputation courante.
 */
export function verifierRejeuABlanc(suffixe: readonly EncaissementARejouer[], sansSuffixe: PosteDette[]): void {
  let postes = sansSuffixe
  for (const aRejouer of suffixe) {
    let rejeu: ReturnType<typeof rejouerUn>
    try {
      rejeu = rejouerUn(aRejouer, postes)
    } catch (erreur) {
      throw refusDuRejeuABlanc(aRejouer.encaissement, (erreur instanceof Error ? erreur.message : String(erreur)).replace(/\.$/, ''))
    }
    const constats = differences(aRejouer.courante, rejeu.apres, ['écrits', 'au rejeu'])
    if (constats.length > 0) throw refusDuRejeuABlanc(aRejouer.encaissement, constats.join(' ; '))
    postes = rejeu.postes
  }
}

/** Désignation du débiteur d'un encaissement du suffixe : jamais déplacée par la réimputation (conception, point 6). */
function verifierDesignationGardee({ encaissement, courante }: EncaissementARejouer, apres: ImputationEcrite): void {
  const designes = encaissement.postesDesignes ?? []
  if (designes.length === 0) return
  const seulsSignalements = { ...apres, lignes: courante.lignes, resteAImputerCentimes: courante.resteAImputerCentimes }
  const constats = differences(courante, seulsSignalements, ['avant', 'après'])
  if (!courante.designationPartielleRefusee) {
    const [avant, rejoue] = [parPoste(courante.lignes), parPoste(apres.lignes)]
    for (const posteId of designes) {
      const [a, b] = [avant.get(posteId) ?? 0, rejoue.get(posteId) ?? 0]
      if (a !== b) constats.push(`poste « ${posteId} » : ${eurosDe(a)} avant, ${eurosDe(b)} après`)
    }
  }
  if (constats.length === 0) return
  const cites = designes.map((id) => `« ${id} »`).join(', ')
  const objet = designes.length > 1 ? `les postes ${cites}` : `le poste ${cites}`
  throw new Error(
    `${nommer(encaissement)} : le débiteur a désigné ${objet} en payant (C. civ. art. 1342-10, al. 1), et le paiement saisi en retard changerait l'effet de cette désignation (${constats.join(' ; ')}). ${SUITE_REFUS_REIMPUTATION} : le sort d'une désignation devenue sans objet n'est établi par aucun texte (à valider) ; signaler cet encaissement pour qu'il soit traité.`,
  )
}

/**
 * Vrai rejeu (conception, points 5 et 6) : depuis `apresLeRetard` (postes sans le suffixe, après l'imputation du ou des
 * paiements en retard), chaque encaissement du suffixe à sa date, dans l'ordre reçu. Rend, pour chacun, son imputation
 * d'avant et d'après, et les postes après le rejeu. Refuse une désignation du débiteur qui serait déplacée.
 */
export function rejouerSuffixe(suffixe: readonly EncaissementARejouer[], apresLeRetard: PosteDette[]): { rejeux: Rejeu[]; postes: PosteDette[] } {
  let postes = apresLeRetard
  const rejeux = suffixe.map((aRejouer): Rejeu => {
    const rejeu = rejouerUn(aRejouer, postes)
    verifierDesignationGardee(aRejouer, rejeu.apres)
    postes = rejeu.postes
    return {
      encaissementId: aRejouer.encaissement.id,
      avant: aRejouer.courante,
      apres: rejeu.apres,
      change: differences(aRejouer.courante, rejeu.apres, ['avant', 'après']).length > 0,
    }
  })
  return { rejeux, postes }
}

/** Comptes 450 d'un compte copropriétaire, comme encaissements-pieces les passe à mouvementsEncaissementImpute. */
export interface Comptes450DuCompte {
  compteId: string
  /** Le 45000 du compte : il porte le reliquat « à imputer », sans appel d'origine. */
  compteCoproprietaire: string
  /** Numéro du compte 450 du copropriétaire pour un code de plan (45000 ou sous-compte). */
  compteDuPlan: (planCode: string) => string
}

interface CreditDuCompte {
  compte: string
  origine?: OrigineMouvement
  montantCentimes: number
}

/** Crédits du 450 d'une imputation, par compte et par appel d'origine (le reliquat : 45000 du compte, sans origine). */
function creditsParCle(imputation: ImputationEcrite, { compteCoproprietaire, compteDuPlan }: Comptes450DuCompte): Map<string, CreditDuCompte> {
  const credits = new Map<string, CreditDuCompte>()
  const cumuler = (compte: string, montantCentimes: number, origine?: OrigineMouvement): void => {
    const cle = origine?.type === 'appel' ? [compte, origine.appelId, origine.typeAppel].join('|') : compte
    const deja = credits.get(cle)
    credits.set(cle, { compte, ...(origine ? { origine } : {}), montantCentimes: (deja?.montantCentimes ?? 0) + montantCentimes })
  }
  for (const ligne of imputation.lignes)
    cumuler(compteDuPlan(ligne.planCompte), ligne.montantCentimes, ligne.appelId && ligne.typeAppel ? { type: 'appel', appelId: ligne.appelId, typeAppel: ligne.typeAppel } : undefined)
  if (imputation.resteAImputerCentimes > 0) cumuler(compteCoproprietaire, imputation.resteAImputerCentimes)
  return credits
}

/**
 * Lignes du reclassement d'UN encaissement réimputé (conception, point 7) : débits des origines perdues, puis crédits des
 * origines gagnées. Vide si rien ne change. Jamais de ligne de banque.
 */
export function mouvementsReclassement({ avant, apres, ...comptes }: Comptes450DuCompte & { avant: ImputationEcrite; apres: ImputationEcrite }): LigneMouvement[] {
  const [creditsAvant, creditsApres] = [creditsParCle(avant, comptes), creditsParCle(apres, comptes)]
  const liens = { compteCoproprietaireId: comptes.compteId }
  const debits: LigneMouvement[] = []
  const credits: LigneMouvement[] = []
  for (const cle of new Set([...creditsAvant.keys(), ...creditsApres.keys()])) {
    const reference = (creditsAvant.get(cle) ?? creditsApres.get(cle)) as CreditDuCompte
    const ecart = (creditsApres.get(cle)?.montantCentimes ?? 0) - (creditsAvant.get(cle)?.montantCentimes ?? 0)
    if (ecart === 0) continue
    const ligne = { compte: reference.compte, montantCentimes: Math.abs(ecart), ...(reference.origine ? { origine: reference.origine } : {}), liens: { ...liens } }
    if (ecart < 0) debits.push({ ...ligne, sens: 'debit' })
    else credits.push({ ...ligne, sens: 'credit' })
  }
  return [...debits, ...credits]
}

/**
 * Pièce de reclassement d'un compte : famille « Correction de mouvements » (bloc Mouvements du référentiel ; 🔵 son usage
 * dans Gestéam n'a pas été observé), datée du jour du traitement, sans renvoi `annule` (ce n'est pas une annulation).
 * `lignes` : les lignes de tous les encaissements réimputés du compte, dans l'ordre (mouvementsReclassement).
 */
export function traitementReclassement(lignes: LigneMouvement[], { id, date }: { id: string; date: string }): Traitement {
  if (!id.trim()) throw new Error('Pièce de reclassement sans identifiant.')
  if (lignes.some((l) => l.compte.split('.')[1]?.startsWith('512'))) throw new Error('Pièce de reclassement : aucune ligne de banque (512) ; le reclassement est interne au compte 450.')
  return creerTraitement({ id, famille: FAMILLE_CORRECTION_MOUVEMENTS, date, mouvements: lignes })
}

/**
 * Mention de la pièce justificative du reclassement (arrêté du 14/03/2005, art. 4 ; décret n° 2005-240, art. 6), gardée
 * sur chaque encaissement réimputé : fondement, compte, paiement(s) en retard avec leur pièce et le jour de leur saisie,
 * encaissement réimputé avec sa pièce. Le journal des traitements n'a pas de libellé d'écriture : voir db/encaissements.ts.
 */
export function mentionReimputation({
  serie,
  enRetard,
  saisiLe,
  reimpute,
}: {
  serie: string
  enRetard: { ids: readonly string[]; date: string; numeroPiece: number }
  saisiLe: string
  reimpute: { id: string; date: string; numeroPiece: number | null }
}): string {
  const pluriel = enRetard.ids.length > 1 ? 's' : ''
  const retard = `encaissement${pluriel} ${enRetard.ids.join(', ')} du ${dateIsoVersFr(enRetard.date)} (pièce n° ${enRetard.numeroPiece}) saisi${pluriel} le ${dateIsoVersFr(saisiLe)}`
  const piece = reimpute.numeroPiece === null ? 'pièce introuvable' : `pièce n° ${reimpute.numeroPiece}`
  return `Réimputation dans l'ordre des dates (C. civ. art. 1342-10 ; arrêté du 14/03/2005, art. 9) du compte ${serie} : ${retard} ; encaissement réimputé ${reimpute.id} du ${dateIsoVersFr(reimpute.date)} (${piece}).`
}
