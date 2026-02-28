import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Offres artisans - Vitfix',
  description: 'Rejoignez Vitfix et développez votre activité. Découvrez nos offres pour les artisans.',
}

const features = [
  { label: 'Profil artisan vérifié', freemium: true, pro: true },
  { label: 'Devis & factures PDF', freemium: true, pro: true },
  { label: 'Agenda en ligne', freemium: false, pro: true },
  { label: 'Réservations clients', freemium: false, pro: true },
  { label: 'Messagerie client', freemium: false, pro: true },
  { label: 'Mise en avant dans les résultats', freemium: false, pro: true },
  { label: 'Comptabilité IA (Agent Léa)', freemium: false, pro: true },
  { label: 'Proof of Work (photos + GPS)', freemium: false, pro: true },
  { label: 'Notifications push', freemium: false, pro: true },
  { label: 'Application mobile complète', freemium: false, pro: true },
  { label: 'Support prioritaire par chat', freemium: false, pro: true },
  { label: 'Statistiques avancées', freemium: false, pro: true },
]

function Check() {
  return <span className="text-green-500 font-bold text-lg">✓</span>
}
function Cross() {
  return <span className="text-red-400 font-bold text-lg">✗</span>
}

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

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          {/* Freemium */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Freemium</h2>
            <p className="text-gray-500 text-sm text-center mb-4">Pour démarrer sans risque</p>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-gray-900">0€</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-6">Accès au module Devis & Factures uniquement</p>
            <Link
              href="/pro/register"
              className="block text-center py-3 rounded-lg font-semibold transition border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6]"
            >
              Commencer gratuitement
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#FFC107] p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFC107] text-gray-900 text-xs font-bold px-4 py-1 rounded-full">
              RECOMMANDÉ
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Pro</h2>
            <p className="text-gray-500 text-sm text-center mb-4">Tous les modules débloqués</p>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-[#FFC107]">49€</span>
              <span className="text-sm text-gray-500 ml-1">/ mois HT</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-6">Sans engagement · Annulez à tout moment</p>
            <Link
              href="/pro/register"
              className="block text-center py-3 rounded-lg font-semibold transition bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900"
            >
              Choisir l&apos;offre Pro
            </Link>
          </div>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Comparatif détaillé des fonctionnalités</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-500">Fonctionnalité</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-900 w-28">Freemium</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-[#FFC107] w-28">Pro</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.label} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="px-6 py-3.5 text-sm text-gray-700">{f.label}</td>
                    <td className="text-center px-4 py-3.5">
                      {f.freemium ? <Check /> : <Cross />}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      {f.pro ? <Check /> : <Cross />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Entreprise */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Offre Entreprise</h2>
              <p className="text-gray-500 text-sm">Pour les équipes et flottes d&apos;artisans — tarif sur mesure</p>
              <ul className="mt-3 space-y-1.5">
                {[
                  'Tout le Pro inclus',
                  'Gestion multi-artisans et équipes',
                  'Espace syndics & conciergeries',
                  'Ordres de mission automatisés',
                  'API & intégrations sur mesure',
                  'Account manager dédié',
                ].map(a => (
                  <li key={a} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-[#FFC107] font-bold">✓</span> {a}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/contact"
              className="shrink-0 inline-block text-center border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-6 py-3 rounded-lg font-semibold transition"
            >
              Demander un devis
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Des questions sur nos offres ?</h2>
          <p className="text-gray-600 mb-4">Notre équipe est disponible pour vous accompagner dans votre choix.</p>
          <Link href="/contact" className="text-[#FFC107] font-semibold hover:underline">
            Contacter l&apos;équipe Vitfix →
          </Link>
        </div>
      </div>
    </div>
  )
}
