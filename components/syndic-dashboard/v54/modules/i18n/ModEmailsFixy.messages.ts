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
  connexionEnCours: string
  connexionEchec: string
  boiteConnectee: string
  emailsAnalyses: string
  brouillonsAValider: string
  derniersEmails: string
  aucunEmail: string
  sansObjet: string
  brouillonAValider: string
  releveEnCours: string
  releveOk: string
  releveNouveaux: string
  releveLus: string
  releveEchec: string
  localeDate: string
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
    connexionEnCours: 'A abrir o Google…',
    connexionEchec: 'Ligação Gmail impossível',
    boiteConnectee: 'Caixa ligada:',
    emailsAnalyses: 'emails analisados',
    brouillonsAValider: 'rascunhos a validar',
    derniersEmails: 'Últimos emails analisados pelo Alfredo',
    aucunEmail: 'Ainda nenhum email analisado — clique em « Analisar agora ».',
    sansObjet: '(sem assunto)',
    brouillonAValider: 'Rascunho a validar',
    releveEnCours: 'Análise em curso…',
    releveOk: 'Caixa analisada',
    releveNouveaux: 'novos emails',
    releveLus: 'lidos',
    releveEchec: 'Análise impossível',
    localeDate: 'pt-PT',
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
    connexionEnCours: 'Ouverture de Google…',
    connexionEchec: 'Connexion Gmail impossible',
    boiteConnectee: 'Boîte connectée :',
    emailsAnalyses: 'e-mails analysés',
    brouillonsAValider: 'brouillons à valider',
    derniersEmails: 'Derniers e-mails analysés par Alfredo',
    aucunEmail: 'Aucun e-mail analysé pour l’instant — cliquez sur « Analyser maintenant ».',
    sansObjet: '(sans objet)',
    brouillonAValider: 'Brouillon à valider',
    releveEnCours: 'Analyse en cours…',
    releveOk: 'Boîte analysée',
    releveNouveaux: 'nouveaux e-mails',
    releveLus: 'lus',
    releveEchec: 'Analyse impossible',
    localeDate: 'fr-FR',
  },
})
