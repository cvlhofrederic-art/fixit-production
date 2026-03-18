import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Élagage Palmier PACA — Taille palmier Marseille, La Ciotat, Aubagne | VITFIX',
  description: 'Élagage et taille de palmiers à Marseille, La Ciotat, Cassis, Bandol et PACA. Taille ananas, marguerite, traitement charançon rouge. Élagueur certifié, devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/elagage-palmier/',
  },
  openGraph: {
    title: 'Élagage Palmier PACA — Taille palmier Marseille & littoral',
    description: 'Spécialistes taille et élagage de palmiers en PACA. Traitement charançon rouge, taille ananas/marguerite. Toute la côte de Marseille à Hyères.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      '@id': 'https://vitfix.io/fr/specialites/elagage-palmier/',
      name: 'VITFIX — Élagage Palmier PACA',
      description: 'Spécialiste élagage et taille de palmiers à Marseille et sur tout le littoral PACA (La Ciotat, Cassis, Bandol, Sanary, Hyères). Traitement charançon rouge agréé.',
      url: 'https://vitfix.io/fr/specialites/elagage-palmier/',
      telephone: PHONE_FR,
      areaServed: [
        { '@type': 'City', name: 'Marseille' },
        { '@type': 'City', name: 'La Ciotat' },
        { '@type': 'City', name: 'Cassis' },
        { '@type': 'City', name: 'Aubagne' },
        { '@type': 'City', name: 'Bandol' },
        { '@type': 'City', name: 'Sanary-sur-Mer' },
        { '@type': 'City', name: 'Hyères' },
      ],
      serviceType: ['Élagage palmier', 'Taille palmier', 'Traitement charançon rouge'],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Élagage Palmier', item: 'https://vitfix.io/fr/specialites/elagage-palmier/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Quand faut-il tailler un palmier en Provence ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'En PACA, la taille du palmier se fait idéalement entre mai et juillet, hors périodes de mistral violent. La taille en hiver (octobre–février) est déconseillée car elle affaiblit le palmier et l\'expose aux maladies. Pour les zones à charançon rouge, la taille doit impérativement être suivie d\'un traitement préventif.',
          },
        },
        {
          '@type': 'Question',
          name: 'Quel est le prix d\'un élagage de palmier à Marseille ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Le tarif d\'une taille de palmier dépend principalement de sa hauteur : palmier jusqu\'à 3 m : 80–150 €, palmier de 3 à 8 m : 150–350 €, palmier de 8 à 15 m : 350–600 €. Ces prix comprennent la taille, l\'évacuation des palmes et un traitement préventif anti-charançon. Devis gratuit sur place.',
          },
        },
        {
          '@type': 'Question',
          name: 'Le traitement contre le charançon rouge est-il encore obligatoire en PACA ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui, le charançon rouge du palmier (Rhynchophorus ferrugineus) est classé organisme nuisible réglementé en France. L\'arrêté préfectoral de janvier 2026 maintient l\'obligation de déclaration et de traitement dans tout le Var et les Bouches-du-Rhône. Tout propriétaire de palmier infecté est tenu de faire appel à un organisme agréé.',
          },
        },
      ],
    },
  ],
}

const VILLES = [
  'Marseille', 'La Ciotat', 'Cassis', 'Aubagne', 'Bandol',
  'Saint-Cyr-sur-Mer', 'Sanary-sur-Mer', 'Six-Fours-les-Plages',
  'Hyères', 'La Seyne-sur-Mer', 'Gémenos', 'Ceyreste', 'Allauch',
]

const FAQS = [
  {
    q: 'Quand faut-il tailler un palmier en Provence ?',
    a: 'En PACA, la taille du palmier se fait idéalement entre mai et juillet, hors périodes de mistral violent. La taille en hiver (octobre–février) est déconseillée car elle affaiblit le palmier et l\'expose aux maladies fongiques. Pour les zones à charançon rouge (tout le littoral PACA), la taille doit impérativement être suivie d\'un traitement préventif à base d\'insecticide systémique.',
  },
  {
    q: 'Quelle est la différence entre taille ananas et taille marguerite ?',
    a: 'La taille en ananas consiste à couper les palmes mortes ET une partie des palmes vertes pour donner une forme ronde au palmier (aspect ananas). La taille en marguerite ne coupe que les palmes mortes ou pendantes, en conservant toutes les palmes vertes — c\'est la taille la plus respectueuse du palmier. La taille ananas est déconseillée par les professionnels car elle affaiblit le palmier et crée des blessures supplémentaires, portes d\'entrée pour le charançon rouge.',
  },
  {
    q: 'Le traitement contre le charançon rouge est-il encore obligatoire en PACA ?',
    a: 'Oui, le charançon rouge du palmier est classé organisme nuisible réglementé. L\'arrêté préfectoral de janvier 2026 maintient l\'obligation de déclaration et de traitement dans tout le Var et les Bouches-du-Rhône. Tout propriétaire de palmier infecté est tenu de faire appel à un organisme agréé. Un palmier non traité peut être arraché d\'office par la mairie. Nous sommes agréés pour l\'application des traitements insecticides systémiques autorisés.',
  },
  {
    q: 'Peut-on bénéficier d\'un crédit d\'impôt pour l\'élagage d\'un palmier ?',
    a: 'Oui, sous conditions. Le crédit d\'impôt pour l\'emploi d\'un salarié à domicile (article 199 sexdecies du CGI) peut s\'appliquer à l\'entretien du jardin, dont l\'élagage de palmiers, si vous employez un professionnel déclaré. Vous bénéficiez d\'un crédit ou réduction d\'impôt de 50 % des sommes versées, plafonné à 12 000 € (plus 1 500 € par enfant à charge). Demandez une facture avec numéro de SIRET pour votre déclaration de revenus.',
  },
  {
    q: 'Quel est le prix d\'un élagage de palmier à Marseille et sur le littoral ?',
    a: 'Le tarif dépend principalement de la hauteur et de l\'accessibilité : palmier jusqu\'à 3 m : 80–150 €, palmier de 3 à 8 m : 150–350 €, palmier de 8 à 15 m : 350–600 €, palmier au-delà de 15 m : sur devis (nacelle ou grimpeur). Ces prix comprennent la taille, l\'évacuation des palmes sèches et un traitement préventif anti-charançon. Les coûts d\'accès difficile (en bord de mer, terrain escarpé) peuvent entraîner un supplément. Devis gratuit sur place à Marseille, La Ciotat, Cassis, Bandol, Sanary et Hyères.',
  },
  {
    q: 'Quelle sanction pour un palmier non débroussaillé ou non entretenu ?',
    a: 'En cas de non-respect des obligations d\'entretien et de traitement des palmiers contaminés, le propriétaire risque une mise en demeure de la DRAAF (Direction Régionale de l\'Alimentation) suivie d\'une action en justice. L\'arrêté préfectoral peut imposer l\'abattage du palmier aux frais du propriétaire. En cas de propagation de charançon aux palmiers voisins, la responsabilité civile du propriétaire peut être engagée.',
  },
]

export default function ElagagePalmierPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        {/* Hero */}
        <section className="bg-zinc-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-sm text-zinc-400 mb-6 flex flex-wrap gap-1">
              <Link href="/fr/" className="hover:text-white">VITFIX</Link>
              <span className="mx-1">/</span>
              <Link href="/fr/specialites/" className="hover:text-white">Spécialités</Link>
              <span className="mx-1">/</span>
              <span className="text-white">Élagage Palmier</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">🌴</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Élagage Palmier PACA
                </h1>
                <p className="text-zinc-300 text-lg max-w-2xl leading-relaxed">
                  Taille professionnelle de palmiers à Marseille, La Ciotat, Cassis, Bandol
                  et sur tout le littoral PACA. Élagueurs certifiés, traitement charançon rouge
                  agréé DRAAF. Devis gratuit.
                </p>
              </div>
            </div>
            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap gap-4">
              {['✅ Certifié charançon rouge DRAAF', '🌴 Taille ananas & marguerite', '📍 Tout le littoral PACA', '💬 Devis gratuit sous 24h'].map((s) => (
                <span key={s} className="bg-zinc-800 px-4 py-2 rounded-full text-sm text-zinc-200">{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Contenu principal */}
        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Intro */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">
                Spécialiste taille de palmiers en Provence
              </h2>
              <p className="text-zinc-700 leading-relaxed mb-4">
                Les palmiers (Phoenix canariensis, Washingtonia, Chamaerops humilis) sont emblématiques
                du paysage méditerranéen. Leur entretien requiert un savoir-faire spécifique : taille
                adaptée au climat PACA, traitement contre le charançon rouge (Rhynchophorus ferrugineus),
                et connaissance des obligations légales en vigueur dans les Bouches-du-Rhône et le Var.
              </p>
              <p className="text-zinc-700 leading-relaxed">
                Nos élagueurs interviennent sur tout le littoral : de Marseille à Hyères, en passant
                par La Ciotat, Cassis, Bandol, Sanary-sur-Mer et Six-Fours. Nous maîtrisons aussi
                bien la taille en nacelle que la technique de grimpe sur palmier.
              </p>
            </div>

            {/* Types de taille */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">
                🌴 Types de taille de palmier
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-yellow-400 pl-4">
                  <h3 className="font-bold text-zinc-900">Taille en marguerite (recommandée)</h3>
                  <p className="text-zinc-600 text-sm mt-1">Coupe uniquement les palmes mortes ou pendantes à plus de 45°. Respecte la vitalité du palmier, réduit le risque charançon. À privilégier systématiquement.</p>
                </div>
                <div className="border-l-4 border-zinc-300 pl-4">
                  <h3 className="font-bold text-zinc-900">Taille en ananas (déconseillée)</h3>
                  <p className="text-zinc-600 text-sm mt-1">Coupe les palmes vertes pour donner une forme ronde. Affaiblit le palmier, crée des blessures ouvertes propices au charançon. À éviter sauf demande esthétique spécifique.</p>
                </div>
                <div className="border-l-4 border-red-400 pl-4">
                  <h3 className="font-bold text-zinc-900">Abattage palmier</h3>
                  <p className="text-zinc-600 text-sm mt-1">Nécessaire pour les palmiers morts, dangereux ou fortement infestés par le charançon. Broyage sur place ou évacuation selon votre choix.</p>
                </div>
              </div>
            </div>

            {/* Charançon rouge */}
            <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
              <h2 className="font-display text-2xl font-bold text-red-900 mb-4">
                🚨 Charançon Rouge du Palmier en PACA
              </h2>
              <p className="text-zinc-700 leading-relaxed mb-4">
                Le charançon rouge est le principal ennemi des palmiers en PACA. Sa larve creuse
                des galeries dans le stipe et tue le palmier en 2 à 4 ans. Les premiers symptômes :
                palmes centrales qui s&apos;affaissent, présence de sciure brune à la base des palmes.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl p-3">
                  <div className="font-bold text-red-700 text-sm mb-1">Symptômes</div>
                  <ul className="text-xs text-zinc-600 space-y-1">
                    <li>• Palmes centrales affaissées</li>
                    <li>• Sciure brune à la base</li>
                    <li>• Odeur de fermentation</li>
                    <li>• Coléoptères adultes visibles</li>
                  </ul>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <div className="font-bold text-green-700 text-sm mb-1">Traitement</div>
                  <ul className="text-xs text-zinc-600 space-y-1">
                    <li>• Insecticide systémique injection</li>
                    <li>• Traitement préventif annuel</li>
                    <li>• Pièges à phéromones</li>
                    <li>• Déclaration DRAAF obligatoire</li>
                  </ul>
                </div>
              </div>
              <div className="bg-red-100 rounded-xl p-3">
                <p className="text-red-800 text-sm font-medium">
                  ⚖️ Obligation légale : l&apos;arrêté préfectoral du 15 janvier 2026 maintient l&apos;obligation
                  de traitement dans tout le Var (83) et les Bouches-du-Rhône (13). Tout palmier
                  contaminé non traité peut être arraché aux frais du propriétaire.
                </p>
              </div>
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

          {/* Sidebar */}
          <div className="space-y-4">
            {/* CTA */}
            <div className="bg-yellow-400 rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">Devis palmiers gratuit</h3>
              <p className="text-zinc-800 text-sm mb-4">
                Élagage, taille, traitement charançon ou abattage — réponse sous 24h.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20j%27ai%20besoin%20d%27un%20devis%20pour%20%C3%A9lagage%2Ftaille%20de%20palmier`}
                className="block bg-green-500 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp
              </a>
              <Link
                href="/fr/urgence/"
                className="block bg-zinc-900 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-zinc-800 transition-colors text-sm"
              >
                🚨 Urgence élagueur
              </Link>
            </div>

            {/* Villes */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Zones d&apos;intervention</h3>
              <div className="flex flex-wrap gap-2">
                {VILLES.map((v) => (
                  <span key={v} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded-full">{v}</span>
                ))}
              </div>
            </div>

            {/* Services liés */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/specialites/debroussaillage-paca/" className="block text-sm text-yellow-600 hover:underline">
                  🔥 Débroussaillage PACA (OLD)
                </Link>
                <Link href="/fr/services/elagueur-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🌲 Élagueur Marseille
                </Link>
                <Link href="/fr/services/jardinier-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🌱 Jardinier Marseille
                </Link>
                <Link href="/fr/services/paysagiste-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🌳 Paysagiste Marseille
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
