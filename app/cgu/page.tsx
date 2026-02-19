import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions G\u00E9n\u00E9rales d\u2019Utilisation - Fixit',
  description: 'CGU de la plateforme Fixit',
}

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Conditions G&eacute;n&eacute;rales d&apos;Utilisation</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 1 - Objet</h2>
            <p className="text-gray-600 leading-relaxed">
              Les pr&eacute;sentes Conditions G&eacute;n&eacute;rales d&apos;Utilisation (CGU) r&eacute;gissent
              l&apos;utilisation de la plateforme Fixit, service de mise en relation entre particuliers
              et artisans du b&acirc;timent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 2 - Inscription</h2>
            <p className="text-gray-600 leading-relaxed">
              L&apos;inscription sur la plateforme est gratuite pour les clients.
              Les artisans doivent fournir un num&eacute;ro SIRET valide et une attestation
              d&apos;assurance Responsabilit&eacute; Civile Professionnelle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 3 - R&eacute;servation</h2>
            <p className="text-gray-600 leading-relaxed">
              La r&eacute;servation d&apos;un artisan via Fixit constitue un engagement.
              Toute annulation doit &ecirc;tre effectu&eacute;e au moins 24h avant le rendez-vous.
              En cas d&apos;annulation tardive, des frais peuvent &ecirc;tre appliqu&eacute;s.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 4 - Obligations des artisans</h2>
            <p className="text-gray-600 leading-relaxed">
              Les artisans s&apos;engagent &agrave; fournir des prestations de qualit&eacute;,
              &agrave; respecter les horaires convenus et &agrave; disposer de toutes les assurances
              n&eacute;cessaires &agrave; l&apos;exercice de leur activit&eacute;.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 5 - Responsabilit&eacute;</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit agit en qualit&eacute; d&apos;interm&eacute;diaire et ne saurait &ecirc;tre tenu responsable
              de la qualit&eacute; des prestations r&eacute;alis&eacute;es par les artisans. En cas de litige,
              les utilisateurs peuvent contacter notre service client.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 6 - Protection des donn&eacute;es</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit s&apos;engage &agrave; prot&eacute;ger les donn&eacute;es personnelles de ses utilisateurs
              conform&eacute;ment au RGPD. Pour plus d&apos;informations, consultez notre
              Politique de confidentialit&eacute;.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 7 - Droit applicable</h2>
            <p className="text-gray-600 leading-relaxed">
              Les pr&eacute;sentes CGU sont r&eacute;gies par le droit fran&ccedil;ais.
              En cas de litige, les tribunaux fran&ccedil;ais seront seuls comp&eacute;tents.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
