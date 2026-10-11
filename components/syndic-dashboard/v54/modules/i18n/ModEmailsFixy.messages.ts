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
  /** Boutons de connexion, un par fournisseur (noms de marque, identiques FR / PT). */
  connecterMicrosoft: string
  connecterGmail: string
  integrationEnCours: string
  connexionEnCoursMicrosoft: string
  connexionEnCoursGmail: string
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
  /** E-mails laissés à la relève suivante (budget de temps du serveur). */
  releveReportes: string
  releveEchec: string
  releveReconnecter: string
  releveLectureImpossible: string
  deconnecter: string
  deconnexionTitre: string
  deconnexionTexte: string
  purgerEmails: string
  purgerAide: string
  annuler: string
  confirmerDeconnexion: string
  deconnexionEnCours: string
  deconnexionOk: string
  emailsEffaces: string
  deconnexionEchec: string
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
    connecterDabord: 'Ligue primeiro a sua caixa de email',
    connecterTitre: 'Ligue a sua caixa de email',
    connecterTexte: 'O Fixy irá analisar automaticamente todos os emails recebidos — urgências, tipos de pedido, sugestões de ações e rascunhos de resposta.',
    connecterMicrosoft: 'Outlook / Microsoft 365',
    connecterGmail: 'Gmail / Google Workspace',
    integrationEnCours: 'Integração da caixa de email em desenvolvimento',
    connexionEnCoursMicrosoft: 'A abrir a Microsoft…',
    connexionEnCoursGmail: 'A abrir o Google…',
    connexionEchec: 'Ligação da caixa de email impossível',
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
    releveReportes: 'por analisar — clique novamente',
    releveEchec: 'Análise impossível',
    releveReconnecter: 'A ligação à caixa de email expirou: volte a ligá-la.',
    releveLectureImpossible: 'Não foi possível ler a caixa de email.',
    deconnecter: 'Desligar',
    deconnexionTitre: 'Desligar a caixa de email?',
    deconnexionTexte: 'O Alfredo deixa de analisar esta caixa. Pode voltar a ligá-la a qualquer momento.',
    purgerEmails: 'Apagar também os emails analisados',
    purgerAide: 'Os emails de demonstração são mantidos.',
    annuler: 'Cancelar',
    confirmerDeconnexion: 'Desligar',
    deconnexionEnCours: 'A desligar…',
    deconnexionOk: 'Caixa desligada',
    emailsEffaces: 'emails apagados',
    deconnexionEchec: 'Não foi possível desligar a caixa',
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
    connecterDabord: "Connectez d'abord votre boîte e-mail",
    connecterTitre: 'Connectez votre boîte e-mail',
    connecterTexte: "Fixy analysera automatiquement tous les e-mails reçus — urgences, types de demandes, suggestions d'actions et brouillons de réponse.",
    connecterMicrosoft: 'Outlook / Microsoft 365',
    connecterGmail: 'Gmail / Google Workspace',
    integrationEnCours: 'Connexion de la boîte e-mail en cours de développement',
    connexionEnCoursMicrosoft: 'Ouverture de Microsoft…',
    connexionEnCoursGmail: 'Ouverture de Google…',
    connexionEchec: 'Connexion de la boîte e-mail impossible',
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
    releveReportes: 'restants — relancez l’analyse',
    releveEchec: 'Analyse impossible',
    releveReconnecter: 'La connexion à la boîte e-mail a expiré : reconnectez-la.',
    releveLectureImpossible: 'Lecture de la boîte e-mail impossible.',
    deconnecter: 'Déconnecter',
    deconnexionTitre: 'Déconnecter la boîte e-mail ?',
    deconnexionTexte: 'Alfredo cesse d’analyser cette boîte. Vous pourrez la reconnecter à tout moment.',
    purgerEmails: 'Effacer aussi les e-mails analysés',
    purgerAide: 'Les e-mails de démonstration sont conservés.',
    annuler: 'Annuler',
    confirmerDeconnexion: 'Déconnecter',
    deconnexionEnCours: 'Déconnexion…',
    deconnexionOk: 'Boîte déconnectée',
    emailsEffaces: 'e-mails effacés',
    deconnexionEchec: 'Déconnexion de la boîte impossible',
    localeDate: 'fr-FR',
  },
})
