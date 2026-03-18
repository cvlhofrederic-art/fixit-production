import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Devenir Artisan Partenaire Vitfix — Marseille & PACA | Vitfix',
  description: 'Rejoignez Vitfix et recevez plus de clients particuliers à Marseille et en PACA. Sans commission par chantier. Créez votre profil gratuitement et développez votre activité.',
  openGraph: {
    title: 'Devenir Artisan Partenaire Vitfix — Plus de clients en PACA',
    description: 'Créez votre profil d\'artisan sur Vitfix et recevez des demandes de clients vérifiés dans votre zone. Gratuit pour commencer.',
    siteName: 'Vitfix',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Devenir Partenaire Vitfix — Artisan Marseille & PACA',
    description: 'Plus de clients, sans commission par chantier. Inscrivez-vous gratuitement.',
  },
  alternates: {
    canonical: 'https://vitfix.io/fr/devenir-partenaire/',
  },
}

const benefits = [
  {
    icon: '📱',
    title: 'Profil professionnel visible',
    description: 'Créez votre fiche artisan avec photos de chantiers, description des prestations, zone d\'intervention et disponibilités. Référencé dans les résultats Google.',
  },
  {
    icon: '📩',
    title: 'Recevez des demandes ciblées',
    description: 'Les clients particuliers vous contactent directement via la plateforme. Acceptez ou refusez selon votre agenda et votre charge de travail.',
  },
  {
    icon: '⭐',
    title: 'Construisez votre réputation',
    description: 'Collectez des avis vérifiés après chaque chantier. Un bon score attire automatiquement plus de clients dans votre secteur.',
  },
  {
    icon: '📅',
    title: 'Agenda numérique intégré',
    description: 'Gérez vos réservations, disponibilités et interventions depuis l\'application. Rappels automatiques pour vous et vos clients.',
  },
  {
    icon: '📊',
    title: 'Devis et facturation PDF',
    description: 'Générez devis et factures conformes (mentions légales, TVA) directement depuis la plateforme. Suivez votre chiffre d\'affaires mensuel.',
  },
  {
    icon: '🏅',
    title: 'Badge "Artisan Vérifié Vitfix"',
    description: 'Après vérification de votre SIRET, RC Pro et qualifications, obtenez le badge de confiance — signal fort pour les clients particuliers.',
  },
]

const plans = [
  {
    name: 'Gratuit',
    price: '0 €',
    period: '/mois',
    description: 'Pour démarrer sans risque.',
    features: [
      'Profil artisan sur la plateforme',
      "Jusqu'à 5 demandes par mois",
      'Avis clients vérifiés',
      'Application mobile incluse',
    ],
    cta: 'Créer mon profil gratuit',
    href: '/pro/register/',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '29 €',
    period: '/mois',
    description: 'Pour les artisans qui veulent développer leur activité.',
    features: [
      'Profil mis en avant dans les résultats',
      'Demandes illimitées',
      'Agenda numérique avancé',
      'Devis et factures PDF automatiques',
      'Statistiques d\'activité',
      'Support prioritaire 7j/7',
    ],
    cta: 'Démarrer l\'essai gratuit',
    href: '/pro/register/',
    highlighted: true,
  },
]

const testimonials = [
  {
    name: 'Karim B.',
    job: 'Plombier',
    city: 'Marseille 13e',
    text: 'Depuis que je suis sur Vitfix, mon agenda est plein. La clientèle particulière est plus facile à gérer et les avis vérifiés m\'ont donné une vraie crédibilité dans le secteur.',
    rating: 5,
  },
  {
    name: 'Franck D.',
    job: 'Électricien',
    city: 'Aix-en-Provence',
    text: 'La facturation intégrée m\'a fait gagner des heures chaque mois. Je recommande à tous les artisans qui veulent arrêter de courir après les clients.',
    rating: 5,
  },
  {
    name: 'Sébastien M.',
    job: 'Peintre',
    city: 'Aubagne',
    text: '15 ans de métier et Vitfix m\'a apporté des clients que je n\'aurais jamais touchés autrement — notamment des copropriétés et des syndics. Excellent rapport qualité/prix.',
    rating: 5,
  },
]

const faqs = [
  {
    question: 'Combien coûte l\'inscription sur Vitfix ?',
    answer: "L'inscription de base est gratuite et vous permet de recevoir jusqu'à 5 demandes par mois sans frais. Le plan Pro est à 29 €/mois HT et offre des demandes illimitées, la facturation intégrée et un profil mis en avant.",
  },
  {
    question: 'Vitfix prend-il une commission sur les chantiers ?',
    answer: "Non. Vitfix ne prend aucune commission sur vos chantiers. Vous payez uniquement l'abonnement mensuel — aucune surprise sur votre trésorerie.",
  },
  {
    question: 'Quels documents faut-il pour s\'inscrire ?',
    answer: "Pour l'inscription de base, votre e-mail et numéro de téléphone suffisent. Pour obtenir le badge \"Artisan Vérifié Vitfix\" (recommandé pour plus de confiance), nous demandons votre numéro SIRET, attestation RC Pro et pièce d'identité.",
  },
  {
    question: 'Puis-je choisir ma zone d\'intervention ?',
    answer: "Oui. Vous définissez votre rayon d'action depuis votre domicile ou siège social — par exemple 20 km autour de Marseille. Vous ne recevez des demandes que dans votre zone définie.",
  },
  {
    question: 'Combien de temps avant de recevoir mes premières demandes ?',
    answer: "Une fois le profil validé (généralement 24-48h), votre fiche est visible pour les clients. Les premières demandes arrivent habituellement dans la première semaine selon votre secteur et spécialité.",
  },
  {
    question: 'Puis-je résilier à tout moment ?',
    answer: "Oui, résiliation à tout moment sans pénalité. Le profil gratuit reste actif même après résiliation du plan Pro.",
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Devenir Artisan Partenaire Vitfix — Marseille & PACA',
      description: 'Rejoignez la plateforme Vitfix pour recevoir plus de clients particuliers en PACA.',
      url: 'https://vitfix.io/fr/devenir-partenaire/',
      inLanguage: 'fr-FR',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Vitfix', item: 'https://vitfix.io/' },
          { '@type': 'ListItem', position: 2, name: 'Devenir Partenaire', item: 'https://vitfix.io/fr/devenir-partenaire/' },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
    {
      '@type': 'Service',
      name: 'Plateforme Vitfix pour Artisans',
      description: 'Plateforme numérique qui met en relation des artisans vérifiés avec des clients particuliers en PACA.',
      provider: { '@type': 'Organization', name: 'Vitfix', url: 'https://vitfix.io/' },
      areaServed: { '@type': 'State', name: 'Provence-Alpes-Côte d\'Azur, France' },
      offers: [
        {
          '@type': 'Offer',
          name: 'Plan Gratuit',
          price: '0',
          priceCurrency: 'EUR',
          description: "Profil de base avec jusqu'à 5 demandes par mois",
        },
        {
          '@type': 'Offer',
          name: 'Plan Pro',
          price: '29',
          priceCurrency: 'EUR',
          description: 'Demandes illimitées, facturation, profil mis en avant',
        },
      ],
    },
  ],
}

export default function DevenirPartenairePage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">Vitfix</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Devenir Partenaire</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🤝</span>
            <span className="text-dark">Pour les artisans · Marseille & PACA</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Développez votre activité en PACA avec Vitfix
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Rejoignez Vitfix et recevez des demandes de clients particuliers vérifiés dans votre zone. Sans commission par chantier. Gratuit pour commencer.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/pro/register/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Créer mon profil artisan — gratuit
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <a
              href="mailto:pro@vitfix.io"
              className="inline-flex items-center gap-2 border border-dark/20 text-dark rounded-full px-7 py-3 text-[0.95rem] hover:bg-dark hover:text-white transition-all"
            >
              Nous contacter
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Sans commission sur les chantiers</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Résiliation libre à tout moment</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profil référencé sur Google</span>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Ce que Vitfix apporte à votre activité
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            Une plateforme complète pour gérer et développer votre activité d'artisan en PACA.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-2xl p-5 border border-border/50 hover:border-yellow/40 transition-colors">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="font-display font-bold text-dark mb-2">{b.title}</h3>
                <p className="text-[0.93rem] text-text-muted leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Ce qu'en disent nos artisans partenaires
          </h2>
          <p className="text-text-muted mb-10">Des artisans marseillais qui développent leur activité avec Vitfix.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/50 p-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <span key={i} className="text-yellow">★</span>
                  ))}
                </div>
                <p className="text-[0.93rem] text-dark/80 leading-relaxed mb-4">&quot;{t.text}&quot;</p>
                <div>
                  <p className="font-bold text-dark text-sm">{t.name}</p>
                  <p className="text-text-muted text-xs">{t.job} · {t.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3 text-center">
            Tarifs transparents
          </h2>
          <p className="text-text-muted mb-10 text-center">Sans commission. Sans surprise. Sans engagement long terme.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${plan.highlighted
                  ? 'border-yellow bg-dark text-white'
                  : 'border-border/50 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-block text-xs font-bold text-dark bg-yellow rounded-full px-3 py-1 mb-4 uppercase tracking-wider">
                    Le plus choisi
                  </div>
                )}
                <div className="mb-4">
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.highlighted ? 'text-white/60' : 'text-text-muted'}`}>{plan.period}</span>
                </div>
                <p className={`text-sm mb-5 ${plan.highlighted ? 'text-white/70' : 'text-text-muted'}`}>{plan.description}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-[0.93rem] ${plan.highlighted ? 'text-white/90' : 'text-dark'}`}>
                      <span className="text-yellow">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center rounded-full py-3 px-6 font-display font-bold text-[0.95rem] transition-all hover:-translate-y-0.5 ${plan.highlighted
                    ? 'bg-yellow text-dark hover:bg-yellow-light shadow-[0_6px_20px_rgba(255,214,0,0.3)]'
                    : 'bg-dark text-white hover:bg-mid'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Questions des artisans
          </h2>
          <p className="text-text-muted mb-8">Tout ce qu'il faut savoir avant de rejoindre Vitfix en tant qu'artisan.</p>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
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

      {/* FINAL CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Commencez aujourd'hui — c'est gratuit
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Créez votre profil en 5 minutes et commencez à recevoir des demandes de clients particuliers à Marseille et en PACA.
          </p>
          <Link
            href="/pro/register/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Créer mon profil artisan gratuitement
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
