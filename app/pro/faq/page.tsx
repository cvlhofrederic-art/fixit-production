import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ Artisans - Vitfix',
  description: 'Toutes les réponses à vos questions sur l\'inscription et l\'utilisation de Vitfix pour les artisans.',
}

const faqs = [
  {
    categorie: 'Inscription',
    questions: [
      {
        q: 'Quels documents sont nécessaires pour s\'inscrire ?',
        r: 'Votre numéro SIRET valide et une attestation d\'assurance Responsabilité Civile Professionnelle (RC Pro) en cours de validité. Ces documents sont vérifiés par notre équipe avant activation de votre profil.',
      },
      {
        q: 'L\'inscription est-elle vraiment gratuite ?',
        r: 'Oui, l\'inscription et l\'offre Freemium sont entièrement gratuites. Vous bénéficiez d\'un profil vérifié et de la création de devis & factures PDF. L\'offre Pro à 49€/mois HT débloque tous les modules : agenda, réservations illimitées, messagerie, comptabilité IA, Proof of Work, app mobile et support prioritaire.',
      },
      {
        q: 'Combien de temps dure la vérification de mon profil ?',
        r: 'La vérification est effectuée sous 24 à 48h ouvrées après envoi de vos documents. Vous recevrez un email de confirmation.',
      },
    ],
  },
  {
    categorie: 'Réservations',
    questions: [
      {
        q: 'Comment fonctionnent les réservations ?',
        r: 'Les clients réservent directement un créneau dans votre agenda en ligne. Vous recevez une notification et pouvez accepter ou refuser la demande. Une fois acceptée, le client reçoit une confirmation.',
      },
      {
        q: 'Puis-je annuler une réservation ?',
        r: 'Oui, depuis votre tableau de bord. En cas d\'annulation, le client est automatiquement informé. Des annulations fréquentes peuvent affecter votre note sur la plateforme.',
      },
      {
        q: 'Comment gérer mon agenda de disponibilités ?',
        r: 'Depuis votre espace artisan, l\'onglet "Agenda" vous permet de définir vos plages horaires disponibles, vos jours de congé et de gérer vos rendez-vous existants.',
      },
    ],
  },
  {
    categorie: 'Paiements',
    questions: [
      {
        q: 'Comment suis-je payé par mes clients ?',
        r: 'Le paiement s\'effectue directement entre vous et le client, selon les modalités que vous définissez (chèque, virement, espèces, CB). Vitfix n\'intervient pas dans la transaction financière.',
      },
      {
        q: 'Vitfix prend-il une commission sur mes interventions ?',
        r: 'Non. Vous conservez l\'intégralité de vos revenus. Vitfix se rémunère uniquement via les abonnements des offres Pro et Entreprise.',
      },
    ],
  },
  {
    categorie: 'Fonctionnalités',
    questions: [
      {
        q: 'Comment fonctionne le Proof of Work ?',
        r: 'Disponible avec l\'offre Pro, le Proof of Work vous permet de prendre des photos avant/après intervention avec horodatage et géolocalisation GPS automatiques. Le client peut signer électroniquement sur votre téléphone. Ces preuves sont stockées dans votre espace et exportables.',
      },
      {
        q: 'Quelle est la différence entre Freemium et Pro ?',
        r: 'L\'offre Freemium (gratuite) donne accès uniquement au module Devis & Factures PDF et à un profil artisan vérifié. L\'offre Pro (49€/mois HT) débloque l\'ensemble des modules : agenda en ligne, réservations illimitées, messagerie client, mise en avant dans les résultats, comptabilité intégrée avec l\'agent IA Léa, Proof of Work, notifications push, application mobile complète et support prioritaire.',
      },
      {
        q: 'Puis-je générer des devis et factures ?',
        r: 'Oui, la génération de devis et factures PDF est disponible dès l\'offre Freemium. Vous pouvez créer vos documents, les envoyer par email et transformer un devis en facture une fois la prestation réalisée.',
      },
      {
        q: 'L\'application mobile est-elle disponible ?',
        r: 'Oui, Vitfix Pro est disponible sur iOS et Android. L\'app mobile vous permet de gérer vos interventions, recevoir des notifications et effectuer le Proof of Work depuis votre smartphone.',
      },
    ],
  },
]

export default function ProFAQPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">FAQ Artisans</h1>
        <p className="text-gray-600 mb-10">
          Tout ce que vous devez savoir pour démarrer et utiliser Vitfix en tant qu&apos;artisan.
        </p>

        <div className="space-y-10">
          {faqs.map((section) => (
            <div key={section.categorie}>
              <h2 className="text-lg font-bold text-[#FFC107] mb-4 uppercase tracking-wide">
                {section.categorie}
              </h2>
              <div className="space-y-4">
                {section.questions.map(({ q, r }) => (
                  <div key={q} className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
                    <p className="text-gray-600 leading-relaxed text-sm">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-[#FFC107] to-[#FFD54F] rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Vous n&apos;avez pas trouvé votre réponse ?
          </h2>
          <p className="text-gray-800 mb-4">Notre équipe est là pour vous aider.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/contact"
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg font-semibold transition"
            >
              Contacter le support
            </Link>
            <Link
              href="/pro/register"
              className="bg-white hover:bg-gray-50 text-gray-900 px-6 py-2.5 rounded-lg font-semibold transition"
            >
              S&apos;inscrire maintenant
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
