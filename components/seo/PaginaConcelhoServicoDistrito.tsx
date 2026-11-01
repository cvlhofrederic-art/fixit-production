import Image from 'next/image'
import Link from 'next/link'
import { SERVICES } from '@/lib/data/seo-pages-data'
import type { PaginaConcelhoDistrito } from '@/lib/data/pt-servicos-distrito'
import { PHONE_PT } from '@/lib/constants'
import { deConcelho, descricaoConcelhoDistrito, dosDistritos, emConcelho } from '@/lib/seo/pt-meta'
import { noServicoLocal } from '@/lib/seo/pt-schemas'
import { avisPara, mesPorExtenso, notasConcelhoPara, prazoDistritoPara, precosPara } from '@/lib/seo/pt-provas-locais'
import { BotoesContacto, CabecalhoServico, SeccaoPreco, TITULO_SECCAO, detalhesChantier, fraseChantier, migalhasServicos } from './servico-distrito-partilhado'

// Page concelho d'un service de district (/pt/servicos/{servico}-{concelho}/), ouverte seulement quand
// data/seo/local-proof.json documente ce service dans ce concelho (chantier complet, information propre au lieu,
// relecture datée : lib/data/pt-servicos-distrito.ts, section 4.4 du guide Google du 19/10/2026). C'est une destination
// complète : ce qui est fait et ce qui ne l'est pas, les chantiers du concelho (problème, solution, accès, photo), les
// facteurs et la fourchette de prix, le délai, les avis autorisés et le contact. La méthode détaillée et la FAQ restent
// sur la page de district, liée ici, pour ne pas répéter le même texte d'une page concelho à l'autre (test « Série »).

export default function PaginaConcelhoServicoDistrito({ pagina }: Readonly<{ pagina: PaginaConcelhoDistrito }>) {
  const { servico, city, chantiers } = pagina
  const urlPagina = `https://vitfix.io/pt/servicos/${pagina.slug}/`
  const urlDistrito = `/pt/servicos/${servico.slug}/`
  const noConcelho = emConcelho(city.name)
  const precos = precosPara(servico.slug)
  const prazo = prazoDistritoPara(servico.distritos, servico.slug)
  const notas = notasConcelhoPara(servico.slug, city.slug)
  const avis = avisPara(servico.slug, city.slug)
  const lugares = [...new Set(chantiers.map((c) => c.freguesia?.trim()).filter((f): f is string => Boolean(f)))]
  const listaLugares = lugares.length > 1 ? `${lugares.slice(0, -1).join(', ')} e ${lugares.at(-1)}` : lugares[0]
  const tipo = servico.tipoServico.charAt(0).toLowerCase() + servico.tipoServico.slice(1)
  const n = chantiers.length
  const ondeFoi = `${noConcelho}${listaLugares ? ` (${listaLugares})` : ''}`
  const intro =
    n > 1
      ? `A equipa VITFIX já fez ${n} trabalhos de ${tipo} ${ondeFoi}, o mais recente em ${mesPorExtenso(chantiers[0].mes)}. Partimos de Marco de Canaveses e trabalhamos em todos os concelhos ${dosDistritos(servico.distritos)}.`
      : `A equipa VITFIX fez um trabalho de ${tipo} ${ondeFoi}, em ${mesPorExtenso(chantiers[0].mes)}. Partimos de Marco de Canaveses e trabalhamos em todos os concelhos ${dosDistritos(servico.distritos)}.`
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`${servico.mensagemWhatsapp} ${servico.mensagemLocal} ${noConcelho}.`)}`
  const metiersDaCidade = servico.metiersLigados.map((m) => SERVICES.find((s) => s.slug === m)).filter((s): s is NonNullable<typeof s> => Boolean(s))

  // Fonds alternés calculés sur les sections réellement rendues (#local et #avaliacoes sont conditionnelles).
  const seccoes = ['servicos', 'chantiers', ...(notas.length ? ['local'] : []), 'preco', ...(avis.length ? ['avaliacoes'] : []), 'relacionados', 'cta']
  const fundo = (id: string) => (seccoes.indexOf(id) % 2 === 1 ? ' bg-white' : '')
  const cartao = (id: string) => (seccoes.indexOf(id) % 2 === 1 ? 'bg-warm-gray' : 'bg-white')

  return (
    <div className="min-h-screen bg-warm-gray">
      {/* ── JSON-LD ET HERO ── */}
      <CabecalhoServico
        noServico={noServicoLocal({
          url: urlPagina,
          nome: `${servico.nome} ${noConcelho}`,
          serviceType: servico.tipoServico,
          descricao: descricaoConcelhoDistrito(pagina),
          city,
        })}
        migalhas={migalhasServicos({ name: servico.nome, url: `https://vitfix.io${urlDistrito}` }, { name: city.name, url: urlPagina })}
        icon={servico.icon}
        selo={`${servico.nome} · ${city.name}`}
        titulo={`${servico.nome} ${noConcelho}`}
        intro={intro}
        waHref={waHref}
        selos={['Equipa VITFIX', 'Orçamento grátis']}
        prazo={prazo}
      />

      {/* ── CE QUI EST FAIT, ET CE QUI NE L'EST PAS (bloc de décision) ── */}
      <section id="servicos" className={`py-12 md:py-16${fundo('servicos')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-4`}>O que fazemos {noConcelho}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {servico.prestacoes.map((p) => (
              <li key={p.titulo} className={`flex items-start gap-3 p-4 ${cartao('servicos')} rounded-xl border border-border/50 text-[0.93rem] text-dark leading-relaxed`}>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                <span>{p.titulo}</span>
              </li>
            ))}
          </ul>
          {servico.aviso && (
            <p className="text-dark/85 leading-relaxed max-w-3xl">
              {servico.aviso.titulo}. <Link href={`${urlDistrito}#fibrocimento`} className="text-yellow font-semibold hover:underline">Porquê</Link>
            </p>
          )}
        </div>
      </section>

      {/* ── CHANTIERS RÉELS DU CONCELHO : le contenu propre de la page ── */}
      <section id="chantiers" className={`py-12 md:py-16${fundo('chantiers')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-2`}>Trabalhos realizados {noConcelho}</h2>
          <p className="text-text-muted text-sm mb-6 max-w-2xl">Intervenções reais da equipa VITFIX no concelho.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chantiers.map((c, i) => (
              <article key={i} className={`rounded-2xl ${cartao('chantiers')} border border-border/40 overflow-hidden`}>
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

      {/* ── PARTICULARITÉS LOCALES écrites par le propriétaire ── */}
      {notas.length > 0 && (
        <section id="local" className={`py-12 md:py-16${fundo('local')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`${TITULO_SECCAO} mb-4`}>{servico.titulos.local} {deConcelho(city.name)}</h2>
            <div className="space-y-3 max-w-3xl">
              {notas.map((t, i) => <p key={i} className="text-dark/85 leading-relaxed">{t}</p>)}
            </div>
          </div>
        </section>
      )}

      {/* ── PRIX ET DÉLAI RÉELS ── */}
      <SeccaoPreco titulo={`${servico.titulos.preco} ${noConcelho}`} servico={servico} precos={precos} prazo={prazo} fundo={fundo('preco')} cartao={cartao('preco')} />

      {/* ── AVIS RÉELS AUTORISÉS (texte seulement : pas de balisage Review ni AggregateRating) ── */}
      {avis.length > 0 && (
        <section id="avaliacoes" className={`py-12 md:py-16${fundo('avaliacoes')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`${TITULO_SECCAO} mb-6`}>Avaliações de clientes {noConcelho}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {avis.map((a, i) => (
                <blockquote key={i} className={`p-5 rounded-2xl ${cartao('avaliacoes')} border border-border/40 text-sm text-dark/85`}>
                  <p className="mb-2">{'★'.repeat(a.nota)}</p>
                  <p className="leading-relaxed">{a.texto}</p>
                  <footer className="text-xs text-text-muted mt-3">{a.autor ? `${a.autor}, ` : ''}{mesPorExtenso(a.mes)}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SERVICE COMPLET ET MÉTIERS VOISINS DANS LE CONCELHO ── */}
      <section id="relacionados" className={`py-12 md:py-16${fundo('relacionados')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-6`}>O serviço completo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={urlDistrito}
              className={`p-5 ${cartao('relacionados')} rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group`}
            >
              <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{servico.titulo}</span>
              <span className="block text-sm text-text-muted mt-1">Como trabalhamos, o que faz variar o preço e perguntas frequentes.</span>
            </Link>
            {metiersDaCidade.map((m) => (
              <Link
                key={m.slug}
                href={`/pt/servicos/${m.slug}-${city.slug}/`}
                className={`p-5 ${cartao('relacionados')} rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group`}
              >
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{m.name} {noConcelho}</span>
                <span className="block text-sm text-text-muted mt-1">{m.heroSubtitle.replace(/\{city\}/g, city.name)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className={`py-16 md:py-20${fundo('cta')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            {servico.titulos.ctaFinal} {noConcelho}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">Grátis e sem compromisso, {noConcelho} e em todos os concelhos onde trabalhamos.</p>
          <BotoesContacto waHref={waHref} variante="fim" />
        </div>
      </section>
    </div>
  )
}
