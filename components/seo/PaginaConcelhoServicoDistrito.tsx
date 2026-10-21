import Image from 'next/image'
import Link from 'next/link'
import { SERVICES } from '@/lib/data/seo-pages-data'
import type { PaginaConcelhoDistrito } from '@/lib/data/pt-servicos-distrito'
import { PHONE_PT } from '@/lib/constants'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { descricaoConcelhoDistrito, nomeDistrito } from '@/lib/seo/pt-meta'
import { grafo, noFilAriane, noServicoLocal } from '@/lib/seo/pt-schemas'
import { mesPorExtenso, notasConcelhoPara, prazoDistritoPara, precosPara } from '@/lib/seo/pt-provas-locais'
import { PhoneSvg, TITULO_SECCAO, WaSvg, fraseChantier, frasePrazo, frasePreco } from './servico-distrito-partilhado'

// Page concelho d'un service de district (/pt/servicos/{servico}-{concelho}/), ouverte seulement quand
// data/seo/local-proof.json documente des chantiers réels de ce service dans ce concelho (lib/data/pt-servicos-distrito.ts,
// concelhoDocumentado). Son contenu propre est fait de ces chantiers (photos, freguesias, mois) et des particularités
// locales écrites par le propriétaire ; la méthode et la FAQ restent sur la page de district, liée ici, pour ne pas
// répéter le même texte d'une page à l'autre (guide Google du 19/10/2026, section 2.4, test « Série »).

export default function PaginaConcelhoServicoDistrito({ pagina }: { pagina: PaginaConcelhoDistrito }) {
  const { servico, city, chantiers } = pagina
  const urlPagina = `https://vitfix.io/pt/servicos/${pagina.slug}/`
  const urlDistrito = `/pt/servicos/${servico.slug}/`
  const precos = precosPara(servico.slug)
  const prazo = prazoDistritoPara(servico.distrito, servico.slug)
  const notas = notasConcelhoPara(servico.slug, city.slug)
  const freguesias = [...new Set(chantiers.map((c) => c.freguesia?.trim()).filter((f): f is string => Boolean(f)))]
  const n = chantiers.length
  const nomeMinusculo = servico.nome.charAt(0).toLowerCase() + servico.nome.slice(1)
  const listaFreguesias = freguesias.length > 1 ? `${freguesias.slice(0, -1).join(', ')} e ${freguesias.at(-1)}` : freguesias[0]
  const intro = `A equipa VITFIX já fez ${n} trabalho${n > 1 ? 's' : ''} de ${nomeMinusculo} em ${city.name}${listaFreguesias ? `, ${freguesias.length > 1 ? 'nas freguesias de' : 'na freguesia de'} ${listaFreguesias}` : ''}, o mais recente em ${mesPorExtenso(chantiers[0].mes)}. Partimos de Marco de Canaveses e trabalhamos em todo o distrito ${nomeDistrito(servico.distrito)}.`
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`${servico.mensagemWhatsapp}${city.name}.`)}`
  // Fonds alternés sur les sections réellement rendues (#local est conditionnelle), comme sur la page de district.
  const seccoes = ['chantiers', ...(notas.length ? ['local'] : []), 'preco', 'relacionados', 'cta']
  const fundo = (id: string) => (seccoes.indexOf(id) % 2 === 1 ? ' bg-white' : '')
  const cartao = (id: string) => (seccoes.indexOf(id) % 2 === 1 ? 'bg-warm-gray' : 'bg-white')
  const metiersDaCidade = servico.metiersLigados.map((m) => SERVICES.find((s) => s.slug === m)).filter((s): s is NonNullable<typeof s> => Boolean(s))

  const jsonLd = grafo(
    noServicoLocal({
      url: urlPagina,
      nome: `${servico.nome} em ${city.name}`,
      serviceType: servico.tipoServico,
      descricao: descricaoConcelhoDistrito(pagina),
      city,
    }),
    noFilAriane([
      { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
      { name: 'Serviços', url: 'https://vitfix.io/pt/servicos/' },
      { name: servico.nome, url: `https://vitfix.io${urlDistrito}` },
      { name: city.name, url: urlPagina },
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
            <Link href={urlDistrito} className="hover:text-yellow transition">{servico.nome}</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{city.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{servico.icon}</span>
            <span className="text-dark">{servico.nome} · {city.name}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {servico.nome} em {city.name}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">{intro}</p>

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
            {prazo?.visita_horas_max && (
              <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Visita em {prazo.visita_horas_max} horas, no máximo</span>
            )}
          </div>
        </div>
      </section>

      {/* ── CHANTIERS RÉELS DU CONCELHO : le contenu propre de la page ── */}
      <section id="chantiers" className={`py-12 md:py-16${fundo('chantiers')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`${TITULO_SECCAO} mb-2`}>Trabalhos realizados em {city.name}</h2>
          <p className="text-text-muted text-sm mb-6 max-w-2xl">Intervenções reais da equipa VITFIX no concelho.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chantiers.map((c, i) => (
              <article key={i} className={`rounded-2xl ${cartao('chantiers')} border border-border/40 overflow-hidden`}>
                {c.foto && c.foto_alt && (
                  <div className="relative w-full aspect-[4/3] bg-warm-gray">
                    <Image src={c.foto} alt={c.foto_alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" priority={i === 0} />
                  </div>
                )}
                <p className="p-5 text-sm text-dark/85 leading-relaxed">{fraseChantier(c)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTICULARITÉS LOCALES écrites par le propriétaire ── */}
      {notas.length > 0 && (
        <section id="local" className={`py-12 md:py-16${fundo('local')}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className={`${TITULO_SECCAO} mb-4`}>{servico.titulos.local} {city.name}</h2>
            <div className="space-y-3 max-w-3xl">
              {notas.map((t, i) => <p key={i} className="text-dark/85 leading-relaxed">{t}</p>)}
            </div>
          </div>
        </section>
      )}

      {/* ── PRIX ET DÉLAI RÉELS ── */}
      <section id="preco" className={`py-12 md:py-16${fundo('preco')}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className={`${TITULO_SECCAO} mb-4`}>{servico.titulos.preco} em {city.name}</h2>
            <p className="text-dark/85 leading-relaxed mb-4">O orçamento é grátis e depende sobretudo dos fatores explicados na página do serviço.</p>
            <Link href={`${urlDistrito}#preco`} className="text-yellow font-semibold hover:underline">O que faz variar o preço</Link>
          </div>
          <div className="grid gap-4 content-start">
            {precos.length > 0 && (
              <div id="precos" className={`p-6 rounded-2xl ${cartao('preco')} border border-border/40`}>
                <h3 className="font-display text-lg font-bold text-dark mb-3">Preços praticados</h3>
                <ul className="space-y-2 text-sm text-dark/85">
                  {precos.map((p, i) => <li key={i}>{frasePreco(p)}</li>)}
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
          </div>
        </div>
      </section>

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
              <span className="block text-sm text-text-muted mt-1">{servico.prestacoes.map((p) => p.titulo).join(', ')}: como trabalhamos e perguntas frequentes.</span>
            </Link>
            {metiersDaCidade.map((m) => (
              <Link
                key={m.slug}
                href={`/pt/servicos/${m.slug}-${city.slug}/`}
                className={`p-5 ${cartao('relacionados')} rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group`}
              >
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{m.name} em {city.name}</span>
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
            {servico.titulos.ctaFinal} em {city.name}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">{servico.textoOrcamento} {TELEFONE_PT_TEXTE}.</p>
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
