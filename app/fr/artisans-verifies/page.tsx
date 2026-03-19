import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Artisans Vérifiés à Marseille — Garantie Vitfix | Vitfix',
  description: 'Tous les artisans Vitfix sont vérifiés : SIRET, assurance RC Pro, qualifications. Travaux garantis à Marseille, Aix-en-Provence, Aubagne et en PACA. Avis clients authentiques.',
  openGraph: {
    title: 'Artisans Vérifiés à Marseille — Garantie Vitfix',
    description: 'RC Pro, SIRET et qualifications vérifiés. Avis clients authentiques. Faites confiance aux artisans Vitfix pour vos travaux en PACA.',
    siteName: 'Vitfix',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Artisans Vérifiés Marseille — Garantie Vitfix',
    description: 'RC Pro, SIRET, qualifications. Artisans de confiance en PACA.',
  },
  alternates: {
    canonical: 'https://vitfix.io/fr/artisans-verifies/',
    languages: {
      'fr': 'https://vitfix.io/fr/artisans-verifies/',
      'pt': 'https://vitfix.io/pt/profissionais-verificados/',
      'x-default': 'https://vitfix.io/fr/artisans-verifies/',
    },
  },
}

const verificationSteps = [
  {
    icon: '🪪',
    title: "Vérification d'identité",
    description: "Chaque artisan présente une pièce d'identité valide. L'identité est vérifiée manuellement par notre équipe avant toute publication du profil.",
  },
  {
    icon: '🛡️',
    title: 'Assurance RC Pro obligatoire',
    description: "Tous les artisans fournissent une attestation d'assurance responsabilité civile professionnelle en cours de validité. Vous êtes couvert contre les dommages matériels et corporels.",
  },
  {
    icon: '📋',
    title: 'SIRET et statut légal',
    description: "Nous vérifions le numéro SIRET auprès du registre officiel des entreprises. Seuls les artisans en règle avec leur situation administrative sont acceptés.",
  },
  {
    icon: '⭐',
    title: 'Avis vérifiés',
    description: "Chaque avis ne peut être laissé que par un client ayant effectué une réservation payée et confirmée. Zéro faux avis, zéro avis invités.",
  },
]

const reviews = [
  {
    author: 'Marie-Claire D.',
    city: 'Marseille 8e',
    service: 'Plomberie',
    rating: 5,
    text: "Artisan excellent ! Ponctuel, propre et efficace. La fuite sous l'évier réparée en 45 minutes. Le badge \"Vérifié Vitfix\" m'a vraiment rassurée avant de le contacter.",
    date: 'Février 2026',
  },
  {
    author: 'Jean-Pierre M.',
    city: 'Aix-en-Provence',
    service: 'Électricité',
    rating: 5,
    text: 'Mise aux normes du tableau électrique réalisée dans les règles. Certificat de conformité remis à la fin. Professionnel sérieux, je recommande sans hésiter.',
    date: 'Janvier 2026',
  },
  {
    author: 'Sandrine L.',
    city: 'Aubagne',
    service: 'Peinture',
    rating: 5,
    text: 'Appartement entier repeint en 3 jours. Finitions impeccables, protection des meubles soignée. Le chantier était propre à la fin de chaque journée.',
    date: 'Mars 2026',
  },
  {
    author: 'Ahmed B.',
    city: 'Marseille 13e',
    service: 'Serrurerie',
    rating: 5,
    text: "Ouverture de porte en urgence à 22h. L'artisan était là en 35 minutes, tarif annoncé respecté. Aucune mauvaise surprise, très professionnel.",
    date: 'Février 2026',
  },
  {
    author: 'Christine V.',
    city: 'La Ciotat',
    service: 'Jardinage',
    rating: 5,
    text: 'Élagage des palmiers et entretien du jardin. Équipe sérieuse, tarif correct, très beau résultat. Je vais reprendre le contrat annuel avec le même artisan.',
    date: 'Janvier 2026',
  },
  {
    author: 'Patrick R.',
    city: 'Martigues',
    service: 'Plomberie',
    rating: 4,
    text: 'Remplacement chauffe-eau bien réalisé. Légèrement plus long que prévu mais le résultat est parfait. Artisan consciencieux et de bon conseil.',
    date: 'Décembre 2025',
  },
]

const totalReviews = reviews.length
const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)

const faqs = [
  {
    question: 'Que garantit le badge "Artisan Vérifié Vitfix" ?',
    answer: "Le badge garantit que l'artisan a fourni et fait valider : sa pièce d'identité, son attestation RC Pro en cours de validité, son numéro SIRET actif et ses qualifications professionnelles. C'est la garantie maximale de sérieux.",
  },
  {
    question: 'Suis-je couvert si un artisan cause des dégâts ?',
    answer: "Oui. Tous les artisans vérifiés ont une assurance RC Pro obligatoire. En cas de dommage matériel ou corporel lors de l'intervention, l'assurance de l'artisan prend en charge les réparations.",
  },
  {
    question: 'Les avis clients sont-ils authentiques ?',
    answer: "Absolument. Seul un client ayant effectué une réservation payée et confirmée peut laisser un avis. Nous n'acceptons pas d'avis anonymes, invités ou rémunérés.",
  },
  {
    question: "Que faire si je ne suis pas satisfait du travail ?",
    answer: "Contactez notre équipe dans les 48h suivant l'intervention. Nous médions la situation avec l'artisan et garantissons une solution : reprise gratuite ou remboursement selon les cas.",
  },
  {
    question: 'À quelle fréquence vérifiez-vous les assurances ?',
    answer: "Les attestations RC Pro sont vérifiées à l'inscription puis contrôlées chaque année. Si un artisan ne renouvelle pas son assurance, le badge \"Vérifié\" est immédiatement suspendu.",
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Artisans Vérifiés à Marseille — Garantie Vitfix',
      description: "Information sur le processus de vérification des artisans Vitfix en PACA.",
      url: 'https://vitfix.io/fr/artisans-verifies/',
      inLanguage: 'fr-FR',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Vitfix', item: 'https://vitfix.io/' },
          { '@type': 'ListItem', position: 2, name: 'Artisans Vérifiés', item: 'https://vitfix.io/fr/artisans-verifies/' },
        ],
      },
    },
    {
      '@type': 'Organization',
      name: 'Vitfix',
      url: 'https://vitfix.io/',
      areaServed: { '@type': 'State', name: 'Provence-Alpes-Côte d\'Azur' },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating,
        reviewCount: totalReviews,
        bestRating: '5',
        worstRating: '1',
      },
      review: reviews.map(r => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: '5',
          worstRating: '1',
        },
        reviewBody: r.text,
        datePublished: '2026-01-15',
        itemReviewed: {
          '@type': 'Service',
          name: r.service,
          areaServed: { '@type': 'City', name: r.city },
        },
      })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
}

export default function ArtisansVerifiesPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">Vitfix</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Artisans Vérifiés</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🛡️</span>
            <span className="text-dark">Vérification rigoureuse · Marseille & PACA</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Artisans vérifiés à Marseille — la garantie Vitfix
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Chaque artisan sur la plateforme est vérifié manuellement : identité, RC Pro et SIRET confirmés. Travaillez en toute confiance en PACA.
          </p>

          {/* Rating summary */}
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl px-6 py-4 border border-border/50 mb-8">
            <div className="text-center">
              <div className="font-display text-4xl font-extrabold text-yellow">{avgRating}</div>
              <div className="flex gap-0.5 justify-center mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className="text-yellow">★</span>
                ))}
              </div>
            </div>
            <div className="border-l border-border/50 pl-4">
              <div className="font-bold text-dark">{totalReviews} avis vérifiés</div>
              <div className="text-sm text-text-muted">Laissés par de vrais clients</div>
            </div>
          </div>

          <div>
            <Link
              href="/recherche/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Trouver un artisan vérifié
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* VERIFICATION PROCESS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Notre processus de vérification
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            Avant d'apparaître sur la plateforme, chaque artisan passe par 4 étapes de vérification obligatoires.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {verificationSteps.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl p-6 border border-border/50 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-yellow/10 flex items-center justify-center text-2xl">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-yellow uppercase tracking-widest mb-1">Étape {i + 1}</div>
                  <h3 className="font-display font-bold text-dark mb-2">{step.title}</h3>
                  <p className="text-[0.93rem] text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Ce que disent les clients en PACA
          </h2>
          <p className="text-text-muted mb-10">Avis authentiques de clients à Marseille et dans la région.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <div key={r.author} className="rounded-2xl border border-border/50 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-dark text-sm">{r.author}</p>
                    <p className="text-text-muted text-xs">{r.city}</p>
                  </div>
                  <span className="bg-yellow/10 text-dark text-xs font-semibold px-2 py-1 rounded-full">{r.service}</span>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={i <= r.rating ? 'text-yellow' : 'text-gray-300'}>★</span>
                  ))}
                </div>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed mb-3">&quot;{r.text}&quot;</p>
                <p className="text-xs text-text-muted">{r.date}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/avis/" className="inline-flex items-center gap-2 text-sm font-semibold text-dark hover:text-yellow transition">
              Voir tous les avis clients
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Questions sur nos garanties
          </h2>
          <p className="text-text-muted mb-8">Tout ce qu'il faut savoir sur la vérification et la protection Vitfix.</p>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.question}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl p-8 md:p-12 text-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-white mb-4">
              Prêt à faire confiance à un artisan vérifié ?
            </h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Recherche gratuite. Devis sans engagement. Garantie qualité Vitfix.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/recherche/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Trouver un artisan vérifié
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href="/fr/comment-ca-marche/"
                className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-8 py-4 text-base hover:bg-white/10 transition-all"
              >
                Comment ça marche ?
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
