import Image from 'next/image'
import Link from 'next/link'
import { CITIES } from '@/lib/data/seo-pages-data'
import type { Fonte, ServicoConcelho } from '@/lib/data/pt-servicos-concelho'
import { PHONE_PT } from '@/lib/constants'
import { ADRESSE_PT_TEXTE, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { descricaoServicoConcelho, nomeDistrito } from '@/lib/seo/pt-meta'
import { noServicoLocal } from '@/lib/seo/pt-schemas'
import { chantiersPara, mesPorExtenso, prazoPara, precosPara } from '@/lib/seo/pt-provas-locais'
import { BotoesContacto, CabecalhoServico, TITULO_SECCAO, detalhesChantier, fraseChantier, frasePrazo, frasePreco, migalhasServicos } from '@/components/seo/servico-distrito-partilhado'

// Page d'un service pour toute la zone qu'il dessert, quand cette zone est un concelho (/pt/servicos/{slug}/,
// lib/data/pt-servicos-concelho.ts : Águeda, demande du propriétaire du 21/10/2026). En-tête, JSON-LD, boutons de contact
// et fil d'Ariane communs aux pages de district (components/seo/servico-distrito-partilhado.tsx). Ordre du guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md (5.1) : décision et contact en haut, méthode, prix, règles
// et lieux, FAQ ouverte, qui fait le travail, liens. Blocs de données réelles (#chantiers, #precos, #prazos) rendus
// seulement quand data/seo/local-proof.json les contient (règle 0.2). JSON-LD : Service fourni par #business dans le
// concelho (areaServed = la ville, comme la grille) et fil d'Ariane ; pas de FAQPage (FAQ visible seulement).

/** « 21 de outubro de 2026 » d'une date ISO. */
function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return `${dia} de ${mesPorExtenso(`${ano}-${String(mes).padStart(2, '0')}`)}`
}

function ListaFontes({ fontes }: Readonly<{ fontes: Fonte[] }>) {
  return (
    <div className="mt-6 text-sm text-text-muted max-w-3xl">
      <p className="font-semibold text-dark/80 mb-1">Fontes</p>
      <ul className="space-y-1">
        {fontes.map((f) => (
          <li key={f.url}>
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline decoration-yellow underline-offset-2 hover:text-dark">{f.nome}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CartoesTexto({ itens, cartao }: Readonly<{ itens: Array<{ titulo: string; texto: string }>; cartao: string }>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {itens.map((s) => (
        <article key={s.titulo} className={`p-6 rounded-2xl ${cartao} border border-border/40`}>
          <h3 className="font-display text-lg font-bold text-dark mb-2">{s.titulo}</h3>
          <p className="text-[0.93rem] text-dark/80 leading-relaxed">{s.texto}</p>
        </article>
      ))}
    </div>
  )
}

export default function PaginaServicoConcelho({ servico }: Readonly<{ servico: ServicoConcelho }>) {
  const city = CITIES.find((c) => c.slug === servico.cidade)
  if (!city) throw new Error(`concelho inconnu : ${servico.cidade}`)

  const urlPagina = `https://vitfix.io/pt/servicos/${servico.slug}/`
  const chantiers = chantiersPara(servico.slug, city.slug)
  const precos = precosPara(servico.slug)
  const prazo = prazoPara(city.slug, servico.slug)
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(servico.mensagemWhatsapp)}`

  // Fonds alternés calculés sur les sections réellement rendues (une est conditionnelle), comme sur la grille.
  const seccoes = ['servicos', 'metodo', ...(chantiers.length ? ['chantiers'] : []), 'preco', 'regras', 'zona', 'perguntas', 'empresa', 'cta']
  const branca = (id: string) => seccoes.indexOf(id) % 2 === 0
  const fundo = (id: string) => (branca(id) ? ' bg-white' : '')
  const cartao = (id: string) => (branca(id) ? 'bg-warm-gray' : 'bg-white')

  return (
    <div className="min-h-screen bg-warm-gray">
      <CabecalhoServico
        noServico={noServicoLocal({
          url: urlPagina,
          nome: servico.h1,
          serviceType: servico.tipoServico,
          descricao: descricaoServicoConcelho(servico),
          city,
        })}
        migalhas={migalhasServicos({ name: servico.h1, url: urlPagina })}
        icon={servico.icon}
        selo={`${servico.nome} · Concelho de ${city.name}, distrito ${nomeDistrito(city.distrito)}`}
        titulo={servico.h1}
        intro={servico.intro.join(' ')}
        waHref={waHref}
        selos={['Equipa VITFIX', 'Orçamento grátis', `Todo o concelho de ${city.name}`]}
        prazo={prazo}
      />

      {/* ── PRESTATIONS (confirmées par le propriétaire) ── */}
      <section id="servicos" className={`py-12 md:py-16${fundo('servicos')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-6`}>O que fazemos em {city.name}</h2>
          <CartoesTexto itens={servico.servicos} cartao={cartao('servicos')} />
          <p className="mt-6 text-[0.93rem] text-dark/85 leading-relaxed max-w-3xl"><strong>Equipamento:</strong> {servico.equipamento}</p>
          {servico.naoFazemos.length > 0 && (
            <div className={`mt-6 p-5 rounded-2xl ${cartao('servicos')} border border-border/40 max-w-3xl`}>
              <h3 className="font-display font-bold text-dark mb-2">O que não fazemos</h3>
              <ul className="space-y-1.5 text-[0.93rem] text-dark/80">
                {servico.naoFazemos.map((n) => (
                  <li key={n} className="flex items-start gap-2"><span className="text-yellow">•</span><span>{n}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── MÉTHODE ── */}
      <section id="metodo" className={`py-12 md:py-16${fundo('metodo')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-6`}>Como trabalhamos</h2>
          <ol className="space-y-4 max-w-3xl">
            {servico.metodo.map((m, i) => (
              <li key={m.titulo} className="flex gap-4">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-yellow/15 flex items-center justify-center text-base font-bold text-dark">{i + 1}</span>
                <div>
                  <h3 className="font-display font-bold text-dark">{m.titulo}</h3>
                  <p className="text-[0.93rem] text-dark/80 leading-relaxed">{m.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CHANTIERS RÉELS (data/seo/local-proof.json) ── */}
      {chantiers.length > 0 && (
        <section id="chantiers" className={`py-12 md:py-16${fundo('chantiers')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`${TITULO_SECCAO} mb-2`}>Trabalhos realizados no concelho de {city.name}</h2>
            <p className="text-text-muted text-sm mb-6 max-w-2xl">Intervenções reais da equipa.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chantiers.map((c, i) => (
                <article key={`${c.mes}-${i}`} className={`rounded-2xl ${cartao('chantiers')} border border-border/40 overflow-hidden`}>
                  {c.foto && c.foto_alt && (
                    <div className="relative w-full aspect-[4/3] bg-warm-gray">
                      <Image src={c.foto} alt={c.foto_alt} fill sizes="(min-width: 1024px) 472px, (min-width: 768px) 50vw, 100vw" className="object-cover" />
                    </div>
                  )}
                  <div className="p-5 text-sm text-dark/85 leading-relaxed space-y-1">
                    <p className="font-semibold text-dark">{fraseChantier(c)}</p>
                    {detalhesChantier(c).map((d) => (
                      <p key={d.rotulo}><span className="font-semibold">{d.rotulo}:</span> {d.texto}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRIX : ce qui le fait varier ; fourchettes et délai seulement depuis local-proof.json ── */}
      <section id="preco" className={`py-12 md:py-16${fundo('preco')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-4`}>{servico.preco.titulo}</h2>
          <p className="text-dark/85 leading-relaxed max-w-3xl mb-5">{servico.preco.texto}</p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
            {servico.preco.fatores.map((f) => (
              <li key={f} className={`flex items-start gap-3 p-4 rounded-xl ${cartao('preco')} border border-border/40 text-[0.93rem] text-dark/85`}>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {precos.length > 0 && (
            <ul id="precos" className="mt-5 space-y-1 text-dark/85 max-w-3xl">
              {precos.map((p, i) => <li key={i}>{frasePreco(p)}</li>)}
            </ul>
          )}
          {prazo && <p id="prazos" className="mt-3 text-dark/85 max-w-3xl">{frasePrazo(prazo)}</p>}
          <p className="mt-6 text-[0.93rem] text-dark/85 max-w-3xl">
            Orçamento grátis e sem compromisso: envie fotografias e a localização do terreno por{' '}
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-yellow underline-offset-2">WhatsApp</a>{' '}
            ou ligue para <a href={`tel:${PHONE_PT}`} className="font-semibold underline decoration-yellow underline-offset-2">{TELEFONE_PT_TEXTE}</a>.
          </p>
        </div>
      </section>

      {/* ── RÈGLES (texte daté, sources officielles) ── */}
      <section id="regras" className={`py-12 md:py-16${fundo('regras')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-2`}>{servico.regras.titulo}</h2>
          <p className="text-sm text-text-muted mb-5">Regras verificadas a {dataPorExtenso(servico.regras.verificadoEm)}; as principais fontes oficiais estão no fim desta secção.</p>
          <p className="text-dark/85 leading-relaxed max-w-3xl mb-6">{servico.regras.intro}</p>
          <CartoesTexto itens={servico.regras.itens} cartao={cartao('regras')} />
          <ListaFontes fontes={servico.regras.fontes} />
        </div>
      </section>

      {/* ── LIEUX : freguesias regroupées par type de terrain, avec ce qui change pour le travail ── */}
      <section id="zona" className={`py-12 md:py-16${fundo('zona')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-4`}>{servico.zona.titulo}</h2>
          <p className="text-dark/85 leading-relaxed max-w-3xl mb-6">{servico.zona.intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servico.zona.grupos.map((g) => (
              <article key={g.titulo} className={`p-6 rounded-2xl ${cartao('zona')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-1">{g.titulo}</h3>
                <p className="text-xs text-text-muted mb-3">{g.freguesias.join(' · ')}</p>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed">{g.texto}</p>
              </article>
            ))}
          </div>
          <ListaFontes fontes={servico.zona.fontes} />
        </div>
      </section>

      {/* ── FAQ visible (pas d'accordéon fermé, pas de FAQPage) ── */}
      <section id="perguntas" className={`py-12 md:py-16${fundo('perguntas')}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-6`}>Perguntas frequentes</h2>
          <div className="space-y-4">
            {servico.faqs.map((f) => (
              <div key={f.pergunta} className={`p-5 rounded-2xl ${cartao('perguntas')} border border-border/40`}>
                <h3 className="font-display font-bold text-dark mb-2 text-[0.98rem]">{f.pergunta}</h3>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed">{f.resposta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUI FAIT LE TRAVAIL + LIENS ── */}
      <section id="empresa" className={`py-12 md:py-16${fundo('empresa')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-3`}>Quem faz o trabalho</h2>
          <p className="text-dark/85 leading-relaxed max-w-3xl mb-8">
            {servico.quemFaz} Sede: {ADRESSE_PT_TEXTE}. Telefone:{' '}
            <a href={`tel:${PHONE_PT}`} className="font-semibold underline decoration-yellow underline-offset-2">{TELEFONE_PT_TEXTE}</a>.{' '}
            <Link href="/pt/sobre/" className="underline decoration-yellow underline-offset-2">Sobre a VITFIX</Link>
            {' · '}
            <Link href="/pt/contacto/" className="underline decoration-yellow underline-offset-2">Contactos</Link>
          </p>
          <h3 className="font-display text-xl font-bold mb-4">Serviços relacionados em {city.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...servico.ligacoes, { href: `/pt/cidade/${city.slug}/`, titulo: `Todos os serviços em ${city.name}`, texto: 'Canalização, eletricidade, obras e os restantes serviços da VITFIX no concelho.' }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`p-5 rounded-2xl ${cartao('empresa')} border border-border/50 hover:border-yellow hover:shadow-sm transition-all group`}
              >
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{l.titulo}</span>
                <span className="block text-sm text-text-muted mt-1 leading-relaxed">{l.texto}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="cta" className={`py-16 md:py-20${fundo('cta')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">{servico.ctaFinal}</h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">Fotografias e localização por WhatsApp, ou uma chamada: o orçamento é grátis e sem compromisso.</p>
          <BotoesContacto waHref={waHref} variante="fim" />
        </div>
      </section>
    </div>
  )
}
