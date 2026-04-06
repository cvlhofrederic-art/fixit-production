import type { Metadata } from 'next'
import Link from 'next/link'
import { CITIES, SERVICES } from '@/lib/data/seo-pages-data'

export const metadata: Metadata = {
  title: 'Cidades VITFIX — Profissionais em Tâmega e Sousa, Porto e Braga',
  description: 'Encontre profissionais verificados na sua cidade: Marco de Canaveses, Penafiel, Amarante, Porto, Braga e mais. Eletricista, canalizador, pintor. Orçamento grátis.',
  openGraph: {
    title: 'Cidades VITFIX — Profissionais na Sua Zona',
    description: 'Serviços para casa em Marco de Canaveses, Penafiel, Amarante, Porto, Vila Nova de Gaia, Braga e região.',
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
      'pt': 'https://vitfix.io/pt/cidade/',
      'x-default': 'https://vitfix.io/pt/cidade/',
    },
  },
}

export default function CidadesHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Cidades VITFIX',
        description: 'Todas as cidades onde a VITFIX opera na região Norte de Portugal.',
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
            Profissionais verificados em {CITIES.length} cidades da região Norte de Portugal.
            Eletricista, canalizador, pintor, pladur e mais. Orçamento grátis, intervenção rápida.
          </p>
        </div>
      </section>

      {/* CITIES GRID */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark mb-8">
            {CITIES.length} Cidades Disponíveis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/cidade/${city.slug}/`}
                className="flex items-start gap-4 p-5 bg-white rounded-xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-2xl">📍</span>
                <div>
                  <span className="font-semibold text-dark group-hover:text-yellow transition-colors text-lg block">
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
        </div>
      </section>

      {/* SERVICES PER CITY */}
      {CITIES.map(city => (
        <section key={city.slug} className="py-10 md:py-14 even:bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-xl font-bold tracking-tight text-dark mb-4">
              Serviços em {city.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {SERVICES.map(service => (
                <Link
                  key={`${city.slug}-${service.slug}`}
                  href={`/pt/servicos/${service.slug}-${city.slug}/`}
                  className="flex items-center gap-2 p-3 bg-white rounded-lg border border-border/40 hover:border-yellow hover:shadow-sm transition-all group text-sm"
                >
                  <span>{service.icon}</span>
                  <span className="font-medium text-dark group-hover:text-yellow transition-colors truncate">
                    {service.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

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
