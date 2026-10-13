// Concordance entre le code des sitemaps PT et le CSV de référence du 13/10/2026
// (data/seo/pt_sitemap_statut_complet.csv) : mêmes 1503 URL, mêmes groupes.
// Ce test protège la base de calcul des phases 1 à 3 (table de redirection,
// lots de contenu) : si la grille change, le CSV doit être recalculé.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getAllPtSitemapUrls, ptProgrammaticPages, ptStaticPages } from '@/lib/sitemap-pt-pages'
import { lireCsv } from '../../scripts/seo/pt-audit/lib/csv.mjs'
import { classer, VILLES, METIERS } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const csv = lireCsv(readFileSync(path.join(__dirname, '..', '..', 'data', 'seo', 'pt_sitemap_statut_complet.csv'), 'utf8'))

describe('sitemap PT : code et CSV de référence', () => {
  const code = getAllPtSitemapUrls(BASE).map((u) => u.url.replace(BASE, ''))

  it('le code génère exactement les 1503 URL du CSV', () => {
    expect(csv).toHaveLength(1503)
    expect(new Set(code).size).toBe(code.length)
    expect(new Set(code)).toEqual(new Set(csv.map((l) => l.chemin)))
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

  it('la grille est 21 métiers x 22 villes (servicos, urgencia), 22 x 22 + 22 hubs (perto-de-mim)', () => {
    const parGroupe = (g) => csv.filter((l) => l.groupe === g)
    expect(parGroupe('servicos')).toHaveLength(21 * 22)
    expect(parGroupe('urgencia')).toHaveLength(21 * 22)
    expect(parGroupe('perto-de-mim')).toHaveLength(22 * 22)
    expect(parGroupe('perto-de-mim-hub')).toHaveLength(22)
    expect(parGroupe('cidade')).toHaveLength(22)
    expect(new Set(parGroupe('servicos').map((l) => l.ville))).toEqual(new Set(VILLES))
    expect(new Set(parGroupe('servicos').map((l) => l.metier))).toEqual(new Set(METIERS))
  })

  it('les 20 pages statiques du sitemap PT sont celles de ptStaticPages, dont 4 pages juridiques en noindex', () => {
    const statiques = ptStaticPages(BASE).map((u) => u.url.replace(BASE, ''))
    expect(statiques).toHaveLength(20)
    expect(statiques).toEqual(expect.arrayContaining(['/pt/termos/', '/pt/avisos-legais/', '/pt/privacidade/', '/pt/politica-cookies/']))
    expect(ptProgrammaticPages(BASE)).toHaveLength(1483)
  })

  it('priorités du CSV : 93 P1, 242 P2, 574 P3, 204 PROTEGER', () => {
    const n = (p) => csv.filter((l) => l.priorite === p).length
    expect([n('P1'), n('P2'), n('P3'), n('PROTEGER')]).toEqual([93, 242, 574, 204])
  })
})
