import type { Metadata } from 'next'
import Link from 'next/link'
import { CITIES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Serviços Condomínio Portugal — Limpeza, Canalização, Manutenção | VITFIX',
  description: 'Serviços profissionais para condomínios em Portugal: limpeza de partes comuns, canalização, obras de manutenção. Faturação ao administrador, contratos anuais, relatórios de intervenção.',
  alternates: { canonical: 'https://vitfix.io/pt/condominio/' },
  openGraph: {
    title: 'Serviços Condomínio Portugal — VITFIX',
    description: 'Profissionais verificados para gestão de condomínios em Portugal',
    url: 'https://vitfix.io/pt/condominio/',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
}

const SERVICOS_CONDOMINIO = [
  {
    icon: '🗑️',
    name: 'Limpeza e Remoção de Entulho',
    description: 'Limpeza de partes comuns, escadas, garagens. Remoção de monos e entulho. Contratos semanais ou mensais.',
    condoSpecific: ['Faturação ao administrador', 'Contrato de manutenção mensal', 'Relatório de intervenção assinado'],
  },
  {
    icon: '🔧',
    name: 'Canalização e Manutenção',
    description: 'Manutenção de colunas montantes, reparação de fugas em partes comuns, desentupimento de esgotos coletivos.',
    condoSpecific: ['Urgência 24h/7d', 'Relatório para seguradora', 'Manutenção preventiva trimestral'],
  },
  {
    icon: '⚡',
    name: 'Eletricidade e Iluminação',
    description: 'Manutenção da instalação elétrica comum, iluminação de escadas e garagens, quadros elétricos gerais.',
    condoSpecific: ['Certificação conforme RTIEBT', 'Contrato anual de manutenção', 'Intervenção com relatório técnico'],
  },
]

const FAQ_CONDOMINIO = [
  {
    question: 'Como funciona a faturação para condomínios?',
    answer: 'A VITFIX emite fatura diretamente ao condomínio ou ao administrador. Cada intervenção é acompanhada de relatório assinado. O IVA é dedutível conforme o regime fiscal do condomínio.',
  },
  {
    question: 'Fazem contratos anuais de manutenção?',
    answer: 'Sim, oferecemos contratos à medida para condomínios: manutenção mensal, trimestral ou anual. Os condomínios com contrato têm prioridade nas urgências e relatórios regulares.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Serviços Condomínio Portugal',
      description: 'Serviços profissionais para condomínios em Portugal: limpeza, canalização, eletricidade.',
      url: 'https://vitfix.io/pt/condominio/',
      telephone: PHONE_PT,
      areaServed: { '@type': 'AdministrativeArea', name: 'Norte de Portugal' },
      serviceType: ['Limpeza condomínio', 'Canalização condomínio', 'Eletricidade condomínio'],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
        { '@type': 'ListItem', position: 2, name: 'Condomínio', item: 'https://vitfix.io/pt/condominio/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_CONDOMINIO.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ],
}

export default function PtCondominioPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Condomínio</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🏢</span>
            <span className="text-dark">Administradores · Condomínios · Portugal</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Serviços profissionais<br />
            <span className="text-yellow">para condomínios</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            A VITFIX é o seu parceiro para todas as intervenções em condomínio: limpeza de partes comuns, canalização, eletricidade. Faturação ao administrador, relatórios de intervenção, contratos anuais.
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent('Olá VITFIX, sou administrador de condomínio e gostaria de um orçamento para os vossos serviços.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Pedir orçamento condomínio
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Ligar agora
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Faturação ao administrador</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Relatórios de intervenção</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Contratos anuais</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Urgência 24h/7j</span>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS CONDOMÍNIO ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Os nossos serviços para condomínios
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {SERVICOS_CONDOMINIO.map(service => (
              <div key={service.name} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{service.icon}</span>
                      <h3 className="font-display font-bold text-xl">{service.name}</h3>
                    </div>
                    <p className="text-text-muted mb-4 leading-relaxed">{(service.description || '').replace(/\s*\[(?:unit|scope|min|max):[^\]]*\]\s*/g, '').trim()}</p>
                    <div className="flex flex-wrap gap-2">
                      {service.condoSpecific.map(item => (
                        <span key={item} className="px-3 py-1 rounded-full bg-yellow/10 border border-yellow/25 text-xs font-semibold text-dark">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a
                      href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Olá VITFIX, sou administrador de condomínio e gostaria de um orçamento para ${service.name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-3 text-sm hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)] whitespace-nowrap"
                    >
                      Pedir orçamento
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                    <a
                      href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Olá VITFIX, preciso de ${service.name} urgente no meu condomínio.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-medium rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-all whitespace-nowrap"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VANTAGENS ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Porquê escolher a VITFIX para o seu condomínio?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📋', title: 'Faturação profissional', desc: 'Orçamentos e faturas em nome do condomínio ou administrador. IVA dedutível, relatórios de intervenção assinados.' },
              { icon: '📅', title: 'Contratos à medida', desc: 'Contratos mensais, trimestrais ou anuais para manutenção regular. Prioridade nas urgências e relatórios periódicos.' },
              { icon: '⚡', title: 'Resposta rápida', desc: 'Urgências tratadas em 24–48h. Um interlocutor único para todos os pedidos. Disponível 7 dias por semana.' },
              { icon: '📍', title: 'Cobertura regional', desc: 'Porto, Tâmega e Sousa, Braga e arredores. Presença local com profissionais da região.' },
              { icon: '🏗️', title: 'Multi-serviços', desc: 'Um só prestador para limpeza, canalização E eletricidade. Menos interlocutores, mais eficiência para o administrador.' },
              { icon: '✅', title: 'Profissionais verificados', desc: 'Todos os profissionais são verificados e com seguro de responsabilidade civil. Certificados disponíveis a pedido.' },
            ].map(avantage => (
              <div key={avantage.title} className="p-5 rounded-2xl border border-border/50">
                <span className="text-3xl block mb-3">{avantage.icon}</span>
                <h3 className="font-display font-bold mb-2">{avantage.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{avantage.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CIDADES ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6 text-center">
            Condomínios servidos em Portugal
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CITIES.map(city => (
              <Link key={city.slug} href={`/pt/cidade/${city.slug}/`} className="p-4 rounded-xl border border-border/50 text-center hover:border-yellow/50 hover:bg-yellow/5 transition">
                <span className="font-semibold text-sm text-dark block">{city.name}</span>
                <span className="text-xs text-text-muted">{city.population.toLocaleString('pt-PT')} hab.</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Perguntas frequentes — Condomínios
          </h2>
          <div className="space-y-4">
            {FAQ_CONDOMINIO.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.question}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8 md:p-12" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="text-yellow font-bold text-sm uppercase tracking-wider block mb-2">🏢 Administradores de Condomínio</span>
                <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
                  Peça um orçamento para o seu condomínio
                </h3>
                <p className="text-white/70 text-[0.93rem] max-w-lg">
                  Orçamento gratuito em 24h, faturação ao administrador, contratos à medida. Cobrimos Porto, Tâmega e Sousa e Braga.
                </p>
              </div>
              <div className="flex flex-col gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent('Olá VITFIX, sou administrador de condomínio e gostaria de um orçamento.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-[#20ba59] transition-all whitespace-nowrap"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Condomínio
                </a>
                <a
                  href={`tel:${PHONE_PT}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)] whitespace-nowrap"
                >
                  Ligar agora
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
