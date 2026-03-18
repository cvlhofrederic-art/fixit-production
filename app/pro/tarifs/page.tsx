import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Locale } from '@/lib/i18n/config'

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value || 'fr') as Locale

  if (locale === 'pt') {
    return {
      title: 'Ofertas para Profissionais — VITFIX',
      description: 'Junte-se ao VITFIX e desenvolva a sua atividade. Descubra as nossas ofertas para profissionais.',
      alternates: { canonical: 'https://vitfix.io/pt/pro/tarifs/' },
      openGraph: {
        title: 'Ofertas para Profissionais — VITFIX',
        description: 'Comece gratuitamente e evolua conforme as suas necessidades.',
        siteName: 'VITFIX',
        locale: 'pt_PT',
        type: 'website',
      },
    }
  }

  return {
    title: 'Offres artisans - Vitfix',
    description: 'Rejoignez Vitfix et développez votre activité. Découvrez nos offres pour les artisans.',
    alternates: { canonical: 'https://vitfix.io/pro/tarifs/' },
  }
}

const featuresFR = [
  { label: 'Profil artisan vérifié', freemium: true, pro: true },
  { label: 'Devis & factures PDF', freemium: true, pro: true },
  { label: 'Agenda en ligne', freemium: false, pro: true },
  { label: 'Réservations clients', freemium: false, pro: true },
  { label: 'Messagerie client', freemium: false, pro: true },
  { label: 'Mise en avant dans les résultats', freemium: false, pro: true },
  { label: 'Comptabilité IA (Agent Léa)', freemium: false, pro: true },
  { label: 'Proof of Work (photos + GPS)', freemium: false, pro: true },
  { label: 'Notifications push', freemium: false, pro: true },
  { label: 'Application mobile complète', freemium: false, pro: true },
  { label: 'Support prioritaire par chat', freemium: false, pro: true },
  { label: 'Statistiques avancées', freemium: false, pro: true },
  { label: 'Bourse aux Marchés (appels d\'offres)', freemium: false, pro: true },
]

const featuresPT = [
  { label: 'Perfil profissional verificado', freemium: true, pro: true },
  { label: 'Orçamentos e faturas PDF', freemium: true, pro: true },
  { label: 'Agenda online', freemium: false, pro: true },
  { label: 'Reservas de clientes', freemium: false, pro: true },
  { label: 'Mensagens com clientes', freemium: false, pro: true },
  { label: 'Destaque nos resultados', freemium: false, pro: true },
  { label: 'Contabilidade IA (Agente Léa)', freemium: false, pro: true },
  { label: 'Proof of Work (fotos + GPS)', freemium: false, pro: true },
  { label: 'Notificações push', freemium: false, pro: true },
  { label: 'Aplicação móvel completa', freemium: false, pro: true },
  { label: 'Suporte prioritário por chat', freemium: false, pro: true },
  { label: 'Estatísticas avançadas', freemium: false, pro: true },
  { label: 'Bolsa de Mercados (concursos)', freemium: false, pro: true },
]

function Check() {
  return <span className="text-green-500 font-bold text-lg">✓</span>
}
function Cross() {
  return <span className="text-red-400 font-bold text-lg">✗</span>
}

export default async function ProTarifsPage() {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value || 'fr') as Locale
  const isPt = locale === 'pt'
  const features = isPt ? featuresPT : featuresFR
  const registerHref = '/pro/register'

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {isPt ? 'Ofertas para cada profissional' : 'Des offres pour chaque artisan'}
          </h1>
          <p className="text-lg text-gray-600">
            {isPt ? 'Comece gratuitamente e evolua conforme as suas necessidades' : 'Commencez gratuitement et évoluez selon vos besoins'}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          {/* Freemium */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Freemium</h2>
            <p className="text-gray-500 text-sm text-center mb-4">
              {isPt ? 'Para começar sem risco' : 'Pour démarrer sans risque'}
            </p>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-gray-900">0€</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-6">
              {isPt ? 'Acesso ao módulo Orçamentos e Faturas apenas' : 'Accès au module Devis & Factures uniquement'}
            </p>
            <Link
              href={registerHref}
              className="block text-center py-3 rounded-lg font-semibold transition border-2 border-yellow text-yellow hover:bg-warm-gray"
            >
              {isPt ? 'Começar gratuitamente' : 'Commencer gratuitement'}
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-yellow p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow text-gray-900 text-xs font-bold px-4 py-1 rounded-full">
              {isPt ? 'RECOMENDADO' : 'RECOMMANDÉ'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Pro</h2>
            <p className="text-gray-500 text-sm text-center mb-4">
              {isPt ? 'Todos os módulos desbloqueados' : 'Tous les modules débloqués'}
            </p>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-yellow">49€</span>
              <span className="text-sm text-gray-500 ml-1">{isPt ? '/ mês s/ IVA' : '/ mois HT'}</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-6">
              {isPt ? 'Sem compromisso · Cancele a qualquer momento' : 'Sans engagement · Annulez à tout moment'}
            </p>
            <Link
              href={registerHref}
              className="block text-center py-3 rounded-lg font-semibold transition bg-yellow hover:bg-yellow-light text-gray-900"
            >
              {isPt ? 'Escolher a oferta Pro' : "Choisir l'offre Pro"}
            </Link>
          </div>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {isPt ? 'Comparativo detalhado das funcionalidades' : 'Comparatif détaillé des fonctionnalités'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-500">
                    {isPt ? 'Funcionalidade' : 'Fonctionnalité'}
                  </th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-900 w-28">Freemium</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-yellow w-28">Pro</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.label} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="px-6 py-3.5 text-sm text-gray-700">{f.label}</td>
                    <td className="text-center px-4 py-3.5">
                      {f.freemium ? <Check /> : <Cross />}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      {f.pro ? <Check /> : <Cross />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Entreprise */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {isPt ? 'Oferta Empresa' : 'Offre Entreprise'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isPt
                  ? 'Para equipas e frotas de profissionais — preço personalizado'
                  : "Pour les équipes et flottes d'artisans — tarif sur mesure"}
              </p>
              <ul className="mt-3 space-y-1.5">
                {(isPt ? [
                  'Tudo do Pro incluído',
                  'Gestão multi-profissionais e equipas',
                  'Espaço síndicos e condomínios',
                  'Ordens de serviço automatizadas',
                  'API e integrações personalizadas',
                  'Account manager dedicado',
                ] : [
                  'Tout le Pro inclus',
                  'Gestion multi-artisans et équipes',
                  'Espace syndics & conciergeries',
                  'Ordres de mission automatisés',
                  'API & intégrations sur mesure',
                  'Account manager dédié',
                ]).map(a => (
                  <li key={a} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-yellow font-bold">✓</span> {a}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/contact"
              className="shrink-0 inline-block text-center border-2 border-yellow text-yellow hover:bg-warm-gray px-6 py-3 rounded-lg font-semibold transition"
            >
              {isPt ? 'Pedir orçamento' : 'Demander un devis'}
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {isPt ? 'Tem dúvidas sobre as nossas ofertas?' : 'Des questions sur nos offres ?'}
          </h2>
          <p className="text-gray-600 mb-4">
            {isPt
              ? 'A nossa equipa está disponível para o ajudar na sua escolha.'
              : 'Notre équipe est disponible pour vous accompagner dans votre choix.'}
          </p>
          <Link href="/contact" className="text-yellow font-semibold hover:underline">
            {isPt ? 'Contactar a equipa VITFIX →' : "Contacter l'équipe Vitfix →"}
          </Link>
        </div>
      </div>
    </div>
  )
}
