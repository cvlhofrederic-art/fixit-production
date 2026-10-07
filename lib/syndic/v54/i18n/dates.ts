import type { V54Locale } from './locale'

/**
 * Date renvoyée par l'API syndic v54 → JJ/MM/AAAA, format usuel au Portugal comme en France.
 *
 * Les routes /api/syndic/* renvoient les colonnes DATE de Postgres en « AAAA-MM-JJ » et les
 * horodatages en ISO 8601 (« AAAA-MM-JJTHH:MM:SS… ») : sans formatage, ils s'affichaient bruts.
 * - date seule : le jour civil est repris tel quel, sans conversion de fuseau (sinon
 *   « 2026-06-30 » deviendrait le 29/06 pour un navigateur à l'ouest de Greenwich) ;
 * - horodatage : jour civil dans le fuseau du navigateur, comme toute heure affichée ;
 * - toute autre valeur (vide, texte libre, date déjà formatée, date impossible comme
 *   « 2026-02-30 ») est rendue telle quelle ; null ou undefined donnent ''.
 * Affichage seulement : les valeurs envoyées à l'API et les champs de saisie restent en ISO.
 */
export function dateApi(valeur: string | null | undefined, locale: V54Locale): string {
  if (!valeur) return valeur ?? ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:([T ])\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(valeur)
  if (!iso) return valeur
  const [annee, mois, jour] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  const civil = new Date(Date.UTC(annee, mois - 1, jour))
  if (civil.getUTCFullYear() !== annee || civil.getUTCMonth() !== mois - 1 || civil.getUTCDate() !== jour) return valeur
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
  if (!iso[4]) return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(civil)
  // V8 ne lit pas un décalage sans minutes (« +00 », format texte de Postgres) ni « +0000 » : on le complète.
  const texteIso = (iso[4] === ' ' ? valeur.replace(' ', 'T') : valeur)
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    .replace(/([+-]\d{2})$/, '$1:00')
  const instant = new Date(texteIso)
  return Number.isNaN(instant.getTime()) ? valeur : new Intl.DateTimeFormat(locale, options).format(instant)
}

/**
 * Jour civil courant dans le fuseau du navigateur, au format « AAAA-MM-JJ » : directement
 * comparable (ordre lexicographique) aux colonnes DATE renvoyées par l'API.
 * Pas de toISOString(), qui donne le jour UTC : entre 0 h et 1 h (Lisbonne, heure d'été) ou
 * 2 h (Paris), il renverrait encore la veille.
 */
export function jourCivilLocal(maintenant: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`
}

/**
 * Échéance « AAAA-MM-JJ » (colonne DATE) dépassée : jour strictement antérieur au jour civil
 * courant du navigateur (le jour même n'est pas dépassé). Règle de calendrier, la même en PT et
 * en FR. Toute autre valeur (vide, texte libre, horodatage) → false.
 */
export function echeanceDepassee(valeur: string | null | undefined, maintenant: Date = new Date()): boolean {
  return !!valeur && /^\d{4}-\d{2}-\d{2}$/.test(valeur) && valeur < jourCivilLocal(maintenant)
}
