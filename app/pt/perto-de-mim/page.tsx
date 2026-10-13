import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'
import { grafo, noFilAriane, noWebPage } from '@/lib/seo/pt-schemas'

// Phase 1 SEO PT : marque une fois (template du layout), faits réels (21 serviços, 22 concelhos).
// Phase 2 (point 3.5) : hub des 21 hubs métier ; plus de liens vers les pages métier x ville du
// modèle perto-de-mim (308 vers servicos) ni vers « picheleiro » (308 vers canalizador).
export const metadata: Metadata = {
  title: `Profissionais perto de mim: ${SERVICES.length} serviços em ${CITIES.length} concelhos`,
  description: `Eletricista, canalizador, pintor ou faz-tudo perto de si: ${SERVICES.length} serviços em ${CITIES.length} concelhos do Porto, Braga e Aveiro. Orçamento grátis pelo site ou WhatsApp.`,
  openGraph: {
    title: 'Profissionais Perto de Mim : VITFIX',
    description: 'Encontre um profissional verificado perto de si em 22 concelhos do Porto, Braga e Aveiro.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/api/og/?locale=pt', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/perto-de-mim/',
  },
}

const jsonLd = grafo(
  noWebPage({ url: 'https://vitfix.io/pt/perto-de-mim/', nome: 'Profissionais perto de mim', descricao: `${SERVICES.length} serviços em ${CITIES.length} concelhos do Porto, Braga e Aveiro.` }),
  noFilAriane([
    { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
    { name: 'Perto de mim', url: 'https://vitfix.io/pt/perto-de-mim/' },
  ]),
)

export default function PertoMimHubPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Perto de mim</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>📍</span>
            <span className="text-dark">Profissionais perto de si</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Encontre um profissional perto de si
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Escolha o serviço, depois o seu concelho, para encontrar profissionais verificados na sua zona: {CITIES.length} concelhos dos distritos do Porto, Braga e Aveiro. Orçamento grátis, sem compromisso.
          </p>
        </div>
      </section>

      {/* ── SERVICES GRID : les 21 hubs métier ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Que serviço procura?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SERVICES.map(service => (
              <Link
                key={service.slug}
                href={`/pt/perto-de-mim/${service.slug}/`}
                className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-3xl">{service.icon}</span>
                <div>
                  <span className="font-display font-bold text-dark text-lg group-hover:text-yellow transition-colors">{service.name}</span>
                  <span className="block text-sm text-text-muted">{service.slug === 'canalizador' ? 'Também chamado de picheleiro' : 'Perto de mim'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES SECTION ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Concelhos onde atuamos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/cidade/${city.slug}/`}
                className="p-5 bg-warm-gray rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group text-center"
              >
                <span className="text-2xl block mb-2">📍</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{city.name}</span>
                <span className="block text-xs text-text-muted mt-1">{city.population.toLocaleString('pt-PT')} hab.</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de ajuda agora?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Encontre profissionais verificados perto de si em poucos cliques. Orçamento grátis, sem compromisso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Pesquisar profissional
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-dark text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-dark/90 hover:-translate-y-0.5 transition-all"
            >
              📞 Ligar +351 912 014 971
            </a>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
