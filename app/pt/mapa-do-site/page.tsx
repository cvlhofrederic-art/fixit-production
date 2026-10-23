import { SERVICES, CITIES, getAllPageCombos, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'
import { SERVICOS_DISTRITO } from '@/lib/data/pt-servicos-distrito'
import { SERVICOS_CONCELHO } from '@/lib/data/pt-servicos-concelho'
import { nomeDistrito } from '@/lib/seo/pt-meta'
import HtmlSitemap, { buildSitemapMetadata, buildSitemapBreadcrumbSchema } from '@/components/seo/HtmlSitemap'

export const metadata = buildSitemapMetadata({
  locale: 'pt',
  url: 'https://vitfix.io/pt/mapa-do-site/',
  altUrl: 'https://vitfix.io/fr/plan-du-site/',
  // Phase 1 SEO PT : marque une fois (template du layout).
  title: 'Mapa do site: serviços, cidades e artigos',
  description: 'Mapa do site completo VITFIX: serviços de profissionais, cidades cobertas em Portugal continental, artigos do blog. Navegação rápida para todas as páginas.',
  ogTitle: 'Mapa do site VITFIX',
  ogDescription: 'Todas as nossas páginas serviços e cidades em Portugal.',
})

const breadcrumbSchema = buildSitemapBreadcrumbSchema(
  'https://vitfix.io/pt/mapa-do-site/',
  'Mapa do site',
  'https://vitfix.io/pt/',
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
          ...SERVICOS_DISTRITO.map(s => ({ href: `/pt/servicos/${s.slug}/`, label: `${s.nome} no distrito ${nomeDistrito(s.distrito)}` })),
          ...SERVICOS_CONCELHO.map(s => ({ href: `/pt/servicos/${s.slug}/`, label: s.h1 })),
          { href: '/pt/urgencia/', label: 'Urgência' },
          { href: '/pt/perto-de-mim/', label: 'Perto de mim' },
          { href: '/pt/cidade/', label: 'Cidades cobertas' },
          { href: '/pt/contacto/', label: 'Contacto' },
          { href: '/pt/como-funciona/', label: 'Como funciona' },
          { href: '/pt/profissionais-verificados/', label: 'Profissionais verificados' },
          { href: '/pt/torne-se-parceiro/', label: 'Torne-se parceiro' },
          { href: '/pt/sobre/', label: 'Sobre nós' },
          { href: '/pt/blog/', label: 'Blog' },
          { href: '/pt/condominio/', label: 'Condomínios' },
          { href: '/pt/simulador-orcamento/', label: 'Simulador de orçamento' },
          { href: '/pt/precos/', label: 'Preços' },
          { href: '/pt/precos/canalizador/', label: 'Preços de canalizador' },
          { href: '/pt/precos/eletricista/', label: 'Preços de eletricista' },
          { href: '/pt/precos/pintor/', label: 'Preços de pintor' },
          { href: '/pt/mercados/publicar/', label: 'Publicar pedido de orçamento' },
          { href: '/pt/especialidades/', label: 'Especialidades' },
          { href: '/pt/avaliacoes/', label: 'Avaliações' },
          // Pages juridiques (noindex) : liées depuis le pied de page, pas depuis le plan (phase 4 SEO PT).
        ]}
        servicesByCityTitle="Serviços por cidade em Portugal"
        servicesByCityCountSuffix=" cidades"
        servicesByCityComboPrefix="em"
        servicesByCityRoot="/pt/servicos"
        servicesByCityNearMeRoot="/pt/perto-de-mim"
        servicesByCity={servicesByCity}
        defaultOpenServiceSlug="canalizador"
        citiesTitle="Cidades cobertas em Portugal"
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
