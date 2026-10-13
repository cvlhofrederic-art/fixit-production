// Outillage SEO PT (phase 0) : analyseur HTML, mesures de contenu, classement
// des URL, robots.txt et CSV. Aucun accès réseau.
import { describe, it, expect } from 'vitest'
import { analyserHtml, mots, normaliserLien } from '../../scripts/seo/pt-audit/lib/html.mjs'
import { mesurerGroupe, chevauchement, sequences } from '../../scripts/seo/pt-audit/lib/mesures.mjs'
import { classer, modeleMesure, VILLES, METIERS } from '../../scripts/seo/pt-audit/lib/classer.mjs'
import { lireRobots, autorise } from '../../scripts/seo/pt-audit/lib/robots.mjs'
import { lireCsv, ecrireCsv } from '../../scripts/seo/pt-audit/lib/csv.mjs'
import { lireUrlset, lireIndex } from '../../scripts/seo/pt-audit/lib/sitemaps.mjs'
import { construireGraphe, profondeurs } from '../../scripts/seo/pt-audit/lib/graphe.mjs'

const HTML = `<!doctype html><html><head>
<title>Canalizador em Ovar | VITFIX | VITFIX Portugal</title>
<meta name="description" content="Canalizador e picheleiro em Ovar. Fugas de &amp; entupimentos."/>
<meta name="robots" content="index, follow, max-snippet:-1"/>
<link rel="canonical" href="https://vitfix.io/pt/servicos/canalizador-ovar/"/>
<link rel="alternate" hrefLang="pt-PT" href="https://vitfix.io/pt/servicos/canalizador-ovar/"/>
<link rel="alternate" hrefLang="fr-FR" href="https://vitfix.io/fr/services/"/>
<link rel="alternate" hrefLang="x-default" href="https://vitfix.io/"/>
<meta property="og:image" content="https://vitfix.io/api/og/?title=Canalizador&amp;locale=pt"/>
<script type="application/ld+json">[{"@type":"WebSite","@id":"https://vitfix.io/#website"},{"@type":["Organization","HomeAndConstructionBusiness"],"@id":"https://vitfix.io/#business","telephone":"+351912014971"}]</script>
<script type="application/ld+json">{"@type":"LocalBusiness","name":"VITFIX - Canalizador em Ovar","address":{"@type":"PostalAddress","addressLocality":"Ovar"},"geo":{"@type":"GeoCoordinates","latitude":40.8,"longitude":-8.6},"openingHoursSpecification":[{}]}</script>
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"https://vitfix.io/pt/","name":"Início"}},{"@type":"ListItem","position":2,"item":{"@id":"https://vitfix.io/pt/servicos/","name":"Serviços"}}]}</script>
<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>
</head><body>
<header><a href="/pt/">Início</a><a href="/pesquisar/?category=plomberie">Pesquisar</a></header>
<main><h1>Canalizador em Ovar</h1><p>Texto principal com cinco palavras únicas e mais algumas. Olá &eacute; bom.</p>
<h2>Serviços</h2><h2>FAQ</h2>
<a href="/pt/servicos/">Serviços</a><a href="/pt/servicos/canalizador-aveiro/">Aveiro</a><a href="/pt/pesquisar">Sem barra</a>
<a href="tel:+351912014971">Ligar</a><a href="https://wa.me/351912014971">WhatsApp</a><a href="/mês">mês</a>
</main>
<footer><a href="/pt/termos/">Termos</a><a href="https://www.livroreclamacoes.pt/">Livro</a></footer>
</body></html>`

describe('analyserHtml', () => {
  const a = analyserHtml(HTML)
  it('lit title, description, robots, canonique, hreflang, og:image', () => {
    expect(a.title).toBe('Canalizador em Ovar | VITFIX | VITFIX Portugal')
    expect(a.title_marque_n).toBe(2)
    expect(a.description).toBe('Canalizador e picheleiro em Ovar. Fugas de & entupimentos.')
    expect(a.meta_robots).toEqual(['index, follow, max-snippet:-1'])
    expect(a.noindex).toBe(false)
    expect(a.canonical).toBe('https://vitfix.io/pt/servicos/canalizador-ovar/')
    expect(a.hreflang.map((h) => h.lang)).toEqual(['pt-PT', 'fr-FR', 'x-default'])
    expect(a.og_image).toBe('https://vitfix.io/api/og/?title=Canalizador&locale=pt')
  })
  it('compte h1/h2 et le texte de main', () => {
    expect(a.h1_n).toBe(1)
    expect(a.h1).toBe('Canalizador em Ovar')
    expect(a.h2_n).toBe(2)
    expect(a.main_present).toBe(true)
    expect(a.texte_main).toContain('Olá é bom')
    expect(a.mots_main).toContain('canalizador')
    expect(a.mots_main).not.toContain('início')
  })
  it('extrait les nœuds JSON-LD avec address et geo', () => {
    expect(a.jsonld.erreurs).toBe(0)
    expect(a.jsonld.types).toEqual(['WebSite', 'Organization+HomeAndConstructionBusiness', 'LocalBusiness', 'BreadcrumbList', 'FAQPage'])
    const lb = a.jsonld.noeuds.find((n) => n.type === 'LocalBusiness')
    expect(lb && lb.address && lb.geo && lb.ohs).toBe(true)
    expect(lb && lb.address_locality).toBe('Ovar')
    const fil = a.jsonld.noeuds.find((n) => n.type === 'BreadcrumbList')
    expect(fil && fil.crumbs).toEqual(['https://vitfix.io/pt/', 'https://vitfix.io/pt/servicos/'])
  })
  it('classe les liens : internes, sans préfixe, sans barre finale, dans main', () => {
    // « /mês » est conservé sous sa forme encodée (celle que reçoit le serveur et que GSC affiche)
    expect(a.liens_internes_distincts).toEqual(['/pt/', '/pesquisar/', '/pt/servicos/', '/pt/servicos/canalizador-aveiro/', '/pt/pesquisar/', '/m%C3%AAs/', '/pt/termos/'])
    expect(a.liens_sans_prefixe).toEqual(['/pesquisar/?category=plomberie', '/m%C3%AAs'])
    expect(a.liens_sans_slash).toEqual(['/pt/pesquisar'])
    expect(a.liens_pesquisar_category).toEqual(['/pesquisar/?category=plomberie'])
    expect(a.liens_internes.filter((l) => l.dans_main).map((l) => l.chemin)).toEqual(['/pt/servicos/', '/pt/servicos/canalizador-aveiro/', '/pt/pesquisar/', '/m%C3%AAs/'])
  })
  it('normalise les liens et ignore tel/mailto/externes', () => {
    expect(normaliserLien('/pt/pesquisar?x=1#y')).toBe('/pt/pesquisar/')
    expect(normaliserLien('https://vitfix.io/pt/blog/')).toBe('/pt/blog/')
    expect(normaliserLien('https://autre.site/pt/')).toBeNull()
    expect(normaliserLien('tel:+351')).toBeNull()
    expect(normaliserLien('/api/og/image.png')).toBe('/api/og/image.png')
  })
  it('mots : alphanumériques en minuscules, accents conservés', () => {
    expect(mots('Fuga de Água, 24h/7 — ÁGUA!')).toEqual(['fuga', 'de', 'água', '24h', '7', 'água'])
  })
})

describe('mesures de contenu (séquences de 5 mots)', () => {
  const commun = 'a b c d e f g h'.split(' ')
  const pages = [
    { cle: 'p1', mots: [...commun, 'x1', 'x2', 'x3', 'x4', 'x5'] },
    { cle: 'p2', mots: [...commun, 'y1', 'y2', 'y3', 'y4', 'y5'] },
    { cle: 'p3', mots: [...commun] },
  ]
  it('sequences : fenêtres glissantes distinctes', () => {
    expect(sequences(['a', 'b', 'c', 'd', 'e', 'f']).size).toBe(2)
    expect(sequences(['a', 'b']).size).toBe(0)
  })
  it('propre = part des séquences vues dans une seule page du groupe', () => {
    const m = mesurerGroupe(pages)
    // p1 : 9 séquences, 4 communes (abcde..defgh) et 5 propres (efghx1..x1x2x3x4x5)
    expect(m.get('p1').sequences_n).toBe(9)
    expect(m.get('p1').propre).toBeCloseTo(5 / 9, 6)
    expect(m.get('p3').propre).toBe(0)
    expect(m.get('p1').partage10).toBe(0)
  })
  it('partage10 avec 10 pages identiques', () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ cle: 'q' + i, mots: commun }))
    const m = mesurerGroupe(dix)
    expect(m.get('q0').partage10).toBe(1)
    expect(m.get('q0').propre).toBe(0)
  })
  it('chevauchement orienté', () => {
    expect(chevauchement(pages[0].mots, pages[2].mots)).toBeCloseTo(4 / 9, 6)
    expect(chevauchement(pages[2].mots, pages[0].mots)).toBe(1)
  })
})

describe('classer', () => {
  it('reconnaît la grille métier x ville, villes composées comprises', () => {
    expect(classer('/pt/servicos/isolamento-termico-vila-nova-de-gaia/')).toEqual({ groupe: 'servicos', metier: 'isolamento-termico', ville: 'vila-nova-de-gaia' })
    expect(classer('/pt/urgencia/canalizador-urgente-marco-de-canaveses/')).toEqual({ groupe: 'urgencia', metier: 'canalizador', ville: 'marco-de-canaveses' })
    expect(classer('/pt/perto-de-mim/picheleiro-ovar/')).toEqual({ groupe: 'perto-de-mim', metier: 'picheleiro', ville: 'ovar' })
    expect(classer('/pt/perto-de-mim/picheleiro/')).toEqual({ groupe: 'perto-de-mim-hub', metier: 'picheleiro', ville: '' })
    expect(classer('/pt/perto-de-mim/estores-portoes/')).toEqual({ groupe: 'perto-de-mim-hub', metier: 'estores-portoes', ville: '' })
  })
  it('reconnaît les hubs, pages ville, blog, prix, statiques, juridiques', () => {
    expect(classer('/pt/servicos/').groupe).toBe('hub-section')
    expect(classer('/pt/perto-de-mim/').groupe).toBe('hub-section')
    expect(classer('/pt/cidade/').groupe).toBe('hub-cidade')
    expect(classer('/pt/cidade/povoa-de-varzim/')).toEqual({ groupe: 'cidade', metier: '', ville: 'povoa-de-varzim' })
    expect(classer('/pt/blog/').groupe).toBe('blog-index')
    expect(classer('/pt/blog/fuga-agua-como-agir/').groupe).toBe('blog')
    expect(classer('/pt/precos/').groupe).toBe('precos')
    expect(classer('/pt/precos/pintor/')).toEqual({ groupe: 'precos', metier: '', ville: '' })
    expect(classer('/pt/').groupe).toBe('page-statique')
    expect(classer('/pt/avaliacoes/').groupe).toBe('page-statique')
    expect(classer('/pt/termos/').groupe).toBe('juridique')
    expect(classer('/pt/mercados/publicar/').groupe).toBe('mercados')
    expect(classer('/pt/pesquisar/').groupe).toBe('recherche')
    expect(classer('/pt/profissional/x/').groupe).toBe('profil-pro')
    expect(classer('/fr/services/').groupe).toBe('hors-pt')
  })
  it('listes de référence : 22 villes, 21 métiers', () => {
    expect(VILLES).toHaveLength(22)
    expect(METIERS).toHaveLength(21)
    expect(modeleMesure('servicos')).toBe('servicos')
    expect(modeleMesure('precos')).toBe('hors-grille')
  })
})

describe('robots.txt', () => {
  const groupes = lireRobots(`User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /*/pesquisar/*?*\nDisallow: /*?utm_*\n\nUser-Agent: GPTBot\nDisallow: /pro/\n\nSitemap: https://vitfix.io/sitemap.xml\n`)
  it('applique la règle la plus spécifique', () => {
    expect(autorise(groupes, '/pt/servicos/canalizador-ovar/')).toBe(true)
    expect(autorise(groupes, '/api/og/?locale=pt')).toBe(false)
    expect(autorise(groupes, '/pt/pesquisar/?category=x')).toBe(false)
    expect(autorise(groupes, '/pt/pesquisar/')).toBe(true)
    expect(autorise(groupes, '/pt/?utm_source=x')).toBe(false)
    expect(autorise(groupes, '/pro/', 'GPTBot')).toBe(false)
    expect(autorise(groupes, '/pro/', '*')).toBe(true)
  })
  it('Allow gagne à longueur égale', () => {
    const g = lireRobots('User-agent: *\nDisallow: /api/\nAllow: /api/\n')
    expect(autorise(g, '/api/og/')).toBe(true)
  })
})

describe('csv et sitemaps', () => {
  it('lit et écrit des champs avec guillemets et virgules', () => {
    const lignes = lireCsv('﻿a,b\n1,"x, ""y"""\n2,z\n')
    expect(lignes).toEqual([{ a: '1', b: 'x, "y"' }, { a: '2', b: 'z' }])
    expect(ecrireCsv(lignes)).toBe('a,b\n1,"x, ""y"""\n2,z\n')
  })
  it('lit un urlset et un index', () => {
    const xml = '<urlset><url><loc>https://vitfix.io/pt/</loc><lastmod>2026-05-11T00:00:00.000Z</lastmod></url><url><loc>https://vitfix.io/pt/x/</loc><priority>0.5</priority></url></urlset>'
    expect(lireUrlset(xml)).toEqual([{ loc: 'https://vitfix.io/pt/', lastmod: '2026-05-11T00:00:00.000Z', changefreq: '', priority: '' }, { loc: 'https://vitfix.io/pt/x/', lastmod: '', changefreq: '', priority: '0.5' }])
    expect(lireIndex('<sitemapindex><sitemap><loc>https://vitfix.io/sitemap/0.xml</loc></sitemap></sitemapindex>')).toEqual(['https://vitfix.io/sitemap/0.xml'])
  })
})

describe('graphe', () => {
  const pages = new Map([
    ['/pt/', ['/pt/servicos/', '/pt/cidade/ovar/']],
    ['/pt/servicos/', ['/pt/servicos/canalizador-ovar/']],
    ['/pt/cidade/ovar/', ['/pt/servicos/canalizador-ovar/']],
    ['/pt/servicos/canalizador-ovar/', ['/pt/perto-de-mim/canalizador/']],
    ['/pt/perto-de-mim/canalizador/', ['/pt/perto-de-mim/canalizador-ovar/']],
    ['/pt/orpheline/', ['/pt/']],
  ])
  it('profondeur par parcours en largeur et liens entrants', () => {
    const prof = profondeurs(pages)
    expect(prof.get('/pt/servicos/canalizador-ovar/')).toBe(2)
    expect(prof.get('/pt/perto-de-mim/canalizador-ovar/')).toBe(4)
    expect(prof.has('/pt/orpheline/')).toBe(false)
    const { entrants } = construireGraphe(pages)
    expect(entrants.get('/pt/servicos/canalizador-ovar/').size).toBe(2)
    expect(entrants.has('/pt/orpheline/')).toBe(false)
  })
})
