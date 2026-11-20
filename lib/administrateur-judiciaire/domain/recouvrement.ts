import { controlerVoieNotification, dateEnvoiNotification, type ContexteVoieNotification } from '@/lib/administrateur-judiciaire/domain/controle-voie-notification'
import {
  departDelaiNotification,
  type CourrierSuivi,
  type DepartDelaiNotification,
  type ModeNotification,
} from '@/lib/administrateur-judiciaire/domain/courriers'
import {
  ajouterJours,
  ajouterMois,
  dateIsoVersFr,
  ecartJours,
  estDateIsoValide,
  reporterAuJourOuvrable,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { appliquerDelai, type Delai } from '@/lib/administrateur-judiciaire/domain/delais-legaux'

/**
 * Recouvrement des charges impayées (L. 1965 art. 19-2, 19-1, 20 et 42). Le statut d'un dossier est stocké sous la forme
 * « étape:AAAA-MM-JJ » (ex. « mise_en_demeure:2026-05-12 »).
 *
 * Exigibilité anticipée de l'art. 19-2 (« après mise en demeure restée infructueuse passé un délai de trente jours » ;
 * L. 1965 art. 19-2, en vigueur depuis le 01/01/2023, relu sur Légifrance le 17/11/2026) — décisions J3, J50 et J67 (R41) :
 * - les trente jours partent du lendemain de la première présentation du courrier de mise en demeure, pli retiré ou non
 *   (D. 1967 art. 64-1, al. 2 ; J3 : « même règle que J1, et la même fonction de domaine »), ou du lendemain de la
 *   transmission de l'avis électronique pour la voie électronique (art. 64, dernier al. ; J50, J57) ; textes en vigueur
 *   depuis le 25/12/2025, relus sur Légifrance le 17/11/2026. Ce départ est calculé par courriers.departDelaiNotification,
 *   la fonction du délai de contestation de l'AG (statut-assemblee.ts) ;
 * - la date de l'étape « mise en demeure » est celle où le collaborateur fait avancer le dossier (avancerRecouvrement) :
 *   elle ne fait courir aucun délai. Sans courrier, sans date de présentation ou d'avis, ou avec une date mal formée,
 *   aucune date d'exigibilité : une alerte dit la date à saisir ou à corriger (exigibiliteAnticipee) ;
 * - report au premier jour ouvrable (J67, R41, validée par Hugo le 17/11/2026 ; CPC art. 640 à 642, version du
 *   01/01/1976, lus le 17/11/2026) : deux fins, le trentième jour sans report et le même jour reporté au premier jour
 *   ouvrable (dates.reporterAuJourOuvrable, sans les jours propres à l'Alsace-Moselle, comme statut-assemblee.ts) ;
 *   l'exigibilité est retenue le lendemain de la fin AVEC report, la date la plus tardive, prudente pour le syndicat qui
 *   attend ; les deux dates sont écrites quand elles diffèrent ; les étapes (délais de gestion, etapes-dossier.ts)
 *   restent sans report ;
 * - voie de notification du débiteur : L. 1965 art. 42-1 vise « les notifications et les mises en demeure » ; le contrôle
 *   est celui du délai de l'art. 42 (controle-voie-notification.ts), quand l'appelant donne la voie du débiteur
 *   (VoieDebiteur) : LRE à un débiteur non professionnel sans consentement enregistré (J53), ou envoi électronique malgré
 *   une demande de voie postale (J52) : aucune date, l'alerte dit pourquoi ; LRAR sans demande de voie postale reçue :
 *   date calculée avec un avertissement (J50) ; voie non donnée : date calculée avec la réserve « voie non contrôlée ».
 * 🔵 Déduit : le lendemain de l'événement est le jour 0 du délai, comme pour J1 ; l'exigibilité est retenue le
 * lendemain du trentième jour (« passé un délai de trente jours »). J52 et J53, prises pour la notification du PV,
 * appliquées à la mise en demeure : lecture de Claude, à confirmer par Hugo (controle-voie-notification.ts).
 * 🔴 Non établi :
 * - borne à confirmer par Hugo : exigibilité le lendemain du trentième jour compté depuis ce jour 0 (présentée le 12/05,
 *   exigible le 13/06), ou un jour plus tôt si le lendemain de la présentation compte comme premier jour ;
 * - un paiement ou une démarche du débiteur pendant les trente jours (J3, condition 4) n'est pas contrôlé ici ;
 * - Frédéric : rattacher au dossier d'impayé le courrier de mise en demeure et la voie du débiteur (l'impayé ne les porte
 *   pas), puis afficher la date ou l'alerte ; tant que les écrans et Fixy ne passent pas le courrier, aucune date
 *   d'exigibilité n'est affichée.
 */

export type EtapeRecouvrement = 'amiable' | 'mise_en_demeure' | 'exigibilite' | 'procedure' | 'solde'

export interface DefinitionEtapeRecouvrement {
  etape: EtapeRecouvrement
  libelle: string
  base: string
  conseil: string
}

export const ETAPES_RECOUVREMENT: DefinitionEtapeRecouvrement[] = [
  {
    etape: 'amiable',
    libelle: 'Relance amiable',
    base: 'gestion',
    conseil: 'Relance simple, puis mise en demeure si elle reste sans effet.',
  },
  {
    etape: 'mise_en_demeure',
    libelle: 'Mise en demeure',
    base: 'L. 1965 art. 19-2',
    conseil: 'Lettre recommandée, nature et montant de chaque provision impayée par exercice. Trente jours courent.',
  },
  {
    etape: 'exigibilite',
    libelle: 'Exigibilité anticipée',
    base: 'L. 1965 art. 19-2',
    conseil: 'Passé trente jours, les provisions non échues et les sommes dues des exercices précédents sont exigibles.',
  },
  {
    etape: 'procedure',
    libelle: 'Action en justice',
    base: 'L. 1965 art. 19-2, 19-1, 20',
    conseil:
      'Procédure accélérée au fond devant le président du tribunal judiciaire ; hypothèque légale ; opposition sur le prix en cas de vente.',
  },
  {
    etape: 'solde',
    libelle: 'Soldé',
    base: 'gestion',
    conseil: 'Dossier clos.',
  },
]

export interface StatutRecouvrement {
  etape: EtapeRecouvrement
  /** Date ISO de passage à l'étape, si elle est lisible. */
  depuis: string | null
}

const estEtapeRecouvrement = (valeur: string): valeur is EtapeRecouvrement =>
  ETAPES_RECOUVREMENT.some((definition) => definition.etape === valeur)

/** Lit « étape:date » ; étape inconnue ou statut vide → « amiable », date invalide → null. */
export function lireStatutRecouvrement(statut: string | null | undefined): StatutRecouvrement {
  const [etape, depuis] = (statut || 'amiable').split(':')
  return {
    etape: estEtapeRecouvrement(etape) ? etape : 'amiable',
    depuis: depuis && estDateIsoValide(depuis) ? depuis : null,
  }
}

export const ecrireStatutRecouvrement = (etape: string, dateIso: string): string => `${etape}:${dateIso}`

/** L. 1965 art. 19-2 : « après mise en demeure restée infructueuse passé un délai de trente jours ». */
export const DELAI_MISE_EN_DEMEURE_ART19_2: Delai = { valeur: 30, unite: 'jours' }

/** Courrier de la mise en demeure (courriers.ts) : seuls comptent sa forme, son mode, son dépôt et la date qui notifie. */
export type CourrierMiseEnDemeure = Pick<CourrierSuivi, 'formeEnvoi' | 'dateDepot'> &
  Partial<Pick<CourrierSuivi, 'datePremierePresentation' | 'dateAvisElectronique' | 'modeNotification' | 'dateAccuseReception'>>

/**
 * Débiteur destinataire de la mise en demeure, pour contrôler la voie de notification comme pour le délai de l'art. 42
 * (controle-voie-notification.ts ; J50, J52, J53) : identité, qualité professionnelle, demandes de voie postale et
 * consentements à la voie électronique.
 */
export interface VoieDebiteur extends ContexteVoieNotification {
  /** Identité du débiteur ; null : non renseignée (le consentement ne peut pas lui être rapproché). */
  identiteId: string | null
  /** Qualité professionnelle ; null : non saisie, lue comme non professionnelle (J53). */
  professionnel: boolean | null
}

/** Exigibilité anticipée de l'art. 19-2, calculée depuis le courrier de mise en demeure (J3, J50, J67), ou l'alerte qui dit quoi saisir. */
export type ExigibiliteAnticipee =
  | {
      etat: 'calculee'
      mode: ModeNotification
      /** Première présentation (LRAR) ou transmission de l'avis électronique. */
      dateEvenement: string
      /** Lendemain de l'événement : jour 0 des trente jours (J1, J3). */
      pointDeDepart: string
      /** Trentième jour, sans report. */
      trentiemeJour: string
      /** Trentième jour reporté au premier jour ouvrable (CPC art. 642 ; J67, R41) ; égal au trentième jour s'il est ouvrable. */
      finAvecReport: string
      /** Les deux fins diffèrent : les afficher toutes les deux (J67, R41). */
      divergence: boolean
      /** Lendemain de la fin avec report : exigibilité anticipée retenue (« passé un délai de trente jours » ; J67, R41). */
      exigibleLe: string
      /** Le calcul en toutes lettres, vérifiable par le gestionnaire. */
      justification: string
      /** Réserves sur la voie de notification du débiteur (J50, J52, J53) ; vide quand elle est contrôlée sans réserve. */
      avertissements: string[]
      aConfirmer: string
    }
  | { etat: 'non_calculable'; alerte: string }

type ExigibiliteCalculee = Extract<ExigibiliteAnticipee, { etat: 'calculee' }>

const A_CONFIRMER_EXIGIBILITE =
  "Borne à confirmer par Hugo : exigibilité retenue le lendemain du trentième jour (« passé un délai de trente jours », L. 1965 art. 19-2), le lendemain de la première présentation ou de la transmission de l'avis comptant comme jour 0 (J1, J3)."

const AVERTISSEMENT_VOIE_NON_CONTROLEE =
  'Voie de notification du débiteur non contrôlée : demande de voie postale (J52) et consentement à la lettre recommandée électronique (J53) non vérifiés ; vérifier que la mise en demeure vaut notification avant toute action (L. 1965 art. 42-1 ; D. 1967 art. 64 et 64-1).'

const nonCalculable = (raison: string): ExigibiliteAnticipee => ({ etat: 'non_calculable', alerte: `Exigibilité anticipée non calculable : ${raison}` })

const JAMAIS_L_ETAPE = "les trente jours partent de son lendemain, jamais de la date de l'étape"

/** Événement qui fait partir les trente jours, selon le mode (J3, J50). */
export const evenementMiseEnDemeure = (mode: ModeNotification): string =>
  mode === 'lrar' ? 'première présentation' : "transmission de l'avis électronique"

/** Première date mal formée du courrier (AAAA-MM-JJ attendu), dite dans l'alerte ; null si toutes sont valides ou absentes. */
function dateMalFormee(courrier: CourrierMiseEnDemeure): string | null {
  const dates: [string, string | null | undefined][] = [
    ['de dépôt', courrier.dateDepot],
    ['de première présentation', courrier.datePremierePresentation],
    ["de transmission de l'avis électronique", courrier.dateAvisElectronique],
  ]
  const fautive = dates.find(([, valeur]) => valeur && !estDateIsoValide(valeur))
  return fautive
    ? `date ${fautive[0]} de la mise en demeure invalide (« ${fautive[1]} », AAAA-MM-JJ attendu) ; à corriger d'après le justificatif.`
    : null
}

/** Raison pour laquelle le courrier ne fait pas partir les trente jours (courriers.departDelaiNotification). */
function raisonDepartNonCalculable(depart: Extract<DepartDelaiNotification, { etat: 'non_calculable' }>): string {
  if (depart.cause === 'sans_valeur_de_notification')
    return "le courrier de mise en demeure n'est ni une lettre recommandée avec avis de réception ni une notification électronique (LRE ou prestataire qualifié) ; il ne fait pas courir les trente jours (D. 1967 art. 64 et 64-1 ; J50)."
  if (depart.cause === 'avis_avant_depot')
    return `la date de transmission de l'avis électronique saisie (${dateIsoVersFr(depart.evenement)}) précède le dépôt de l'envoi (${dateIsoVersFr(depart.depot)}) ; la corriger d'après le justificatif (D. 1967 art. 64, dernier al.).`
  return depart.mode === 'lrar'
    ? `date de première présentation de la mise en demeure à saisir (D. 1967 art. 64-1, al. 2) ; ${JAMAIS_L_ETAPE} (J3).`
    : `date de transmission de l'avis électronique de la mise en demeure à saisir (D. 1967 art. 64, dernier al.) ; ${JAMAIS_L_ETAPE} (J50).`
}

/** Deux fins, sans et avec report, et l'exigibilité le lendemain de la fin avec report (J67, R41). */
function calculerExigibilite(depart: Extract<DepartDelaiNotification, { etat: 'calculable' }>, avertissements: string[]): ExigibiliteCalculee {
  const { mode, evenement, pointDeDepart } = depart
  const trentiemeJour = appliquerDelai(pointDeDepart, DELAI_MISE_EN_DEMEURE_ART19_2)
  const finAvecReport = reporterAuJourOuvrable(trentiemeJour)
  const divergence = finAvecReport !== trentiemeJour
  const exigibleLe = ajouterJours(finAvecReport, 1)
  const fondement = mode === 'lrar' ? 'D. 1967 art. 64-1, al. 2' : 'D. 1967 art. 64, dernier al.'
  const depuis = `Trente jours à compter du lendemain de la ${evenementMiseEnDemeure(mode)} du ${dateIsoVersFr(evenement)} (départ le ${dateIsoVersFr(pointDeDepart)})`
  const justification = divergence
    ? `${depuis} : trentième jour le ${dateIsoVersFr(trentiemeJour)} (fin sans report), reporté au premier jour ouvrable, le ${dateIsoVersFr(finAvecReport)} (fin avec report) ; exigibilité anticipée à partir du ${dateIsoVersFr(exigibleLe)}, lendemain de la fin avec report — L. 1965 art. 19-2 ; ${fondement} ; CPC art. 642 (J67, R41).`
    : `${depuis} : trentième jour le ${dateIsoVersFr(trentiemeJour)}, exigibilité anticipée à partir du ${dateIsoVersFr(exigibleLe)} — L. 1965 art. 19-2 ; ${fondement}.`
  return {
    etat: 'calculee',
    mode,
    dateEvenement: evenement,
    pointDeDepart,
    trentiemeJour,
    finAvecReport,
    divergence,
    exigibleLe,
    justification,
    avertissements,
    aConfirmer: A_CONFIRMER_EXIGIBILITE,
  }
}

/**
 * Exigibilité anticipée de l'art. 19-2 depuis le courrier de mise en demeure : trente jours à compter du lendemain de sa
 * première présentation, ou de la transmission de l'avis électronique (courriers.departDelaiNotification, J3, J50) ;
 * exigibilité le lendemain de la fin reportée au premier jour ouvrable (J67, R41). `voieDebiteur` : voie de notification
 * contrôlée comme pour l'art. 42 (J50, J52, J53) ; absente, la date porte la réserve « voie non contrôlée ». Sans
 * courrier, sans date de présentation ou d'avis, avec une date mal formée, ou pour un courrier qui ne vaut pas
 * notification : aucune date, une alerte dit quoi saisir ou corriger. Ne lève jamais d'erreur.
 */
export function exigibiliteAnticipee(miseEnDemeure: CourrierMiseEnDemeure | null | undefined, voieDebiteur?: VoieDebiteur | null): ExigibiliteAnticipee {
  if (!miseEnDemeure)
    return nonCalculable(
      `date de première présentation de la mise en demeure à saisir (ou, pour un envoi électronique, date de transmission de l'avis électronique), sur le courrier rattaché au dossier ; ${JAMAIS_L_ETAPE} (L. 1965 art. 19-2 ; D. 1967 art. 64-1, al. 2, et art. 64, dernier al. ; J3, J50).`,
    )
  const malFormee = dateMalFormee(miseEnDemeure)
  if (malFormee !== null) return nonCalculable(malFormee)
  const depart = departDelaiNotification(miseEnDemeure)
  if (depart.etat === 'non_calculable') return nonCalculable(raisonDepartNonCalculable(depart))
  const voie = voieDebiteur
    ? controlerVoieNotification(
        depart.mode,
        dateEnvoiNotification(miseEnDemeure.dateDepot, depart.evenement),
        voieDebiteur.identiteId,
        voieDebiteur.professionnel,
        voieDebiteur,
      )
    : { avertissements: [AVERTISSEMENT_VOIE_NON_CONTROLEE] }
  if ('motif' in voie) return nonCalculable(voie.motif)
  return calculerExigibilite(depart, voie.avertissements)
}

export interface AnalyseRecouvrement extends StatutRecouvrement {
  libelle: string
  base: string
  conseil: string
  /**
   * Exigibilité anticipée (art. 19-2) lue sur le courrier de mise en demeure (exigibiliteAnticipee, J3, J50, J67), jamais
   * sur la date de l'étape ; null hors de l'étape « mise en demeure » ou sans date calculable.
   */
  exigibiliteLe: string | null
  joursAvantExigibilite: number | null
  /** Calcul ou alerte de l'exigibilité anticipée ; null hors de l'étape « mise en demeure ». */
  exigibilite: ExigibiliteAnticipee | null
  /** Ouverture du dossier + 60 mois (prescription quinquennale, art. 42). */
  prescriptionLe: string | null
  prochaine: EtapeRecouvrement | null
}

/**
 * Analyse d'un dossier de recouvrement au jour `aujourdhuiIso`. `dateOuverture` = date de création du dossier (ISO).
 * `miseEnDemeure` : courrier de la mise en demeure, d'où partent les trente jours de l'art. 19-2 (J3, J50) ; absent,
 * l'exigibilité n'est pas calculée et l'alerte le dit. `voieDebiteur` : voie de notification du débiteur (J52, J53) ;
 * absente, la date porte la réserve « voie non contrôlée ».
 */
export function analyserRecouvrement(
  statut: string | null | undefined,
  aujourdhuiIso: string,
  dateOuverture?: string | null,
  miseEnDemeure?: CourrierMiseEnDemeure | null,
  voieDebiteur?: VoieDebiteur | null,
): AnalyseRecouvrement {
  const lu = lireStatutRecouvrement(statut),
    // Toujours trouvée : lireStatutRecouvrement ne renvoie que des étapes connues.
    definition = ETAPES_RECOUVREMENT.find((d) => d.etape === lu.etape) as DefinitionEtapeRecouvrement,
    exigibilite = lu.etape === 'mise_en_demeure' ? exigibiliteAnticipee(miseEnDemeure, voieDebiteur) : null,
    exigibiliteLe = exigibilite?.etat === 'calculee' ? exigibilite.exigibleLe : null,
    ordre: EtapeRecouvrement[] = ['amiable', 'mise_en_demeure', 'exigibilite', 'procedure', 'solde'],
    rang = ordre.indexOf(lu.etape)
  return {
    ...lu,
    libelle: definition.libelle,
    base: definition.base,
    conseil: definition.conseil,
    exigibiliteLe,
    joursAvantExigibilite: exigibiliteLe ? ecartJours(aujourdhuiIso, exigibiliteLe) : null,
    exigibilite,
    prescriptionLe: dateOuverture && estDateIsoValide(dateOuverture) ? ajouterMois(dateOuverture, 60) : null,
    prochaine: rang >= 0 && rang < ordre.length - 1 ? ordre[rang + 1] : null,
  }
}

export interface EtapeParcoursRecouvrement {
  etape: string
  base: string
  note: string
}

/** Parcours de recouvrement présenté pour un copropriétaire débiteur (fiche personne, réponses de Fixy). */
export const PARCOURS_RECOUVREMENT_DEBITEUR: EtapeParcoursRecouvrement[] = [
  {
    etape: 'Mise en demeure',
    base: 'L. 1965 art. 19-2',
    note: 'Lettre recommandée, nature et montant de chaque provision impayée par exercice (avis Cass. 12 déc. 2024).',
  },
  {
    etape: 'Exigibilité anticipée',
    base: 'L. 1965 art. 19-2',
    note: 'Passé trente jours sans paiement, les provisions non échues et les sommes dues des exercices précédents deviennent exigibles.',
  },
  {
    etape: 'Procédure accélérée au fond',
    base: 'L. 1965 art. 19-2',
    note: 'Président du tribunal judiciaire ; à défaut, injonction de payer ou assignation au fond.',
  },
  {
    etape: 'Garanties et exécution',
    base: 'L. 1965 art. 19-1 et 20',
    note: "Hypothèque légale du syndicat ; opposition sur le prix en cas de vente (15 jours de l'avis de mutation) ; saisie des loyers.",
  },
  {
    etape: 'Prescription',
    base: 'L. 1965 art. 42',
    note: 'Cinq ans pour les charges : surveiller les créances les plus anciennes.',
  },
]
