import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'À propos - VitFix',
  description: 'Découvrez VitFix, la plateforme qui connecte particuliers et artisans vérifiés en France.',
}

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl">⚡</span>
            <span className="text-4xl font-bold text-[#FFC107]">VitFix</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            La plateforme qui simplifie le quotidien
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            VitFix connecte les particuliers avec des artisans vérifiés et certifiés, partout en France.
            Notre mission : rendre l&apos;accès aux professionnels du bâtiment simple, rapide et fiable.
          </p>
        </div>

        {/* Notre histoire */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Notre histoire</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            VitFix est née d&apos;un constat simple : trouver un artisan de confiance est souvent un parcours du combattant.
            Délais interminables, manque de transparence sur les tarifs, difficulté à vérifier les qualifications —
            nous avons voulu changer tout cela.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Fondée en France, VitFix s&apos;appuie sur des technologies modernes pour mettre en relation
            des professionnels certifiés avec des clients qui ont besoin d&apos;une intervention rapide et de qualité.
            Chaque artisan référencé sur notre plateforme est vérifié : SIRET validé, assurance RC Pro obligatoire,
            avis clients contrôlés.
          </p>
        </div>

        {/* Nos valeurs */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Nos valeurs</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="font-bold text-gray-900 mb-2">Transparence</h3>
              <p className="text-gray-600 text-sm">
                Tarifs affichés clairement, profils vérifiés, avis authentiques. Pas de mauvaises surprises.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-bold text-gray-900 mb-2">Rapidité</h3>
              <p className="text-gray-600 text-sm">
                Trouvez et réservez un artisan disponible en quelques clics, 7j/7.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🛡️</div>
              <h3 className="font-bold text-gray-900 mb-2">Confiance</h3>
              <p className="text-gray-600 text-sm">
                Tous nos artisans sont assurés et leurs qualifications sont vérifiées avant référencement.
              </p>
            </div>
          </div>
        </div>

        {/* Chiffres */}
        <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">VitFix en chiffres</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900">500+</div>
              <div className="text-gray-800 text-sm mt-1">Artisans partenaires</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">10 000+</div>
              <div className="text-gray-800 text-sm mt-1">Interventions réalisées</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">16</div>
              <div className="text-gray-800 text-sm mt-1">Corps de métier</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">4,8/5</div>
              <div className="text-gray-800 text-sm mt-1">Note moyenne</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/recherche"
            className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-4 rounded-lg font-semibold transition text-lg mr-4"
          >
            Trouver un artisan
          </Link>
          <Link
            href="/contact"
            className="inline-block border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-8 py-4 rounded-lg font-semibold transition text-lg"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  )
}
