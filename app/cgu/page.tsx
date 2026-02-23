import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation - VitFix',
  description: 'CGU de la plateforme VitFix, conformes au droit français et au RGPD.',
}

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Conditions G&eacute;n&eacute;rales d&apos;Utilisation
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Derni&egrave;re mise &agrave; jour : f&eacute;vrier 2026 — Version 1.0
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* Préambule */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Pr&eacute;ambule</h2>
            <p>
              La soci&eacute;t&eacute; VitFix SAS (ci-apr&egrave;s &laquo;&nbsp;VitFix&nbsp;&raquo; ou &laquo;&nbsp;la Soci&eacute;t&eacute;&nbsp;&raquo;)
              exploite une plateforme num&eacute;rique accessible &agrave; l&apos;adresse{' '}
              <span className="font-medium">vitfix.fr</span> (ci-apr&egrave;s &laquo;&nbsp;la Plateforme&nbsp;&raquo;),
              permettant la mise en relation entre des particuliers et des artisans professionnels
              du b&acirc;timent et des services &agrave; domicile.
            </p>
            <p className="mt-3">
              Les pr&eacute;sentes Conditions G&eacute;n&eacute;rales d&apos;Utilisation (ci-apr&egrave;s &laquo;&nbsp;CGU&nbsp;&raquo;)
              ont pour objet de d&eacute;finir les conditions et modalit&eacute;s d&apos;acc&egrave;s et d&apos;utilisation
              de la Plateforme par tout utilisateur (ci-apr&egrave;s &laquo;&nbsp;l&apos;Utilisateur&nbsp;&raquo;).
              Elles sont r&eacute;dig&eacute;es conform&eacute;ment notamment &agrave;&nbsp;:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>La loi n&deg;&nbsp;2004-575 du 21&nbsp;juin&nbsp;2004 pour la confiance dans l&apos;&eacute;conomie num&eacute;rique (LCEN)</li>
              <li>La loi n&deg;&nbsp;78-17 du 6&nbsp;janvier&nbsp;1978 relative &agrave; l&apos;informatique, aux fichiers et aux libert&eacute;s</li>
              <li>Le R&egrave;glement (UE) 2016/679 du 27&nbsp;avril&nbsp;2016 (RGPD)</li>
              <li>Le Code de la consommation, notamment les articles L.&nbsp;111-1 et suivants</li>
              <li>Le Code civil, notamment les articles 1366 et suivants relatifs aux contrats &eacute;lectroniques</li>
            </ul>
          </section>

          {/* Article 1 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 1 — D&eacute;finitions</h2>
            <ul className="space-y-2 text-sm">
              <li><strong>&laquo;&nbsp;Plateforme&nbsp;&raquo;</strong> : le site internet vitfix.fr et l&apos;application mobile VitFix Pro.</li>
              <li><strong>&laquo;&nbsp;Utilisateur&nbsp;&raquo;</strong> : toute personne physique ou morale acc&eacute;dant &agrave; la Plateforme.</li>
              <li><strong>&laquo;&nbsp;Client&nbsp;&raquo;</strong> : tout Utilisateur particulier ou professionnel recherchant les services d&apos;un Artisan.</li>
              <li><strong>&laquo;&nbsp;Artisan&nbsp;&raquo;</strong> : tout professionnel du b&acirc;timent ou des services &agrave; domicile inscrit sur la Plateforme.</li>
              <li><strong>&laquo;&nbsp;Prestation&nbsp;&raquo;</strong> : le service rendu par l&apos;Artisan au Client.</li>
              <li><strong>&laquo;&nbsp;R&eacute;servation&nbsp;&raquo;</strong> : la demande ferme d&apos;intervention d&apos;un Client aupr&egrave;s d&apos;un Artisan via la Plateforme.</li>
              <li><strong>&laquo;&nbsp;Compte&nbsp;&raquo;</strong> : l&apos;espace personnel cr&eacute;&eacute; apr&egrave;s inscription sur la Plateforme.</li>
            </ul>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 2 — Acceptation des CGU</h2>
            <p>
              Toute utilisation de la Plateforme implique l&apos;acceptation pleine et enti&egrave;re des pr&eacute;sentes CGU.
              L&apos;Utilisateur qui n&apos;accepte pas les CGU doit cesser imm&eacute;diatement toute utilisation de la Plateforme.
            </p>
            <p className="mt-3">
              VitFix se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU &agrave; tout moment.
              Les modifications entrent en vigueur d&egrave;s leur publication sur la Plateforme.
              L&apos;Utilisateur sera inform&eacute; par email de toute modification substantielle.
              L&apos;utilisation continue de la Plateforme apr&egrave;s notification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 3 — Acc&egrave;s et inscription</h2>
            <h3 className="font-semibold text-gray-900 mb-2">3.1 Conditions d&apos;acc&egrave;s</h3>
            <p>
              La Plateforme est accessible &agrave; toute personne physique majeure (18 ans r&eacute;volus) ou
              toute personne morale d&ucirc;ment repr&eacute;sent&eacute;e. L&apos;acc&egrave;s &agrave; certaines fonctionnalit&eacute;s
              n&eacute;cessite la cr&eacute;ation d&apos;un Compte.
            </p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">3.2 Cr&eacute;ation de Compte</h3>
            <p>
              Lors de l&apos;inscription, l&apos;Utilisateur s&apos;engage &agrave; fournir des informations exactes, compl&egrave;tes
              et &agrave; jour. Il est responsable de la confidentialit&eacute; de ses identifiants de connexion.
              Toute utilisation du Compte sous sa responsabilit&eacute; lui est imputable.
              VitFix se r&eacute;serve le droit de suspendre ou supprimer tout Compte en cas d&apos;informations
              inexactes ou de violation des pr&eacute;sentes CGU.
            </p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">3.3 Inscription des Artisans</h3>
            <p>
              Les Artisans doivent obligatoirement fournir&nbsp;:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Un num&eacute;ro SIRET valide et actif</li>
              <li>Une attestation d&apos;assurance Responsabilit&eacute; Civile Professionnelle (RC Pro) en cours de validit&eacute;</li>
              <li>Toute qualification ou certification requise pour l&apos;exercice de leur activit&eacute;</li>
            </ul>
            <p className="mt-3">
              VitFix proc&egrave;de &agrave; la v&eacute;rification de ces documents avant activation du profil de l&apos;Artisan.
              Un Artisan dont les documents seraient p&eacute;rim&eacute;s ou invalides verra son profil suspendu.
            </p>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 4 — R&ocirc;le de VitFix</h2>
            <p>
              VitFix agit exclusivement en qualit&eacute; d&apos;<strong>interm&eacute;diaire technique de mise en relation</strong>
              entre les Clients et les Artisans, au sens de la loi n&deg;&nbsp;2004-575 du 21&nbsp;juin&nbsp;2004
              (LCEN) et de l&apos;article 5 du R&egrave;glement (UE) 2022/2065 (DSA).
            </p>
            <p className="mt-3">
              VitFix n&apos;est pas partie aux contrats conclus entre les Clients et les Artisans.
              En cons&eacute;quence, VitFix ne garantit pas et ne saurait &ecirc;tre tenu responsable de&nbsp;:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>La qualit&eacute;, la conformit&eacute; ou le r&eacute;sultat des Prestations r&eacute;alis&eacute;es</li>
              <li>L&apos;exactitude des informations communiqu&eacute;es par les Artisans sur leur profil</li>
              <li>Les dommages mat&eacute;riels ou immat&eacute;riels caus&eacute;s lors d&apos;une Prestation</li>
              <li>Les litiges commerciaux entre Clients et Artisans</li>
            </ul>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 5 — R&eacute;servation et annulation</h2>
            <h3 className="font-semibold text-gray-900 mb-2">5.1 Processus de r&eacute;servation</h3>
            <p>
              La R&eacute;servation est effectu&eacute;e par le Client via la Plateforme. Elle n&apos;est confirm&eacute;e
              qu&apos;apr&egrave;s acceptation explicite de l&apos;Artisan. Le Client re&ccedil;oit une confirmation par email.
            </p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">5.2 Annulation par le Client</h3>
            <p>
              Toute annulation doit &ecirc;tre effectu&eacute;e depuis l&apos;espace personnel du Client, au moins
              <strong>&nbsp;24 heures</strong> avant le cr&eacute;neau r&eacute;serv&eacute;. En cas d&apos;annulation tardive
              (moins de 24h) ou d&apos;absence, l&apos;Artisan peut appliquer des frais d&apos;annulation selon
              ses conditions tarifaires affich&eacute;es sur son profil.
            </p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">5.3 Annulation par l&apos;Artisan</h3>
            <p>
              L&apos;Artisan s&apos;engage &agrave; informer le Client et VitFix de toute impossibilit&eacute; d&apos;intervenir
              dans les meilleurs d&eacute;lais. Des annulations r&eacute;p&eacute;t&eacute;es peuvent entra&icirc;ner la suspension du
              profil de l&apos;Artisan.
            </p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">5.4 Droit de r&eacute;tractation</h3>
            <p>
              Conform&eacute;ment aux articles L.&nbsp;221-18 et suivants du Code de la consommation, le Client
              consommateur dispose d&apos;un d&eacute;lai de <strong>14 jours</strong> pour exercer son droit de
              r&eacute;tractation &agrave; compter de la conclusion du contrat, sauf si la Prestation a commenc&eacute;
              avec son accord expr&egrave;s avant l&apos;expiration de ce d&eacute;lai.
            </p>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 6 — Obligations des Artisans</h2>
            <p>En s&apos;inscrivant sur VitFix, l&apos;Artisan s&apos;engage &agrave;&nbsp;:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Exercer son activit&eacute; conform&eacute;ment &agrave; la r&eacute;glementation en vigueur</li>
              <li>Maintenir son assurance RC Pro valide et en fournir un justificatif annuel</li>
              <li>Respecter les cr&eacute;neaux r&eacute;serv&eacute;s et &ecirc;tre ponctuel</li>
              <li>Fournir une Prestation de qualit&eacute; conforme au devis &eacute;tabli</li>
              <li>Remettre une facture conform&eacute;ment aux articles L.&nbsp;441-9 et suivants du Code de commerce</li>
              <li>Respecter les r&egrave;gles relatives au d&eacute;marchage &agrave; domicile (articles L.&nbsp;221-1 et suivants du Code de la consommation)</li>
              <li>Ne pas solliciter des Clients en dehors de la Plateforme pour des prestations similaires &agrave; celles r&eacute;alis&eacute;es via VitFix</li>
              <li>Maintenir leur profil &agrave; jour (disponibilit&eacute;s, tarifs, qualifications)</li>
            </ul>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 7 — Obligations des Clients</h2>
            <p>Le Client s&apos;engage &agrave;&nbsp;:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Fournir des informations exactes sur sa demande et son adresse d&apos;intervention</li>
              <li>&Ecirc;tre pr&eacute;sent ou repr&eacute;sent&eacute; au cr&eacute;neau convenu</li>
              <li>R&eacute;gler l&apos;Artisan conform&eacute;ment au devis accept&eacute;</li>
              <li>Formuler ses r&eacute;clamations dans les d&eacute;lais l&eacute;gaux</li>
              <li>Ne pas publier d&apos;avis diffamatoires, faux ou trompeurs</li>
            </ul>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 8 — Propri&eacute;t&eacute; intellectuelle</h2>
            <p>
              L&apos;ensemble des &eacute;l&eacute;ments constituant la Plateforme VitFix (marques, logos, textes, graphismes,
              logiciels, bases de donn&eacute;es, code source) sont la propri&eacute;t&eacute; exclusive de VitFix SAS
              et sont prot&eacute;g&eacute;s par le droit de la propri&eacute;t&eacute; intellectuelle.
            </p>
            <p className="mt-3">
              Toute reproduction, repr&eacute;sentation, modification, publication, adaptation,
              extraction ou exploitation, totale ou partielle, par quelque proc&eacute;d&eacute; que ce soit
              et sur quelque support que ce soit, est strictement interdite sans autorisation
              &eacute;crite pr&eacute;alable de VitFix SAS, sous peine de poursuites judiciaires.
            </p>
            <p className="mt-3">
              Les Artisans c&egrave;dent &agrave; VitFix, &agrave; titre non exclusif et gratuit,
              le droit d&apos;utiliser les &eacute;l&eacute;ments (photos, descriptions) qu&apos;ils publient sur la Plateforme
              aux fins de promotion du service.
            </p>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 9 — Avis et notations</h2>
            <p>
              Apr&egrave;s chaque Prestation, le Client peut laisser un avis sur le profil de l&apos;Artisan.
              Les avis doivent &ecirc;tre sincères, objectifs et bas&eacute;s sur une exp&eacute;rience r&eacute;elle.
              Sont strictement interdits les avis&nbsp;:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Faux ou diffamatoires</li>
              <li>Injurieux ou discriminatoires</li>
              <li>Publi&eacute;s en contrepartie d&apos;une r&eacute;mun&eacute;ration non d&eacute;clar&eacute;e</li>
            </ul>
            <p className="mt-3">
              VitFix se r&eacute;serve le droit de supprimer tout avis non conforme,
              conform&eacute;ment aux articles L.&nbsp;111-7-2 et suivants du Code de la consommation.
            </p>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 10 — Protection des donn&eacute;es personnelles</h2>
            <p>
              VitFix traite les donn&eacute;es personnelles des Utilisateurs en qualit&eacute; de responsable de traitement,
              conform&eacute;ment au RGPD et &agrave; la loi Informatique et Libert&eacute;s.
            </p>
            <p className="mt-3">Conform&eacute;ment au RGPD, vous disposez des droits suivants&nbsp;:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Droit d&apos;acc&egrave;s (art.&nbsp;15 RGPD)</li>
              <li>Droit de rectification (art.&nbsp;16 RGPD)</li>
              <li>Droit &agrave; l&apos;effacement (art.&nbsp;17 RGPD)</li>
              <li>Droit &agrave; la limitation du traitement (art.&nbsp;18 RGPD)</li>
              <li>Droit &agrave; la portabilit&eacute; (art.&nbsp;20 RGPD)</li>
              <li>Droit d&apos;opposition (art.&nbsp;21 RGPD)</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez notre D&eacute;l&eacute;gu&eacute; &agrave; la Protection des Donn&eacute;es (DPD)
              &agrave; l&apos;adresse&nbsp;: <a href="mailto:dpo@vitfix.fr" className="text-[#FFC107] hover:underline">dpo@vitfix.fr</a>.
              Vous pouvez &eacute;galement introduire une r&eacute;clamation aupr&egrave;s de la CNIL
              (<a href="https://www.cnil.fr" className="text-[#FFC107] hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
            </p>
            <p className="mt-3">
              Pour plus d&apos;informations, consultez notre{' '}
              <a href="/confidentialite" className="text-[#FFC107] hover:underline">Politique de confidentialit&eacute;</a>.
            </p>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 11 — Responsabilit&eacute; et limitation</h2>
            <p>
              VitFix met en œuvre tous les moyens raisonnables pour assurer la disponibilit&eacute; de la Plateforme
              mais ne saurait &ecirc;tre tenu responsable des interruptions dues &agrave; des op&eacute;rations de maintenance,
              &agrave; des d&eacute;faillances techniques ou &agrave; des causes ext&eacute;rieures (force majeure, actes malveillants).
            </p>
            <p className="mt-3">
              En tout &eacute;tat de cause, la responsabilit&eacute; de VitFix ne pourra exc&eacute;der le montant des sommes
              effectivement per&ccedil;ues par VitFix au titre de l&apos;abonnement de l&apos;Utilisateur au cours
              des 12 derniers mois pr&eacute;c&eacute;dant le fait g&eacute;n&eacute;rateur du dommage.
            </p>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 12 — M&eacute;diation et r&egrave;glement des litiges</h2>
            <p>
              Conform&eacute;ment aux articles L.&nbsp;611-1 et suivants du Code de la consommation,
              tout Client consommateur peut avoir recours gratuitement &agrave; un m&eacute;diateur de la consommation
              en vue de la r&eacute;solution amiable du litige l&apos;opposant &agrave; VitFix.
            </p>
            <p className="mt-3">
              La Commission europ&eacute;enne met &eacute;galement &agrave; disposition une plateforme de R&egrave;glement en Ligne
              des Litiges (RLL) accessible &agrave;&nbsp;:
              <a href="https://ec.europa.eu/consumers/odr" className="text-[#FFC107] hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 13 — Droit applicable et juridiction comp&eacute;tente</h2>
            <p>
              Les pr&eacute;sentes CGU sont soumises au droit fran&ccedil;ais.
            </p>
            <p className="mt-3">
              En cas de litige relatif &agrave; l&apos;interpr&eacute;tation ou &agrave; l&apos;ex&eacute;cution des pr&eacute;sentes CGU,
              et &agrave; d&eacute;faut de r&eacute;solution amiable, les tribunaux fran&ccedil;ais seront seuls comp&eacute;tents.
            </p>
            <p className="mt-3">
              Pour les litiges impliquant un consommateur, le tribunal comp&eacute;tent est celui du lieu
              de domicile du consommateur conform&eacute;ment &agrave; l&apos;article R.&nbsp;631-3 du Code de la consommation.
            </p>
          </section>

          {/* Article 14 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 14 — Dispositions diverses</h2>
            <p>
              Si l&apos;une quelconque des dispositions des pr&eacute;sentes CGU &eacute;tait d&eacute;clar&eacute;e nulle ou inapplicable
              par une d&eacute;cision de justice, les autres dispositions resteraient en vigueur.
            </p>
            <p className="mt-3">
              Le fait pour VitFix de ne pas se pr&eacute;valoir &agrave; un moment donn&eacute; de l&apos;une des clauses
              des pr&eacute;sentes CGU ne peut &ecirc;tre interpr&eacute;t&eacute; comme une renonciation &agrave; se pr&eacute;valoir
              ult&eacute;rieurement de ladite clause.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-100 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p>
              Pour toute question relative aux pr&eacute;sentes CGU&nbsp;:
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li><strong>VitFix SAS</strong></li>
              <li>Email&nbsp;: <a href="mailto:contact@vitfix.fr" className="text-[#FFC107] hover:underline">contact@vitfix.fr</a></li>
              <li>DPO&nbsp;: <a href="mailto:dpo@vitfix.fr" className="text-[#FFC107] hover:underline">dpo@vitfix.fr</a></li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
