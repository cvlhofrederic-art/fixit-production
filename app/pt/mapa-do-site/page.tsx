import type { Metadata } from 'next'
import { SERVICES, CITIES, getAllPageCombos, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'
import HtmlSitemap from '@/components/seo/HtmlSitemap'
import { buildBreadcrumbSchema, buildSchemaGraph } from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'Mapa do site VITFIX — Todas as nossas páginas serviços e cidades',
  description: 'Mapa do site completo VITFIX: serviços de profissionais, cidades cobertas no Tâmega e Sousa, artigos do blog. Navegação rápida para todas as páginas.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mapa-do-site/',
    languages: {
      'pt': 'https://vitfix.io/pt/mapa-do-site/',
      'fr': 'https://vitfix.io/fr/plan-du-site/',
      'x-default': 'https://vitfix.io/pt/mapa-do-site/',
    },
  },
  openGraph: {
    title: 'Mapa do site VITFIX',
    description: 'Todas as nossas páginas serviços e cidades em Portugal.',
    type: 'website',
    url: 'https://vitfix.io/pt/mapa-do-site/',
    siteName: 'VITFIX',
    locale: 'pt_PT',
  },
}

const breadcrumbSchema = buildSchemaGraph(
  buildBreadcrumbSchema([
    { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
    { name: 'Mapa do site', url: 'https://vitfix.io/pt/mapa-do-site/' },
  ]),
)

export default function MapaDoSitePage() {
  const combos = getAllPageCombos()
  const servicesByCity = SERVICES
    .map(service => ({
      service: { slug: service.slug, name: service.name },
      combos: combos
        .filter(c => c.service.slug === service.slug)
        .map(c => ({ slug: c.slug, city: { name: c.city.name } })),
    }))
    .filter(g => g.combos.length > 0)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <HtmlSitemap
        locale="pt"
        title="Mapa do site"
        intro="Todas as páginas VITFIX em Portugal: serviços de profissionais, cidades cobertas, recursos e artigos."
        breadcrumbHomeLabel="VITFIX"
        breadcrumbCurrentLabel="Mapa do site"
        homeHref="/pt/"
        mainPagesTitle="Páginas principais"
        mainPages={[
          { href: '/pt/', label: 'Início' },
          { href: '/pt/pesquisar/', label: 'Pesquisar profissionais' },
          { href: '/pt/servicos/', label: 'Todos os serviços' },
          { href: '/pt/urgencia/', label: 'Urgência 24/7' },
          { href: '/pt/perto-de-mim/', label: 'Perto de mim' },
          { href: '/pt/como-funciona/', label: 'Como funciona' },
          { href: '/pt/profissionais-verificados/', label: 'Profissionais verificados' },
          { href: '/pt/torne-se-parceiro/', label: 'Torne-se parceiro' },
          { href: '/pt/sobre/', label: 'Sobre nós' },
          { href: '/pt/blog/', label: 'Blog' },
          { href: '/pt/condominio/', label: 'Condomínios' },
          { href: '/pt/simulador-orcamento/', label: 'Simulador de orçamento' },
          { href: '/pt/precos/', label: 'Preços' },
          { href: '/pt/especialidades/', label: 'Especialidades' },
          { href: '/pt/avaliacoes/', label: 'Avaliações' },
          { href: '/pt/avisos-legais/', label: 'Avisos legais' },
          { href: '/pt/termos/', label: 'Termos e condições' },
          { href: '/pt/privacidade/', label: 'Privacidade' },
        ]}
        servicesByCityTitle="Serviços por cidade no Tâmega e Sousa"
        servicesByCityCountSuffix=" cidades"
        servicesByCityComboPrefix="em"
        servicesByCityRoot="/pt/servicos"
        servicesByCityNearMeRoot="/pt/perto-de-mim"
        servicesByCity={servicesByCity}
        defaultOpenServiceSlug="canalizador"
        citiesTitle="Cidades cobertas no Tâmega e Sousa"
        cities={CITIES.map(c => ({ slug: c.slug, name: c.name }))}
        cityRoot="/pt/cidade"
        blogTitle="Artigos do blog"
        blogArticles={BLOG_ARTICLES.map(a => ({ slug: a.slug, title: a.title }))}
        blogRoot="/pt/blog"
        xmlSitemapNote="Procura o sitemap XML?"
      />
    </>
  )
}
