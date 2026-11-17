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
 * l'ancien régime de l'accord : VitFix les garde comme ConsentementVoieElectronique (accord, refus, retrait), lus par le
 * calcul du délai de contestation (J50, ci-dessous).
 *
 * Décisions de Hugo du 11/11/2026 (registre des décisions juridiques : J50 ; notes decisions-1111/questions-hugo.md,
 * j50-textes.md, j50-j51-jurisprudence.md ; textes lus sur Légifrance le 11/11/2026) :
 * - un refus de la voie électronique ou un retrait d'accord enregistré avant le 25/12/2025 vaut DEMANDE DE VOIE POSTALE,
 *   à sa date de réception (demandesDepuisConsentements : origine « autre » ; effet dès cette réception depuis la décision
 *   de Hugo du 17/11/2026, J52, ci-dessous, et non plus celui de l'art. 64-4 actuel) : la loi permet de la
 *   faire « à tout moment et par tout moyen » (L. 1965 art. 42-1, al. 2, version de la loi n° 2024-322 du 9 avril 2024,
 *   art. 38) ; qu'un refus ancien vaille demande n'est dit par aucune source (interprétation prudente, 🔵) ; relecture du
 *   14/11/2026 : seulement s'il est le dernier état des consentements de cette identité à la date de l'envoi (un accord
 *   reçu ensuite le remplace : sondes P1, P2, S3) ;
 * - l'accord exprès venait de la loi jusqu'au 10/04/2024 (L. 1965 art. 42-1, version de la loi n° 2014-366, en vigueur du
 *   27/03/2014 au 10/04/2024 : « sous réserve de l'accord exprès des copropriétaires ») ; du 11/04/2024 au 24/12/2025, il
 *   ne venait plus que du décret (art. 64-3 de la rédaction du D. 1967 en vigueur du 04/07/2020 au 24/12/2025, décret
 *   n° 2020-834), alors que l'art. 42-1 disait déjà « valablement faites par voie électronique » : portée débattue (deux
 *   lectures, GRECCO, préconisation n° 19, source secondaire), le code prend la prudente (accord exigé) ; avant le
 *   04/07/2020, rédaction antérieure du décret (art. 64 à 64-4) ; le retrait de l'accord était à l'art. 64-4 de la
 *   rédaction 2020 ; l'ancien art. 64-2 donnait les moyens et le point de départ (lendemain de la transmission de l'avis),
 *   pas l'accord ; accordElectroniqueEnVigueur lit le dernier accord reçu au plus tard à la date, sans refus ni retrait
 *   reçu entre les deux ; une demande de voie postale reçue avant le 25/12/2025 exclut aussi l'envoi électronique, effet
 *   retenu à sa réception (relecture du 14/11/2026, sonde P6 ; statut-assemblee.ts).
 *
 * Décisions de Hugo du 17/11/2026 (numéros de registre proposés : J52 et J53, suites de J50 ; notes
 * DECISIONS-HUGO-2026-11-17.md, recommandations suivies) :
 * - J52 : une demande de voie postale, un refus de la voie électronique ou un retrait d'accord reçu AVANT le 25/12/2025
 *   prend effet dès sa réception (ancienne règle : effetDemandeVoiePostale), même pour un envoi électronique fait depuis
 *   le 25/12/2025 ; cet envoi ne vaut pas notification, le délai de contestation ne court pas pour ce copropriétaire
 *   (statut-assemblee.ts). Fondement cité : décret n° 2025-1292 sans règle transitoire pour les notifications ; C. civ.
 *   art. 2 (la loi ne dispose que pour l'avenir) ; L. 1965 art. 42-1, al. 2 (« à tout moment et par tout moyen ») ;
 *   lecture prudente, retenue par Hugo. Le délai de huit jours de l'art. 64-4 actuel ne vaut que pour une demande reçue
 *   depuis le 25/12/2025. Remplace l'avertissement « à confirmer » de la fenêtre du 16 au 24/12/2025 ;
 * - J53 : l'accord du critère LRE repris de Gestéam (ConsentementVoieElectronique, sens « accord ») vaut consentement du
 *   destinataire non professionnel aux envois recommandés électroniques (CPCE art. L. 100) ; sans lui, une LRE ne vaut pas
 *   notification (statut-assemblee.ts, cause consentement_lre_absent) ; le procédé du prestataire qualifié (D. 1967
 *   art. 64, 2°) n'est pas concerné ; la LRAR reste possible.
 *
 * Suite, décision de Hugo du 17/11/2026 (J59) (DECISIONS-HUGO-2026-11-17.md, section « Suite » : recommandations
 * validées en bloc, numéro de registre proposé) : un refus de la voie électronique reçu avant le 25/12/2025, suivi d'un
 * accord reçu depuis : l'accord daté et écrit l'emporte (dernière volonté exprimée ; voie électronique de principe depuis
 * la loi n° 2024-322) ; sans preuve écrite et datée de l'accord, la voie postale demeure. L. 1965 art. 42-1 ; D. 1967
 * art. 64-4 (« à tout moment et par tout moyen permettant d'établir avec certitude sa date de réception ») ; le retour à
 * la voie électronique n'est pas prévu expressément : interprétation. Le retrait d'accord, assimilé au refus par J50,
 * suit la même lecture. Comportement du code confirmé pour l'accord daté (demandesDepuisConsentements) ; un accord dont
 * la date de réception n'est pas une date valide (AAAA-MM-JJ) ne remplace pas le refus. L'écrit n'est pas un champ du
 * module : enregistrer un accord (sens « accord », recuLe) suppose ce justificatif écrit. 🔵 Par cohérence, un tel accord
 * sans date valable ne vaut pas non plus accord en vigueur (accordElectroniqueEnVigueur : consentement de J53, accord
 * exprès d'avant le 25/12/2025), ce que J59 ne dit pas : lecture prudente, à confirmer par Hugo.
 *
 * 🔵 Déduit : « le lendemain du huitième jour suivant la réception » = réception + 9 jours ; plusieurs demandes : la plus
 * ancienne en vigueur fait foi ; une adresse électronique vaut dès sa réception, la dernière reçue l'emporte (à même date,
 * la dernière enregistrée) ; représentant de la personne morale exigé avant un envoi électronique (bloquant) ; à défaut
 * d'adresse électronique communiquée, la lettre recommandée avec avis de réception (l'art. 65 al. 1 fait notifier
 * l'adresse par le copropriétaire) ; texte de la mention de l'art. 64-2 (le décret n'impose pas de formule) ; un refus
 * ou un retrait reçu à partir du 25/12/2025 est aussi une demande de voie postale (la demande se fait « par tout moyen »),
 * tant qu'un accord reçu ensuite ne le remplace pas (un refus d'avant le 25/12/2025 suivi d'un accord daté reçu depuis :
 * décision de Hugo du 17/11/2026 (J59), ci-dessus).
 * 🔴 Non établi : voie à une date antérieure au 25/12/2025 (accord exprès de l'art. 64-3 de la rédaction de 2020 ;
 * portée immédiate de l'art. 42-1 entre le 11/04/2024 et le 24/12/2025 débattue) : non calculée par voieDeNotification ;
 * retour à la voie électronique après une DemandeVoiePostale (un accord reçu ensuite ne la lève pas ; J59 ne vise que le
 * refus ou le retrait d'accord reçu avant le 25/12/2025) ; la qualité
 * professionnelle du destinataire n'a aucune source dans le module (non saisie : lue comme non professionnelle, J53) ;
 * le libellé « Voie électronique (accord exprès) » de l'écran d'AG (AgElectiveModule.tsx) est à
 * revoir avec Frédéric. Le mode de notification des courriers (LRAR, LRE, prestataire
 * qualifié) est un champ propre à VitFix (courriers.ts, J50) : le référentiel des formes d'envoi, généré depuis Gestéam,
 * n'a pas de LRE et ne change pas.
 */

export const ORIGINES_DEMANDE_VOIE_POSTALE = ['courrier', 'extranet', 'ag', 'autre'] as const
export type OrigineDemandeVoiePostale = (typeof ORIGINES_DEMANDE_VOIE_POSTALE)[number]

/**
 * D. 1967 art. 64-4 : effet le lendemain du huitième jour suivant la réception (réception + 9 jours, 🔵), pour une demande
 * reçue depuis le 25/12/2025 (avant : effet dès la réception, J52).
 */
export const JOURS_AVANT_EFFET_VOIE_POSTALE = 9

/** Entrée en vigueur du décret n° 2025-1292 (voie électronique de principe). */
export const ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE = composerDateIso(2025, 12, 25)

/**
 * Entrée en vigueur de L. 1965 art. 42-1 dans la version de la loi n° 2024-322 du 9 avril 2024 (art. 38) : « valablement
 * faites par voie électronique », demande de voie postale « à tout moment et par tout moyen ». Version précédente (loi
 * n° 2014-366), du 27/03/2014 au 10/04/2024 : « sous réserve de l'accord exprès des copropriétaires ».
 */
export const ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024 = composerDateIso(2024, 4, 11)

/** Entrée en vigueur du décret n° 2020-834 (D. 1967 art. 64 à 64-9, rédaction en vigueur du 04/07/2020 au 24/12/2025). */
export const ENTREE_EN_VIGUEUR_DECRET_2020 = composerDateIso(2020, 7, 4)

const FONDEMENT_VOIE_POSTALE = 'L. 1965 art. 42-1 ; D. 1967 art. 64-1, 64-4'
const FONDEMENT_VOIE_POSTALE_ANCIENNE_REGLE =
  "L. 1965 art. 42-1, al. 2 ; D. 1967 art. 64-1 ; demande reçue avant le 25/12/2025 : effet à sa réception (ancienne règle ; décret n° 2025-1292 sans règle transitoire, C. civ. art. 2 ; décision de Hugo du 17/11/2026, J52)"
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

/** Demande reçue avant le 25/12/2025 : l'ancienne règle s'applique, effet dès sa réception (J52). */
export const estDemandeAncienneRegle = (demande: Pick<DemandeVoiePostale, 'recueLe'>): boolean => demande.recueLe < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE

/**
 * Date d'effet : dès l'assemblée si la demande y est formulée, sinon le lendemain du huitième jour suivant sa réception
 * (D. 1967 art. 64-4) ; reçue avant le 25/12/2025, dès sa réception (ancienne règle, décision de Hugo du 17/11/2026, J52 :
 * le délai de huit jours ne vaut que pour une demande reçue depuis l'entrée en vigueur du décret n° 2025-1292).
 */
export function effetDemandeVoiePostale(demande: DemandeVoiePostale): string {
  if (demande.origine === 'ag' || estDemandeAncienneRegle(demande)) return demande.recueLe
  return ajouterJours(demande.recueLe, JOURS_AVANT_EFFET_VOIE_POSTALE)
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
  if (effets.length === 0) return { voie: 'electronique', depuis: null, fondement: FONDEMENT_VOIE_ELECTRONIQUE, aConfirmer: null }
  // la plus ancienne en vigueur fait foi ; antérieure au 25/12/2025, elle a pris effet à sa réception (J52)
  const fondement = effets[0] < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE ? FONDEMENT_VOIE_POSTALE_ANCIENNE_REGLE : FONDEMENT_VOIE_POSTALE
  return { voie: 'postale', depuis: effets[0], fondement, aConfirmer: null }
}

// ── Consentement à la voie électronique (ancien régime, critère LRE de Gestéam ; J50) ───────────────────────────────

export const SENS_CONSENTEMENT_VOIE_ELECTRONIQUE = ['accord', 'refus', 'retrait'] as const
export type SensConsentementVoieElectronique = (typeof SENS_CONSENTEMENT_VOIE_ELECTRONIQUE)[number]

/**
 * Accord exprès à la voie électronique, refus, ou retrait de l'accord, avec sa date de réception (L. 1965 art. 42-1,
 * version de la loi n° 2014-366, jusqu'au 10/04/2024 ; D. 1967 art. 64-3 et 64-4 de la rédaction en vigueur du 04/07/2020
 * au 24/12/2025).
 */
export interface ConsentementVoieElectronique {
  identiteId: string
  sens: SensConsentementVoieElectronique
  recuLe: string
}

export function creerConsentementVoieElectronique(saisie: ConsentementVoieElectronique): ConsentementVoieElectronique {
  const identiteId = saisie.identiteId.trim()
  if (!identiteId) throw new Error('Consentement à la voie électronique : identité attendue.')
  if (!(SENS_CONSENTEMENT_VOIE_ELECTRONIQUE as readonly string[]).includes(saisie.sens))
    throw new Error(`Sens du consentement inconnu : « ${saisie.sens} » (accord, refus ou retrait attendu).`)
  if (!estDateIsoValide(saisie.recuLe)) throw new Error(`Date de réception invalide (${saisie.recuLe}) : AAAA-MM-JJ attendu.`)
  return { identiteId, sens: saisie.sens, recuLe: saisie.recuLe }
}

/**
 * Accord dont la date de réception n'est pas une date valide (AAAA-MM-JJ), tel qu'une base ou une reprise peut le porter
 * sans passer par creerConsentementVoieElectronique : sans preuve datée, il ne l'emporte pas sur un refus (décision de
 * Hugo du 17/11/2026, J59) ; 🔵 par cohérence, il ne vaut pas non plus accord en vigueur (accordElectroniqueEnVigueur ;
 * extension que J59 ne dit pas, à confirmer par Hugo). Les refus et retraits ne sont pas concernés.
 */
const estAccordSansDateValable = (c: ConsentementVoieElectronique): boolean => c.sens === 'accord' && !estDateIsoValide(c.recuLe)

/**
 * J50 : un refus de la voie électronique ou un retrait d'accord vaut demande de voie postale, à sa date de réception
 * (L. 1965 art. 42-1, al. 2 : « à tout moment et par tout moyen » ; effet : D. 1967 art. 64-4, ou dès sa réception s'il
 * est reçu avant le 25/12/2025, J52 : effetDemandeVoiePostale), tant qu'il est le DERNIER
 * ÉTAT des consentements de cette identité à la date (relecture du 14/11/2026) : un accord reçu ensuite, au plus tard ce
 * jour-là, le remplace. Renvoie, par identité, les refus et retraits reçus depuis son dernier accord (à même date, le
 * dernier enregistré l'emporte, comme dans accordElectroniqueEnVigueur). 🔵 Interprétation prudente, aucune source.
 * Refus reçu avant le 25/12/2025 puis accord reçu depuis : l'accord DATÉ l'emporte ; un accord sans date de réception
 * valide est écarté, la voie postale demeure (décision de Hugo du 17/11/2026, J59).
 */
export function demandesDepuisConsentements(consentements: readonly ConsentementVoieElectronique[], date: string): DemandeVoiePostale[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const parIdentite = new Map<string, ConsentementVoieElectronique[]>()
  for (const c of consentements)
    if (!estAccordSansDateValable(c) && c.recuLe <= date) parIdentite.set(c.identiteId, [...(parIdentite.get(c.identiteId) ?? []), c])
  const demandes: DemandeVoiePostale[] = []
  for (const liste of parIdentite.values()) {
    const triee = liste
      .map((c, rang) => ({ c, rang }))
      .sort((a, b) => a.c.recuLe.localeCompare(b.c.recuLe) || a.rang - b.rang)
      .map(({ c }) => c)
    const dernierAccord = triee.findLastIndex((c) => c.sens === 'accord')
    for (const c of triee.slice(dernierAccord + 1)) demandes.push({ identiteId: c.identiteId, recueLe: c.recuLe, origine: 'autre', agId: null })
  }
  return demandes
}

/**
 * Accord à la voie électronique en vigueur à la date : le dernier accord reçu au plus tard ce jour-là, sans refus ni
 * retrait reçu depuis (au plus tard ce jour-là) ; null sinon. 🔵 Un accord sans date de réception valide est écarté, par
 * cohérence avec demandesDepuisConsentements (J59) : extension que J59 ne dit pas, à confirmer par Hugo (en-tête).
 */
export function accordElectroniqueEnVigueur({
  identiteId,
  consentements,
  date,
}: {
  identiteId: string
  consentements: readonly ConsentementVoieElectronique[]
  date: string
}): ConsentementVoieElectronique | null {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  let dernier: ConsentementVoieElectronique | null = null
  for (const c of consentements)
    if (c.identiteId === identiteId && !estAccordSansDateValable(c) && c.recuLe <= date && (dernier === null || c.recuLe >= dernier.recuLe)) dernier = c
  return dernier?.sens === 'accord' ? dernier : null
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
