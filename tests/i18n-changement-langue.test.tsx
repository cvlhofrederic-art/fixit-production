// tests/i18n-changement-langue.test.tsx
//
// Changement de langue (lib/i18n/context.tsx) : la page équivalente est dans un autre dossier de langue, donc sous un
// autre layout racine. Navigation complète directe vers l'URL avec barre finale (trailingSlash : sinon une redirection
// 308 de plus), sans traduire d'abord la page qu'on quitte. Sans page équivalente, la langue change sur place.
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Locale } from '@/lib/i18n/config'
import { LanguageProvider, useTranslation } from '@/lib/i18n/context'

function Selecteur({ cible }: { cible: Locale }) {
  const { locale, setLocale } = useTranslation()
  return <button onClick={() => setLocale(cible)}>{locale}</button>
}

function changerDeLangue(depuis: string, langueInitiale: Locale, cible: Locale) {
  const replace = vi.fn()
  vi.stubGlobal('location', { ...window.location, pathname: depuis, replace })
  render(
    <LanguageProvider initialLocale={langueInitiale}>
      <Selecteur cible={cible} />
    </LanguageProvider>,
  )
  fireEvent.click(screen.getByRole('button'))
  return { replace, langueAffichee: screen.getByRole('button').textContent }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('setLocale : changement de langue', () => {
  it('page équivalente dans l’autre langue : navigation directe avec barre finale, la page quittée n’est pas traduite', () => {
    const { replace, langueAffichee } = changerDeLangue('/pt/como-funciona/', 'pt', 'fr')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/fr/comment-ca-marche/')
    expect(langueAffichee).toBe('pt')
    expect(localStorage.getItem('vitfix_locale')).toBe('fr')
  })

  it('accueil : /pt/ vers /fr/, barre finale déjà présente', () => {
    expect(changerDeLangue('/pt/', 'pt', 'fr').replace).toHaveBeenCalledWith('/fr/')
  })

  it('sans page équivalente : aucune navigation, la langue change sur place', () => {
    const { replace, langueAffichee } = changerDeLangue('/fr/ville/marseille/', 'fr', 'en')
    expect(replace).not.toHaveBeenCalled()
    expect(langueAffichee).toBe('en')
  })
})
