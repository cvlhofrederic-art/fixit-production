import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Fonction d'un membre de l'équipe du cabinet (code interne ; le libellé dépend de la langue). */
export type RoleEquipe = 'admin' | 'gestorTecnico' | 'tecnico' | 'secretaria' | 'gestorCondominio' | 'contabilista' | 'jurista'

/** Membre de démonstration : initiales, nom, e-mail, fonction, modules, couleur d'avatar. */
export interface MembreDemo {
  initiales: string
  nom: string
  email: string
  role: RoleEquipe
  modules: string
  couleur: 'gold' | 'sage'
}

interface EquipaTextes {
  titre: string
  chapeau: (n: number) => string
  inviter: string
  colonnes: { membre: string; fonction: string; modules: string; statut: string; actions: string }
  nbModules: (n: number) => string
  tousModules: string
  actif: string
  suspendu: string
  suspendre: string
  supprimer: string
  roles: Record<RoleEquipe, string>
  descriptions: Record<RoleEquipe, string>
  panneauRoles: { titre: string; sousTitre: string }
  suppression: { titre: string; avant: string; apres: string; annuler: string; confirmer: string }
  invitation: {
    titre: string
    nomComplet: string
    nomPlaceholder: string
    email: string
    emailPlaceholder: string
    fonction: string
    annuler: string
    envoyer: string
  }
  erreurs: { nom: string; email: string }
  toasts: {
    suspendu: string
    erreurSuspension: string
    reessayerPlusTard: string
    suspenduDemo: string
    connexionRequise: string
    supprime: string
    erreurSuppression: string
    supprimeDemo: string
    invitationEnvoyee: string
    erreurInvitation: string
    verifierEmail: string
    invitationDemo: string
  }
  demo: MembreDemo[]
}

export const EQUIPA_MESSAGES = defineMessages<EquipaTextes>({
  'pt-PT': {
    titre: 'A Minha Equipa',
    chapeau: (n) => `${n} membros no seu gabinete`,
    inviter: 'Convidar um membro',
    colonnes: { membre: 'Membro', fonction: 'Função', modules: 'Módulos', statut: 'Estado', actions: 'Ações' },
    nbModules: (n) => `${n} módulos`,
    tousModules: 'Todos os módulos',
    actif: 'Ativo',
    suspendu: 'Suspenso',
    suspendre: 'Suspender',
    supprimer: 'Eliminar',
    roles: {
      admin: 'Administrador',
      gestorTecnico: 'Gestor Técnico',
      tecnico: 'Técnico',
      secretaria: 'Secretária',
      gestorCondominio: 'Gestor de Condomínio',
      contabilista: 'Contabilista',
      jurista: 'Jurista',
    },
    descriptions: {
      admin: 'Acesso total: gestão, configuração, equipa, faturação',
      gestorTecnico: 'Missões, profissionais, planeamento, contabilidade técnica das intervenções',
      tecnico: 'Prestador interno do gabinete (homem dos sete ofícios) — executa reparações correntes, pequenas intervenções e manutenção no terreno',
      secretaria: 'Condóminos, planeamento, e-mails, documentos',
      gestorCondominio: 'Edifícios, missões, profissionais, alertas, calendário regulamentar',
      contabilista: 'Faturação, relatório mensal, documentos financeiros',
      jurista: 'Contencioso, recuperação de dívidas, sinistros, conformidade jurídica, AG',
    },
    panneauRoles: { titre: 'Descrição das funções', sousTitre: 'Cada função desbloqueia um conjunto específico de módulos' },
    suppression: {
      titre: 'Eliminar membro',
      avant: 'Tem a certeza que pretende eliminar ',
      apres: ' da sua equipa? Esta ação é irreversível.',
      annuler: 'Cancelar',
      confirmer: 'Eliminar',
    },
    invitation: {
      titre: 'Convidar um membro',
      nomComplet: 'Nome completo',
      nomPlaceholder: 'Nome do membro',
      email: 'E-mail',
      emailPlaceholder: 'nome@gabinete.pt',
      fonction: 'Função',
      annuler: 'Cancelar',
      envoyer: 'Enviar convite',
    },
    erreurs: { nom: 'O nome é obrigatório.', email: 'O e-mail é obrigatório.' },
    toasts: {
      suspendu: 'Membro suspenso',
      erreurSuspension: 'Erro ao suspender',
      reessayerPlusTard: 'Tente novamente mais tarde',
      suspenduDemo: 'Membro suspenso (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      supprime: 'Membro eliminado',
      erreurSuppression: 'Erro ao eliminar',
      supprimeDemo: 'Membro eliminado (demo)',
      invitationEnvoyee: 'Convite enviado',
      erreurInvitation: 'Erro ao convidar',
      verifierEmail: 'Verifique o e-mail e tente novamente',
      invitationDemo: 'Convite enviado (demo)',
    },
    demo: [
      { initiales: 'HC', nom: 'Helena Carvalho', email: 'admin@gabinete-vitfix.pt', role: 'admin', modules: '97/86', couleur: 'gold' },
      { initiales: 'BT', nom: 'Bruno Tavares', email: 'bruno.tavares@gabinete-vitfix.pt', role: 'gestorTecnico', modules: '55/86', couleur: 'sage' },
      { initiales: 'DP', nom: 'Diogo Pereira', email: 'diogo.pereira@gabinete-vitfix.pt', role: 'tecnico', modules: '15/86', couleur: 'sage' },
      { initiales: 'TM', nom: 'Tiago Mendes', email: 'tiago.mendes@gabinete-vitfix.pt', role: 'tecnico', modules: '15/86', couleur: 'sage' },
      { initiales: 'MS', nom: 'Margarida Sousa', email: 'secretaria@gabinete-vitfix.pt', role: 'secretaria', modules: '41/86', couleur: 'sage' },
      { initiales: 'RA', nom: 'Ricardo Almeida', email: 'contabilidade@gabinete-vitfix.pt', role: 'contabilista', modules: '49/86', couleur: 'sage' },
      { initiales: 'IM', nom: 'Inês Monteiro', email: 'juridico@gabinete-vitfix.pt', role: 'jurista', modules: '32/86', couleur: 'sage' },
    ],
  },
  'fr-FR': {
    titre: 'Mon équipe',
    chapeau: (n) => `${n} membre${n > 1 ? 's' : ''} dans votre cabinet`,
    inviter: 'Inviter un membre',
    colonnes: { membre: 'Membre', fonction: 'Fonction', modules: 'Modules', statut: 'Statut', actions: 'Actions' },
    nbModules: (n) => `${n} module${n > 1 ? 's' : ''}`,
    tousModules: 'Tous les modules',
    actif: 'Actif',
    suspendu: 'Suspendu',
    suspendre: 'Suspendre',
    supprimer: 'Supprimer',
    roles: {
      admin: 'Administrateur',
      gestorTecnico: 'Gestionnaire technique',
      tecnico: 'Technicien',
      secretaria: 'Assistante',
      gestorCondominio: 'Gestionnaire de copropriété',
      contabilista: 'Comptable',
      jurista: 'Juriste',
    },
    descriptions: {
      admin: 'Accès complet : gestion, paramétrage, équipe, facturation',
      gestorTecnico: 'Missions, prestataires, planning, comptabilité technique des interventions',
      tecnico: "Intervenant interne du cabinet (agent polyvalent) — assure les réparations courantes, les petites interventions et l'entretien sur le terrain",
      secretaria: 'Copropriétaires, planning, e-mails, documents',
      gestorCondominio: 'Immeubles, missions, prestataires, alertes, calendrier réglementaire',
      contabilista: 'Facturation, rapport mensuel, documents financiers',
      jurista: 'Contentieux, recouvrement des impayés, sinistres, conformité juridique, AG',
    },
    panneauRoles: { titre: 'Description des fonctions', sousTitre: 'Chaque fonction donne accès à un ensemble précis de modules' },
    suppression: {
      titre: 'Supprimer le membre',
      avant: 'Voulez-vous vraiment supprimer ',
      apres: ' de votre équipe ? Cette action est irréversible.',
      annuler: 'Annuler',
      confirmer: 'Supprimer',
    },
    invitation: {
      titre: 'Inviter un membre',
      nomComplet: 'Nom complet',
      nomPlaceholder: 'Nom du membre',
      email: 'E-mail',
      emailPlaceholder: 'prenom.nom@exemple.fr',
      fonction: 'Fonction',
      annuler: 'Annuler',
      envoyer: "Envoyer l'invitation",
    },
    erreurs: { nom: 'Le nom est obligatoire.', email: "L'adresse e-mail est obligatoire." },
    toasts: {
      suspendu: 'Membre suspendu',
      erreurSuspension: 'Erreur lors de la suspension',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      suspenduDemo: 'Membre suspendu (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      supprime: 'Membre supprimé',
      erreurSuppression: 'Erreur lors de la suppression',
      supprimeDemo: 'Membre supprimé (démonstration)',
      invitationEnvoyee: 'Invitation envoyée',
      erreurInvitation: "Erreur lors de l'envoi de l'invitation",
      verifierEmail: "Vérifiez l'adresse e-mail et réessayez",
      invitationDemo: 'Invitation envoyée (démonstration)',
    },
    demo: [
      { initiales: 'HC', nom: 'Hélène Carpentier', email: 'direction@cabinet-vitfix.fr', role: 'admin', modules: '97/86', couleur: 'gold' },
      { initiales: 'BT', nom: 'Bruno Tessier', email: 'bruno.tessier@cabinet-vitfix.fr', role: 'gestorTecnico', modules: '55/86', couleur: 'sage' },
      { initiales: 'DP', nom: 'Damien Perrin', email: 'damien.perrin@cabinet-vitfix.fr', role: 'tecnico', modules: '15/86', couleur: 'sage' },
      { initiales: 'TM', nom: 'Thomas Ménard', email: 'thomas.menard@cabinet-vitfix.fr', role: 'tecnico', modules: '15/86', couleur: 'sage' },
      { initiales: 'MS', nom: 'Marguerite Soulier', email: 'secretariat@cabinet-vitfix.fr', role: 'secretaria', modules: '41/86', couleur: 'sage' },
      { initiales: 'RA', nom: 'Richard Aubry', email: 'comptabilite@cabinet-vitfix.fr', role: 'contabilista', modules: '49/86', couleur: 'sage' },
      { initiales: 'IM', nom: 'Inès Monnier', email: 'juridique@cabinet-vitfix.fr', role: 'jurista', modules: '32/86', couleur: 'sage' },
    ],
  },
})
