// Analyse HTML par expressions régulières (pages générées par Next.js, HTML
// propre et prévisible) : titre, meta, canonique, hreflang, JSON-LD, h1/h2,
// texte de <main>, liens. Aucune dépendance.

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', atilde: 'ã', otilde: 'õ', ecirc: 'ê', ocirc: 'ô', acirc: 'â', iacute: 'í', oacute: 'ó', uacute: 'ú', aacute: 'á', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', euro: '€' }

export function decoderEntites(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITES[n.toLowerCase()] !== undefined ? ENTITES[n.toLowerCase()] : m))
}

function attribut(balise, nom) {
  const m = balise.match(new RegExp('\\s' + nom + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'))
  if (!m) return null
  return decoderEntites(m[2] ?? m[3] ?? m[4] ?? '')
}

function balises(html, nom) {
  return [...html.matchAll(new RegExp('<' + nom + '\\b[^>]*>', 'gi'))].map((m) => m[0])
}

function texteSansBalises(fragment) {
  return decoderEntites(
    fragment
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim()
}

/** Mots alphanumériques en minuscules (même définition que le rapport du 13/10/2026). */
export function mots(texte) {
  return String(texte || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
}

const PROTOCOLES_IGNORES = /^(mailto:|tel:|javascript:|sms:|whatsapp:|#)/i
const PREFIXE_LANGUE = /^\/(pt|fr|en|es|nl)(\/|$)/
const EXTENSION_FICHIER = /\.[a-z0-9]{2,5}$/i

/** Normalise un href interne : chemin seul, barre finale, sans paramètres ni ancre. */
export function normaliserLien(href, base = 'https://vitfix.io') {
  if (!href) return null
  const h = decoderEntites(href).trim()
  if (PROTOCOLES_IGNORES.test(h)) return null
  let u
  try { u = new URL(h, base) } catch { return null }
  const origine = new URL(base).origin
  if (u.origin !== origine) return null
  let chemin = u.pathname
  if (!chemin.endsWith('/') && !EXTENSION_FICHIER.test(chemin)) chemin += '/'
  return chemin
}

export function analyserHtml(html, { base = 'https://vitfix.io' } = {}) {
  const h = String(html || '')
  const r = {}
  const title = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  r.title = title ? decoderEntites(title[1]).replace(/\s+/g, ' ').trim() : ''
  r.title_len = r.title.length
  r.title_marque_n = (r.title.match(/vitfix/gi) || []).length

  r.meta_robots = []
  r.description = ''
  r.og_image = ''
  for (const m of balises(h, 'meta')) {
    const name = (attribut(m, 'name') || '').toLowerCase()
    const prop = (attribut(m, 'property') || '').toLowerCase()
    const content = attribut(m, 'content') || ''
    if (name === 'robots') r.meta_robots.push(content)
    if (name === 'description' && !r.description) r.description = content.replace(/\s+/g, ' ').trim()
    if (prop === 'og:image' && !r.og_image) r.og_image = content
  }
  r.description_len = r.description.length
  r.noindex = r.meta_robots.some((v) => /noindex/i.test(v))

  r.canonical = ''
  r.hreflang = []
  for (const l of balises(h, 'link')) {
    const rel = (attribut(l, 'rel') || '').toLowerCase()
    const href = attribut(l, 'href') || ''
    if (rel === 'canonical' && !r.canonical) r.canonical = href
    if (rel === 'alternate') {
      const lang = attribut(l, 'hreflang')
      if (lang) r.hreflang.push({ lang, href })
    }
  }

  const h1 = [...h.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => texteSansBalises(m[1]))
  const h2 = [...h.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => texteSansBalises(m[1]))
  r.h1_n = h1.length
  r.h1 = h1[0] || ''
  r.h2_n = h2.length
  r.h2 = h2

  // JSON-LD
  r.jsonld = { noeuds: [], erreurs: 0, types: [] }
  for (const m of h.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1])
      const liste = Array.isArray(j) ? j : (j && j['@graph'] ? j['@graph'] : [j])
      for (const n of liste) {
        if (!n || typeof n !== 'object') continue
        const type = Array.isArray(n['@type']) ? n['@type'].join('+') : String(n['@type'] || '')
        r.jsonld.noeuds.push({
          type,
          id: n['@id'] || '',
          name: n.name || '',
          address: !!n.address,
          address_locality: n.address && n.address.addressLocality ? String(n.address.addressLocality) : '',
          geo: !!n.geo,
          ohs: !!n.openingHoursSpecification,
          priceRange: n.priceRange || '',
          telephone: n.telephone || '',
          aggregateRating: !!n.aggregateRating,
          review: !!n.review,
          offerCatalog: !!n.hasOfferCatalog,
          offers: !!n.offers,
          areaServed: n.areaServed ? JSON.stringify(n.areaServed).slice(0, 200) : '',
          provider: n.provider ? JSON.stringify(n.provider).slice(0, 200) : '',
          crumbs: type === 'BreadcrumbList' && Array.isArray(n.itemListElement)
            ? n.itemListElement.map((c) => (c.item && (c.item['@id'] || (typeof c.item === 'string' ? c.item : c.item.url))) || c.url || '').filter(Boolean)
            : [],
        })
        r.jsonld.types.push(type)
      }
    } catch {
      r.jsonld.erreurs++
    }
  }

  // Texte principal
  const main = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  r.main_present = !!main
  const fragmentMain = main ? main[1] : h.replace(/<header[\s\S]*?<\/header>/i, ' ').replace(/<footer[\s\S]*?<\/footer>/i, ' ')
  r.texte_main = texteSansBalises(fragmentMain)
  r.mots_main = mots(r.texte_main)
  r.mots_main_n = r.mots_main.length

  // Liens
  r.liens = []
  const idxMain = main ? h.indexOf(main[0]) : -1
  const finMain = idxMain >= 0 ? idxMain + main[0].length : -1
  for (const m of h.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribut(m[0], 'href')
    if (href === null) continue
    const pos = m.index
    r.liens.push({ href, dans_main: idxMain >= 0 && pos >= idxMain && pos < finMain })
  }
  const origine = new URL(base).origin
  const internes = []
  const sansPrefixe = []
  const sansSlash = []
  for (const l of r.liens) {
    const brut = decoderEntites(l.href).trim()
    if (PROTOCOLES_IGNORES.test(brut)) continue
    let u
    try { u = new URL(brut, base) } catch { continue }
    if (u.origin !== origine) continue
    const chemin = u.pathname
    if (!PREFIXE_LANGUE.test(chemin)) sansPrefixe.push(chemin + u.search)
    if (/^\/pt\/.*[^/]$/.test(chemin) && !EXTENSION_FICHIER.test(chemin)) sansSlash.push(chemin)
    const n = normaliserLien(brut, base)
    if (n) internes.push({ chemin: n, requete: u.search, dans_main: l.dans_main })
  }
  r.liens_internes = internes
  r.liens_internes_n = internes.length
  r.liens_internes_distincts = [...new Set(internes.map((x) => x.chemin))]
  r.liens_sans_prefixe = [...new Set(sansPrefixe)]
  r.liens_sans_slash = [...new Set(sansSlash)]
  r.liens_profissional = [...new Set(internes.map((x) => x.chemin).filter((c) => c.startsWith('/pt/profissional/')))]
  r.liens_pesquisar_category = [...new Set(internes.filter((x) => /pesquisar/.test(x.chemin) && /category=/.test(x.requete)).map((x) => x.chemin + x.requete))]
  return r
}
