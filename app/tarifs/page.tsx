import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs - VitFix',
  description: 'VitFix est gratuit pour les particuliers. Découvrez comment fonctionne notre service.',
}

export default function TarifsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Tarifs transparents
          </h1>
          <p className="text-lg text-gray-600">
            Utiliser VitFix est <strong>100% gratuit</strong> pour les particuliers.
            Vous ne payez que l&apos;artisan, aux tarifs qu&apos;il affiche sur son profil.
          </p>
        </div>

        {/* Particuliers */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 border-2 border-[#FFC107]">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-3xl">🏠</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pour les particuliers</h2>
              <p className="text-gray-500">Accès complet, sans abonnement</p>
            </div>
            <div className="ml-auto">
              <span className="bg-[#FFC107] text-gray-900 px-4 py-1 rounded-full font-bold text-lg">GRATUIT</span>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              'Recherche et comparaison d\'artisans illimitée',
              'Consultation des profils, avis et tarifs',
              'Réservation en ligne en quelques clics',
              'Confirmation par email et rappels automatiques',
              'Messagerie avec l\'artisan',
              'Accès à votre historique de réservations',
              'Aucune commission cachée — vous payez uniquement l\'artisan',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-gray-700">
                <span className="text-[#FFC107] font-bold text-lg">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link
              href="/recherche"
              className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
            >
              Trouver un artisan
            </Link>
          </div>
        </div>

        {/* Artisans */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🔧</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pour les artisans</h2>
              <p className="text-gray-500">Développez votre activité</p>
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Les artisans bénéficient d&apos;un accès à notre plateforme avec des offres adaptées à leur activité.
            Consultez notre page dédiée pour connaître nos formules.
          </p>
          <Link
            href="/pro/tarifs"
            className="inline-block border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-6 py-2.5 rounded-lg font-semibold transition"
          >
            Voir les offres artisans
          </Link>
        </div>

        {/* FAQ rapide */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Faut-il créer un compte pour chercher un artisan ?',
                r: 'La recherche est libre et gratuite. Un compte est nécessaire pour effectuer une réservation.',
              },
              {
                q: 'Comment sont fixés les tarifs des artisans ?',
                r: 'Chaque artisan fixe librement ses tarifs. VitFix ne prélève aucune commission sur les paiements.',
              },
              {
                q: 'Puis-je annuler une réservation ?',
                r: 'Oui, sous réserve des conditions d\'annulation propres à chaque artisan, précisées sur son profil.',
              },
            ].map(({ q, r }) => (
              <div key={q} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <h3 className="font-semibold text-gray-900 mb-1">{q}</h3>
                <p className="text-gray-600 text-sm">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
