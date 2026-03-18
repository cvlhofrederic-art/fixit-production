import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Profissional de Urgência — Canalizador, Eletricista 24h | VITFIX',
  description: 'Profissional de urgência no Porto, Marco de Canaveses e Tâmega e Sousa: canalizador, eletricista. Intervenção rápida 24h/24, 7/7. Ligue ou envie WhatsApp.',
  alternates: {
    canonical: 'https://vitfix.io/pt/urgencia/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EmergencyService',
  name: 'VITFIX — Urgência profissionais de construção',
  description: 'Serviço de urgência para canalização e eletricidade no Porto e Tâmega e Sousa. 24h/24, 7/7.',
  url: 'https://vitfix.io/pt/urgencia/',
  telephone: PHONE_PT,
  areaServed: {
    '@type': 'AdministrativeArea',
    name: 'Distrito do Porto',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '00:00',
    closes: '23:59',
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
      { '@type': 'ListItem', position: 2, name: 'Urgência', item: 'https://vitfix.io/pt/urgencia/' },
    ],
  },
}

export default function PtUrgenciaHubPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO URGÊNCIA ── */}
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-yellow/6 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow/4 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-white/50">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-white/80">Urgência</span>
          </nav>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <span className="text-yellow font-bold text-sm uppercase tracking-wider">Disponível 24h/24 — 7 dias por semana</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-white mb-4">
            Profissional de urgência no<br />
            <span className="text-yellow">Porto e Tâmega e Sousa</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mb-8 leading-relaxed">
            Fuga de água, avaria elétrica, cano rebentado — os nossos profissionais intervêm de urgência no Porto, Marco de Canaveses, Penafiel, Amarante e em todo o distrito.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent('URGÊNCIA! Preciso de um profissional rapidamente. Podem intervir?')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_24px_rgba(37,211,102,0.5)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Urgência — Resposta rápida
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Ligar agora
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Resposta em menos de 30 min</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> 24h/24 — 7/7</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento transparente</span>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS URGÊNCIA ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Serviços de urgência disponíveis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.filter(s => ['eletricista', 'canalizador'].includes(s.slug)).map(service => (
              <div key={service.slug} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-6 border-b border-border/30">
                  <span className="text-4xl block mb-2">{service.icon}</span>
                  <h3 className="font-display font-bold text-xl mb-1">{service.name} Urgência</h3>
                  <p className="text-sm text-text-muted">{service.urgency.availableSchedule} · {service.urgency.avgResponseTime}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">Por concelho</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CITIES.slice(0, 4).map(city => (
                      <Link
                        key={city.slug}
                        href={`/pt/urgencia/${service.slug}-urgente-${city.slug}/`}
                        className="text-sm text-dark hover:text-yellow transition-colors p-1 flex items-center gap-1"
                      >
                        <span className="text-yellow text-xs">→</span> {city.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GESTES DE URGÊNCIA ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Enquanto espera pelo profissional — o que fazer?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES.filter(s => ['eletricista', 'canalizador'].includes(s.slug)).map(service => (
              <div key={service.slug} className="rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-4 bg-yellow/10 border-b border-yellow/20 flex items-center gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <span className="font-display font-bold">{service.name} — Passos de urgência</span>
                </div>
                <ol className="p-5 space-y-2">
                  {service.urgency.immediateSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow flex items-center justify-center text-dark font-bold text-xs">{i + 1}</span>
                      <span className="text-[0.87rem] text-dark/80 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONCELHOS ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-4 text-center">
            Zonas de intervenção de urgência
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/urgencia/canalizador-urgente-${city.slug}/`}
                className="px-4 py-2 rounded-full border border-border/50 text-sm text-dark hover:border-yellow hover:bg-yellow/5 transition-all"
              >
                Urgência {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
