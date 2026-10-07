import { useV54Locale } from './context'
import type { V54Locale } from './locale'

/** Textes d'un écran, une version par langue. */
export type Messages<T> = Readonly<Record<V54Locale, T>>

/**
 * Déclare les textes d'un écran. La forme est déduite de la version PT ; la
 * version FR doit avoir exactement les mêmes clés et les mêmes signatures
 * (fonctions d'interpolation comprises), sinon la compilation échoue.
 * Les textes PT sont repris tels quels du code d'origine : la version PT ne
 * doit pas changer d'un caractère.
 */
export function defineMessages<T>(messages: { 'pt-PT': T; 'fr-FR': NoInfer<T> }): Messages<T> {
  return messages
}

/** Textes de l'écran dans la langue courante du dashboard. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useV54Locale()]
}
