import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES } from '@/lib/data/seo-pages-data'

export const metadata: Metadata = {
  title: 'Serviços VITFIX — Eletricista, Canalizador, Desentupimento, Pintor, Faz Tudo | Portugal',
  description: 'Encontre profissionais verificados para eletricidade, canalização, desentupimento, pintura, faz tudo, pladur, obras, isolamento térmico e impermeabilização em Marco de Canaveses, Penafiel, Amarante e região.',
  openGraph: {
    title: 'Serviços VITFIX — Profissionais para a Sua Casa',
    description: 'Eletricista, canalizador, pintor, pladur, obras, isolamento térmico e impermeabilização. Profissionais verificados na região do Tâmega e Sousa.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/servicos/',
    languages: {
      'pt': 'https://vitfix.io/pt/servicos/',
      'fr': 'https://vitfix.io/fr/services/',
      'x-default': 'https://vitfix.io/pt/servicos/',
    },
  },
}

export default function ServicosHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Serviços VITFIX',
        description: 'Todos os serviços disponíveis na região do Tâmega e Sousa.',
        url: 'https://vitfix.io/pt/servicos/',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Serviços', item: 'https://vitfix.io/pt/servicos/' },
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
            <span className="text-dark font-medium">Serviços</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>🏠</span>
            <span className="text-dark">Serviços para a sua casa</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Todos os Serviços VITFIX
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Profissionais verificados para eletricidade, canalização, pintura, pladur e obras de remodelação em Marco de Canaveses e toda a região do Tâmega e Sousa.
          </p>
        </div>
      </section>

      {/* ── SERVICES GRID ── */}
      {SERVICES.map(service => (
        <section key={service.slug} className="py-12 md:py-16 even:bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{service.icon}</span>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
                {service.name}
              </h2>
            </div>
            <p className="text-text-muted mb-8 max-w-2xl">{service.heroSubtitle}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {CITIES.map(city => (
                <Link
                  key={city.slug}
                  href={`/pt/servicos/${service.slug}-${city.slug}/`}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
                >
                  <span className="text-lg">{service.icon}</span>
                  <div>
                    <span className="font-semibold text-dark group-hover:text-yellow transition-colors text-[0.93rem]">
                      {service.name} em {city.name}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {city.population.toLocaleString('pt-PT')} hab.
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── URGENCY SECTION ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🚨</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Serviços de Urgência
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            Urgência elétrica, fuga de água, ou obras de emergência? Os nossos profissionais estão disponíveis para intervenções rápidas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {SERVICES.map(service => (
              <Link
                key={`urgencia-${service.slug}`}
                href={`/pt/urgencia/${service.slug}-urgente-marco-de-canaveses/`}
                className="p-4 bg-red-50 rounded-xl border border-red-200 hover:border-red-400 hover:shadow-md transition-all group text-center"
              >
                <span className="text-2xl block mb-2">{service.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-red-600 transition-colors text-sm">{service.name}</span>
                <span className="block text-xs text-red-600 font-semibold mt-1">Urgente</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/pt/urgencia/" className="text-sm text-red-600 font-semibold hover:underline">
              Ver todos os serviços de urgência →
            </Link>
          </div>
        </div>
      </section>

      {/* ── PERTO DE MIM ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📍</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Profissionais Perto de Si
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            Encontre profissionais na sua zona. Selecione o serviço para ver os profissionais disponíveis perto de si.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {SERVICES.map(service => (
              <Link
                key={`perto-${service.slug}`}
                href={`/pt/perto-de-mim/${service.slug}/`}
                className="p-4 bg-blue-50 rounded-xl border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group text-center"
              >
                <span className="text-2xl block mb-2">{service.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-blue-600 transition-colors text-sm">{service.name}</span>
                <span className="block text-xs text-blue-600 font-semibold mt-1">Perto de mim</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES INDEX ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Cidades onde atuamos
          </h2>
          <p className="text-text-muted mb-8">
            A VITFIX cobre toda a região do Tâmega e Sousa, distrito do Porto.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/cidade/${city.slug}/`}
                className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-2xl block mb-2">📍</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{city.name}</span>
                <span className="block text-xs text-text-muted mt-1">{city.population.toLocaleString('pt-PT')} habitantes</span>
                <span className="block text-xs text-text-muted">Distrito de {city.distrito}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de um profissional perto de si?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Encontre profissionais verificados em poucos cliques. Orçamento grátis, sem compromisso.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Encontrar profissional agora
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
