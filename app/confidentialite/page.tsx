import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialit\u00E9 - Fixit',
  description: 'Politique de confidentialit\u00E9 et protection des donn\u00E9es personnelles de Fixit',
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Politique de confidentialit&eacute;</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Collecte des donn&eacute;es</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit collecte les donn&eacute;es personnelles n&eacute;cessaires au fonctionnement du service :
              nom, pr&eacute;nom, adresse email, num&eacute;ro de t&eacute;l&eacute;phone et adresse d&apos;intervention.
              Ces donn&eacute;es sont collect&eacute;es lors de l&apos;inscription et de la r&eacute;servation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Utilisation des donn&eacute;es</h2>
            <p className="text-gray-600 leading-relaxed">
              Vos donn&eacute;es sont utilis&eacute;es pour :
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>G&eacute;rer votre compte et vos r&eacute;servations</li>
              <li>Mettre en relation les clients avec les artisans</li>
              <li>Envoyer des notifications li&eacute;es &agrave; vos rendez-vous</li>
              <li>Am&eacute;liorer nos services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Protection des donn&eacute;es</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit met en oeuvre des mesures techniques et organisationnelles pour prot&eacute;ger
              vos donn&eacute;es personnelles contre tout acc&egrave;s non autoris&eacute;, toute modification,
              divulgation ou destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Vos droits (RGPD)</h2>
            <p className="text-gray-600 leading-relaxed">
              Conform&eacute;ment au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li><strong>Droit d&apos;acc&egrave;s :</strong> obtenir une copie de vos donn&eacute;es</li>
              <li><strong>Droit de rectification :</strong> corriger vos donn&eacute;es inexactes</li>
              <li><strong>Droit &agrave; l&apos;effacement :</strong> demander la suppression de vos donn&eacute;es</li>
              <li><strong>Droit &agrave; la portabilit&eacute; :</strong> r&eacute;cup&eacute;rer vos donn&eacute;es dans un format lisible</li>
              <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos donn&eacute;es</li>
            </ul>
            <p className="text-gray-600 mt-3">
              Pour exercer ces droits, contactez-nous &agrave; : <strong>contact@fixit.fr</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit utilise des cookies strictement n&eacute;cessaires au fonctionnement du site.
              Aucun cookie publicitaire n&apos;est utilis&eacute; sans votre consentement explicite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Conservation des donn&eacute;es</h2>
            <p className="text-gray-600 leading-relaxed">
              Vos donn&eacute;es personnelles sont conserv&eacute;es pendant la dur&eacute;e de votre inscription
              sur la plateforme, puis supprim&eacute;es dans un d&eacute;lai de 3 ans apr&egrave;s la cl&ocirc;ture
              de votre compte, sauf obligation l&eacute;gale de conservation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              Pour toute question relative &agrave; la protection de vos donn&eacute;es personnelles,
              contactez notre D&eacute;l&eacute;gu&eacute; &agrave; la Protection des Donn&eacute;es (DPO) &agrave; l&apos;adresse :
              <strong> dpo@fixit.fr</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
