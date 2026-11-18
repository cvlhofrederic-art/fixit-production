import { ajouterJours, composerDateIso, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
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
 *   rédaction 2020 (avant le 04/07/2020, à l'art. 64-2 : correction R17 du registre, ci-dessous) ; l'ancien art. 64-2
 *   donnait les moyens et le point de départ (lendemain de la transmission de l'avis), pas l'accord ; accordElectroniqueEnVigueur lit le dernier accord reçu au plus tard à la date, sans refus ni retrait
 *   reçu entre les deux (s'il suit un refus ou un retrait : à son effet depuis J74, ci-dessous) ; une demande de voie postale reçue avant le 25/12/2025 exclut aussi l'envoi électronique, effet
 *   retenu à sa réception (relecture du 14/11/2026, sonde P6 ; statut-assemblee.ts).
 *
 * Décisions de Hugo du 17/11/2026 (numéros de registre proposés : J52 et J53, suites de J50 ; notes
 * DECISIONS-HUGO-2026-11-17.md, recommandations suivies) :
 * - J52 : une demande de voie postale, un refus de la voie électronique ou un retrait d'accord reçu AVANT le 25/12/2025
 *   prend effet dès sa réception (effetDemandeVoiePostale), même pour un envoi électronique fait depuis le 25/12/2025 ;
 *   cet envoi ne vaut pas notification, le délai de contestation ne court pas pour ce copropriétaire
 *   (statut-assemblee.ts). Fondement cité : décret n° 2025-1292 sans règle transitoire pour les notifications ; C. civ.
 *   art. 2 (la loi ne dispose que pour l'avenir) ; L. 1965 art. 42-1, al. 2 (« à tout moment et par tout moyen ») ;
 *   lecture prudente, retenue par Hugo. Motif corrigé par J67, R17 et par la correction R17 du registre (vérifiée le
 *   17/11/2026 sur Légifrance) : ce n'est pas l'ancienne règle, mais un choix prudent, plus strict que le texte ; le
 *   retrait de l'accord prenait déjà effet « le lendemain du huitième jour suivant la réception par le syndic » (D. 1967
 *   art. 64-4, version du 04/07/2020 au 24/12/2025 ; avant, art. 64-2 : lendemain du huitième jour du 29/06/2019 au
 *   03/07/2020, lendemain de la réception du 24/10/2015 au 28/06/2019). Pour une demande reçue avant le 25/12/2025, le
 *   code retient donc l'effet à la réception, et non ce lendemain du huitième jour : un envoi électronique fait pendant
 *   ces huit jours ne fait pas courir le délai, au prix d'une nouvelle notification par LRAR ; reçue depuis, l'effet de
 *   l'art. 64-4 actuel (JOURS_AVANT_EFFET_VOIE_POSTALE). Remplace l'avertissement « à confirmer » de la fenêtre du 16 au
 *   24/12/2025 ;
 * - J53 : l'accord du critère LRE repris de Gestéam (ConsentementVoieElectronique, sens « accord ») vaut consentement du
 *   destinataire non professionnel aux envois recommandés électroniques (CPCE art. L. 100) ; sans lui, une LRE ne vaut pas
 *   notification (statut-assemblee.ts, cause consentement_lre_absent) ; le procédé du prestataire qualifié (D. 1967
 *   art. 64, 2°) n'est pas concerné ; la LRAR reste possible.
 *
 * J78 (réponse de Frédéric du 17/11/2026) : la qualité professionnelle du destinataire vient de la case « professionnel »
 * de la fiche identité, décochée par défaut (identites-positions.ts, qualiteProfessionnelleDe, avecQualiteProfessionnelle) ;
 * décochée ou absente : non professionnelle, le consentement reste l'accord du critère LRE (J53). Table des identités et
 * écran : à brancher.
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
 * exprès d'avant le 25/12/2025), ce que J59 ne dit pas : lecture prudente, à confirmer par Hugo. Effet de l'accord :
 * le lendemain du huitième jour suivant sa réception depuis J74 (ci-dessous), et non plus dès sa réception.
 *
 * Décision de Hugo du 18/11/2026 (registre des décisions juridiques, J74 ; question Q7, J67, R18 ; texte lu : D. 1967
 * art. 64-4, 65) : retour à la voie électronique. La renonciation à la voie postale (RenonciationVoiePostale,
 * creerRenonciationVoiePostale : écrite, datée, reçue par un moyen qui prouve sa date de réception, avec une adresse
 * électronique donnée à cet effet, D. 1967 art. 65 ; communicationDeLaRenonciation) et l'accord donné après un refus (J59,
 * qui prenait effet dès sa réception : demandesDepuisConsentements) prennent effet le lendemain du huitième jour suivant
 * leur réception, comme la demande de voie postale (D. 1967 art. 64-4 ; paramètre JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE ;
 * effetRetourVoieElectronique rend la date d'effet et sa justification). Choix prudent : une notification électronique
 * envoyée avant cette date ne vaut pas notification et ne fait courir aucun délai ; elle se refait par LRAR
 * (voieDeNotification : voie postale jusqu'à l'effet, retour en attente dans `retour` ; motif du refus :
 * motifNotificationAvantRetour, repris par envois-electroniques.ts). 🔵 Une renonciation lève les demandes reçues au
 * plus tard le jour de sa réception (même jour : elle suit la demande à laquelle elle renonce, comme l'accord enregistré
 * après un refus le même jour ; relecture du 18/11/2026), pas celles reçues après ; une renonciation incomplète
 * (identité, dates, justificatif ou adresse non valables) est écartée et la voie postale demeure, comme l'accord sans
 * date de J59 ; un accord ne lève pas une demande de voie postale enregistrée comme telle (seule la renonciation la
 * lève, R18). accordElectroniqueEnVigueur (consentement de J53, accord exprès d'avant le 25/12/2025) suit la même règle
 * (relecture du 18/11/2026) : l'accord donné après un refus ou un retrait n'y vaut qu'à son effet, en attente d'ici là
 * (accordElectroniqueEnAttente) ; un premier accord, sans refus ni retrait avant lui, vaut dès sa réception. 🔵 L'accord
 * donné après un refus ou un retrait reçu avant le 25/12/2025 suit aussi J74, qui ne limite pas les dates : une
 * notification électronique envoyée pendant ces huit jours, même avant le 25/12/2025, ne fait courir aucun délai
 * (statut-assemblee.ts, cause accord_electronique_absent) ; sinon le même accord vaudrait notification pour un envoi du
 * 22/12/2025 et non pour un envoi du 27/12/2025. Choix prudent, à confirmer par Hugo. Enregistrement des renonciations :
 * à brancher (table et écran : Frédéric) ; à faire après #741 : statut-assemblee.ts, passer les renonciations à
 * voieDeNotification et citer le retour en attente dans le motif du refus (motifNotificationAvantRetour ; avant le
 * 25/12/2025, l'accord en attente : accordElectroniqueEnAttente) ; jusque-là, le calcul du délai ne lit pas les
 * renonciations, et la voie postale y demeure (lecture prudente). avis-appel.ts lit les renonciations (J69).
 *
 * 🔵 Déduit : « le lendemain du huitième jour suivant la réception » = réception + 9 jours ; plusieurs demandes : la plus
 * ancienne en vigueur fait foi ; une adresse électronique vaut dès sa réception, la dernière reçue l'emporte (à même date,
 * la dernière enregistrée) ; représentant de la personne morale exigé avant un envoi électronique (bloquant) ; à défaut
 * d'adresse électronique communiquée, la lettre recommandée avec avis de réception (l'art. 65 al. 1 fait notifier
 * l'adresse par le copropriétaire) ; texte de la mention de l'art. 64-2 (le décret n'impose pas de formule) ; un refus
 * ou un retrait reçu à partir du 25/12/2025 est aussi une demande de voie postale (la demande se fait « par tout moyen »),
 * tant qu'un accord reçu ensuite ne le remplace pas, à son effet (J74) (un refus d'avant le 25/12/2025 suivi d'un accord
 * daté reçu depuis : décision de Hugo du 17/11/2026 (J59), ci-dessus).
 *
 * J67, R17 : lecture prudente gardée (décision de Hugo du 17/11/2026 ; D. 1967 art. 64-3 et 64-4, rédaction du
 * 04/07/2020 au 24/12/2025, et L. 1965 art. 42-1 relus sur Légifrance le 17/11/2026) : un envoi électronique fait avant
 * le 25/12/2025 exigeait l'accord exprès du copropriétaire, y compris du 11/04/2024 au 24/12/2025 (le décret renvoyait à
 * un accord que la loi ne mentionnait plus ; deux lectures, aucun arrêt) ; elle ne fait jamais courir un délai à tort.
 * voieDeNotification ne calcule rien avant cette date ; le calcul du délai (statut-assemblee.ts) en décide.
 *
 * 🔴 Non établi :
 * le libellé « Voie électronique (accord exprès) » de l'écran d'AG (AgElectiveModule.tsx) est à
 * revoir avec Frédéric. Le mode de notification des courriers (LRAR, LRE, prestataire
 * qualifié) est un champ propre à VitFix (courriers.ts, J50) : le référentiel des formes d'envoi, généré depuis Gestéam,
 * n'a pas de LRE et ne change pas.
 */

export const ORIGINES_DEMANDE_VOIE_POSTALE = ['courrier', 'extranet', 'ag', 'autre'] as const
export type OrigineDemandeVoiePostale = (typeof ORIGINES_DEMANDE_VOIE_POSTALE)[number]

/**
 * D. 1967 art. 64-4 : effet le lendemain du huitième jour suivant la réception (réception + 9 jours, 🔵), pour une demande
 * reçue depuis le 25/12/2025 ; reçue avant, effet retenu dès la réception (J52 : choix prudent, plus strict que le texte,
 * qui donnait déjà ce délai au retrait de l'accord ; correction R17 du registre).
 */
export const JOURS_AVANT_EFFET_VOIE_POSTALE = 9

/**
 * J74 : la renonciation à la voie postale et l'accord donné après un refus prennent effet le lendemain du huitième jour
 * suivant leur réception, même règle que la demande de voie postale (D. 1967 art. 64-4, par analogie ; J67, R18).
 */
export const JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE = JOURS_AVANT_EFFET_VOIE_POSTALE

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
/**
 * Demande reçue avant le 25/12/2025 (J52) : motif corrigé selon la correction R17 du registre (vérifiée sur Légifrance le
 * 17/11/2026) : un choix prudent, plus strict que le texte, et non l'ancienne règle.
 */
const FONDEMENT_VOIE_POSTALE_AVANT_DECRET_2025 =
  "L. 1965 art. 42-1, al. 2 ; D. 1967 art. 64-1 ; demande reçue avant le 25/12/2025 : effet retenu à sa réception, choix prudent, plus strict que le texte : le retrait de l'accord prenait déjà effet le lendemain du huitième jour suivant sa réception (D. 1967 art. 64-4, version du 04/07/2020 au 24/12/2025 ; avant, art. 64-2 : lendemain du huitième jour du 29/06/2019 au 03/07/2020, lendemain de la réception du 24/10/2015 au 28/06/2019) ; décret n° 2025-1292 sans règle transitoire, C. civ. art. 2 ; J52 ; J67, R17"
const FONDEMENT_VOIE_ELECTRONIQUE = 'L. 1965 art. 42-1 ; D. 1967 art. 64'
const FONDEMENT_RETOUR_VOIE_ELECTRONIQUE = 'L. 1965 art. 42-1 ; D. 1967 art. 64, 64-4 ; renonciation à la voie postale (J74)'
const FONDEMENT_REGIME_ANTERIEUR = 'D. 1967 art. 64 à 64-4, rédaction antérieure au décret n° 2025-1292'

const fr = dateIsoVersFr

// ── Retour à la voie électronique (J74) ─────────────────────────────────────────────────────────────────────────

/** J74 : retour à la voie électronique par une renonciation à la voie postale (R18) ou un accord donné après un refus (J59). */
export const NATURES_RETOUR_VOIE_ELECTRONIQUE = ['renonciation', 'accord'] as const
export type NatureRetourVoieElectronique = (typeof NATURES_RETOUR_VOIE_ELECTRONIQUE)[number]

/** Retour à la voie électronique reçu, avec sa date d'effet et la justification du calcul (J74). */
export interface RetourVoieElectronique {
  nature: NatureRetourVoieElectronique
  recueLe: string
  /** Lendemain du huitième jour suivant la réception (D. 1967 art. 64-4, par analogie ; J74). */
  effet: string
  justification: string
}

const RETOUR_RECU: Readonly<Record<NatureRetourVoieElectronique, string>> = {
  renonciation: 'Renonciation à la voie postale reçue',
  accord: 'Accord à la voie électronique, donné après un refus, reçu',
}

const FONDEMENT_VOIE_RETABLIE: Readonly<Record<NatureRetourVoieElectronique, string>> = {
  renonciation: FONDEMENT_RETOUR_VOIE_ELECTRONIQUE,
  accord: 'L. 1965 art. 42-1 ; D. 1967 art. 64, 64-4 ; accord donné après un refus (J59, J74)',
}

/** « lendemain du 8e jour suivant sa réception » pour 9 jours (le lendemain du jour n est le jour n + 1). */
const lendemainDuJour = (jours: number): string => (jours === 1 ? 'lendemain de sa réception' : `lendemain du ${jours - 1}e jour suivant sa réception`)

/**
 * J74 : date d'effet d'un retour à la voie électronique, réception + joursAvantEffet (par défaut
 * JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE : le lendemain du huitième jour, D. 1967 art. 64-4, comme la demande de voie
 * postale), avec sa justification. Refus : nature inconnue, date invalide, délai qui n'est pas un entier positif.
 */
export function effetRetourVoieElectronique(
  { nature, recueLe }: Pick<RetourVoieElectronique, 'nature' | 'recueLe'>,
  joursAvantEffet: number = JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE,
): RetourVoieElectronique {
  if (!(NATURES_RETOUR_VOIE_ELECTRONIQUE as readonly string[]).includes(nature)) throw new Error(`Retour à la voie électronique : nature inconnue « ${nature} ».`)
  if (!estDateIsoValide(recueLe)) throw new Error(`Retour à la voie électronique : date de réception invalide (${recueLe}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(joursAvantEffet) || joursAvantEffet <= 0)
    throw new Error(`Délai d'effet invalide (${joursAvantEffet}) : nombre de jours entier strictement positif attendu (D. 1967 art. 64-4).`)
  const effet = ajouterJours(recueLe, joursAvantEffet)
  return {
    nature,
    recueLe,
    effet,
    justification: `${RETOUR_RECU[nature]} le ${fr(recueLe)} : effet le ${fr(effet)}, ${lendemainDuJour(joursAvantEffet)} (D. 1967 art. 64-4, même règle que la demande de voie postale ; J74).`,
  }
}

/** Début du motif d'un refus avant l'effet d'un retour (voieDeNotification, envois-electroniques.ts). */
export const retourPasEncoreEnVigueur = (retour: RetourVoieElectronique): string =>
  `Retour à la voie électronique pas encore en vigueur : ${retour.justification}`

/**
 * J74 : motif du refus d'une notification électronique envoyée avant l'effet du retour à la voie électronique : elle ne
 * vaut pas notification, ne fait courir aucun délai et se refait par LRAR. Refus : date invalide, ou envoi qui n'est pas
 * antérieur à l'effet.
 */
export function motifNotificationAvantRetour(retour: RetourVoieElectronique, dateEnvoi: string): string {
  if (!estDateIsoValide(dateEnvoi)) throw new Error(`Date d'envoi invalide (${dateEnvoi}) : AAAA-MM-JJ attendu.`)
  if (dateEnvoi >= retour.effet)
    throw new Error(`Envoi du ${fr(dateEnvoi)} : il n'est pas antérieur à l'effet du retour à la voie électronique (${fr(retour.effet)}).`)
  return `${retourPasEncoreEnVigueur(retour)} La notification électronique du ${fr(dateEnvoi)}, envoyée avant cette date, ne vaut pas notification et ne fait courir aucun délai : la refaire par lettre recommandée avec avis de réception (D. 1967 art. 64-1 ; J74).`
}

/**
 * J74 (R18) : renonciation du copropriétaire à sa demande de voie postale, écrite et datée (dateeLe), reçue par un moyen
 * qui prouve sa date de réception (recueLe, justificatif), avec une adresse électronique donnée à cet effet (D. 1967
 * art. 65). Distincte d'un accord (ConsentementVoieElectronique). Enregistrement : à brancher.
 */
export interface RenonciationVoiePostale {
  identiteId: string
  /** Date portée sur l'écrit du copropriétaire. */
  dateeLe: string
  /** Réception par le syndic, ou par l'administrateur provisoire quand il en est désigné un (D. 1967 art. 64-9). */
  recueLe: string
  /** Pièce qui établit avec certitude la date de réception (avis de réception, horodatage du prestataire…). */
  justificatif: string
  /** Adresse électronique donnée à cet effet (D. 1967 art. 65). */
  adresseElectronique: string
}

const ADRESSE_ELECTRONIQUE_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const texteNettoye = (valeur: unknown): string => (typeof valeur === 'string' ? valeur.trim() : '')

/** Premier défaut d'une renonciation, null si elle est recevable : refus à la saisie, renonciation écartée à la lecture. */
function defautRenonciation(r: RenonciationVoiePostale): string | null {
  const quoi = 'Renonciation à la voie postale'
  if (!texteNettoye(r.identiteId)) return `${quoi} : identité attendue.`
  if (!estDateIsoValide(r.dateeLe)) return `${quoi} : date de l'écrit invalide (${r.dateeLe}) : AAAA-MM-JJ attendu (renonciation écrite et datée, J74).`
  if (!estDateIsoValide(r.recueLe)) return `${quoi} : date de réception invalide (${r.recueLe}) : AAAA-MM-JJ attendu.`
  if (r.dateeLe > r.recueLe) return `${quoi} : écrit daté du ${fr(r.dateeLe)}, après sa réception le ${fr(r.recueLe)} : dates incohérentes.`
  if (!texteNettoye(r.justificatif))
    return `${quoi} : justificatif attendu, par un moyen permettant d'établir avec certitude sa date de réception (D. 1967 art. 64-4, par analogie ; J74).`
  if (!ADRESSE_ELECTRONIQUE_VALIDE.test(texteNettoye(r.adresseElectronique)))
    return `${quoi} : adresse électronique donnée à cet effet invalide (« ${String(r.adresseElectronique)} ») ; elle est exigée (D. 1967 art. 65 ; J74).`
  return null
}

/** Renonciation contrôlée et nettoyée (J74, R18) ; refus avec le premier défaut trouvé. */
export function creerRenonciationVoiePostale(saisie: RenonciationVoiePostale): RenonciationVoiePostale {
  const renonciation: RenonciationVoiePostale = {
    identiteId: texteNettoye(saisie.identiteId),
    dateeLe: saisie.dateeLe,
    recueLe: saisie.recueLe,
    justificatif: texteNettoye(saisie.justificatif),
    adresseElectronique: texteNettoye(saisie.adresseElectronique),
  }
  const defaut = defautRenonciation(renonciation)
  if (defaut) throw new Error(defaut)
  return renonciation
}

export interface DemandeVoiePostale {
  identiteId: string
  /** Réception de la demande par le syndic, ou date de l'assemblée où elle est formulée. */
  recueLe: string
  origine: OrigineDemandeVoiePostale
  /** Assemblée où la demande est formulée (mention au procès-verbal) ; null hors assemblée. */
  agId: string | null
  /**
   * J74 : accord reçu après ce refus ou ce retrait, pas encore en vigueur à la date (demandesDepuisConsentements) ;
   * absent sinon.
   */
  retourEnAttente?: RetourVoieElectronique
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

/**
 * Demande reçue avant le 25/12/2025 : effet retenu dès sa réception (J52) ; choix prudent, plus strict que le texte, qui
 * donnait déjà au retrait de l'accord un effet le lendemain du huitième jour (correction R17 du registre ; J67, R17).
 */
export const estDemandeRecueAvantDecret2025 = (demande: Pick<DemandeVoiePostale, 'recueLe'>): boolean =>
  demande.recueLe < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE

/**
 * Date d'effet : dès l'assemblée si la demande y est formulée, sinon le lendemain du huitième jour suivant sa réception
 * (D. 1967 art. 64-4 ; JOURS_AVANT_EFFET_VOIE_POSTALE) ; reçue avant le 25/12/2025, dès sa réception (J52 : choix
 * prudent, plus strict que le texte, qui donnait déjà ce délai au retrait de l'accord ; correction R17 du registre).
 */
export function effetDemandeVoiePostale(demande: DemandeVoiePostale): string {
  if (demande.origine === 'ag' || estDemandeRecueAvantDecret2025(demande)) return demande.recueLe
  return ajouterJours(demande.recueLe, JOURS_AVANT_EFFET_VOIE_POSTALE)
}

export interface VoieNotification {
  /** null : date antérieure au 25/12/2025, voie non calculée (voir aConfirmer). */
  voie: 'electronique' | 'postale' | null
  /** Effet de la demande de voie postale ; null pour la voie électronique. */
  depuis: string | null
  fondement: string
  aConfirmer: string | null
  /**
   * J74 : retour à la voie électronique, avec sa date d'effet et sa justification. Voie électronique : le retour qui l'a
   * rétablie ; voie postale : le retour reçu, pas encore en vigueur (avant son effet, une notification électronique ne
   * vaut pas notification : motifNotificationAvantRetour) ; null : aucun.
   */
  retour: RetourVoieElectronique | null
}

const parEffet = (a: { effet: string }, b: { effet: string }): number => a.effet.localeCompare(b.effet)

/** Renonciations recevables de l'identité, reçues au plus tard à la date, avec leur effet (J74) ; les autres sont écartées. */
function retoursDesRenonciations(identiteId: string, renonciations: readonly RenonciationVoiePostale[], date: string): RetourVoieElectronique[] {
  return renonciations
    .filter((r) => r.identiteId === identiteId && defautRenonciation(r) === null && r.recueLe <= date)
    .map((r) => effetRetourVoieElectronique({ nature: 'renonciation', recueLe: r.recueLe }))
}

/**
 * Retour qui lève la demande au plus tôt (J74) : une renonciation reçue au plus tard le jour de sa réception (🔵 même
 * jour : la renonciation suit la demande à laquelle elle renonce, comme l'accord enregistré après un refus le même jour),
 * ou l'accord en attente que demandesDepuisConsentements y a joint ; null sans retour.
 */
function retourDeLaDemande(demande: DemandeVoiePostale, renonciations: readonly RetourVoieElectronique[]): RetourVoieElectronique | null {
  const candidats = renonciations.filter((r) => r.recueLe >= demande.recueLe)
  if (demande.retourEnAttente) candidats.push(demande.retourEnAttente)
  return candidats.sort(parEffet)[0] ?? null
}

/**
 * Voie de notification d'une identité à la date `date` : électronique, sauf demande de voie postale en vigueur, que
 * lève, à son effet, une renonciation reçue après elle ou l'accord donné après un refus (J74 : lendemain du huitième jour
 * suivant leur réception). Voie postale : `retour` porte le retour en attente quand chaque demande en vigueur en a un
 * (la voie électronique revient au plus tardif).
 */
export function voieDeNotification({
  identiteId,
  demandes,
  date,
  renonciations = [],
}: {
  identiteId: string
  demandes: DemandeVoiePostale[]
  date: string
  /** J74 : renonciations à la voie postale ; absentes : aucune. */
  renonciations?: readonly RenonciationVoiePostale[]
}): VoieNotification {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (date < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)
    return {
      voie: null,
      depuis: null,
      fondement: FONDEMENT_REGIME_ANTERIEUR,
      aConfirmer:
        'Avant le 25/12/2025 : lettre recommandée avec avis de réception, sauf accord exprès à la voie électronique, exigé aussi du 11/04/2024 au 24/12/2025 (lecture prudente, J67, R17) ; voie non calculée ici : le calcul du délai en décide (statut-assemblee.ts).',
      retour: null,
    }
  const recues = retoursDesRenonciations(identiteId, renonciations, date)
  const effectives = demandes
    .filter((d) => d.identiteId === identiteId)
    .map((d) => ({ effet: effetDemandeVoiePostale(d), retour: retourDeLaDemande(d, recues) }))
    .filter(({ effet }) => effet <= date)
  const enVigueur = effectives.filter(({ retour }) => retour === null || retour.effet > date)
  if (enVigueur.length === 0) {
    const retablie = effectives.flatMap(({ retour }) => (retour ? [retour] : [])).sort(parEffet).at(-1) ?? null
    return { voie: 'electronique', depuis: null, fondement: retablie ? FONDEMENT_VOIE_RETABLIE[retablie.nature] : FONDEMENT_VOIE_ELECTRONIQUE, aConfirmer: null, retour: retablie }
  }
  // la plus ancienne en vigueur fait foi ; reçue avant le 25/12/2025, elle a pris effet à sa réception (J52)
  const [depuis] = enVigueur.map(({ effet }) => effet).sort((a, b) => a.localeCompare(b))
  const enAttente = enVigueur.flatMap(({ retour }) => (retour ? [retour] : []))
  const retour = enAttente.length === enVigueur.length ? (enAttente.sort(parEffet).at(-1) ?? null) : null
  const fondement = depuis < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE ? FONDEMENT_VOIE_POSTALE_AVANT_DECRET_2025 : FONDEMENT_VOIE_POSTALE
  return { voie: 'postale', depuis, fondement, aConfirmer: null, retour }
}

/** J74 : l'adresse électronique de la renonciation, communiquée à cet effet à sa réception (D. 1967 art. 65). */
export function communicationDeLaRenonciation(renonciation: RenonciationVoiePostale): CommunicationAdresseElectronique {
  return creerCommunicationAdresseElectronique({
    identiteId: renonciation.identiteId,
    adresse: renonciation.adresseElectronique,
    communiqueeLe: renonciation.recueLe,
  })
}

/** J74 : adresses des renonciations recevables, les autres écartées comme par voieDeNotification (avis-appel.ts). */
export function communicationsDesRenonciations(renonciations: readonly RenonciationVoiePostale[]): CommunicationAdresseElectronique[] {
  return renonciations.filter((r) => defautRenonciation(r) === null).map(communicationDeLaRenonciation)
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
 * valide est écarté, la voie postale demeure (décision de Hugo du 17/11/2026, J59). J74 : l'accord ne remplace les refus
 * et retraits reçus avant lui qu'à son effet, le lendemain du huitième jour suivant sa réception
 * (effetRetourVoieElectronique) ; d'ici là, chacun reste une demande qui porte l'accord en attente (retourEnAttente).
 */
export function demandesDepuisConsentements(consentements: readonly ConsentementVoieElectronique[], date: string): DemandeVoiePostale[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const parIdentite = new Map<string, ConsentementVoieElectronique[]>()
  for (const c of consentements)
    if (!estAccordSansDateValable(c) && c.recuLe <= date) parIdentite.set(c.identiteId, [...(parIdentite.get(c.identiteId) ?? []), c])
  return [...parIdentite.values()].flatMap((liste) => demandesDeLIdentite(parReception(liste), date))
}

/** Consentements triés par date de réception, puis dans l'ordre d'enregistrement (à même date, le dernier enregistré l'emporte). */
function parReception(liste: readonly ConsentementVoieElectronique[]): ConsentementVoieElectronique[] {
  return liste
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => a.c.recuLe.localeCompare(b.c.recuLe) || a.rang - b.rang)
    .map(({ c }) => c)
}

const estRetour = (r: RetourVoieElectronique | null): r is RetourVoieElectronique => r !== null

/**
 * Consentements d'une identité, triés : refus et retraits reçus après le dernier accord en vigueur à la date (J74 : à son
 * effet), chacun avec l'accord suivant, en attente, s'il y en a un.
 */
function demandesDeLIdentite(triee: readonly ConsentementVoieElectronique[], date: string): DemandeVoiePostale[] {
  const retours = triee.map((c) => (c.sens === 'accord' ? effetRetourVoieElectronique({ nature: 'accord', recueLe: c.recuLe }) : null))
  const dernierAccord = retours.findLastIndex((r) => r !== null && r.effet <= date)
  return triee.flatMap((c, rang) => {
    if (rang <= dernierAccord || c.sens === 'accord') return []
    const demande: DemandeVoiePostale = { identiteId: c.identiteId, recueLe: c.recuLe, origine: 'autre', agId: null }
    const enAttente = retours.slice(rang + 1).find(estRetour)
    return [enAttente ? { ...demande, retourEnAttente: enAttente } : demande]
  })
}

/** Consentements d'une identité, lus à une date. */
interface ConsentementsALaDate {
  identiteId: string
  consentements: readonly ConsentementVoieElectronique[]
  date: string
}

/**
 * État de l'accord de l'identité à la date. Dernier consentement reçu au plus tard ce jour-là (à même date, le dernier
 * enregistré) : s'il est un accord sans refus ni retrait avant lui, il vaut dès sa réception ; s'il suit un refus ou un
 * retrait, il ne vaut qu'à l'effet du premier accord reçu depuis le dernier d'entre eux (J74 : effetRetourVoieElectronique,
 * lendemain du huitième jour suivant sa réception), en attente d'ici là ; un refus ou un retrait : aucun accord.
 */
function etatDeLAccord({ identiteId, consentements, date }: ConsentementsALaDate): {
  accord: ConsentementVoieElectronique | null
  enAttente: RetourVoieElectronique | null
} {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const triee = parReception(consentements.filter((c) => c.identiteId === identiteId && !estAccordSansDateValable(c) && c.recuLe <= date))
  const dernier = triee.at(-1)
  if (dernier?.sens !== 'accord') return { accord: null, enAttente: null }
  const dernierRefus = triee.findLastIndex((c) => c.sens !== 'accord')
  if (dernierRefus < 0) return { accord: dernier, enAttente: null }
  const retour = effetRetourVoieElectronique({ nature: 'accord', recueLe: triee[dernierRefus + 1].recuLe })
  return retour.effet <= date ? { accord: dernier, enAttente: null } : { accord: null, enAttente: retour }
}

/**
 * Accord à la voie électronique en vigueur à la date : le dernier accord reçu au plus tard ce jour-là, sans refus ni
 * retrait reçu depuis (au plus tard ce jour-là) ; donné après un refus ou un retrait, à son effet seulement (J74, à toute
 * date, 🔵 en-tête ; avant : accordElectroniqueEnAttente) ; null sinon. 🔵 Un accord sans date de réception valide est
 * écarté, par cohérence avec demandesDepuisConsentements (J59) : extension que J59 ne dit pas, à confirmer par Hugo
 * (en-tête).
 */
export function accordElectroniqueEnVigueur(lecture: ConsentementsALaDate): ConsentementVoieElectronique | null {
  return etatDeLAccord(lecture).accord
}

/**
 * J74 : accord donné après un refus ou un retrait, reçu au plus tard à la date mais pas encore en vigueur, avec sa date
 * d'effet et sa justification (pour le motif d'un refus : motifNotificationAvantRetour) ; null sinon.
 */
export function accordElectroniqueEnAttente(lecture: ConsentementsALaDate): RetourVoieElectronique | null {
  return etatDeLAccord(lecture).enAttente
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
  if (!ADRESSE_ELECTRONIQUE_VALIDE.test(adresse)) throw new Error(`Adresse électronique invalide : « ${saisie.adresse} ».`)
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
