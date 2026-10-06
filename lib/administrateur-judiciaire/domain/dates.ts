import { DATE_DU_JOUR_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Dates de la succursale. Deux familles coexistent et ne doivent pas être unifiées :
 * - les données de démonstration et l'interface manipulent des dates « JJ/MM/AAAA » et des objets Date locaux ;
 * - le moteur juridique calcule sur des chaînes ISO « AAAA-MM-JJ » en UTC (pas d'effet de fuseau ni d'heure d'été).
 */

export interface PartiesDateIso {
  a: number
  m: number
  j: number
}

export interface OptionsJoursFeries {
  alsaceMoselle?: boolean
}

/** « JJ/MM/AAAA » → Date locale, sans contrôle de validité (31/02 déborde sur mars). */
export const dateFrVersDate = (valeur: string | null | undefined): Date | null => {
  if (!valeur) return null
  const parties = String(valeur).split('/').map(Number)
  return parties[0] && parties[1] && parties[2] ? new Date(parties[2], parties[1] - 1, parties[0]) : null
}

/**
 * Nombre de jours entre le jour courant de l'application et une date « JJ/MM/AAAA ».
 * Même calcul que la maquette : minuit UTC du jour courant contre minuit local de la cible, arrondi supérieur.
 */
export const joursAvantDateFr = (valeur: string | null | undefined): number | null => {
  const cible = dateFrVersDate(valeur)
  return cible ? Math.ceil((cible.getTime() - new Date(DATE_DU_JOUR_ISO).getTime()) / 864e5) : null
}

export const REGEX_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export const MS_PAR_JOUR = 864e5

export function estDateIsoValide(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string') return false
  const m = REGEX_DATE_ISO.exec(valeur)
  if (!m) return false
  const annee = Number(m[1])
  const mois = Number(m[2])
  const jour = Number(m[3])
  return mois >= 1 && mois <= 12 && jour >= 1 && jour <= joursDansMois(annee, mois)
}

export function decomposerDateIso(valeur: string): PartiesDateIso {
  const m = REGEX_DATE_ISO.exec(valeur)
  if (!m || !estDateIsoValide(valeur)) throw new Error(`Date ISO invalide : « ${valeur} »`)
  return { a: Number(m[1]), m: Number(m[2]), j: Number(m[3]) }
}

export function composerDateIso(annee: number, mois: number, jour: number): string {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/** Tous les calculs de délais se font en UTC. */
export function dateIsoVersUtcMs(valeur: string): number {
  const { a, m, j } = decomposerDateIso(valeur)
  return Date.UTC(a, m - 1, j)
}

export function utcMsVersDateIso(ms: number): string {
  const d = new Date(ms)
  return composerDateIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function estAnneeBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0
}

export function joursDansMois(annee: number, mois: number): number {
  return [31, estAnneeBissextile(annee) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1]
}

export function ajouterJours(dateIso: string, jours: number): string {
  return utcMsVersDateIso(dateIsoVersUtcMs(dateIso) + jours * MS_PAR_JOUR)
}

/** Ajoute des mois en bornant le jour à la fin du mois d'arrivée (31/01 + 1 mois → 28 ou 29/02). */
export function ajouterMois(dateIso: string, mois: number): string {
  const { a, m, j } = decomposerDateIso(dateIso)
  const total = a * 12 + (m - 1) + mois
  const annee = Math.floor(total / 12)
  const moisArrivee = (total % 12) + 1
  return composerDateIso(annee, moisArrivee, Math.min(j, joursDansMois(annee, moisArrivee)))
}

/** Écart en jours (arrondi) de `depuis` à `jusqua`. */
export function ecartJours(depuis: string, jusqua: string): number {
  return Math.round((dateIsoVersUtcMs(jusqua) - dateIsoVersUtcMs(depuis)) / MS_PAR_JOUR)
}

/** 0 = dimanche … 6 = samedi. */
export function jourSemaine(dateIso: string): number {
  return new Date(dateIsoVersUtcMs(dateIso)).getUTCDay()
}

/** Date de Pâques (algorithme de Meeus/Jones/Butcher), en ISO. */
export function datePaques(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return composerDateIso(annee, mois, jour)
}

/** Comparateur du tri par défaut des chaînes : pour des dates AAAA-MM-JJ, c'est l'ordre chronologique. */
function comparerDatesIso(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

/** Jours fériés légaux de l'année (triés), avec en option les deux jours propres à l'Alsace-Moselle. */
export function joursFeries(annee: number, options: OptionsJoursFeries = {}): string[] {
  const paques = datePaques(annee)
  const feries = [
    composerDateIso(annee, 1, 1),
    ajouterJours(paques, 1),
    composerDateIso(annee, 5, 1),
    composerDateIso(annee, 5, 8),
    ajouterJours(paques, 39),
    ajouterJours(paques, 50),
    composerDateIso(annee, 7, 14),
    composerDateIso(annee, 8, 15),
    composerDateIso(annee, 11, 1),
    composerDateIso(annee, 11, 11),
    composerDateIso(annee, 12, 25),
  ]
  if (options.alsaceMoselle) {
    feries.push(ajouterJours(paques, -2))
    feries.push(composerDateIso(annee, 12, 26))
  }
  return feries.sort(comparerDatesIso)
}

export function estJourFerie(dateIso: string, options: OptionsJoursFeries = {}): boolean {
  return joursFeries(decomposerDateIso(dateIso).a, options).includes(dateIso)
}

/** Ni samedi, ni dimanche, ni jour férié (base du report de l'art. 642 CPC). */
export function estJourOuvrable(dateIso: string, options: OptionsJoursFeries = {}): boolean {
  const jour = jourSemaine(dateIso)
  return jour !== 0 && jour !== 6 && !estJourFerie(dateIso, options)
}

export function reporterAuJourOuvrable(dateIso: string, options: OptionsJoursFeries = {}): string {
  let date = dateIso
  while (!estJourOuvrable(date, options)) date = ajouterJours(date, 1)
  return date
}

/** « JJ/MM/AAAA » → ISO, avec validation stricte (31/02 → null). */
export function dateFrVersIso(valeur: string | null | undefined): string | null {
  if (!valeur) return null
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(valeur)
  if (!m) return null
  const iso = composerDateIso(Number(m[3]), Number(m[2]), Number(m[1]))
  return estDateIsoValide(iso) ? iso : null
}

/** ISO → « JJ/MM/AAAA ». Lève une erreur si la date est invalide. */
export function dateIsoVersFr(dateIso: string): string {
  const { a, m, j } = decomposerDateIso(dateIso)
  return `${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

/** Date locale → ISO ; toute valeur qui n'est pas une Date valide donne null. */
export function dateVersIso(valeur: unknown): string | null {
  return !(valeur instanceof Date) || Number.isNaN(valeur.getTime())
    ? null
    : composerDateIso(valeur.getFullYear(), valeur.getMonth() + 1, valeur.getDate())
}
