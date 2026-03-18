import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comment ça marche ? Trouvez un artisan vérifié à Marseille | Vitfix',
  description: 'Découvrez comment Vitfix fonctionne : recherchez un artisan qualifié à Marseille et en PACA, comparez les avis, réservez en ligne. Devis gratuit, sans engagement, réponse rapide.',
  openGraph: {
    title: 'Comment ça marche ? Artisans vérifiés à Marseille — Vitfix',
    description: 'Cherchez, comparez et réservez un artisan vérifié à Marseille et dans toute la PACA. Devis gratuit, sans engagement.',
    siteName: 'Vitfix',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comment ça marche ? — Vitfix Marseille',
    description: 'Cherchez, comparez et réservez un artisan vérifié. Devis gratuit.',
  },
  alternates: {
    canonical: 'https://vitfix.io/fr/comment-ca-marche/',
  },
}

const steps = [
  {
    number: '01',
    icon: '🔍',
    title: 'Décrivez votre besoin',
    description: 'Indiquez le type de travaux (plomberie, électricité, peinture…) et votre adresse à Marseille ou en PACA. Vitfix vous affiche les artisans disponibles dans votre secteur en quelques secondes.',
  },
  {
    number: '02',
    icon: '⭐',
    title: 'Comparez les artisans',
    description: 'Consultez les profils vérifiés, les avis clients authentifiés et les tarifs. Chaque artisan Vitfix possède une assurance RC Pro et une identité vérifiée par notre équipe.',
  },
  {
    number: '03',
    icon: '📅',
    title: 'Réservez en ligne — devis gratuit',
    description: 'Choisissez le créneau qui vous convient. Le devis est gratuit et sans engagement. Confirmation instantanée par SMS et e-mail.',
  },
  {
    number: '04',
    icon: '🏠',
    title: "L'artisan intervient chez vous",
    description: "L'artisan arrive à l'heure convenue, réalise les travaux et vous remet une facture détaillée. Vous pouvez laisser un avis après chaque intervention.",
  },
]

const guarantees = [
  {
    icon: '🛡️',
    title: 'Artisans vérifiés',
    description: "Chaque artisan passe par une vérification d'identité, de RC Pro et de qualifications avant toute publication de profil.",
  },
  {
    icon: '💶',
    title: 'Devis gratuit',
    description: 'Obtenez des devis détaillés avant tout engagement. Aucune surprise sur la facture finale.',
  },
  {
    icon: '⭐',
    title: 'Avis vérifiés',
    description: "Chaque avis est laissé par un client ayant réellement effectué une réservation. Zéro faux avis.",
  },
  {
    icon: '📞',
    title: 'Disponible 7j/7',
    description: 'Notre équipe répond tous les jours pour toute question ou urgence en PACA.',
  },
  {
    icon: '⚡',
    title: 'Urgences 24h',
    description: 'Fuite, panne électrique, serrurerie — des artisans disponibles en moins de 2h à Marseille.',
  },
  {
    icon: '📄',
    title: 'Facture et devis PDF',
    description: 'Devis et factures générés automatiquement, conformes à la législation française.',
  },
]

const faqs = [
  {
    question: 'Vitfix est-il gratuit pour les particuliers ?',
    answer: 'Oui, Vitfix est entièrement gratuit pour les particuliers. Vous ne payez rien pour rechercher un artisan, demander un devis ou effectuer une réservation. La plateforme est financée par les abonnements des artisans professionnels.',
  },
  {
    question: 'Comment sont vérifiés les artisans sur Vitfix ?',
    answer: "Chaque artisan fournit son numéro SIRET, son assurance RC Pro en cours de validité et un document d'identité. Notre équipe vérifie manuellement chaque dossier avant la publication du profil. Le badge \"Vérifié Vitfix\" garantit que toutes ces vérifications sont conformes.",
  },
  {
    question: 'Puis-je annuler une réservation ?',
    answer: "Oui, vous pouvez annuler gratuitement jusqu'à 24h avant l'intervention. Pour une annulation de dernière minute, contactez directement l'artisan ou notre service client.",
  },
  {
    question: "Que se passe-t-il si le travail n'est pas satisfaisant ?",
    answer: "Tous les travaux sont couverts par l'assurance RC Pro de l'artisan. En cas de problème, notre équipe médie la situation et garantit une solution : reprise gratuite ou remboursement selon les cas.",
  },
  {
    question: 'Dans quelles villes Vitfix est-il disponible ?',
    answer: "Vitfix est disponible à Marseille et dans toute la région PACA : Aix-en-Provence, Aubagne, La Ciotat, Cassis, Martigues, Salon-de-Provence, Hyères et de nombreuses autres villes des Bouches-du-Rhône et du Var.",
  },
  {
    question: 'Combien de temps pour trouver un artisan disponible ?',
    answer: "En situation normale, vous recevez une confirmation sous 2h. Pour les urgences (fuite, panne électrique, serrurerie), nos artisans peuvent intervenir le jour même à Marseille et dans les communes limitrophes.",
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Comment ça marche ? — Vitfix Marseille & PACA',
      description: "Guide complet pour trouver et réserver un artisan vérifié à Marseille et en PACA avec Vitfix.",
      url: 'https://vitfix.io/fr/comment-ca-marche/',
      inLanguage: 'fr-FR',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Vitfix', item: 'https://vitfix.io/' },
          { '@type': 'ListItem', position: 2, name: 'Comment ça marche', item: 'https://vitfix.io/fr/comment-ca-marche/' },
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
      '@type': 'HowTo',
      name: 'Comment réserver un artisan sur Vitfix',
      description: 'Processus simple en 4 étapes pour trouver et réserver un artisan vérifié à Marseille et en PACA.',
      totalTime: 'PT5M',
      step: steps.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: step.title,
        text: step.description,
      })),
    },
  ],
}

export default function CommentCaMarchePage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">Vitfix</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Comment ça marche</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🇫🇷</span>
            <span className="text-dark">Marseille & PACA</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Comment ça marche sur Vitfix ?
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Trouvez, comparez et réservez un artisan vérifié à Marseille et en PACA en moins de 5 minutes. Devis gratuit, sans engagement.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/recherche/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Trouver un artisan maintenant
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <Link
              href="/fr/artisans-verifies/"
              className="inline-flex items-center gap-2 border border-dark/20 text-dark rounded-full px-7 py-3 text-[0.95rem] hover:bg-dark hover:text-white transition-all"
            >
              Voir nos garanties
            </Link>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3 text-center">
            4 étapes simples
          </h2>
          <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
            De la demande à l'intervention, tout est simple, rapide et transparent.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step) => (
              <div key={step.number} className="bg-white rounded-2xl p-6 border border-border/50 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-yellow/10 flex items-center justify-center text-2xl">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-yellow uppercase tracking-widest mb-1">Étape {step.number}</div>
                  <h3 className="font-display font-bold text-dark mb-2">{step.title}</h3>
                  <p className="text-[0.93rem] text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUARANTEES */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Nos engagements
          </h2>
          <p className="text-text-muted mb-10 max-w-xl">
            Vitfix s'engage sur la qualité et la transparence à chaque intervention en PACA.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guarantees.map((g) => (
              <div key={g.title} className="rounded-2xl border border-border/50 p-5 hover:border-yellow/40 transition-colors">
                <div className="text-3xl mb-3">{g.icon}</div>
                <h3 className="font-display font-bold text-dark mb-2">{g.title}</h3>
                <p className="text-[0.93rem] text-text-muted leading-relaxed">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Nos artisans à Marseille et en PACA
          </h2>
          <p className="text-text-muted mb-8">
            Plombiers, électriciens, peintres, jardiniers, serruriers… 20 corps de métier disponibles dans toute la région.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            {['Plombier', 'Électricien', 'Peintre', 'Serrurier', 'Jardinier', 'Couvreur', 'Carreleur', 'Maçon', 'Climatisation', 'Vitrier'].map(service => (
              <Link
                key={service}
                href={`/fr/services/${service.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}-marseille/`}
                className="px-4 py-2 rounded-full border border-border/50 text-sm font-medium text-dark hover:border-yellow hover:bg-yellow/5 transition-all"
              >
                {service}
              </Link>
            ))}
          </div>
          <Link
            href="/fr/services/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-dark hover:text-yellow transition"
          >
            Voir tous les services
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Questions fréquentes
          </h2>
          <p className="text-text-muted mb-8">Tout ce qu'il faut savoir avant votre première réservation.</p>
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

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl p-8 md:p-12 text-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-white mb-4">
              Prêt à trouver votre artisan à Marseille ?
            </h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Recherche gratuite. Devis sans engagement. Artisans vérifiés en PACA.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/recherche/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Rechercher un artisan
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href="/fr/artisans-verifies/"
                className="inline-flex items-center gap-2 border border-white/30 text-white rounded-full px-8 py-4 text-base hover:bg-white/10 transition-all"
              >
                Voir les garanties qualité
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
