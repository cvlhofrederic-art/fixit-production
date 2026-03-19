import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Profissionais Perto de Mim — VITFIX | Tâmega e Sousa',
  description: 'Encontre um eletricista, canalizador, pintor ou faz-tudo perto de si. Profissionais verificados em Marco de Canaveses, Penafiel, Amarante e toda a região.',
  openGraph: {
    title: 'Profissionais Perto de Mim — VITFIX',
    description: 'Encontre um profissional verificado perto de si na região do Tâmega e Sousa.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/perto-de-mim/',
  },
}

export default function PertoMimHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Profissionais Perto de Mim — VITFIX',
        description: 'Encontre profissionais verificados para serviços domésticos perto de si.',
        url: 'https://vitfix.io/pt/perto-de-mim/',
        publisher: { '@type': 'Organization', name: 'VITFIX', url: 'https://vitfix.io' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: SERVICES.length,
          itemListElement: SERVICES.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://vitfix.io/pt/perto-de-mim/${s.slug}/`,
            name: `${s.name} perto de mim`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Perto de mim', item: 'https://vitfix.io/pt/perto-de-mim/' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Perto de mim</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>📍</span>
            <span className="text-dark">Profissionais perto de si</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Encontre um profissional perto de si
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Escolha o serviço e a sua cidade para encontrar profissionais verificados na sua zona. Orçamento grátis, sem compromisso.
          </p>
        </div>
      </section>

      {/* ── SERVICES GRID ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Que serviço procura?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES.map(service => (
              <div key={service.slug} className="bg-white rounded-2xl border border-border/50 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{service.icon}</span>
                    <div>
                      <h3 className="font-display font-bold text-dark text-lg">{service.name}</h3>
                      <span className="text-sm text-text-muted">Tâmega e Sousa</span>
                    </div>
                  </div>

                  <Link
                    href={`/pt/perto-de-mim/${service.slug}/`}
                    className="inline-flex items-center gap-2 text-yellow font-semibold text-sm mb-4 hover:underline"
                  >
                    Ver todas as cidades →
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    {CITIES.slice(0, 6).map(city => (
                      <Link
                        key={city.slug}
                        href={`/pt/perto-de-mim/${service.slug}-${city.slug}/`}
                        className="text-sm text-text-muted hover:text-yellow transition p-2 rounded-lg hover:bg-yellow/5"
                      >
                        📍 {city.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PICHELEIRO SECTION ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Procura um picheleiro?
          </h2>
          <p className="text-text-muted mb-6 max-w-2xl">
            No Norte de Portugal, o canalizador é frequentemente chamado de picheleiro. Temos profissionais disponíveis na sua zona.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/pt/perto-de-mim/picheleiro/"
              className="p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all text-center"
            >
              <span className="text-2xl block mb-1">🔧</span>
              <span className="font-semibold text-dark text-sm">Picheleiro</span>
              <span className="block text-xs text-text-muted">Todas as cidades</span>
            </Link>
            {CITIES.slice(0, 3).map(city => (
              <Link
                key={city.slug}
                href={`/pt/perto-de-mim/picheleiro-${city.slug}/`}
                className="p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all text-center"
              >
                <span className="text-2xl block mb-1">🔧</span>
                <span className="font-semibold text-dark text-sm">Picheleiro</span>
                <span className="block text-xs text-text-muted">{city.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES SECTION ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Cidades onde atuamos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/cidade/${city.slug}/`}
                className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group text-center"
              >
                <span className="text-2xl block mb-2">📍</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{city.name}</span>
                <span className="block text-xs text-text-muted mt-1">{city.population.toLocaleString('pt-PT')} hab.</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de ajuda agora?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Encontre profissionais verificados perto de si em poucos cliques. Orçamento grátis, sem compromisso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Pesquisar profissional
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
