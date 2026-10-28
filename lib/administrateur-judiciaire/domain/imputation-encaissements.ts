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
 * Ordre d'imputation (C. civ. art. 1342-10) : d'abord les postes que le débiteur DÉSIGNE en payant ; à défaut, les
 * dettes ÉCHUES (exigibles au plus tard le jour de l'encaissement), la plus ancienne d'abord, et proportionnellement
 * entre dettes de même ancienneté. 🔵 Le critère légal intermédiaire — la dette « que le débiteur avait le plus
 * d'intérêt d'acquitter » — ne se déduit pas des données : il n'est pas appliqué automatiquement (à faire par
 * désignation). Le reliquat s'impute sur les appels à venir (même ordre) ou reste à imputer, au choix.
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
  /** Tous les postes reçus, réglés mis à jour (les postes reçus ne sont pas modifiés). */
  postes: PosteDette[]
}

export interface OptionsImputation {
  /** Après les dettes échues, imputer le reliquat sur les appels à venir (par défaut : oui). */
  imputerSurAVenir?: boolean
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
  }
}

function verifierEncaissement(encaissement: Encaissement): void {
  verifierDate(`l'encaissement ${encaissement.id}`, encaissement.date)
  if (!Number.isInteger(encaissement.montantCentimes) || encaissement.montantCentimes <= 0)
    throw new Error(`Montant de l'encaissement ${encaissement.id} invalide (${encaissement.montantCentimes}) : centimes entiers > 0 attendus.`)
  const designes = encaissement.postesDesignes ?? []
  if (new Set(designes).size !== designes.length) throw new Error('Un même poste est désigné deux fois.')
}

/** Postes désignés par le débiteur, contrôlés (existants, du compte crédité, non soldés). */
function postesDesignes(encaissement: Encaissement, postes: PosteDette[]): PosteDette[] {
  return (encaissement.postesDesignes ?? []).map((id) => {
    const poste = postes.find((p) => p.id === id)
    if (!poste) throw new Error(`Poste désigné inconnu (id=${id}).`)
    if (poste.compteId !== encaissement.compteId) throw new Error(`Le poste désigné ${id} appartient à un autre compte.`)
    if (soldePoste(poste) === 0) throw new Error(`Le poste désigné ${id} est déjà soldé.`)
    return poste
  })
}

/** Groupes de postes de même exigibilité, du plus ancien au plus récent. */
function groupesParAnciennete(postes: PosteDette[]): PosteDette[][] {
  const groupes = new Map<string, PosteDette[]>()
  for (const poste of postes) groupes.set(poste.exigibilite, [...(groupes.get(poste.exigibilite) ?? []), poste])
  return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, groupe]) => groupe)
}

/** Répartit `montant` entre des soldes au prorata, au centime près (plus forts restes, départage par l'ordre reçu). */
function repartirAuProrata(montant: number, soldes: number[]): number[] {
  const total = soldes.reduce((s, x) => s + x, 0)
  if (montant >= total) return [...soldes]
  const bruts = soldes.map((solde, rang) => {
    const exact = (montant * solde) / total
    return { rang, part: Math.floor(exact), reste: exact - Math.floor(exact) }
  })
  let aDistribuer = montant - bruts.reduce((s, b) => s + b.part, 0)
  for (const b of [...bruts].sort((x, y) => y.reste - x.reste || x.rang - y.rang)) {
    if (aDistribuer === 0) break
    b.part += 1
    aDistribuer -= 1
  }
  return bruts.map((b) => b.part)
}

/** Impute un encaissement sur les postes du compte crédité ; renvoie les lignes, le reliquat et les postes mis à jour. */
export function imputerEncaissement(
  encaissement: Encaissement,
  postes: PosteDette[],
  { imputerSurAVenir = true }: OptionsImputation = {},
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

  for (const poste of postesDesignes(encaissement, postes)) imputer(poste, Math.min(disponible, solde(poste)))

  const ouverts = postes.filter((p) => p.compteId === encaissement.compteId && solde(p) > 0)
  const echus = ouverts.filter((p) => p.exigibilite <= encaissement.date)
  const aVenir = imputerSurAVenir ? ouverts.filter((p) => p.exigibilite > encaissement.date) : []
  for (const groupe of [...groupesParAnciennete(echus), ...groupesParAnciennete(aVenir)]) {
    if (disponible === 0) break
    const parts = repartirAuProrata(disponible, groupe.map(solde))
    groupe.forEach((poste, i) => imputer(poste, parts[i]))
  }

  return {
    encaissementId: encaissement.id,
    lignes,
    resteAImputerCentimes: disponible,
    postes: postes.map((p) => ({ ...p, regleCentimes: regles.get(p.id) ?? p.regleCentimes })),
  }
}

/** Impute plusieurs encaissements dans l'ordre des dates (puis des identifiants), chacun sur les soldes laissés. */
export function imputerEncaissements(
  encaissements: Encaissement[],
  postes: PosteDette[],
  options: OptionsImputation = {},
): { resultats: ResultatImputation[]; postes: PosteDette[] } {
  if (new Set(encaissements.map((e) => e.id)).size !== encaissements.length) throw new Error('Encaissement compté deux fois.')
  const ordonnes = [...encaissements].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const resultats: ResultatImputation[] = []
  let courants = postes
  for (const encaissement of ordonnes) {
    const resultat = imputerEncaissement(encaissement, courants, options)
    resultats.push(resultat)
    courants = resultat.postes
  }
  return { resultats, postes: courants }
}

/**
 * R7 + R8 — écriture de l'encaissement imputé : débit banque du montant ; crédit du compte copropriétaire, une ligne par
 * poste imputé portant l'appel d'origine quand il est connu, plus le reliquat sans origine.
 */
export function mouvementsEncaissementImpute({
  encaissement,
  resultat,
  postes,
  compteBanque,
  compteCoproprietaire,
}: {
  encaissement: Encaissement
  resultat: ResultatImputation
  postes: PosteDette[]
  compteBanque: string
  compteCoproprietaire: string
}): LigneMouvement[] {
  if (resultat.encaissementId !== encaissement.id) throw new Error("Le résultat d'imputation ne correspond pas à l'encaissement.")
  const credits: LigneMouvement[] = resultat.lignes.map((ligne) => {
    const poste = postes.find((p) => p.id === ligne.posteId)
    if (!poste) throw new Error(`Poste imputé introuvable (id=${ligne.posteId}).`)
    return {
      compte: compteCoproprietaire,
      sens: 'credit',
      montantCentimes: ligne.montantCentimes,
      ...(poste.appelId && poste.typeAppel ? { origine: { type: 'appel' as const, appelId: poste.appelId, typeAppel: poste.typeAppel } } : {}),
    }
  })
  if (resultat.resteAImputerCentimes > 0)
    credits.push({ compte: compteCoproprietaire, sens: 'credit', montantCentimes: resultat.resteAImputerCentimes })
  return [{ compte: compteBanque, sens: 'debit', montantCentimes: encaissement.montantCentimes }, ...credits]
}

/**
 * Pour le décompte du contentieux (`decompte-contentieux.ts`) : la part de chaque encaissement imputée sur des postes
 * en contentieux, sous forme de règlements du débiteur. Les encaissements sans part contentieuse sont omis.
 */
export function reglementsSurContentieux(
  resultats: ResultatImputation[],
  encaissements: Encaissement[],
  postes: PosteDette[],
): ReglementDebiteur[] {
  const enContentieux = new Set(postes.filter((p) => p.contentieux).map((p) => p.id))
  return resultats.flatMap((resultat) => {
    const encaissement = encaissements.find((e) => e.id === resultat.encaissementId)
    if (!encaissement) throw new Error(`Encaissement introuvable (id=${resultat.encaissementId}).`)
    const montantCentimes = resultat.lignes
      .filter((l) => enContentieux.has(l.posteId))
      .reduce((s, l) => s + l.montantCentimes, 0)
    return montantCentimes > 0 ? [{ id: encaissement.id, date: encaissement.date, montantCentimes }] : []
  })
}
