import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Formateurs d'affichage. Intl fr-FR insère U+202F entre les milliers et U+00A0 avant « € » :
 * les textes produits doivent rester ceux d'Intl (ne pas les retaper à la main).
 */

/** Montant en euros sans décimales (totaux, budgets). */
export const formatEuros = (montant: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(montant)

/** Montant en euros avec centimes (soldes des copropriétaires). */
export const formatEurosCentimes = (montant: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)

/** Date (objet ou chaîne) → « JJ/MM/AAAA » ; chaîne vide si absente ou invalide. */
export const formatDateFr = (valeur: Date | string | number | null | undefined): string => {
  if (!valeur) return ''
  const date = valeur instanceof Date ? valeur : new Date(valeur)
  return isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

/** Pourcentage de `valeur` sur `total`, borné entre 0 et 100 (0 si total nul). */
export const pourcentageBorne = (valeur: number, total: number): number =>
  total > 0 ? Math.min(100, Math.max(0, (valeur / total) * 100)) : 0

/** Pourcentage arrondi à l'entier, sans borne (0 si total nul) — sondages, doléances. */
export const pourcentageArrondi = (part: number, total: number): number => (total ? Math.round((part / total) * 100) : 0)

export interface Tantiemes {
  numerateur: number
  denominateur: number
}

/** « numérateur/dénominateur », ou « · » si absent. */
export const formatTantiemes = (tantiemes: Tantiemes | null | undefined): string =>
  tantiemes && tantiemes.denominateur ? `${tantiemes.numerateur}/${tantiemes.denominateur}` : '·'

/** Date locale → « JJ/MM/AAAA », ou « · » si absente. */
export const formatDateOuPoint = (valeur: Date | null | undefined): string => {
  const iso = dateVersIso(valeur ?? null)
  return iso ? dateIsoVersFr(iso) : '·'
}

// Doublons exacts de formatEuros dans la maquette (index de recherche, réponses et courriels de Fixy).
export const formatEurosIndexRecherche = formatEuros
export const formatEurosReponseFixy = formatEuros
export const formatEurosCourrielFixy = formatEuros

/** Secondes → « HH:MM:SS » (valeurs négatives ramenées à 0). */
export const formatDureeHms = (secondes: number): string => {
  const s = Math.max(0, secondes | 0)
  const heures = (s / 3600) | 0
  const minutes = ((s % 3600) / 60) | 0
  const reste = s % 60
  return [heures, minutes, reste].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Minutes → « 2 h 05 » ou « 45 min ». */
export const formatDureeMinutes = (minutesTotales: number): string => {
  const m = minutesTotales | 0
  const heures = (m / 60) | 0
  const minutes = m % 60
  return heures > 0 ? heures + ' h ' + String(minutes).padStart(2, '0') : minutes + ' min'
}
