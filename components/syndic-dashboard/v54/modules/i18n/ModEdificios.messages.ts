import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Immeuble de démonstration : nom, adresse, lots, année de construction, prochaine
 * inspection, interventions en cours, dépenses, budget annuel, règlement présent.
 */
export type ImmeubleDemo = readonly [string, string, number, number, string, string, number, number, boolean]

interface EdificiosTextes {
  titre: string
  chapeau: (immeubles: number, lots: number) => string
  ajouterImmeuble: string
  kpi: {
    geres: string
    portefeuille: string
    lots: string
    totalLots: string
    interventions: string
    enCours: string
    documents: string
    reglementsAAjouter: string
  }
  carte: {
    nbLots: (n: number) => string
    construitEn: string
    reglementOk: string
    reglementManquant: string
    suspendu: string
    modifier: string
    reactiverAria: string
    suspendreAria: string
    reactiver: string
    suspendre: string
    suspendreAnonyme: string
    disponibleConnecte: string
    nouvelleMission: string
    lots: string
    totalLots: string
    construitEnStat: string
    interventions: string
    enCours: string
    prochaineInspection: string
    budget: string
    ajouterReglement: string
    coproprietaires: string
    documents: string
    historique: string
  }
  formulaire: {
    titreModifier: string
    titreAjouter: string
    nom: string
    nomPlaceholder: string
    adresse: string
    adressePlaceholder: string
    ville: string
    villePlaceholder: string
    codePostal: string
    codePostalPlaceholder: string
    nbLots: string
    budgetAnnuel: string
    annuler: string
    enregistrer: string
    ajouter: string
  }
  suspension: {
    titreReactiver: string
    titreSuspendre: string
    reactiverAvant: string
    reactiverApres: string
    suspendreAvant: string
    suspendreApres: string
    annuler: string
  }
  erreurNom: string
  toasts: {
    misAJour: string
    ajoute: string
    erreurMiseAJour: string
    erreurAjout: string
    reessayerPlusTard: string
    misAJourDemo: string
    ajouteDemo: string
    connexionRequise: string
    suspendu: string
    reactive: string
    erreur: string
    actionDemo: string
  }
  demo: ImmeubleDemo[]
}

export const EDIFICIOS_MESSAGES = defineMessages<EdificiosTextes>({
  'pt-PT': {
    titre: 'Edifícios',
    chapeau: (immeubles, lots) => `${immeubles} edifícios na sua carteira · ${lots} frações totais`,
    ajouterImmeuble: 'Adicionar um edifício',
    kpi: {
      geres: 'Edifícios geridos',
      portefeuille: 'Carteira ativa',
      lots: 'Frações totais',
      totalLots: 'Total de frações',
      interventions: 'Intervenções ativas',
      enCours: 'Em curso',
      documents: 'Documentos em falta',
      reglementsAAjouter: 'Regulamentos a adicionar',
    },
    carte: {
      nbLots: () => ' frações',
      construitEn: 'Construído em ',
      reglementOk: 'Regulamento OK',
      reglementManquant: 'Regulamento em falta',
      suspendu: 'Suspenso',
      modifier: 'Editar',
      reactiverAria: 'Reativar edifício',
      suspendreAria: 'Suspender edifício',
      reactiver: 'Reativar',
      suspendre: 'Suspender',
      suspendreAnonyme: 'Suspender edifício',
      disponibleConnecte: 'Disponível com sessão de síndico.',
      nouvelleMission: 'Nova missão',
      lots: 'Frações',
      totalLots: 'Total de frações',
      construitEnStat: 'Construído em',
      interventions: 'Intervenções',
      enCours: 'Em curso',
      prochaineInspection: 'Próxima inspeção',
      budget: 'Orçamento 2026',
      ajouterReglement: 'Adicionar o regulamento de condomínio',
      coproprietaires: 'Condóminos',
      documents: 'Documentos (GED)',
      historique: 'Histórico',
    },
    formulaire: {
      titreModifier: 'Editar edifício',
      titreAjouter: 'Adicionar edifício',
      nom: 'Nome do edifício',
      nomPlaceholder: 'Ex.: Edifício Aurora',
      adresse: 'Morada',
      adressePlaceholder: 'Rua, número',
      ville: 'Cidade',
      villePlaceholder: 'Porto',
      codePostal: 'Código postal',
      codePostalPlaceholder: '4000-000',
      nbLots: 'N.º de frações',
      budgetAnnuel: 'Orçamento anual (€)',
      annuler: 'Cancelar',
      enregistrer: 'Guardar',
      ajouter: 'Adicionar',
    },
    suspension: {
      titreReactiver: 'Reativar edifício',
      titreSuspendre: 'Suspender edifício',
      reactiverAvant: 'Reativar ',
      reactiverApres: ' na gestão ativa?',
      suspendreAvant: 'Suspender ',
      suspendreApres: ' da gestão ativa? O edifício e o seu histórico são conservados — pode reativá-lo a qualquer momento.',
      annuler: 'Cancelar',
    },
    erreurNom: 'O nome é obrigatório.',
    toasts: {
      misAJour: 'Edifício atualizado',
      ajoute: 'Edifício adicionado',
      erreurMiseAJour: 'Erro ao atualizar',
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      misAJourDemo: 'Edifício atualizado (demo)',
      ajouteDemo: 'Edifício adicionado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      suspendu: 'Edifício suspenso',
      reactive: 'Edifício reativado',
      erreur: 'Erro',
      actionDemo: 'Ação (demo)',
    },
    demo: [
      ['Edifício Atlântico', 'Avenida da Boavista, 1247, 4100-130 Porto', 12, 2008, '15/09', '8', 28450, 48000, false],
      ['Condomínio Boavista Center', 'Avenida da Boavista, 3265, 4100-138 Porto', 8, 2015, '30/06', '4', 18700, 36000, false],
      ['Residencial Cedofeita', 'Rua de Cedofeita, 421, 4050-180 Porto', 10, 1998, '22/04', '11', 33820, 42000, false],
      ['Edifício Foz Douro', 'Rua do Passeio Alegre, 78, 4150-573 Porto', 10, 2020, '10/01', '2', 21500, 62000, false],
    ],
  },
  'fr-FR': {
    titre: 'Immeubles',
    chapeau: (immeubles, lots) =>
      `${immeubles} immeuble${immeubles > 1 ? 's' : ''} dans votre portefeuille · ${lots} lot${lots > 1 ? 's' : ''} au total`,
    ajouterImmeuble: 'Ajouter un immeuble',
    kpi: {
      geres: 'Immeubles gérés',
      portefeuille: 'Portefeuille actif',
      lots: 'Lots au total',
      totalLots: 'Total des lots',
      interventions: 'Interventions actives',
      enCours: 'En cours',
      documents: 'Documents manquants',
      reglementsAAjouter: 'Règlements à ajouter',
    },
    carte: {
      nbLots: (n) => (n > 1 ? ' lots' : ' lot'),
      construitEn: 'Construit en ',
      reglementOk: 'Règlement fourni',
      reglementManquant: 'Règlement manquant',
      suspendu: 'Suspendu',
      modifier: 'Modifier',
      reactiverAria: "Réactiver l'immeuble",
      suspendreAria: "Suspendre l'immeuble",
      reactiver: 'Réactiver',
      suspendre: 'Suspendre',
      suspendreAnonyme: "Suspendre l'immeuble",
      disponibleConnecte: 'Disponible une fois connecté en tant que syndic.',
      nouvelleMission: 'Nouvelle mission',
      lots: 'Lots',
      totalLots: 'Total des lots',
      construitEnStat: 'Construit en',
      interventions: 'Interventions',
      enCours: 'En cours',
      prochaineInspection: 'Prochain contrôle',
      budget: 'Budget prévisionnel 2026',
      ajouterReglement: 'Ajouter le règlement de copropriété',
      coproprietaires: 'Copropriétaires',
      documents: 'Documents (GED)',
      historique: 'Historique',
    },
    formulaire: {
      titreModifier: "Modifier l'immeuble",
      titreAjouter: 'Ajouter un immeuble',
      nom: "Nom de l'immeuble",
      nomPlaceholder: 'Ex. : Résidence Aurore',
      adresse: 'Adresse',
      adressePlaceholder: 'Numéro, rue',
      ville: 'Ville',
      villePlaceholder: 'Lyon',
      codePostal: 'Code postal',
      codePostalPlaceholder: '69000',
      nbLots: 'Nombre de lots',
      budgetAnnuel: 'Budget prévisionnel annuel (€)',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
      ajouter: 'Ajouter',
    },
    suspension: {
      titreReactiver: "Réactiver l'immeuble",
      titreSuspendre: "Suspendre l'immeuble",
      reactiverAvant: 'Remettre ',
      reactiverApres: ' en gestion active ?',
      suspendreAvant: 'Retirer ',
      suspendreApres: " de la gestion active ? L'immeuble et son historique sont conservés — vous pourrez le réactiver à tout moment.",
      annuler: 'Annuler',
    },
    erreurNom: 'Le nom est obligatoire.',
    toasts: {
      misAJour: 'Immeuble mis à jour',
      ajoute: 'Immeuble ajouté',
      erreurMiseAJour: 'Erreur lors de la mise à jour',
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      misAJourDemo: 'Immeuble mis à jour (démonstration)',
      ajouteDemo: 'Immeuble ajouté (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      suspendu: 'Immeuble suspendu',
      reactive: 'Immeuble réactivé',
      erreur: 'Erreur',
      actionDemo: 'Action (démonstration)',
    },
    demo: [
      ['Résidence Atlantique', '124 avenue Jean Jaurès, 69007 Lyon', 12, 2008, '15/09', '8', 28450, 48000, false],
      ['Copropriété Bellecour Center', '18 place Bellecour, 69002 Lyon', 8, 2015, '30/06', '4', 18700, 36000, false],
      ['Résidence Croix-Rousse', '42 boulevard de la Croix-Rousse, 69004 Lyon', 10, 1998, '22/04', '11', 33820, 42000, false],
      ['Résidence Les Berges du Rhône', '78 quai Victor Augagneur, 69003 Lyon', 10, 2020, '10/01', '2', 21500, 62000, false],
    ],
  },
})
