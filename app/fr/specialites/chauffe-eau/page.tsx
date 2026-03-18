import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Remplacement Chauffe-eau Marseille — Thermodynamique, urgence 24h | VITFIX',
  description: 'Remplacement chauffe-eau en panne à Marseille et PACA sous 24h : électrique, thermodynamique, gaz. Éligible MaPrimeRénov. Plombier certifié, devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/chauffe-eau/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Remplacement Chauffe-eau Marseille',
      description: 'Remplacement de chauffe-eau en urgence à Marseille et PACA. Tous types : électrique, thermodynamique, gaz, solaire.',
      url: 'https://vitfix.io/fr/specialites/chauffe-eau/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Chauffe-eau', item: 'https://vitfix.io/fr/specialites/chauffe-eau/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Quel chauffe-eau choisir à Marseille en 2026 ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'En PACA, le chauffe-eau thermodynamique (pompe à chaleur eau chaude) est le meilleur choix : il consomme 3 fois moins d\'électricité qu\'un chauffe-eau électrique classique, est éligible à MaPrimeRénov, et tire parti des températures clémentes du Sud. Le chauffe-eau solaire est idéal si vous avez un accès au toit (exposition sud). Le chauffe-eau électrique instantané convient pour les petits logements ou les dépannages urgents.',
          },
        },
        {
          '@type': 'Question',
          name: 'Combien coûte le remplacement d\'un chauffe-eau à Marseille ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Le remplacement d\'un chauffe-eau électrique standard (150–200 L) coûte 600 à 1 200 € TTC (matériel + pose). Un chauffe-eau thermodynamique : 1 800 à 3 500 € (éligible MaPrimeRénov jusqu\'à 1 000 €). Une installation urgente dans les 24h peut majorer le tarif de 100 à 200 €. Nous proposons un devis gratuit avec TVA 10 % pour tout remplacement dans un logement de plus de 2 ans.',
          },
        },
      ],
    },
  ],
}

const TYPES = [
  {
    icon: '⚡',
    name: 'Électrique (cumulus)',
    desc: 'Le plus courant. Simple à remplacer, pas besoin de gaz. Consommation standard. Durée de vie : 10–15 ans.',
    prix: '600 à 1 200 €',
    aide: 'Non éligible',
    urgence: '✅ Sous 24h',
  },
  {
    icon: '🌡️',
    name: 'Thermodynamique',
    desc: 'Pompe à chaleur eau chaude. 3× moins énergivore, idéal PACA. Durée de vie : 15–20 ans.',
    prix: '1 800 à 3 500 €',
    aide: 'MaPrimeRénov jusqu\'à 1 000 €',
    urgence: '⏱️ 2 à 5 jours',
  },
  {
    icon: '🔥',
    name: 'Gaz (chaudière)',
    desc: 'Chauffe-eau à gaz instantané ou à accumulation. Requiert raccordement gaz. Installation par plombier certifié.',
    prix: '1 000 à 2 500 €',
    aide: 'CEE possible',
    urgence: '⏱️ 1 à 3 jours',
  },
  {
    icon: '☀️',
    name: 'Solaire thermique',
    desc: 'Capteurs solaires sur le toit + ballon de stockage. Idéal PACA (300+ jours de soleil). Rentable en 7–10 ans.',
    prix: '3 000 à 6 000 €',
    aide: 'MaPrimeRénov + CEE',
    urgence: '📅 Sur RDV',
  },
]

const FAQS = [
  {
    q: 'Quel chauffe-eau choisir à Marseille en 2026 ?',
    a: 'En PACA, le chauffe-eau thermodynamique (pompe à chaleur eau chaude) est le meilleur rapport qualité/coût : il consomme 3× moins qu\'un électrique classique, est éligible à MaPrimeRénov (jusqu\'à 1 000 €), et profite des températures clémentes du Sud. Le chauffe-eau solaire est idéal si vous avez un accès au toit orienté sud. Pour un remplacement urgence en moins de 24h, le chauffe-eau électrique reste la solution la plus rapide à installer.',
  },
  {
    q: 'Combien coûte le remplacement d\'un chauffe-eau à Marseille ?',
    a: 'Chauffe-eau électrique (150–200 L) : 600 à 1 200 € TTC (matériel + pose). Thermodynamique : 1 800 à 3 500 € (éligible MaPrimeRénov). Une intervention urgence sous 24h peut majorer le tarif de 100 à 200 €. TVA à 10 % pour tout remplacement dans un logement de plus de 2 ans. Devis gratuit.',
  },
  {
    q: 'Mon chauffe-eau peut-il être réparé plutôt que remplacé ?',
    a: 'Cela dépend de la panne et de l\'âge du chauffe-eau : si le cumulus a moins de 7 ans et que la panne est un thermostat ou une résistance (pièces à 30–80 €, main d\'œuvre 80–120 €), la réparation est rentable. Si le chauffe-eau a plus de 10 ans, que la cuve est calcifiée ou qu\'il y a une fuite de cuve (irréparable), le remplacement est préférable. En PACA, l\'eau calcaire (eau dure) accélère l\'usure des cumulus — un entretien annuel (détartrage) prolonge leur durée de vie.',
  },
  {
    q: 'Le chauffe-eau thermodynamique est-il éligible à MaPrimeRénov ?',
    a: 'Oui, le chauffe-eau thermodynamique (ballon thermodynamique ou PAC eau chaude) est éligible à MaPrimeRénov : jusqu\'à 1 000 € de subvention selon vos revenus (barème 2026). L\'intervention doit être réalisée par un artisan RGE. En ajoutant les CEE (Certificats d\'Économies d\'Énergie), le reste à charge peut être inférieur à 500 €.',
  },
  {
    q: 'Peut-on remplacer un chauffe-eau un dimanche à Marseille ?',
    a: 'Oui, pour les urgences (fuite active, plus d\'eau chaude du tout dans le logement), nos plombiers interviennent le dimanche et les jours fériés. Un supplément d\'urgence de 80 à 150 € s\'applique pour les interventions de week-end. Nous remplaçons généralement le chauffe-eau par un modèle de dépannage le jour même, puis planifions l\'installation d\'un modèle thermodynamique (si souhaité) dans la semaine.',
  },
]

export default function ChauffeEauPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        <section className="bg-zinc-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-sm text-zinc-400 mb-6 flex flex-wrap gap-1">
              <Link href="/fr/" className="hover:text-white">VITFIX</Link>
              <span className="mx-1">/</span>
              <Link href="/fr/specialites/" className="hover:text-white">Spécialités</Link>
              <span className="mx-1">/</span>
              <span className="text-white">Chauffe-eau</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">🚿</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Remplacement Chauffe-eau Marseille
                </h1>
                <p className="text-zinc-300 text-lg max-w-2xl leading-relaxed">
                  Chauffe-eau en panne à Marseille ? Nos plombiers remplacent votre cumulus
                  sous 24h. Électrique, thermodynamique, gaz, solaire. MaPrimeRénov disponible.
                  Devis gratuit.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              {['⚡ Remplacement sous 24h', '💰 MaPrimeRénov dispo', '🔧 RGE certifié', '📋 TVA 10%'].map((s) => (
                <span key={s} className="bg-zinc-800 px-4 py-2 rounded-full text-sm text-zinc-200">{s}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Types */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-6">Quel type de chauffe-eau ?</h2>
              <div className="space-y-4">
                {TYPES.map((t) => (
                  <div key={t.name} className="border border-zinc-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{t.icon}</span>
                      <h3 className="font-bold text-zinc-900">{t.name}</h3>
                    </div>
                    <p className="text-zinc-600 text-sm mb-3">{t.desc}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-zinc-500">Prix posé</div>
                        <div className="font-semibold text-zinc-900">{t.prix}</div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-zinc-500">Aide état</div>
                        <div className="font-semibold text-green-700">{t.aide}</div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2">
                        <div className="text-zinc-500">Urgence</div>
                        <div className="font-semibold text-zinc-900">{t.urgence}</div>
                      </div>
                    </div>
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

          <div className="space-y-4">
            <div className="bg-yellow-400 rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">Urgence chauffe-eau</h3>
              <p className="text-zinc-800 text-sm mb-4">
                Plus d&apos;eau chaude ? Intervention sous 24h à Marseille et PACA.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20mon%20chauffe-eau%20est%20en%20panne%20%C3%A0%20Marseille`}
                className="block bg-green-500 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp
              </a>
              <Link
                href="/fr/urgence/plombier-urgence-marseille/"
                className="block bg-zinc-900 text-white text-center px-4 py-3 rounded-full font-semibold hover:bg-zinc-800 transition-colors text-sm"
              >
                🚨 Plombier urgence
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/specialites/fuite-eau-urgence/" className="block text-sm text-yellow-600 hover:underline">
                  💧 Fuite eau urgence
                </Link>
                <Link href="/fr/services/plombier-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🔧 Plombier Marseille
                </Link>
                <Link href="/fr/services/debouchage-canalisation-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🚿 Débouchage canalisation
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
