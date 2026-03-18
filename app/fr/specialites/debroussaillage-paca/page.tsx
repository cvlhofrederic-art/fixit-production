import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Débroussaillage Obligation Légale PACA 2026 — Marseille, Var, BdR | VITFIX',
  description: 'Obligation légale de débroussaillement (OLD) en PACA : avant le 15 juin, 50 m autour des habitations. Évitez l\'amende jusqu\'à 30 € par m². Entreprise agréée Marseille, Bouches-du-Rhône, Var.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/debroussaillage-paca/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Débroussaillage PACA',
      description: 'Entreprise spécialisée en débroussaillage légal PACA (OLD). Bouches-du-Rhône et Var.',
      url: 'https://vitfix.io/fr/specialites/debroussaillage-paca/',
      telephone: PHONE_FR,
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
        { '@type': 'AdministrativeArea', name: 'Var' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Débroussaillage PACA', item: 'https://vitfix.io/fr/specialites/debroussaillage-paca/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Avant quelle date doit-on débroussailler en PACA ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'En PACA, la date limite de débroussaillement est fixée au 15 juin de chaque année par l\'arrêté préfectoral. Des contrôles ont lieu dès le 1er juillet. Dans certaines communes comme Marseille, Aubagne, La Ciotat ou Cassis, des arrêtés municipaux peuvent fixer une date plus précoce (1er juin). Renseignez-vous auprès de votre mairie.',
          },
        },
        {
          '@type': 'Question',
          name: 'Quelle est l\'amende pour non-débroussaillement en PACA ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'L\'amende pour non-respect de l\'obligation de débroussaillement (OLD) est de 30 € par mètre carré non débroussaillé (article L135-2 du Code forestier). Pour un terrain de 1 000 m², cela représente jusqu\'à 30 000 €. En cas de sinistre, votre assurance peut refuser de vous indemniser si vous n\'avez pas respecté l\'OLD.',
          },
        },
        {
          '@type': 'Question',
          name: 'Qui est responsable du débroussaillement, le propriétaire ou le locataire ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'La responsabilité de l\'OLD incombe au propriétaire du terrain. Si le terrain est loué, le propriétaire peut contractuellement transférer cette obligation au locataire dans le bail, mais reste responsable vis-à-vis de l\'administration en cas de non-respect. En copropriété, le syndicat des copropriétaires est responsable pour les parties communes.',
          },
        },
      ],
    },
  ],
}

const FAQS = [
  {
    q: 'Avant quelle date doit-on débroussailler en PACA ?',
    a: 'En PACA, la date limite légale de débroussaillement est fixée au 15 juin de chaque année. Des contrôles ont lieu dès le 1er juillet. Certaines communes (Marseille, Aubagne, La Ciotat, Cassis) peuvent fixer une date plus précoce par arrêté municipal. La période idéale pour débroussailler est mars–mai, avant les chaleurs.',
  },
  {
    q: 'Quelle superficie dois-je débroussailler autour de ma maison ?',
    a: 'L\'article L134-6 du Code forestier impose un débroussaillement sur 50 mètres autour des constructions (maison, abri, piscine) dans les zones classées à risque incendie (la quasi-totalité de la PACA). Cette obligation s\'étend jusqu\'à la limite de la propriété, même si celle-ci est inférieure à 50 m. Vous pouvez aussi débroussailler au-delà de vos 50 m sur accord du propriétaire voisin.',
  },
  {
    q: 'Quelle est l\'amende pour non-débroussaillement en PACA ?',
    a: 'L\'amende est de 30 € par mètre carré non débroussaillé (article L135-2 du Code forestier), ce qui peut représenter plusieurs milliers ou dizaines de milliers d\'euros. En cas de sinistre, votre assureur peut refuser de vous indemniser si vous n\'avez pas respecté votre OLD. La mairie peut également faire réaliser les travaux d\'office et vous en facturer le coût.',
  },
  {
    q: 'En quoi consiste le débroussaillement légal (OLD) ?',
    a: 'L\'OLD ne signifie pas raser complètement la végétation. Il s\'agit de : couper les herbes sèches et arbustes à moins de 30 cm du sol, élaguer les branches basses des arbres (à 2 m du sol minimum), espacer les arbres (pas de contact entre couronnes), couper les végétaux dans un rayon de 3 m autour du bâtiment, éliminer les feuilles mortes et bois mort (combustible). Vous pouvez conserver les arbres isolés avec couronne relevée et les espèces méditerranéennes bien espacées.',
  },
  {
    q: 'Qui est responsable de l\'OLD : propriétaire ou locataire ?',
    a: 'La responsabilité légale de l\'OLD incombe au propriétaire du terrain (article L134-7 du Code forestier). Si le terrain est loué, le propriétaire peut transférer contractuellement cette obligation au locataire dans le bail, mais reste responsable vis-à-vis de l\'administration. En copropriété, le syndicat est responsable pour les parties communes.',
  },
  {
    q: 'Peut-on faire le débroussaillement soi-même ?',
    a: 'Oui, si vous avez le matériel adéquat (débroussailleuse, tronçonneuse, taille-haie) et les compétences. Cependant, pour des terrains en pente, avec des arbres, ou en zone DFCI (Défense des Forêts Contre les Incendies), il est recommandé de faire appel à un professionnel. Les blessures liées aux débroussailleuses sont fréquentes. Nous proposons un forfait débroussaillement avec attestation de réalisation pour votre assurance.',
  },
]

export default function DebroussaillagePacaPage() {
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
              <span className="text-white">Débroussaillage PACA</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">🔥</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Débroussaillage PACA — Obligation Légale 2026
                </h1>
                <p className="text-zinc-300 text-lg max-w-2xl leading-relaxed">
                  Respectez l&apos;obligation légale de débroussaillement (OLD) à Marseille,
                  dans les Bouches-du-Rhône et le Var. Avant le 15 juin, 50 m autour
                  de votre habitation. Entreprise agréée, attestation fournie.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {['⚖️ Obligation légale art. L134-6', '📅 Avant le 15 juin', '🗺️ BdR + Var', '📋 Attestation fournie'].map((s) => (
                <span key={s} className="bg-zinc-800 px-4 py-2 rounded-full text-sm text-zinc-200">{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Contenu */}
        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Alerte légale */}
            <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl p-6">
              <h2 className="font-display text-xl font-bold text-orange-900 mb-3 flex items-center gap-2">
                ⚠️ Obligation légale : amende jusqu&apos;à 30 €/m²
              </h2>
              <p className="text-orange-800 text-sm leading-relaxed">
                Le non-respect de l&apos;obligation de débroussaillement est passible d&apos;une amende
                de <strong>30 € par mètre carré non débroussaillé</strong> (article L135-2 du Code
                forestier). Pour 1 000 m², cela représente jusqu&apos;à <strong>30 000 €</strong>.
                En cas de sinistre, votre assurance peut refuser l&apos;indemnisation.
              </p>
            </div>

            {/* Règles */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">
                Règles OLD — Ce que dit la loi en PACA
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="text-left px-3 py-2 rounded-tl-lg">Zone</th>
                      <th className="text-left px-3 py-2">Distance minimale</th>
                      <th className="text-left px-3 py-2 rounded-tr-lg">Référence légale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-3 py-2">Habitations (maisons, villas)</td>
                      <td className="px-3 py-2 font-semibold text-orange-700">50 m</td>
                      <td className="px-3 py-2 text-zinc-500">Art. L134-6 CF</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Bâtiments annexes (piscine, abri)</td>
                      <td className="px-3 py-2 font-semibold text-orange-700">50 m</td>
                      <td className="px-3 py-2 text-zinc-500">Art. L134-6 CF</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Voies de chemin de fer (SNCF)</td>
                      <td className="px-3 py-2 font-semibold text-orange-700">10 m</td>
                      <td className="px-3 py-2 text-zinc-500">Art. L134-8 CF</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Campings / équipements collectifs</td>
                      <td className="px-3 py-2 font-semibold text-orange-700">50 m</td>
                      <td className="px-3 py-2 text-zinc-500">Art. L134-12 CF</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 rounded-bl-lg">Autour du bâtiment (coupe rase)</td>
                      <td className="px-3 py-2 font-semibold text-red-700">3 m</td>
                      <td className="px-3 py-2 rounded-br-lg text-zinc-500">Arrêté préf.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-6">Questions fréquentes — OLD PACA</h2>
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
            <div className="bg-yellow-400 rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">Devis débroussaillage</h3>
              <p className="text-zinc-800 text-sm mb-4">
                Attestation fournie pour votre assurance. Zones BdR & Var.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20j%27ai%20besoin%20d%27un%20devis%20pour%20le%20d%C3%A9broussaillage%20OLD%20PACA`}
                className="block bg-green-500 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp
              </a>
              <Link
                href="/fr/services/nettoyage-terrains-marseille/"
                className="block bg-zinc-900 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-zinc-800 transition-colors text-sm"
              >
                Voir le service
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/specialites/elagage-palmier/" className="block text-sm text-yellow-600 hover:underline">
                  🌴 Élagage palmier PACA
                </Link>
                <Link href="/fr/services/elagueur-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🌲 Élagueur Marseille
                </Link>
                <Link href="/fr/services/nettoyage-terrains-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🏕️ Nettoyage terrains
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
