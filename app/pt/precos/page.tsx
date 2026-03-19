import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tabela de Preços — Serviços para a Sua Casa | VITFIX',
  description: 'Consulte os preços de referência para canalização, eletricidade, pintura e outros serviços em Marco de Canaveses, Penafiel, Amarante e região do Tâmega e Sousa.',
  openGraph: {
    title: 'Tabela de Preços — Serviços para a Sua Casa | VITFIX',
    description: 'Preços de referência para canalização, eletricidade, pintura e mais. Profissionais verificados na região do Tâmega e Sousa.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/precos/',
  },
}

const PRICE_GUIDES = [
  {
    slug: 'canalizador',
    name: 'Canalizador',
    icon: '🛁',
    description: 'Reparação de torneiras, desentupimentos, fugas de água, substituição de banheira por base de duche e mais.',
    priceRange: '30 - 2500',
    services: 12,
  },
  {
    slug: 'eletricista',
    name: 'Eletricista',
    icon: '⚡',
    description: 'Instalação de tomadas, quadros elétricos, disjuntores, certificação elétrica, ar condicionado e painéis solares.',
    priceRange: '30 - 1200',
    services: 9,
  },
  {
    slug: 'pintor',
    name: 'Pintor',
    icon: '🎨',
    description: 'Pintura interior e exterior, tratamento anti-humidade, lacagem de portas, estuque e massa corrida.',
    priceRange: '5 - 1500',
    services: 9,
  },
]

export default function PrecosHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Tabela de Preços VITFIX',
        description: 'Preços de referência para serviços de canalização, eletricidade e pintura na região do Tâmega e Sousa.',
        url: 'https://vitfix.io/pt/precos/',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Preços', item: 'https://vitfix.io/pt/precos/' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* -- HERO -- */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Preços</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>💰</span>
            <span className="text-dark">Tabela de preços 2026</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Tabela de Preços — Serviços para a Sua Casa
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Consulte os preços de referência para canalização, eletricidade, pintura e outros serviços em Marco de Canaveses, Penafiel, Amarante e toda a região do Tâmega e Sousa.
          </p>
        </div>
      </section>

      {/* -- PRICE GUIDES GRID -- */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Guias de preços por serviço
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Selecione um serviço para consultar a tabela de preços detalhada com valores de referência para a região.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICE_GUIDES.map(guide => (
              <Link
                key={guide.slug}
                href={`/pt/precos/${guide.slug}/`}
                className="group p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all"
              >
                <span className="text-4xl block mb-4">{guide.icon}</span>
                <h3 className="font-display text-xl font-bold text-dark group-hover:text-yellow transition-colors mb-2">
                  Preços {guide.name}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  {guide.description}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-text-muted block">Faixa de preços</span>
                    <span className="font-display font-bold text-dark">{guide.priceRange}€</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-text-muted block">Serviços</span>
                    <span className="font-display font-bold text-dark">{guide.services}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                  <span className="text-sm font-semibold text-yellow">Ver tabela completa</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -- INDICATIVE PRICES NOTE -- */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📋</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Preços indicativos para a região do Tâmega e Sousa
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div>
              <h3 className="font-display font-bold text-dark mb-3">Como são calculados os preços?</h3>
              <p className="text-text-muted leading-relaxed mb-4">
                Os preços apresentados são valores de referência baseados nas tarifas praticadas por profissionais na região do Tâmega e Sousa, incluindo Marco de Canaveses, Penafiel, Amarante e cidades vizinhas.
              </p>
              <p className="text-text-muted leading-relaxed">
                Os valores podem variar consoante a complexidade do trabalho, a urgência, a acessibilidade do local e os materiais utilizados. Recomendamos sempre pedir um orçamento personalizado.
              </p>
            </div>
            <div>
              <h3 className="font-display font-bold text-dark mb-3">O que influencia o preço final?</h3>
              <ul className="space-y-3">
                {[
                  'Complexidade e duração do trabalho',
                  'Materiais e peças necessárias',
                  'Urgência da intervenção (fora de horário)',
                  'Acessibilidade do local',
                  'Deslocação (distância do profissional)',
                  'Necessidade de equipamento especializado',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                    <span className="text-[0.93rem] text-dark leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* -- REGION CONTEXT -- */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📍</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Preços na região do Tâmega e Sousa
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            A região do Tâmega e Sousa beneficia de preços geralmente mais acessíveis comparados com o centro do Porto, mantendo a mesma qualidade de serviço.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { city: 'Marco de Canaveses', icon: '🏘️' },
              { city: 'Penafiel', icon: '🏘️' },
              { city: 'Amarante', icon: '🏘️' },
              { city: 'Baião', icon: '🏘️' },
            ].map(item => (
              <div key={item.city} className="p-5 bg-white rounded-2xl border border-border/50 text-center">
                <span className="text-2xl block mb-2">{item.icon}</span>
                <span className="font-display font-bold text-dark">{item.city}</span>
                <span className="block text-xs text-text-muted mt-1">Preços de referência disponíveis</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- CTA -- */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Peça um orçamento grátis e sem compromisso
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Os preços indicados são valores de referência. Para um orçamento exato, contacte um dos nossos profissionais verificados.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Pedir orçamento grátis
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
