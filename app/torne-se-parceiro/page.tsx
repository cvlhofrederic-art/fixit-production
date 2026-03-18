import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Torne-se Parceiro VITFIX — Profissional em Portugal | VITFIX',
  description: 'Junte-se ao VITFIX e receba mais clientes em Marco de Canaveses e região. Plataforma gratuita para começar, sem comissões por reserva. Registe o seu perfil hoje.',
  openGraph: {
    title: 'Torne-se Parceiro VITFIX — Mais clientes para o seu negócio',
    description: 'Registe o seu perfil de profissional no VITFIX e receba pedidos de clientes verificados na sua zona. Grátis para começar.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Torne-se Parceiro VITFIX — Profissional em Portugal',
    description: 'Mais clientes, sem comissões por reserva. Registe-se gratuitamente.',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/torne-se-parceiro/',
  },
}

const benefits = [
  {
    icon: '📱',
    title: 'Perfil profissional completo',
    description: 'Crie o seu perfil com fotos, descrição dos serviços, zona de atuação e disponibilidade. Visível nos resultados de pesquisa do Google.',
  },
  {
    icon: '📩',
    title: 'Receba pedidos de clientes',
    description: 'Os clientes encontram-no na plataforma e enviam-lhe pedidos diretamente. Aceite ou recuse conforme a sua agenda.',
  },
  {
    icon: '⭐',
    title: 'Construa a sua reputação',
    description: 'Recolha avaliações verificadas após cada intervenção. Uma boa nota atrai mais clientes automaticamente.',
  },
  {
    icon: '📅',
    title: 'Agenda digital integrada',
    description: 'Gira as suas reservas, disponibilidades e intervenções diretamente na aplicação. Lembretes automáticos para si e para o cliente.',
  },
  {
    icon: '📊',
    title: 'Faturação simplificada',
    description: 'Gere orçamentos e faturas em PDF diretamente da plataforma. Acompanhe os seus rendimentos mensais.',
  },
  {
    icon: '🔒',
    title: 'Badge verificado',
    description: 'Após verificação do seu seguro RC Pro e identidade, obtém o badge "Verificado VITFIX" — sinal de confiança para os clientes.',
  },
]

const plans = [
  {
    name: 'Gratuito',
    price: '0€',
    period: '/mês',
    description: 'Para começar a receber clientes sem risco.',
    features: [
      'Perfil básico na plataforma',
      'Até 5 pedidos por mês',
      'Avaliações de clientes',
      'Acesso à aplicação móvel',
    ],
    cta: 'Registar gratuitamente',
    href: '/pro/register/',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/mês',
    description: 'Para profissionais que querem crescer rapidamente.',
    features: [
      'Perfil destacado nos resultados',
      'Pedidos ilimitados',
      'Agenda digital avançada',
      'Faturação e orçamentos PDF',
      'Estatísticas de negócio',
      'Suporte prioritário',
    ],
    cta: 'Começar período de teste',
    href: '/pro/register/',
    highlighted: true,
  },
]

const faqs = [
  {
    question: 'Quanto custa registar-me no VITFIX como profissional?',
    answer: 'O registo básico é gratuito e permite-lhe receber até 5 pedidos por mês sem qualquer custo. O plano Pro custa 29€/mês e oferece pedidos ilimitados, faturação e perfil destacado.',
  },
  {
    question: 'O VITFIX cobra comissão sobre os trabalhos?',
    answer: 'Não. O VITFIX não cobra comissão sobre os trabalhos realizados. Paga apenas a subscrição mensal — sem surpresas na fatura.',
  },
  {
    question: 'Que documentos preciso para me registar?',
    answer: 'Para o registo básico basta o seu e-mail e número de telefone. Para obter o badge "Verificado VITFIX" (recomendado para mais confiança), precisamos do seu seguro RC Pro e documento de identificação.',
  },
  {
    question: 'Posso escolher a zona onde recebo pedidos?',
    answer: 'Sim. Define o raio de ação a partir da sua sede — por exemplo, 20 km à volta de Marco de Canaveses. Só recebe pedidos dentro da sua zona definida.',
  },
  {
    question: 'Em quanto tempo começo a receber pedidos?',
    answer: 'Após a aprovação do perfil (normalmente 24-48h), o seu perfil fica visível para os clientes. Os primeiros pedidos chegam habitualmente na primeira semana.',
  },
  {
    question: 'Posso cancelar a subscrição quando quiser?',
    answer: 'Sim, pode cancelar a qualquer momento sem penalização. O perfil gratuito mantém-se ativo mesmo após cancelamento do plano Pro.',
  },
]

const testimonials = [
  {
    name: 'António F.',
    job: 'Canalizador',
    city: 'Marco de Canaveses',
    text: 'Desde que me juntei ao VITFIX recebi 3x mais pedidos do que antes. O sistema de avaliações ajuda muito a ganhar a confiança dos novos clientes.',
    rating: 5,
  },
  {
    name: 'Rui M.',
    job: 'Eletricista',
    city: 'Penafiel',
    text: 'A faturação integrada poupou-me horas de trabalho administrativo por mês. Altamente recomendado para profissionais independentes.',
    rating: 5,
  },
  {
    name: 'Carlos S.',
    job: 'Pintor',
    city: 'Amarante',
    text: 'Profissional há 15 anos, o VITFIX trouxe-me clientes novos que nunca teria encontrado de outra forma. Excelente plataforma.',
    rating: 5,
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Torne-se Parceiro VITFIX — Profissional em Portugal',
      description: 'Registe-se na plataforma VITFIX e receba mais clientes em Portugal. Grátis para começar.',
      url: 'https://vitfix.io/pt/torne-se-parceiro/',
      inLanguage: 'pt-PT',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX Portugal', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Torne-se Parceiro', item: 'https://vitfix.io/pt/torne-se-parceiro/' },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
    {
      '@type': 'Service',
      name: 'Plataforma VITFIX para Profissionais',
      description: 'Plataforma digital que conecta profissionais verificados com clientes particulares em Portugal.',
      provider: {
        '@type': 'Organization',
        name: 'VITFIX',
        url: 'https://vitfix.io/pt/',
      },
      areaServed: {
        '@type': 'State',
        name: 'Entre Douro e Sousa, Portugal',
      },
      offers: [
        {
          '@type': 'Offer',
          name: 'Plano Gratuito',
          price: '0',
          priceCurrency: 'EUR',
          description: 'Perfil básico com até 5 pedidos por mês',
        },
        {
          '@type': 'Offer',
          name: 'Plano Pro',
          price: '29',
          priceCurrency: 'EUR',
          billingIncrement: 'monthly',
          description: 'Pedidos ilimitados, faturação, perfil destacado',
        },
      ],
    },
  ],
}

export default function TorneSeParceiroPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX Portugal</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Torne-se Parceiro</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🤝</span>
            <span className="text-dark">Para profissionais · Portugal</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Mais clientes para o seu negócio em Portugal
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Junte-se ao VITFIX e receba pedidos de clientes verificados na sua zona. Sem comissões por trabalho. Grátis para começar.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/pro/register/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Registar o meu perfil — grátis
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Olá! Sou profissional e gostaria de saber mais sobre como me juntar ao VITFIX.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-medium rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Tirar dúvidas no WhatsApp
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Sem comissões por trabalho</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Cancelamento a qualquer momento</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Perfil visível no Google</span>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            O que o VITFIX oferece aos profissionais
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            Uma plataforma completa para gerir e fazer crescer o seu negócio de profissional em Portugal.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-2xl p-5 border border-border/50 hover:border-yellow/40 transition-colors">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="font-display font-bold text-dark mb-2">{b.title}</h3>
                <p className="text-[0.93rem] text-text-muted leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            O que dizem os nossos parceiros
          </h2>
          <p className="text-text-muted mb-10">Profissionais reais que fazem crescer o negócio com o VITFIX.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/50 p-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <span key={i} className="text-yellow">★</span>
                  ))}
                </div>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed mb-4">&quot;{t.text}&quot;</p>
                <div>
                  <p className="font-bold text-dark text-sm">{t.name}</p>
                  <p className="text-text-muted text-xs">{t.job} · {t.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3 text-center">
            Planos transparentes
          </h2>
          <p className="text-text-muted mb-10 text-center">Sem comissões. Sem surpresas. Sem contratos longos.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${plan.highlighted
                  ? 'border-yellow bg-dark text-white'
                  : 'border-border/50 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-block text-xs font-bold text-dark bg-yellow rounded-full px-3 py-1 mb-4 uppercase tracking-wider">
                    Mais popular
                  </div>
                )}
                <div className="mb-4">
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.highlighted ? 'text-white/60' : 'text-text-muted'}`}>{plan.period}</span>
                </div>
                <p className={`text-sm mb-5 ${plan.highlighted ? 'text-white/70' : 'text-text-muted'}`}>{plan.description}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-[0.93rem] ${plan.highlighted ? 'text-white/90' : 'text-dark'}`}>
                      <span className="text-yellow">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center rounded-full py-3 px-6 font-display font-bold text-[0.95rem] transition-all hover:-translate-y-0.5 ${plan.highlighted
                    ? 'bg-yellow text-dark hover:bg-yellow-light shadow-[0_6px_20px_rgba(255,214,0,0.3)]'
                    : 'bg-dark text-white hover:bg-mid'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Perguntas dos profissionais
          </h2>
          <p className="text-text-muted mb-8">Respostas às dúvidas mais frequentes dos profissionais que se juntam ao VITFIX.</p>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
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

      {/* FINAL CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Comece hoje — é gratuito
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Crie o seu perfil em 5 minutos e comece a receber pedidos de clientes na sua zona.
          </p>
          <Link
            href="/pro/register/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Criar o meu perfil gratuitamente
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
