import { defineMessages } from '@/lib/syndic/v54/i18n'

interface AcessibilidadeTextes {
  surtitre: string
  titre: string
  chapeau: string
  importerPhotos: string
  bientotPhotos: string
  analyseIA: string
  alerteTitre: string
  alerteTexte: string
  kpi: { evalues: string; conformes: string; nonConformes: string; enPlan: string; investissement: string; diagnostics: string }
  onglets: { ed: string; chk: string; plano: string }
  videTitre: string
  videDesc: string
  lancerEvaluation: string
  criteresTitre: string
  /** Critères affichés : [intitulé, précision], dans l'ordre des couleurs. */
  criteres: [string, string][]
  modale: {
    titre: string
    immeuble: string
    immeublePlaceholder: string
    observations: string
    observationsPlaceholder: string
    fermer: string
    enCours: string
    relancer: string
    analyser: string
  }
  toasts: {
    immeubleTitre: string
    immeubleDesc: string
    connexionTitre: string
    connexionDesc: string
    erreurTitre: string
    erreurDesc: string
  }
}

export const ACESSIBILIDADE_MESSAGES = defineMessages<AcessibilidadeTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · DL 163/2006',
    titre: 'Acessibilidade dos Edifícios',
    chapeau: 'Checklist 23 critérios · Análise IA fotografias por Alfredo · Plano de conformidade · Atestação PDF',
    importerPhotos: 'Upload fotos do edifício',
    bientotPhotos: 'Upload de fotos',
    analyseIA: 'Análise IA Alfredo',
    alerteTitre: 'Decreto-Lei n.° 163/2006 de 8 de agosto',
    alerteTexte: 'Todos os edifícios construídos ou objeto de reabilitação após 22 de agosto de 2007 devem cumprir as normas técnicas de acessibilidade. O administrador deve poder atestar a conformidade ou apresentar plano de correção.',
    kpi: { evalues: 'Edifícios avaliados', conformes: 'Conformes', nonConformes: 'Não conformes', enPlan: 'Em plano correção', investissement: 'Investimento estimado', diagnostics: 'Diagnósticos IA Alfredo' },
    onglets: { ed: 'Edifícios (0)', chk: 'Checklist 23 critérios', plano: 'Planos de correção' },
    videTitre: 'Nenhum edifício avaliado',
    videDesc: 'Faça upload de fotografias e plantas. Alfredo deteta automaticamente: rampas, larguras de portas, casas de banho adaptadas, sinalética, percursos acessíveis.',
    lancerEvaluation: 'Iniciar avaliação IA',
    criteresTitre: 'Critérios DL 163/2006 — Edifícios Habitacionais',
    criteres: [
      ['Rampas exteriores (inclinação ≤ 6%)', 'Acessos ao edifício'],
      ['Largura portas (≥ 0.77m)', 'Entrada + frações'],
      ['Elevador acessível', 'Cabine ≥ 1.10×1.40m'],
      ['Casa de banho adaptada', 'Partes comuns'],
      ['Sinalética tátil', 'Botoneira + andares'],
      ['Percurso acessível contínuo', 'Sem obstáculos'],
    ],
    modale: {
      titre: 'Análise de acessibilidade (Alfredo)',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Nome do edifício',
      observations: 'Observações (opcional)',
      observationsPlaceholder: 'Ex.: sem rampa na entrada, elevador estreito…',
      fermer: 'Fechar',
      enCours: 'A analisar…',
      relancer: 'Reanalisar',
      analyser: 'Analisar',
    },
    toasts: {
      immeubleTitre: 'Edifício',
      immeubleDesc: 'Indique o edifício.',
      connexionTitre: 'Análise IA Alfredo',
      connexionDesc: 'Conecte-se como síndico para usar o Alfredo.',
      erreurTitre: 'Erro',
      erreurDesc: 'Não foi possível analisar a acessibilidade.',
    },
  },
  'fr-FR': {
    surtitre: 'CADRE LÉGAL · LOI N° 2005-102 · CCH',
    titre: 'Accessibilité des parties communes',
    chapeau: 'Grille de critères · Analyse IA des photos par Alfredo · Plan de mise en accessibilité · Rapport PDF',
    importerPhotos: "Importer des photos de l'immeuble",
    bientotPhotos: 'Import de photos',
    analyseIA: 'Analyse IA Alfredo',
    alerteTitre: 'Loi n° 2005-102 du 11 février 2005 et loi du 10 juillet 1965',
    alerteTexte: "Les règles d'accessibilité du Code de la construction et de l'habitation s'imposent aux bâtiments d'habitation collectifs neufs et à certains travaux réalisés dans les bâtiments existants. En copropriété, les travaux d'accessibilité qui n'affectent ni la structure de l'immeuble ni ses éléments d'équipement essentiels sont votés à la majorité de l'article 24 de la loi du 10 juillet 1965. Un copropriétaire peut aussi faire réaliser à ses frais des travaux d'accessibilité affectant les parties communes ou l'aspect extérieur de l'immeuble ; l'assemblée générale ne peut s'y opposer que par une décision motivée prise à la majorité de l'article 25 (article 25-2).",
    kpi: { evalues: 'Immeubles évalués', conformes: 'Conformes', nonConformes: 'Non conformes', enPlan: 'Mise en accessibilité en cours', investissement: 'Investissement estimé', diagnostics: 'Diagnostics IA Alfredo' },
    onglets: { ed: 'Immeubles (0)', chk: 'Grille des critères', plano: 'Plans de mise en accessibilité' },
    videTitre: 'Aucun immeuble évalué',
    videDesc: 'Importez des photos et des plans. Alfredo repère automatiquement : rampes, largeur des portes, ascenseur, signalétique, cheminements accessibles.',
    lancerEvaluation: "Lancer l'évaluation IA",
    criteresTitre: "Critères d'accessibilité — bâtiments d'habitation collectifs",
    criteres: [
      ['Cheminement extérieur et rampes', "Accès à l'immeuble"],
      ['Largeur de passage des portes', 'Entrée + logements'],
      ['Ascenseur accessible', 'Dimensions de cabine et commandes'],
      ['Éclairage des circulations', 'Hall, escaliers, couloirs'],
      ['Signalétique et contrastes', 'Commandes, étages, repères visuels'],
      ['Cheminement accessible continu', 'Sans obstacle ni ressaut'],
    ],
    modale: {
      titre: "Analyse d'accessibilité (Alfredo)",
      immeuble: 'Immeuble',
      immeublePlaceholder: "Nom de l'immeuble",
      observations: 'Observations (facultatif)',
      observationsPlaceholder: "Ex. : pas de rampe à l'entrée, ascenseur étroit…",
      fermer: 'Fermer',
      enCours: 'Analyse en cours…',
      relancer: "Relancer l'analyse",
      analyser: 'Analyser',
    },
    toasts: {
      immeubleTitre: 'Immeuble',
      immeubleDesc: "Indiquez l'immeuble.",
      connexionTitre: 'Analyse IA Alfredo',
      connexionDesc: 'Connectez-vous en tant que syndic pour utiliser Alfredo.',
      erreurTitre: 'Erreur',
      erreurDesc: "Impossible d'analyser l'accessibilité.",
    },
  },
})
