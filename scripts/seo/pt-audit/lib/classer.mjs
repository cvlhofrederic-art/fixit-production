// Classement d'un chemin PT en groupe / métier / ville, avec les mêmes
// libellés de groupe que data/seo/pt_sitemap_statut_complet.csv (13/10/2026).

export const VILLES = ['agueda', 'amarante', 'aveiro', 'baiao', 'braga', 'felgueiras', 'gondomar', 'lousada', 'maia', 'marco-de-canaveses', 'matosinhos', 'ovar', 'pacos-de-ferreira', 'paredes', 'penafiel', 'porto', 'povoa-de-varzim', 'santo-tirso', 'trofa', 'valongo', 'vila-do-conde', 'vila-nova-de-gaia']

export const METIERS = ['ar-condicionado', 'azulejador', 'canalizador', 'carpinteiro', 'desentupimento', 'eletricista', 'estores-portoes', 'faz-tudo', 'impermeabilizacao', 'isolamento-termico', 'jardineiro', 'limpeza-condominio', 'limpeza-espacos', 'obras-remodelacao', 'pedreiro', 'pintor', 'pladur', 'poda-arvores', 'serralheiro', 'telhador', 'vidraceiro']

export const METIERS_PERTO = [...METIERS, 'picheleiro']

// Pages de service à l'échelle du district (lib/data/pt-servicos-distrito.ts, gel A0 levé le 20/10/2026) :
// /pt/servicos/{slug}/ sans ville. Liste tenue égale aux données par tests/seo/pt-servicos-distrito.test.tsx.
export const SERVICOS_DISTRITO_SLUGS = ['limpeza-de-telhados']

const villesTriees = [...VILLES].sort((a, b) => b.length - a.length)

function separerMetierVille(slug, suffixe = '') {
  for (const v of villesTriees) {
    const fin = suffixe + '-' + v
    if (slug.endsWith(fin)) {
      const metier = slug.slice(0, slug.length - fin.length)
      if (metier) return { metier, ville: v }
    }
  }
  return null
}

const JURIDIQUES = new Set(['/pt/termos/', '/pt/avisos-legais/', '/pt/privacidade/', '/pt/politica-cookies/'])

export function classer(chemin) {
  const c = chemin
  if (!c.startsWith('/pt/')) return { groupe: 'hors-pt', metier: '', ville: '' }
  if (c === '/pt/') return { groupe: 'page-statique', metier: '', ville: '' }
  if (JURIDIQUES.has(c)) return { groupe: 'juridique', metier: '', ville: '' }
  let m
  if ((m = c.match(/^\/pt\/servicos\/([^/]+)\/$/))) {
    if (SERVICOS_DISTRITO_SLUGS.includes(m[1])) return { groupe: 'servicos-distrito', metier: m[1], ville: '' }
    // Page concelho d'un service de district (ouverte par des chantiers réels) : groupe propre, mesurée à part de la grille.
    for (const sd of SERVICOS_DISTRITO_SLUGS) {
      const v = m[1].startsWith(sd + '-') ? m[1].slice(sd.length + 1) : ''
      if (VILLES.includes(v)) return { groupe: 'servicos-distrito-concelho', metier: sd, ville: v }
    }
    const s = separerMetierVille(m[1])
    return s ? { groupe: 'servicos', ...s } : { groupe: 'servicos-inconnu', metier: m[1], ville: '' }
  }
  if (c === '/pt/servicos/' || c === '/pt/urgencia/' || c === '/pt/perto-de-mim/') return { groupe: 'hub-section', metier: '', ville: '' }
  if ((m = c.match(/^\/pt\/urgencia\/([^/]+)\/$/))) {
    const s = separerMetierVille(m[1], '-urgente')
    return s ? { groupe: 'urgencia', ...s } : { groupe: 'urgencia-inconnu', metier: m[1], ville: '' }
  }
  if ((m = c.match(/^\/pt\/perto-de-mim\/([^/]+)\/$/))) {
    const s = separerMetierVille(m[1])
    if (s) return { groupe: 'perto-de-mim', ...s }
    return { groupe: 'perto-de-mim-hub', metier: m[1], ville: '' }
  }
  if (c === '/pt/cidade/') return { groupe: 'hub-cidade', metier: '', ville: '' }
  if ((m = c.match(/^\/pt\/cidade\/([^/]+)\/$/))) return { groupe: 'cidade', metier: '', ville: m[1] }
  if (c === '/pt/blog/') return { groupe: 'blog-index', metier: '', ville: '' }
  if (/^\/pt\/blog\/[^/]+\/$/.test(c)) return { groupe: 'blog', metier: '', ville: '' }
  // precos : métier laissé vide, comme dans le CSV de référence (le slug est dans le chemin)
  if (c.startsWith('/pt/precos/')) return { groupe: 'precos', metier: '', ville: '' }
  if (c.startsWith('/pt/mercados/')) return { groupe: 'mercados', metier: '', ville: '' }
  if (c.startsWith('/pt/pesquisar')) return { groupe: 'recherche', metier: '', ville: '' }
  if (c.startsWith('/pt/profissional/')) return { groupe: 'profil-pro', metier: '', ville: '' }
  if (c.startsWith('/pt/pro/') || c.startsWith('/pt/auth/')) return { groupe: 'pro-auth', metier: '', ville: '' }
  return { groupe: 'page-statique', metier: '', ville: '' }
}

/** Modèle de mesure de contenu (regroupe les pages comparables entre elles). */
export function modeleMesure(groupe) {
  switch (groupe) {
    case 'servicos': case 'urgencia': case 'perto-de-mim': case 'perto-de-mim-hub': case 'cidade': case 'blog': case 'servicos-distrito-concelho':
      return groupe
    case 'servicos-distrito': case 'hub-section': case 'hub-cidade': case 'blog-index': case 'precos': case 'page-statique': case 'mercados': case 'recherche': case 'juridique':
      return 'hors-grille'
    default:
      return 'autre'
  }
}
