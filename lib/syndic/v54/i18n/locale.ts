/**
 * Langues du dashboard syndic v54.
 *
 * Valeurs BCP 47 complètes : elles servent telles quelles à Intl et à l'attribut
 * lang, et le garde-fou CI G5 (code-quality.yml) n'accepte que 'pt-PT' côté PT.
 * Le PT reste la langue par défaut : sans fournisseur de langue, tout écran
 * s'affiche exactement comme avant la déclinaison française.
 */
export type V54Locale = 'pt-PT' | 'fr-FR'

export const V54_LOCALE_PAR_DEFAUT: V54Locale = 'pt-PT'

/**
 * Langue du dashboard d'après le préfixe d'URL relayé par le middleware dans
 * l'en-tête x-locale. Seul le préfixe « fr » donne le français, et seulement si
 * la déclinaison française est activée ; tout le reste garde le portugais.
 */
export function v54LocaleDepuisPrefixe(prefixe: string | null | undefined, francaisActif: boolean): V54Locale {
  return francaisActif && prefixe === 'fr' ? 'fr-FR' : V54_LOCALE_PAR_DEFAUT
}
