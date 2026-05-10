import type { Metadata } from 'next'
import Link from 'next/link'
import { CITIES, SERVICES, type CityData } from '@/lib/data/seo-pages-data'

export const metadata: Metadata = {
  title: 'Cidades VITFIX : Profissionais verificados em Portugal continental',
  description: 'Encontre profissionais verificados na sua cidade. Eletricista, canalizador, pintor, pladur. Cobertura nos distritos do Porto, Braga e Aveiro. Orçamento grátis.',
  openGraph: {
    title: 'Cidades VITFIX : Profissionais na Sua Zona',
    description: 'Serviços para casa nos distritos do Porto, Braga e Aveiro.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/cidade/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/cidade/',
      'x-default': 'https://vitfix.io/pt/cidade/',
    },
  },
}

const DISTRITO_ORDER = ['Porto', 'Braga', 'Aveiro'] as const

const DISTRITO_DESCRIPTIONS: Record<string, string> = {
  Porto: 'Cidades do Tâmega e Sousa e Grande Porto.',
  Braga: 'Cidades do distrito de Braga.',
  Aveiro: 'Cidades do distrito de Aveiro, da ria à serra.',
}

function groupByDistrito(cities: CityData[]): Map<string, CityData[]> {
  const groups = new Map<string, CityData[]>()
  for (const c of cities) {
    const list = groups.get(c.distrito) ?? []
    list.push(c)
    groups.set(c.distrito, list)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.population - a.population)
  }
  return groups
}

export default function CidadesHubPage() {
  const grouped = groupByDistrito(CITIES)
  const orderedDistritos = [
    ...DISTRITO_ORDER.filter(d => grouped.has(d)),
    ...[...grouped.keys()].filter(d => !DISTRITO_ORDER.includes(d as typeof DISTRITO_ORDER[number])),
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Cidades VITFIX',
        description: 'Cidades onde a VITFIX opera, organizadas por distrito.',
        url: 'https://vitfix.io/pt/cidade/',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Cidades', item: 'https://vitfix.io/pt/cidade/' },
        ],
      },
    ],
  }

  const topServices = SERVICES.slice(0, 6)

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Cidades</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>📍</span>
            <span className="text-dark">Profissionais na sua zona</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Todas as Cidades VITFIX
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Profissionais verificados em {CITIES.length} cidades, organizadas por distrito. Eletricista, canalizador, pintor, pladur. Orçamento grátis, intervenção rápida.
          </p>
        </div>
      </section>

      {/* CITIES BY DISTRITO */}
      {orderedDistritos.map(distrito => {
        const cities = grouped.get(distrito)!
        return (
          <section key={distrito} className="py-12 md:py-16 even:bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <header className="mb-8">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dark text-white text-xs font-semibold uppercase tracking-wider mb-3">
                  <span>{cities.length} cidades</span>
                </span>
                <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-tight text-dark">
                  Distrito de {distrito}
                </h2>
                <p className="text-text-muted mt-1">{DISTRITO_DESCRIPTIONS[distrito] ?? `Cidades do distrito de ${distrito}.`}</p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {cities.map(city => (
                  <Link
                    key={city.slug}
                    href={`/pt/cidade/${city.slug}/`}
                    className="flex items-start gap-4 p-5 bg-white rounded-xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
                  >
                    <span className="text-2xl">📍</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-dark group-hover:text-yellow transition-colors text-lg block truncate">
                        {city.name}
                      </span>
                      <span className="text-sm text-text-muted block mt-1">
                        {city.population.toLocaleString('pt-PT')} habitantes
                      </span>
                      <span className="text-xs text-text-muted/70 mt-2 block">
                        {topServices.map(s => s.name).join(', ')}...
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              <details className="group rounded-xl border border-border/40 bg-white">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between hover:bg-warm-gray/30 transition-colors rounded-xl">
                  <span className="font-display font-bold text-dark">
                    Ver todos os serviços por cidade ({cities.length} × {SERVICES.length} = {cities.length * SERVICES.length} páginas)
                  </span>
                  <span className="text-yellow text-xl group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-5 pb-5 pt-2 space-y-6 border-t border-border/30">
                  {cities.map(city => (
                    <div key={city.slug}>
                      <h3 className="font-display text-sm font-bold tracking-tight text-dark mb-3 uppercase">
                        Serviços em {city.name}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {SERVICES.map(service => (
                          <Link
                            key={`${city.slug}-${service.slug}`}
                            href={`/pt/servicos/${service.slug}-${city.slug}/`}
                            className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 hover:border-yellow hover:bg-yellow/5 transition-all group text-sm"
                          >
                            <span>{service.icon}</span>
                            <span className="font-medium text-dark group-hover:text-yellow transition-colors truncate">
                              {service.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </section>
        )
      })}

      {/* CTA */}
      <section className="py-14 md:py-18 bg-dark text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
            Precisa de um profissional na sua cidade?
          </h2>
          <p className="text-white/70 mb-8">
            Profissionais verificados, orçamento gratuito, disponíveis 7 dias por semana.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-yellow text-dark font-bold rounded-xl hover:bg-yellow/90 transition-colors text-lg"
          >
            Encontrar Profissional
          </Link>
        </div>
      </section>
    </div>
  )
}
