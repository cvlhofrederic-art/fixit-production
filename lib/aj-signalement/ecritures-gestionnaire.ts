// ── AJ Signalement : ce qu'un gestionnaire connecté écrit sur une copropriété (PR 2, SPEC § 2.5) ─────────────────
//
// Module pur, sans dépendance serveur : appliqué par POST /coproprietes et PATCH /coproprietes/[id] quand l'auteur est un
// gestionnaire (fiche active relue par le serveur, portée calculée par porteeGestionnaireQr).
//   - RG-22 et Q4 (Hugo, 10/11/2026) : une adresse qu'il AJOUTE aux destinataires appartient à un domaine e-mail de SON
//     cabinet (liste vide : aucun ajout possible) et n'est jamais l'adresse d'une fiche, la sienne comprise (RG-06 bis-1 :
//     un gestionnaire reçoit par son attribution, qui s'arrête quand il la perd, jamais par une saisie qui survivrait à
//     son départ ; une sous-adresse « + » de la boîte d'une fiche est l'adresse de la fiche, relecture 2 du lot 6). Le
//     domaine est contrôlé avant la fiche, et le message est le même pour sa propre adresse et celle d'un
//     collègue : la réponse ne nomme personne. Les adresses déjà posées par le super admin restent conservables ;
//   - RG-06 bis-4 : les saisies MASQUÉES (adresse d'une autre fiche, données antérieures) ne lui sont jamais montrées ; il
//     ne peut donc pas les renvoyer : la liste écrite les conserve (adresses envoyées ∪ masquées existantes), dans l'ordre
//     existant, les ajouts à la fin (une liste inchangée à l'écran n'est jamais une modification) ;
//   - SPEC § 1.6 : un doublon n'est nommé que s'il est dans sa portée ; il n'est jamais forçable (decisionDoublonsQr).

import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import { boiteEmailQr, emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { DoublonQr, DoublonRenduGestionnaireQr } from '@/lib/aj-signalement/types'

/** Détails des refus (400 invalide) : nom du champ en tête, comme les messages de Zod ; jamais une adresse. */
export const MESSAGES_ADRESSES_GESTIONNAIRE_QR = {
  aucunDomaine: 'emailsDestinataires: aucun domaine e-mail n’est déclaré pour votre cabinet : aucune adresse ne peut être ajoutée',
  horsDomaine: 'emailsDestinataires: adresse hors des domaines du cabinet',
  adresseDeFiche: 'emailsDestinataires: adresse non autorisée ici : un gestionnaire reçoit les signalements par son attribution',
} as const

/** Adresses canoniques (rognées, minuscules), dédoublonnées, dans l'ordre reçu. */
const canoniques = (emails: readonly unknown[]): string[] =>
  [...new Set(emails.map(emailCanoniqueQr).filter((e): e is string => e !== null))]

/**
 * Refus d'adresses AJOUTÉES par un gestionnaire (null : aucune). `domaines` : ceux de SON cabinet ; `fiches` : fiches
 * (de tout cabinet, actives ou non) dont l'adresse est parmi les ajouts.
 */
export function refusAdressesAjouteesQr(
  ajoutees: readonly string[], domaines: readonly string[], fiches: ReadonlyArray<{ email: string | null }>,
): string | null {
  if (ajoutees.length === 0) return null
  if (domaines.length === 0) return MESSAGES_ADRESSES_GESTIONNAIRE_QR.aucunDomaine
  if (ajoutees.some((email) => !emailDansDomainesQr(email, domaines))) return MESSAGES_ADRESSES_GESTIONNAIRE_QR.horsDomaine
  if (adressesDeFichesQr(ajoutees, fiches).length > 0) return MESSAGES_ADRESSES_GESTIONNAIRE_QR.adresseDeFiche
  return null
}

/**
 * Saisies à écrire quand le gestionnaire `gestionnaireId` envoie `envoyees` (ce qu'il voit, modifié) : dans l'ordre
 * existant, chaque adresse gardée par lui ou masquée pour lui (adresse d'une AUTRE fiche, parmi `fiches`), puis ses
 * ajouts. `ajoutees` : adresses absentes des saisies existantes (à contrôler par refusAdressesAjouteesQr).
 */
export function saisiesEcritesGestionnaireQr(
  existantes: readonly string[], envoyees: readonly string[], fiches: ReadonlyArray<{ id: string; email: string | null }>, gestionnaireId: string,
): { ecrites: string[]; ajoutees: string[] } {
  const anciennes = canoniques(existantes)
  // Boîtes des AUTRES fiches : même règle que saisiesVisiblesQr (ce qu'il ne voit pas est conservé).
  const masquees = new Set(fiches.filter((f) => f.id !== gestionnaireId).map((f) => boiteEmailQr(f.email)).filter((e): e is string => e !== null))
  const masquee = (email: string) => masquees.has(boiteEmailQr(email) ?? email)
  const gardees = canoniques(envoyees)
  const envoyeesSet = new Set(gardees)
  const anciennesSet = new Set(anciennes)
  const ajoutees = gardees.filter((email) => !anciennesSet.has(email))
  return {
    ecrites: [...anciennes.filter((email) => masquee(email) || envoyeesSet.has(email)), ...ajoutees],
    ajoutees,
  }
}

/** Doublon tel qu'un gestionnaire le reçoit : la copropriété seulement si elle est dans sa portée ; jamais « forcable ». */
export function doublonVuGestionnaireQr(doublon: DoublonQr, visibles: ReadonlySet<string>): DoublonRenduGestionnaireQr {
  const { certitude, critere, copropriete } = doublon
  return visibles.has(copropriete.id) ? { certitude, critere, copropriete: { ...copropriete } } : { certitude, critere }
}
