// ── AJ Signalement : destinataires d'un signalement (SPEC § 1.7.1, RG-06 et RG-06 bis) ──────────────────────────
//
// Demande de Hugo du 10/11/2026 : le gestionnaire reçoit AUTOMATIQUEMENT les signalements de ses copropriétés. Les
// fiches qui reçoivent (actives, adresse confirmée et non contestée, attribuées à la copropriété ou « à tous » du même
// cabinet) sont choisies en base par signalements_qr_emails_gestionnaires ; ce module pur assemble l'envoi :
//   (adresses saisies MOINS les saisies reconnues comme celles de fiches inactives ou contestées) ∪ gestionnaires,
//   dédoublonnés sur l'adresse canonique ; une adresse des deux côtés garde le type « gestionnaire » ; ADMIN_EMAIL /
//   ADMIN_EMAIL_2 seulement si l'union est vide (règle actuelle, Q3) ; plafond de 100 (un lot Resend), le reste compté
//   sans adresse.
// Une adresse est celle d'une fiche (adresseDeFicheQr, même règle en SQL dans la 20261112) quand elle a la même BOÎTE
// (boiteEmailQr : « prenom+etiquette@ » est « prenom@ », relecture 2 du lot 6), ou, corrections du tour 2, la même partie
// locale de boîte sur un domaine DÉCLARÉ par le cabinet de la fiche : un cabinet qui a deux domaines (ancien et nouveau
// nom, domaine secondaire) les fait livrer par sa messagerie aux mêmes boîtes.
// Un e-mail par destinataire (lot 3) : personne ne voit les autres adresses.

import { boiteEmailQr, emailCanoniqueQr, partiesBoiteQr } from '@/lib/aj-signalement/gestionnaires'
import type {
  CabinetsDesDomainesQr, CalculDestinatairesQr, DestinataireQr, FicheAdresseQr, LigneEmailGestionnaireQr, SaisiesVisiblesQr,
} from '@/lib/aj-signalement/types'

/** Destinataires d'un dépôt au plus : un lot de sendBatchEmails. */
export const DESTINATAIRES_MAX_QR = 100

/** Aucun domaine connu : seule la boîte rapproche une adresse d'une fiche. */
const AUCUN_DOMAINE_QR: CabinetsDesDomainesQr = new Map()

const canoniques = (valeurs: readonly unknown[]): string[] =>
  valeurs.map(emailCanoniqueQr).filter((e): e is string => e !== null)

/** Boîtes des adresses (une étiquette « + » ne change pas la boîte qui reçoit). */
const boites = (valeurs: readonly unknown[]): Set<string> =>
  new Set(valeurs.map(boiteEmailQr).filter((e): e is string => e !== null))

/** L'adresse (canonique) est-elle dans l'une des boîtes ? */
const dansBoites = (email: string, ensemble: ReadonlySet<string>): boolean => ensemble.has(boiteEmailQr(email) ?? email)

/** Clé « cabinet + partie locale » (JSON : aucune collision entre un identifiant et une partie locale). */
const cleLocale = (cabinetId: string, locale: string): string => JSON.stringify([cabinetId, locale])

/**
 * Reconnaît les adresses des `fiches` : même boîte (tout cabinet), ou même partie locale de boîte sur un domaine que
 * `cabinets` attribue au cabinet de la fiche (domaine de la fiche indifférent : une fiche forcée hors des domaines garde sa
 * partie locale sur ceux de son cabinet). Même règle que la jointure de signalements_qr_emails_gestionnaires (20261112).
 */
export function adresseDeFicheQr(
  fiches: ReadonlyArray<FicheAdresseQr>, cabinets: CabinetsDesDomainesQr = AUCUN_DOMAINE_QR,
): (email: string) => boolean {
  const boitesFiches = boites(fiches.map((f) => f.email))
  const locales = new Set<string>()
  for (const f of fiches) {
    if (!f.cabinetId) continue
    const parties = partiesBoiteQr(f.email)
    if (parties) locales.add(cleLocale(f.cabinetId, parties.locale))
  }
  return (email) => {
    if (dansBoites(email, boitesFiches)) return true
    const parties = partiesBoiteQr(email)
    if (!parties) return false
    const cabinet = cabinets.get(parties.domaine)
    return cabinet !== undefined && locales.has(cleLocale(cabinet, parties.locale))
  }
}

/**
 * Destinataires d'un nouveau signalement. `gestionnaires` : lignes de signalements_qr_emails_gestionnaires (exclu =
 * false : destinataire ; exclu = true : saisie reconnue comme celle d'une fiche inactive ou contestée, retirée de l'envoi
 * avec ses sous-adresses ; la 20261112 rend la saisie elle-même, la 20261111 l'adresse de la fiche). Ordre : saisies,
 * puis gestionnaires ; repli administrateur si rien ne reste.
 */
export function destinatairesSignalementQr(
  copro: { emails_destinataires?: readonly string[] | null },
  gestionnaires: readonly LigneEmailGestionnaireQr[],
  env: Record<string, string | undefined> = process.env,
): CalculDestinatairesQr {
  const exclues = boites(gestionnaires.filter((g) => g.exclu).map((g) => g.email))
  const fiches = new Map<string, LigneEmailGestionnaireQr>()
  for (const g of gestionnaires) {
    const email = g.exclu ? null : emailCanoniqueQr(g.email)
    if (email && !fiches.has(email)) fiches.set(email, g)
  }

  const liste: DestinataireQr[] = []
  const vues = new Set<string>()
  const ajouter = (destinataire: DestinataireQr) => {
    if (vues.has(destinataire.email)) return
    vues.add(destinataire.email)
    liste.push(destinataire)
  }
  for (const email of canoniques(copro.emails_destinataires ?? [])) {
    if (dansBoites(email, exclues)) continue
    const fiche = fiches.get(email)
    ajouter(fiche ? { email, type: 'gestionnaire', accesOuvert: fiche.accesOuvert } : { email, type: 'saisi', accesOuvert: false })
  }
  for (const [email, fiche] of fiches) ajouter({ email, type: 'gestionnaire', accesOuvert: fiche.accesOuvert })

  if (liste.length === 0) {
    for (const email of canoniques([env.ADMIN_EMAIL, env.ADMIN_EMAIL_2])) ajouter({ email, type: 'administrateur', accesOuvert: false })
  }
  return {
    destinataires: liste.slice(0, DESTINATAIRES_MAX_QR),
    auDelaDuPlafond: Math.max(0, liste.length - DESTINATAIRES_MAX_QR),
  }
}

/**
 * RG-06 bis-1 : parmi des adresses proposées pour les saisies d'une copropriété, celles qui sont l'adresse d'une fiche
 * gestionnaire, active ou non (adresseDeFicheQr : même boîte, ou même partie locale sur un domaine de son cabinet ;
 * canoniques, dédoublonnées, dans l'ordre proposé). Sans `cabinets`, seule la boîte compte. Les routes ne l'appliquent
 * qu'aux adresses AJOUTÉES (une adresse de fiche déjà présente ne bloque pas la modification).
 */
export function adressesDeFichesQr(
  emails: readonly string[], fiches: ReadonlyArray<FicheAdresseQr>, cabinets: CabinetsDesDomainesQr = AUCUN_DOMAINE_QR,
): string[] {
  const deFiche = adresseDeFicheQr(fiches, cabinets)
  return [...new Set(canoniques(emails).filter(deFiche))]
}

/**
 * RG-06 bis-4 (PR 2) : saisies montrées au gestionnaire `gestionnaireId` ; l'adresse d'une AUTRE fiche (adresseDeFicheQr)
 * est remplacée par un compteur ; la sienne et les adresses extérieures restent.
 */
export function saisiesVisiblesQr(
  emails: readonly string[], fiches: ReadonlyArray<FicheAdresseQr & { id: string }>, gestionnaireId: string,
  cabinets: CabinetsDesDomainesQr = AUCUN_DOMAINE_QR,
): SaisiesVisiblesQr {
  const dUneAutre = adresseDeFicheQr(fiches.filter((f) => f.id !== gestionnaireId), cabinets)
  const visibles: string[] = []
  let adressesMasquees = 0
  for (const email of emails) {
    const canonique = emailCanoniqueQr(email)
    if (canonique && dUneAutre(canonique)) adressesMasquees += 1
    else visibles.push(email)
  }
  return { emails: visibles, adressesMasquees }
}
