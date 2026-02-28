import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestion des cookies - Vitfix',
  description: 'Politique de gestion des cookies de Vitfix, conformément au RGPD et aux recommandations de la CNIL.',
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des cookies</h1>
        <p className="text-gray-500 text-sm mb-8">Dernière mise à jour : février 2026</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p className="text-gray-600 leading-relaxed">
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette, smartphone)
              lors de votre visite sur un site internet. Il permet au site de mémoriser des informations sur
              votre visite, comme votre langue préférée et d&apos;autres paramètres.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Les cookies utilisés par Vitfix</h2>

            <div className="space-y-4">
              <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">Cookies strictement nécessaires</h3>
                  <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Toujours actifs</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ces cookies sont indispensables au fonctionnement du site. Ils permettent la gestion de votre
                  session d&apos;authentification (connexion/déconnexion) et la sécurité de votre compte.
                  Ils ne peuvent pas être désactivés.
                </p>
                <table className="mt-3 text-xs text-gray-600 w-full">
                  <thead><tr className="font-semibold text-gray-700"><td className="py-1">Nom</td><td>Durée</td><td>Finalité</td></tr></thead>
                  <tbody>
                    <tr><td className="py-0.5 font-mono">sb-access-token</td><td>Session</td><td>Authentification Supabase</td></tr>
                    <tr><td className="py-0.5 font-mono">sb-refresh-token</td><td>7 jours</td><td>Maintien de connexion</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">Cookies de performance</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Optionnels</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ces cookies nous permettent de mesurer l&apos;audience du site et d&apos;améliorer ses performances.
                  Toutes les données sont anonymisées. Vitfix n&apos;utilise pas de solution de tracking tiers à ce jour.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">Cookies de personnalisation</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Optionnels</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ces cookies permettent de mémoriser vos préférences (localisation, type de service favori)
                  pour personnaliser votre expérience lors de vos prochaines visites.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">Cookies publicitaires</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Non utilisés</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Vitfix n&apos;utilise aucun cookie publicitaire ou de tracking à des fins marketing tiers.
                  Aucune donnée vous concernant n&apos;est transmise à des régies publicitaires.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Vos droits et comment gérer les cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Conformément au RGPD et aux recommandations de la CNIL, vous pouvez à tout moment
              exercer votre droit de retrait du consentement aux cookies non essentiels.
            </p>
            <p className="text-gray-600 leading-relaxed mb-3">
              Vous pouvez également configurer votre navigateur pour bloquer ou supprimer les cookies :
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
              <li>Chrome : Paramètres &gt; Confidentialité et sécurité &gt; Cookies</li>
              <li>Firefox : Options &gt; Vie privée et sécurité</li>
              <li>Safari : Préférences &gt; Confidentialité</li>
              <li>Edge : Paramètres &gt; Cookies et autorisations de site</li>
            </ul>
            <p className="text-gray-500 text-sm mt-3">
              Attention : la désactivation des cookies strictement nécessaires peut affecter le bon
              fonctionnement du site et vous empêcher d&apos;accéder à votre espace personnel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              Pour toute question relative à l&apos;utilisation des cookies, vous pouvez nous contacter à :{' '}
              <a href="mailto:contact@vitfix.fr" className="text-[#FFC107] hover:underline">
                contact@vitfix.fr
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
