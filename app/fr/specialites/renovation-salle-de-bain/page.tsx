import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Rénovation Salle de Bain Marseille — Clé en main, devis gratuit | VITFIX',
  description: 'Rénovation complète salle de bain à Marseille et PACA : plomberie, carrelage, douche à l\'italienne, PMR, meuble vasque. Artisans clé en main. TVA 10%, devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/renovation-salle-de-bain/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Rénovation Salle de Bain Marseille',
      description: 'Rénovation complète de salle de bain à Marseille et en PACA. Plomberie, carrelage, douche italienne, PMR. Clé en main.',
      url: 'https://vitfix.io/fr/specialites/renovation-salle-de-bain/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
      priceRange: '€€',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Rénovation Salle de Bain', item: 'https://vitfix.io/fr/specialites/renovation-salle-de-bain/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Quel est le prix d\'une rénovation de salle de bain à Marseille ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Une rénovation complète de salle de bain à Marseille coûte en moyenne : 3 000 à 5 000 € pour une SDB standard de 4–6 m² (remplacement équipements + carrelage + peinture). 5 000 à 10 000 € pour une rénovation haut de gamme avec douche italienne. 8 000 à 15 000 € pour une rénovation totale avec cloisons, redistribution de l\'espace et équipements PMR. TVA à 10 % pour un logement de plus de 2 ans.',
          },
        },
        {
          '@type': 'Question',
          name: 'Combien de temps dure une rénovation de salle de bain ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Une rénovation standard (remplacement équipements + carrelage, sans modification de cloisons) prend 5 à 10 jours ouvrés. Une rénovation complète avec modification de l\'espace : 2 à 4 semaines. La salle de bain est inutilisable pendant les travaux mais nous minimisons les délais avec des équipes coordonnées (plombier + carreleur + électricien).',
          },
        },
      ],
    },
  ],
}

const PRESTATIONS = [
  { icon: '🚿', label: 'Douche à l\'italienne', desc: 'Pose receveur extra-plat ou bac à douche, paroi vitrée, robinetterie encastrée' },
  { icon: '🛁', label: 'Baignoire / Remplacement', desc: 'Dépose ancienne baignoire, pose neuve, habillage tablier' },
  { icon: '🚽', label: 'WC suspendus', desc: 'Bâti-support, WC suspendu avec plaque de commande, gain de place' },
  { icon: '🪥', label: 'Meuble vasque', desc: 'Meuble double vasque, robinetterie haut de gamme, miroir LED' },
  { icon: '🔲', label: 'Carrelage sol & mur', desc: 'Faïence, grand format, béton ciré, carreaux de ciment' },
  { icon: '💡', label: 'Électricité SDB', desc: 'Éclairage zones, prise rasoir, ventilation VMC, chauffage soufflant' },
  { icon: '♿', label: 'Adaptation PMR', desc: 'Douche de plain-pied, siège rabattable, barres d\'appui, robinets thermostatiques' },
  { icon: '🌿', label: 'Isolation hygrométrie', desc: 'Peinture hydrofuge, imperméabilisation bac à douche (SPEC), ventilation' },
]

const TARIFS = [
  { type: 'Rénovation légère', desc: 'Remplacement robinetterie + joints + peinture', fourchette: '800 – 2 000 €', delai: '2–3 jours' },
  { type: 'Rénovation standard', desc: 'Équipements + carrelage (sans modifier les cloisons)', fourchette: '3 000 – 6 000 €', delai: '1–2 semaines' },
  { type: 'Rénovation complète', desc: 'Tout inclus : redistribution espace, douche italienne, mobilier', fourchette: '6 000 – 12 000 €', delai: '2–4 semaines' },
  { type: 'Rénovation PMR', desc: 'Accessibilité handicapé, douche plain-pied, barres d\'appui', fourchette: '5 000 – 10 000 €', delai: '1–3 semaines' },
]

const FAQS = [
  {
    q: 'Quel est le prix d\'une rénovation de salle de bain à Marseille ?',
    a: 'Les fourchettes de prix à Marseille et en PACA : rénovation légère (robinetterie, joints, peinture) : 800–2 000 €. Rénovation standard (équipements + carrelage) : 3 000–6 000 €. Rénovation complète (redistribution, douche italienne, mobilier) : 6 000–12 000 €. Rénovation PMR : 5 000–10 000 €. TVA à 10 % pour logement de plus de 2 ans. Devis gratuit sur visite.',
  },
  {
    q: 'Combien de temps dure une rénovation de salle de bain ?',
    a: 'Rénovation légère : 2–3 jours. Standard (carrelage + équipements) : 1–2 semaines. Complète avec modification de cloisons : 2–4 semaines. La salle de bain est inutilisable pendant les travaux. Nos équipes coordonnent plombier, carreleur et électricien pour minimiser les délais. Nous pouvons aussi prévoir un WC de remplacement temporaire si nécessaire.',
  },
  {
    q: 'La rénovation de salle de bain est-elle éligible à MaPrimeRénov ?',
    a: 'La rénovation standard de salle de bain (remplacement baignoire, douche) n\'est pas éligible à MaPrimeRénov. En revanche, certains éléments peuvent bénéficier d\'aides : installation d\'une VMC double-flux (CEE), chauffe-eau thermodynamique (MaPrimeRénov), travaux d\'accessibilité PMR (crédit d\'impôt dépenses d\'adaptation logement pour personnes âgées ou handicapées : 25 % du coût plafonné à 5 000 €). TVA à 10 % s\'applique systématiquement.',
  },
  {
    q: 'Comment transformer une baignoire en douche à l\'italienne à Marseille ?',
    a: 'La transformation baignoire → douche italienne est l\'une de nos prestations les plus demandées. Elle nécessite : dépose de la baignoire, création d\'un receveur encastré ou d\'un receveur extra-plat, imperméabilisation complète (SPEC), pose de carrelage, installation de la robinetterie encastrée et de la paroi vitrée. Coût : 2 000 à 5 000 € selon les finitions. Durée : 1 semaine. C\'est aussi une adaptation PMR efficace.',
  },
  {
    q: 'Quelles sont les spécificités d\'une salle de bain en PACA ?',
    a: 'En Provence, deux contraintes principales : 1) L\'eau calcaire (TH élevé à Marseille et Aix) dégrade rapidement la robinetterie et laisse des dépôts blancs — optez pour des robinets traités anti-calcaire et installez un adoucisseur si votre TH dépasse 30°F. 2) L\'humidité côtière en bord de mer (La Ciotat, Cassis, Bandol) favorise les moisissures — une VMC hygro-réglable est indispensable, et les joints doivent être en résine époxy.',
  },
]

export default function RenovationSalleDeMainPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        <section className="bg-zinc-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-sm text-zinc-400 mb-6 flex flex-wrap gap-1">
              <Link href="/fr/" className="hover:text-white">VITFIX</Link>
              <span className="mx-1">/</span>
              <Link href="/fr/specialites/" className="hover:text-white">Spécialités</Link>
              <span className="mx-1">/</span>
              <span className="text-white">Rénovation SDB</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">🛁</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Rénovation Salle de Bain Marseille
                </h1>
                <p className="text-zinc-300 text-lg max-w-2xl leading-relaxed">
                  Rénovation complète salle de bain à Marseille et PACA : plomberie, carrelage,
                  douche à l&apos;italienne, PMR. Artisans coordonnés clé en main. TVA 10%, devis gratuit.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {['🔑 Clé en main', '💰 TVA 10%', '♿ PMR possible', '📐 Devis gratuit sur visite'].map((s) => (
                <span key={s} className="bg-zinc-800 px-4 py-2 rounded-full text-sm text-zinc-200">{s}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Prestations */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-6">Nos prestations</h2>
              <div className="grid grid-cols-2 gap-4">
                {PRESTATIONS.map((p) => (
                  <div key={p.label} className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-2xl mb-1">{p.icon}</div>
                    <div className="font-semibold text-sm text-zinc-900">{p.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tarifs */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">Fourchettes de prix</h2>
              <div className="space-y-3">
                {TARIFS.map((t) => (
                  <div key={t.type} className="flex items-start gap-4 border border-zinc-200 rounded-xl p-4">
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900">{t.type}</div>
                      <div className="text-zinc-500 text-sm mt-1">{t.desc}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-yellow-600">{t.fourchette}</div>
                      <div className="text-xs text-zinc-400">{t.delai}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-3">TVA 10 % pour logement de plus de 2 ans. Devis gratuit sur visite.</p>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-6">Questions fréquentes</h2>
              <div className="space-y-4">
                {FAQS.map((faq, i) => (
                  <details key={i} className="border border-zinc-200 rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 font-semibold text-zinc-900 cursor-pointer hover:bg-zinc-50">
                      {faq.q}
                    </summary>
                    <p className="px-4 pb-4 pt-2 text-zinc-600 text-sm leading-relaxed">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-400 rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">Devis rénovation SDB</h3>
              <p className="text-zinc-800 text-sm mb-4">
                Visite gratuite sous 48h. Devis détaillé clé en main.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20je%20souhaite%20un%20devis%20pour%20la%20r%C3%A9novation%20de%20ma%20salle%20de%20bain%20%C3%A0%20Marseille`}
                className="block bg-green-500 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp
              </a>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/services/carreleur-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🔲 Carreleur Marseille
                </Link>
                <Link href="/fr/services/plombier-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🔧 Plombier Marseille
                </Link>
                <Link href="/fr/specialites/chauffe-eau/" className="block text-sm text-yellow-600 hover:underline">
                  🚿 Remplacement chauffe-eau
                </Link>
                <Link href="/fr/specialites/fuite-eau-urgence/" className="block text-sm text-yellow-600 hover:underline">
                  💧 Fuite eau urgence
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
