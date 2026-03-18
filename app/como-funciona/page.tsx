import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Como funciona o VITFIX? Encontre profissionais verificados em Portugal | VITFIX',
  description: 'Descubra como o VITFIX funciona: pesquise profissionais verificados perto de si, compare orçamentos gratuitos e reserve online em segundos. Serviço disponível 7/7 em Marco de Canaveses e região.',
  openGraph: {
    title: 'Como funciona o VITFIX? Encontre profissionais verificados em Portugal',
    description: 'Pesquise, compare e reserve profissionais verificados perto de si. Orçamento gratuito, sem compromisso.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Como funciona o VITFIX?',
    description: 'Pesquise, compare e reserve profissionais verificados em Portugal.',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/como-funciona/',
  },
}

const steps = [
  {
    number: '01',
    icon: '🔍',
    title: 'Pesquise o serviço que precisa',
    description: 'Indique o tipo de trabalho (canalização, eletricidade, pintura…) e a sua localização. O VITFIX mostra-lhe os profissionais disponíveis perto de si em segundos.',
  },
  {
    number: '02',
    icon: '📋',
    title: 'Compare os profissionais',
    description: 'Consulte os perfis verificados, as avaliações de outros clientes e os preços. Todos os nossos profissionais têm seguro de responsabilidade civil e identidade verificada.',
  },
  {
    number: '03',
    icon: '📅',
    title: 'Reserve online — gratuito',
    description: 'Escolha a data e hora que lhe convém. O orçamento é gratuito e sem compromisso. Confirme a reserva em 2 cliques.',
  },
  {
    number: '04',
    icon: '✅',
    title: 'O profissional desloca-se',
    description: 'O profissional confirmado aparece no local combinado. Pode acompanhar a intervenção e deixar uma avaliação no final.',
  },
]

const guarantees = [
  {
    icon: '🔒',
    title: 'Profissionais verificados',
    description: 'Todos os profissionais passam por uma verificação de identidade, seguro RC Pro e qualificações antes de serem aceites na plataforma.',
  },
  {
    icon: '💶',
    title: 'Orçamento gratuito',
    description: 'Receba orçamentos detalhados antes de qualquer compromisso. Sem surpresas na fatura.',
  },
  {
    icon: '⭐',
    title: 'Avaliações reais',
    description: 'Cada avaliação é deixada por um cliente que realizou efetivamente uma reserva. Sem avaliações falsas.',
  },
  {
    icon: '📞',
    title: 'Suporte 7/7',
    description: 'A nossa equipa está disponível todos os dias por WhatsApp ou telefone para qualquer questão.',
  },
  {
    icon: '⚡',
    title: 'Urgências 24h',
    description: 'Precisa de um profissional rapidamente? Temos profissionais disponíveis para urgências em menos de 2 horas.',
  },
  {
    icon: '🏠',
    title: 'Cobertura regional',
    description: 'Atuamos em Marco de Canaveses, Penafiel, Amarante, Baião, Felgueiras, Lousada, Paços de Ferreira e Paredes.',
  },
]

const faqs = [
  {
    question: 'O serviço do VITFIX é gratuito para os clientes?',
    answer: 'Sim, o VITFIX é totalmente gratuito para os clientes particulares. Não paga nada para pesquisar, pedir orçamentos ou reservar um profissional. A plataforma é financiada pelas assinaturas dos profissionais.',
  },
  {
    question: 'Como são verificados os profissionais?',
    answer: 'Cada profissional passa por uma verificação completa: documento de identificação, seguro de responsabilidade civil profissional, certificado de qualificações e histórico profissional. Só publicamos perfis aprovados pela nossa equipa.',
  },
  {
    question: 'Posso cancelar uma reserva?',
    answer: 'Sim, pode cancelar gratuitamente até 24 horas antes da intervenção. Para cancelamentos de última hora, contacte-nos diretamente por WhatsApp.',
  },
  {
    question: 'O que acontece se o trabalho não for satisfatório?',
    answer: 'Todos os trabalhos estão cobertos pelo seguro RC Pro do profissional. Em caso de problema, a nossa equipa medeia a situação e garante uma solução — retrabalho gratuito ou reembolso.',
  },
  {
    question: 'Qual é a zona de cobertura do VITFIX em Portugal?',
    answer: 'Atualmente cobrimos a região do Entre Douro e Sousa: Marco de Canaveses, Penafiel, Amarante, Baião, Felgueiras, Lousada, Paços de Ferreira e Paredes. A cobertura está a expandir-se.',
  },
  {
    question: 'Quanto tempo leva a encontrar um profissional?',
    answer: 'Em situações normais, recebe confirmação num prazo de 2 horas. Para urgências, temos profissionais disponíveis que podem deslocar-se no mesmo dia.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Como funciona o VITFIX',
      description: 'Guia completo para encontrar e reservar profissionais verificados em Portugal com o VITFIX.',
      url: 'https://vitfix.io/pt/como-funciona/',
      inLanguage: 'pt-PT',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX Portugal', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Como funciona', item: 'https://vitfix.io/pt/como-funciona/' },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
    {
      '@type': 'HowTo',
      name: 'Como reservar um profissional no VITFIX',
      description: 'Processo simples em 4 passos para encontrar e reservar um profissional verificado em Portugal.',
      totalTime: 'PT5M',
      step: steps.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: step.title,
        text: step.description,
      })),
    },
  ],
}

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX Portugal</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Como funciona</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🇵🇹</span>
            <span className="text-dark">Plataforma 100% portuguesa</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Como funciona o VITFIX?
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Encontre, compare e reserve profissionais verificados perto de si em menos de 5 minutos. Orçamento gratuito, sem compromisso.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Começar agora — gratuito
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Olá! Gostaria de saber mais sobre o VITFIX.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-medium rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Falar connosco
            </a>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3 text-center">
            4 passos simples
          </h2>
          <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
            Do pedido à intervenção, tudo é simples, rápido e transparente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step) => (
              <div key={step.number} className="bg-white rounded-2xl p-6 border border-border/50 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-yellow/10 flex items-center justify-center text-2xl">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-yellow uppercase tracking-widest mb-1">Passo {step.number}</div>
                  <h3 className="font-display font-bold text-dark mb-2">{step.title}</h3>
                  <p className="text-[0.93rem] text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUARANTEES */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            As nossas garantias
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            O VITFIX compromete-se com a qualidade e a transparência em cada intervenção.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guarantees.map((g) => (
              <div key={g.title} className="rounded-2xl border border-border/50 p-5 hover:border-yellow/40 transition-colors">
                <div className="text-3xl mb-3">{g.icon}</div>
                <h3 className="font-display font-bold text-dark mb-2">{g.title}</h3>
                <p className="text-[0.93rem] text-text-muted leading-relaxed">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Perguntas frequentes
          </h2>
          <p className="text-text-muted mb-8">Tudo o que precisa de saber antes de fazer a sua primeira reserva.</p>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
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

      {/* CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl p-8 md:p-12 text-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-white mb-4">
              Pronto para encontrar o seu profissional?
            </h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Pesquise gratuitamente. Orçamento sem compromisso. Profissionais verificados perto de si.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/pt/pesquisar/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Pesquisar profissionais
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href="/pt/profissionais-verificados/"
                className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-8 py-4 text-base hover:bg-white/10 transition-all"
              >
                Ver garantias de qualidade
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
