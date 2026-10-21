import Link from 'next/link'
import { CITIES } from '@/lib/data/seo-pages-data'
import type { ServicoDistrito } from '@/lib/data/pt-servicos-distrito'
import { PHONE_PT } from '@/lib/constants'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { descricaoServicoDistrito, nomeDistrito } from '@/lib/seo/pt-meta'
import { grafo, noFilAriane, noServicoDistrito } from '@/lib/seo/pt-schemas'
import { chantiersDistritoPara, mesPorExtenso, prazoDistritoPara, precosPara } from '@/lib/seo/pt-provas-locais'

// Page de service à l'échelle du district (/pt/servicos/{slug}/, lib/data/pt-servicos-distrito.ts). Même
// langage visuel que les pages métier x ville (app/pt/servicos/[slug]/page.tsx). Blocs de données réelles
// (#chantiers, #prazos, #precos) rendus seulement quand data/seo/local-proof.json les contient (règle 0.2) ;
// JSON-LD : Service fourni par #business sur le distrito, fil d'Ariane ; pas de FAQPage (FAQ visible seulement).

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

const tituloSeccao = 'font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark'

export default function PaginaServicoDistrito({ servico }: { servico: ServicoDistrito }) {
  const urlPagina = `https://vitfix.io/pt/servicos/${servico.slug}/`
  const distritoTexto = `distrito ${nomeDistrito(servico.distrito)}`
  const cidades = CITIES.filter((c) => c.distrito === servico.distrito)
  const chantiers = chantiersDistritoPara(servico.slug, cidades.map((c) => c.slug))
  const precos = precosPara(servico.slug)
  const prazo = prazoDistritoPara(servico.distrito, servico.slug)
  const nomeCidade = (slug: string) => CITIES.find((c) => c.slug === slug)?.name ?? slug
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(servico.mensagemWhatsapp)}`

  // Fonds alternés calculés sur les sections réellement rendues (deux sont conditionnelles) : section blanche,
  // cartes grises, et inversement, comme sur app/pt/servicos/[slug]/page.tsx.
  const seccoes = ['servicos', ...(chantiers.length ? ['chantiers'] : []), 'preco', 'metodo', 'quando', ...(servico.aviso ? ['fibrocimento'] : []), 'zona', 'relacionados', 'perguntas', 'cta']
  const branca = (id: string) => seccoes.indexOf(id) % 2 === 1
  const fundo = (id: string) => (branca(id) ? ' bg-white' : '')
  const cartao = (id: string) => (branca(id) ? 'bg-warm-gray' : 'bg-white')
  const num = (n: number) => n.toLocaleString('pt-PT')

  const jsonLd = grafo(
    noServicoDistrito({
      url: urlPagina,
      nome: servico.h1,
      serviceType: servico.tipoServico,
      descricao: descricaoServicoDistrito(servico),
      distrito: servico.distrito,
    }),
    noFilAriane([
      { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
      { name: 'Serviços', url: 'https://vitfix.io/pt/servicos/' },
      { name: servico.nome, url: urlPagina },
    ]),
  )

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/servicos/" className="hover:text-yellow transition">Serviços</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{servico.nome}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{servico.icon}</span>
            <span className="text-dark">{servico.nome} · Distrito {nomeDistrito(servico.distrito)}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {servico.h1}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">{servico.intro}</p>

          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <WaSvg />
              Pedir orçamento por WhatsApp
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              <PhoneSvg />
              {TELEFONE_PT_TEXTE}
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Equipa VITFIX</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento grátis</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Atendimento telefónico 7 dias por semana</span>
            {prazo?.visita_horas_max && (
              <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Visita em {prazo.visita_horas_max} horas, no máximo</span>
            )}
          </div>
        </div>
      </section>

      {/* ── PRESTATIONS (confirmées par le propriétaire) ── */}
      <section id="servicos" className={`py-12 md:py-16${fundo('servicos')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${tituloSeccao} mb-6`}>O que fazemos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servico.prestacoes.map((p) => (
              <article key={p.titulo} className={`p-6 rounded-2xl ${cartao('servicos')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{p.titulo}</h3>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed">{p.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHANTIERS RÉELS (data/seo/local-proof.json) ── */}
      {chantiers.length > 0 && (
        <section id="chantiers" className={`py-12 md:py-16${fundo('chantiers')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`${tituloSeccao} mb-2`}>Trabalhos realizados no {distritoTexto}</h2>
            <p className="text-text-muted text-sm mb-6 max-w-2xl">Intervenções reais da equipa no distrito.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chantiers.map((c, i) => (
                <article key={i} className={`p-5 rounded-2xl ${cartao('chantiers')} border border-border/40 flex gap-4`}>
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-yellow/15 flex items-center justify-center text-base font-bold text-dark">{i + 1}</span>
                  <p className="text-sm text-dark/85 leading-relaxed">
                    {c.tipo}{c.quantidade ? `, ${c.quantidade}` : ''}, {nomeCidade(c.cidade)}{c.freguesia ? ` (${c.freguesia})` : ''} · {mesPorExtenso(c.mes)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRIX : facteurs toujours visibles ; fourchettes réelles seulement si fournies ── */}
      <section id="preco" className={`py-12 md:py-16${fundo('preco')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className={`${tituloSeccao} mb-4`}>{servico.titulos.preco}</h2>
            <p className="text-dark/85 leading-relaxed mb-4">O preço depende sobretudo destes fatores:</p>
            <ul className="space-y-2 text-[0.93rem] text-dark/85">
              {servico.fatoresPreco.map((f) => (
                <li key={f} className="flex items-start gap-2"><span className="text-yellow font-bold">•</span><span>{f}</span></li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 content-start">
            {precos.length > 0 && (
              <div id="precos" className={`p-6 rounded-2xl ${cartao('preco')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-3">Preços praticados</h3>
                <ul className="space-y-2 text-sm text-dark/85">
                  {precos.map((p, i) => (
                    <li key={i}>
                      {p.servico ? `${p.servico}: ` : ''}{num(p.min)} a {num(p.max)} € por {p.unite}{p.fonte ? ` (${p.fonte})` : ''}.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {prazo && (
              <div id="prazos" className={`p-6 rounded-2xl ${cartao('preco')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{prazo.visita_horas_max ? 'Prazo de visita' : 'Prazos constatados'}</h3>
                <p className="text-sm text-dark/85">{prazo.visita_horas_max ? `Visitamos o telhado em ${prazo.visita_horas_max} horas, no máximo` : `Primeira visita em ${prazo.visita_dias} dia${prazo.visita_dias > 1 ? 's' : ''}`}{prazo.intervencao_dias ? `, intervenção em ${prazo.intervencao_dias} dia${prazo.intervencao_dias > 1 ? 's' : ''}` : ''}.</p>
                <p className="text-xs text-text-muted mt-2">Fonte: {prazo.fonte}.</p>
              </div>
            )}
            <div className="p-6 rounded-2xl bg-yellow/10 border border-yellow/25">
              <p className="text-[0.93rem] text-dark/85 leading-relaxed">
                {servico.textoOrcamento} {TELEFONE_PT_TEXTE}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÉTHODE (séquence réelle du travail) ── */}
      <section id="metodo" className={`py-12 md:py-16${fundo('metodo')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${tituloSeccao} mb-6`}>{servico.titulos.metodo}</h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servico.metodo.map((p, i) => (
              <li key={p.titulo} className={`p-5 rounded-2xl ${cartao('metodo')} border border-border/40 flex gap-4`}>
                <span className="shrink-0 w-9 h-9 rounded-lg bg-yellow/15 flex items-center justify-center text-base font-bold text-dark">{i + 1}</span>
                <div>
                  <h3 className="font-display font-bold text-dark mb-1">{p.titulo}</h3>
                  <p className="text-sm text-dark/80 leading-relaxed">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── QUAND NETTOYER ── */}
      <section id="quando" className={`py-12 md:py-16${fundo('quando')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${tituloSeccao} mb-4`}>{servico.titulos.sinais}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {servico.sinais.map((s) => (
              <li key={s} className={`flex items-start gap-3 p-4 ${cartao('quando')} rounded-xl border border-border/50 text-[0.93rem] text-dark leading-relaxed`}>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">!</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p className="text-dark/85 leading-relaxed max-w-3xl">{servico.frequencia}</p>
        </div>
      </section>

      {/* ── AVERTISSEMENT FIBROCIMENTO ── */}
      {servico.aviso && (
        <section id="fibrocimento" className={`py-12 md:py-16${fundo('fibrocimento')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`p-6 md:p-8 rounded-2xl ${cartao('fibrocimento')} border border-border/40`}>
              <h2 className="font-display text-xl font-bold text-dark mb-3">{servico.aviso.titulo}</h2>
              <p className="text-[0.95rem] text-dark/85 leading-relaxed max-w-3xl">{servico.aviso.texto}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── ZONE ── */}
      <section id="zona" className={`py-12 md:py-16${fundo('zona')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${tituloSeccao} mb-3`}>Onde trabalhamos</h2>
          <p className="text-text-muted max-w-3xl mb-6">
            A equipa parte de Marco de Canaveses e trabalha em todo o {distritoTexto}. Para confirmar a deslocação, diga-nos o concelho e a freguesia no pedido de orçamento.
          </p>
          <Link
            href="/pt/cidade/"
            className="inline-flex items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
          >
            <span className="text-xl">📍</span>
            <span className="font-semibold text-dark group-hover:text-yellow transition-colors">Outros serviços VITFIX, por concelho</span>
          </Link>
        </div>
      </section>

      {/* ── LIENS (services voisins, guides) ── */}
      <section id="relacionados" className={`py-12 md:py-16${fundo('relacionados')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${tituloSeccao} mb-6`}>{servico.titulos.ligacoes}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servico.ligacoes.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`p-5 ${cartao('relacionados')} rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group`}
              >
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{l.titulo}</span>
                <span className="block text-sm text-text-muted mt-1">{l.texto}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ visible (sans FAQPage : résultat enrichi retiré par Google le 07/05/2026) ── */}
      <section id="perguntas" className={`py-14 md:py-18${fundo('perguntas')}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">Perguntas frequentes</h2>
          <div className="space-y-4">
            {servico.faqs.map((faq) => (
              <details key={faq.pergunta} className={`group rounded-2xl border border-border/50 ${cartao('perguntas')} overflow-hidden`}>
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.pergunta}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">{faq.resposta}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className={`py-16 md:py-20${fundo('cta')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            {servico.titulos.ctaFinal}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">Grátis e sem compromisso, em todo o {distritoTexto}.</p>
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
              {TELEFONE_PT_TEXTE}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
