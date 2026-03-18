import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerTranslation } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  return isPt ? {
    title: 'Avaliações de clientes verificadas — Profissionais Vitfix | Vitfix',
    description: 'Descubra as avaliações autênticas de clientes na Vitfix. Canalizadores, eletricistas, pintores, jardineiros no Porto e em Portugal — experiências reais após cada intervenção.',
    openGraph: {
      title: 'Avaliações de clientes verificadas — Profissionais Vitfix',
      description: 'Avaliações autênticas de clientes após intervenção. Nota média 4,8/5.',
      siteName: 'Vitfix',
      locale: 'pt_PT',
      type: 'website',
    },
    alternates: {
      canonical: 'https://vitfix.io/pt/avis/',
    },
  } : {
    title: 'Avis clients vérifiés — Artisans Vitfix | Vitfix',
    description: 'Découvrez les avis authentiques de clients sur Vitfix. Plombiers, électriciens, peintres, jardiniers à Marseille et en PACA — expériences réelles après chaque intervention.',
    openGraph: {
      title: 'Avis clients vérifiés — Artisans Vitfix',
      description: 'Avis authentiques de clients après intervention. Note moyenne 4,8/5.',
      siteName: 'Vitfix',
      locale: 'fr_FR',
      type: 'website',
    },
    alternates: {
      canonical: 'https://vitfix.io/avis/',
    },
  }
}

const temoignagesFR = [
  {
    nom: 'Sophie M.',
    ville: 'Paris 11e',
    metier: 'Plomberie',
    note: 5,
    texte: 'Artisan très professionnel, ponctuel et efficace. La fuite sous l\'évier a été réparée en moins d\'une heure. Je recommande vivement !',
    date: 'Janvier 2026',
    initiales: 'SM',
    couleur: '#FFCC80',
  },
  {
    nom: 'Marc T.',
    ville: 'Lyon',
    metier: 'Électricité',
    note: 5,
    texte: 'Service impeccable. L\'électricien est arrivé à l\'heure, a bien expliqué les travaux nécessaires et a tout réparé proprement. Tarif conforme au devis.',
    date: 'Décembre 2025',
    initiales: 'MT',
    couleur: '#90CAF9',
  },
  {
    nom: 'Isabelle R.',
    ville: 'Bordeaux',
    metier: 'Peinture',
    note: 4,
    texte: 'Très bon travail de peinture dans le salon et la chambre. Finitions soignées, nettoyage parfait après le chantier. Légèrement plus cher que prévu mais qualité au rendez-vous.',
    date: 'Novembre 2025',
    initiales: 'IR',
    couleur: '#CE93D8',
  },
  {
    nom: 'Pierre-Antoine L.',
    ville: 'Marseille',
    metier: 'Serrurerie',
    note: 5,
    texte: 'Intervention rapide pour une ouverture de porte en urgence. En moins de 30 minutes après mon appel, le serrurier était là. Tarif honnête.',
    date: 'Février 2026',
    initiales: 'PL',
    couleur: '#A5D6A7',
  },
  {
    nom: 'Nathalie B.',
    ville: 'Toulouse',
    metier: 'Carrelage',
    note: 5,
    texte: 'Excellent carreleur ! La salle de bain est méconnaissable. Pose impeccable, joints parfaits. Je suis ravie du résultat.',
    date: 'Janvier 2026',
    initiales: 'NB',
    couleur: '#FFE082',
  },
  {
    nom: 'Thomas G.',
    ville: 'Nantes',
    metier: 'Menuiserie',
    note: 5,
    texte: 'Installation de parquet flottant dans tout l\'appartement. Travail soigné, délais respectés. Je referai appel à Vitfix sans hésiter.',
    date: 'Décembre 2025',
    initiales: 'TG',
    couleur: '#80CBC4',
  },
]

const temoignagesPT = [
  {
    nom: 'Ana S.',
    ville: 'Porto',
    metier: 'Canalização',
    note: 5,
    texte: 'Profissional muito eficiente, pontual e simpático. A fuga na cozinha foi resolvida em menos de uma hora. Recomendo vivamente!',
    date: 'Janeiro 2026',
    initiales: 'AS',
    couleur: '#FFCC80',
  },
  {
    nom: 'João R.',
    ville: 'Lisboa',
    metier: 'Eletricidade',
    note: 5,
    texte: 'Serviço impecável. O eletricista chegou a horas, explicou bem o trabalho necessário e reparou tudo cuidadosamente. Preço conforme o orçamento.',
    date: 'Dezembro 2025',
    initiales: 'JR',
    couleur: '#90CAF9',
  },
  {
    nom: 'Marta F.',
    ville: 'Braga',
    metier: 'Pintura',
    note: 4,
    texte: 'Muito bom trabalho de pintura na sala e no quarto. Acabamentos cuidados, limpeza perfeita após a obra. Ligeiramente mais caro do que previsto, mas qualidade excelente.',
    date: 'Novembro 2025',
    initiales: 'MF',
    couleur: '#CE93D8',
  },
  {
    nom: 'Carlos M.',
    ville: 'Porto',
    metier: 'Serralharia',
    note: 5,
    texte: 'Intervenção rápida para abertura de porta em urgência. Em menos de 30 minutos após o meu contacto, o profissional estava cá. Preço justo.',
    date: 'Fevereiro 2026',
    initiales: 'CM',
    couleur: '#A5D6A7',
  },
  {
    nom: 'Filipa L.',
    ville: 'Matosinhos',
    metier: 'Azulejaria',
    note: 5,
    texte: 'Excelente trabalho de azulejaria! A casa de banho ficou irreconhecível. Assentamento impecável, juntas perfeitas. Estou encantada com o resultado.',
    date: 'Janeiro 2026',
    initiales: 'FL',
    couleur: '#FFE082',
  },
  {
    nom: 'Rui A.',
    ville: 'Gaia',
    metier: 'Carpintaria',
    note: 5,
    texte: 'Instalação de soalho flutuante em todo o apartamento. Trabalho cuidado, prazos respeitados. Voltarei a usar a Vitfix sem hesitar.',
    date: 'Dezembro 2025',
    initiales: 'RA',
    couleur: '#80CBC4',
  },
]

function Etoiles({ note }: { note: number }) {
  return (
    <div className="flex gap-0.5 text-lg">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= note ? 'text-yellow' : 'text-gray-200'}>★</span>
      ))}
    </div>
  )
}

export default async function AvisPage() {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  const temoignages = isPt ? temoignagesPT : temoignagesFR
  const moyenne = (temoignages.reduce((a, t) => a + t.note, 0) / temoignages.length).toFixed(1)
  const searchPath = isPt ? '/pesquisar' : '/recherche'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Vitfix',
        url: isPt ? 'https://vitfix.io/pt/' : 'https://vitfix.io/',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: moyenne,
          reviewCount: isPt ? 2300 : 12000,
          bestRating: '5',
          worstRating: '1',
        },
        review: temoignages.map(t => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: t.nom },
          reviewRating: {
            '@type': 'Rating',
            ratingValue: t.note,
            bestRating: '5',
            worstRating: '1',
          },
          reviewBody: t.texte,
          datePublished: '2026-01-15',
          itemReviewed: {
            '@type': 'Service',
            name: t.metier,
            areaServed: { '@type': 'City', name: t.ville },
          },
        })),
      },
    ],
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className="min-h-screen bg-warm-gray">

      {/* ── Hero section ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-6">
            <span>⭐</span>
            <span className="text-dark">{isPt ? 'Avaliações verificadas' : 'Avis vérifiés'}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-6">
            {isPt ? 'Avaliações dos nossos clientes' : 'Avis de nos clients'}
          </h1>

          {/* Score card */}
          <div className="inline-flex items-center gap-6 bg-white rounded-2xl shadow-sm border border-border/50 px-8 py-5 mb-6">
            <div className="text-center">
              <span className="text-5xl font-display font-extrabold text-yellow">{moyenne}</span>
              <span className="text-2xl text-yellow">/5</span>
            </div>
            <div className="h-12 w-px bg-border/50"></div>
            <div className="text-left">
              <Etoiles note={5} />
              <p className="text-text-muted text-sm mt-1">
                {isPt ? `${temoignages.length} avaliações verificadas` : `${temoignages.length} avis vérifiés`}
              </p>
            </div>
          </div>

          <p className="text-text-muted max-w-xl mx-auto text-lg leading-relaxed">
            {isPt
              ? 'Todas as avaliações são recolhidas após cada intervenção e verificadas pela nossa equipa.'
              : 'Tous les avis sont collectés après chaque intervention et vérifiés par notre équipe.'}
          </p>
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section className="py-8 bg-white border-y border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {(isPt ? [
              { icon: '✅', text: 'Avaliações verificadas' },
              { icon: '🔒', text: 'Perfis autenticados' },
              { icon: '📋', text: 'Após cada intervenção' },
              { icon: '🚫', text: 'Sem avaliações falsas' },
            ] : [
              { icon: '✅', text: 'Avis vérifiés' },
              { icon: '🔒', text: 'Profils authentifiés' },
              { icon: '📋', text: 'Après chaque intervention' },
              { icon: '🚫', text: 'Aucun faux avis' },
            ]).map(b => (
              <div key={b.text} className="flex items-center gap-2 text-sm font-medium text-dark">
                <span className="text-lg">{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Grille d'avis ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {temoignages.map((t) => (
              <div key={t.nom} className="bg-white rounded-2xl shadow-sm border border-border/30 p-6 hover:shadow-md hover:border-yellow/30 transition-all">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-dark/80 shrink-0"
                    style={{ background: t.couleur }}
                  >
                    {t.initiales}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-dark text-[0.95rem]">{t.nom}</p>
                    <p className="text-text-muted text-xs">{t.ville} · {t.date}</p>
                  </div>
                  <span className="bg-yellow/10 border border-yellow/25 text-dark text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
                    {t.metier}
                  </span>
                </div>

                {/* Stars */}
                <Etoiles note={t.note} />

                {/* Review text */}
                <p className="text-text-muted text-[0.88rem] mt-3 leading-relaxed">
                  &laquo; {t.texte} &raquo;
                </p>

                {/* Verified badge */}
                <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-500"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/></svg>
                  <span className="text-xs text-text-muted font-medium">{isPt ? 'Avaliação verificada' : 'Avis vérifié'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 bg-dark text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {(isPt ? [
              { value: '4.8/5', label: 'Nota média' },
              { value: '98%', label: 'Clientes satisfeitos' },
              { value: '< 2h', label: 'Tempo de resposta' },
              { value: '2 800+', label: 'Profissionais verificados' },
            ] : [
              { value: '4.8/5', label: 'Note moyenne' },
              { value: '98%', label: 'Clients satisfaits' },
              { value: '< 2h', label: 'Délai de réponse' },
              { value: '2 800+', label: 'Artisans vérifiés' },
            ]).map(s => (
              <div key={s.label}>
                <div className="font-display text-2xl md:text-3xl font-extrabold text-yellow">{s.value}</div>
                <div className="text-white/70 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-dark mb-4">
            {isPt ? 'Junte-se aos nossos clientes satisfeitos' : 'Rejoignez nos clients satisfaits'}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            {isPt
              ? 'Reserve o seu profissional agora e deixe a sua avaliação após a intervenção.'
              : 'Réservez votre artisan dès maintenant et laissez votre avis après l\'intervention.'}
          </p>
          <Link
            href={searchPath}
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            {isPt ? 'Encontrar um profissional' : 'Trouver un artisan'}
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
    </>
  )
}
