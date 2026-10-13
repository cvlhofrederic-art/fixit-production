import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SERVICES, CITIES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'
import { pluralizarServico as pluralizar } from '@/lib/seo/pt-pluralize'
import { ogImageMeta } from '@/lib/og'
import { tituloPertoDeMim, descricaoPertoDeMim, nomeDistrito } from '@/lib/seo/pt-meta'
import { grafo, noFilAriane, noServicoRegional } from '@/lib/seo/pt-schemas'
import { metodoPara } from '@/lib/seo/pt-provas-locais'

// ─────────────────────────────────────────────────────────────
// HUB MÉTIER : /pt/perto-de-mim/{metier}/ (21 pages)
//
// Phase 2 SEO PT (consolidation, décisions 1 et 2) : les 484 pages métier x ville de ce modèle
// et le hub « picheleiro » répondent 301 vers /pt/servicos/ (middleware.ts). Ce hub lie les
// 22 pages ville du métier ; son contenu propre au métier est l'objet de la phase 3.
// `dynamicParams = false` : tout autre slug finit en 404, jamais en 200 générique.
// ─────────────────────────────────────────────────────────────
export const dynamicParams = false

export function generateStaticParams() {
  return SERVICES.map(s => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const service = SERVICES.find(s => s.slug === slug)
  if (!service) return {}

  // Phase 1 SEO PT : marque une fois (template du layout), description propre, pas d'alternate
  // hreflang (aucune page FR équivalente).
  const title = tituloPertoDeMim(service.name)
  const description = descricaoPertoDeMim(service.name)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'VITFIX',
      locale: 'pt_PT',
      type: 'website',
      images: ogImageMeta({ title, locale: 'pt' }),
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `https://vitfix.io/pt/perto-de-mim/${slug}/` },
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED SVG
// ─────────────────────────────────────────────────────────────
const WaSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const PhoneSvg = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────
export default async function HubMetierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = SERVICES.find(s => s.slug === slug)
  if (!service) notFound()

  const displayName = service.name
  const otherServices = SERVICES.filter(s => s.slug !== service.slug)
  const metodo = metodoPara(service.slug)
  const urgencyTexto = service.urgencyText.replace(/\s*em \{city\}/g, '').replace(/\{city\}/g, 'Portugal')

  const waText = `Olá! Preciso de ${displayName.toLowerCase()} perto de mim. Podem ajudar?`
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(waText)}`
  const waUrgText = `URGÊNCIA! Preciso de ${displayName.toLowerCase()} urgente perto de mim. Podem vir rapidamente?`
  const waUrgHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(waUrgText)}`

  // JSON-LD : un `Service` fourni par l'entité unique (#business) dans les 22 concelhos, plus le fil
  // d'Ariane. Aucun délai ni horaire : aucune donnée réelle disponible (règle 0.2 des instructions).
  const urlPagina = `https://vitfix.io/pt/perto-de-mim/${slug}/`
  const jsonLd = grafo(
    noServicoRegional({
      url: urlPagina,
      nome: `${displayName} perto de mim`,
      serviceType: displayName,
      descricao: descricaoPertoDeMim(displayName),
    }),
    noFilAriane([
      { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
      { name: 'Perto de Mim', url: 'https://vitfix.io/pt/perto-de-mim/' },
      { name: `${displayName} perto de mim`, url: urlPagina },
    ]),
  )

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18"
        style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/perto-de-mim/" className="hover:text-yellow transition">Perto de Mim</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{displayName}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{service.icon}</span>
            <span className="text-dark">{displayName} · {CITIES.length} concelhos</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {displayName} Perto de Mim
          </h1>

          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Encontre {pluralizar(displayName)} verificados perto de si em {CITIES.length} concelhos dos distritos do Porto, Braga e Aveiro. Orçamento grátis, sem compromisso.
            {service.slug === 'canalizador' ? ' No Norte de Portugal, o canalizador é também chamado de picheleiro.' : ''}
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 20px rgba(37,211,102,0.35)' }}
            >
              <WaSvg />
              WhatsApp
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all"
            >
              <PhoneSvg />
              +351 912 014 971
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento grátis</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> {CITIES.length} concelhos cobertos</span>
          </div>
        </div>
      </section>

      {/* ── CITIES GRID : les 22 pages métier x ville (modèle servicos) ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            {displayName} perto de si, escolha o seu concelho
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Selecione o seu concelho para ver a página de {displayName.toLowerCase()} na sua zona.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {CITIES.map(c => (
              <Link
                key={c.slug}
                href={`/pt/servicos/${service.slug}-${c.slug}/`}
                className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{service.icon}</span>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{c.name}</span>
                </div>
                <div className="space-y-1 text-sm text-text-muted">
                  <p>{c.population.toLocaleString('pt-PT')} habitantes</p>
                  <p>Distrito {nomeDistrito(c.distrito)}</p>
                </div>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-yellow">
                  {displayName} em {c.name}
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÉTHODE DU MÉTIER (phase 3 SEO PT, bloc métier du gabarit 3.2) ── */}
      {metodo && (
        <section id="metodo" className="py-14 md:py-18 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-4">
              Como a VITFIX trabalha: {displayName.toLowerCase()}
            </h2>
            <p className="text-dark/85 leading-relaxed max-w-3xl whitespace-pre-line">{metodo}</p>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            O que faz um {displayName.toLowerCase()} perto de si?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {service.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-warm-gray rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                <span className="text-[0.93rem] text-dark leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── URGENCY BLOCK ── */}
      <section id="urgencia" className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-2xl p-8 md:p-12"
            style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}
          >
            <div className="absolute top-0 right-0 w-56 h-56 bg-yellow/8 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <span className="text-yellow font-bold text-sm uppercase tracking-wider">Urgência</span>
                </div>
                <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
                  Precisa de {displayName.toLowerCase()} urgente?
                </h3>
                <p className="text-white/70 max-w-lg leading-relaxed text-[0.93rem]">{urgencyTexto}</p>
                {service.urgency.whenToCall.length > 0 && (
                  <ul className="mt-4 space-y-1 text-white/70 text-[0.9rem]">
                    {service.urgency.whenToCall.slice(0, 4).map((item, i) => (
                      <li key={i} className="flex items-start gap-2"><span className="text-yellow">•</span><span>{item.replace(/\{city\}/g, 'Portugal')}</span></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
                <a
                  href={waUrgHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:-translate-y-0.5 transition-all whitespace-nowrap"
                  style={{ background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.4)' }}
                >
                  <WaSvg />
                  WhatsApp, Urgência
                </a>
                <a
                  href={`tel:${PHONE_PT}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:-translate-y-0.5 transition-all whitespace-nowrap"
                >
                  <PhoneSvg />
                  +351 912 014 971
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── OTHER SERVICES (hubs métier) ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Outros serviços perto de mim
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {otherServices.map(os => (
              <Link
                key={os.slug}
                href={`/pt/perto-de-mim/${os.slug}/`}
                className="p-6 bg-warm-gray rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">{os.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{os.name}</span>
                <span className="block text-sm text-text-muted mt-1">Perto de mim</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ (visible, sans FAQPage : résultat enrichi retiré par Google) ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Perguntas frequentes, {displayName} perto de mim
          </h2>
          <div className="space-y-4">
            <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                <span className="text-[0.95rem]">Como encontrar um {displayName.toLowerCase()} perto de mim?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                Escolha o seu concelho na lista acima, ou contacte-nos diretamente por WhatsApp ou telefone com a sua localização: indicamos-lhe os profissionais verificados disponíveis na sua zona.
              </div>
            </details>

            {service.slug === 'canalizador' ? (
              <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">O que é um picheleiro? É diferente de um canalizador?</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  &ldquo;Picheleiro&rdquo; é o nome regional no Norte de Portugal para o que no resto do país se chama &ldquo;canalizador&rdquo;. É exatamente o mesmo profissional: fugas de água, desentupimentos, reparação de esquentadores e caldeiras, instalações de canalização.
                </div>
              </details>
            ) : (
              <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">Quanto custa um {displayName.toLowerCase()} perto de mim?</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {(service.faqs[0]?.answer || 'O custo varia conforme o tipo de serviço e a complexidade do trabalho. Na VITFIX, o orçamento é sempre gratuito e sem compromisso.').replace(/\{city\}/g, 'Portugal')}
                </div>
              </details>
            )}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de um {displayName.toLowerCase()} perto de si?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Contacte-nos diretamente. Orçamento gratuito, sem compromisso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.4)' }}
            >
              <WaSvg />
              WhatsApp
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              <PhoneSvg />
              +351 912 014 971
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
