#!/usr/bin/env node
// Audit SEO des pages PT de vitfix.io (instructions du 13/10/2026, section 8).
//
// Entrée : les sitemaps PT en ligne (ou data/seo/pt_sitemap_statut_complet.csv).
// Sortie : reports/seo/pt-audit-{date}.csv (une ligne par URL), .json (données
// complètes pour les tests T1 à T12) et -resume.md (synthèse par modèle).
//
// Usage :
//   node scripts/seo/pt-audit/index.mjs [--base https://vitfix.io] [--out reports/seo]
//        [--concurrence 8] [--source live|csv] [--csv data/seo/pt_sitemap_statut_complet.csv]
//        [--echantillon N] [--git] [--date AAAA-MM-JJ] [--silencieux]
//
// Aucune dépendance : Node 20+ (fetch natif).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { requete, enParallele, urlInterne } from './lib/http.mjs'
import { analyserHtml, ORIGINE_PUBLIQUE } from './lib/html.mjs'
import { chargerSitemaps, urlsPt } from './lib/sitemaps.mjs'
import { classer, modeleMesure, VILLES } from './lib/classer.mjs'
import { mesurerGroupe, moyenne, pct, chevauchement } from './lib/mesures.mjs'
import { construireGraphe, profondeurs } from './lib/graphe.mjs'
import { lireCsv, ecrireCsv } from './lib/csv.mjs'

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export function lireArguments(argv) {
  const o = { base: 'https://vitfix.io', out: 'reports/seo', concurrence: 8, source: 'live', csv: 'data/seo/pt_sitemap_statut_complet.csv', echantillon: 0, git: false, date: '', silencieux: false, extras: ['/pt/cidade/', '/pt/contacto/'] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => argv[++i]
    if (a === '--base') o.base = val().replace(/\/$/, '')
    else if (a === '--out') o.out = val()
    else if (a === '--concurrence') o.concurrence = Number(val())
    else if (a === '--source') o.source = val()
    else if (a === '--csv') o.csv = val()
    else if (a === '--echantillon') o.echantillon = Number(val())
    else if (a === '--git') o.git = true
    else if (a === '--date') o.date = val()
    else if (a === '--silencieux') o.silencieux = true
    else if (a === '--sans-extras') o.extras = []
  }
  if (!o.date) o.date = new Date().toISOString().slice(0, 10)
  return o
}

const absolu = (p) => (path.isAbsolute(p) ? p : path.join(RACINE, p))

/** Date du dernier commit touchant un fichier (AAAA-MM-JJ), ou '' si inconnue. */
function dateDernierCommit(fichier, cache) {
  if (cache.has(fichier)) return cache.get(fichier)
  let d = ''
  try {
    d = execFileSync('git', ['log', '-1', '--format=%cs', '--', fichier], { cwd: RACINE, encoding: 'utf8' }).trim()
  } catch {
    d = ''
  }
  cache.set(fichier, d)
  return d
}

/** Fichiers du dépôt dont dépend le contenu d'une page (approximation documentée). */
export function fichiersSource(chemin, groupe) {
  const donnees = 'lib/data/seo-pages-data.ts'
  switch (groupe) {
    case 'servicos': return [donnees, 'app/pt/servicos/[slug]/page.tsx']
    case 'urgencia': return [donnees, 'app/pt/urgencia/[slug]/page.tsx']
    case 'perto-de-mim': case 'perto-de-mim-hub': return [donnees, 'app/pt/perto-de-mim/[slug]/page.tsx']
    case 'cidade': return [donnees, 'app/pt/cidade/[slug]/page.tsx']
    case 'blog': return [donnees, 'app/pt/blog/[slug]/page.tsx']
    case 'precos': return chemin === '/pt/precos/' ? ['app/pt/precos/page.tsx'] : ['app/pt/precos/[slug]/page.tsx', 'lib/seo/service-prices.ts']
    default: {
      const seg = chemin.replace(/^\/pt\/?/, '').replace(/\/$/, '')
      return seg ? ['app/pt/' + seg + '/page.tsx'] : ['app/pt/page.tsx']
    }
  }
}

export async function auditer(options, journal = () => {}) {
  const o = { ...lireArguments([]), ...options }
  const base = o.base

  // 1. Inventaire des URL PT
  journal('Lecture des sitemaps ' + base + '/sitemap.xml')
  const sitemaps = await chargerSitemaps(base, { enfantsSupplementaires: ['/pt/sitemap.xml', '/sitemap/0.xml', '/sitemap/1.xml', '/sitemap/2.xml', '/sitemap/3.xml'] })
  let chemins
  if (o.source === 'csv') {
    const lignes = lireCsv(readFileSync(absolu(o.csv), 'utf8'))
    chemins = lignes.map((l) => l.chemin)
  } else {
    chemins = urlsPt(sitemaps.parUrl).map((e) => e.chemin)
  }
  const horsSitemap = new Set()
  for (const extra of o.extras) if (!chemins.includes(extra)) { chemins.push(extra); horsSitemap.add(extra) }
  chemins = [...new Set(chemins)]

  // Recoupement GSC (CSV du 13/10/2026 ou recalculé)
  const gsc = new Map()
  if (existsSync(absolu(o.csv))) {
    for (const l of lireCsv(readFileSync(absolu(o.csv), 'utf8'))) gsc.set(l.chemin, l)
  }

  if (o.echantillon > 0) {
    const parGroupe = new Map()
    for (const c of chemins) {
      const g = classer(c).groupe
      if (!parGroupe.has(g)) parGroupe.set(g, [])
      if (parGroupe.get(g).length < o.echantillon) parGroupe.get(g).push(c)
    }
    chemins = [...parGroupe.values()].flat()
    journal('Échantillon : ' + chemins.length + ' URL (' + o.echantillon + ' par groupe)')
  }

  // 2. Téléchargement et analyse
  journal('Téléchargement de ' + chemins.length + ' pages (concurrence ' + o.concurrence + ')')
  const pages = new Map()
  const taches = chemins.map((chemin) => async () => {
    const url = urlInterne(base, chemin)
    const r = await requete(url)
    const page = {
      chemin,
      url,
      statut_http: r.status,
      url_finale: r.status >= 300 && r.status < 400 ? r.location : (r.status ? base + chemin : ''),
      content_type: r.headers['content-type'] || '',
      x_robots_tag: r.headers['x-robots-tag'] || '',
      cache_control: r.headers['cache-control'] || '',
      erreur: r.erreur || '',
      hors_sitemap: horsSitemap.has(chemin),
      ...classer(chemin),
    }
    if (r.status === 200 && /html/i.test(page.content_type)) {
      const a = analyserHtml(r.body, { base })
      Object.assign(page, {
        title: a.title, title_len: a.title_len, title_marque_n: a.title_marque_n,
        meta_robots: a.meta_robots.join(' | '), noindex: a.noindex,
        description: a.description, description_len: a.description_len,
        // La canonique porte l'origine publique, y compris sur un build local audité par --base.
        canonical: a.canonical, canonical_ok: a.canonical === ORIGINE_PUBLIQUE + chemin || a.canonical === base + chemin,
        og_image: a.og_image,
        h1_n: a.h1_n, h1: a.h1, h2_n: a.h2_n, h2: a.h2,
        hreflang: a.hreflang,
        jsonld: a.jsonld,
        jsonld_types: [...new Set(a.jsonld.types)].join(' | '),
        jsonld_address: a.jsonld.noeuds.some((n) => n.address),
        jsonld_geo: a.jsonld.noeuds.some((n) => n.geo),
        jsonld_erreurs: a.jsonld.erreurs,
        main_present: a.main_present,
        mots_main: a.mots_main,
        mots_main_n: a.mots_main_n,
        liens_internes_n: a.liens_internes_n,
        liens_internes_distincts: a.liens_internes_distincts,
        liens_internes_main: [...new Set(a.liens_internes.filter((x) => x.dans_main).map((x) => x.chemin))],
        liens_profissional: a.liens_profissional,
        liens_sans_prefixe: a.liens_sans_prefixe,
        liens_sans_slash: a.liens_sans_slash,
        liens_pesquisar_category: a.liens_pesquisar_category,
        html_len: r.body.length,
      })
    }
    pages.set(chemin, page)
    return page
  })
  let dernier = 0
  await enParallele(taches, o.concurrence, (f, t) => { if (f - dernier >= 100 || f === t) { dernier = f; journal('  ' + f + '/' + t) } })

  // 3. Sitemaps : appartenance et lastmod
  for (const p of pages.values()) {
    const e = sitemaps.parUrl.get(p.chemin)
    p.sitemaps = e ? e.sitemaps : []
    p.sitemaps_n = p.sitemaps.length
    p.lastmod_sitemap = e ? e.lastmod : ''
    p.changefreq = e ? e.changefreq : ''
    p.priority = e ? e.priority : ''
  }

  // 4. Mesures de contenu par modèle, et par métier (22 villes) pour la grille
  journal('Mesures de contenu (séquences de 5 mots)')
  const parModele = new Map()
  for (const p of pages.values()) {
    if (!p.mots_main) continue
    const m = modeleMesure(p.groupe)
    if (!parModele.has(m)) parModele.set(m, [])
    parModele.get(m).push({ cle: p.chemin, mots: p.mots_main })
  }
  for (const [m, liste] of parModele) {
    const res = mesurerGroupe(liste)
    for (const [cle, v] of res) Object.assign(pages.get(cle), { modele_mesure: m, sequences_n: v.sequences_n, propre_modele: v.propre, partage10_modele: v.partage10 })
  }
  const parMetier = new Map()
  for (const p of pages.values()) {
    if (!p.mots_main || !['servicos', 'urgencia', 'perto-de-mim'].includes(p.groupe)) continue
    const k = p.groupe + '|' + p.metier
    if (!parMetier.has(k)) parMetier.set(k, [])
    parMetier.get(k).push({ cle: p.chemin, mots: p.mots_main })
  }
  for (const [, liste] of parMetier) {
    const res = mesurerGroupe(liste)
    for (const [cle, v] of res) Object.assign(pages.get(cle), { propre_metier: v.propre, partage10_metier: v.partage10 })
  }

  // 5. Graphe interne (sources = pages téléchargées ; cibles = chemins normalisés)
  journal('Graphe de liens internes')
  const graphePages = new Map()
  for (const p of pages.values()) graphePages.set(p.chemin, p.liens_internes_distincts || [])
  const { entrants } = construireGraphe(graphePages)
  const prof = profondeurs(graphePages, '/pt/')
  for (const p of pages.values()) {
    p.liens_entrants = entrants.has(p.chemin) ? entrants.get(p.chemin).size : 0
    p.profondeur = prof.has(p.chemin) ? prof.get(p.chemin) : -1
  }

  // 6. Recoupement GSC et date de dernière modification réelle (dépôt)
  const cacheGit = new Map()
  for (const p of pages.values()) {
    const g = gsc.get(p.chemin)
    p.statut_gsc = g ? g.statut_gsc : ''
    p.derniere_exploration_gsc = g ? g.derniere_exploration_gsc : ''
    p.clics_sept = g ? g.clics_sept : ''
    p.impressions_sept = g ? g.impressions_sept : ''
    p.position_moy_sept = g ? g.position_moy_sept : ''
    p.priorite = g ? g.priorite : ''
    p.fichiers_source = fichiersSource(p.chemin, p.groupe)
    p.derniere_modif_reelle = o.git ? p.fichiers_source.map((f) => dateDernierCommit(f, cacheGit)).filter(Boolean).sort().pop() || '' : ''
  }

  // 7. Chevauchements de référence (échantillon Ovar, comme dans le rapport)
  const chev = {}
  const m = (c) => (pages.get(c) && pages.get(c).mots_main) || null
  const paires = [
    ['/pt/servicos/canalizador-ovar/', '/pt/servicos/canalizador-aveiro/'],
    ['/pt/servicos/canalizador-ovar/', '/pt/servicos/eletricista-ovar/'],
    ['/pt/servicos/canalizador-ovar/', '/pt/urgencia/canalizador-urgente-ovar/'],
    ['/pt/servicos/canalizador-ovar/', '/pt/perto-de-mim/canalizador-ovar/'],
    ['/pt/perto-de-mim/canalizador-ovar/', '/pt/perto-de-mim/picheleiro-ovar/'],
  ]
  for (const [a, b] of paires) {
    if (m(a) && m(b)) chev[a + ' -> ' + b] = { a_dans_b: chevauchement(m(a), m(b)), b_dans_a: chevauchement(m(b), m(a)) }
  }

  return { options: o, date: o.date, base, sitemaps: { index: sitemaps.index, indexStatus: sitemaps.indexStatus, fichiers: Object.fromEntries(Object.entries(sitemaps.fichiers).map(([u, f]) => [u.replace(base, ''), { status: f.status, contentType: f.contentType, xRobots: f.xRobots, n: f.urls.length, enfants: f.enfants || [], sha256: f.sha256, lastmod_n: f.urls.filter((x) => x.lastmod).length, changefreq_n: f.urls.filter((x) => x.changefreq).length, priority_n: f.urls.filter((x) => x.priority).length, urls: f.urls }])) }, pages, chevauchements: chev }
}

// ───────────────────────── Synthèse ─────────────────────────

const COLONNES = ['chemin', 'groupe', 'metier', 'ville', 'hors_sitemap', 'sitemaps', 'sitemaps_n', 'lastmod_sitemap', 'derniere_modif_reelle', 'statut_http', 'url_finale', 'content_type', 'x_robots_tag', 'meta_robots', 'canonical', 'canonical_ok', 'title', 'title_len', 'title_marque_n', 'description', 'description_len', 'h1_n', 'h2_n', 'hreflang', 'og_image', 'jsonld_types', 'jsonld_address', 'jsonld_geo', 'jsonld_erreurs', 'mots_main_n', 'liens_internes_n', 'liens_profissional_n', 'liens_sans_prefixe', 'liens_sans_slash', 'liens_entrants', 'profondeur', 'modele_mesure', 'sequences_n', 'propre_modele', 'partage10_modele', 'propre_metier', 'partage10_metier', 'statut_gsc', 'derniere_exploration_gsc', 'clics_sept', 'impressions_sept', 'position_moy_sept', 'priorite']

export function lignesCsv(resultat) {
  const f = (x) => (typeof x === 'number' && !Number.isInteger(x) ? x.toFixed(4) : x)
  return [...resultat.pages.values()].map((p) => ({
    ...Object.fromEntries(COLONNES.map((c) => [c, f(p[c] ?? '')])),
    sitemaps: (p.sitemaps || []).join(' | '),
    hreflang: (p.hreflang || []).map((h) => h.lang + '=' + h.href.replace(resultat.base, '')).join(' | '),
    liens_profissional_n: (p.liens_profissional || []).length,
    liens_sans_prefixe: (p.liens_sans_prefixe || []).join(' | '),
    liens_sans_slash: (p.liens_sans_slash || []).join(' | '),
  }))
}

function ligneTableau(cellules) { return '| ' + cellules.join(' | ') + ' |' }

export function resumeMarkdown(resultat) {
  const pages = [...resultat.pages.values()]
  const L = []
  L.push('# Audit SEO PT — ' + resultat.date + ' (' + resultat.base + ')', '')
  L.push('Pages auditées : ' + pages.length + ' (dont ' + pages.filter((p) => p.hors_sitemap).length + ' hors sitemap ajoutées à la main).', '')

  L.push('## Sitemaps', '', ligneTableau(['Fichier', 'Statut', 'URL', 'lastmod', 'changefreq', 'priority', 'SHA-256']), ligneTableau(['---', '---', '---', '---', '---', '---', '---']))
  for (const [u, f] of Object.entries(resultat.sitemaps.fichiers)) L.push(ligneTableau([u, f.status, f.n, f.lastmod_n, f.changefreq_n, f.priority_n, f.sha256 ? f.sha256.slice(0, 16) + '…' : '']))
  L.push('', 'Index `/sitemap.xml` (statut ' + resultat.sitemaps.indexStatus + ') : ' + resultat.sitemaps.index.join(', '), '')
  const multi = pages.filter((p) => (p.sitemaps_n || 0) > 1)
  L.push('URL PT déclarées dans plus d\'un sitemap : ' + multi.length + ' ; URL auditées absentes de tout sitemap : ' + pages.filter((p) => !p.sitemaps_n).map((p) => p.chemin).join(', '), '')

  L.push('## Par groupe', '', ligneTableau(['Groupe', 'Pages', '200', 'index', 'canonique ok', 'mots', 'liens', 'h2', 'propre (modèle)', 'partagé 10+', 'propre (même métier, 22 villes)', 'profondeur min-max', 'entrants moy.']), ligneTableau(Array(13).fill('---')))
  const groupes = [...new Set(pages.map((p) => p.groupe))].sort()
  for (const g of groupes) {
    const l = pages.filter((p) => p.groupe === g)
    const ok = l.filter((p) => p.statut_http === 200)
    const profs = l.map((p) => p.profondeur).filter((x) => x >= 0)
    L.push(ligneTableau([g, l.length, ok.length, l.filter((p) => p.statut_http === 200 && !p.noindex && !/noindex/i.test(p.x_robots_tag || '')).length, l.filter((p) => p.canonical_ok).length,
      Math.round(moyenne(ok.map((p) => p.mots_main_n))), Math.round(moyenne(ok.map((p) => p.liens_internes_n))), moyenne(ok.map((p) => p.h2_n)).toFixed(1),
      ok.some((p) => typeof p.propre_modele === 'number') ? pct(moyenne(ok.map((p) => p.propre_modele))) : '', ok.some((p) => typeof p.partage10_modele === 'number') ? pct(moyenne(ok.map((p) => p.partage10_modele))) : '',
      ok.some((p) => typeof p.propre_metier === 'number') ? pct(moyenne(ok.map((p) => p.propre_metier))) : '',
      profs.length ? Math.min(...profs) + '-' + Math.max(...profs) : 'n.d.', moyenne(l.map((p) => p.liens_entrants)).toFixed(1)]))
  }
  L.push('')

  L.push('## Indexées et non indexées (statut GSC du CSV de référence)', '', ligneTableau(['Modèle', 'Statut GSC', 'Pages', 'mots', 'liens', 'h2', 'propre (modèle)', 'partagé 10+']), ligneTableau(Array(8).fill('---')))
  for (const g of ['servicos', 'urgencia', 'perto-de-mim', 'perto-de-mim-hub', 'cidade', 'blog']) {
    for (const s of ['indexee_deduit', 'non_indexee_explorée']) {
      const l = pages.filter((p) => p.groupe === g && p.statut_gsc === s && p.statut_http === 200)
      if (!l.length) continue
      L.push(ligneTableau([g, s, l.length, Math.round(moyenne(l.map((p) => p.mots_main_n))), Math.round(moyenne(l.map((p) => p.liens_internes_n))), moyenne(l.map((p) => p.h2_n)).toFixed(1), pct(moyenne(l.map((p) => p.propre_modele))), pct(moyenne(l.map((p) => p.partage10_modele)))]))
    }
  }
  L.push('')

  const canal = pages.filter((p) => p.groupe === 'servicos' && p.metier === 'canalizador' && typeof p.propre_metier === 'number')
  if (canal.length) L.push('Contrôle du script (attendu au 13/10/2026 : servicos canalizador, 22 villes, propre 29,7 %, partagé 10+ 67,1 %) : ' + canal.length + ' pages, propre ' + pct(moyenne(canal.map((p) => p.propre_metier))) + ' (min ' + pct(Math.min(...canal.map((p) => p.propre_metier))) + ', max ' + pct(Math.max(...canal.map((p) => p.propre_metier))) + '), partagé 10+ ' + pct(moyenne(canal.map((p) => p.partage10_metier))) + '.', '')
  if (Object.keys(resultat.chevauchements).length) {
    L.push('## Chevauchements (échantillon Ovar)', '', ligneTableau(['Comparaison', 'A dans B', 'B dans A']), ligneTableau(['---', '---', '---']))
    for (const [k, v] of Object.entries(resultat.chevauchements)) L.push(ligneTableau([k.replace(/\/pt\//g, ''), pct(v.a_dans_b), pct(v.b_dans_a)]))
    L.push('')
  }

  L.push('## Balises', '')
  const html = pages.filter((p) => p.statut_http === 200 && p.title !== undefined)
  L.push('- Titres avec la marque plus d\'une fois : ' + html.filter((p) => p.title_marque_n > 1).length + ' / ' + html.length + ' ; longueur hors 35-65 : ' + html.filter((p) => p.title_len < 35 || p.title_len > 65).length)
  L.push('- Descriptions hors 80-160 : ' + html.filter((p) => p.description_len < 80 || p.description_len > 160).length + ' ; descriptions non uniques : ' + (html.length - new Set(html.map((p) => p.description)).size))
  L.push('- Pages sans h1 unique : ' + html.filter((p) => p.h1_n !== 1).length)
  L.push('- Pages noindex : ' + html.filter((p) => p.noindex).map((p) => p.chemin).join(', '))
  L.push('- Canonique différente de l\'URL : ' + html.filter((p) => !p.canonical_ok).map((p) => p.chemin + ' -> ' + p.canonical).slice(0, 20).join(', '))
  const motifsHreflang = new Map()
  for (const p of html) { const k = p.groupe + ' : ' + (p.hreflang || []).map((h) => h.lang + '=' + h.href.replace(resultat.base, '').replace(p.chemin, '{page}')).join(', '); motifsHreflang.set(k, (motifsHreflang.get(k) || 0) + 1) }
  L.push('- Motifs hreflang (groupe : alternates) :'); for (const [k, n] of [...motifsHreflang].sort((a, b) => b[1] - a[1])) L.push('  - ' + n + ' × ' + k)
  const motifsLd = new Map()
  for (const p of html) { const k = p.groupe + ' : ' + p.jsonld_types; motifsLd.set(k, (motifsLd.get(k) || 0) + 1) }
  L.push('- Types JSON-LD (groupe : types) :'); for (const [k, n] of [...motifsLd].sort((a, b) => b[1] - a[1])) L.push('  - ' + n + ' × ' + k)
  L.push('- Pages dont le JSON-LD porte une `address` : ' + html.filter((p) => p.jsonld_address).length + ' ; un `geo` : ' + html.filter((p) => p.jsonld_geo).length + ' ; erreurs de parsing : ' + html.filter((p) => p.jsonld_erreurs).length)
  L.push('- og:image sous /api/ (bloqué par robots.txt) : ' + html.filter((p) => /\/api\//.test(p.og_image || '')).length, '')

  L.push('## Liens', '')
  const sp = new Map(); for (const p of html) for (const l of p.liens_sans_prefixe || []) sp.set(l, (sp.get(l) || 0) + 1)
  L.push('- Liens sans préfixe de langue (cible : nombre de pages) : ' + ([...sp].map(([l, n]) => l + ' (' + n + ')').join(', ') || 'aucun'))
  const ss = new Map(); for (const p of html) for (const l of p.liens_sans_slash || []) ss.set(l, (ss.get(l) || 0) + 1)
  L.push('- Liens sans barre finale : ' + ([...ss].map(([l, n]) => l + ' (' + n + ')').join(', ') || 'aucun'))
  L.push('- Pages liant une fiche /pt/profissional/ : ' + html.filter((p) => (p.liens_profissional || []).length).length)
  L.push('- Pages avec un lien /pt/pesquisar/?category= : ' + html.filter((p) => (p.liens_pesquisar_category || []).length).length)
  const orphelines = pages.filter((p) => p.chemin !== '/pt/' && !p.liens_entrants)
  L.push('- Orphelines (0 lien entrant depuis les pages auditées) : ' + orphelines.length + (orphelines.length ? ' : ' + orphelines.slice(0, 30).map((p) => p.chemin).join(', ') : ''))
  const profDist = new Map(); for (const p of pages) { const k = p.groupe + ' : profondeur ' + p.profondeur; profDist.set(k, (profDist.get(k) || 0) + 1) }
  L.push('- Profondeur depuis /pt/ (groupe : profondeur = pages) :'); for (const [k, n] of [...profDist].sort()) L.push('  - ' + k + ' = ' + n)
  const hubs = pages.filter((p) => ['hub-section', 'page-statique', 'hub-cidade', 'perto-de-mim-hub', 'cidade'].includes(p.groupe) && p.statut_http === 200).sort((a, b) => b.liens_internes_n - a.liens_internes_n)
  L.push('- Liens sortants des hubs et pages ville (10 premiers) : ' + hubs.slice(0, 10).map((p) => p.chemin + ' (' + p.liens_internes_n + ')').join(', '), '')

  const accueil = resultat.pages.get('/pt/')
  const liensAccueil = (accueil && accueil.liens_internes_distincts) || []
  const villesDansAccueil = liensAccueil.filter((l) => /^\/pt\/cidade\/[^/]+\/$/.test(l)).length
  const hubsDansAccueil = liensAccueil.filter((l) => /^\/pt\/perto-de-mim\/[^/]+\/$/.test(l) && !VILLES.some((v) => l.endsWith('-' + v + '/'))).length
  L.push('Accueil `/pt/` : ' + villesDansAccueil + ' pages ville liées sur 22, ' + hubsDansAccueil + ' hubs métier liés sur 22.', '')
  return L.join('\n')
}

async function principal() {
  const o = lireArguments(process.argv.slice(2))
  const journal = o.silencieux ? () => {} : (m) => process.stderr.write(m + '\n')
  const debut = Date.now()
  const res = await auditer(o, journal)
  const dossier = absolu(o.out)
  mkdirSync(dossier, { recursive: true })
  const prefixe = path.join(dossier, 'pt-audit-' + o.date)
  writeFileSync(prefixe + '.csv', '﻿' + ecrireCsv(lignesCsv(res), [...COLONNES]), 'utf8')
  const json = { ...res, pages: [...res.pages.values()].map((p) => ({ ...p, mots_main: undefined, h2: undefined })) }
  writeFileSync(prefixe + '.json', JSON.stringify(json), 'utf8')
  writeFileSync(prefixe + '-resume.md', resumeMarkdown(res), 'utf8')
  journal('Écrit : ' + prefixe + '.csv, .json, -resume.md en ' + Math.round((Date.now() - debut) / 1000) + ' s')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(e); process.exit(1) })
}
