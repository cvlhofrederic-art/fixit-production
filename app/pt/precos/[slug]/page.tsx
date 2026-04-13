import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

// ── Price data per service ──

interface PriceRow {
  service: string
  price: string
  note?: string
}

interface PriceGuideData {
  slug: string
  name: string
  icon: string
  intro: string
  prices: PriceRow[]
  factors: string[]
  regionContext: string
  faqs: { question: string; answer: string }[]
  relatedCities: { name: string; slug: string }[]
  relatedBlogSlugs: string[]
}

const PRICE_GUIDES: Record<string, PriceGuideData> = {
  canalizador: {
    slug: 'canalizador',
    name: 'Canalizador',
    icon: '\uD83D\uDEBF',
    intro: 'Os preços de canalização na região do Tâmega e Sousa variam consoante o tipo de intervenção. Desde uma simples reparação de torneira até à substituição completa de uma banheira por base de duche, apresentamos os valores de referência praticados por profissionais verificados na zona de Marco de Canaveses, Penafiel e Amarante.',
    prices: [
      { service: 'Deslocação e diagnóstico', price: '30 - 50€' },
      { service: 'Reparação de torneira', price: '40 - 80€' },
      { service: 'Substituição de torneira', price: '60 - 120€' },
      { service: 'Reparação de autoclismo', price: '30 - 70€' },
      { service: 'Desentupimento simples', price: '60 - 120€' },
      { service: 'Desentupimento com maquinaria', price: '120 - 250€' },
      { service: 'Reparação de fuga visível', price: '50 - 100€' },
      { service: 'Pesquisa de fuga oculta', price: '100 - 250€' },
      { service: 'Substituir banheira por base de duche', price: '1200 - 2500€' },
      { service: 'Reparação de esquentador', price: '60 - 150€' },
      { service: 'Revisão anual esquentador', price: '50 - 80€' },
      { service: 'Instalação de máquina de lavar', price: '40 - 80€' },
    ],
    factors: [
      'Tipo de intervenção (reparação vs. substituição completa)',
      'Urgência do serviço (intervenções fora de horário custam mais)',
      'Necessidade de pesquisa de fuga oculta com equipamento especializado',
      'Material e peças a substituir (torneira básica vs. premium)',
      'Acessibilidade das canalizações (paredes, pavimentos)',
      'Deslocação do profissional até ao local',
    ],
    regionContext: 'Na região do Tâmega e Sousa, os preços de canalização são geralmente 15-25% inferiores aos praticados no centro do Porto. Um desentupimento simples em Marco de Canaveses custa em média 60-120€, enquanto no Porto pode ultrapassar os 150€. A deslocação e diagnóstico mantém-se acessível entre 30 e 50€ na maioria dos casos.',
    faqs: [
      {
        question: 'Quanto custa chamar um canalizador para uma urgência?',
        answer: 'Uma intervenção urgente de canalização (fuga de água, rotura) custa entre 80 e 200€ na região do Tâmega e Sousa, dependendo da gravidade e do horário. Fora do horário normal (após as 20h ou fins de semana), pode ser aplicada uma taxa adicional de 30-50€.',
      },
      {
        question: 'O diagnóstico é cobrado mesmo se não fizer a reparação?',
        answer: 'Sim, a deslocação e diagnóstico tem um custo entre 30 e 50€. No entanto, muitos profissionais da VITFIX incluem este valor no orçamento final caso o cliente aceite o serviço de reparação.',
      },
      {
        question: 'Quanto custa substituir uma banheira por um poliban?',
        answer: 'A substituição de uma banheira por base de duche (poliban) custa entre 1200 e 2500€ na região. O preço inclui a remoção da banheira, preparação do espaço, instalação da base de duche, torneira e revestimentos. O valor depende dos materiais escolhidos e da complexidade da instalação.',
      },
      {
        question: 'Com que frequência devo fazer a revisão do esquentador?',
        answer: 'Recomenda-se uma revisão anual do esquentador, com um custo médio entre 50 e 80€. Esta revisão inclui a limpeza, verificação de segurança e ajuste da combustão. Um esquentador bem mantido dura mais tempo e consome menos gás.',
      },
    ],
    relatedCities: [
      { name: 'Marco de Canaveses', slug: 'marco-de-canaveses' },
      { name: 'Penafiel', slug: 'penafiel' },
      { name: 'Amarante', slug: 'amarante' },
    ],
    relatedBlogSlugs: ['como-desentupir-canos', 'poupar-agua-casa', 'sinais-fuga-agua'],
  },

  eletricista: {
    slug: 'eletricista',
    name: 'Eletricista',
    icon: '\u26A1',
    intro: 'Os preços de serviços elétricos na região do Tâmega e Sousa dependem da complexidade da intervenção. Desde a substituição de uma tomada até à instalação de painéis solares, apresentamos os valores de referência praticados por eletricistas verificados em Marco de Canaveses, Penafiel e Amarante.',
    prices: [
      { service: 'Deslocação e diagnóstico', price: '40 - 80€' },
      { service: 'Substituição de tomada/interruptor', price: '30 - 60€', note: 'por unidade' },
      { service: 'Instalação de ponto de luz', price: '40 - 80€' },
      { service: 'Trocar quadro elétrico completo', price: '300 - 600€' },
      { service: 'Instalação de disjuntor diferencial', price: '80 - 150€' },
      { service: 'Diagnóstico de curto-circuito', price: '50 - 100€' },
      { service: 'Certificação instalação elétrica', price: '150 - 300€' },
      { service: 'Instalação de ar condicionado', price: '300 - 600€' },
      { service: 'Instalação de painel solar', price: '500 - 1200€' },
    ],
    factors: [
      'Complexidade da instalação elétrica existente',
      'Necessidade de certificação ou relatório técnico',
      'Tipo de equipamento a instalar (básico vs. premium)',
      'Extensão da cablagem necessária',
      'Conformidade com normas de segurança em vigor',
      'Acesso ao quadro elétrico e canalizações técnicas',
    ],
    regionContext: 'Na região do Tâmega e Sousa, os preços de eletricidade são competitivos comparados com o Porto. A substituição de um quadro elétrico completo custa entre 300 e 600€, valor que pode ser 20-30% superior na zona metropolitana do Porto. A certificação elétrica, obrigatória para venda ou arrendamento de imóveis, situa-se entre 150 e 300€.',
    faqs: [
      {
        question: 'Quanto custa trocar o quadro elétrico de uma casa?',
        answer: 'A substituição completa de um quadro elétrico custa entre 300 e 600€ na região do Tâmega e Sousa. O preço depende do número de circuitos, da necessidade de cablagem adicional e do tipo de disjuntores instalados. Inclui geralmente os materiais e mão de obra.',
      },
      {
        question: 'Preciso de certificação elétrica para vender a minha casa?',
        answer: 'Sim, a certificação da instalação elétrica é obrigatória para a venda ou arrendamento de imóveis em Portugal. O custo da certificação situa-se entre 150 e 300€ e inclui a inspeção completa da instalação, emissão do certificado e eventual relatório de anomalias.',
      },
      {
        question: 'Quanto custa instalar ar condicionado?',
        answer: 'A instalação de um sistema de ar condicionado custa entre 300 e 600€ (apenas mão de obra e instalação). O preço varia consoante o tipo de equipamento (split, multi-split), a localização da unidade exterior e a necessidade de furações ou cablagem adicional. O equipamento é cobrado à parte.',
      },
      {
        question: 'Vale a pena instalar painéis solares na região?',
        answer: 'A instalação de painéis solares custa entre 500 e 1200€ (mão de obra). A região do Tâmega e Sousa tem boa exposição solar, com um retorno do investimento estimado em 5 a 8 anos. Os painéis solares podem reduzir a fatura elétrica em 50 a 70%.',
      },
    ],
    relatedCities: [
      { name: 'Marco de Canaveses', slug: 'marco-de-canaveses' },
      { name: 'Penafiel', slug: 'penafiel' },
      { name: 'Amarante', slug: 'amarante' },
    ],
    relatedBlogSlugs: ['seguranca-eletrica-casa', 'certificacao-eletrica', 'paineis-solares-portugal'],
  },

  pintor: {
    slug: 'pintor',
    name: 'Pintor',
    icon: '\uD83C\uDFA8',
    intro: 'Os preços de pintura na região do Tâmega e Sousa variam consoante a área, o tipo de superfície e os acabamentos escolhidos. Apresentamos os valores de referência praticados por pintores profissionais verificados em Marco de Canaveses, Penafiel e Amarante.',
    prices: [
      { service: 'Pintura interior por m\u00B2', price: '5 - 10€/m\u00B2' },
      { service: 'Pintura de divisão (12-15m\u00B2)', price: '150 - 300€' },
      { service: 'Pintura apartamento T2 completo', price: '800 - 1500€' },
      { service: 'Pintura exterior fachada por m\u00B2', price: '8 - 15€/m\u00B2' },
      { service: 'Tratamento anti-humidade + pintura', price: '15 - 25€/m\u00B2' },
      { service: 'Lacagem de portas (unidade)', price: '40 - 80€' },
      { service: 'Aplicação de massa corrida', price: '5 - 8€/m\u00B2' },
      { service: 'Aplicação de estuque', price: '10 - 18€/m\u00B2' },
      { service: 'Pintura de teto', price: '6 - 12€/m\u00B2' },
    ],
    factors: [
      'Área total a pintar (m\u00B2)',
      'Estado das paredes (necessidade de preparação ou reparação)',
      'Tipo de tinta escolhida (acrílica, esmalte, epoxy)',
      'Número de demãos necessárias',
      'Trabalho em altura (andaimes para fachadas)',
      'Tratamentos adicionais (anti-humidade, impermeabilização)',
    ],
    regionContext: 'Na região do Tâmega e Sousa, a pintura interior custa em média 5-10€/m\u00B2, valor cerca de 20% inferior ao praticado no Porto. A pintura completa de um apartamento T2 fica entre 800 e 1500€, incluindo preparação de superfícies e duas demãos de tinta. Para fachadas exteriores, o custo é superior (8-15€/m\u00B2) devido à necessidade de andaimes e tintas especiais.',
    faqs: [
      {
        question: 'Quanto custa pintar um apartamento T2?',
        answer: 'A pintura completa de um apartamento T2 (sala, quartos, cozinha, casa de banho e corredores) custa entre 800 e 1500€ na região do Tâmega e Sousa. O preço inclui a preparação das superfícies, aplicação de primário e duas demãos de tinta. Não inclui o tratamento de humidades ou reparações estruturais.',
      },
      {
        question: 'A tinta está incluída no preço?',
        answer: 'Depende do profissional. Alguns pintores incluem a tinta no orçamento, enquanto outros cobram separadamente. Na VITFIX, recomendamos pedir um orçamento detalhado que discrimine mão de obra e materiais. Em média, a tinta de qualidade custa entre 20 e 50€ por lata de 15L.',
      },
      {
        question: 'Quanto tempo demora a pintar uma divisão?',
        answer: 'A pintura de uma divisão de 12-15m\u00B2 demora geralmente 1 a 2 dias, incluindo a preparação (proteção do chão, fita de pintor) e duas demãos. O tempo pode aumentar se for necessário reparar fissuras, aplicar massa corrida ou tratar humidades.',
      },
      {
        question: 'Como tratar a humidade antes de pintar?',
        answer: 'O tratamento anti-humidade antes da pintura custa entre 15 e 25€/m\u00B2 e inclui a limpeza do bolor, aplicação de produto anti-fungos, impermeabilização e pintura final com tinta anti-humidade. É essencial tratar a causa da humidade (infiltração, condensação) antes de pintar.',
      },
    ],
    relatedCities: [
      { name: 'Marco de Canaveses', slug: 'marco-de-canaveses' },
      { name: 'Penafiel', slug: 'penafiel' },
      { name: 'Amarante', slug: 'amarante' },
    ],
    relatedBlogSlugs: ['como-escolher-tinta', 'preparar-paredes-pintura', 'humidade-paredes-solucoes'],
  },
}

const VALID_SLUGS = ['canalizador', 'eletricista', 'pintor'] as const

// ── Static params ──
export function generateStaticParams() {
  return VALID_SLUGS.map(slug => ({ slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = PRICE_GUIDES[slug]
  if (!guide) return {}

  const title = `Tabela de Preços ${guide.name} 2026 — Região do Porto | VITFIX`
  const description = `Consulte os preços de ${guide.name.toLowerCase()} em Marco de Canaveses, Penafiel e Amarante. Valores de referência atualizados para 2026.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'VITFIX',
      locale: 'pt_PT',
      type: 'website',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `https://vitfix.io/pt/precos/${slug}/`,
    },
  }
}

// ── Page Component ──
export default async function PrecosServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = PRICE_GUIDES[slug]
  if (!guide) notFound()

  // Schema.org FAQPage + BreadcrumbList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Preços', item: 'https://vitfix.io/pt/precos/' },
          { '@type': 'ListItem', position: 3, name: `Preços ${guide.name}`, item: `https://vitfix.io/pt/precos/${slug}/` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* -- HERO -- */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/precos/" className="hover:text-yellow transition">Preços</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Preços {guide.name}</span>
          </nav>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{guide.icon}</span>
            <span className="text-dark">{guide.name} · Preços 2026</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Tabela de Preços {guide.name} 2026
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            {guide.intro}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Pedir orçamento grátis
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href="https://wa.me/351920043853?text=Ol%C3%A1%20VITFIX%2C%20gostaria%20de%20pedir%20um%20or%C3%A7amento"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all"
            >
              Contactar-nos
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Preços atualizados 2026</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento grátis</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Sem compromisso</span>
          </div>
        </div>
      </section>

      {/* -- PRICE TABLE -- */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Tabela de preços — {guide.name}
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Valores de referência praticados na região do Tâmega e Sousa. Os preços incluem mão de obra e podem variar consoante a complexidade do trabalho.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-border/50 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-6 py-4 font-display font-bold text-dark text-[0.93rem]">Serviço</th>
                  <th className="px-6 py-4 font-display font-bold text-dark text-[0.93rem] text-right">Preço indicativo</th>
                </tr>
              </thead>
              <tbody>
                {guide.prices.map((row, i) => (
                  <tr key={i} className={`border-b border-border/30 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-warm-gray/50'}`}>
                    <td className="px-6 py-4 text-[0.93rem] text-dark">
                      {row.service}
                      {row.note && <span className="ml-2 text-xs text-text-muted">({row.note})</span>}
                    </td>
                    <td className="px-6 py-4 text-[0.93rem] font-semibold text-dark text-right whitespace-nowrap">
                      {row.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-text-muted">
            * Preços indicativos atualizados em 2026. Valores podem variar consoante a complexidade, urgência e materiais. Peça sempre um orçamento personalizado.
          </p>
        </div>
      </section>

      {/* -- FACTORS AFFECTING PRICE -- */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Fatores que influenciam o preço
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            O preço final de um serviço de {guide.name.toLowerCase()} depende de vários fatores. Conheça os principais para entender melhor os orçamentos que recebe.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {guide.factors.map((factor, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-warm-gray rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                <span className="text-[0.93rem] text-dark leading-relaxed">{factor}</span>
              </div>
            ))}
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
          <div className="p-6 md:p-8 bg-white rounded-2xl border border-border/50 mt-6">
            <p className="text-[0.95rem] text-dark leading-relaxed">
              {guide.regionContext}
            </p>
          </div>

          {/* City links */}
          <div className="mt-8">
            <h3 className="font-display text-xl font-bold mb-4">
              {guide.name} nas principais cidades
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {guide.relatedCities.map(city => (
                <Link
                  key={city.slug}
                  href={`/pt/servicos/${guide.slug}-${city.slug}/`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
                >
                  <span className="text-xl">{guide.icon}</span>
                  <div>
                    <span className="font-semibold text-dark group-hover:text-yellow transition-colors">{guide.name} em {city.name}</span>
                    <span className="block text-xs text-text-muted">Ver profissionais</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- URGENCY CTA -- */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 text-center" style={{ background: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3E0 50%, #FFE0B2 100%)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-yellow/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <span className="text-4xl mb-4 block">💰</span>
              <h3 className="font-display text-xl md:text-2xl font-bold text-dark mb-3">
                Quer um orçamento exato?
              </h3>
              <p className="text-text-muted mb-6 max-w-lg mx-auto leading-relaxed">
                Os preços indicados são valores de referência. Para um orçamento personalizado e sem compromisso, contacte um dos nossos profissionais verificados.
              </p>
              <Link
                href="/pt/pesquisar/"
                className="inline-flex items-center gap-2 bg-dark text-white font-display font-bold rounded-full px-8 py-3.5 text-[0.95rem] hover:bg-mid transition-all"
              >
                Encontrar {guide.name.toLowerCase()} agora
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -- FAQ -- */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Perguntas frequentes — Preços {guide.name}
          </h2>
          <p className="text-text-muted mb-8">
            Respostas às dúvidas mais comuns sobre os preços de serviços de {guide.name.toLowerCase()}.
          </p>
          <div className="space-y-4">
            {guide.faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.question}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* -- RELATED BLOG -- */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Artigos relacionados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {guide.relatedBlogSlugs.map(blogSlug => (
              <Link
                key={blogSlug}
                href={`/pt/blog/${blogSlug}/`}
                className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{guide.icon}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-yellow">Guia</span>
                </div>
                <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors mb-2 capitalize">
                  {blogSlug.replace(/-/g, ' ')}
                </h3>
                <p className="text-sm text-text-muted">Ler artigo completo</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -- OTHER PRICE GUIDES -- */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Outros guias de preços
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VALID_SLUGS.filter(s => s !== slug).map(otherSlug => {
              const other = PRICE_GUIDES[otherSlug]
              return (
                <Link
                  key={otherSlug}
                  href={`/pt/precos/${otherSlug}/`}
                  className="p-6 bg-warm-gray rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
                >
                  <span className="text-3xl block mb-3">{other.icon}</span>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">Preços {other.name}</span>
                  <span className="block text-sm text-text-muted mt-1">Ver tabela completa</span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* -- BOTTOM CTA -- */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de um {guide.name.toLowerCase()} na região?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Encontre profissionais verificados perto de si em poucos cliques. Orçamento grátis, sem compromisso.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Encontrar {guide.name.toLowerCase()} agora
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
