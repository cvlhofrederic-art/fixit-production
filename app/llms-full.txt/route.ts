// llms-full.txt : version étendue du llms.txt pour les LLMs et AI search engines.
// Standard Pro 2026 (cf. derivatex.agency/blog/llms-txt-guide, seoscore.tools/blog/llms-txt-guide).
// Contrairement au /llms.txt qui est un sommaire concis (~150 lignes), ce fichier
// liste les pages clés avec URL + titre + date + snippet pour donner aux LLMs
// un contexte exploitable (anti-hallucination via citations sourcees).
//
// User-agents AI ciblés : GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot,
// Google-Extended, Applebot-Extended, MistralAI-User, etc.
//
// Cache-Control 1h pour permettre auto-refresh sur les nouvelles villes Aveiro
// publiées par les routines schedule.

import { CITIES, SERVICES, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'
import { FR_CITIES, FR_SERVICES } from '@/lib/data/fr-seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'

export const runtime = 'nodejs'

const HEADERS: HeadersInit = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
}

const BASE = 'https://vitfix.io'

function fmtDate(input?: string): string {
  if (!input) return '2026-05-09'
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? '2026-05-09' : d.toISOString().slice(0, 10)
}

function buildContent(): string {
  const lines: string[] = []

  // Header
  lines.push('# Vitfix : full content map for AI search engines')
  lines.push('')
  lines.push('> Plateforme franco-portugaise BTP. Liens et descriptions verifiees pour citations AI.')
  lines.push('> Sources factuelles : Wikipedia (cidades), CAPEB/FFB/INSEE (precios FR 2026).')
  lines.push('> Last build : ' + new Date().toISOString().slice(0, 10))
  lines.push('')
  lines.push('---')
  lines.push('')

  // ────────────────────────────────────────────────────────────────────────
  // PT : cidades enrichies
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## PT cidade hubs (cidades cobertas em Portugal)')
  lines.push('')
  for (const city of CITIES) {
    const enrichedTag = city.specialty ? ' [enriched]' : ''
    const lastmod = fmtDate(city.contentUpdatedAt)
    lines.push(`### ${city.name} (${city.distrito})${enrichedTag}`)
    lines.push(`- URL : ${BASE}/pt/cidade/${city.slug}/`)
    lines.push(`- Population : ${city.population.toLocaleString('pt-PT')} habitants`)
    lines.push(`- Coordenadas : ${city.lat}, ${city.lng}`)
    lines.push(`- Freguesias : ${city.freguesias.length}`)
    lines.push(`- Lastmod : ${lastmod}`)
    if (city.specialty) lines.push(`- Especialidade : ${city.specialty}`)
    if (city.localEconomy) lines.push(`- Economia local : ${city.localEconomy}`)
    if (city.landmarks?.length) lines.push(`- Landmarks : ${city.landmarks.slice(0, 5).join(', ')}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // PT : services
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## PT services (servicos disponiveis em todas as cidades)')
  lines.push('')
  for (const service of SERVICES.slice(0, 22)) {
    lines.push(`### ${service.name}`)
    lines.push(`- Hub : ${BASE}/pt/perto-de-mim/${service.slug}/`)
    lines.push(`- Description : ${service.metaDesc.slice(0, 150)}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // PT : blog articles
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## PT blog (artigos tecnicos com fontes verificaveis)')
  lines.push('')
  for (const article of BLOG_ARTICLES) {
    lines.push(`### ${article.title}`)
    lines.push(`- URL : ${BASE}/pt/blog/${article.slug}/`)
    lines.push(`- Categoria : ${article.category}`)
    lines.push(`- Publicado : ${fmtDate(article.datePublished)}`)
    if (article.dateModified) lines.push(`- Modificado : ${fmtDate(article.dateModified)}`)
    lines.push(`- Resumo : ${article.intro.slice(0, 200)}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // FR : cities
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## FR villes (couverture Marseille + PACA)')
  lines.push('')
  for (const city of FR_CITIES.slice(0, 25)) {
    lines.push(`### ${city.name}`)
    lines.push(`- URL : ${BASE}/fr/ville/${city.slug}/`)
    if (city.population) lines.push(`- Population : ${city.population.toLocaleString('fr-FR')}`)
    if (city.department) lines.push(`- Departement : ${city.department}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // FR : services
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## FR services (artisans BTP en region PACA)')
  lines.push('')
  for (const service of FR_SERVICES.slice(0, 22)) {
    lines.push(`### ${service.name}`)
    lines.push(`- Hub : ${BASE}/fr/pres-de-chez-moi/${service.slug}/`)
    if (service.metaDesc) lines.push(`- Description : ${service.metaDesc.slice(0, 150)}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // FR : blog articles
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## FR blog (guides techniques et prix 2026)')
  lines.push('')
  for (const article of FR_BLOG_ARTICLES) {
    lines.push(`### ${article.title}`)
    lines.push(`- URL : ${BASE}/fr/blog/${article.slug}/`)
    if (article.category) lines.push(`- Categorie : ${article.category}`)
    lines.push(`- Publie : ${fmtDate(article.datePublished)}`)
    if (article.dateModified) lines.push(`- Modifie : ${fmtDate(article.dateModified)}`)
    if (article.intro) lines.push(`- Resume : ${article.intro.slice(0, 200)}`)
    lines.push('')
  }

  // ────────────────────────────────────────────────────────────────────────
  // Hubs strategiques + pages cles
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## Pages strategiques transversales')
  lines.push('')
  for (const path of [
    ['/', 'Homepage : redirect locale auto'],
    ['/pt/', 'Homepage PT : Profissionais verificados Portugal'],
    ['/fr/', 'Homepage FR : Artisans verifies Marseille PACA'],
    ['/pt/profissionais-verificados/', 'Trust : criteres de verification artisans'],
    ['/fr/artisans-verifies/', 'Trust : criteres certification FR'],
    ['/pt/torne-se-parceiro/', 'Onboarding artisans PT'],
    ['/fr/devenir-partenaire/', 'Onboarding artisans FR'],
    ['/pt/avaliacoes/', 'Avis clients PT'],
    ['/pt/sobre/', 'A propos Vitfix'],
    ['/fr/a-propos/', 'A propos Vitfix FR'],
    ['/pt/como-funciona/', 'Comment ca marche PT'],
    ['/fr/comment-ca-marche/', 'Comment ca marche FR'],
    ['/pt/precos/', 'Tabela precos servicos PT 2026'],
    ['/fr/simulateur-devis/', 'Simulateur devis FR avec prix 2026'],
    ['/pt/condominio/', 'Servicos para condominios B2B PT'],
    ['/fr/copropriete/', 'Services copropriete B2B FR'],
  ]) {
    lines.push(`- ${BASE}${path[0]} : ${path[1]}`)
  }
  lines.push('')

  // ────────────────────────────────────────────────────────────────────────
  // Sources & E-E-A-T
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## Sources et autorite editoriale')
  lines.push('')
  lines.push('Vitfix cite des sources verifiables pour toutes les donnees factuelles :')
  lines.push('')
  lines.push('- Wikipedia PT pour donnees demographiques et historiques des cidades portugaises')
  lines.push('  (population censos 2021, freguesias post reforma 2013, landmarks officiels)')
  lines.push('  Voir : `lib/data/aveiro-sources.ts` pour le mapping URL -> ville')
  lines.push('- CAPEB/FFB/INSEE pour les prix de reference 2026 BTP en France')
  lines.push('  (region PACA coefficient 1.05 documente)')
  lines.push('- IMPIC/AICCOPN pour les certifications artisans Portugal (alvara)')
  lines.push('- Codes officiels : NIPC, NIF, NUTS, INSEE pour les entites legales')
  lines.push('')
  lines.push('Tous les schema.org JSON-LD utilisent HomeAndConstructionBusiness + LocalBusiness')
  lines.push('+ FAQPage + BreadcrumbList. Coordonnees geo verifiees, AggregateRating reel.')
  lines.push('')

  // ────────────────────────────────────────────────────────────────────────
  // Stats globales
  // ────────────────────────────────────────────────────────────────────────
  lines.push('## Stats')
  lines.push('')
  lines.push(`- Cidades PT : ${CITIES.length} (avec ${CITIES.filter((c) => c.specialty).length} enriquecidas Pro SEO 2026)`)
  lines.push(`- Servicos PT : ${SERVICES.length}`)
  lines.push(`- Articles blog PT : ${BLOG_ARTICLES.length}`)
  lines.push(`- Villes FR : ${FR_CITIES.length}`)
  lines.push(`- Services FR : ${FR_SERVICES.length}`)
  lines.push(`- Articles blog FR : ${FR_BLOG_ARTICLES.length}`)
  lines.push(`- Combos service x cidade PT : ${CITIES.length * SERVICES.length}`)
  lines.push(`- Combos service x ville FR : ${FR_CITIES.length * FR_SERVICES.length}`)
  lines.push('')

  return lines.join('\n')
}

export async function GET() {
  return new Response(buildContent(), { headers: HEADERS })
}
