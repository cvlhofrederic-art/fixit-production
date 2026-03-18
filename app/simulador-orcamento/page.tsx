import type { Metadata } from 'next'
import SimuladorOrcamentoClient from './SimuladorOrcamentoClient'

export const metadata: Metadata = {
  title: 'Simulador de Orçamento Grátis — Calcule o custo das suas obras | VITFIX',
  description: 'Simule o orçamento das suas obras em 2 minutos: canalização, eletricidade, pintura, serralharia, telhado, jardinagem e mais. Grátis e sem compromisso.',
  keywords: ['simulador orçamento', 'orçamento grátis', 'quanto custa obras', 'preço profissional 2026'],
  alternates: {
    canonical: 'https://vitfix.io/pt/simulador-orcamento/',
  },
  openGraph: {
    title: 'Simulador de Orçamento Grátis — VITFIX',
    description: 'Simule o orçamento das suas obras em 2 minutos. Grátis e sem compromisso.',
    url: 'https://vitfix.io/pt/simulador-orcamento/',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
}

const FAQ_SIMULADOR = [
  {
    question: 'Quanto custa um canalizador em Portugal?',
    answer: 'Um canalizador em Portugal cobra entre 40€ e 120€ por intervenção simples (fuga, torneira). Trabalhos maiores (instalação completa, remodelação WC) custam 200€ a 2.000€. Urgências têm suplemento de 30-50%.',
  },
  {
    question: 'Quanto custa remodelar uma casa de banho?',
    answer: 'A remodelação completa de uma casa de banho em Portugal custa entre 2.500€ e 10.000€ (250€ a 600€/m²), dependendo dos materiais e acabamentos escolhidos.',
  },
  {
    question: 'Como encontrar um profissional barato e fiável?',
    answer: 'Na VITFIX, todos os profissionais são verificados (NIF, seguro RC, qualificações). Compare perfis, avaliações e tarifas antes de reservar. O orçamento é sempre grátis.',
  },
  {
    question: 'Existem apoios do Estado para obras em casa?',
    answer: 'Sim. Em Portugal existem vários apoios: IVA reduzido a 6% para reabilitação urbana, Fundo Ambiental para eficiência energética, programas municipais de reabilitação, e isenção de IMI para imóveis reabilitados.',
  },
  {
    question: 'O orçamento é mesmo gratuito?',
    answer: 'Sim, o orçamento através da VITFIX é 100% gratuito e sem compromisso. O profissional avalia o trabalho e apresenta o orçamento detalhado antes de qualquer obra.',
  },
]

export default function SimuladorOrcamentoPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Simulador de Orçamento — VITFIX Portugal',
        url: 'https://vitfix.io/pt/simulador-orcamento/',
        description: 'Simule o orçamento das suas obras em Portugal. Gratuito e sem compromisso.',
        inLanguage: 'pt-PT',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Simulador de Orçamento', item: 'https://vitfix.io/pt/simulador-orcamento/' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_SIMULADOR.map(faq => ({
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SimuladorOrcamentoClient />

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-dark text-center mb-8">
            Perguntas frequentes sobre orçamentos
          </h2>
          <div className="space-y-4">
            {FAQ_SIMULADOR.map((faq, i) => (
              <details key={i} className="group bg-warm-gray rounded-xl border border-border/50">
                <summary className="flex items-center justify-between p-5 cursor-pointer font-display font-bold text-dark text-sm">
                  {faq.question}
                  <span className="text-yellow group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-text-muted leading-relaxed">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
