import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Débarras Succession Marseille — Vide maison après décès, EHPAD | VITFIX',
  description: 'Débarras appartement succession à Marseille, La Ciotat, Aubagne et PACA. Vide maison après décès, départ en EHPAD, succession notariale. Service discret, éco-responsable, devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/debarras-succession/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Débarras Succession Marseille',
      description: 'Service de débarras et vide maison dans le cadre de succession, après décès ou départ en EHPAD. Marseille et PACA.',
      url: 'https://vitfix.io/fr/specialites/debarras-succession/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Débarras Succession', item: 'https://vitfix.io/fr/specialites/debarras-succession/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Comment se déroule un débarras dans le cadre d\'une succession ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Un débarras succession se déroule en 3 étapes : 1) Visite de l\'appartement pour estimer le volume et identifier les objets de valeur éventuels. 2) Tri des objets (reprise avec valeur marchande, don à associations, recyclage, mise en déchetterie). 3) Vidage complet et nettoyage. Pour une succession, il est recommandé d\'attendre l\'accord de tous les héritiers avant d\'autoriser le débarras.',
          },
        },
        {
          '@type': 'Question',
          name: 'Le débarras d\'appartement peut-il être gratuit à Marseille ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Le débarras peut être partiellement ou totalement gratuit si le mobilier ou les objets présents ont une valeur marchande suffisante pour compenser la main d\'œuvre. Après visite et inventaire, nous pouvons proposer un devis à 0 € ou même une reprise si le mobilier est de qualité. En revanche, un appartement totalement vide de valeur entraîne une facturation standard.',
          },
        },
      ],
    },
  ],
}

const ETAPES = [
  { num: '1', title: 'Visite gratuite', desc: 'Nous évaluons le volume, identifions les objets de valeur, établissons un devis.' },
  { num: '2', title: 'Accord héritiers', desc: 'Nous attendons votre accord (et celui des co-héritiers si nécessaire) avant toute intervention.' },
  { num: '3', title: 'Tri respectueux', desc: 'Objets de valeur listés, dons aux associations locales, recyclage, mise en déchetterie.' },
  { num: '4', title: 'Vidage complet', desc: 'Logement entièrement vidé et balayé, prêt pour la vente ou la location.' },
]

const FAQS = [
  {
    q: 'Comment se déroule un débarras dans le cadre d\'une succession ?',
    a: 'Un débarras succession se déroule en 4 étapes : 1) Visite gratuite pour évaluer le volume et identifier les objets de valeur éventuels. 2) Accord de tous les héritiers (obligatoire avant tout tri). 3) Tri : reprise des objets avec valeur marchande, dons associations, recyclage, déchetterie. 4) Vidage complet et nettoyage. Nous pouvons intervenir sur mandat du notaire.',
  },
  {
    q: 'Le débarras peut-il être gratuit ?',
    a: 'Oui, le débarras peut être partiellement ou totalement gratuit si les objets présents ont une valeur marchande suffisante. Après visite et inventaire, nous proposons parfois un devis à 0 € ou une reprise avec rachat si le mobilier est de qualité (meubles anciens, tableaux, argenterie, etc.). En revanche, un appartement vidé de tout objet de valeur est facturé selon le volume.',
  },
  {
    q: 'Peut-on déduire les frais de débarras lors d\'une succession ?',
    a: 'Oui, les frais de débarras peuvent être déduits de l\'actif successoral. Ils constituent des « frais funéraires » ou des frais de conservation du patrimoine successoral, déductibles de l\'actif brut de la succession sous présentation de justificatifs. Consultez votre notaire pour la démarche exacte selon votre situation.',
  },
  {
    q: 'En combien de temps peut-on vider un appartement à Marseille ?',
    a: 'Le délai dépend du volume : un studio ou appartement de 2 pièces peu encombré : 1 jour (1 équipe de 2). Un appartement de 3–4 pièces : 1 à 2 jours. Une maison complète avec cave et grenier : 2 à 4 jours. Nous intervenons en semaine et le samedi, avec possibilité d\'urgence si la succession est urgente (expiration d\'un bail, vente notariale imminente).',
  },
  {
    q: 'Intervenez-vous pour les débarras de personnes âgées partant en EHPAD ?',
    a: 'Oui, c\'est un service que nous réalisons fréquemment avec beaucoup de respect et de discrétion. Nous comprenons la dimension émotionnelle de ces situations. Nous aidons les familles à trier les effets personnels (ce que la personne gardera en EHPAD, ce qui revient à la famille, ce qui peut être donné ou recyclé). Nous travaillons avec des associations qui valorisent les dons en faveur de personnes dans le besoin.',
  },
  {
    q: 'Que faire si on trouve des objets de valeur lors d\'un débarras ?',
    a: 'Tous les objets potentiellement de valeur (bijoux, tableaux, monnaies, meubles de style, argenterie, livres anciens) sont mis de côté et listés avant tout tri. Une expertise d\'un commissaire-priseur peut être organisée sur demande. Dans le cadre d\'une succession, ces objets appartiennent à l\'actif successoral et ne peuvent être cédés ou déplacés sans accord des héritiers.',
  },
]

export default function DebarrasSuccessionPage() {
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
              <span className="text-white">Débarras Succession</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">📦</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Débarras Succession Marseille
                </h1>
                <p className="text-zinc-300 text-lg max-w-2xl leading-relaxed">
                  Vide maison après décès, débarras appartement succession, départ en EHPAD.
                  Service discret, respectueux et éco-responsable à Marseille et PACA.
                  Devis gratuit, intervention sous 48h.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {['🤝 Discret & respectueux', '♻️ Éco-responsable', '📋 Mandat notaire accepté', '💬 Devis gratuit 24h'].map((s) => (
                <span key={s} className="bg-zinc-800 px-4 py-2 rounded-full text-sm text-zinc-200">{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Contenu */}
        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Intro */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">
                Un service humain pour des moments difficiles
              </h2>
              <p className="text-zinc-700 leading-relaxed mb-4">
                Le débarras dans le cadre d&apos;une succession ou après un départ en EHPAD est
                souvent une étape douloureuse. Nos équipes y apportent respect, discrétion et
                efficacité. Nous travaillons à votre rythme, selon vos disponibilités, et
                coordonnons si nécessaire avec votre notaire.
              </p>
              <p className="text-zinc-700 leading-relaxed">
                Nous intervenons à Marseille et dans tous les Bouches-du-Rhône : Aubagne,
                La Ciotat, Cassis, Martigues, Salon-de-Provence, Aix-en-Provence, Allauch,
                Gémenos, ainsi que dans le Var (Bandol, Sanary, Six-Fours, La Seyne, Hyères).
              </p>
            </div>

            {/* Étapes */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-6">Comment ça se passe ?</h2>
              <div className="space-y-4">
                {ETAPES.map((e) => (
                  <div key={e.num} className="flex gap-4">
                    <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-zinc-900 shrink-0">
                      {e.num}
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900">{e.title}</div>
                      <p className="text-zinc-600 text-sm mt-1">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cas d'usage */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">Nos interventions</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '⚰️', label: 'Vide maison après décès', desc: 'Intervention rapide, coordination avec notaire' },
                  { icon: '🏥', label: 'Départ en EHPAD', desc: 'Tri des effets personnels, discrétion absolue' },
                  { icon: '⚖️', label: 'Succession notariale', desc: 'Mandat notaire, liste des objets de valeur' },
                  { icon: '🤝', label: 'Syndrome de Diogène', desc: 'Équipe formée, intervention sans jugement' },
                  { icon: '🏢', label: 'Cave ou box', desc: 'Débarras cave, garde-meuble, box de stockage' },
                  { icon: '🏠', label: 'Grenier / combles', desc: 'Débarras complet, tri et évacuation' },
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="font-semibold text-sm text-zinc-900">{item.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{item.desc}</div>
                  </div>
                ))}
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
            <div className="bg-yellow-400 rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">Devis débarras gratuit</h3>
              <p className="text-zinc-800 text-sm mb-4">
                Réponse sous 24h. Débarras possible à 0 € selon les objets présents.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20j%27ai%20besoin%20d%27un%20devis%20pour%20un%20d%C3%A9barras%20succession%20%C3%A0%20Marseille`}
                className="block bg-green-500 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp
              </a>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/services/vide-maison-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  📦 Vide maison Marseille
                </Link>
                <Link href="/fr/services/nettoyage-encombrants-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🗑️ Nettoyage encombrants
                </Link>
                <Link href="/fr/copropriete/nettoyage-encombrants/" className="block text-sm text-yellow-600 hover:underline">
                  🏢 Débarras copropriété
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
