/**
 * Phase 2 du plan SEO PT (consolidation, DECISION PROPRIETAIRE 1 option A, décision 2) :
 * une seule URL par couple métier x ville, le modèle servicos. Les 946 pages urgencia et
 * perto-de-mim métier x ville et le hub picheleiro répondent 301 en un saut (middleware.ts,
 * lib/seo/pt-consolidacao.ts) ; les 21 hubs /pt/perto-de-mim/{metier}/ restent en 200.
 * Table de référence : data/seo/pt-redirects.csv (947 lignes), rejouée ligne par ligne.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { CITIES, SERVICES } from '@/lib/data/seo-pages-data'
import { METIERS_PT_SLUGS, CIDADES_PT_SLUGS } from '@/lib/seo/pt-grelha'
import { destinoConsolidado } from '@/lib/seo/pt-consolidacao'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'
import { lireCsv } from '../../scripts/seo/pt-audit/lib/csv.mjs'

const table: Array<Record<string, string>> = lireCsv(readFileSync(path.join(__dirname, '..', '..', 'data', 'seo', 'pt-redirects.csv'), 'utf8'))

describe('lib/seo/pt-grelha : listes de slugs égales aux données', () => {
  it('21 métiers et 22 concelhos, triés comme classer.mjs', () => {
    expect([...METIERS_PT_SLUGS]).toEqual([...SERVICES.map((s) => s.slug)].sort())
    expect([...CIDADES_PT_SLUGS]).toEqual([...CITIES.map((c) => c.slug)].sort())
  })
})

describe('destinoConsolidado (lib/seo/pt-consolidacao.ts)', () => {
  it('chaque ligne de data/seo/pt-redirects.csv est résolue vers sa destination, et aucune destination n’est redirigée', () => {
    expect(table).toHaveLength(947)
    const ecarts = table
      .map((l) => ({ source: l.source, destination: l.destination, obtenue: destinoConsolidado(l.source) }))
      .filter((l) => l.obtenue !== l.destination)
      .map((l) => `${l.source} -> ${l.obtenue ?? '(aucune)'} ≠ ${l.destination}`)
    expect(ecarts).toEqual([])
    expect(table.filter((l) => destinoConsolidado(l.destination) !== null).map((l) => l.destination)).toEqual([])
  })

  it('avec ou sans barre finale, picheleiro vers canalizador', () => {
    expect(destinoConsolidado('/pt/urgencia/canalizador-urgente-porto')).toBe('/pt/servicos/canalizador-porto/')
    expect(destinoConsolidado('/pt/urgencia/ar-condicionado-urgente-marco-de-canaveses/')).toBe('/pt/servicos/ar-condicionado-marco-de-canaveses/')
    expect(destinoConsolidado('/pt/perto-de-mim/picheleiro-ovar/')).toBe('/pt/servicos/canalizador-ovar/')
    expect(destinoConsolidado('/pt/urgencia/picheleiro-urgente-maia/')).toBe('/pt/servicos/canalizador-maia/')
    expect(destinoConsolidado('/pt/perto-de-mim/picheleiro/')).toBe('/pt/perto-de-mim/canalizador/')
  })

  it('anciennes formes sans préfixe de langue : un seul saut (grille vers servicos, hub vers /pt/, inconnu vers un 404 propre)', () => {
    expect(destinoConsolidado('/urgencia/eletricista-urgente-porto/')).toBe('/pt/servicos/eletricista-porto/')
    expect(destinoConsolidado('/perto-de-mim/canalizador-porto')).toBe('/pt/servicos/canalizador-porto/')
    expect(destinoConsolidado('/perto-de-mim/picheleiro-ovar/')).toBe('/pt/servicos/canalizador-ovar/')
    expect(destinoConsolidado('/perto-de-mim/pintor/')).toBe('/pt/perto-de-mim/pintor/')
    expect(destinoConsolidado('/perto-de-mim/picheleiro/')).toBe('/pt/perto-de-mim/canalizador/')
    expect(destinoConsolidado('/urgencia/sapateiro-urgente-porto/')).toBe('/pt/urgencia/sapateiro-urgente-porto/')
    expect(destinoConsolidado('/urgencia/')).toBeNull()
    expect(destinoConsolidado('/perto-de-mim/')).toBeNull()
  })

  it('aucun texte d’urgence rendu (#urgencia) n’annonce un délai ou une disponibilité non sourcés (règle 0.2)', () => {
    const interdit = /24\s*h|24 horas|próprio dia|em \d+ (minutos|horas)|menos de \d+|7 dias|7\/7/i
    const fautifs = SERVICES.flatMap((s) => [s.urgencyText, ...s.urgency.whenToCall, ...s.urgency.immediateSteps].filter((t) => interdit.test(t)).map((t) => `${s.slug} : « ${t} »`))
    expect(fautifs).toEqual([])
  })

  it('les 21 hubs métier, les hubs de section et les 554 URL du sitemap ne sont pas redirigés', () => {
    for (const s of SERVICES) expect(destinoConsolidado(`/pt/perto-de-mim/${s.slug}/`)).toBeNull()
    for (const chemin of ['/pt/perto-de-mim/', '/pt/urgencia/', '/pt/servicos/', '/pt/', '/fr/urgence/plombier-marseille/']) expect(destinoConsolidado(chemin)).toBeNull()
    const sitemap = getAllPtSitemapUrls('').map((u) => u.url)
    expect(sitemap).toHaveLength(554)
    expect(sitemap.filter((u) => destinoConsolidado(u) !== null)).toEqual([])
  })

  it('un métier ou un concelho inconnu n’est pas redirigé (404 propre, jamais un 200 générique ni un faux 301)', () => {
    for (const chemin of [
      '/pt/urgencia/canalizador-urgente-lisboa/',
      '/pt/urgencia/sapateiro-urgente-porto/',
      '/pt/urgencia/canalizador-porto/',
      '/pt/perto-de-mim/canalizador-lisboa/',
      '/pt/perto-de-mim/sapateiro-porto/',
      '/pt/perto-de-mim/picheleiro-lisboa/',
      '/pt/perto-de-mim/-porto/',
    ]) expect(destinoConsolidado(chemin)).toBeNull()
  })
})

describe('middleware : 301 un saut, CSP posée, requête conservée', () => {
  it.each([
    ['/pt/urgencia/eletricista-urgente-braga/', '/pt/servicos/eletricista-braga/'],
    ['/pt/perto-de-mim/pintor-vila-nova-de-gaia/', '/pt/servicos/pintor-vila-nova-de-gaia/'],
    ['/pt/perto-de-mim/picheleiro-porto', '/pt/servicos/canalizador-porto/'],
    ['/pt/perto-de-mim/picheleiro/', '/pt/perto-de-mim/canalizador/'],
    ['/urgencia/canalizador-urgente-porto', '/pt/servicos/canalizador-porto/'],
    ['/perto-de-mim/pintor-maia/', '/pt/servicos/pintor-maia/'],
    ['/perto-de-mim/pintor', '/pt/perto-de-mim/pintor/'],
  ])('%s → 301 %s', async (source, destination) => {
    const { middleware } = await import('@/middleware')
    const reponse = await middleware(new NextRequest(`https://vitfix.io${source}?utm_source=teste`))
    expect(reponse.status).toBe(301)
    expect(reponse.headers.get('location')).toBe(`https://vitfix.io${destination}?utm_source=teste`)
    expect(reponse.headers.get('content-security-policy')).toBeTruthy()
  })

  it('un hub métier et une page servicos passent (200)', async () => {
    const { middleware } = await import('@/middleware')
    for (const chemin of ['/pt/perto-de-mim/canalizador/', '/pt/servicos/canalizador-porto/']) {
      expect((await middleware(new NextRequest(`https://vitfix.io${chemin}`))).status).toBe(200)
    }
  })
})
