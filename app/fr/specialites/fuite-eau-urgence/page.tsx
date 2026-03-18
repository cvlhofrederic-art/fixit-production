import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Fuite d\'Eau Urgence Marseille — Détection, dégât des eaux 24h/7j | VITFIX',
  description: 'Fuite d\'eau urgente à Marseille et PACA : plafond qui fuit, fuite cachée sous carrelage, dégât des eaux, canalisation percée. Plombier urgence 24h/24, 7j/7. Devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/fuite-eau-urgence/',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EmergencyService',
      name: 'VITFIX — Fuite Eau Urgence Marseille',
      description: 'Service d\'urgence pour fuites d\'eau à Marseille et PACA. Intervention 24h/24, 7j/7. Détection de fuite, réparation, dégâts des eaux.',
      url: 'https://vitfix.io/fr/specialites/fuite-eau-urgence/',
      telephone: PHONE_FR,
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceType: 'WhatsApp',
        contactOption: 'TollFree',
      },
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
        { '@type': 'ListItem', position: 3, name: 'Fuite Eau Urgence', item: 'https://vitfix.io/fr/specialites/fuite-eau-urgence/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Que faire en cas de fuite d\'eau avant l\'arrivée du plombier à Marseille ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '1) Coupez l\'eau au robinet de barrage principal (généralement sous l\'évier ou dans le tableau de comptage). 2) Coupez le chauffe-eau ou la chaudière. 3) Placez des seaux et serviettes pour limiter les dégâts. 4) Photographiez tout pour votre assurance. 5) Prévenez vos voisins si l\'eau risque de s\'infiltrer chez eux. 6) Appelez votre assurance dans les 5 jours ouvrés.',
          },
        },
        {
          '@type': 'Question',
          name: 'Comment détecter une fuite d\'eau cachée sous carrelage ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Les signes d\'une fuite cachée : sol chaud par zones (fuite sur plancher chauffant), carrelage qui se soulève ou se détache, traces d\'humidité sans explication, consommation d\'eau anormalement élevée sur votre facture, compteur d\'eau qui tourne quand tout est fermé. Nos techniciens utilisent des caméras thermiques et des détecteurs acoustiques pour localiser la fuite sans casser le carrelage.',
          },
        },
      ],
    },
  ],
}

const TYPES_FUITES = [
  { icon: '🚰', label: 'Fuite visible', desc: 'Robinet, joint, siphon, flexible — réparation rapide' },
  { icon: '🧱', label: 'Fuite cachée', desc: 'Sous carrelage, derrière mur — détection thermique' },
  { icon: '💧', label: 'Dégât des eaux', desc: 'Plafond qui fuit, voisin du dessus — urgence' },
  { icon: '🏗️', label: 'Fuite canalisation', desc: 'Tuyau percé, joint défaillant — colmatage urgence' },
  { icon: '♨️', label: 'Plancher chauffant', desc: 'Sol chaud, taches d\'humidité — diagnostic caméra' },
  { icon: '🏊', label: 'Fuite terrasse/balcon', desc: 'Infiltration par étanchéité défaillante' },
]

const FAQS = [
  {
    q: 'Que faire en cas de fuite d\'eau avant l\'arrivée du plombier ?',
    a: '1) Coupez l\'eau au robinet de barrage principal (généralement sous l\'évier, dans le tableau de comptage ou à l\'entrée de l\'appartement). 2) Coupez le chauffe-eau et la chaudière. 3) Placez seaux et serviettes. 4) Photographiez et filmez les dégâts pour votre assurance. 5) Prévenez vos voisins du dessous si l\'eau risque de s\'infiltrer. 6) Déclarez le sinistre à votre assurance dans les 5 jours ouvrés.',
  },
  {
    q: 'Comment détecter une fuite d\'eau cachée sous carrelage ?',
    a: 'Signes d\'une fuite cachée : sol chaud par zones (plancher chauffant), carrelage qui se soulève, traces d\'humidité inexpliquées, consommation d\'eau anormale sur facture, compteur qui tourne quand tout est fermé (vérifiez en fermant le robinet général et regardez si le compteur tourne). Nos techniciens utilisent des caméras thermiques infrarouges et des détecteurs acoustiques pour localiser la fuite sans destructions inutiles.',
  },
  {
    q: 'Mon assurance habitation couvre-t-elle les dégâts des eaux à Marseille ?',
    a: 'La garantie dégâts des eaux couvre les fuites accidentelles (tuyauterie, chauffe-eau, etc.), les infiltrations par la toiture ou les fenêtres, et les dommages causés à vos voisins. Elle ne couvre généralement pas : les infiltrations dues à un défaut d\'entretien, les dommages dus à l\'humidité chronique, ni les équipements électroménagers dans l\'eau. Déclaration obligatoire dans les 5 jours ouvrés. Nous fournissons un rapport d\'intervention pour faciliter votre dossier assurance.',
  },
  {
    q: 'Quel est le tarif d\'un plombier urgence fuite à Marseille ?',
    a: 'Une intervention urgence fuite d\'eau en journée coûte généralement 80 à 200 € (déplacement + diagnostic + réparation simple). Pour une fuite complexe (canalisation encastrée, détection nécessaire) : 200 à 600 €. La nuit et le week-end : supplément de 80 à 150 €. La détection de fuite par caméra thermique : 150 à 300 € (souvent récupérée via l\'assurance). Devis fourni avant tout démarrage.',
  },
  {
    q: 'Que faire si le plafond fuit suite à une fuite du voisin du dessus ?',
    a: 'C\'est un dégât des eaux inter-locataires : 1) Photographiez immédiatement les dégâts. 2) Contactez le voisin du dessus et son assurance. 3) Signalez au syndic (copropriété). 4) Déclarez à VOTRE assurance dans les 5 jours. Chaque partie déclare à sa propre assurance. La convention IRSI (anciennement CIDRE) simplifie les démarches pour les dégâts inférieurs à 5 000 €. Notre plombier peut établir un constat contradictoire.',
  },
]

export default function FuiteEauUrgencePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        {/* Hero urgence */}
        <section className="bg-red-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-sm text-red-300 mb-6 flex flex-wrap gap-1">
              <Link href="/fr/" className="hover:text-white">VITFIX</Link>
              <span className="mx-1">/</span>
              <Link href="/fr/specialites/" className="hover:text-white">Spécialités</Link>
              <span className="mx-1">/</span>
              <span className="text-white">Fuite eau urgence</span>
            </nav>
            <div className="flex items-start gap-4">
              <span className="text-5xl">💧</span>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Fuite d&apos;Eau Urgence Marseille
                </h1>
                <p className="text-red-200 text-lg max-w-2xl leading-relaxed">
                  Plafond qui fuit, dégât des eaux, canalisation percée — nos plombiers
                  interviennent en urgence à Marseille et PACA 24h/24, 7j/7.
                  Détection fuite cachée par caméra thermique.
                </p>
              </div>
            </div>
            {/* CTA urgence */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=URGENCE%20FUITE%20EAU%20%C3%A0%20Marseille%20-%20besoin%20d%27un%20plombier%20imm%C3%A9diatement`}
                className="bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-600 transition-colors flex items-center gap-2 justify-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp URGENCE
              </a>
              <div className="bg-red-800 px-8 py-4 rounded-full text-center">
                <div className="text-red-200 text-xs">Disponible</div>
                <div className="font-bold">24h/24 · 7j/7</div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions immédiates */}
        <section className="bg-orange-50 border-b border-orange-200 px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-bold text-orange-900 mb-3">⚡ En attendant le plombier — Faites ça maintenant :</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                '1. Coupez l\'eau au robinet de barrage',
                '2. Coupez le chauffe-eau',
                '3. Placez seaux et serviettes',
                '4. Photographiez les dégâts',
                '5. Prévenez votre voisin du dessous',
                '6. Contactez votre assurance (5 jours)',
              ].map((step) => (
                <div key={step} className="bg-white rounded-lg px-3 py-2 text-sm text-orange-900 font-medium border border-orange-200">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Types */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">Types de fuites que nous traitons</h2>
              <div className="grid grid-cols-2 gap-3">
                {TYPES_FUITES.map((t) => (
                  <div key={t.label} className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-2xl mb-1">{t.icon}</div>
                    <div className="font-semibold text-sm text-zinc-900">{t.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Détection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold mb-4">
                🔍 Détection fuite cachée — sans casser le carrelage
              </h2>
              <p className="text-zinc-700 leading-relaxed mb-4">
                Les fuites cachées sous carrelage ou dans les murs sont les plus destructrices.
                Sans détection précise, les plombiers doivent parfois casser de grandes surfaces.
                Nous utilisons des techniques non destructives :
              </p>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="text-xl">🌡️</span>
                  <div>
                    <div className="font-bold text-sm">Caméra thermique infrarouge</div>
                    <p className="text-zinc-600 text-xs mt-1">Détecte les variations de température causées par l&apos;eau fuyante sous le carrelage ou dans les murs. Précision au centimètre.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">🎧</span>
                  <div>
                    <div className="font-bold text-sm">Détecteur acoustique corrélateur</div>
                    <p className="text-zinc-600 text-xs mt-1">Écoute le bruit de la fuite et triangule sa position exacte dans la canalisation. Idéal pour les fuites sur canalisations encastrées.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">💨</span>
                  <div>
                    <div className="font-bold text-sm">Injection gaz traceur</div>
                    <p className="text-zinc-600 text-xs mt-1">Pour les fuites très petites ou sur des réseaux complexes. Le gaz non toxique suit le trajet de la fuite et remonte en surface.</p>
                  </div>
                </div>
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
            <div className="bg-red-500 text-white rounded-2xl p-5 sticky top-4">
              <h3 className="font-display font-bold text-xl mb-2">🚨 Urgence fuite</h3>
              <p className="text-red-100 text-sm mb-4">
                Chaque minute compte. Appelez maintenant.
              </p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=URGENCE%20FUITE%20EAU`}
                className="block bg-white text-red-600 text-center px-4 py-3 rounded-full font-bold hover:bg-red-50 transition-colors mb-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp 24h/24
              </a>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-3">Services liés</h3>
              <div className="space-y-2">
                <Link href="/fr/specialites/chauffe-eau/" className="block text-sm text-yellow-600 hover:underline">
                  🚿 Remplacement chauffe-eau
                </Link>
                <Link href="/fr/specialites/renovation-salle-de-bain/" className="block text-sm text-yellow-600 hover:underline">
                  🛁 Rénovation salle de bain
                </Link>
                <Link href="/fr/services/debouchage-canalisation-marseille/" className="block text-sm text-yellow-600 hover:underline">
                  🔧 Débouchage canalisation
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
