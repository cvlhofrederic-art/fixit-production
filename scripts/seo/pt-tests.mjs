#!/usr/bin/env node
// Tests automatiques T1 à T12 du plan SEO PT (instructions du 13/10/2026, section 7).
// À lancer contre la production (ou un déploiement) à chaque PR et après mise en production.
//
// Usage :
//   node scripts/seo/pt-tests.mjs [--base https://vitfix.io] [--mode reference|controle]
//        [--reference data/seo/reference-seo-pt.json] [--tests T1,T3] [--audit reports/seo/pt-audit-AAAA-MM-JJ.json]
//        [--out reports/seo] [--redirections data/seo/pt-redirects.csv] [--porte data/seo/porte-qualite.json]
//        [--lot fichier.txt] [--echantillon N] [--concurrence 8]
//
// Mode `reference` : enregistre la référence (empreintes des sitemaps FR, échantillon FR pour T9,
//   règles robots hors PT) et produit l'état des lieux ; code de sortie 0 même en cas d'écart.
// Mode `controle` : compare à la référence ; code de sortie 1 si un test échoue (porte de PR).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requete, suivre, enParallele, urlInterne } from './pt-audit/lib/http.mjs'
import { analyserHtml, normaliserLien, ORIGINE_PUBLIQUE } from './pt-audit/lib/html.mjs'
import { lireUrlset } from './pt-audit/lib/sitemaps.mjs'
import { classer, VILLES, METIERS_PERTO } from './pt-audit/lib/classer.mjs'
import { lireCsv } from './pt-audit/lib/csv.mjs'
import { lireRobots, autorise, reglesHorsPt } from './pt-audit/lib/robots.mjs'
import { auditer } from './pt-audit/index.mjs'
import { dossierSortie, fabriquerAbsolu, ErreurChemin } from './pt-audit/lib/chemins.mjs'

function lireArguments(argv) {
  const o = { base: 'https://vitfix.io', mode: 'controle', reference: 'data/seo/reference-seo-pt.json', tests: [], audit: '', out: 'reports/seo', redirections: 'data/seo/pt-redirects.csv', porte: 'data/seo/porte-qualite.json', lot: '', echantillon: 0, concurrence: 8, date: new Date().toISOString().slice(0, 10) }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => argv[++i]
    if (a === '--base') o.base = val().replace(/\/$/, '')
    else if (a === '--mode') o.mode = val()
    else if (a === '--reference') o.reference = val()
    else if (a === '--tests') o.tests = val().split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    else if (a === '--audit') o.audit = val()
    else if (a === '--out') o.out = val()
    else if (a === '--redirections') o.redirections = val()
    else if (a === '--porte') o.porte = val()
    else if (a === '--lot') o.lot = val()
    else if (a === '--echantillon') o.echantillon = Number(val())
    else if (a === '--concurrence') o.concurrence = Number(val())
    else if (a === '--date') o.date = val()
  }
  return o
}

/** Générateur pseudo-aléatoire déterministe (même échantillon d'un passage à l'autre). */
function aleatoire(graine) {
  let s = graine >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const estIndexable = (p) => p.statut_http === 200 && !p.noindex && !/noindex/i.test(p.x_robots_tag || '')

class Resultats {
  constructor() { this.tests = [] }
  ajouter(id, libelle, anomalies, { nonApplicable = false, details = [] } = {}) {
    this.tests.push({ id, libelle, resultat: nonApplicable ? 'N/A' : (anomalies === 0 ? 'OK' : 'ÉCHEC'), anomalies, details })
  }
  get echecs() { return this.tests.filter((t) => t.resultat === 'ÉCHEC') }
}

// Cache de statut HTTP des cibles de liens (GET sans suivre, puis suivi pour la finale)
function fabriquerVerificateurCibles(base, concurrence) {
  const cache = new Map()
  return async (chemins) => {
    const aFaire = [...new Set(chemins)].filter((c) => !cache.has(c))
    await enParallele(aFaire.map((c) => async () => {
      const r = await requete(urlInterne(base, c), { lireCorps: false })
      cache.set(c, { status: r.status, location: r.location })
    }), concurrence)
    return cache
  }
}

/** Lit un JSON s'il existe ; un fichier absent vaut null. Pas de contrôle préalable (existsSync) : le même
 *  chemin est réécrit en mode référence, et un contrôle-puis-usage est signalé par CodeQL (js/file-system-race). */
function lireJsonOptionnel(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'))
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
}

async function principal() {
  const o = lireArguments(process.argv.slice(2))
  const base = o.base
  // Fichiers lus (--reference, --audit, --redirections, --porte, --lot) : dans le dépôt ou dans le dossier --out,
  // erreur explicite sinon (lot 7 du brief Aikido du 28/10/2026, issue 9 ; voir fabriquerAbsolu)
  const absolu = fabriquerAbsolu(o.out)
  const journal = (m) => process.stderr.write(m + '\n')
  const veut = (id) => !o.tests.length || o.tests.includes(id)
  const R = new Resultats()
  const cheminReference = absolu(o.reference, '--reference')
  const reference = lireJsonOptionnel(cheminReference) // sans existsSync : le fichier est réécrit plus bas (CodeQL js/file-system-race)
  const nouvelleReference = { date: o.date, base }

  // Données d'audit (téléchargement des pages PT) : réutilisées par T1, T2, T3, T4, T5, T6, T7, T10, T11
  let audit
  if (o.audit && existsSync(absolu(o.audit, '--audit'))) {
    journal('Audit lu depuis ' + o.audit)
    const j = JSON.parse(readFileSync(absolu(o.audit, '--audit'), 'utf8'))
    audit = { ...j, pages: new Map(j.pages.map((p) => [p.chemin, p])) }
  } else {
    audit = await auditer({ base, echantillon: o.echantillon, concurrence: o.concurrence }, journal)
  }
  const pages = [...audit.pages.values()]
  const pagesHtml = pages.filter((p) => p.statut_http === 200 && p.title !== undefined)
  const dansSitemap = pages.filter((p) => p.sitemaps_n > 0)

  // T1
  if (veut('T1')) {
    const details = []
    for (const p of dansSitemap) {
      const pb = []
      if (p.statut_http !== 200) pb.push('statut ' + p.statut_http)
      if (p.noindex) pb.push('meta noindex')
      if (/noindex/i.test(p.x_robots_tag || '')) pb.push('X-Robots-Tag ' + p.x_robots_tag)
      if (p.statut_http === 200 && !p.canonical_ok) pb.push('canonique ' + p.canonical)
      if (p.statut_http === 200 && !/html/i.test(p.content_type)) pb.push('type ' + p.content_type)
      if (pb.length) details.push(p.chemin + ' : ' + pb.join(', '))
    }
    R.ajouter('T1', 'URL des sitemaps PT : 200, index, canonique = URL, HTML', details.length, { details })
  }

  // T2
  if (veut('T2')) {
    const details = []
    const maintenant = Date.now()
    for (const p of dansSitemap) {
      if (p.sitemaps_n !== 1) details.push(p.chemin + ' : dans ' + p.sitemaps_n + ' sitemaps (' + p.sitemaps.join(', ') + ')')
      if (!estIndexable(p)) details.push(p.chemin + ' : dans un sitemap mais ' + (p.statut_http !== 200 ? 'statut ' + p.statut_http : 'noindex'))
      if (p.lastmod_sitemap) {
        const d = new Date(p.lastmod_sitemap)
        if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(p.lastmod_sitemap)) details.push(p.chemin + ' : lastmod non ISO « ' + p.lastmod_sitemap + ' »')
        else if (d.getTime() > maintenant) details.push(p.chemin + ' : lastmod dans le futur ' + p.lastmod_sitemap)
      }
      if (p.changefreq || p.priority) details.push(p.chemin + ' : changefreq/priority présents')
    }
    // Phase 1 : les URL PT sont dans /pt/sitemap-*.xml (un fichier par modèle), référencés par /sitemap.xml ;
    // /pt/sitemap.xml est l'index de ces mêmes fichiers (propriété GSC /pt/) ; /sitemap/1.xml répond 410.
    const fichiersPt = Object.keys(audit.sitemaps.fichiers).filter((u) => /^\/pt\/sitemap-[a-z-]+\.xml$/.test(u))
    if (fichiersPt.length === 0) details.push('index : aucun fichier /pt/sitemap-*.xml chargé')
    for (const u of fichiersPt) if (!audit.sitemaps.index.includes(u)) details.push('index : enfant PT non référencé ' + u)
    const indexPt = audit.sitemaps.fichiers['/pt/sitemap.xml']
    if (!indexPt || indexPt.status !== 200) details.push('/pt/sitemap.xml : statut ' + (indexPt ? indexPt.status : 'absent'))
    else {
      const enfants = (indexPt.enfants || []).map((u) => u.replace(base, '')).sort()
      const attendus = audit.sitemaps.index.filter((u) => u.startsWith('/pt/sitemap-')).sort()
      if (JSON.stringify(enfants) !== JSON.stringify(attendus)) details.push('/pt/sitemap.xml : enfants ' + (enfants.join(', ') || 'aucun') + ' ≠ fichiers PT de /sitemap.xml ' + attendus.join(', '))
      if (indexPt.n > 0) details.push('/pt/sitemap.xml : contient encore ' + indexPt.n + ' <url> (doit être un index)')
    }
    if (audit.sitemaps.index.includes('/sitemap/1.xml')) details.push('index : /sitemap/1.xml (ancien sous-sitemap PT) encore référencé')
    const ancienPt = audit.sitemaps.fichiers['/sitemap/1.xml']
    if (ancienPt && ancienPt.status !== 410) details.push('/sitemap/1.xml : statut ' + ancienPt.status + ' au lieu de 410')
    for (const u of ['/sitemap/2.xml', '/sitemap/3.xml']) {
      const f = audit.sitemaps.fichiers[u]
      if (!f || f.status !== 200) { details.push(u + ' : statut ' + (f ? f.status : 'absent')); continue }
      nouvelleReference['sha256_' + u] = f.sha256
      if (reference && reference['sha256_' + u] && reference['sha256_' + u] !== f.sha256) details.push(u + ' : empreinte modifiée (' + f.sha256.slice(0, 12) + ' ≠ référence ' + reference['sha256_' + u].slice(0, 12) + ')')
    }
    R.ajouter('T2', 'Sitemaps PT : 1 fichier par URL, 0 noindex/3xx/4xx, lastmod ISO, 0 priority/changefreq, enfants référencés, FR intacts', details.length, { details })
  }

  const verifierCibles = fabriquerVerificateurCibles(base, o.concurrence)

  // T3
  if (veut('T3')) {
    const details = []
    const sources = new Map()
    const cibles = new Set()
    for (const p of pagesHtml) {
      for (const c of p.liens_internes_distincts || []) { cibles.add(c); if (!sources.has(c)) sources.set(c, []); sources.get(c).push(p.chemin) }
      for (const l of p.liens_sans_prefixe || []) details.push(p.chemin + ' : lien sans préfixe de langue ' + l)
      for (const l of p.liens_sans_slash || []) details.push(p.chemin + ' : lien sans barre finale ' + l)
    }
    journal('T3 : vérification de ' + cibles.size + ' cibles de liens')
    const cache = await verifierCibles([...cibles])
    for (const c of [...cibles].sort()) {
      const s = cache.get(c)
      if (!s || s.status !== 200) details.push(c + ' : ' + (s ? s.status + (s.location ? ' -> ' + s.location : '') : 'injoignable') + ' (lié depuis ' + sources.get(c).length + ' pages, ex. ' + sources.get(c).slice(0, 2).join(', ') + ')')
    }
    R.ajouter('T3', 'Crawl interne : 0 lien vers 3xx/4xx/5xx, 0 lien sans préfixe, 0 lien sans barre finale', details.length, { details })
  }

  // T4
  if (veut('T4')) {
    const details = []
    // Une page précise (métier x ville, article) ne doit pas pointer vers un accueil ou un hub ; un hub ou une
    // page statique peut pointer vers son équivalent FR (hub vers hub), d'où les hubs PT dans la liste.
    const GENERIQUES = new Set(['/', '/fr/', '/en/', '/es/', '/nl/', '/pt/', '/fr/services/', '/fr/urgence/', '/fr/blog/', '/fr/contact/', '/pt/servicos/', '/pt/urgencia/', '/pt/blog/', '/pt/contacto/'])
    const cibles = new Map()
    for (const p of pagesHtml) for (const h of p.hreflang || []) { const c = normaliserLien(h.href, base) || h.href; if (!cibles.has(c)) cibles.set(c, null) }
    journal('T4 : lecture de ' + cibles.size + ' cibles hreflang')
    await enParallele([...cibles.keys()].map((c) => async () => {
      // Une alternate vers un autre hôte n'est pas suivie : elle est comptée comme injoignable.
      let url
      try { url = urlInterne(base, c.startsWith('http') ? new URL(c).pathname : c) } catch { cibles.set(c, { status: 0, hreflang: [] }); return }
      const r = await requete(url)
      cibles.set(c, { status: r.status, hreflang: r.status === 200 ? analyserHtml(r.body, { base }).hreflang.map((h) => normaliserLien(h.href, base) || h.href) : [] })
    }), o.concurrence)
    for (const p of pagesHtml) {
      for (const h of p.hreflang || []) {
        const c = normaliserLien(h.href, base) || h.href
        const t = cibles.get(c)
        if (c === p.chemin) continue
        if (!t || t.status !== 200) { details.push(p.chemin + ' : alternate ' + h.lang + ' -> ' + c + ' répond ' + (t ? t.status : '?')); continue }
        if (GENERIQUES.has(c) && !GENERIQUES.has(p.chemin)) details.push(p.chemin + ' : alternate ' + h.lang + ' vers une page générique ' + c)
        if (!t.hreflang.includes(p.chemin)) details.push(p.chemin + ' : alternate ' + h.lang + ' -> ' + c + ' ne renvoie pas vers la page')
      }
    }
    R.ajouter('T4', 'hreflang : alternates 200, réciproques, non génériques ; x-default 200', details.length, { details })
  }

  // Échantillon commun T5 / T11 : 1 page par groupe + 20 au hasard (déterministe)
  const alea = aleatoire(13102026)
  const parGroupe = new Map()
  for (const p of pagesHtml) if (!parGroupe.has(p.groupe)) parGroupe.set(p.groupe, p)
  const echantillon = [...parGroupe.values()]
  const reste = pagesHtml.filter((p) => !echantillon.includes(p))
  for (let i = 0; i < 20 && reste.length; i++) echantillon.push(reste.splice(Math.floor(alea() * reste.length), 1)[0])

  // T5
  if (veut('T5')) {
    const details = []
    const GRILLE = new Set(['servicos', 'servicos-distrito', 'servicos-distrito-concelho', 'servicos-concelho', 'urgencia', 'perto-de-mim', 'cidade', 'perto-de-mim-hub'])
    const SEDE_LOCALIDADE = 'marco de canaveses' // addressLocality du siège (lib/seo/entite-pt.ts)
    for (const p of echantillon) {
      const noeuds = (p.jsonld && p.jsonld.noeuds) || []
      if (p.jsonld && p.jsonld.erreurs) details.push(p.chemin + ' : JSON-LD invalide (' + p.jsonld.erreurs + ')')
      if (noeuds.some((n) => /FAQPage/.test(n.type))) details.push(p.chemin + ' : FAQPage présent')
      if (noeuds.some((n) => /HowTo/.test(n.type))) details.push(p.chemin + ' : HowTo présent')
      const entreprises = noeuds.filter((n) => /HomeAndConstructionBusiness|LocalBusiness|EmergencyService|^Organization/.test(n.type))
      // Le seul nœud entreprise admis est celui du siège (lib/seo/entite-pt.ts) : tout autre LocalBusiness,
      // EmergencyService ou nœud adressé dans une autre ville est un « établissement » inventé.
      const parVille = entreprises.filter((n) => !/HomeAndConstructionBusiness|^Organization/.test(n.type) || (n.address_locality && n.address_locality.toLowerCase() !== SEDE_LOCALIDADE))
      if (GRILLE.has(p.groupe) && parVille.length) details.push(p.chemin + ' : nœud entreprise par ville (' + parVille.map((n) => n.type).join(', ') + ')')
      const siege = entreprises.filter((n) => n.address)
      if (siege.length !== 1) details.push(p.chemin + ' : ' + siege.length + ' nœud(s) entreprise avec address (attendu 1)')
      if (['servicos', 'servicos-distrito', 'servicos-distrito-concelho', 'servicos-concelho', 'urgencia', 'perto-de-mim'].includes(p.groupe)) {
        const service = noeuds.find((n) => /^Service$/.test(n.type))
        if (!service) details.push(p.chemin + ' : nœud Service absent')
        else if (!service.provider || !service.areaServed) details.push(p.chemin + ' : Service sans provider ou areaServed')
      }
      const fil = noeuds.find((n) => n.type === 'BreadcrumbList')
      if (!fil) details.push(p.chemin + ' : BreadcrumbList absent')
      else {
        const liens = new Set(p.liens_internes_distincts || [])
        for (const c of fil.crumbs) { const n = normaliserLien(c, base); if (n && n !== p.chemin && !liens.has(n)) details.push(p.chemin + ' : fil d\'Ariane ' + n + ' sans lien visible') }
      }
      if (noeuds.some((n) => n.aggregateRating || n.review)) details.push(p.chemin + ' : aggregateRating/review auto-attribué')
    }
    R.ajouter('T5', 'JSON-LD (1 page par modèle + 20) : valide, 0 FAQPage/HowTo, 0 LocalBusiness par ville, 1 nœud entreprise avec address, Service sur la grille, BreadcrumbList cohérent', details.length, { details })
  }

  // T6
  if (veut('T6')) {
    const details = []
    const descriptions = new Map()
    for (const p of pagesHtml) {
      if (p.title_marque_n > 1) details.push(p.chemin + ' : marque ' + p.title_marque_n + ' fois dans le title')
      if (p.title_len < 35 || p.title_len > 65) details.push(p.chemin + ' : title ' + p.title_len + ' caractères')
      if (p.description_len < 80 || p.description_len > 160) details.push(p.chemin + ' : description ' + p.description_len + ' caractères')
      if (p.h1_n !== 1) details.push(p.chemin + ' : ' + p.h1_n + ' h1')
      if (!descriptions.has(p.description)) descriptions.set(p.description, [])
      descriptions.get(p.description).push(p.chemin)
    }
    for (const [d, l] of descriptions) if (l.length > 1 && d) details.push('description partagée par ' + l.length + ' pages : ' + l.slice(0, 3).join(', '))
    R.ajouter('T6', 'title (marque une fois, 35-65), description (80-160, unique), 1 h1', details.length, { details })
  }

  // T7
  if (veut('T7')) {
    const details = []
    const conservees = dansSitemap.filter((p) => estIndexable(p))
    for (const p of conservees) {
      if (p.profondeur < 0) details.push(p.chemin + ' : injoignable depuis /pt/')
      else if (p.profondeur > 3) details.push(p.chemin + ' : profondeur ' + p.profondeur)
      if (p.chemin !== '/pt/' && !p.liens_entrants) details.push(p.chemin + ' : orpheline')
    }
    const chemins = new Set(pages.map((p) => p.chemin))
    for (const ville of pages.filter((p) => p.groupe === 'cidade' && p.statut_http === 200)) {
      const liens = new Set(ville.liens_internes_distincts || [])
      const attendues = [...chemins].filter((c) => ['servicos', 'servicos-concelho'].includes(classer(c).groupe) && classer(c).ville === ville.ville)
      const manquantes = attendues.filter((c) => !liens.has(c))
      if (manquantes.length) details.push(ville.chemin + ' : ' + manquantes.length + '/' + attendues.length + ' pages métier de la ville non liées (ex. ' + manquantes.slice(0, 2).join(', ') + ')')
    }
    for (const hub of pages.filter((p) => p.groupe === 'perto-de-mim-hub' && p.statut_http === 200)) {
      const liens = new Set(hub.liens_internes_distincts || [])
      const m = hub.metier === 'picheleiro' ? 'canalizador' : hub.metier
      const villesLiees = VILLES.filter((v) => liens.has('/pt/servicos/' + m + '-' + v + '/') || liens.has('/pt/perto-de-mim/' + hub.metier + '-' + v + '/'))
      if (villesLiees.length < 22) details.push(hub.chemin + ' : ' + villesLiees.length + '/22 villes liées')
    }
    R.ajouter('T7', 'Graphe : profondeur ≤ 3, 0 orpheline, pages ville -> pages métier, hubs métier -> 22 villes', details.length, { details })
  }

  // T8
  if (veut('T8')) {
    const fichier = absolu(o.redirections, '--redirections')
    if (!existsSync(fichier)) R.ajouter('T8', 'Table de redirection (phase 2)', 0, { nonApplicable: true, details: ['fichier absent : ' + o.redirections] })
    else {
      const details = []
      const lignes = lireCsv(readFileSync(fichier, 'utf8'))
      const sources = new Set(lignes.map((l) => l.source))
      const gscRef = existsSync(absolu('data/seo/pt_sitemap_statut_complet.csv')) ? new Map(lireCsv(readFileSync(absolu('data/seo/pt_sitemap_statut_complet.csv'), 'utf8')).map((l) => [l.chemin, l])) : new Map()
      const res = await enParallele(lignes.map((l) => async () => {
        const r = await requete(urlInterne(base, l.source), { lireCorps: false })
        const d = await suivre(urlInterne(base, l.destination))
        const html = d.status === 200 ? analyserHtml(d.reponse.body, { base }) : null
        return { l, r, d, html }
      }), o.concurrence)
      for (const { l, r, d, html } of res.filter(Boolean)) {
        const codeAttendu = Number(l.code || 301)
        if (!(r.status === codeAttendu || (codeAttendu === 301 && r.status === 308))) details.push(l.source + ' : statut ' + r.status + ' (attendu ' + codeAttendu + ')')
        const cible = r.location ? normaliserLien(r.location, base) : ''
        if (cible !== l.destination) details.push(l.source + ' : Location ' + (r.location || '(vide)') + ' ≠ ' + l.destination)
        if (sources.has(l.destination)) details.push(l.source + ' : chaîne, la destination ' + l.destination + ' est aussi une source')
        if (l.destination === l.source) details.push(l.source + ' : boucle')
        if (d.status !== 200 || d.sauts.length > 1) details.push(l.destination + ' : destination ' + d.status + ' en ' + d.sauts.length + ' saut(s)')
        else if (!html || html.noindex || !(html.canonical === base + l.destination || html.canonical === ORIGINE_PUBLIQUE + l.destination)) details.push(l.destination + ' : destination non indexable ou canonique ' + (html ? html.canonical : '?'))
        const g = gscRef.get(l.source)
        if (g && g.priorite === 'PROTEGER' && !(l.decision || '').trim()) details.push(l.source + ' : URL PROTEGER sans décision écrite (colonne decision)')
      }
      R.ajouter('T8', 'Table de redirection : 301 en un saut vers une destination 200 index, 0 chaîne, 0 boucle, PROTEGER avec décision', details.length, { details })
    }
  }

  // T9
  if (veut('T9')) {
    const details = []
    const f = audit.sitemaps.fichiers['/sitemap/2.xml']
    if (!f || f.status !== 200) R.ajouter('T9', 'Non-régression FR', 1, { details: ['/sitemap/2.xml injoignable'] })
    else {
      // <loc> sur l'origine publique, même sur un build local : on ne garde que le chemin.
      const locs = (f.urls || lireUrlset(f.xml || '')).map((u) => normaliserLien(u.loc, base) || u.loc)
      const pas = Math.max(1, Math.floor(locs.length / 30))
      const choisies = locs.filter((_, i) => i % pas === 0).slice(0, 30)
      const mesures = {}
      await enParallele(choisies.map((c) => async () => {
        const r = await requete(urlInterne(base, c))
        const a = r.status === 200 ? analyserHtml(r.body, { base }) : null
        mesures[c] = { status: r.status, canonical: a ? a.canonical : '', title: a ? a.title : '', hreflang: a ? a.hreflang.map((h) => h.lang + '=' + h.href).sort() : [] }
      }), o.concurrence)
      nouvelleReference.fr = mesures
      nouvelleReference['sha256_/sitemap/2.xml'] = f.sha256
      if (reference && reference.fr) {
        for (const [c, m] of Object.entries(mesures)) {
          const ref = reference.fr[c]
          if (!ref) { details.push(c + ' : absente de la référence'); continue }
          for (const k of ['status', 'canonical', 'title']) if (ref[k] !== m[k]) details.push(c + ' : ' + k + ' « ' + ref[k] + ' » -> « ' + m[k] + ' »')
          if (JSON.stringify(ref.hreflang) !== JSON.stringify(m.hreflang)) details.push(c + ' : hreflang modifié')
        }
        if (reference['sha256_/sitemap/2.xml'] && reference['sha256_/sitemap/2.xml'] !== f.sha256) details.push('/sitemap/2.xml : empreinte modifiée')
      } else if (o.mode === 'controle') details.push('aucune référence FR : lancer d\'abord --mode reference')
      R.ajouter('T9', 'Non-régression FR : 30 URL de /sitemap/2.xml (statut, canonique, title, hreflang) et empreinte du sitemap', details.length, { details })
    }
  }

  // T10
  if (veut('T10')) {
    const fichier = absolu(o.porte, '--porte')
    if (!existsSync(fichier)) R.ajouter('T10', 'Porte de qualité (phase 3)', 0, { nonApplicable: true, details: ['configuration absente : ' + o.porte] })
    else {
      const details = []
      const porte = JSON.parse(readFileSync(fichier, 'utf8'))
      const lot = o.lot && existsSync(absolu(o.lot, '--lot')) ? new Set(readFileSync(absolu(o.lot, '--lot'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) : null
      const cibles = pagesHtml.filter((p) => porte[p.groupe] && (!lot || lot.has(p.chemin)))
      const nomsVilles = VILLES.map((v) => v.replace(/-/g, ' '))
      await enParallele(cibles.map((p) => async () => {
        const regle = porte[p.groupe]
        const r = await requete(urlInterne(base, p.chemin))
        const html = r.body || ''
        for (const s of regle.sections || []) if (!new RegExp('id\\s*=\\s*["\']' + s + '["\']').test(html)) details.push(p.chemin + ' : section #' + s + ' absente')
        const propre = p.groupe === 'cidade' ? p.propre_modele : p.propre_modele
        if (typeof propre === 'number' && propre < (regle.propre_min ?? 0.3)) details.push(p.chemin + ' : séquences propres ' + (100 * propre).toFixed(1) + ' % < ' + (100 * (regle.propre_min ?? 0.3)).toFixed(0) + ' %')
        const texte = (analyserHtml(html, { base }).texte_main || '').toLowerCase()
        const villesCitees = nomsVilles.filter((v) => texte.includes(v)).length
        if (villesCitees >= (regle.villes_max ?? 8)) details.push(p.chemin + ' : ' + villesCitees + ' villes citées dans le texte (bloc de villes interdit)')
      }), o.concurrence)
      R.ajouter('T10', 'Porte de qualité : sections obligatoires, séquences propres, 0 bloc de villes', details.length, { details })
    }
  }

  // T11
  if (veut('T11')) {
    const details = []
    const r = await requete(base + '/robots.txt')
    if (r.status !== 200) details.push('robots.txt : statut ' + r.status)
    else {
      const groupes = lireRobots(r.body)
      if (!autorise(groupes, '/pt/servicos/canalizador-ovar/')) details.push('/pt/servicos/canalizador-ovar/ bloqué par robots.txt')
      for (const p of echantillon.slice(0, 5)) {
        if (!p.og_image) { details.push(p.chemin + ' : pas d\'og:image'); continue }
        let chemin
        try { chemin = new URL(p.og_image, base).pathname + new URL(p.og_image, base).search } catch { chemin = p.og_image }
        if (!autorise(groupes, chemin)) details.push(p.chemin + ' : og:image bloquée ' + chemin)
      }
      const horsPt = reglesHorsPt(groupes)
      nouvelleReference.robots_hors_pt = horsPt
      if (reference && reference.robots_hors_pt && JSON.stringify(reference.robots_hors_pt) !== JSON.stringify(horsPt)) details.push('règles robots.txt hors PT modifiées')
    }
    R.ajouter('T11', 'robots.txt : pages PT autorisées, og:image non bloquée, règles hors PT inchangées', details.length, { details })
  }

  // T12
  if (veut('T12')) {
    const details = []
    for (const chemin of ['/pt/vitfix-seo-test-inexistant-404/', '/vitfix-seo-test-inexistant-404', '/pt/servicos/metier-inexistant-ovar/']) {
      const s = await suivre(base + chemin)
      const html = s.reponse && s.reponse.body ? analyserHtml(s.reponse.body, { base }) : null
      if (s.status !== 404) details.push(chemin + ' : statut final ' + s.status + ' (' + s.finale.replace(base, '') + ')')
      else if (!html || !html.noindex) details.push(chemin + ' : 404 sans noindex')
      if (s.finale.replace(base, '') === '/pt/') details.push(chemin + ' : redirigé vers /pt/')
    }
    R.ajouter('T12', '404 : chemin inconnu sous /pt/ et sans préfixe -> 404 noindex, jamais /pt/', details.length, { details })
  }

  // Sorties
  const dossier = dossierSortie(o.out) // seulement écrit : peut être hors du dépôt (README : --out /tmp/seo)
  mkdirSync(dossier, { recursive: true })
  const L = ['# Tests SEO PT T1-T12 — ' + o.date + ' (' + base + ', mode ' + o.mode + ')', '', '| Test | Résultat | Anomalies | Libellé |', '|---|---|---|---|']
  for (const t of R.tests) L.push('| ' + t.id + ' | ' + t.resultat + ' | ' + t.anomalies + ' | ' + t.libelle + ' |')
  L.push('')
  for (const t of R.tests) {
    if (!t.details.length) continue
    L.push('## ' + t.id + ' (' + t.details.length + ')', '')
    for (const d of t.details.slice(0, 60)) L.push('- ' + d)
    if (t.details.length > 60) L.push('- … ' + (t.details.length - 60) + ' autres (voir le JSON)')
    L.push('')
  }
  const prefixe = path.join(dossier, 'pt-tests-' + o.date)
  writeFileSync(prefixe + '.md', L.join('\n'), 'utf8')
  writeFileSync(prefixe + '.json', JSON.stringify({ date: o.date, base, mode: o.mode, tests: R.tests }, null, 1), 'utf8')
  if (o.mode === 'reference') {
    mkdirSync(path.dirname(cheminReference), { recursive: true })
    writeFileSync(cheminReference, JSON.stringify({ ...(reference || {}), ...nouvelleReference }, null, 1), 'utf8')
    journal('Référence écrite : ' + o.reference)
  }
  for (const t of R.tests) journal(t.id + ' ' + t.resultat + ' (' + t.anomalies + ')')
  journal('Rapport : ' + prefixe + '.md')
  if (o.mode === 'controle' && R.echecs.length) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => {
    // Chemin refusé (ErreurChemin) : le message seul, la pile d'appels n'aiderait pas l'utilisateur du CLI
    console.error(e instanceof ErreurChemin ? '[pt-tests] ' + e.message : e)
    process.exit(1)
  })
}
