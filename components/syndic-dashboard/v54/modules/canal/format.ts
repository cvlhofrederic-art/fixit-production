import type { PillKind } from '../../primitives/pill'
import type { V54Locale } from '@/lib/syndic/v54/i18n'
import type { StatutOrdreCanal } from '@/lib/syndic/v54/api'

/** Jour et heure courts (« 12/10 09:42 ») d'un horodatage ISO ; valeur vide ou invalide → ''. */
export function horodatage(iso: string | null | undefined, locale: V54Locale): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

export const montantEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

/** Couleur de la pastille de statut d'une demande (syndic_signalements.statut). */
export const PILL_STATUT_DEMANDE: Record<string, PillKind | undefined> = {
  en_attente: 'gold',
  acceptee: 'amber',
  en_cours: 'amber',
  terminee: 'sage',
  annulee: undefined,
}

/** Couleur de la pastille de statut d'un ordre de mission. */
export const PILL_STATUT_ORDRE: Record<StatutOrdreCanal, PillKind> = {
  en_attente: 'gold',
  accepte: 'sage',
  en_cours: 'amber',
  termine: 'sage',
  refuse: 'rust',
}

/** Rang d'avancement d'un ordre de mission (refusé : hors parcours). */
export const RANG_ORDRE: Record<StatutOrdreCanal, number> = { en_attente: 0, accepte: 1, en_cours: 2, termine: 3, refuse: -1 }

/** Initiales d'un nom (avatar des participants). */
export const initiales = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
