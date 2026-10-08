import {
  appliquerDelai,
  delaiMois,
  refLoi1965,
  type CertitudeRegle,
  type Delai,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { estDateIsoValide, reporterAuJourOuvrable } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ReferenceTexte } from '@/lib/administrateur-judiciaire/domain/fondements'
import type { StatutAssemblee } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * Statut de l'assemblée générale et historique de ses changements (intégration Gestéam, T12). Fonctions pures.
 *
 * Le statut suit le cycle légal relevé dans Gestéam 5.4.22 : Projet → Convoquée → PV signé → Notifiée. C'est la
 * NOTIFICATION du procès-verbal qui fait courir le délai de contestation de l'article 42 alinéa 2 : le délai part de
 * la date d'effet du changement vers « Notifiée » (date de l'acte), jamais de sa date de saisie.
 */

/** Ligne d'historique telle que la lisent ces fonctions (sous-ensemble de ChangementStatut). */
export interface LigneHistoriqueStatut {
  entiteType: string
  entiteId: string
  statutNouveau: string
  dateEffet: string
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
  }
}

/**
 * Vérifie et prépare un changement de statut d'AG.
 * Lève une erreur si la date d'effet n'est pas une date ISO valide (AAAA-MM-JJ) ou si le statut est inchangé.
 * L'ordre des statuts n'est volontairement pas imposé (retour arrière, saut d'étape) : décision métier non tranchée.
 */
export function preparerChangementStatutAg(
  ag: { id: string; statut: StatutAssemblee },
  nouveau: StatutAssemblee,
  dateEffet: string,
  courrierId: string | null = null,
): ChangementStatutPrepare {
  if (!estDateIsoValide(dateEffet))
    throw new Error(`Date d'effet invalide : « ${dateEffet} » (attendu AAAA-MM-JJ, date de l'acte).`)
  if (ag.statut === nouveau) throw new Error(`L'assemblée est déjà au statut « ${nouveau} ».`)
  return {
    statut: nouveau,
    changement: {
      entiteType: 'ag',
      entiteId: ag.id,
      statutAncien: ag.statut,
      statutNouveau: nouveau,
      dateEffet,
      courrierId,
    },
  }
}

/** Historique d'une AG, du plus ancien au plus récent par date d'effet (ordre stable à date égale). */
export function historiqueTrie<T extends LigneHistoriqueStatut>(historique: T[], agId: string): T[] {
  return historique
    .filter((ligne) => ligne.entiteType === 'ag' && ligne.entiteId === agId)
    .map((ligne, rang) => ({ ligne, rang }))
    .sort((a, b) => (a.ligne.dateEffet < b.ligne.dateEffet ? -1 : a.ligne.dateEffet > b.ligne.dateEffet ? 1 : a.rang - b.rang))
    .map(({ ligne }) => ligne)
}

/** Date d'effet (AAAA-MM-JJ) de la dernière notification du PV de l'AG, ou null si elle n'a jamais été notifiée. */
export function dateNotificationAg(historique: LigneHistoriqueStatut[], agId: string): string | null {
  const notifications = historiqueTrie(historique, agId).filter((ligne) => ligne.statutNouveau === 'Notifiée')
  return notifications.length ? notifications[notifications.length - 1].dateEffet : null
}

export interface RegleDelaiStatut {
  libelle: string
  fondements: ReferenceTexte[]
  delai: Delai
  certitude: CertitudeRegle
  note: string
}

/**
 * Délai de contestation des décisions d'assemblée générale par les copropriétaires opposants ou défaillants.
 * Défini ici, à côté du registre REGLES_DELAIS_LEGAUX (règles de mandat, figées par les tests oracle de la maquette),
 * avec les mêmes briques : délai typé, référence de texte, niveau de certitude.
 */
export const DELAI_CONTESTATION_AG_ART42: RegleDelaiStatut = {
  libelle: "Fin du délai de contestation des décisions de l'assemblée générale",
  fondements: [refLoi1965('42, al. 2')],
  delai: delaiMois(2),
  certitude: 'A_CONFIRMER',
  note:
    "Deux mois à compter de la notification du procès-verbal (L. 1965 art. 42 al. 2). Point de départ : date d'effet de la notification (première présentation de la lettre recommandée ou transmission de l'avis électronique, D. 1967 art. 64). Calcul retenu : même quantième deux mois plus tard (CPC art. 641), reporté au premier jour ouvrable (CPC art. 642) — lecture à faire valider.",
}

/** Fin du délai de contestation de l'art. 42 (AAAA-MM-JJ), ou null si l'AG n'a pas été notifiée. */
export function finDelaiContestationAg(historique: LigneHistoriqueStatut[], agId: string): string | null {
  const notification = dateNotificationAg(historique, agId)
  return notification ? reporterAuJourOuvrable(appliquerDelai(notification, DELAI_CONTESTATION_AG_ART42.delai)) : null
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
      const attendu = lignes.length ? lignes[lignes.length - 1].statutNouveau : 'Projet'
      return ag.statut !== attendu
    })
    .map((ag) => ag.id)
}

// ── Preuve de la notification (T31, règle R9) ───────────────────────────────────────────────────────────────────

/** Alerte MÉTIER (pas une erreur technique) : la notification de l'AG ne peut pas être prouvée en l'état. */
export interface AlertePreuveNotification {
  code: 'notification_non_prouvee'
  motif: string
}

/**
 * Contrôle la preuve de la dernière notification du PV d'une AG (R9) : elle doit être reliée à un courrier en AR dont
 * l'accusé de réception est revenu. Renvoie null si l'AG n'a pas été notifiée, ou si la notification est prouvée.
 * Le délai de contestation, lui, reste calculé sur la date d'effet : l'alerte signale un risque, elle ne l'efface pas.
 */
export function controlerPreuveNotificationAg(
  historique: (LigneHistoriqueStatut & { courrierId: string | null })[],
  courriers: { id: string; formeEnvoi: string; dateDepot: string | null; dateAccuseReception: string | null }[],
  agId: string,
): AlertePreuveNotification | null {
  const notifications = historiqueTrie(historique, agId).filter((ligne) => ligne.statutNouveau === 'Notifiée')
  if (!notifications.length) return null
  const { courrierId } = notifications[notifications.length - 1]
  const alerte = (motif: string): AlertePreuveNotification => ({ code: 'notification_non_prouvee', motif })
  if (!courrierId) return alerte('Aucun courrier rattaché à la notification.')
  const courrier = courriers.find((candidat) => candidat.id === courrierId)
  if (!courrier) return alerte(`Courrier rattaché introuvable (id=${courrierId}).`)
  if (courrier.formeEnvoi !== 'AR') return alerte("Le courrier rattaché n'est pas un envoi en AR.")
  if (!courrier.dateAccuseReception) return alerte("L'accusé de réception n'est pas encore revenu.")
  return null
}
