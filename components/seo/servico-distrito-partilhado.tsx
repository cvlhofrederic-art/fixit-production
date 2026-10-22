// Éléments communs aux pages de district (PaginaServicoDistrito) et à leurs pages concelho
// (PaginaConcelhoServicoDistrito) : en-tête, section prix, icônes de contact, formats pt-PT des prix et délais réels.

import { Fragment } from 'react'
import Link from 'next/link'
import type { Chantier, PrazoCidade, PrecoMetier } from '@/lib/seo/pt-provas-locais'
import type { PerguntaServico, ServicoDistrito } from '@/lib/data/pt-servicos-distrito'
import { mesPorExtenso } from '@/lib/seo/pt-provas-locais'
import { grafo, noFilAriane } from '@/lib/seo/pt-schemas'
import { PHONE_PT } from '@/lib/constants'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'

export const TITULO_SECCAO = 'font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark'

type Migalha = { name: string; url: string }

/** Fil d'Ariane des pages de service : VITFIX › Serviços › …, en URL absolues ; la dernière est la page elle-même. */
export const migalhasServicos = (...resto: Migalha[]): Migalha[] => [
  { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
  { name: 'Serviços', url: 'https://vitfix.io/pt/servicos/' },
  ...resto,
]

/**
 * JSON-LD (Service + BreadcrumbList) et en-tête : fil d'Ariane visible tiré des mêmes étapes que le balisage, pastille,
 * H1, accroche, boutons de contact et bandeau de confiance.
 */
export function CabecalhoServico({ noServico, migalhas, icon, selo, titulo, intro, waHref, selos, prazo }: Readonly<{
  noServico: Record<string, unknown>
  migalhas: Migalha[]
  icon: string
  selo: string
  titulo: string
  intro: string
  waHref: string
  selos: string[]
  prazo: PrazoCidade | null
}>) {
  const jsonLd = grafo(noServico, noFilAriane(migalhas))
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            {migalhas.slice(0, -1).map((m) => (
              <Fragment key={m.url}>
                <Link href={m.url.replace('https://vitfix.io', '')} className="hover:text-yellow transition">{m.name}</Link>
                <span className="mx-2">/</span>
              </Fragment>
            ))}
            <span className="text-dark font-medium">{migalhas.at(-1)?.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{icon}</span>
            <span className="text-dark">{selo}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {titulo}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">{intro}</p>

          <BotoesContacto waHref={waHref} variante="topo" />

          <SelosConfianca selos={selos} prazo={prazo} />
        </div>
      </section>
    </>
  )
}

/** Section prix : facteurs toujours visibles ; fourchettes et délai réels seulement s'ils sont fournis ; demande de devis. */
export function SeccaoPreco({ titulo, servico, precos, prazo, fundo, cartao }: Readonly<{
  titulo: string
  servico: Pick<ServicoDistrito, 'fatoresPreco' | 'textoOrcamento'>
  precos: PrecoMetier[]
  prazo: PrazoCidade | null
  fundo: string
  cartao: string
}>) {
  return (
    <section id="preco" className={`py-12 md:py-16${fundo}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className={`${TITULO_SECCAO} mb-4`}>{titulo}</h2>
          <p className="text-dark/85 leading-relaxed mb-4">O preço depende sobretudo destes fatores:</p>
          <ul className="space-y-2 text-[0.93rem] text-dark/85">
            {servico.fatoresPreco.map((f) => (
              <li key={f} className="flex items-start gap-2"><span className="text-yellow font-bold">•</span><span>{f}</span></li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 content-start">
          {precos.length > 0 && (
            <div id="precos" className={`p-6 rounded-2xl ${cartao} border border-border/40`}>
              <h3 className="font-display text-lg font-bold text-dark mb-3">Preços praticados</h3>
              <ul className="space-y-2 text-sm text-dark/85">
                {precos.map((p, i) => <li key={i}>{frasePreco(p)}</li>)}
              </ul>
            </div>
          )}
          {prazo && (
            <div id="prazos" className={`p-6 rounded-2xl ${cartao} border border-border/40`}>
              <h3 className="font-display text-lg font-bold text-dark mb-2">{prazo.visita_horas_max ? 'Prazo de visita' : 'Prazos constatados'}</h3>
              <p className="text-sm text-dark/85">{frasePrazo(prazo)}</p>
              <p className="text-xs text-text-muted mt-2">Fonte: {prazo.fonte}.</p>
            </div>
          )}
          <div className="p-6 rounded-2xl bg-yellow/10 border border-yellow/25">
            <p className="text-[0.93rem] text-dark/85 leading-relaxed">{servico.textoOrcamento} {TELEFONE_PT_TEXTE}.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export const WaSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export const PhoneSvg = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
  </svg>
)

/** Boutons WhatsApp et téléphone : « topo » sous le titre, « fim » dans l'appel à l'action final. */
export function BotoesContacto({ waHref, variante }: Readonly<{ waHref: string; variante: 'topo' | 'fim' }>) {
  const topo = variante === 'topo'
  return (
    <div className={topo ? 'flex flex-wrap gap-3 mb-10' : 'flex flex-wrap justify-center gap-3'}>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={topo
          ? 'inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]'
          : 'inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:-translate-y-0.5 transition-all'}
        style={topo ? undefined : { background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.4)' }}
      >
        <WaSvg />
        {topo ? 'Pedir orçamento por WhatsApp' : 'WhatsApp'}
      </a>
      <a
        href={`tel:${PHONE_PT}`}
        className={topo
          ? 'inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]'
          : 'inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]'}
      >
        <PhoneSvg />
        {TELEFONE_PT_TEXTE}
      </a>
    </div>
  )
}

/** Bandeau de confiance sous les boutons (le délai de visite réel s'ajoute s'il est fourni). */
export function SelosConfianca({ selos, prazo }: Readonly<{ selos: string[]; prazo: PrazoCidade | null }>) {
  const todos = prazo?.visita_horas_max ? [...selos, `Visita em ${prazo.visita_horas_max} horas, no máximo`] : selos
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
      {todos.map((s) => (
        <span key={s} className="flex items-center gap-1.5"><span className="text-yellow">✓</span> {s}</span>
      ))}
    </div>
  )
}

export const num = (n: number) => n.toLocaleString('pt-PT')

/** « Limpeza e impermeabilização do telhado: 20 a 30 € por m² (equipa VITFIX, outubro de 2026). » */
export function frasePreco(p: PrecoMetier): string {
  return `${p.servico ? `${p.servico}: ` : ''}${num(p.min)} a ${num(p.max)} € por ${p.unite}${p.fonte ? ` (${p.fonte})` : ''}.`
}

/** Délai réel, sans objet propre à un service : « Visita em 48 horas, no máximo. » ou « Primeira visita em 2 dias. » */
export function frasePrazo(prazo: PrazoCidade): string {
  const visita = prazo.visita_horas_max
    ? `Visita em ${prazo.visita_horas_max} horas, no máximo`
    : `Primeira visita em ${prazo.visita_dias} dia${prazo.visita_dias > 1 ? 's' : ''}`
  const intervencao = prazo.intervencao_dias ? `; intervenção em ${prazo.intervencao_dias} dia${prazo.intervencao_dias > 1 ? 's' : ''}` : ''
  return `${visita}${intervencao}.`
}

const porM2 = (p: PrecoMetier) => /^m(2|²)$/i.test(p.unite.trim())
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/**
 * Complément de réponse de FAQ tiré des prix réels (aucun chiffre écrit en dur dans les textes, règle 0.2), sur la seule
 * question qui porte sur la prestation chiffrée : la fourchette nommée, et pour « exemplo » le calcul pour 100 m²
 * (multiplication de la fourchette au m², pas un devis), avec la réserve propre au service.
 */
export function complementoPreco(faq: PerguntaServico, precos: PrecoMetier[], servico: Pick<ServicoDistrito, 'ressalvaPreco'>): string {
  if (!faq.preco || precos.length === 0) return ''
  const linhas = precos.map((p) => `${p.servico ? `${p.servico}: ` : ''}de ${num(p.min)} a ${num(p.max)} € por ${p.unite}`)
  let texto = ` ${linhas.join('; ')} (${precos.length > 1 ? 'preços praticados' : 'preço praticado'} pela equipa VITFIX).`
  const m2 = precos.find(porM2)
  if (faq.preco === 'exemplo' && m2) {
    texto += ` Exemplo para 100 m²${m2.servico ? ` (${minuscula(m2.servico)})` : ''}: ${num(m2.min * 100)} a ${num(m2.max * 100)} €, ${servico.ressalvaPreco}.`
  }
  return texto
}

/** « Lavagem e impermeabilização de telhado, 120 m², Vila das Aves, Santo Tirso · setembro de 2026 » */
export function fraseChantier(c: Chantier, nomeCidade?: string): string {
  const lugar = [c.freguesia?.trim(), nomeCidade].filter(Boolean).join(', ')
  return `${c.tipo}${c.quantidade ? `, ${c.quantidade}` : ''}${lugar ? `, ${lugar}` : ''} · ${mesPorExtenso(c.mes)}`
}

/** Ce que l'équipe a trouvé, ce qu'elle a fait et comment elle a accédé au toit : la méthode racontée par le chantier. */
export function detalhesChantier(c: Chantier): Array<{ rotulo: string; texto: string }> {
  const acesso = c.acesso === 'andaime' ? 'andaime' : c.acesso === 'corda' ? 'técnicos de acesso por corda certificados IRATA' : ''
  return [
    { rotulo: 'O que encontrámos', texto: c.problema?.trim() ?? '' },
    { rotulo: 'O que fizemos', texto: c.solucao?.trim() ?? '' },
    { rotulo: 'Acesso', texto: acesso },
  ].filter((d) => d.texto)
}
