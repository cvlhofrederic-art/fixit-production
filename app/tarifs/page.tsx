import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs - Vitfix',
  description: 'Vitfix est gratuit pour les particuliers. Découvrez comment fonctionne notre service.',
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
            Utiliser Vitfix est <strong>100% gratuit</strong> pour les particuliers.
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
              className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-xl font-semibold transition"
            >
              Trouver un artisan
            </Link>
          </div>
        </div>

        {/* Artisans */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-3xl">🔧</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Pour les artisans</h2>
              <p className="text-gray-500">Deux formules pour développer votre activité</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="border-2 border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Freemium</h3>
                <span className="font-bold text-gray-900">0€</span>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Profil vérifié</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Devis & factures PDF</li>
                <li className="flex items-center gap-2"><span className="text-red-400 font-bold">✗</span> <span className="text-gray-500">Agenda, messagerie, réservations</span></li>
                <li className="flex items-center gap-2"><span className="text-red-400 font-bold">✗</span> <span className="text-gray-500">Compta IA, Proof of Work, app mobile</span></li>
              </ul>
            </div>
            <div className="border-2 border-[#FFC107] rounded-xl p-4 bg-amber-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">Pro</h3>
                  <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-bold">RECOMMANDÉ</span>
                </div>
                <div><span className="font-bold text-[#FFC107]">49€</span><span className="text-xs text-gray-500"> / mois</span></div>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Tous les modules débloqués</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Réservations illimitées</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Comptabilité IA + Proof of Work</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> App mobile + Support prioritaire</li>
              </ul>
            </div>
          </div>

          <Link
            href="/pro/tarifs"
            className="inline-block border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-6 py-2.5 rounded-xl font-semibold transition"
          >
            Voir le détail des offres artisans →
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
                r: 'Chaque artisan fixe librement ses tarifs. Vitfix ne prélève aucune commission sur les paiements.',
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
