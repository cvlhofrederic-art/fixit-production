import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerTranslation } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  return isPt ? {
    title: 'FAQ Profissionais - Vitfix',
    description: 'Todas as respostas às suas perguntas sobre o registo e a utilização da Vitfix para profissionais.',
  } : {
    title: 'FAQ Artisans - Vitfix',
    description: 'Toutes les réponses à vos questions sur l\'inscription et l\'utilisation de Vitfix pour les artisans.',
  }
}

const faqsFR = [
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

const faqsPT = [
  {
    categorie: 'Registo',
    questions: [
      {
        q: 'Que documentos são necessários para me registar?',
        r: 'O seu número de NIF válido e uma apólice de seguro de Responsabilidade Civil Profissional em vigor. Estes documentos são verificados pela nossa equipa antes da ativação do seu perfil.',
      },
      {
        q: 'O registo é realmente gratuito?',
        r: 'Sim, o registo e a oferta Freemium são completamente gratuitos. Beneficia de um perfil verificado e da criação de orçamentos e faturas em PDF. A oferta Pro a 49€/mês desbloqueia todos os módulos: agenda, reservas ilimitadas, mensagens, contabilidade IA, Proof of Work, app móvel e suporte prioritário.',
      },
      {
        q: 'Quanto tempo demora a verificação do meu perfil?',
        r: 'A verificação é feita em 24 a 48 horas úteis após o envio dos seus documentos. Receberá um email de confirmação.',
      },
    ],
  },
  {
    categorie: 'Reservas',
    questions: [
      {
        q: 'Como funcionam as reservas?',
        r: 'Os clientes reservam diretamente um horário na sua agenda online. Recebe uma notificação e pode aceitar ou recusar o pedido. Após aceitação, o cliente recebe uma confirmação.',
      },
      {
        q: 'Posso cancelar uma reserva?',
        r: 'Sim, a partir do seu painel de controlo. Em caso de cancelamento, o cliente é informado automaticamente. Cancelamentos frequentes podem afetar a sua avaliação na plataforma.',
      },
      {
        q: 'Como gerir a minha agenda de disponibilidades?',
        r: 'No seu espaço de profissional, o separador "Agenda" permite-lhe definir os seus horários disponíveis, dias de folga e gerir os seus compromissos existentes.',
      },
    ],
  },
  {
    categorie: 'Pagamentos',
    questions: [
      {
        q: 'Como recebo o pagamento dos meus clientes?',
        r: 'O pagamento é efetuado diretamente entre si e o cliente, de acordo com as modalidades que definir (cheque, transferência, numerário, cartão). A Vitfix não intervém na transação financeira.',
      },
      {
        q: 'A Vitfix cobra comissão sobre as minhas intervenções?',
        r: 'Não. Fica com a totalidade das suas receitas. A Vitfix remunera-se exclusivamente através das assinaturas das ofertas Pro e Empresa.',
      },
    ],
  },
  {
    categorie: 'Funcionalidades',
    questions: [
      {
        q: 'Como funciona o Proof of Work?',
        r: 'Disponível com a oferta Pro, o Proof of Work permite-lhe tirar fotos antes/depois da intervenção com registo de data/hora e geolocalização GPS automáticos. O cliente pode assinar eletronicamente no seu telemóvel. Estas provas são guardadas no seu espaço e podem ser exportadas.',
      },
      {
        q: 'Qual é a diferença entre Freemium e Pro?',
        r: 'A oferta Freemium (gratuita) dá acesso apenas ao módulo Orçamentos & Faturas PDF e a um perfil de profissional verificado. A oferta Pro (49€/mês) desbloqueia todos os módulos: agenda online, reservas ilimitadas, mensagens com clientes, destaque nos resultados, contabilidade integrada com o agente IA Léa, Proof of Work, notificações push, aplicação móvel completa e suporte prioritário.',
      },
      {
        q: 'Posso gerar orçamentos e faturas?',
        r: 'Sim, a geração de orçamentos e faturas em PDF está disponível desde a oferta Freemium. Pode criar os seus documentos, enviá-los por email e converter um orçamento em fatura após a realização do serviço.',
      },
      {
        q: 'A aplicação móvel está disponível?',
        r: 'Sim, a Vitfix Pro está disponível no iOS e Android. A app móvel permite-lhe gerir as suas intervenções, receber notificações e efetuar o Proof of Work a partir do seu smartphone.',
      },
    ],
  },
]

export default async function ProFAQPage() {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  const faqs = isPt ? faqsPT : faqsFR
  const contactPath = '/contact'
  const registerPath = '/pro/register'

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isPt ? 'FAQ Profissionais' : 'FAQ Artisans'}
        </h1>
        <p className="text-gray-600 mb-10">
          {isPt
            ? 'Tudo o que precisa de saber para começar a usar a Vitfix como profissional.'
            : 'Tout ce que vous devez savoir pour démarrer et utiliser Vitfix en tant qu\'artisan.'}
        </p>

        <div className="space-y-10">
          {faqs.map((section) => (
            <div key={section.categorie}>
              <h2 className="text-lg font-bold text-yellow mb-4 uppercase tracking-wide">
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

        <div className="mt-12 bg-gradient-to-r from-yellow to-yellow-light rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {isPt ? 'Não encontrou a sua resposta?' : 'Vous n\'avez pas trouvé votre réponse ?'}
          </h2>
          <p className="text-gray-800 mb-4">
            {isPt ? 'A nossa equipa está aqui para ajudar.' : 'Notre équipe est là pour vous aider.'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href={contactPath}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg font-semibold transition"
            >
              {isPt ? 'Contactar o suporte' : 'Contacter le support'}
            </Link>
            <Link
              href={registerPath}
              className="bg-white hover:bg-gray-50 text-gray-900 px-6 py-2.5 rounded-lg font-semibold transition"
            >
              {isPt ? 'Registar agora' : 'S\'inscrire maintenant'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
