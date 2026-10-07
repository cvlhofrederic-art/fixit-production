import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes de l'écran « Gestão de Elevadores » / « Gestion des ascenseurs ».
 * FR : code de la construction et de l'habitation, art. L134-1 et s. et R134-1 et s.
 * (dispositions issues du décret n° 2004-964 du 9 septembre 2004) :
 *  - entretien : visite au plus toutes les six semaines (CCH art. R134-6), en pratique
 *    confié par contrat écrit à un ascensoriste ;
 *  - contrôle technique tous les cinq ans par un contrôleur indépendant, rapport remis
 *    au propriétaire dans le mois (CCH art. R134-11) ;
 *  - défauts présentant un danger repérés par le contrôle : mesures d'entretien
 *    spécifiques (CCH art. R134-6). Aucune déclaration à la mairie (spécificité PT).
 * Les codes de catégorie (comercial / misto / habitacional) et d'état (conforme /
 * prazo / atraso) restent les valeurs de l'API ; seuls les libellés changent.
 */

/** Étape de la procédure « risque grave » / « défaut dangereux » : [numéro, titre, détail]. */
export type EtapeProcedure = [string, string, string]

interface ElevadoresTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrer: string
  importerRapport: string
  alerte: {
    titre: string
    /** Trois lignes : partie en gras, puis suite. */
    lignes: [[string, string], [string, string], [string, string]]
    /** Dernière ligne : texte, partie en gras, ponctuation finale. */
    finAvant: string
    finFort: string
    finApres: string
  }
  kpi: {
    enregistres: string
    conformes: string
    prochesEcheance: string
    enRetard: string
    contrats: string
    signalements: string
  }
  onglets: {
    ascenseurs: (n: number) => string
    controles: string
    contrats: (n: number) => string
    risques: string
  }
  colonnes: {
    immeuble: string
    marque: string
    categorie: string
    periodicite: string
    dernier: string
    prochain: string
    entretien: string
    etat: string
  }
  aucunAscenseur: string
  categories: Record<string, string>
  periodicites: Record<string, string>
  etats: { atraso: string; prazo: string; conforme: string }
  procedure: { titre: string; sousTitre: string; etapes: EtapeProcedure[] }
  formulaire: {
    titre: string
    immeuble: string
    nomImmeuble: string
    marque: string
    marqueExemple: string
    categorie: string
    optionsCategorie: { comercial: string; misto: string; habitacional: string }
    etat: string
    optionsEtat: { conforme: string; prazo: string; atraso: string }
    entretien: string
    entretienExemple: string
    dernier: string
    prochain: string
    formatDate: string
    annuler: string
    enregistrer: string
  }
  erreurs: { immeuble: string }
  toasts: {
    enregistre: string
    erreur: string
    reessayerPlusTard: string
    enregistreDemo: string
    connexionRequise: string
  }
}

export const ELEVADORES_MESSAGES = defineMessages<ElevadoresTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · DL 320/2002 + LEI 65/2013',
    titre: 'Gestão de Elevadores',
    chapeau: 'Contrato EMA obrigatório · Inspeções periódicas 2/4/6 anos · Comunicação Câmara em 48h se risco grave',
    enregistrer: '+ Registar elevador',
    importerRapport: 'Upload relatório inspeção',
    alerte: {
      titre: 'Periodicidade obrigatória das inspeções — Art. 8.° DL 320/2002',
      lignes: [
        ['2 anos', ' — edifícios comerciais ou serviços abertos ao público.'],
        ['4 anos', ' — edifícios mistos ou habitacionais com > 32 fogos / > 8 pisos.'],
        ['6 anos', ' — outros edifícios habitacionais.'],
      ],
      finAvant: 'Coimas em caso de incumprimento: ',
      finFort: '250 € a 5 000 €',
      finApres: '.',
    },
    kpi: {
      enregistres: 'Elevadores registados',
      conformes: 'Em conformidade',
      prochesEcheance: 'Próximos do prazo (≤ 90d)',
      enRetard: 'Inspeção em atraso',
      contrats: 'EMAs ativas',
      signalements: 'Comunicações Câmara 48h',
    },
    onglets: {
      ascenseurs: (n) => `Elevadores (${n})`,
      controles: 'Inspeções (0)',
      contrats: (n) => `Contratos EMA (${n})`,
      risques: 'Comunicações risco grave',
    },
    colonnes: {
      immeuble: 'Edifício',
      marque: 'Marca/Modelo',
      categorie: 'Categoria',
      periodicite: 'Periodicidade',
      dernier: 'Última inspeção',
      prochain: 'Próxima inspeção',
      entretien: 'EMA',
      etat: 'Estado',
    },
    aucunAscenseur: 'Nenhum elevador registado. Registe o primeiro elevador.',
    categories: { comercial: 'Comercial', misto: 'Misto', habitacional: 'Habitacional' },
    periodicites: { comercial: '2 anos', misto: '4 anos', habitacional: '6 anos' },
    etats: { atraso: 'Em atraso', prazo: 'Próximo', conforme: 'Conforme' },
    procedure: {
      titre: 'Workflow risco grave — 48h',
      sousTitre: 'DL 320/2002 art. 22.° + Lei 65/2013',
      etapes: [
        ['1', 'EMA deteta risco grave', 'Travagem · cabos · porta · botoneira'],
        ['2', 'EMA notifica administrador', 'Email/SMS automático · prazo 24h'],
        ['3', 'Administrador notifica Câmara', 'Template auto-gerado · enviado em 48h'],
        ['4', 'Sinalização elevador fora serviço', 'Cartaz auto-gerado em PDF'],
        ['5', 'Acompanhamento até reparação', 'Predição Manutenção atualiza'],
      ],
    },
    formulaire: {
      titre: 'Registar elevador',
      immeuble: 'Edifício',
      nomImmeuble: 'Nome do edifício',
      marque: 'Marca / Modelo',
      marqueExemple: 'Ex.: Otis Gen2',
      categorie: 'Categoria',
      optionsCategorie: { comercial: 'Comercial (2 anos)', misto: 'Misto (4 anos)', habitacional: 'Habitacional (6 anos)' },
      etat: 'Estado',
      optionsEtat: { conforme: 'Conforme', prazo: 'Próximo do prazo', atraso: 'Em atraso' },
      entretien: 'EMA (entidade de manutenção)',
      entretienExemple: 'Ex.: Otis Manutenção, Lda.',
      dernier: 'Última inspeção',
      prochain: 'Próxima inspeção',
      formatDate: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: { immeuble: 'O edifício é obrigatório.' },
    toasts: {
      enregistre: 'Elevador registado',
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreDemo: 'Elevador registado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    surtitre: 'OBLIGATION LÉGALE · CCH, ART. L134-1 ET R134-1 ET S.',
    titre: 'Gestion des ascenseurs',
    chapeau: "Contrat d'entretien écrit · Visite au moins toutes les 6 semaines · Contrôle technique tous les 5 ans",
    enregistrer: '+ Enregistrer un ascenseur',
    importerRapport: 'Importer un rapport de contrôle',
    alerte: {
      titre: 'Obligations périodiques — CCH, art. R134-1 et suivants',
      lignes: [
        ['6 semaines', " — intervalle maximal entre deux visites d'entretien de l'ascensoriste (contrat d'entretien écrit)."],
        ['5 ans', " — contrôle technique par un contrôleur indépendant, quel que soit le type d'immeuble."],
        ['Chaque année', " — rapport d'activité remis par l'ascensoriste, reprenant le carnet d'entretien de l'appareil."],
      ],
      finAvant: 'Rapport du contrôle technique remis au syndicat ',
      finFort: 'dans le mois',
      finApres: ' suivant le contrôle.',
    },
    kpi: {
      enregistres: 'Ascenseurs enregistrés',
      conformes: 'En conformité',
      prochesEcheance: 'Échéance proche (≤ 90 j)',
      enRetard: 'Contrôle en retard',
      contrats: "Contrats d'entretien actifs",
      signalements: 'Défauts dangereux signalés',
    },
    onglets: {
      ascenseurs: (n) => `Ascenseurs (${n})`,
      controles: 'Contrôles techniques (0)',
      contrats: (n) => `Contrats d'entretien (${n})`,
      risques: 'Défauts dangereux',
    },
    colonnes: {
      immeuble: 'Immeuble',
      marque: 'Marque / modèle',
      categorie: 'Catégorie',
      periodicite: 'Périodicité',
      dernier: 'Dernier contrôle',
      prochain: 'Prochain contrôle',
      entretien: 'Ascensoriste',
      etat: 'État',
    },
    aucunAscenseur: 'Aucun ascenseur enregistré. Enregistrez le premier ascenseur.',
    categories: { comercial: 'Commerces / bureaux', misto: 'Mixte', habitacional: 'Habitation' },
    periodicites: { comercial: '5 ans', misto: '5 ans', habitacional: '5 ans' },
    etats: { atraso: 'En retard', prazo: 'Échéance proche', conforme: 'Conforme' },
    procedure: {
      titre: 'Procédure en cas de défaut dangereux',
      sousTitre: 'CCH, art. R134-6 et R134-11',
      etapes: [
        ['1', "Le contrôleur ou l'ascensoriste repère un défaut dangereux", 'Freinage · câbles · portes palières · boîte à boutons'],
        ['2', "L'ascensoriste prévient le syndic", "E-mail / SMS automatique · mise à l'arrêt de l'appareil si nécessaire"],
        ['3', 'Le syndic informe les occupants', 'Avis généré automatiquement · affiché dans le hall'],
        ['4', 'Affichage « ascenseur hors service »', 'Affiche générée automatiquement en PDF'],
        ['5', "Suivi jusqu'à la remise en service", 'Mise à jour de la maintenance prédictive'],
      ],
    },
    formulaire: {
      titre: 'Enregistrer un ascenseur',
      immeuble: 'Immeuble',
      nomImmeuble: "Nom de l'immeuble",
      marque: 'Marque / modèle',
      marqueExemple: 'Ex. : Otis Gen2',
      categorie: 'Catégorie',
      optionsCategorie: { comercial: 'Commerces / bureaux', misto: 'Mixte', habitacional: 'Habitation' },
      etat: 'État',
      optionsEtat: { conforme: 'Conforme', prazo: 'Échéance proche', atraso: 'En retard' },
      entretien: "Ascensoriste (contrat d'entretien)",
      entretienExemple: 'Ex. : Ascenseurs Lyonnais',
      dernier: 'Dernier contrôle technique',
      prochain: 'Prochain contrôle technique',
      formatDate: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: { immeuble: "L'immeuble est obligatoire." },
    toasts: {
      enregistre: 'Ascenseur enregistré',
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreDemo: 'Ascenseur enregistré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
