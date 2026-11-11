// ── AJ Signalement : destinataires d'un signalement (SPEC § 1.7.1, RG-06 et RG-06 bis) ──────────────────────────
//
// Demande de Hugo du 10/11/2026 : le gestionnaire reçoit AUTOMATIQUEMENT les signalements de ses copropriétés. Les
// fiches qui reçoivent (actives, adresse confirmée et non contestée, attribuées à la copropriété ou « à tous » du même
// cabinet) sont choisies en base par signalements_qr_emails_gestionnaires ; ce module pur assemble l'envoi :
//   (adresses saisies MOINS les adresses de fiches inactives ou contestées) ∪ gestionnaires, dédoublonnés sur l'adresse
//   canonique ; une adresse de fiche se reconnaît à sa BOÎTE (boiteEmailQr : « prenom+etiquette@ » est « prenom@ »,
//   relecture 2 du lot 6) ; une adresse des deux côtés garde le type « gestionnaire » ; ADMIN_EMAIL / ADMIN_EMAIL_2 seulement si
//   l'union est vide (règle actuelle, Q3) ; plafond de 100 (un lot Resend), le reste compté sans adresse.
// Un e-mail par destinataire (lot 3) : personne ne voit les autres adresses.

import { boiteEmailQr, emailCanoniqueQr } from '@/lib/aj-signalement/gestionnaires'
import type {
  CalculDestinatairesQr, DestinataireQr, LigneEmailGestionnaireQr, SaisiesVisiblesQr,
} from '@/lib/aj-signalement/types'

/** Destinataires d'un dépôt au plus : un lot de sendBatchEmails. */
export const DESTINATAIRES_MAX_QR = 100

const canoniques = (valeurs: readonly unknown[]): string[] =>
  valeurs.map(emailCanoniqueQr).filter((e): e is string => e !== null)

/** Boîtes des adresses (une étiquette « + » ne change pas la boîte qui reçoit). */
const boites = (valeurs: readonly unknown[]): Set<string> =>
  new Set(valeurs.map(boiteEmailQr).filter((e): e is string => e !== null))

/** L'adresse (canonique) est-elle dans l'une des boîtes ? */
const dansBoites = (email: string, ensemble: ReadonlySet<string>): boolean => ensemble.has(boiteEmailQr(email) ?? email)

/**
 * Destinataires d'un nouveau signalement. `gestionnaires` : lignes de signalements_qr_emails_gestionnaires (exclu =
 * false : destinataire ; exclu = true : fiche inactive ou contestée dont l'adresse est restée dans les saisies, retirée
 * de l'envoi). Ordre : saisies, puis gestionnaires ; repli administrateur si rien ne reste.
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
 * gestionnaire, active ou non, ou une sous-adresse « + » de sa boîte (canoniques, dédoublonnées, dans l'ordre proposé).
 * Les routes ne l'appliquent qu'aux adresses AJOUTÉES (une adresse de fiche déjà présente ne bloque pas la modification).
 */
export function adressesDeFichesQr(emails: readonly string[], fiches: ReadonlyArray<{ email: string | null }>): string[] {
  const deFiches = boites(fiches.map((f) => f.email))
  return [...new Set(canoniques(emails).filter((email) => dansBoites(email, deFiches)))]
}

/**
 * RG-06 bis-4 (PR 2) : saisies montrées au gestionnaire `gestionnaireId` ; l'adresse d'une AUTRE fiche (ou une
 * sous-adresse « + » de sa boîte) est remplacée par un compteur ; la sienne et les adresses extérieures restent.
 */
export function saisiesVisiblesQr(
  emails: readonly string[], fiches: ReadonlyArray<{ id: string; email: string | null }>, gestionnaireId: string,
): SaisiesVisiblesQr {
  const autres = boites(fiches.filter((f) => f.id !== gestionnaireId).map((f) => f.email))
  const visibles: string[] = []
  let adressesMasquees = 0
  for (const email of emails) {
    const canonique = emailCanoniqueQr(email)
    if (canonique && dansBoites(canonique, autres)) adressesMasquees += 1
    else visibles.push(email)
  }
  return { emails: visibles, adressesMasquees }
}
