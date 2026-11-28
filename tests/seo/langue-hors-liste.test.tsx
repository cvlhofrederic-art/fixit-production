// tests/seo/langue-hors-liste.test.tsx
//
// Langue lue telle quelle par la 404 globale (app/global-not-found.tsx) et le layout des pages communes
// (app/(commun)/layout.tsx). Hors du matcher du middleware (.png, .txt…), cookie et en-tête x-locale arrivent comme le
// visiteur les envoie : « locale=de » donnait <html lang="de"> et, avec l'en-tête et le pied passés par
// lib/i18n/liens-entete-pied.ts sans repli, une TypeError dans LocaleLink, donc un 500. Langue hors liste : fr.

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const etat = vi.hoisted(() => ({ cookie: undefined as string | undefined, enTete: undefined as string | undefined }))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nom: string) => (nom === 'locale' && etat.cookie !== undefined ? { value: etat.cookie } : undefined) }),
  headers: async () => new Headers(etat.enTete === undefined ? {} : { 'x-locale': etat.enTete }),
}))

// Coquille réduite à la langue reçue.
vi.mock('@/components/common/CoquilleRacine', () => ({
  default: ({ locale, children }: { locale: string; children: React.ReactNode }) => <div data-langue={locale}>{children}</div>,
}))

import GlobalNotFound, { generateMetadata as metadonnees404 } from '@/app/global-not-found'
import LayoutCommun, { generateMetadata as metadonneesCommun } from '@/app/(commun)/layout'
import { langueValideOuFr } from '@/lib/i18n/config'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

async function langueRendue(composant: () => Promise<React.ReactElement>) {
  const { container, unmount } = render(await composant())
  const langue = container.querySelector('[data-langue]')?.getAttribute('data-langue')
  unmount()
  return langue
}

beforeEach(() => {
  etat.cookie = undefined
  etat.enTete = undefined
})

describe('langueValideOuFr', () => {
  it.each([
    [[undefined], 'fr'],
    [[null, 'nl'], 'nl'],
    [['de'], 'fr'],
    [['de', 'pt'], 'pt'],
    [['es', 'pt'], 'es'],
    [['constructor'], 'fr'],
    [[''], 'fr'],
  ] as const)('%j → %s', (valeurs, attendu) => {
    expect(langueValideOuFr(...valeurs)).toBe(attendu)
  })
})

describe.each([
  ['404 globale', () => GlobalNotFound()],
  ['layout des pages communes', () => LayoutCommun({ children: <p>page</p> })],
])('%s', (_nom, composant) => {
  it.each([
    // cookie, x-locale, langue attendue de la coquille
    ['de', undefined, 'fr'],
    ['nl', undefined, 'nl'],
    ['pt', 'de', 'pt'],
    [undefined, 'es', 'es'],
    ['constructor', undefined, 'fr'],
  ] as const)('cookie %s, x-locale %s : coquille en %s', async (cookie, enTete, attendu) => {
    etat.cookie = cookie
    etat.enTete = enTete
    expect(await langueRendue(composant)).toBe(attendu)
  })
})

describe('métadonnées', () => {
  it('cookie hors liste : métadonnées FR, pour la 404 globale comme pour les pages communes', async () => {
    etat.cookie = 'de'
    const { robots: _robots404, ...meta404 } = await metadonnees404()
    const { robots: _robotsFr, ...metaFr } = metadonneesRacine('fr')
    expect(meta404).toEqual(metaFr)
    expect(await metadonneesCommun()).toEqual(metadonneesRacine('fr'))
  })
})
