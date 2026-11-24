// tests/helpers/page-connexion.tsx — pièces communes aux tests de la page de connexion.
//
// Trois fichiers l'éprouvent (session déjà présente, société BTP dans l'appli, adresse déjà inscrite) et recopiaient
// les mêmes simulations : SonarCloud analyse tests/** comme du code source (.sonarcloud.properties ne déclare pas
// sonar.tests), et la porte de qualité refuse au-delà de 3 % de duplication sur le code neuf.
//
// Les factories rendent l'objet attendu par `vi.mock`, qui ne peut pas référencer de variable du fichier mais peut
// importer : `vi.mock('@/lib/i18n/context', async () => (await import('../helpers/page-connexion')).i18nFrancais())`.
// La simulation de `@/lib/supabase`, elle, reste dans chaque fichier : elle s'appuie sur son propre `vi.hoisted`.

import React from 'react'

/** Traductions rendues telles quelles (la clé est le texte) et langue française, comme sur /fr/auth/login. */
export function i18nFrancais() {
  return {
    useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: () => {} }),
    useLocale: () => 'fr',
  }
}

/** LocaleLink réduit à une ancre : les tests n'ont pas besoin du préfixe de langue. */
export function localeLinkSimple() {
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  }
}

/**
 * Remplace `window.location` par un objet qui note les destinations au lieu de naviguer. Rend le tableau des
 * navigations, que le test lit, et la fonction qui remet la vraie `location` en place (à appeler en afterEach).
 */
export function installerLocationFactice(): { navigations: string[]; restaurer: () => void } {
  const navigations: string[] = []
  const descripteur = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io',
      pathname: '/fr/auth/login/',
      search: '',
      get href() { return 'https://vitfix.io/fr/auth/login/' },
      set href(destination: string) { navigations.push(destination) },
      assign: (destination: string) => { navigations.push(destination) },
      replace: (destination: string) => { navigations.push(destination) },
    },
  })
  return {
    navigations,
    restaurer: () => { if (descripteur) Object.defineProperty(window, 'location', descripteur) },
  }
}
