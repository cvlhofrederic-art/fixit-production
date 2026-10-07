import { defineMessages } from '@/lib/syndic/v54/i18n'

interface EmailsFixyTextes {
  titre: string
  chapeau: string
  liste: string
  listeToast: string
  rapport: string
  rapportToast: string
  analyser: string
  analyseToast: string
  connecterDabord: string
  connecterTitre: string
  connecterTexte: string
  connecter: string
  integrationEnCours: string
}

export const EMAILS_FIXY_MESSAGES = defineMessages<EmailsFixyTextes>({
  'pt-PT': {
    titre: 'Emails Fixy',
    chapeau: 'Análise IA da sua caixa de email · 0 emails',
    liste: 'Lista',
    listeToast: 'Lista de emails',
    rapport: 'Relatório',
    rapportToast: 'Relatório de emails',
    analyser: 'Analisar agora',
    analyseToast: 'Análise IA',
    connecterDabord: 'Ligue a sua caixa Gmail primeiro',
    connecterTitre: 'Ligue a sua caixa Gmail',
    connecterTexte: 'O Fixy irá analisar automaticamente todos os emails recebidos — urgências, tipos de pedido, sugestões de ações e rascunhos de resposta.',
    connecter: 'Ligar Gmail',
    integrationEnCours: 'Integração Gmail em desenvolvimento',
  },
  'fr-FR': {
    titre: 'E-mails Fixy',
    chapeau: 'Analyse IA de votre boîte de réception · 0 e-mail',
    liste: 'Liste',
    listeToast: 'Liste des e-mails',
    rapport: 'Rapport',
    rapportToast: 'Rapport sur les e-mails',
    analyser: 'Analyser maintenant',
    analyseToast: 'Analyse IA',
    connecterDabord: "Connectez d'abord votre boîte Gmail",
    connecterTitre: 'Connectez votre boîte Gmail',
    connecterTexte: "Fixy analysera automatiquement tous les e-mails reçus — urgences, types de demandes, suggestions d'actions et brouillons de réponse.",
    connecter: 'Connecter Gmail',
    integrationEnCours: 'Intégration Gmail en cours de développement',
  },
})
