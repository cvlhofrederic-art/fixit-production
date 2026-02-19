import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions l\u00E9gales - Fixit',
  description: 'Mentions l\u00E9gales de la plateforme Fixit',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Mentions l&eacute;gales</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">&Eacute;diteur du site</h2>
            <p className="text-gray-600 leading-relaxed">
              Le site Fixit est &eacute;dit&eacute; par Fixit SAS, soci&eacute;t&eacute; par actions simplifi&eacute;e
              au capital de 10 000&euro;.
            </p>
            <ul className="text-gray-600 mt-2 space-y-1">
              <li><strong>Si&egrave;ge social :</strong> France</li>
              <li><strong>Email :</strong> contact@fixit.fr</li>
              <li><strong>Directeur de publication :</strong> Le Pr&eacute;sident de Fixit SAS</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">H&eacute;bergeur</h2>
            <p className="text-gray-600 leading-relaxed">
              Le site est h&eacute;berg&eacute; par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Propri&eacute;t&eacute; intellectuelle</h2>
            <p className="text-gray-600 leading-relaxed">
              L&apos;ensemble des contenus pr&eacute;sents sur le site Fixit (textes, images, logos, graphismes)
              est prot&eacute;g&eacute; par le droit d&apos;auteur et le droit des marques. Toute reproduction,
              m&ecirc;me partielle, est interdite sans autorisation pr&eacute;alable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Responsabilit&eacute;</h2>
            <p className="text-gray-600 leading-relaxed">
              Fixit agit en tant qu&apos;interm&eacute;diaire entre les clients et les artisans.
              Fixit ne saurait &ecirc;tre tenu responsable des prestations r&eacute;alis&eacute;es par les artisans
              r&eacute;f&eacute;renc&eacute;s sur la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Donn&eacute;es personnelles</h2>
            <p className="text-gray-600 leading-relaxed">
              Conform&eacute;ment au R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD),
              vous disposez d&apos;un droit d&apos;acc&egrave;s, de rectification et de suppression de vos
              donn&eacute;es personnelles. Pour exercer ces droits, contactez-nous &agrave; contact@fixit.fr.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
