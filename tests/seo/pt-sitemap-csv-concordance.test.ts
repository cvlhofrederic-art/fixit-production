// Concordance entre le code des sitemaps PT et le CSV de référence du 13/10/2026
// (data/seo/pt_sitemap_statut_complet.csv, 1503 URL avant la phase 1).
//
// Phase 1 SEO PT (point 1.1) : le sitemap PT perd les 4 pages juridiques (noindex) et gagne
// /pt/cidade/ et /pt/contacto/ ; chaque URL est dans exactement un fichier /pt/sitemap-*.xml.
// Phase 2 (point 2.2, décision 1 option A) : les 946 pages urgencia et perto-de-mim métier x ville
// et le hub picheleiro sortent du sitemap (301 vers servicos, data/seo/pt-redirects.csv) ; les 21
// hubs métier ont leur fichier /pt/sitemap-hubs.xml. Ce test protège la base de calcul des phases
// suivantes : si la grille change, le CSV doit être recalculé.
// Pages de district (gel A0 levé le 20/10/2026, lib/data/pt-servicos-distrito.ts) : hors grille et hors CSV, elles
// s'ajoutent au fichier servicos.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getAllPtSitemapUrls, sitemapsPt, PAGINAS_ESTATICAS_PT, FICHIERS_SITEMAP_PT } from '@/lib/sitemap-pt-pages'
import { SERVICOS_DISTRITO } from '@/lib/data/pt-servicos-distrito'
import { lireCsv } from '../../scripts/seo/pt-audit/lib/csv.mjs'
import { classer, VILLES, METIERS } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const csv = lireCsv(readFileSync(path.join(__dirname, '..', '..', 'data', 'seo', 'pt_sitemap_statut_complet.csv'), 'utf8'))
const redirections = lireCsv(readFileSync(path.join(__dirname, '..', '..', 'data', 'seo', 'pt-redirects.csv'), 'utf8'))
const JURIDIQUES = ['/pt/termos/', '/pt/avisos-legais/', '/pt/privacidade/', '/pt/politica-cookies/']
const AJOUTEES_PHASE_1 = ['/pt/cidade/', '/pt/contacto/']
const PAGES_DISTRITO = SERVICOS_DISTRITO.map((s) => `/pt/servicos/${s.slug}/`)
const REDIRIGEES_PHASE_2 = new Set(redirections.map((l) => l.source))

describe('sitemap PT : code et CSV de référence', () => {
  const code = getAllPtSitemapUrls(BASE).map((u) => u.url.replace(BASE, ''))
  const attendu = new Set([
    ...csv.map((l) => l.chemin).filter((c) => !JURIDIQUES.includes(c) && !REDIRIGEES_PHASE_2.has(c)),
    ...AJOUTEES_PHASE_1,
    ...PAGES_DISTRITO,
  ])

  it('le code génère les 1503 URL du CSV moins 4 juridiques moins 947 redirigées plus /pt/cidade/ et /pt/contacto/ (554), plus les pages de district', () => {
    expect(csv).toHaveLength(1503)
    expect(redirections).toHaveLength(947)
    expect(new Set(code).size).toBe(code.length)
    expect(new Set(code)).toEqual(attendu)
    expect(code).toHaveLength(1503 - 4 - 947 + 2 + PAGES_DISTRITO.length)
  })

  it('chaque URL PT est dans exactement un fichier, et chaque fichier est non vide', () => {
    const groupes = sitemapsPt(BASE)
    const vues = new Map<string, string[]>()
    for (const [groupe, urls] of Object.entries(groupes)) {
      expect(urls.length).toBeGreaterThan(0)
      for (const { url } of urls) vues.set(url, [...(vues.get(url) ?? []), groupe])
    }
    expect([...vues].filter(([, g]) => g.length !== 1)).toEqual([])
    expect(Object.keys(groupes).sort()).toEqual(Object.keys(FICHIERS_SITEMAP_PT).sort())
  })

  it('composition par fichier : 462 servicos et les pages de district, 21 hubs, 23 cidades, 28 blog, 20 paginas', () => {
    const groupes = sitemapsPt(BASE)
    expect(groupes.servicos).toHaveLength(21 * 22 + PAGES_DISTRITO.length)
    expect(groupes.hubs).toHaveLength(21)
    expect(groupes.cidades).toHaveLength(23)
    expect(groupes.blog).toHaveLength(28)
    expect(groupes.paginas).toHaveLength(PAGINAS_ESTATICAS_PT.length)
    expect(PAGINAS_ESTATICAS_PT).toHaveLength(20)
  })

  it('aucune page noindex, aucune URL redirigée, un lastmod ISO sur chaque URL, ni priority ni changefreq', () => {
    const urls = getAllPtSitemapUrls(BASE)
    for (const u of urls) {
      const chemin = u.url.replace(BASE, '')
      expect(JURIDIQUES).not.toContain(chemin)
      expect(REDIRIGEES_PHASE_2.has(chemin)).toBe(false)
      expect(u.url).not.toContain('/pt/mercados/gerir/')
      expect(u.url).not.toContain('/pt/contact/')
      expect(String(u.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(String(u.lastModified)).getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 3600 * 1000)
      expect(u.priority).toBeUndefined()
      expect(u.changeFrequency).toBeUndefined()
    }
  })

  it('table de redirection : 947 sources hors sitemap, 947 destinations dans le sitemap, 0 chaîne, 0 boucle', () => {
    const dansSitemap = new Set(code)
    const sources = new Set(redirections.map((l) => l.source))
    expect(sources.size).toBe(947)
    for (const l of redirections) {
      expect(l.code).toBe('301')
      expect(dansSitemap.has(l.source)).toBe(false)
      expect(dansSitemap.has(l.destination)).toBe(true)
      expect(sources.has(l.destination)).toBe(false)
      expect(l.source).not.toBe(l.destination)
      expect(l.decision.length).toBeGreaterThan(20)
    }
    const parGroupe = (g: string) => redirections.filter((l) => classer(l.source).groupe === g).length
    expect([parGroupe('urgencia'), parGroupe('perto-de-mim'), parGroupe('perto-de-mim-hub')]).toEqual([462, 484, 1])
    expect(redirections.filter((l) => l.priorite === 'PROTEGER').every((l) => /PROTEGER/.test(l.decision))).toBe(true)
  })

  it('le classement de l\'outillage reproduit la colonne groupe du CSV', () => {
    const ecarts = csv.filter((l) => classer(l.chemin).groupe !== l.groupe).map((l) => l.chemin + ' : ' + classer(l.chemin).groupe + ' ≠ ' + l.groupe)
    expect(ecarts).toEqual([])
  })

  it('métier et ville de l\'outillage reproduisent les colonnes du CSV', () => {
    const ecarts = csv.filter((l) => {
      const c = classer(l.chemin)
      return (l.metier || '') !== (c.metier || '') || (l.ville || '') !== (c.ville || '')
    }).map((l) => l.chemin)
    expect(ecarts).toEqual([])
  })

  it('la grille de référence est 21 métiers x 22 villes (servicos, urgencia), 22 x 22 + 22 hubs (perto-de-mim)', () => {
    const parGroupe = (g: string) => csv.filter((l) => l.groupe === g)
    expect(parGroupe('servicos')).toHaveLength(21 * 22)
    expect(parGroupe('urgencia')).toHaveLength(21 * 22)
    expect(parGroupe('perto-de-mim')).toHaveLength(22 * 22)
    expect(parGroupe('perto-de-mim-hub')).toHaveLength(22)
    expect(parGroupe('cidade')).toHaveLength(22)
    expect(new Set(parGroupe('servicos').map((l) => l.ville))).toEqual(new Set(VILLES))
    expect(new Set(parGroupe('servicos').map((l) => l.metier))).toEqual(new Set(METIERS))
  })

  it('priorités du CSV : 93 P1, 242 P2, 574 P3, 204 PROTEGER', () => {
    const n = (p: string) => csv.filter((l) => l.priorite === p).length
    expect([n('P1'), n('P2'), n('P3'), n('PROTEGER')]).toEqual([93, 242, 574, 204])
  })
})
