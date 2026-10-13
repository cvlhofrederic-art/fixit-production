// Lecture des sitemaps en ligne (index + enfants) et inventaire des URL PT.
import { createHash } from 'node:crypto'
import { requete } from './http.mjs'
import { ORIGINE_PUBLIQUE, estInterne } from './html.mjs'

export const sha256 = (s) => createHash('sha256').update(s).digest('hex')

export function lireUrlset(xml) {
  return [...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const b = m[1]
    const g = (tag) => { const x = b.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>')); return x ? x[1].trim() : '' }
    return { loc: g('loc'), lastmod: g('lastmod'), changefreq: g('changefreq'), priority: g('priority') }
  })
}

export function lireIndex(xml) {
  return [...String(xml).matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)].map((m) => {
    const x = m[1].match(/<loc>([^<]*)<\/loc>/)
    return x ? x[1].trim() : ''
  }).filter(Boolean)
}

/**
 * Charge l'index et tous ses enfants. Renvoie :
 * { index: [urls], fichiers: { [url]: { status, xml, urls:[{loc,lastmod,...}], sha256 } }, parUrl: Map(chemin -> { sitemaps:[], lastmod, ... }) }
 */
export async function chargerSitemaps(base = ORIGINE_PUBLIQUE, { enfantsSupplementaires = [] } = {}) {
  // Les <loc> portent l'origine publique (https://vitfix.io) même sur un build local : on ne garde que
  // le chemin et on lit chaque fichier sur `base`.
  const versChemin = (u) => {
    if (typeof u !== 'string') return null
    if (u.startsWith('/')) return u
    try { const x = new URL(u); return estInterne(x, base) ? x.pathname : null } catch { return null }
  }
  const idx = await requete(base + '/sitemap.xml')
  const index = idx.status === 200 ? lireIndex(idx.body).map(versChemin).filter(Boolean) : []
  const fichiers = {}
  const liste = [...new Set([...index, ...enfantsSupplementaires.map(versChemin).filter(Boolean)])]
  for (const chemin of liste) {
    const u = base + chemin
    const r = await requete(u)
    // enfants : non vide quand le fichier est lui-même un index (/pt/sitemap.xml depuis la phase 1).
    fichiers[u] = { status: r.status, contentType: r.headers['content-type'] || '', xRobots: r.headers['x-robots-tag'] || '', xml: r.body, urls: r.status === 200 ? lireUrlset(r.body) : [], enfants: r.status === 200 ? lireIndex(r.body).map(versChemin).filter(Boolean) : [], sha256: r.status === 200 ? sha256(r.body) : '' }
  }
  const parUrl = new Map()
  for (const [fichier, f] of Object.entries(fichiers)) {
    for (const e of f.urls) {
      let chemin
      try { const u = new URL(e.loc); if (!estInterne(u, base)) continue; chemin = u.pathname } catch { continue }
      const entree = parUrl.get(chemin) || { chemin, sitemaps: [], lastmod: '', changefreq: '', priority: '' }
      entree.sitemaps.push(fichier.replace(base, ''))
      if (e.lastmod) entree.lastmod = e.lastmod
      if (e.changefreq) entree.changefreq = e.changefreq
      if (e.priority) entree.priority = e.priority
      parUrl.set(chemin, entree)
    }
  }
  return { index, indexStatus: idx.status, indexSha256: idx.status === 200 ? sha256(idx.body) : '', fichiers, parUrl }
}

export function urlsPt(parUrl) {
  return [...parUrl.values()].filter((e) => e.chemin.startsWith('/pt/'))
}
