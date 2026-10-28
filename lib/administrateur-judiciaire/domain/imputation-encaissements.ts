import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ReglementDebiteur } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { LigneMouvement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { TYPE_APPEL_LIE_AU_MOUVEMENT, type TypeAppelLieAuMouvement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Imputation des encaissements d'un copropriétaire sur les postes d'appel de son compte (cartographie Gestéam,
 * tranche 43 § 2 et § 8). Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran.
 *
 * Gestéam — un encaissement (virement, chèque) crédite le compte 450 et s'impute ligne à ligne sur les « postes de
 * terme » du compte : appel de provisions, appel de fonds travaux…, chacun avec son dû et son payé ; un reliquat reste
 * « à imputer » ; la colonne « Ctx » marque une dette passée en contentieux.
 *
 * Ordre d'imputation (C. civ. art. 1342-10) : d'abord les postes que le débiteur DÉSIGNE en payant (s'il ne les solde
 * pas tous, la désignation ne s'applique que si le gestionnaire accepte ce paiement partiel — art. 1342-4 al. 1 ; à
 * défaut, imputation légale et signalement) ; à défaut de désignation, les dettes ÉCHUES (exigibles au plus tard le
 * jour de l'encaissement), la plus ancienne d'abord, et proportionnellement entre dettes de même ancienneté.
 * 🔵 Le critère légal intermédiaire — la dette « que le débiteur avait le plus d'intérêt d'acquitter » — ne se déduit
 * pas des données : il n'est pas appliqué automatiquement. Il ne doit jamais être saisi comme une désignation : seul le
 * débiteur désigne ; le gestionnaire ne se substitue pas à lui.
 * Reliquat : par défaut il reste « à imputer » au crédit du compte. Le terme profite au débiteur (art. 1305-3) : une
 * imputation sur des appels non échus (`imputerSurAVenir`) suppose sa volonté ; même alors, un appel de FONDS DE
 * TRAVAUX non échu n'est jamais servi d'office, ces sommes étant définitivement acquises au syndicat dès leur versement
 * (L. 1965 art. 14-2-1, III).
 * L'écriture reste celle de R7 (débit banque / crédit 450) ; chaque crédit porte l'appel d'origine (R8).
 */

export interface PosteDette {
  id: string
  /** Compte copropriétaire (450) débiteur du poste. */
  compteId: string
  /** Échéance d'appel d'origine ; null pour une dette sans appel (reprise de solde). */
  appelId: string | null
  typeAppel: TypeAppelLieAuMouvement | null
  libelle: string
  exigibilite: string
  montantCentimes: number
  regleCentimes: number
  /** Dette passée en contentieux (colonne « Ctx » de Gestéam). */
  contentieux: boolean
}

export interface Encaissement {
  id: string
  /** Compte copropriétaire crédité. */
  compteId: string
  date: string
  montantCentimes: number
  /** Postes que le débiteur désigne en payant, dans l'ordre (C. civ. art. 1342-10, al. 1). */
  postesDesignes?: string[]
  /** Le gestionnaire accepte une désignation qui ne solde pas les postes désignés (C. civ. art. 1342-4, al. 1). */
  designationPartielleAcceptee?: boolean
}

export interface LigneImputation {
  posteId: string
  montantCentimes: number
}

export interface ResultatImputation {
  encaissementId: string
  lignes: LigneImputation[]
  /** Reliquat non imputé, laissé au crédit du compte. */
  resteAImputerCentimes: number
  /** Postes désignés ignorés parce que déjà soldés (en lot seulement : un encaissement antérieur les a réglés). */
  designationsIgnorees: string[]
  /** Désignation partielle non acceptée : l'imputation légale s'est appliquée à la place. */
  designationPartielleRefusee: boolean
  /** Tous les postes reçus, réglés mis à jour (les postes reçus ne sont pas modifiés). */
  postes: PosteDette[]
}

export interface OptionsImputation {
  /**
   * Après les dettes échues, imputer le reliquat sur les appels à venir (par défaut : NON, il reste à imputer). Les
   * appels de fonds de travaux non échus ne sont jamais servis d'office.
   */
  imputerSurAVenir?: boolean
}

interface OptionsInternes extends OptionsImputation {
  /** En lot : ignorer (et signaler) la désignation d'un poste déjà soldé au lieu de la refuser. */
  ignorerDesignationsSoldees?: boolean
}

export const soldePoste = (poste: PosteDette): number => poste.montantCentimes - poste.regleCentimes

const verifierDate = (libelle: string, date: string): void => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide pour ${libelle} (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierPostes(postes: PosteDette[]): void {
  const vus = new Set<string>()
  for (const poste of postes) {
    if (vus.has(poste.id)) throw new Error(`Poste en double (id=${poste.id}).`)
    vus.add(poste.id)
    verifierDate(`le poste ${poste.id}`, poste.exigibilite)
    if (!Number.isInteger(poste.montantCentimes) || poste.montantCentimes <= 0)
      throw new Error(`Montant du poste ${poste.id} invalide (${poste.montantCentimes}) : centimes entiers > 0 attendus.`)
    if (!Number.isInteger(poste.regleCentimes) || poste.regleCentimes < 0 || poste.regleCentimes > poste.montantCentimes)
      throw new Error(`Réglé du poste ${poste.id} invalide (${poste.regleCentimes}) : entre 0 et le montant du poste.`)
    if (poste.typeAppel !== null && !TYPE_APPEL_LIE_AU_MOUVEMENT.includes(poste.typeAppel))
      throw new Error(`Type d'appel inconnu : « ${poste.typeAppel} ».`)
    if ((poste.appelId === null) !== (poste.typeAppel === null))
      throw new Error(`Poste ${poste.id} : appel d'origine et type d'appel vont ensemble (R8), l'un manque.`)
  }
}

function verifierEncaissement(encaissement: Encaissement): void {
  verifierDate(`l'encaissement ${encaissement.id}`, encaissement.date)
  if (!Number.isInteger(encaissement.montantCentimes) || encaissement.montantCentimes <= 0)
    throw new Error(`Montant de l'encaissement ${encaissement.id} invalide (${encaissement.montantCentimes}) : centimes entiers > 0 attendus.`)
  const designes = encaissement.postesDesignes ?? []
  if (new Set(designes).size !== designes.length) throw new Error('Un même poste est désigné deux fois.')
}

/** Postes désignés par le débiteur, contrôlés (existants, du compte crédité) ; soldés : refusés, ou ignorés en lot. */
function postesDesignes(
  encaissement: Encaissement,
  postes: PosteDette[],
  ignorerSoldes: boolean,
): { retenus: PosteDette[]; ignores: string[] } {
  const retenus: PosteDette[] = []
  const ignores: string[] = []
  for (const id of encaissement.postesDesignes ?? []) {
    const poste = postes.find((p) => p.id === id)
    if (!poste) throw new Error(`Poste désigné inconnu (id=${id}).`)
    if (poste.compteId !== encaissement.compteId) throw new Error(`Le poste désigné ${id} appartient à un autre compte.`)
    if (soldePoste(poste) > 0) retenus.push(poste)
    else if (ignorerSoldes) ignores.push(id)
    else throw new Error(`Le poste désigné ${id} est déjà soldé.`)
  }
  return { retenus, ignores }
}

/** Groupes de postes de même exigibilité, du plus ancien au plus récent. */
function groupesParAnciennete(postes: PosteDette[]): PosteDette[][] {
  const groupes = new Map<string, PosteDette[]>()
  for (const poste of postes) groupes.set(poste.exigibilite, [...(groupes.get(poste.exigibilite) ?? []), poste])
  return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, groupe]) => groupe)
}

/** Répartit `montant` entre des soldes au prorata (plus forts restes) ; au-delà du total, chacun est soldé. */
const repartirAuProrata = (montant: number, soldes: number[]): number[] =>
  montant >= soldes.reduce((s, x) => s + x, 0) ? [...soldes] : repartirAuxPlusFortsRestes(montant, soldes)

function imputerAvecOptions(
  encaissement: Encaissement,
  postes: PosteDette[],
  { imputerSurAVenir = false, ignorerDesignationsSoldees = false }: OptionsInternes,
): ResultatImputation {
  verifierEncaissement(encaissement)
  verifierPostes(postes)
  const regles = new Map(postes.map((p) => [p.id, p.regleCentimes]))
  const solde = (p: PosteDette) => p.montantCentimes - (regles.get(p.id) ?? 0)
  const lignes: LigneImputation[] = []
  let disponible = encaissement.montantCentimes
  const imputer = (poste: PosteDette, montant: number) => {
    if (montant <= 0) return
    regles.set(poste.id, (regles.get(poste.id) ?? 0) + montant)
    lignes.push({ posteId: poste.id, montantCentimes: montant })
    disponible -= montant
  }

  const designes = postesDesignes(encaissement, postes, ignorerDesignationsSoldees)
  const totalDesigne = designes.retenus.reduce((s, p) => s + solde(p), 0)
  const designationPartielleRefusee =
    designes.retenus.length > 0 && disponible < totalDesigne && encaissement.designationPartielleAcceptee !== true
  if (!designationPartielleRefusee) for (const poste of designes.retenus) imputer(poste, Math.min(disponible, solde(poste)))

  const ouverts = postes.filter((p) => p.compteId === encaissement.compteId && solde(p) > 0)
  const echus = ouverts.filter((p) => p.exigibilite <= encaissement.date)
  const aVenir = imputerSurAVenir
    ? ouverts.filter((p) => p.exigibilite > encaissement.date && p.typeAppel !== 'Fonds travaux')
    : []
  for (const groupe of [...groupesParAnciennete(echus), ...groupesParAnciennete(aVenir)]) {
    if (disponible === 0) break
    const parts = repartirAuProrata(disponible, groupe.map(solde))
    groupe.forEach((poste, i) => imputer(poste, parts[i]))
  }

  return {
    encaissementId: encaissement.id,
    lignes,
    resteAImputerCentimes: disponible,
    designationsIgnorees: designes.ignores,
    designationPartielleRefusee,
    postes: postes.map((p) => ({ ...p, regleCentimes: regles.get(p.id) ?? p.regleCentimes })),
  }
}

/** Impute un encaissement sur les postes du compte crédité ; renvoie les lignes, le reliquat et les postes mis à jour. */
export const imputerEncaissement = (
  encaissement: Encaissement,
  postes: PosteDette[],
  options: OptionsImputation = {},
): ResultatImputation => imputerAvecOptions(encaissement, postes, options)

/**
 * Impute plusieurs encaissements dans l'ordre des dates — à date égale, dans l'ordre reçu (ordre du relevé) —, chacun
 * sur les soldes laissés par le précédent. La désignation d'un poste déjà soldé par un encaissement antérieur est
 * ignorée et signalée (`designationsIgnorees`). Les reliquats non imputés sont cumulés (`creditAImputerCentimes`).
 */
export function imputerEncaissements(
  encaissements: Encaissement[],
  postes: PosteDette[],
  options: OptionsImputation = {},
): { resultats: ResultatImputation[]; postes: PosteDette[]; creditAImputerCentimes: number } {
  if (new Set(encaissements.map((e) => e.id)).size !== encaissements.length) throw new Error('Encaissement compté deux fois.')
  verifierPostes(postes)
  const ordonnes = [...encaissements].sort((a, b) => a.date.localeCompare(b.date))
  const resultats: ResultatImputation[] = []
  let courants = postes.map((p) => ({ ...p }))
  for (const encaissement of ordonnes) {
    const resultat = imputerAvecOptions(encaissement, courants, { ...options, ignorerDesignationsSoldees: true })
    resultats.push(resultat)
    courants = resultat.postes
  }
  const creditAImputerCentimes = resultats.reduce((s, r) => s + r.resteAImputerCentimes, 0)
  return { resultats, postes: courants, creditAImputerCentimes }
}

/**
 * R7 + R8 — écriture de l'encaissement imputé : débit banque du montant ; crédit du compte copropriétaire, une ligne par
 * poste imputé portant l'appel d'origine quand il est connu, plus le reliquat sans origine. Les postes sont lus dans le
 * résultat d'imputation lui-même.
 */
export function mouvementsEncaissementImpute({
  encaissement,
  resultat,
  compteBanque,
  compteCoproprietaire,
}: {
  encaissement: Encaissement
  resultat: ResultatImputation
  compteBanque: string
  compteCoproprietaire: string
}): LigneMouvement[] {
  if (resultat.encaissementId !== encaissement.id) throw new Error("Le résultat d'imputation ne correspond pas à l'encaissement.")
  const impute = resultat.lignes.reduce((s, l) => s + l.montantCentimes, 0)
  if (impute + resultat.resteAImputerCentimes !== encaissement.montantCentimes)
    throw new Error("Résultat d'imputation incohérent : imputé + reste ≠ montant de l'encaissement.")
  const credits: LigneMouvement[] = resultat.lignes.map((ligne) => {
    const poste = resultat.postes.find((p) => p.id === ligne.posteId)
    if (!poste) throw new Error(`Poste imputé introuvable (id=${ligne.posteId}).`)
    const origine =
      poste.appelId && poste.typeAppel ? { origine: { type: 'appel' as const, appelId: poste.appelId, typeAppel: poste.typeAppel } } : {}
    return { compte: compteCoproprietaire, sens: 'credit', montantCentimes: ligne.montantCentimes, ...origine }
  })
  if (resultat.resteAImputerCentimes > 0)
    credits.push({ compte: compteCoproprietaire, sens: 'credit', montantCentimes: resultat.resteAImputerCentimes })
  return [{ compte: compteBanque, sens: 'debit', montantCentimes: encaissement.montantCentimes }, ...credits]
}

/**
 * Pour le décompte du contentieux d'un compte (`decompte-contentieux.ts`) : la part de chaque encaissement de ce compte
 * imputée sur ses postes en contentieux, sous forme de règlements du débiteur. Les encaissements sans part contentieuse
 * sont omis. Le tri entre règlements antérieurs et postérieurs à l'arrêté de la demande ou du jugement se fait dans
 * `calculerDecompte`.
 */
export function reglementsSurContentieux(
  resultats: ResultatImputation[],
  encaissements: Encaissement[],
  postes: PosteDette[],
  compteId: string,
): ReglementDebiteur[] {
  const enContentieux = new Set(postes.filter((p) => p.contentieux && p.compteId === compteId).map((p) => p.id))
  return resultats.flatMap((resultat) => {
    const encaissement = encaissements.find((e) => e.id === resultat.encaissementId)
    if (!encaissement) throw new Error(`Encaissement introuvable (id=${resultat.encaissementId}).`)
    if (encaissement.compteId !== compteId) return []
    const montantCentimes = resultat.lignes
      .filter((l) => enContentieux.has(l.posteId))
      .reduce((s, l) => s + l.montantCentimes, 0)
    return montantCentimes > 0 ? [{ id: encaissement.id, date: encaissement.date, montantCentimes }] : []
  })
}
