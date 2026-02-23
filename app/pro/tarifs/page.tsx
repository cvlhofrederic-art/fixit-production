import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Offres artisans - VitFix',
  description: 'Rejoignez VitFix et développez votre activité. Découvrez nos offres pour les artisans.',
}

const offres = [
  {
    nom: 'Starter',
    prix: 'Gratuit',
    soustitre: 'Pour démarrer',
    couleur: 'border-gray-200',
    avantages: [
      'Profil artisan vérifié',
      'Jusqu\'à 5 réservations par mois',
      'Agenda en ligne',
      'Messagerie client',
      'Support email',
    ],
    cta: 'S\'inscrire gratuitement',
    href: '/pro/register',
    highlight: false,
  },
  {
    nom: 'Pro',
    prix: '49€ / mois',
    soustitre: 'Le plus populaire',
    couleur: 'border-[#FFC107]',
    avantages: [
      'Tout le Starter inclus',
      'Réservations illimitées',
      'Mise en avant dans les résultats',
      'Devis & factures PDF',
      'Comptabilité intégrée (agent IA)',
      'Proof of Work (photos horodatées)',
      'Notifications push',
      'Support prioritaire',
    ],
    cta: 'Démarrer l\'offre Pro',
    href: '/pro/register',
    highlight: true,
  },
  {
    nom: 'Entreprise',
    prix: 'Sur devis',
    soustitre: 'Pour les équipes',
    couleur: 'border-gray-200',
    avantages: [
      'Tout le Pro inclus',
      'Gestion multi-artisans',
      'Espace syndics & conciergeries',
      'Ordres de mission automatisés',
      'API & intégrations',
      'Account manager dédié',
    ],
    cta: 'Nous contacter',
    href: '/contact',
    highlight: false,
  },
]

export default function ProTarifsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Des offres pour chaque artisan
          </h1>
          <p className="text-lg text-gray-600">
            Commencez gratuitement et évoluez selon vos besoins
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {offres.map((offre) => (
            <div
              key={offre.nom}
              className={`bg-white rounded-2xl shadow-sm border-2 p-8 flex flex-col ${offre.couleur} ${offre.highlight ? 'shadow-lg scale-105' : ''}`}
            >
              {offre.highlight && (
                <div className="bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1 rounded-full text-center mb-4 w-fit mx-auto">
                  RECOMMANDÉ
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 text-center mb-1">{offre.nom}</h2>
              <p className="text-gray-500 text-sm text-center mb-4">{offre.soustitre}</p>
              <div className="text-3xl font-bold text-center text-[#FFC107] mb-6">{offre.prix}</div>
              <ul className="space-y-2 mb-8 flex-1">
                {offre.avantages.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-gray-700 text-sm">
                    <span className="text-[#FFC107] font-bold mt-0.5">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
              <Link
                href={offre.href}
                className={`block text-center py-3 rounded-lg font-semibold transition ${
                  offre.highlight
                    ? 'bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900'
                    : 'border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6]'
                }`}
              >
                {offre.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Des questions sur nos offres ?</h2>
          <p className="text-gray-600 mb-4">Notre équipe est disponible pour vous accompagner dans votre choix.</p>
          <Link href="/contact" className="text-[#FFC107] font-semibold hover:underline">
            Contacter l&apos;équipe VitFix →
          </Link>
        </div>
      </div>
    </div>
  )
}
