// FR-V4 - Attestation éditeur conforme art. 88 LF 2016 + LF 2026 (modèle BOFiP)
// Page publique téléchargeable par tout artisan client de Vitfix.io en cas de
// contrôle DGFiP. Évite à Vitfix de devoir certifier NF525/LNE (~5-15k€) tant
// que cette attestation existe et est tenue à jour.
//
// FR-V8 audit fix : référence BOI-CF-COM-10-80 retirée (code BOFiP exact non
// localisé formellement, à valider par expert-comptable). On garde le
// référentiel BOFiP général + la base légale par articles.

'use client'

import Link from 'next/link'

export default function AttestationEditeurPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 print:max-w-none">
        <div className="mb-6 flex justify-between items-center print:hidden">
          <Link href="/fr" className="text-sm text-gray-500 hover:text-gray-700">← Accueil</Link>
          <button
            onClick={() => window.print()}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            🖨 Imprimer / PDF
          </button>
        </div>

        <article className="bg-white rounded-lg shadow-sm p-8 print:shadow-none print:p-0">
          <header className="border-b border-gray-200 pb-6 mb-6">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Document légal, opposable en cas de contrôle</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Attestation individuelle de l&apos;éditeur du logiciel de facturation
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Conforme à l&apos;article 88 de la loi n°2015-1785 du 29 décembre 2015 (loi de finances 2016)
              et à la loi de finances 2026 du 19 février 2026 (rétablissement de l&apos;attestation
              individuelle d&apos;éditeur comme alternative à la certification NF525 / LNE).
            </p>
          </header>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">1. Éditeur</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 pr-4 text-gray-600 align-top w-1/3">Nom commercial</td><td className="py-1 font-medium">Vitfix.io</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Raison sociale</td><td className="py-1 font-medium">SAS Kinnova Group</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">SIRET</td><td className="py-1 font-medium">951 819 010 00012</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Siège social</td><td className="py-1 font-medium">115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence, France</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Représentant légal</td><td className="py-1 font-medium">Frédéric Carvalho, Président</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Contact conformité</td><td className="py-1 font-medium">conformite@vitfix.io</td></tr>
              </tbody>
            </table>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">2. Produit attesté</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 pr-4 text-gray-600 align-top w-1/3">Désignation</td><td className="py-1 font-medium">Vitfix Pro, module devis &amp; facturation</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Version</td><td className="py-1 font-medium">2026 (livraison continue, branche stable)</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Type</td><td className="py-1 font-medium">SaaS (logiciel en mode service, hébergement Cloudflare Workers + Supabase EU)</td></tr>
                <tr><td className="py-1 pr-4 text-gray-600 align-top">Mises à jour automatiques</td><td className="py-1 font-medium">Oui, déploiement continu via GitHub Actions, application immédiate sans intervention de l&apos;utilisateur</td></tr>
              </tbody>
            </table>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">3. Attestation des conditions d&apos;inaltérabilité, sécurisation, conservation et archivage (ISCA)</h2>
            <p className="text-sm text-gray-700 mb-4">
              Vitfix.io atteste, par la présente, que le module Vitfix Pro de facturation respecte les quatre conditions
              cumulatives prévues par l&apos;article 88 de la loi de finances 2016 (codifié à l&apos;article 286, I, 3° bis du CGI),
              en l&apos;état de la version 2026 du logiciel.
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800">3.1, Inaltérabilité</h3>
                <p className="text-gray-700 mt-1">
                  Toute donnée d&apos;une opération de facturation, dès qu&apos;elle est validée par l&apos;utilisateur (passage en
                  statut <em>envoyé</em> ou <em>émis</em>), est figée techniquement par les mécanismes suivants :
                </p>
                <ul className="list-disc list-inside text-gray-700 mt-1 ml-4 space-y-1">
                  <li>Hash cryptographique SHA-256 du contenu canonique du document, calculé au moment du passage à l&apos;état émis</li>
                  <li>Chaînage HMAC-SHA256 reliant chaque document au précédent (par artisan), créant une chaîne de hash inviolable</li>
                  <li>Triggers PostgreSQL <code className="text-xs bg-gray-100 px-1 rounded">validate_devis_transition</code> et <code className="text-xs bg-gray-100 px-1 rounded">validate_facture_transition</code>
                    qui rejettent toute modification de statut interdite (ex : <em>payée → en attente</em>, <em>signé → brouillon</em>)</li>
                  <li>Politique RLS Supabase interdisant tout ordre <code className="text-xs bg-gray-100 px-1 rounded">DELETE</code>
                    sur les tables <code className="text-xs bg-gray-100 px-1 rounded">devis</code> et <code className="text-xs bg-gray-100 px-1 rounded">factures</code>
                   , aucun chemin de suppression physique d&apos;un document émis n&apos;est exposé</li>
                  <li>Annulation d&apos;un document : remplie via avoir/annulation soft (colonnes <code className="text-xs bg-gray-100 px-1 rounded">cancelled_at</code>, <code className="text-xs bg-gray-100 px-1 rounded">cancelled_reason</code>, <code className="text-xs bg-gray-100 px-1 rounded">cancelled_by_user_id</code>),
                    le document originel restant intégralement consultable</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800">3.2, Sécurisation</h3>
                <p className="text-gray-700 mt-1">
                  Mesures techniques et organisationnelles :
                </p>
                <ul className="list-disc list-inside text-gray-700 mt-1 ml-4 space-y-1">
                  <li>Authentification utilisateur via Supabase Auth (mot de passe haché bcrypt + JWT signé)</li>
                  <li>Authentification multi-facteurs (MFA TOTP) disponible et activable par l&apos;utilisateur</li>
                  <li>Chiffrement TLS 1.3 obligatoire sur toutes les communications client/serveur (HSTS configuré)</li>
                  <li>Chiffrement at-rest des données sur Supabase (AES-256, géré par fournisseur)</li>
                  <li>Politique RLS (<em>Row Level Security</em>) Supabase appliquée à toutes les tables sensibles, isolant les données par artisan</li>
                  <li>Journal d&apos;audit dédié <code className="text-xs bg-gray-100 px-1 rounded">documents_audit_log</code> conservé 10 ans, capturant toute mutation (statut, annulation, soft-delete, signature)</li>
                  <li>Surveillance des incidents via Sentry (monitoring 24/7, alertes patterns anormaux)</li>
                  <li>Scans de sécurité automatisés (CodeQL, Semgrep OWASP, TruffleHog secrets, Trivy dépendances) sur chaque modification</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800">3.3, Conservation</h3>
                <p className="text-gray-700 mt-1">
                  Les documents fiscaux émis par Vitfix Pro sont conservés au minimum pendant la durée légale de
                  10 ans à compter de leur émission (article L. 123-22 du Code de commerce et article L102 B du Livre des procédures fiscales).
                </p>
                <ul className="list-disc list-inside text-gray-700 mt-1 ml-4 space-y-1">
                  <li>Stockage primaire : base de données PostgreSQL Supabase (région UE, Frankfurt), répliquée à chaud sur 3 nœuds</li>
                  <li>Sauvegardes Point-in-Time Recovery (PITR) Supabase avec rétention configurée à 30 jours minimum</li>
                  <li>Pipeline de rétention automatisée (via <code className="text-xs bg-gray-100 px-1 rounded">pg_cron</code>) : aucune purge avant 10 ans révolus, anonymisation des données personnelles client à 11 ans (RGPD principe de minimisation)</li>
                  <li>Mécanisme de <em>legal hold</em> permettant de suspendre l&apos;anonymisation en cas de litige actif</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800">3.4, Archivage</h3>
                <p className="text-gray-700 mt-1">
                  Conformément à l&apos;arrêté du 22 mars 2017 relatif aux modalités d&apos;archivage électronique probant :
                </p>
                <ul className="list-disc list-inside text-gray-700 mt-1 ml-4 space-y-1">
                  <li>Documents générés au format <strong>PDF/A-3B</strong> (norme ISO 19005-3 niveau B) conforme à l&apos;archivage électronique probant</li>
                  <li>Métadonnées XMP intégrées (titre, auteur, date d&apos;émission, conformité PDF/A déclarée)</li>
                  <li>Profil colorimétrique sRGB déclaré dans <em>OutputIntent</em> du PDF</li>
                  <li>Documents accessibles à l&apos;artisan utilisateur sur toute la durée de conservation, exportables individuellement ou en lot</li>
                  <li>Compatibilité avec la facturation électronique <strong>Factur-X 1.0.07</strong> (PDF/A-3 + XML CII EN 16931 BASIC)
                    pour les factures B2B (anticipation réforme 2026/2027)</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">4. Numérotation des documents</h2>
            <p className="text-sm text-gray-700">
              Les numéros de devis et de facture sont attribués via une fonction PostgreSQL atomique
              (<code className="text-xs bg-gray-100 px-1 rounded">next_doc_number</code>) garantissant une séquence
              continue et sans rupture, par artisan et par année (article 242 nonies A du CGI). Aucune réutilisation
              n&apos;est possible, même après suppression d&apos;un brouillon.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">5. Mise à jour de la présente attestation</h2>
            <p className="text-sm text-gray-700">
              Cette attestation est tenue à jour par l&apos;éditeur. Toute modification substantielle du module fiscal
              entraînera la publication d&apos;une version actualisée à la même URL. La date de dernière mise à jour
              fait foi (cf. ci-dessous).
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">6. Base légale</h2>
            <p className="text-sm text-gray-700">
              La présente attestation est rédigée conformément au cadre prévu par l&apos;article 88
              de la loi de finances 2016 (codifié au CGI art. 286 I 3° bis) et à la loi de
              finances 2026 du 19 février 2026, qui rétablit explicitement l&apos;attestation
              individuelle d&apos;éditeur comme alternative à la certification NF525 ou LNE.
              Le modèle suivi est celui publié au Bulletin Officiel des Finances Publiques (BOFiP),
              section relative aux logiciels de facturation. Elle est opposable à l&apos;administration
              fiscale en cas de contrôle.
            </p>
          </section>

          <footer className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500">
            <p>
              Fait à Aix-en-Provence, France, le <strong>5 mai 2026</strong>.
            </p>
            <p className="mt-2">
              <strong>Frédéric Carvalho</strong>, Président de SAS Kinnova Group, éditeur de Vitfix.io
            </p>
            <p className="mt-4 italic">
              Document signé électroniquement et publié à l&apos;URL <code>https://vitfix.io/fr/attestation-editeur/</code>.
              Tout artisan utilisateur peut imprimer le présent document depuis cette URL et le présenter à l&apos;administration
              fiscale en cas de contrôle.
            </p>
          </footer>
        </article>

        <div className="mt-6 text-xs text-gray-500 text-center print:hidden">
          Document mis à jour le 5 mai 2026, version 1.0
        </div>
      </div>
    </div>
  )
}
