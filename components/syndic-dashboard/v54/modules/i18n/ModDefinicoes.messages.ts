import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Champ d'identité du cabinet (id HTML, libellé, valeur de démonstration, aide à la saisie). */
export interface ChampCabinet {
  id: string
  libelle: string
  valeur?: string
  autoComplete?: string
}

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
    /** Identité du cabinet : en France, avec les mentions professionnelles du syndic (loi Hoguet). */
    champs: ChampCabinet[]
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
      champs: [
        { id: 'def-nome', libelle: 'Nome do gabinete', valeur: 'VitFix Admin', autoComplete: 'name' },
        { id: 'def-email', libelle: 'Email', valeur: 'admincvlho@gmail.com', autoComplete: 'email' },
      ],
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
      // Loi n° 70-9 du 2 janvier 1970 (loi Hoguet), art. 3 : l'activité de syndic de copropriété exige
      // une carte professionnelle délivrée par la CCI, une garantie financière et une assurance de
      // responsabilité civile professionnelle. Données fictives (SIRET et n° de carte de démonstration).
      champs: [
        { id: 'def-nome', libelle: 'Nom du cabinet', valeur: 'Cabinet VitFix', autoComplete: 'name' },
        { id: 'def-email', libelle: 'E-mail', valeur: 'contact@exemple.fr', autoComplete: 'email' },
        { id: 'def-siret', libelle: 'SIRET', valeur: '492 118 332 00027' },
        { id: 'def-carte', libelle: 'N° de carte professionnelle (loi Hoguet)', valeur: 'CPI 6901 2026 000 012 345' },
        { id: 'def-garantie', libelle: 'Garantie financière', valeur: 'Caisse Rhodanienne — 120 000 €' },
        { id: 'def-rcp', libelle: 'Assurance RC professionnelle', valeur: 'Mutuelle Rhodanienne — RCP-2026-0412' },
      ],
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
