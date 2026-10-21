// Éléments communs aux pages de district (PaginaServicoDistrito) et à leurs pages concelho
// (PaginaConcelhoServicoDistrito) : icônes de contact, formats pt-PT des prix et délais réels.

import type { Chantier, PrazoCidade, PrecoMetier } from '@/lib/seo/pt-provas-locais'
import type { PerguntaServico } from '@/lib/data/pt-servicos-distrito'
import { mesPorExtenso } from '@/lib/seo/pt-provas-locais'

export const TITULO_SECCAO = 'font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark'

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

export const num = (n: number) => n.toLocaleString('pt-PT')

/** « Limpeza e impermeabilização do telhado: 20 a 30 € por m² (equipa VITFIX, outubro de 2026). » */
export function frasePreco(p: PrecoMetier): string {
  return `${p.servico ? `${p.servico}: ` : ''}${num(p.min)} a ${num(p.max)} € por ${p.unite}${p.fonte ? ` (${p.fonte})` : ''}.`
}

/** Délai réel : en heures quand le propriétaire l'exprime ainsi, sinon en jours. */
export function frasePrazo(prazo: PrazoCidade): string {
  const visita = prazo.visita_horas_max
    ? `Visitamos o telhado em ${prazo.visita_horas_max} horas, no máximo`
    : `Primeira visita em ${prazo.visita_dias} dia${prazo.visita_dias > 1 ? 's' : ''}`
  const intervencao = prazo.intervencao_dias ? `, intervenção em ${prazo.intervencao_dias} dia${prazo.intervencao_dias > 1 ? 's' : ''}` : ''
  return `${visita}${intervencao}.`
}

const porM2 = (p: PrecoMetier) => /^m(2|²)$/i.test(p.unite.trim())

/**
 * Complément de réponse de FAQ tiré des prix réels (aucun chiffre écrit en dur dans les textes, règle 0.2) :
 * la fourchette par prestation, et pour « exemplo » le calcul pour un telhado de 100 m² (multiplication simple
 * de la fourchette au m², pas un devis).
 */
export function complementoPreco(faq: PerguntaServico, precos: PrecoMetier[]): string {
  if (!faq.preco || precos.length === 0) return ''
  const linhas = precos.map((p) => `${p.servico ? `para ${p.servico.charAt(0).toLowerCase()}${p.servico.slice(1)}` : ''}: de ${num(p.min)} a ${num(p.max)} € por ${p.unite}`)
  let texto = ` Preço praticado pela equipa VITFIX ${linhas.join('; ')}.`
  const m2 = precos.find(porM2)
  if (faq.preco === 'exemplo' && m2) {
    texto += ` Num telhado de 100 m², são ${num(m2.min * 100)} a ${num(m2.max * 100)} €; o valor exato depende do acesso e do estado do telhado.`
  }
  return texto
}

/** « Lavagem e impermeabilização de telhado, 120 m², Vila das Aves · setembro de 2026 » */
export function fraseChantier(c: Chantier, nomeCidade?: string): string {
  const lugar = [c.freguesia, nomeCidade].filter(Boolean).join(', ')
  return `${c.tipo}${c.quantidade ? `, ${c.quantidade}` : ''}${lugar ? `, ${lugar}` : ''} · ${mesPorExtenso(c.mes)}`
}
