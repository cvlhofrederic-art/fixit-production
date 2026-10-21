import Link from 'next/link'
import { CITIES } from '@/lib/data/seo-pages-data'
import { chantiersExibidosDistrito, paginasConcelhoDistrito, type ServicoDistrito } from '@/lib/data/pt-servicos-distrito'
import { PHONE_PT } from '@/lib/constants'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { descricaoServicoDistrito, emConcelho, nomeDistrito } from '@/lib/seo/pt-meta'
import { grafo, noFilAriane, noServicoDistrito } from '@/lib/seo/pt-schemas'
import { prazoDistritoPara, precosPara } from '@/lib/seo/pt-provas-locais'
import { BotoesContacto, SelosConfianca, TITULO_SECCAO, complementoPreco, detalhesChantier, frasePrazo, frasePreco, fraseChantier } from './servico-distrito-partilhado'

// Page de service à l'échelle du district (/pt/servicos/{slug}/, lib/data/pt-servicos-distrito.ts). Même
// langage visuel que les pages métier x ville (app/pt/servicos/[slug]/page.tsx). Blocs de données réelles
// (#chantiers, #prazos, #precos) rendus seulement quand data/seo/local-proof.json les contient (règle 0.2) ;
// JSON-LD : Service fourni par #business sur le distrito, fil d'Ariane ; pas de FAQPage (FAQ visible seulement).

const tituloSeccao = TITULO_SECCAO

export default function PaginaServicoDistrito({ servico }: Readonly<{ servico: ServicoDistrito }>) {
  const urlPagina = `https://vitfix.io/pt/servicos/${servico.slug}/`
  const distritoTexto = `distrito ${nomeDistrito(servico.distrito)}`
  // Chantiers documentés de tout le distrito : les 6 plus récents, plus le plus récent de chaque concelho dont la page est
  // ouverte ; chaque page concelho n'est liée que depuis une carte de chantier réel, jamais depuis une liste de villes.
  const chantiers = chantiersExibidosDistrito(servico)
  const concelhosAbertos = paginasConcelhoDistrito().filter((p) => p.servico.slug === servico.slug)
  const paginaDoConcelho = (cidade: string) => concelhosAbertos.find((p) => p.city.slug === cidade)
  const precos = precosPara(servico.slug)
  const prazo = prazoDistritoPara(servico.distrito, servico.slug)
  const nomeCidade = (slug: string) => CITIES.find((c) => c.slug === slug)?.name ?? slug
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`${servico.mensagemWhatsapp} ${servico.mensagemLocal} em `)}`

  // Fonds alternés calculés sur les sections réellement rendues (deux sont conditionnelles) : section blanche,
  // cartes grises, et inversement, comme sur app/pt/servicos/[slug]/page.tsx.
  const seccoes = ['servicos', ...(chantiers.length ? ['chantiers'] : []), 'preco', 'metodo', 'quando', ...(servico.aviso ? ['fibrocimento'] : []), 'zona', 'relacionados', 'perguntas', 'cta']
  const branca = (id: string) => seccoes.indexOf(id) % 2 === 1
  const fundo = (id: string) => (branca(id) ? ' bg-white' : '')
  const cartao = (id: string) => (branca(id) ? 'bg-warm-gray' : 'bg-white')

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

          <BotoesContacto waHref={waHref} variante="topo" />

          <SelosConfianca selos={['Equipa VITFIX', 'Orçamento grátis', 'Atendimento telefónico 7 dias por semana']} prazo={prazo} />
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
                  <div className="text-sm text-dark/85 leading-relaxed space-y-1">
                    <p className="font-semibold text-dark">{fraseChantier(c, nomeCidade(c.cidade))}</p>
                    {detalhesChantier(c).map((d) => (
                      <p key={d.rotulo}><span className="font-semibold">{d.rotulo}:</span> {d.texto}</p>
                    ))}
                    {paginaDoConcelho(c.cidade) && (
                      <Link href={`/pt/servicos/${paginaDoConcelho(c.cidade)?.slug}/`} className="inline-block text-yellow font-semibold hover:underline">
                        {servico.nome} {emConcelho(nomeCidade(c.cidade))}
                      </Link>
                    )}
                  </div>
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
                    <li key={i}>{frasePreco(p)}</li>
                  ))}
                </ul>
              </div>
            )}
            {prazo && (
              <div id="prazos" className={`p-6 rounded-2xl ${cartao('preco')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{prazo.visita_horas_max ? 'Prazo de visita' : 'Prazos constatados'}</h3>
                <p className="text-sm text-dark/85">{frasePrazo(prazo)}</p>
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
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">{faq.resposta}{complementoPreco(faq, precos, servico)}</div>
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
          <BotoesContacto waHref={waHref} variante="fim" />
        </div>
      </section>
    </div>
  )
}
