'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const services = [
  {
    icon: '🔧',
    title: 'Plomberie',
    slug: 'plomberie',
    description: 'Fuites, installations sanitaires, débouchage et réparations',
  },
  {
    icon: '⚡',
    title: 'Électricité',
    slug: 'electricite',
    description: 'Installations, dépannages, mises aux normes électriques',
  },
  {
    icon: '🔑',
    title: 'Serrurerie',
    slug: 'serrurerie',
    description: 'Ouverture de portes, changement de serrures, blindage',
  },
  {
    icon: '🔥',
    title: 'Chauffage',
    slug: 'chauffage',
    description: 'Installation, entretien et réparation de chauffages',
  },
  {
    icon: '🎨',
    title: 'Peinture',
    slug: 'peinture',
    description: 'Peinture intérieure et extérieure, ravalement de façade',
  },
  {
    icon: '🧱',
    title: 'Maçonnerie',
    slug: 'maconnerie',
    description: 'Construction, rénovation, enduits, dalles et fondations',
  },
  {
    icon: '🪚',
    title: 'Menuiserie',
    slug: 'menuiserie',
    description: 'Portes, fenêtres, parquet, dressing et aménagements bois',
  },
  {
    icon: '🏗️',
    title: 'Carrelage',
    slug: 'carrelage',
    description: 'Pose de carrelage, faïence, mosaïque et joints',
  },
  {
    icon: '🏠',
    title: 'Toiture',
    slug: 'toiture',
    description: 'Réparation de toits, zinguerie, couverture et étanchéité',
  },
  {
    icon: '❄️',
    title: 'Climatisation',
    slug: 'climatisation',
    description: 'Installation, entretien et réparation de climatiseurs',
  },
  {
    icon: '🚚',
    title: 'Déménagement',
    slug: 'demenagement',
    description: 'Déménagement particuliers et entreprises, emballage',
  },
  {
    icon: '🏡',
    title: 'Rénovation',
    slug: 'renovation',
    description: 'Rénovation complète, second œuvre, transformation de locaux',
  },
  {
    icon: '🪟',
    title: 'Vitrerie',
    slug: 'vitrerie',
    description: 'Remplacement de vitres, double vitrage, miroirs',
  },
  {
    icon: '🏠',
    title: 'Petits travaux',
    slug: 'petits-travaux',
    description: 'Montage de meubles, fixations, petites réparations',
  },
  {
    icon: '🌳',
    title: 'Espaces verts',
    slug: 'espaces-verts',
    description: 'Entretien de jardins, tonte, taille de haies, paysagisme',
  },
  {
    icon: '🧹',
    title: 'Nettoyage',
    slug: 'nettoyage',
    description: 'Nettoyage professionnel, fin de chantier, vitrerie',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [location, setLocation] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('name')

    if (error) console.error('Error fetching categories:', error)
    setCategories(data || [])
  }

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category', selectedCategory)
    if (location) params.set('loc', location)
    router.push(`/recherche?${params.toString()}`)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#FFF9E6] to-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left side - Text + CTA */}
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 leading-tight">
                Trouvez l&apos;artisan pr&egrave;s de chez vous, <span className="text-[#FFC107]">en 2 clics</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                R&eacute;servez en quelques clics un artisan v&eacute;rifi&eacute; pr&egrave;s de chez vous.
                Tous nos professionnels sont certifi&eacute;s et assur&eacute;s pour votre tranquillit&eacute;.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/recherche"
                  className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition text-center text-lg"
                >
                  Trouver un artisan
                </Link>
                <Link
                  href="/pro/register"
                  className="border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-8 py-3 rounded-lg font-semibold transition text-center text-lg"
                >
                  Vous &ecirc;tes artisan ?
                </Link>
              </div>
            </div>

            {/* Right side - Search Box */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Rechercher un artisan
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type d&apos;intervention
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none bg-white text-gray-900"
                  >
                    <option value="">Tous les m&eacute;tiers</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    O&ugrave; ?
                  </label>
                  <input
                    type="text"
                    placeholder="Paris, Lyon, Marseille..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none text-gray-900"
                  />
                </div>

                <button
                  onClick={handleSearch}
                  className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition text-lg"
                >
                  Rechercher
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Nos services
          </h2>
          <p className="text-gray-600 text-center mb-12 text-lg">
            D&eacute;couvrez tous les services propos&eacute;s par nos artisans
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <Link
                key={service.slug}
                href={`/recherche?category=${service.slug}`}
                className="group bg-white border-2 border-gray-100 rounded-xl p-6 text-center transition-all duration-300 hover:border-[#FFC107] hover:shadow-lg hover:-translate-y-1"
              >
                <div className="text-5xl mb-4">{service.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {service.title}
                </h3>
                <p className="text-gray-500 text-sm">{service.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ca marche */}
      <section id="comment" className="bg-[#FFF9E6] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Comment &ccedil;a marche ?
          </h2>
          <p className="text-gray-600 text-center mb-12 text-lg">
            R&eacute;servez votre artisan en 3 &eacute;tapes simples
          </p>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#FFC107] rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Cherchez</h3>
              <p className="text-gray-600 leading-relaxed">
                Indiquez le type d&apos;intervention souhait&eacute;e et votre localisation.
                Parcourez les profils d&apos;artisans v&eacute;rifi&eacute;s pr&egrave;s de chez vous.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#FFC107] rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">R&eacute;servez</h3>
              <p className="text-gray-600 leading-relaxed">
                Choisissez votre artisan, s&eacute;lectionnez un cr&eacute;neau disponible
                et confirmez votre r&eacute;servation en quelques clics.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#FFC107] rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">Recevez</h3>
              <p className="text-gray-600 leading-relaxed">
                Votre artisan intervient au cr&eacute;neau pr&eacute;vu. Vous recevez une
                confirmation et pouvez laisser un avis apr&egrave;s l&apos;intervention.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pr&ecirc;t &agrave; trouver votre artisan ?
          </h2>
          <p className="text-lg text-gray-800 mb-8">
            Rejoignez des milliers de clients satisfaits et trouvez le professionnel qu&apos;il vous faut.
          </p>
          <Link
            href="/recherche"
            className="inline-block bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg font-semibold transition text-lg"
          >
            Trouver un artisan maintenant
          </Link>
        </div>
      </section>
    </div>
  )
}
