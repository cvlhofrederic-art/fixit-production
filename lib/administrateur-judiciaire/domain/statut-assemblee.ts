import {
  appliquerDelai,
  delaiMois,
  refLoi1965,
  type CertitudeRegle,
  type Delai,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import {
  ajouterJours,
  dateIsoVersFr,
  estDateIsoValide,
  reporterAuJourOuvrable as reporterJourOuvrable,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { ReferenceJurisprudence, ReferenceTexte } from '@/lib/administrateur-judiciaire/domain/fondements'
import { STATUT_ASSEMBLEE, type StatutAssemblee } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Statut de l'assemblée générale et historique de ses changements (intégration Gestéam, T12). Fonctions pures.
 *
 * Le statut suit le cycle légal relevé dans Gestéam 5.4.22 : Projet → Convoquée → PV signé → Notifiée. C'est la
 * NOTIFICATION du procès-verbal qui fait courir le délai de contestation de l'article 42 alinéa 2.
 *
 * Décision J2 (08/10/2026) : un saut d'étape EN AVANT est permis, mais marqué « hors séquence » avec un motif
 * obligatoire ; un retour arrière est impossible. Le moteur de délais refuse de calculer sur une chaîne incomplète.
 */

/** Ligne d'historique telle que la lisent ces fonctions (sous-ensemble de ChangementStatut). */
export interface LigneHistoriqueStatut {
  entiteType: string
  entiteId: string
  statutNouveau: string
  dateEffet: string
}

/** Ligne d'historique avec ce qu'il faut pour contrôler la chaîne et la preuve de la notification. */
export interface LigneHistoriqueComplete extends LigneHistoriqueStatut {
  statutAncien: string | null
  courrierId: string | null
  horsSequence?: boolean
  motif?: string | null
}

/** Changement prêt à écrire : nouveau statut de l'AG et ligne d'historique (sans champs de suivi). */
export interface ChangementStatutPrepare {
  statut: StatutAssemblee
  changement: {
    entiteType: 'ag'
    entiteId: string
    statutAncien: StatutAssemblee
    statutNouveau: StatutAssemblee
    dateEffet: string
    courrierId: string | null
    horsSequence: boolean
    motif: string | null
  }
}

const rangStatut = (statut: string): number => (STATUT_ASSEMBLEE as readonly string[]).indexOf(statut)

/**
 * Vérifie et prépare un changement de statut d'AG (J2).
 * Lève une erreur si la date d'effet n'est pas une date ISO valide (AAAA-MM-JJ), si le statut est inchangé, en cas
 * de retour arrière, ou en cas de saut d'étape sans motif. Le saut justifié est marqué `horsSequence`.
 */
export function preparerChangementStatutAg(
  ag: { id: string; statut: StatutAssemblee },
  nouveau: StatutAssemblee,
  dateEffet: string,
  courrierId: string | null = null,
  motif: string | null = null,
): ChangementStatutPrepare {
  if (!estDateIsoValide(dateEffet))
    throw new Error(`Date d'effet invalide : « ${dateEffet} » (attendu AAAA-MM-JJ, date de l'acte).`)
  if (ag.statut === nouveau) throw new Error(`L'assemblée est déjà au statut « ${nouveau} ».`)
  const ecart = rangStatut(nouveau) - rangStatut(ag.statut)
  if (ecart < 0)
    throw new Error(`Retour arrière impossible : l'assemblée est au statut « ${ag.statut} », « ${nouveau} » le précède.`)
  const horsSequence = ecart > 1
  const motifNettoye = motif?.trim() || null
  if (horsSequence && !motifNettoye)
    throw new Error(`Passage de « ${ag.statut} » à « ${nouveau} » hors séquence (étape sautée) : un motif est obligatoire.`)
  return {
    statut: nouveau,
    changement: {
      entiteType: 'ag',
      entiteId: ag.id,
      statutAncien: ag.statut,
      statutNouveau: nouveau,
      dateEffet,
      courrierId,
      horsSequence,
      motif: horsSequence ? motifNettoye : null,
    },
  }
}

/** Historique d'une AG, du plus ancien au plus récent par date d'effet (ordre stable à date égale). */
export function historiqueTrie<T extends LigneHistoriqueStatut>(historique: T[], agId: string): T[] {
  return historique
    .filter((ligne) => ligne.entiteType === 'ag' && ligne.entiteId === agId)
    .map((ligne, rang) => ({ ligne, rang }))
    .sort((a, b) => a.ligne.dateEffet.localeCompare(b.ligne.dateEffet) || a.rang - b.rang)
    .map(({ ligne }) => ligne)
}

const derniereNotification = <T extends LigneHistoriqueStatut>(historique: T[], agId: string): T | undefined =>
  historiqueTrie(historique, agId).findLast((ligne) => ligne.statutNouveau === 'Notifiée')

/** Date d'effet (AAAA-MM-JJ) de la dernière notification du PV de l'AG, ou null si elle n'a jamais été notifiée. */
export function dateNotificationAg(historique: LigneHistoriqueStatut[], agId: string): string | null {
  return derniereNotification(historique, agId)?.dateEffet ?? null
}

/**
 * Contrôle la chaîne des statuts d'une AG (J2) : elle part de « Projet », chaque ligne part du statut où la
 * précédente est arrivée, ne recule jamais, et tout saut d'étape est marqué hors séquence avec un motif.
 * Renvoie null si la chaîne est complète, sinon le motif du refus.
 */
export function controlerChaineStatutsAg(historique: LigneHistoriqueComplete[], agId: string): string | null {
  let precedent = 'Projet'
  for (const ligne of historiqueTrie(historique, agId)) {
    const acte = `« ${ligne.statutNouveau} » (${ligne.dateEffet})`
    if (ligne.statutAncien !== precedent)
      return `Chaîne des statuts incomplète : ${acte} part de « ${ligne.statutAncien ?? '—'} » alors que l'assemblée était au statut « ${precedent} ».`
    const ecart = rangStatut(ligne.statutNouveau) - rangStatut(precedent)
    if (ecart <= 0) return `Chaîne des statuts incomplète : retour de « ${precedent} » à ${acte}.`
    if (ecart > 1 && !(ligne.horsSequence && ligne.motif?.trim()))
      return `Chaîne des statuts incomplète : passage de « ${precedent} » à ${acte} sans motif de saut d'étape.`
    precedent = ligne.statutNouveau
  }
  return null
}

export interface RegleDelaiStatut {
  libelle: string
  fondements: ReferenceTexte[]
  jurisprudence: ReferenceJurisprudence[]
  delai: Delai
  /** Report au premier jour ouvrable (CPC art. 642) : paramètre, désactivé par défaut (date la plus courte). */
  reportAuJourOuvrableParDefaut: boolean
  certitude: CertitudeRegle
  note: string
}

/**
 * Délai de contestation des décisions d'assemblée générale par les copropriétaires opposants ou défaillants (J1).
 * Défini ici, à côté du registre REGLES_DELAIS_LEGAUX (règles de mandat, figées par les tests oracle de la maquette),
 * avec les mêmes briques : délai typé, référence de texte, niveau de certitude.
 */
export const DELAI_CONTESTATION_AG_ART42: RegleDelaiStatut = {
  libelle: "Fin du délai de contestation des décisions de l'assemblée générale",
  fondements: [refLoi1965('42, al. 2')],
  jurisprudence: [
    {
      citation: 'Cass. 3e civ., 16 avr. 2026, n° 24-18.842, FS-B',
      portee:
        'Le délai court, dans tous les cas, à compter du lendemain de la première présentation de la lettre recommandée, que le pli soit retiré ou non.',
      verification: 'SOURCE_SECONDAIRE',
    },
    {
      citation: 'Cass. 3e civ., 26 mars 1997, n° 94-21.498',
      portee: 'Report au premier jour ouvrable (CPC art. 642) appliqué au délai de l’art. 42 al. 2.',
      verification: 'SOURCE_SECONDAIRE',
    },
    {
      citation: 'Cass. 3e civ., 4 juin 2003, n° 02-11.134',
      portee: 'Délai préfix, ni suspendu ni interrompu : pas de report au premier jour ouvrable.',
      verification: 'SOURCE_SECONDAIRE',
    },
  ],
  delai: delaiMois(2),
  reportAuJourOuvrableParDefaut: false,
  certitude: 'A_CONFIRMER',
  note:
    "Deux mois à compter de la notification du procès-verbal (L. 1965 art. 42 al. 2). Point de départ : lendemain de la première présentation de la lettre recommandée, que le pli ait été retiré ou non — ni la date d'envoi, ni la date de retrait (décision métier J1 du 08/10/2026 ; Cass. 3e civ., 16 avr. 2026). Échéance au même quantième que ce lendemain, deux mois plus tard, à minuit (CPC art. 641) : présentée le 4 février, échéance le 5 avril. Le report au premier jour ouvrable (CPC art. 642) est débattu (arrêts de 1997 et de 2003) : paramètre désactivé par défaut, date la plus courte ; si les deux calculs divergent, les deux dates sont affichées. Arrêts connus par des commentaires publiés, texte intégral non relu.",
}

/** Courrier tel que le lit le moteur de délais (sous-ensemble de Courrier). */
export interface CourrierNotification {
  id: string
  formeEnvoi: string
  dateDepot: string | null
  datePremierePresentation?: string | null
  dateAccuseReception: string | null
}

export type ResultatDelaiContestation =
  | { etat: 'non_notifiee' }
  | { etat: 'refuse'; motif: string }
  | {
      etat: 'calcule'
      datePremierePresentation: string
      /** Lendemain de la première présentation : jour à partir duquel le délai court. */
      pointDeDepart: string
      /** Même quantième deux mois plus tard, sans report. */
      echeanceSansReport: string
      /** Même échéance reportée au premier jour ouvrable. */
      echeanceAvecReport: string
      /** Échéance retenue selon le paramètre de report. */
      echeanceRetenue: string
      reportApplique: boolean
      /** Les deux calculs divergent : l'écran doit afficher les deux dates. */
      divergence: boolean
      /** Le calcul en toutes lettres, vérifiable par le gestionnaire. */
      justification: string
      avertissements: string[]
    }

/** Courrier AR présenté qui prouve la notification, ou le motif pour lequel elle n'est pas prouvée. */
function courrierPreuve(
  courrierId: string | null,
  courriers: CourrierNotification[],
): { presentation: string } | { motif: string } {
  if (!courrierId) return { motif: 'Aucun courrier rattaché à la notification.' }
  const courrier = courriers.find((candidat) => candidat.id === courrierId)
  if (!courrier) return { motif: `Courrier rattaché introuvable (id=${courrierId}).` }
  if (courrier.formeEnvoi !== 'AR') return { motif: "Le courrier rattaché n'est pas un envoi en AR." }
  if (!courrier.datePremierePresentation) return { motif: "La date de première présentation du pli n'est pas saisie." }
  return { presentation: courrier.datePremierePresentation }
}

/**
 * Fin du délai de contestation de l'art. 42 (J1, J2). Refuse de calculer, avec un motif explicite, sur une chaîne
 * de statuts incomplète ou sans courrier AR dont la première présentation est saisie. Le point de départ est la
 * première présentation du pli, jamais la date d'effet saisie, de dépôt ou de retrait.
 */
export function finDelaiContestationAg(
  historique: LigneHistoriqueComplete[],
  courriers: CourrierNotification[],
  agId: string,
  {
    reporterAuJourOuvrable = DELAI_CONTESTATION_AG_ART42.reportAuJourOuvrableParDefaut,
  }: { reporterAuJourOuvrable?: boolean } = {},
): ResultatDelaiContestation {
  const notification = derniereNotification(historique, agId)
  if (!notification) return { etat: 'non_notifiee' }
  const motifChaine = controlerChaineStatutsAg(historique, agId)
  if (motifChaine) return { etat: 'refuse', motif: `Délai non calculé. ${motifChaine}` }
  const preuve = courrierPreuve(notification.courrierId, courriers)
  if ('motif' in preuve) return { etat: 'refuse', motif: `Délai non calculé. ${preuve.motif}` }
  const { presentation } = preuve
  const pointDeDepart = ajouterJours(presentation, 1)
  const echeanceSansReport = appliquerDelai(pointDeDepart, DELAI_CONTESTATION_AG_ART42.delai)
  const echeanceAvecReport = reporterJourOuvrable(echeanceSansReport)
  const avertissements =
    notification.dateEffet === presentation
      ? []
      : [
          `La date d'effet saisie pour la notification (${notification.dateEffet}) diffère de la première présentation du pli (${presentation}) : le délai suit la première présentation.`,
        ]
  const divergence = echeanceSansReport !== echeanceAvecReport
  const fr = dateIsoVersFr
  const depart = `Deux mois à compter du lendemain de la première présentation du ${fr(presentation)} (départ le ${fr(pointDeDepart)})`
  const fondement = 'L. 1965 art. 42, al. 2.'
  let justification = `${depart} : échéance le ${fr(echeanceSansReport)} à minuit — ${fondement}`
  if (divergence)
    justification = reporterAuJourOuvrable
      ? `${depart} : échéance reportée au premier jour ouvrable, le ${fr(echeanceAvecReport)} à minuit — ${fondement} Report débattu : le ${fr(echeanceSansReport)} sans report.`
      : `${justification} Report au jour ouvrable débattu : le ${fr(echeanceAvecReport)} si on l’applique.`
  return {
    etat: 'calcule',
    datePremierePresentation: presentation,
    pointDeDepart,
    echeanceSansReport,
    echeanceAvecReport,
    echeanceRetenue: reporterAuJourOuvrable ? echeanceAvecReport : echeanceSansReport,
    reportApplique: reporterAuJourOuvrable,
    divergence,
    justification,
    avertissements,
  }
}

/**
 * AG dont le statut courant ne correspond pas à leur historique : statut différent du dernier statut historisé, ou
 * statut autre que « Projet » sans aucun historique. Signale tout changement écrit hors de changerStatutAg.
 */
export function detecterStatutsAgNonHistorises(
  ags: { id: string; statut: StatutAssemblee }[],
  historique: LigneHistoriqueStatut[],
): string[] {
  return ags
    .filter((ag) => {
      const lignes = historiqueTrie(historique, ag.id)
      const attendu = lignes.at(-1)?.statutNouveau ?? 'Projet'
      return ag.statut !== attendu
    })
    .map((ag) => ag.id)
}

// ── Preuve de la notification (T31, règle R9 ; J1) ──────────────────────────────────────────────────────────────

/** Alerte MÉTIER (pas une erreur technique) : la notification de l'AG ne peut pas être prouvée en l'état. */
export interface AlertePreuveNotification {
  code: 'notification_non_prouvee'
  motif: string
}

/**
 * Contrôle la preuve de la dernière notification du PV d'une AG (R9, J1) : elle doit être reliée à un courrier en AR
 * dont la première présentation est saisie (retiré ou non). Renvoie null si l'AG n'a pas été notifiée, ou si la
 * notification est prouvée.
 */
export function controlerPreuveNotificationAg(
  historique: (LigneHistoriqueStatut & { courrierId: string | null })[],
  courriers: CourrierNotification[],
  agId: string,
): AlertePreuveNotification | null {
  const derniere = derniereNotification(historique, agId)
  if (!derniere) return null
  const preuve = courrierPreuve(derniere.courrierId, courriers)
  return 'motif' in preuve ? { code: 'notification_non_prouvee', motif: preuve.motif } : null
}
