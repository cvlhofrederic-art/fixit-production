import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Profissionais Verificados em Portugal — Garantia VITFIX | VITFIX',
  description: 'Todos os profissionais no VITFIX são verificados: seguro RC Pro, identidade e qualificações confirmadas. Trabalhos garantidos em Marco de Canaveses, Penafiel, Amarante e região.',
  openGraph: {
    title: 'Profissionais Verificados em Portugal — Garantia VITFIX',
    description: 'Seguro RC Pro, identidade verificada, avaliações reais. Confie nos profissionais do VITFIX para os seus trabalhos em casa.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Profissionais Verificados — Garantia VITFIX',
    description: 'RC Pro, identidade e qualificações verificadas. Profissionais de confiança em Portugal.',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/profissionais-verificados/',
  },
}

const verificationSteps = [
  {
    icon: '🪪',
    title: 'Verificação de identidade',
    description: 'Cada profissional apresenta o seu documento de identificação válido. A identidade é verificada manualmente pela nossa equipa antes de qualquer publicação do perfil.',
  },
  {
    icon: '🛡️',
    title: 'Seguro RC Pro obrigatório',
    description: 'Todos os profissionais devem apresentar um seguro de responsabilidade civil profissional em vigor. Está protegido contra danos materiais ou corporais durante a intervenção.',
  },
  {
    icon: '📜',
    title: 'Qualificações e experiência',
    description: 'Verificamos os certificados de qualificação e os anos de experiência declarados. Para eletricistas e canalizadores, exigimos qualificações regulamentares.',
  },
  {
    icon: '⭐',
    title: 'Avaliações verificadas',
    description: 'Cada avaliação só pode ser deixada por um cliente que realizou efetivamente uma reserva paga. Zero avaliações falsas ou infladas.',
  },
]

const reviews = [
  {
    author: 'Maria João S.',
    city: 'Marco de Canaveses',
    service: 'Canalização',
    rating: 5,
    text: 'Profissional excelente! Chegou na hora combinada, explicou tudo claramente e resolveu o problema da canalização de forma impecável. Recomendo sem hesitar.',
    date: 'Fevereiro 2026',
  },
  {
    author: 'Paulo R.',
    city: 'Penafiel',
    service: 'Eletricidade',
    rating: 5,
    text: 'Muito satisfeito com o serviço. O eletricista veio verificar a instalação elétrica de casa nova, trabalho de qualidade e preço justo. O badge "verificado" dá mesmo confiança.',
    date: 'Janeiro 2026',
  },
  {
    author: 'Ana Luísa M.',
    city: 'Amarante',
    service: 'Pintura',
    rating: 5,
    text: 'Sala e cozinha pintadas em 2 dias. Acabamentos perfeitos, limpeza exemplar. Já recomendei o VITFIX a toda a família.',
    date: 'Março 2026',
  },
  {
    author: 'José A.',
    city: 'Felgueiras',
    service: 'Pladur',
    rating: 4,
    text: 'Bom trabalho no teto em pladur do escritório. Pequeno atraso no início mas o resultado final é muito bom. Profissional simpático e trabalhador.',
    date: 'Janeiro 2026',
  },
  {
    author: 'Sandra F.',
    city: 'Lousada',
    service: 'Canalização',
    rating: 5,
    text: 'Fuga de água urgente ao fim de semana — profissional disponível em 1 hora. Perfeito! Preço razoável e trabalho limpo. O VITFIX salvou-nos.',
    date: 'Fevereiro 2026',
  },
  {
    author: 'Rui C.',
    city: 'Paços de Ferreira',
    service: 'Eletricidade',
    rating: 5,
    text: 'Instalação de quadro elétrico novo. O eletricista explicou cada passo, certificado final emitido. Exatamente o que esperava de um profissional verificado.',
    date: 'Dezembro 2025',
  },
]

const totalReviews = reviews.length
const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)

const faqs = [
  {
    question: 'O que significa o badge "Verificado VITFIX"?',
    answer: 'O badge "Verificado VITFIX" indica que o profissional passou por toda a nossa verificação: identidade confirmada, seguro RC Pro em vigor, qualificações verificadas e histórico profissional analisado. É a garantia máxima de confiança.',
  },
  {
    question: 'Estou protegido se o trabalho causar danos?',
    answer: 'Sim. Todos os profissionais verificados têm seguro de responsabilidade civil profissional obrigatório. Em caso de dano material ou corporal durante a intervenção, o seguro do profissional cobre os prejuízos.',
  },
  {
    question: 'As avaliações são reais?',
    answer: 'Absolutamente. Só pode deixar uma avaliação um cliente que realizou uma reserva paga e confirmada através da plataforma. Não aceitamos avaliações anónimas nem convidadas.',
  },
  {
    question: 'O que acontece se não ficar satisfeito?',
    answer: 'Contacte a nossa equipa nas 48h após a intervenção. Mediamos a situação com o profissional e garantimos uma solução: retrabalho gratuito ou reembolso total consoante o caso.',
  },
  {
    question: 'Com que frequência verificam os seguros dos profissionais?',
    answer: 'Os seguros são verificados anualmente. Caso um profissional não renove o seu seguro RC Pro, o badge "Verificado" é imediatamente suspenso até nova verificação.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Profissionais Verificados em Portugal — Garantia VITFIX',
      description: 'Informação sobre o processo de verificação dos profissionais VITFIX em Portugal.',
      url: 'https://vitfix.io/pt/profissionais-verificados/',
      inLanguage: 'pt-PT',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX Portugal', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Profissionais Verificados', item: 'https://vitfix.io/pt/profissionais-verificados/' },
        ],
      },
    },
    {
      '@type': 'Organization',
      name: 'VITFIX',
      url: 'https://vitfix.io/pt/',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating,
        reviewCount: totalReviews,
        bestRating: '5',
        worstRating: '1',
      },
      review: reviews.map(r => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: '5',
          worstRating: '1',
        },
        reviewBody: r.text,
        datePublished: r.date,
        itemReviewed: {
          '@type': 'Service',
          name: r.service,
          areaServed: { '@type': 'City', name: r.city },
        },
      })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
}

export default function ProfissionaisVerificadosPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX Portugal</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Profissionais Verificados</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🛡️</span>
            <span className="text-dark">Verificação rigorosa · Portugal</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Profissionais verificados — a garantia VITFIX
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Cada profissional na plataforma é verificado manualmente: identidade, seguro RC Pro e qualificações. Trabalhe com total confiança.
          </p>

          {/* Rating summary */}
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl px-6 py-4 border border-border/50 mb-8">
            <div className="text-center">
              <div className="font-display text-4xl font-extrabold text-yellow">{avgRating}</div>
              <div className="flex gap-0.5 justify-center mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className="text-yellow">★</span>
                ))}
              </div>
            </div>
            <div className="border-l border-border/50 pl-4">
              <div className="font-bold text-dark">{totalReviews} avaliações verificadas</div>
              <div className="text-sm text-text-muted">Deixadas por clientes reais</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Encontrar um profissional
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* VERIFICATION PROCESS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            O nosso processo de verificação
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            Antes de aparecer na plataforma, cada profissional passa por 4 etapas de verificação obrigatórias.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {verificationSteps.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl p-6 border border-border/50 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-yellow/10 flex items-center justify-center text-2xl">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-yellow uppercase tracking-widest mb-1">Etapa {i + 1}</div>
                  <h3 className="font-display font-bold text-dark mb-2">{step.title}</h3>
                  <p className="text-[0.93rem] text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            O que dizem os clientes em Portugal
          </h2>
          <p className="text-text-muted mb-10">Avaliações reais de clientes em Marco de Canaveses e região.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <div key={r.author} className="rounded-2xl border border-border/50 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-dark text-sm">{r.author}</p>
                    <p className="text-text-muted text-xs">{r.city}</p>
                  </div>
                  <span className="bg-yellow/10 text-dark text-xs font-semibold px-2 py-1 rounded-full">{r.service}</span>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={i <= r.rating ? 'text-yellow' : 'text-gray-300'}>★</span>
                  ))}
                </div>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed mb-3">&quot;{r.text}&quot;</p>
                <p className="text-xs text-text-muted">{r.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Perguntas sobre as nossas garantias
          </h2>
          <p className="text-text-muted mb-8">Tudo o que precisa de saber sobre a verificação e proteção VITFIX.</p>
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
              Pronto para confiar num profissional verificado?
            </h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Pesquise gratuitamente. Orçamento sem compromisso. Garantia de qualidade.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/pt/pesquisar/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Encontrar um profissional verificado
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href="/pt/como-funciona/"
                className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-8 py-4 text-base hover:bg-white/10 transition-all"
              >
                Ver como funciona
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
