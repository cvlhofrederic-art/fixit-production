import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_PT } from '@/lib/constants'

// Phase 1 SEO PT : marque une fois (template du layout), description à 155 caractères.
export const metadata: Metadata = {
  title: 'Como verificamos cada profissional: identidade e seguro',
  description: 'Como a VITFIX verifica cada profissional: identidade, seguro de responsabilidade civil, qualificações e experiência, antes de publicar o perfil.',
  openGraph: {
    title: 'Profissionais Verificados em Portugal : Garantia VITFIX',
    description: 'Seguro RC Pro, identidade verificada, avaliações reais. Confie nos profissionais do VITFIX para os seus trabalhos em casa.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/api/og/?locale=pt', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Profissionais Verificados : Garantia VITFIX',
    description: 'RC Pro, identidade e qualificações verificadas. Profissionais de confiança em Portugal.',
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/profissionais-verificados/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/profissionais-verificados/',
      'fr-FR': 'https://vitfix.io/fr/artisans-verifies/',
      'x-default': 'https://vitfix.io/fr/artisans-verifies/',
    },
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

// Phase 3 SEO PT (lot 0) : les avis nominatifs fictifs, la note moyenne et le nombre d'avis ont été retirés
// (règle 0.2) ; les avis réels viendront de booking_reviews avec autorisation écrite (data/seo/local-proof.json).

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
    answer: 'Contacte a nossa equipa nas 48h após a intervenção. Mediamos a situação com o profissional e mediamos a situação com o profissional.',
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
      name: 'Profissionais Verificados em Portugal : Garantia VITFIX',
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
    // Phase 1 SEO PT (point 1.6) : plus d'aggregateRating ni de Review auto-attribués (inéligibles
    // et contraires à la politique de lib/schemas/index.ts), plus de FAQPage (résultat enrichi retiré).
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
            Profissionais verificados, a garantia VITFIX
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Cada profissional na plataforma é verificado manualmente: identidade, seguro RC Pro e qualificações. Trabalhe com total confiança.
          </p>

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
              Pesquise gratuitamente. Orçamento sem compromisso.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/pt/pesquisar/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Encontrar um profissional verificado
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <a
                href={`tel:${PHONE_PT}`}
                className="inline-flex items-center gap-2 bg-white text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-white/90 transition-all"
              >
                📞 Ligar +351 912 014 971
              </a>
              <a
                href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent('Olá VITFIX, preciso de um profissional verificado.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] transition-all"
              >
                💬 WhatsApp
              </a>
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
