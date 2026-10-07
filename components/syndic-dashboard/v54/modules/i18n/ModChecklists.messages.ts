import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut d'une checklist (valeur de l'API, envoyée telle quelle dans les deux langues). */
type EtatChecklist = 'em_curso' | 'concluida'

interface ChecklistsTextes {
  titre: string
  chapeau: string
  nouvelleChecklist: string
  kpi: { enCours: string; terminees: string; total: string }
  panneaux: { enCours: string; modeles: string; terminees: string }
  vides: { enCours: string; nouvelle: string; terminees: string }
  /** Modèles proposés : le titre choisi pré-remplit le formulaire (saisie de l'utilisateur). */
  modeles: string[]
  modale: {
    titre: string
    intitule: string
    intitulePlaceholder: string
    type: string
    typePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    etat: string
    etats: Record<EtatChecklist, string>
    items: string
    itemsAide: string
    itemsPlaceholder: string
    annuler: string
    creer: string
  }
  erreurs: { titre: string }
  toasts: {
    creee: string
    erreurCreation: string
    reessayerPlusTard: string
    creeeDemo: string
    connexionRequise: string
  }
}

export const CHECKLISTS_MESSAGES = defineMessages<ChecklistsTextes>({
  'pt-PT': {
    titre: 'Checklists Inteligentes com IA',
    chapeau: 'Processos padronizados — inspeções, AG, entradas/saídas, obras',
    nouvelleChecklist: '+ Nova Checklist',
    kpi: { enCours: 'Em Curso', terminees: 'Concluídas', total: 'Total' },
    panneaux: { enCours: 'Em Curso', modeles: 'Modelos', terminees: 'Concluídas' },
    vides: { enCours: 'Nenhuma checklist em curso', nouvelle: 'Nova', terminees: 'Nenhuma checklist concluída' },
    modeles: ['Inspeção periódica do edifício', 'Preparação de Assembleia Geral', 'Entrada / saída de fração', 'Acompanhamento de obras'],
    modale: {
      titre: 'Nova checklist',
      intitule: 'Título',
      intitulePlaceholder: 'Ex.: Inspeção periódica do edifício',
      type: 'Tipo',
      typePlaceholder: 'Inspeção, AG, obra…',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      etat: 'Estado',
      etats: { em_curso: 'Em curso', concluida: 'Concluída' },
      items: 'Itens',
      itemsAide: 'Um item por linha',
      itemsPlaceholder: 'Verificar extintores\nTestar iluminação de emergência\nInspecionar telhado',
      annuler: 'Cancelar',
      creer: 'Criar checklist',
    },
    erreurs: { titre: 'Indique o título da checklist.' },
    toasts: {
      creee: 'Checklist criada',
      erreurCreation: 'Erro ao criar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'Checklist criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Checklists intelligentes avec IA',
    chapeau: 'Procédures standardisées — visites, AG, mutations de lots, travaux',
    nouvelleChecklist: '+ Nouvelle checklist',
    kpi: { enCours: 'En cours', terminees: 'Terminées', total: 'Total' },
    panneaux: { enCours: 'En cours', modeles: 'Modèles', terminees: 'Terminées' },
    vides: { enCours: 'Aucune checklist en cours', nouvelle: 'Nouvelle', terminees: 'Aucune checklist terminée' },
    modeles: [
      "Visite périodique de l'immeuble",
      "Préparation de l'assemblée générale",
      'Mutation de lot (arrivée / départ)',
      'Suivi de chantier',
    ],
    modale: {
      titre: 'Nouvelle checklist',
      intitule: 'Intitulé',
      intitulePlaceholder: "Ex. : Visite périodique de l'immeuble",
      type: 'Type',
      typePlaceholder: 'Visite, AG, travaux…',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      etat: 'Statut',
      etats: { em_curso: 'En cours', concluida: 'Terminée' },
      items: 'Points de contrôle',
      itemsAide: 'Un point par ligne',
      itemsPlaceholder: "Vérifier les extincteurs\nTester l'éclairage de sécurité (BAES)\nInspecter la toiture",
      annuler: 'Annuler',
      creer: 'Créer la checklist',
    },
    erreurs: { titre: "Indiquez l'intitulé de la checklist." },
    toasts: {
      creee: 'Checklist créée',
      erreurCreation: 'Erreur lors de la création',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'Checklist créée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
