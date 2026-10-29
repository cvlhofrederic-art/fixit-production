import { ajouterJours, composerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Identite } from '@/lib/administrateur-judiciaire/domain/identites-positions'

/**
 * Voie de notification d'un copropriétaire : électronique par principe, postale sur demande (point 60 du bilan 2).
 * Fonctions pures, dates ISO, sans écran.
 *
 * Le droit — 🟢 vérifié sur Légifrance le 28/10/2026 (cartographie, tranche 43 § 5), relu le 29/10/2026 :
 * - L. 1965 art. 42-1 (loi n° 2024-322 du 9 avril 2024, art. 38) : « Les notifications et les mises en demeure sont
 *   valablement faites par voie électronique » ; le copropriétaire peut, à tout moment et par tout moyen, demander la voie
 *   postale, et le syndic l'informe des moyens de la conserver ;
 * - décret n° 2025-1292 du 22 décembre 2025 (en vigueur le 25/12/2025), D. 1967 : voie électronique de principe (art.
 *   64) ; lettre recommandée avec accusé de réception pour le copropriétaire qui a demandé la voie postale (art. 64-1) ;
 *   rappel, sur les avis d'appels de charges et les convocations, de la possibilité de recevoir les notifications et les
 *   mises en demeure par voie postale (art. 64-2) ; demande recevable à tout moment, par tout moyen permettant d'établir
 *   avec certitude sa date de réception, effective le lendemain du huitième jour suivant cette réception, ou le jour de
 *   l'assemblée si elle y est formulée, avec mention au procès-verbal (art. 64-4) ; mêmes règles quand un administrateur
 *   provisoire est désigné (art. 64-9) ; notifications valablement faites « à la dernière adresse électronique ou au
 *   dernier domicile communiqué par le copropriétaire à cet effet » (art. 65 al. 2) ;
 * - preuve de dépôt : « le nom et le prénom ou la raison sociale du destinataire » (CPCE art. R. 53-2, 2° pour la lettre
 *   recommandée électronique ; D. 1967 art. 64-5, 2° pour le procédé d'un prestataire qualifié) ; la liste des
 *   copropriétaires indique l'organe qui représente une personne morale (D. 1967 art. 32).
 * L'« accord exprès » n'est plus requis : VitFix trace la DEMANDE DE VOIE POSTALE, pas un consentement, et l'ADRESSE
 * ÉLECTRONIQUE COMMUNIQUÉE à cet effet, pas un simple e-mail de contact.
 *
 * Gestéam — fiche client, critère LRE : modes d'acquisition du consentement (prestataire de LRE, extranet, saisie,
 * résolution d'AG), refus, anomalies « LRE sans prénom » et « PM sans représentant » (tranche 43 § 5) ; extranet :
 * activer / désactiver les AR électroniques, « Valider l'email des AR électroniques » (§ 4). Ces modes relèvent de
 * l'ancien régime de l'accord ; à l'import, ils ne deviennent pas des demandes de voie postale.
 *
 * 🔵 Déduit : « le lendemain du huitième jour suivant la réception » = réception + 9 jours ; plusieurs demandes : la plus
 * ancienne en vigueur fait foi ; une adresse électronique vaut dès sa réception, la dernière reçue l'emporte (à même date,
 * la dernière enregistrée) ; représentant de la personne morale exigé avant un envoi électronique (bloquant) ; à défaut
 * d'adresse électronique communiquée, la lettre recommandée avec avis de réception (l'art. 65 al. 1 fait notifier
 * l'adresse par le copropriétaire) ; texte de la mention de l'art. 64-2 (le décret n'impose pas de formule).
 * 🔴 Non établi : voie à une date antérieure au 25/12/2025 (accord exprès de l'ancien art. 64-2 ; portée immédiate de
 * l'art. 42-1 entre le 11/04/2024 et le 24/12/2025 débattue) : non calculée ; retour à la voie électronique après une
 * demande de voie postale ; le canal LRE n'est pas encore une forme d'envoi des courriers (courriers.ts ne connaît que
 * l'AR comme notification, et le référentiel des formes d'envoi, généré depuis Gestéam, n'a pas de LRE) ; le libellé
 * « Voie électronique (accord exprès) » de l'écran d'AG (AgElectiveModule.tsx) est à revoir avec Frédéric.
 */

export const ORIGINES_DEMANDE_VOIE_POSTALE = ['courrier', 'extranet', 'ag', 'autre'] as const
export type OrigineDemandeVoiePostale = (typeof ORIGINES_DEMANDE_VOIE_POSTALE)[number]

/** D. 1967 art. 64-4 : effet le lendemain du huitième jour suivant la réception (réception + 9 jours, 🔵). */
export const JOURS_AVANT_EFFET_VOIE_POSTALE = 9

/** Entrée en vigueur du décret n° 2025-1292 (voie électronique de principe). */
export const ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE = composerDateIso(2025, 12, 25)

const FONDEMENT_VOIE_POSTALE = 'L. 1965 art. 42-1 ; D. 1967 art. 64-1, 64-4'
const FONDEMENT_VOIE_ELECTRONIQUE = 'L. 1965 art. 42-1 ; D. 1967 art. 64'
const FONDEMENT_REGIME_ANTERIEUR = 'D. 1967 art. 64 à 64-4, rédaction antérieure au décret n° 2025-1292'

export interface DemandeVoiePostale {
  identiteId: string
  /** Réception de la demande par le syndic, ou date de l'assemblée où elle est formulée. */
  recueLe: string
  origine: OrigineDemandeVoiePostale
  /** Assemblée où la demande est formulée (mention au procès-verbal) ; null hors assemblée. */
  agId: string | null
}

export function creerDemandeVoiePostale(saisie: {
  identiteId: string
  recueLe: string
  origine: OrigineDemandeVoiePostale
  agId?: string | null
}): DemandeVoiePostale {
  const identiteId = saisie.identiteId.trim()
  if (!identiteId) throw new Error('Demande de voie postale : identité attendue.')
  if (!estDateIsoValide(saisie.recueLe)) throw new Error(`Date de réception invalide (${saisie.recueLe}) : AAAA-MM-JJ attendu.`)
  if (!(ORIGINES_DEMANDE_VOIE_POSTALE as readonly string[]).includes(saisie.origine))
    throw new Error(`Origine de la demande inconnue : « ${saisie.origine} ».`)
  const agId = saisie.agId?.trim() || null
  if (saisie.origine === 'ag' && !agId) throw new Error("Demande formulée en assemblée : référence de l'assemblée attendue (mention au PV).")
  if (saisie.origine !== 'ag' && agId)
    throw new Error("Référence d'assemblée renseignée : choisir l'origine « ag » (effet le jour de l'assemblée, art. 64-4).")
  return { identiteId, recueLe: saisie.recueLe, origine: saisie.origine, agId }
}

/** Date d'effet : dès l'assemblée si la demande y est formulée, sinon le lendemain du huitième jour suivant sa réception. */
export function effetDemandeVoiePostale(demande: DemandeVoiePostale): string {
  return demande.origine === 'ag' ? demande.recueLe : ajouterJours(demande.recueLe, JOURS_AVANT_EFFET_VOIE_POSTALE)
}

export interface VoieNotification {
  /** null : date antérieure au 25/12/2025, voie non calculée (voir aConfirmer). */
  voie: 'electronique' | 'postale' | null
  /** Effet de la demande de voie postale ; null pour la voie électronique de principe. */
  depuis: string | null
  fondement: string
  aConfirmer: string | null
}

/** Voie de notification d'une identité à la date `date` : électronique, sauf demande de voie postale en vigueur. */
export function voieDeNotification({
  identiteId,
  demandes,
  date,
}: {
  identiteId: string
  demandes: DemandeVoiePostale[]
  date: string
}): VoieNotification {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (date < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)
    return {
      voie: null,
      depuis: null,
      fondement: FONDEMENT_REGIME_ANTERIEUR,
      aConfirmer:
        "Avant le 25/12/2025 : lettre recommandée avec avis de réception, sauf accord exprès à la voie électronique ; portée de l'art. 42-1 depuis le 11/04/2024 à vérifier.",
    }
  const effets = demandes
    .filter((d) => d.identiteId === identiteId)
    .map(effetDemandeVoiePostale)
    .filter((effet) => effet <= date)
    .sort((a, b) => a.localeCompare(b))
  return effets.length > 0
    ? { voie: 'postale', depuis: effets[0], fondement: FONDEMENT_VOIE_POSTALE, aConfirmer: null }
    : { voie: 'electronique', depuis: null, fondement: FONDEMENT_VOIE_ELECTRONIQUE, aConfirmer: null }
}

/** Adresse électronique communiquée par le copropriétaire à cet effet (D. 1967 art. 65), avec sa date de réception. */
export interface CommunicationAdresseElectronique {
  identiteId: string
  adresse: string
  communiqueeLe: string
}

export function creerCommunicationAdresseElectronique(saisie: CommunicationAdresseElectronique): CommunicationAdresseElectronique {
  const identiteId = saisie.identiteId.trim()
  if (!identiteId) throw new Error('Adresse électronique : identité attendue.')
  const adresse = saisie.adresse.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) throw new Error(`Adresse électronique invalide : « ${saisie.adresse} ».`)
  if (!estDateIsoValide(saisie.communiqueeLe))
    throw new Error(`Date de communication invalide (${saisie.communiqueeLe}) : AAAA-MM-JJ attendu.`)
  return { identiteId, adresse, communiqueeLe: saisie.communiqueeLe }
}

/** D. 1967 art. 65 al. 2 — dernière adresse électronique communiquée à cet effet, reçue au plus tard à la date ; null sinon. */
export function adresseElectroniqueDeNotification({
  identiteId,
  communications,
  date,
}: {
  identiteId: string
  communications: CommunicationAdresseElectronique[]
  date: string
}): CommunicationAdresseElectronique | null {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  let derniere: CommunicationAdresseElectronique | null = null
  for (const c of communications)
    if (c.identiteId === identiteId && c.communiqueeLe <= date && (derniere === null || c.communiqueeLe >= derniere.communiqueeLe)) derniere = c
  return derniere
}

export interface AnomalieEnvoiElectronique {
  code: 'lre_sans_prenom' | 'pm_sans_representant' | 'adresse_electronique_absente'
  gravite: 'bloquant'
  message: string
}

/**
 * Contrôles avant un envoi électronique (anomalies de Gestéam) : prénom d'une personne physique, représentant légal d'une
 * personne morale, adresse électronique communiquée à cet effet (voir adresseElectroniqueDeNotification).
 */
export function controlerAvantEnvoiElectronique(
  identite: Pick<Identite, 'nature' | 'nom' | 'prenom'>,
  { representantLegalId, adresseElectronique }: { representantLegalId: string | null; adresseElectronique: string | null },
): AnomalieEnvoiElectronique[] {
  const anomalies: AnomalieEnvoiElectronique[] = []
  if (identite.nature === 'physique' && !identite.prenom?.trim())
    anomalies.push({
      code: 'lre_sans_prenom',
      gravite: 'bloquant',
      message: `${identite.nom} : prénom manquant ; la preuve de dépôt porte le nom et le prénom du destinataire (CPCE art. R. 53-2, 2° ; D. 1967 art. 64-5, 2°).`,
    })
  if (identite.nature === 'morale' && !representantLegalId?.trim())
    anomalies.push({
      code: 'pm_sans_representant',
      gravite: 'bloquant',
      message: `${identite.nom} : désigner l'organe qui représente la personne morale (D. 1967 art. 32) avant un envoi électronique.`,
    })
  if (!adresseElectronique?.trim())
    anomalies.push({
      code: 'adresse_electronique_absente',
      gravite: 'bloquant',
      message: `${identite.nom} : aucune adresse électronique communiquée à cet effet (D. 1967 art. 65) ; la demander, ou notifier par lettre recommandée avec avis de réception.`,
    })
  return anomalies
}

/**
 * D. 1967 art. 64-2 — mention à porter sur les avis d'appels de charges et les convocations : possibilité de recevoir les
 * notifications et les mises en demeure par voie postale, et conditions de la demande (art. 64-4). Destinataire de la
 * demande : l'administrateur provisoire quand il en est désigné un (art. 64-9).
 */
export function mentionFaculteVoiePostale({ administrateurProvisoire = false }: { administrateurProvisoire?: boolean } = {}): {
  texte: string
  fondement: string
} {
  const destinataire = administrateurProvisoire ? "à l'administrateur provisoire" : 'au syndic'
  return {
    texte:
      'Vous pouvez à tout moment demander à recevoir les notifications et les mises en demeure par voie postale (lettre ' +
      `recommandée avec avis de réception). Adressez votre demande ${destinataire} par tout moyen permettant d'établir ` +
      'avec certitude sa date de réception ; elle prend effet le lendemain du huitième jour suivant cette réception, ou le ' +
      "jour de l'assemblée générale si vous la formulez en séance.",
    fondement: administrateurProvisoire ? 'D. 1967 art. 64-2, 64-4, 64-9' : 'D. 1967 art. 64-2, 64-4',
  }
}
