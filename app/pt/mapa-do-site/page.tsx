import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES, getAllPageCombos, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'

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

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
    { '@type': 'ListItem', position: 2, name: 'Mapa do site', item: 'https://vitfix.io/pt/mapa-do-site/' },
  ],
}

export default function MapaDoSitePage() {
  const combos = getAllPageCombos()
  const combosByService = SERVICES.map(service => ({
    service,
    combos: combos.filter(c => c.service.slug === service.slug),
  })).filter(g => g.combos.length > 0)

  return (
    <div className="min-h-screen bg-warm-gray py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
          <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
          <span className="mx-2">/</span>
          <span className="text-dark font-medium">Mapa do site</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-dark mb-3">
          Mapa do site
        </h1>
        <p className="text-text-muted mb-10 max-w-2xl">
          Todas as páginas VITFIX em Portugal: serviços de profissionais, cidades cobertas, recursos e artigos.
        </p>

        {/* ── Páginas principais ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">Páginas principais</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <li><Link href="/pt/" className="text-dark/80 hover:text-yellow hover:underline">Início</Link></li>
            <li><Link href="/pt/pesquisar/" className="text-dark/80 hover:text-yellow hover:underline">Pesquisar profissionais</Link></li>
            <li><Link href="/pt/servicos/" className="text-dark/80 hover:text-yellow hover:underline">Todos os serviços</Link></li>
            <li><Link href="/pt/urgencia/" className="text-dark/80 hover:text-yellow hover:underline">Urgência 24/7</Link></li>
            <li><Link href="/pt/perto-de-mim/" className="text-dark/80 hover:text-yellow hover:underline">Perto de mim</Link></li>
            <li><Link href="/pt/como-funciona/" className="text-dark/80 hover:text-yellow hover:underline">Como funciona</Link></li>
            <li><Link href="/pt/profissionais-verificados/" className="text-dark/80 hover:text-yellow hover:underline">Profissionais verificados</Link></li>
            <li><Link href="/pt/torne-se-parceiro/" className="text-dark/80 hover:text-yellow hover:underline">Torne-se parceiro</Link></li>
            <li><Link href="/pt/sobre/" className="text-dark/80 hover:text-yellow hover:underline">Sobre nós</Link></li>
            <li><Link href="/pt/blog/" className="text-dark/80 hover:text-yellow hover:underline">Blog</Link></li>
            <li><Link href="/pt/condominio/" className="text-dark/80 hover:text-yellow hover:underline">Condomínios</Link></li>
            <li><Link href="/pt/simulador-orcamento/" className="text-dark/80 hover:text-yellow hover:underline">Simulador de orçamento</Link></li>
            <li><Link href="/pt/precos/" className="text-dark/80 hover:text-yellow hover:underline">Preços</Link></li>
            <li><Link href="/pt/especialidades/" className="text-dark/80 hover:text-yellow hover:underline">Especialidades</Link></li>
            <li><Link href="/pt/avaliacoes/" className="text-dark/80 hover:text-yellow hover:underline">Avaliações</Link></li>
            <li><Link href="/pt/avisos-legais/" className="text-dark/80 hover:text-yellow hover:underline">Avisos legais</Link></li>
            <li><Link href="/pt/termos/" className="text-dark/80 hover:text-yellow hover:underline">Termos e condições</Link></li>
            <li><Link href="/pt/privacidade/" className="text-dark/80 hover:text-yellow hover:underline">Privacidade</Link></li>
          </ul>
        </section>

        {/* ── Serviços × cidades ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-2">Serviços por cidade no Tâmega e Sousa</h2>
          <p className="text-text-muted text-sm mb-6">
            {combosByService.reduce((sum, g) => sum + g.combos.length, 0)} combinações serviços × cidades.
          </p>
          <div className="space-y-6">
            {combosByService.map(({ service, combos: serviceCombos }) => (
              <details key={service.slug} className="group rounded-xl border border-border/40 overflow-hidden" open={service.slug === 'canalizador'}>
                <summary className="flex items-center justify-between gap-4 px-5 py-3 cursor-pointer list-none bg-warm-gray/40 font-semibold text-dark hover:bg-warm-gray transition select-none">
                  <span className="flex items-center gap-3">
                    <Link href={`/pt/perto-de-mim/${service.slug}/`} className="hover:text-yellow hover:underline">
                      {service.name}
                    </Link>
                    <span className="text-xs text-text-muted">({serviceCombos.length} cidades)</span>
                  </span>
                  <span className="text-yellow text-sm group-open:rotate-45 transition-transform">+</span>
                </summary>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-5 text-sm">
                  {serviceCombos.map(c => (
                    <li key={c.slug}>
                      <Link href={`/pt/servicos/${c.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                        {service.name} em {c.city.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        {/* ── Cidades ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">Cidades cobertas no Tâmega e Sousa</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {CITIES.map(city => (
              <li key={city.slug}>
                <Link href={`/pt/cidade/${city.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Blog ── */}
        {BLOG_ARTICLES.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
            <h2 className="font-display text-xl font-bold text-dark mb-5">Artigos do blog</h2>
            <ul className="space-y-2 text-sm">
              {BLOG_ARTICLES.map(a => (
                <li key={a.slug}>
                  <Link href={`/pt/blog/${a.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-text-muted mt-10">
          Procura o sitemap XML? <a href="/sitemap.xml" className="hover:text-dark underline">/sitemap.xml</a>
        </p>
      </div>
    </div>
  )
}
