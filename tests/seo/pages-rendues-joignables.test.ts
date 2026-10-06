/**
 * Métadonnées des pages que les réécritures de next.config.ts rendent joignables (voir
 * tests/next-config-routage-opennext.test.ts) : pages privées jamais indexées, page avis FR servie sous /fr/avis/.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'

vi.mock('next/font/google', () => ({
  IBM_Plex_Sans: () => ({ variable: 'police-sans' }),
  IBM_Plex_Mono: () => ({ variable: 'police-mono' }),
}))

const traduction = vi.hoisted(() => ({ locale: 'fr' }))
vi.mock('@/lib/i18n/server', () => ({
  getServerTranslation: async () => ({ locale: traduction.locale, t: (cle: string, repli?: string) => repli ?? cle }),
}))

const nonIndexee = (metadata: Metadata) => {
  expect(metadata.robots).toEqual({ index: false, follow: false })
}

describe('pages privées rendues joignables', () => {
  it('« Mes données » (export et suppression du compte) : non indexée, canonical sur elle-même', async () => {
    const { metadata } = await import('@/app/confidentialite/mes-donnees/layout')
    nonIndexee(metadata)
    // Sans ce layout, la page héritait de la canonical de la politique de confidentialité.
    expect(metadata.alternates?.canonical).toBe('https://vitfix.io/fr/confidentialite/mes-donnees/')
  })

  it('parrainage /rejoindre?ref=… : non indexée', async () => {
    const { metadata } = await import('@/app/rejoindre/layout')
    nonIndexee(metadata)
  })

  it('réponse fournisseur à jeton /rfq/repondre/<jeton> : non indexée', async () => {
    const { metadata } = await import('@/app/rfq/repondre/[token]/layout')
    nonIndexee(metadata)
  })
})

describe('page avis servie sous /fr/avis/', () => {
  beforeEach(() => {
    traduction.locale = 'fr'
  })

  it('réexporte la page bilingue de /pt/avaliacoes/', async () => {
    const fr = await import('@/app/fr/avis/page')
    const pt = await import('@/app/pt/avaliacoes/page')
    expect(fr.default).toBe(pt.default)
    expect(fr.generateMetadata).toBe(pt.generateMetadata)
  })

  it('canonical FR sur /fr/avis/ (et non /avis/, redirigée)', async () => {
    const { generateMetadata } = await import('@/app/pt/avaliacoes/page')
    expect((await generateMetadata()).alternates?.canonical).toBe('https://vitfix.io/fr/avis/')
  })

  it('canonical PT inchangée', async () => {
    traduction.locale = 'pt'
    const { generateMetadata } = await import('@/app/pt/avaliacoes/page')
    expect((await generateMetadata()).alternates?.canonical).toBe('https://vitfix.io/pt/avaliacoes/')
  })
})
