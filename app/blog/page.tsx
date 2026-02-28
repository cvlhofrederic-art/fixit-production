import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Blog - Vitfix',
  description: 'Conseils, guides et actualités sur les travaux et la rénovation par Vitfix.',
}

const articles = [
  {
    slug: 'choisir-artisan',
    titre: 'Comment bien choisir son artisan ?',
    extrait: 'SIRET, assurance RC Pro, avis clients... Voici les 5 critères indispensables pour ne pas se tromper.',
    categorie: 'Conseils',
    date: '10 février 2026',
    emoji: '🔍',
  },
  {
    slug: 'urgence-plomberie',
    titre: 'Fuite d\'eau : que faire en urgence ?',
    extrait: 'Coupez l\'eau, identifiez la source, contactez un plombier. Notre guide pas-à-pas pour limiter les dégâts.',
    categorie: 'Urgence',
    date: '2 février 2026',
    emoji: '🔧',
  },
  {
    slug: 'renovation-appartement',
    titre: 'Rénover son appartement : par où commencer ?',
    extrait: 'Avant d\'appeler les artisans, établissez un plan de travaux cohérent. Nos experts vous guident étape par étape.',
    categorie: 'Rénovation',
    date: '25 janvier 2026',
    emoji: '🏠',
  },
  {
    slug: 'isolation-thermique',
    titre: 'Isolation thermique : les aides disponibles en 2026',
    extrait: 'MaPrimeRénov\', éco-PTZ, TVA à 5,5%... Tout ce qu\'il faut savoir sur les aides à l\'isolation.',
    categorie: 'Financement',
    date: '18 janvier 2026',
    emoji: '❄️',
  },
  {
    slug: 'electricite-normes',
    titre: 'Mise aux normes électriques : ce que dit la loi',
    extrait: 'Norme NF C 15-100, diagnostics obligatoires, travaux exigés lors de la vente... On fait le point.',
    categorie: 'Réglementation',
    date: '10 janvier 2026',
    emoji: '⚡',
  },
  {
    slug: 'devis-travaux',
    titre: 'Comment lire un devis de travaux ?',
    extrait: 'Prix HT/TTC, TVA applicable, délai d\'exécution, garanties... Ne signez plus sans comprendre chaque ligne.',
    categorie: 'Conseils',
    date: '3 janvier 2026',
    emoji: '📄',
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Le blog Vitfix
          </h1>
          <p className="text-lg text-gray-600">
            Conseils travaux, guides pratiques et actualités pour votre habitat
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <div key={article.slug} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition group">
              <div className="bg-gradient-to-br from-[#FFF9E6] to-white p-8 text-center">
                <span className="text-5xl">{article.emoji}</span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#FFF9E6] text-[#FFC107] text-xs font-semibold px-2 py-1 rounded-full">
                    {article.categorie}
                  </span>
                  <span className="text-gray-500 text-xs">{article.date}</span>
                </div>
                <h2 className="font-bold text-gray-900 mb-2 group-hover:text-[#FFC107] transition">
                  {article.titre}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{article.extrait}</p>
                <div className="mt-4">
                  <span className="text-[#FFC107] font-semibold text-sm">Lire la suite →</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-500 mb-4">Besoin d&apos;un artisan maintenant ?</p>
          <Link
            href="/recherche"
            className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
          >
            Trouver un artisan près de chez moi
          </Link>
        </div>
      </div>
    </div>
  )
}
