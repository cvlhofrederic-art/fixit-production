import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerTranslation } from '@/lib/i18n/server'
import { PHONE_PT } from '@/lib/constants'

// Page "Avaliações / Avis" — méthode pro 2026 :
// - Aucun témoignage fictif, aucun chiffre inventé (cf. politique no-lies
//   établie dans lib/schemas/index.ts).
// - Aucun schema Review / AggregateRating tant qu'on n'a pas de source
//   de vérité (Trustpilot ou table Supabase customer_reviews).
// - Page conservée pour le SEO de l'URL et pour préparer l'arrivée de
//   Trustpilot — CTA neutre vers la prise de contact + lien futur Trustpilot.

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  return isPt ? {
    title: 'Avaliações de clientes | Vitfix',
    description: 'Reserve um profissional verificado VITFIX e seja convidado a partilhar a sua avaliação após a intervenção. Em breve, integração Trustpilot.',
    openGraph: {
      title: 'Avaliações de clientes | Vitfix',
      description: 'Reserve um profissional verificado e partilhe a sua experiência após a intervenção.',
      siteName: 'Vitfix',
      locale: 'pt_PT',
      type: 'website',
    },
    alternates: {
      canonical: 'https://vitfix.io/pt/avaliacoes/',
    },
  } : {
    title: 'Avis clients | Vitfix',
    description: 'Réservez un artisan vérifié VITFIX et partagez votre expérience après l\'intervention. Intégration Trustpilot bientôt.',
    openGraph: {
      title: 'Avis clients | Vitfix',
      description: 'Réservez un artisan vérifié et partagez votre expérience après l\'intervention.',
      siteName: 'Vitfix',
      locale: 'fr_FR',
      type: 'website',
    },
    alternates: {
      canonical: 'https://vitfix.io/avis/',
    },
  }
}

export default async function AvisPage() {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'
  const searchPath = isPt ? '/pesquisar' : '/recherche'

  return (
    <div className="min-h-screen bg-warm-gray">

      {/* ── Hero section ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-6">
            <span>⭐</span>
            <span className="text-dark">{isPt ? 'Avaliações verificadas' : 'Avis vérifiés'}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-6">
            {isPt ? 'Avaliações dos nossos clientes' : 'Avis de nos clients'}
          </h1>

          <p className="text-text-muted max-w-xl mx-auto text-lg leading-relaxed">
            {isPt
              ? 'Plataforma jovem em fase de lançamento : as primeiras avaliações verificadas dos nossos clientes irão aparecer aqui após cada intervenção. Em breve, integração Trustpilot oficial.'
              : 'Plateforme jeune en phase de lancement : les premiers avis vérifiés de nos clients apparaîtront ici après chaque intervention. Intégration Trustpilot officielle bientôt.'}
          </p>
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section className="py-8 bg-white border-y border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {(isPt ? [
              { icon: '✅', text: 'Profissionais verificados' },
              { icon: '🔒', text: 'Perfis autenticados' },
              { icon: '📋', text: 'Avaliação após cada intervenção' },
              { icon: '🚫', text: 'Política rigorosa anti-avaliações falsas' },
            ] : [
              { icon: '✅', text: 'Artisans vérifiés' },
              { icon: '🔒', text: 'Profils authentifiés' },
              { icon: '📋', text: 'Avis après chaque intervention' },
              { icon: '🚫', text: 'Politique stricte anti-faux avis' },
            ]).map(b => (
              <div key={b.text} className="flex items-center gap-2 text-sm font-medium text-dark">
                <span className="text-lg">{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Promesse Trustpilot à venir ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-border/30 p-8 md:p-12">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-dark mb-4">
              {isPt ? 'Seja o primeiro a partilhar a sua experiência' : 'Soyez le premier à partager votre expérience'}
            </h2>
            <p className="text-text-muted leading-relaxed mb-2">
              {isPt
                ? 'Após cada intervenção concluída pela nossa rede, convidamos o cliente a deixar a sua avaliação. Os primeiros testemunhos certificados serão publicados aqui assim que disponíveis, com integração Trustpilot oficial.'
                : 'Après chaque intervention réalisée par notre réseau, nous invitons le client à laisser son avis. Les premiers témoignages certifiés seront publiés ici dès qu\'ils seront disponibles, avec intégration Trustpilot officielle.'}
            </p>
            <p className="text-sm text-text-muted/70 mt-6 italic">
              {isPt
                ? 'Não publicamos avaliações fabricadas. Cada futura avaliação é ligada a uma intervenção real e a um profissional verificado.'
                : 'Nous ne publions aucun avis fabriqué. Chaque futur avis sera lié à une intervention réelle et à un artisan vérifié.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 md:py-20 bg-white border-t border-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-dark mb-4">
            {isPt ? 'Reserve o seu profissional verificado' : 'Réservez votre artisan vérifié'}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            {isPt
              ? 'Encontre um profissional disponível na sua região e prepare a sua avaliação após a intervenção.'
              : 'Trouvez un artisan disponible dans votre région et préparez votre avis après l\'intervention.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={searchPath}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              {isPt ? 'Encontrar um profissional' : 'Trouver un artisan'}
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            {isPt && (
              <>
                <a
                  href={`tel:${PHONE_PT}`}
                  className="inline-flex items-center gap-2 bg-dark text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-dark/90 hover:-translate-y-0.5 transition-all"
                >
                  📞 Ligar +351 912 014 971
                </a>
                <a
                  href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent('Olá VITFIX, gostaria de pedir um orçamento.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] transition-all"
                >
                  💬 WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
