/**
 * hreflang : une seule source, l'API metadata.
 *
 * app/layout.tsx écrivait en dur, dans le <head> de CHAQUE page, six <link rel="alternate" hrefLang> vers les
 * pages d'accueil. Ils s'ajoutaient à ceux que les layouts et les pages déclarent (alternates.languages) : sur
 * /pt/pesquisar/ ou /fr/marches/publier/, deux fr-FR contradictoires (l'accueil et la page équivalente), et des
 * doublons partout ailleurs. Les accueils, dont la canonical remplace l'objet alternates du layout, déclarent
 * désormais eux-mêmes leur jeu complet.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'

vi.mock('@/app/page', () => ({ default: () => null }))

const LANGUES_ACCUEILS = {
  'fr-FR': 'https://vitfix.io/fr/',
  'pt-PT': 'https://vitfix.io/pt/',
  en: 'https://vitfix.io/en/',
  nl: 'https://vitfix.io/nl/',
  es: 'https://vitfix.io/es/',
}

describe('hreflang', () => {
  it("le layout racine n'écrit plus de balise hreflang en dur", () => {
    const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/<link\s+rel="alternate"\s+hrefLang/)
  })

  // x-default : « / » pour l'accueil FR (hors périmètre de la phase 1 SEO PT) ; « /fr/ » (locale par défaut
  // du middleware, répond 200) pour l'accueil PT, car « / » répond 302 (phase 1 SEO PT, point 1.5).
  it.each([
    ['@/app/fr/page', 'https://vitfix.io/fr/', 'https://vitfix.io/'],
    ['@/app/pt/page', 'https://vitfix.io/pt/', 'https://vitfix.io/fr/'],
  ])('%s déclare sa canonical et le jeu complet des accueils', async (module, canonical, xDefault) => {
    const { metadata } = (await import(module)) as { metadata: Metadata }
    expect(metadata.alternates).toEqual({ canonical, languages: { ...LANGUES_ACCUEILS, 'x-default': xDefault } })
  })
})
