import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales - VitFix',
  description: 'Mentions légales de la plateforme VitFix, conformes à la loi française.',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mentions l&eacute;gales</h1>
        <p className="text-gray-500 text-sm mb-8">
          Conform&eacute;ment &agrave; la loi n&deg;&nbsp;2004-575 du 21 juin 2004 pour la confiance dans
          l&apos;&eacute;conomie num&eacute;rique (LCEN), art.&nbsp;6-III et 19
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">&Eacute;diteur du site</h2>
            <ul className="space-y-2 text-sm">
              <li><strong>D&eacute;nomination sociale :</strong> VitFix SAS</li>
              <li><strong>Forme juridique :</strong> Soci&eacute;t&eacute; par Actions Simplifi&eacute;e (SAS)</li>
              <li><strong>Capital social :</strong> 10&nbsp;000 &euro;</li>
              <li><strong>Si&egrave;ge social :</strong> France</li>
              <li><strong>Num&eacute;ro SIREN :</strong> [en cours d&apos;enregistrement]</li>
              <li><strong>Num&eacute;ro TVA intracommunautaire :</strong> [en cours]</li>
              <li><strong>Directeur de la publication :</strong> Le Pr&eacute;sident de VitFix SAS</li>
              <li><strong>Email :</strong> <a href="mailto:contact@vitfix.fr" className="text-[#FFC107] hover:underline">contact@vitfix.fr</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">H&eacute;bergeur</h2>
            <ul className="space-y-1 text-sm">
              <li><strong>Soci&eacute;t&eacute; :</strong> Vercel Inc.</li>
              <li><strong>Adresse :</strong> 440 N Barranca Ave #4133, Covina, CA 91723, &Eacute;tats-Unis</li>
              <li><strong>Site web :</strong> <a href="https://vercel.com" className="text-[#FFC107] hover:underline" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Propri&eacute;t&eacute; intellectuelle</h2>
            <p>
              L&apos;ensemble des contenus pr&eacute;sents sur le site VitFix — notamment les textes, images, logos,
              graphismes, ic&ocirc;nes, photographies, animations et logiciels — est la propri&eacute;t&eacute; exclusive
              de VitFix SAS ou fait l&apos;objet de droits d&apos;utilisation d&ucirc;ment conc&eacute;d&eacute;s.
            </p>
            <p className="mt-3">
              Ces contenus sont prot&eacute;g&eacute;s par le Code de la propri&eacute;t&eacute; intellectuelle (CPI),
              notamment les articles L.&nbsp;111-1 et suivants (droits d&apos;auteur) et L.&nbsp;711-1
              et suivants (droit des marques).
            </p>
            <p className="mt-3">
              Toute reproduction, repr&eacute;sentation, modification, publication, adaptation ou exploitation,
              totale ou partielle, par quelque proc&eacute;d&eacute; et sur quelque support que ce soit, sans
              l&apos;autorisation &eacute;crite pr&eacute;alable de VitFix SAS, est strictement interdite et constitue
              une contrefa&ccedil;on sanctionn&eacute;e par les articles L.&nbsp;335-2 et suivants du CPI,
              passible de 3 ans d&apos;emprisonnement et 300&nbsp;000 &euro; d&apos;amende.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Marque</h2>
            <p>
              La marque &laquo;&nbsp;VitFix&nbsp;&raquo; et le logo associ&eacute; sont des marques en cours de d&eacute;p&ocirc;t
              aupr&egrave;s de l&apos;Institut National de la Propri&eacute;t&eacute; Industrielle (INPI).
              Toute utilisation non autoris&eacute;e est susceptible de constituer une contrefaçon.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Limitation de responsabilit&eacute;</h2>
            <p>
              VitFix agit en tant qu&apos;interm&eacute;diaire technique de mise en relation entre clients et artisans,
              au sens de la loi n&deg;&nbsp;2004-575 du 21&nbsp;juin&nbsp;2004 (LCEN).
              VitFix ne saurait &ecirc;tre tenu responsable des prestations r&eacute;alis&eacute;es par les artisans
              r&eacute;f&eacute;renc&eacute;s sur la Plateforme, ni des dommages directs ou indirects li&eacute;s &agrave;
              l&apos;utilisation du site.
            </p>
            <p className="mt-3">
              VitFix s&apos;efforce de maintenir l&apos;exactitude des informations publi&eacute;es sur le site.
              Toutefois, VitFix ne peut garantir l&apos;exactitude, l&apos;exhaustivit&eacute; et l&apos;actualit&eacute; des
              informations diffus&eacute;es et d&eacute;cline toute responsabilit&eacute; pour d&eacute;faut d&apos;exactitude,
              d&apos;exhaustivit&eacute; ou d&apos;actualit&eacute; des informations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Liens hypertextes</h2>
            <p>
              Le site VitFix peut contenir des liens vers des sites tiers. VitFix n&apos;exerce aucun contr&ocirc;le
              sur ces sites et d&eacute;cline toute responsabilit&eacute; quant &agrave; leur contenu ou leurs pratiques.
              La cr&eacute;ation de liens hypertextes vers le site vitfix.fr n&eacute;cessite une autorisation
              pr&eacute;alable &eacute;crite de VitFix SAS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Donn&eacute;es personnelles et RGPD</h2>
            <p>
              Conform&eacute;ment au R&egrave;glement (UE) 2016/679 (RGPD) et &agrave; la loi Informatique et Libert&eacute;s
              (modifi&eacute;e), vous disposez d&apos;un droit d&apos;acc&egrave;s, de rectification, d&apos;effacement,
              de limitation, de portabilit&eacute; et d&apos;opposition concernant vos donn&eacute;es personnelles.
            </p>
            <p className="mt-3">
              Pour exercer ces droits, contactez notre D&eacute;l&eacute;gu&eacute; &agrave; la Protection des Donn&eacute;es&nbsp;:
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Email&nbsp;: <a href="mailto:dpo@vitfix.fr" className="text-[#FFC107] hover:underline">dpo@vitfix.fr</a></li>
            </ul>
            <p className="mt-3">
              Vous pouvez &eacute;galement introduire une r&eacute;clamation aupr&egrave;s de la CNIL&nbsp;:
              <a href="https://www.cnil.fr" className="text-[#FFC107] hover:underline ml-1" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Droit applicable</h2>
            <p>
              Les pr&eacute;sentes mentions l&eacute;gales sont r&eacute;gies par le droit fran&ccedil;ais.
              En cas de litige, les tribunaux fran&ccedil;ais seront seuls comp&eacute;tents.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
