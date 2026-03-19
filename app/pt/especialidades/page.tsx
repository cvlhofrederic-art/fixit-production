import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Especialidades VITFIX Portugal — Impermeabilização, Capoto, Desentupimento Urgente',
  description: 'Páginas especializadas para intervenções específicas em Portugal: impermeabilização, isolamento térmico ETICS, obras com alvará, reabilitação urbana, desentupimento urgente e manutenção Airbnb.',
  alternates: {
    canonical: 'https://vitfix.io/pt/especialidades/',
  },
  openGraph: {
    title: 'Especialidades VITFIX Portugal',
    description: 'Intervenções especializadas por profissionais verificados em Portugal',
    url: 'https://vitfix.io/pt/especialidades/',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
}

const ESPECIALIDADES_PT = [
  {
    icon: '🛡️',
    name: 'Impermeabilização Terraço e Cave',
    slug: 'impermeabilizacao-terraco-cave',
    description: 'Tratamento de infiltrações em terraços, varandas e caves. Membranas, telas asfálticas, poliureia. Diagnóstico com câmara térmica.',
    keywords: ['impermeabilização terraço', 'infiltrações cave', 'tratamento humidade'],
  },
  {
    icon: '🧱',
    name: 'Capoto ETICS — IVA 6%',
    slug: 'capoto-etics-iva-6',
    description: 'Isolamento térmico exterior pelo sistema ETICS (capoto). Benefício fiscal IVA reduzido a 6% para reabilitação. Poupança energética até 40%.',
    keywords: ['capoto ETICS', 'isolamento térmico exterior', 'IVA 6% reabilitação'],
  },
  {
    icon: '📋',
    name: 'Obras com Alvará e Licenciamento',
    slug: 'obras-alvara-licenciamento',
    description: 'Obras que necessitam alvará de construção ou licença de obras. Empreiteiros certificados com alvará válido. Acompanhamento do processo camarário.',
    keywords: ['alvará construção', 'licença obras Portugal', 'empreiteiro certificado'],
  },
  {
    icon: '🏠',
    name: 'Reabilitação Urbana Centro Histórico',
    slug: 'reabilitacao-urbana-centro-historico',
    description: 'Obras de reabilitação em centros históricos de Porto, Braga e Guimarães. Benefícios fiscais (IVA 6%, isenção IMI). Respeito pelo património.',
    keywords: ['reabilitação urbana Porto', 'obras centro histórico', 'benefícios fiscais reabilitação'],
  },
  {
    icon: '🚿',
    name: 'Desentupimento Urgente 24h',
    slug: 'desentupimento-urgente-24h',
    description: 'Desentupimento de emergência disponível 24 horas por dia, 7 dias por semana. Equipamento profissional: câmara de inspeção, hidrojato. Resposta em menos de 1 hora.',
    keywords: ['desentupimento urgente', 'desentupimento 24h Porto', 'canalização entupida urgência'],
  },
  {
    icon: '🏖️',
    name: 'Manutenção Airbnb e Alojamento Local',
    slug: 'manutencao-airbnb-alojamento-local',
    description: 'Serviço de manutenção preventiva e reparação para proprietários de alojamento local (Airbnb, Booking). Contratos anuais, intervenções rápidas entre hóspedes.',
    keywords: ['manutenção Airbnb Porto', 'alojamento local manutenção', 'reparações entre hóspedes'],
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX Portugal — Especialidades',
      url: 'https://vitfix.io/pt/especialidades/',
      telephone: PHONE_PT,
      address: { '@type': 'PostalAddress', addressRegion: 'Porto', addressCountry: 'PT' },
      areaServed: { '@type': 'State', name: 'Distrito do Porto' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
        { '@type': 'ListItem', position: 2, name: 'Especialidades', item: 'https://vitfix.io/pt/especialidades/' },
      ],
    },
  ],
}

export default function EspecialidadesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        {/* Hero */}
        <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Navegação estrutural" className="text-sm text-text-muted mb-6">
              <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
              <span className="mx-2">/</span>
              <span className="text-dark font-medium">Especialidades</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
              <span>⭐</span>
              <span className="text-dark">Especialistas verificados</span>
            </div>

            <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
              Especialidades VITFIX Portugal
            </h1>
            <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
              Intervenções especializadas por profissionais verificados na região Norte de Portugal:
              impermeabilização, isolamento térmico, reabilitação urbana, desentupimento urgente
              e manutenção para alojamento local.
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-dark text-white py-5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: '6', label: 'Especialidades' },
                { value: '24h', label: 'Intervenção' },
                { value: '100%', label: 'Profissionais verificados' },
                { value: 'Norte', label: 'Região' },
              ].map(stat => (
                <div key={stat.label}>
                  <span className="font-display text-2xl md:text-3xl font-extrabold text-yellow">{stat.value}</span>
                  <span className="block text-sm text-white/70 mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grid especialidades */}
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-2xl">🔧</span>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
                As nossas áreas de especialização
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ESPECIALIDADES_PT.map((spec) => (
                <Link
                  key={spec.slug}
                  href="/pt/pesquisar"
                  className="group bg-white rounded-2xl border border-border/50 p-6 hover:border-yellow hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform inline-block">{spec.icon}</span>
                  <h2 className="font-display text-xl font-bold text-dark mb-2 group-hover:text-yellow transition-colors">
                    {spec.name}
                  </h2>
                  <p className="text-text-muted text-sm mb-4 leading-relaxed">
                    {spec.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {spec.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs bg-yellow/10 border border-yellow/25 text-dark px-2.5 py-1 rounded-full"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                    <span className="text-sm font-semibold text-yellow">Ver página</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
              Precisa de uma intervenção especializada?
            </h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              Os nossos profissionais na região Norte são especializados em cada área e conhecem as particularidades locais.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/pt/servicos/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Todos os serviços
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a
                href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Ol%C3%A1%2C%20preciso%20de%20um%20profissional%20especializado%20na%20regi%C3%A3o%20do%20Porto`}
                className="inline-flex items-center gap-2 border-2 border-dark text-dark rounded-full font-display font-bold px-8 py-4 text-base bg-transparent hover:bg-dark hover:text-white transition-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>💬</span> WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
