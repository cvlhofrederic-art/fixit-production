import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Avis clients - VitFix',
  description: 'Découvrez les avis de nos clients sur VitFix et leurs expériences avec nos artisans partenaires.',
}

const temoignages = [
  {
    nom: 'Sophie M.',
    ville: 'Paris 11e',
    metier: 'Plomberie',
    note: 5,
    texte: 'Artisan très professionnel, ponctuel et efficace. La fuite sous l\'évier a été réparée en moins d\'une heure. Je recommande vivement !',
    date: 'Janvier 2026',
  },
  {
    nom: 'Marc T.',
    ville: 'Lyon',
    metier: 'Électricité',
    note: 5,
    texte: 'Service impeccable. L\'électricien est arrivé à l\'heure, a bien expliqué les travaux nécessaires et a tout réparé proprement. Tarif conforme au devis.',
    date: 'Décembre 2025',
  },
  {
    nom: 'Isabelle R.',
    ville: 'Bordeaux',
    metier: 'Peinture',
    note: 4,
    texte: 'Très bon travail de peinture dans le salon et la chambre. Finitions soignées, nettoyage parfait après le chantier. Légèrement plus cher que prévu mais qualité au rendez-vous.',
    date: 'Novembre 2025',
  },
  {
    nom: 'Pierre-Antoine L.',
    ville: 'Marseille',
    metier: 'Serrurerie',
    note: 5,
    texte: 'Intervention rapide pour une ouverture de porte en urgence. En moins de 30 minutes après mon appel, le serrurier était là. Tarif honnête.',
    date: 'Février 2026',
  },
  {
    nom: 'Nathalie B.',
    ville: 'Toulouse',
    metier: 'Carrelage',
    note: 5,
    texte: 'Excellent carreleur ! La salle de bain est méconnaissable. Pose impeccable, joints parfaits. Je suis ravie du résultat.',
    date: 'Janvier 2026',
  },
  {
    nom: 'Thomas G.',
    ville: 'Nantes',
    metier: 'Menuiserie',
    note: 5,
    texte: 'Installation de parquet flottant dans tout l\'appartement. Travail soigné, délais respectés. Je referai appel à VitFix sans hésiter.',
    date: 'Décembre 2025',
  },
]

function Etoiles({ note }: { note: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= note ? 'text-[#FFC107]' : 'text-gray-300'}>★</span>
      ))}
    </div>
  )
}

export default function AvisPage() {
  const moyenne = (temoignages.reduce((a, t) => a + t.note, 0) / temoignages.length).toFixed(1)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Avis de nos clients
          </h1>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-5xl font-bold text-[#FFC107]">{moyenne}</span>
            <div>
              <Etoiles note={5} />
              <p className="text-gray-500 text-sm mt-1">sur {temoignages.length} avis vérifiés</p>
            </div>
          </div>
          <p className="text-gray-600 max-w-xl mx-auto">
            Tous les avis sont collectés après chaque intervention et vérifiés par notre équipe.
          </p>
        </div>

        {/* Grille d'avis */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {temoignages.map((t) => (
            <div key={t.nom} className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{t.nom}</p>
                  <p className="text-gray-500 text-sm">{t.ville}</p>
                </div>
                <span className="bg-[#FFF9E6] text-[#FFC107] text-xs font-semibold px-2 py-1 rounded-full">
                  {t.metier}
                </span>
              </div>
              <Etoiles note={t.note} />
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">&quot;{t.texte}&quot;</p>
              <p className="text-gray-400 text-xs mt-3">{t.date}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Rejoignez nos clients satisfaits
          </h2>
          <p className="text-gray-800 mb-6">
            Réservez votre artisan dès maintenant et laissez votre avis après l&apos;intervention.
          </p>
          <Link
            href="/recherche"
            className="inline-block bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Trouver un artisan
          </Link>
        </div>
      </div>
    </div>
  )
}
