import { defineMessages } from '@/lib/syndic/v54/i18n'

interface DefinicoesTextes {
  titre: string
  chapeau: string
  abonnement: {
    titre: string
    essai: string
    restant: string
    pastille: string
    choisir: string
    formules: string
  }
  agentEmail: { titre: string; sousTitre: string; connecter: string; connecterToast: string; integrationEnCours: string }
  profil: {
    titre: string
    nom: string
    role: string
    signature: string
    dessiner: string
    dessinerToast: string
    aucuneTitre: string
    aucuneTexte: string
    enregistrer: string
  }
  cabinet: {
    titre: string
    nom: string
    nomValeur: string
    email: string
    emailValeur: string
    adresse: string
    adressePlaceholder: string
    logo: string
    importerLogo: string
    importerLogoToast: string
  }
  notifications: { titre: string; liste: ReadonlyArray<readonly [string, boolean]> }
}

export const DEFINICOES_MESSAGES = defineMessages<DefinicoesTextes>({
  'pt-PT': {
    titre: 'Definições',
    chapeau: 'Conta, perfil, gabinete e notificações',
    abonnement: {
      titre: 'Subscrição',
      essai: 'Teste gratuito',
      restant: '30 dias restantes · Acesso completo',
      pastille: 'TRIAL',
      choisir: 'Escolher uma subscrição → a partir de 49 €/mês',
      formules: 'Planos a partir de 49 €/mês — em breve',
    },
    agentEmail: {
      titre: 'Agente Email Fixy',
      sousTitre: 'Conecte a sua caixa Gmail para que o Fixy analise automaticamente os seus emails: urgências, tipos de pedidos, sugestões de ações.',
      connecter: 'Ligar a sua caixa Gmail',
      connecterToast: 'Ligar Gmail',
      integrationEnCours: 'Integração Gmail em desenvolvimento',
    },
    profil: {
      titre: 'O Meu Perfil',
      nom: 'Super Admin VitFix',
      role: 'Administrador',
      signature: 'A minha assinatura digital',
      dessiner: 'Desenhar a minha assinatura',
      dessinerToast: 'Desenhar assinatura',
      aucuneTitre: 'Nenhuma assinatura configurada',
      aucuneTexte: 'Os PDFs gerados não terão assinatura.',
      enregistrer: 'Guardar assinatura',
    },
    cabinet: {
      titre: 'O Meu Gabinete',
      nom: 'Nome do gabinete',
      nomValeur: 'VitFix Admin',
      email: 'Email',
      emailValeur: 'admincvlho@gmail.com',
      adresse: 'Morada do gabinete',
      adressePlaceholder: 'Ex: Rua das Flores 123, 1000-001 Lisboa',
      logo: 'Logo do gabinete',
      importerLogo: 'Carregar logo (PNG/JPG/WebP, max 2 MB)',
      importerLogoToast: 'Carregar logo',
    },
    notifications: {
      titre: 'Notificações',
      liste: [
        ['Alertas Seguro RC expirado', true],
        ['Controlos regulamentares iminentes', true],
        ['Novas missões criadas', true],
        ['Sinalizações de condóminos', false],
        ['Resumo semanal', true],
      ],
    },
  },
  'fr-FR': {
    titre: 'Paramètres',
    chapeau: 'Compte, profil, cabinet et notifications',
    abonnement: {
      titre: 'Abonnement',
      essai: 'Essai gratuit',
      restant: '30 jours restants · Accès complet',
      pastille: 'ESSAI',
      choisir: 'Choisir un abonnement → à partir de 49 €/mois',
      formules: 'Formules à partir de 49 €/mois — bientôt disponibles',
    },
    agentEmail: {
      titre: 'Agent e-mail Fixy',
      sousTitre: "Connectez votre boîte Gmail pour que Fixy analyse automatiquement vos e-mails : urgences, types de demandes, suggestions d'actions.",
      connecter: 'Connecter votre boîte Gmail',
      connecterToast: 'Connecter Gmail',
      integrationEnCours: 'Intégration Gmail en cours de développement',
    },
    profil: {
      titre: 'Mon profil',
      nom: 'Super Admin VitFix',
      role: 'Administrateur',
      signature: 'Ma signature numérique',
      dessiner: 'Dessiner ma signature',
      dessinerToast: 'Dessiner la signature',
      aucuneTitre: 'Aucune signature configurée',
      aucuneTexte: 'Les PDF générés ne comporteront pas de signature.',
      enregistrer: 'Enregistrer la signature',
    },
    cabinet: {
      titre: 'Mon cabinet',
      nom: 'Nom du cabinet',
      nomValeur: 'Cabinet VitFix',
      // Adresse fictive de démonstration : l'adresse personnelle de la version PT n'est pas reprise.
      email: 'E-mail',
      emailValeur: 'contact@exemple.fr',
      adresse: 'Adresse du cabinet',
      adressePlaceholder: 'Ex. : 12 rue de la République, 69002 Lyon',
      logo: 'Logo du cabinet',
      importerLogo: 'Importer le logo (PNG/JPG/WebP, 2 Mo max)',
      importerLogoToast: 'Importer le logo',
    },
    notifications: {
      titre: 'Notifications',
      liste: [
        ["Alertes d'expiration de l'assurance RC", true],
        ['Contrôles réglementaires imminents', true],
        ['Nouvelles missions créées', true],
        ['Signalements des copropriétaires', false],
        ['Synthèse hebdomadaire', true],
      ],
    },
  },
})
