import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import type { NotificationDemo } from '@/components/administrateur-judiciaire/data/notifications'
import type { NotificationLocale } from '@/lib/administrateur-judiciaire/db/schema'
import type { SaisieAssistantMandat } from '@/lib/administrateur-judiciaire/domain/planification-mandat'
import type { Mode } from '@/lib/administrateur-judiciaire/mode'

/**
 * Choix des données affichées selon le mode, pour les éléments qui ne portent pas de bandeau « démonstration »
 * (cadre commun, écrans « données réelles ») : en démonstration, les données de démonstration, inchangées ; en mode
 * réel, celles de la base — vides si la base est vide, jamais un substitut de démonstration (T01 / T02).
 * Fonctions pures : le mode est toujours passé en paramètre.
 */

export const selonMode = <T>(mode: Mode, demo: T, reel: T): T => (mode === 'demo' ? demo : reel)

/** Options d'une liste de choix : celles de démonstration en démo, celles de la base en mode réel. */
export const optionsSelonMode = (mode: Mode, optionsDemo: string[], optionsBase: string[]): string[] =>
  selonMode(mode, optionsDemo, optionsBase)

// ── Centre de notifications ─────────────────────────────────────────────────────────────────────────────────────

/** Notification telle que l'affiche le centre de notifications du cadre commun. */
export type NotificationCentre = Pick<NotificationDemo, 'id' | 'icon' | 'title' | 'desc' | 'time'> & { kind: string }

/** Notifications de démonstration déjà lues à l'ouverture (comme la maquette). */
export const NOTIFICATIONS_LUES_INITIALES_DEMO = ['n06', 'n07', 'n08', 'n09', 'n10', 'n11', 'n12']

/** Icône par type de notification ; « bell » pour un type sans icône dédiée (notes, types futurs). */
const ICONE_PAR_TYPE_NOTIFICATION: Record<string, string> = {
  legal: 'scale',
  debt: 'alert',
  payment: 'coin',
  mission: 'doc',
  insurance: 'shield',
  ag: 'pencil',
  message: 'chat',
  equipa: 'users',
}

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

/** « JJ/MM/AAAA à HH:MM », heure locale. */
const formaterDateNotification = (date: Date): string =>
  `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()} à ${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`

/**
 * Notifications du centre : en démonstration, la liste de démonstration (même instance) ; en mode réel, celles de la
 * base, les plus récentes d'abord — liste vide si la base n'en contient aucune.
 */
export function notificationsDuCentre(
  mode: Mode,
  demo: NotificationDemo[],
  locales: NotificationLocale[],
): NotificationCentre[] {
  if (mode === 'demo') return demo
  return [...locales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      icon: ICONE_PAR_TYPE_NOTIFICATION[notification.kind] ?? 'bell',
      title: notification.titre,
      desc: notification.description,
      time: formaterDateNotification(new Date(notification.date)),
    }))
}

/** Identifiants lus à l'ouverture : ceux de la maquette en démonstration, l'état « lu » de la base en mode réel. */
export const idsNotificationsLuesInitiales = (mode: Mode, locales: NotificationLocale[]): string[] =>
  mode === 'demo' ? NOTIFICATIONS_LUES_INITIALES_DEMO : locales.filter((notification) => notification.lu).map((n) => n.id)

// ── Assistant de mandat ─────────────────────────────────────────────────────────────────────────────────────────

/** Valeurs par défaut historiques de l'assistant, en démonstration (dossier fictif cohérent avec le jeu de démo). */
export const SAISIE_ASSISTANT_MANDAT_DEMO = (fondementParDefaut: string): SaisieAssistantMandat => ({
  copro: DEMO_NOMS_COPROPRIETES[1] || DEMO_NOMS_COPROPRIETES[0] || '',
  tribunal: 'Tribunal judiciaire de Nanterre',
  rg: 'RG 26/0',
  ordonnance: '04/06/2026',
  duree: '12',
  fondement: fondementParDefaut,
})

/**
 * Valeurs initiales de l'assistant. En mode réel, rien n'est inventé : copropriété = la première de la base (vide
 * si aucune), tribunal, RG, date d'ordonnance et durée à saisir — ce sont les données de l'ordonnance réelle.
 */
export const saisieAssistantMandatParDefaut = (
  mode: Mode,
  nomsCoproprietes: string[],
  fondementParDefaut: string,
): SaisieAssistantMandat =>
  mode === 'demo'
    ? SAISIE_ASSISTANT_MANDAT_DEMO(fondementParDefaut)
    : {
        copro: nomsCoproprietes[0] ?? '',
        tribunal: '',
        rg: '',
        ordonnance: '',
        duree: '',
        fondement: fondementParDefaut,
      }

// ── Erreur de lecture de la base (T02) ──────────────────────────────────────────────────────────────────────────

export interface AlerteLectureBase {
  titre: string
  message: string
}

/**
 * Alerte à afficher quand la lecture de la base a échoué. Mode réel uniquement : sans elle, un échec produit des
 * listes vides qui ont l'air justes. En démonstration, le repli existant sur le jeu de démonstration est conservé.
 */
export const alerteLectureBase = (mode: Mode, erreur: string | null): AlerteLectureBase | null =>
  mode === 'reel' && erreur
    ? {
        titre: 'Lecture de la base impossible',
        message: `Vos données n'ont pas pu être lues (${erreur}). Les listes affichées peuvent être incomplètes : ne vous y fiez pas avant d'avoir rechargé la page.`,
      }
    : null
