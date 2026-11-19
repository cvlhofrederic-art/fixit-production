import { ajouterJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Identite } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { dateEnvoiNotification, type CourrierNotification } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'

/**
 * J78 — case « professionnel » datée de la fiche identité (CPCE art. L. 100 ; contrôle J53), codée avec la table des
 * identités (version 3 de db/schema.ts ; écriture : db/identites.ts, enregistrerQualiteProfessionnelle). Fonctions
 * pures, dates ISO (AAAA-MM-JJ). Décisions du 19/11/2026 (en-tête d'identites-positions.ts), à valider par Frédéric
 * avant toute fusion :
 * - la qualité se lit à la date de l'envoi : le dépôt quand il est saisi, sinon l'événement, telle que le code de J50
 *   la calcule (statut-assemblee.ts, dateEnvoiNotification, extraite d'evaluerNotification sans recopie : le dépôt
 *   n'est gardé que s'il ne suit pas l'événement) ; décocher la case plus tard ne change pas le calcul des envois déjà
 *   faits ;
 * - la case ne se coche que sur une justification écrite (texte obligatoire ; pièce de la GED facultative), jamais du
 *   seul fait d'être une personne morale ; cochée à tort, la notification est irrégulière et le délai ne court pas.
 *
 * Choix de cette PR (à valider) :
 * - chaque saisie ajoute un état daté à la suite, sans réécrire les précédents ; une saisie ne se date jamais avant la
 *   précédente ;
 * - un changement, coché comme décoché, prend effet le LENDEMAIN de sa saisie : les dates sont au jour près, et un envoi
 *   du jour même se relit donc avec l'état d'avant (sinon décocher après une LRE déposée le même jour exigerait après
 *   coup le consentement, et cocher après l'envoi l'en dispenserait après coup). Limite : décochée puis envoi le même
 *   jour, l'envoi est lu avec la case cochée de la veille ; plusieurs saisies le même jour : la dernière l'emporte ;
 * - la case sans date (Identite.professionnel) est le dernier état SAISI, pour l'affichage ; qualiteProfessionnelleDe
 *   la lit, sans date. Le contrôle J53 lit les états datés seulement (qualiteProfessionnelleA) : une case cochée sans
 *   état daté (ligne écrite hors de l'application) n'est pas crue ; un état invalide, ou des états dans le désordre,
 *   donnent une lecture non professionnelle (lecture prudente de J53).
 * 🔴 Question pour Frédéric : sans dépôt saisi, la date lue est l'événement (première présentation, transmission de
 * l'avis), postérieur à l'envoi ; un changement saisi entre l'envoi et l'événement modifie donc encore la lecture. Faut-il
 * exiger le dépôt pour lire la case, ou garder la décision telle quelle ?
 */

/** État de la case à compter d'un jour (J78). */
export interface EtatQualiteProfessionnelle {
  professionnel: boolean
  /** Jour de la saisie (AAAA-MM-JJ). */
  saisiLe: string
  /** Prise d'effet : le lendemain de la saisie (voir l'en-tête). */
  du: string
  /** Justification écrite : obligatoire pour cocher (ex. société qui reçoit l'envoi pour son activité) ; null sinon. */
  justification: string | null
  /** Pièce de la GED qui porte la justification ; null : aucune. */
  documentId: string | null
}

/** Identité lue par le contrôle J53 : sa case sans date et ses états datés (table des identités). */
export interface IdentiteQualiteDatee extends Pick<Identite, 'id'>, Partial<Pick<Identite, 'professionnel'>> {
  historiqueProfessionnel?: EtatQualiteProfessionnelle[]
}

export interface SaisieQualiteProfessionnelle {
  professionnel: boolean
  justification?: string | null
  documentId?: string | null
}

function verifierDate(date: string, objet: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
}

const estEtatValide = (e: unknown): e is EtatQualiteProfessionnelle => {
  if (e === null || typeof e !== 'object') return false
  const { professionnel, saisiLe, du } = e as Record<string, unknown>
  return typeof professionnel === 'boolean' && typeof saisiLe === 'string' && estDateIsoValide(saisiLe) && typeof du === 'string' && estDateIsoValide(du)
}

/**
 * Nouvelle saisie de la case : un état ajouté à la suite (effet le lendemain), la case sans date mise au dernier état
 * saisi. Refuse : une valeur qui n'est ni cochée ni décochée, cocher sans justification écrite, un jour invalide ou
 * antérieur à la saisie précédente. L'identité reçue n'est pas modifiée.
 */
export function changerQualiteProfessionnelle(
  identite: Pick<IdentiteQualiteDatee, 'historiqueProfessionnel'>,
  saisie: SaisieQualiteProfessionnelle,
  { aujourdhui }: { aujourdhui: string },
): { professionnel: boolean; historiqueProfessionnel: EtatQualiteProfessionnelle[] } {
  if (typeof saisie.professionnel !== 'boolean')
    throw new Error(`Case « professionnel » : cochée ou décochée attendue (reçu « ${String(saisie.professionnel)} »).`)
  verifierDate(aujourdhui, 'Case « professionnel »')
  const justification = saisie.justification?.trim() || null
  if (saisie.professionnel && justification === null)
    throw new Error(
      "Case « professionnel » cochée sans justification écrite (J78) : préciser pourquoi le destinataire agit à des fins professionnelles (par exemple une société qui reçoit l'envoi pour son activité) ; jamais du seul fait d'être une personne morale.",
    )
  const historique = identite.historiqueProfessionnel ?? []
  const dernier = historique.at(-1)
  if (dernier !== undefined && aujourdhui < dernier.saisiLe)
    throw new Error(`Case « professionnel » saisie le ${aujourdhui}, antérieure au dernier état (saisi le ${dernier.saisiLe}) : un état ne se date jamais avant le précédent.`)
  const etat: EtatQualiteProfessionnelle = {
    professionnel: saisie.professionnel,
    saisiLe: aujourdhui,
    du: ajouterJours(aujourdhui, 1),
    justification,
    documentId: saisie.documentId?.trim() || null,
  }
  return { professionnel: saisie.professionnel, historiqueProfessionnel: [...historique, etat] }
}

/**
 * Qualité professionnelle à une date, telle que le contrôle J53 l'attend (null lu comme non professionnel) : null si
 * l'identité est absente ; sinon le dernier état daté qui a pris effet ce jour-là au plus tard (true seulement s'il est
 * coché) ; aucun état à cette date : false (non saisie). Ne lit que les états datés ; un état invalide ou des états dans
 * le désordre : false.
 */
export function qualiteProfessionnelleA(identite: IdentiteQualiteDatee | null | undefined, date: string): boolean | null {
  if (identite === null || identite === undefined) return null
  verifierDate(date, 'Lecture de la case « professionnel »')
  const historique: unknown = identite.historiqueProfessionnel ?? []
  if (!Array.isArray(historique)) return false
  let retenu: EtatQualiteProfessionnelle | null = null
  let precedent: EtatQualiteProfessionnelle | null = null
  for (const etat of historique as unknown[]) {
    if (!estEtatValide(etat)) return false
    if (precedent !== null && (etat.saisiLe < precedent.saisiLe || etat.du < precedent.du)) return false
    if (etat.du <= date) retenu = etat
    precedent = etat
  }
  return retenu?.professionnel === true
}

/**
 * Qualité du destinataire à la date de SON envoi (dateEnvoiNotification : dépôt saisi, sinon événement) : null si
 * l'identité est absente, ou si l'envoi n'est pas prouvé (courrier absent, événement non saisi) — le moteur de délais
 * refuse alors de toute façon. C'est la qualité à passer à finDelaiContestationAg (notification unique), lue sur la
 * fiche de courrier.personneId.
 */
export function qualiteProfessionnelleALEnvoi(
  identite: IdentiteQualiteDatee | null | undefined,
  courrier: CourrierNotification | null | undefined,
): boolean | null {
  if (identite === null || identite === undefined || courrier === null || courrier === undefined) return null
  const date = dateEnvoiNotification(courrier)
  return date === null ? null : qualiteProfessionnelleA(identite, date)
}

/**
 * Qualité de chaque destinataire pour le contrôle J53 (NotificationDestinataire de statut-assemblee.ts), lue à la date
 * de son envoi (qualiteProfessionnelleALEnvoi, courrier rattaché par courrierId) : à brancher par l'appelant de
 * finDelaiContestationAgParDestinataire (aucun aujourd'hui), à la place d'avecQualiteProfessionnelle, qui lit la case
 * sans date. La fiche est la seule source : une valeur donnée par l'appelant est remplacée. Identité en double dans les
 * fiches : erreur (données incohérentes). L'entrée n'est pas modifiée.
 */
export function avecQualiteProfessionnelleALEnvoi<T extends { identiteId: string; courrierId: string | null }>(
  destinataires: readonly T[],
  identites: readonly IdentiteQualiteDatee[],
  courriers: readonly CourrierNotification[],
): (T & { professionnel: boolean | null })[] {
  const parId = new Map<string, IdentiteQualiteDatee>()
  for (const identite of identites) {
    if (parId.has(identite.id))
      throw new Error(`Identité ${identite.id} en double dans les fiches identité (case « professionnel ») : données incohérentes.`)
    parId.set(identite.id, identite)
  }
  return destinataires.map((d) => ({
    ...d,
    professionnel: qualiteProfessionnelleALEnvoi(parId.get(d.identiteId), courriers.find((c) => c.id === d.courrierId)),
  }))
}
