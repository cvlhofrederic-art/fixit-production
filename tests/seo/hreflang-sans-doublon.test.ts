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
  'x-default': 'https://vitfix.io/',
}

describe('hreflang', () => {
  it("le layout racine n'écrit plus de balise hreflang en dur", () => {
    const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/<link\s+rel="alternate"\s+hrefLang/)
  })

  it.each([
    ['@/app/fr/page', 'https://vitfix.io/fr/'],
    ['@/app/pt/page', 'https://vitfix.io/pt/'],
  ])('%s déclare sa canonical et le jeu complet des accueils', async (module, canonical) => {
    const { metadata } = (await import(module)) as { metadata: Metadata }
    expect(metadata.alternates).toEqual({ canonical, languages: LANGUES_ACCUEILS })
  })
})
