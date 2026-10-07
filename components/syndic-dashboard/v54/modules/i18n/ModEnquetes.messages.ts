import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Enquete } from '@/lib/syndic/v54/api'

/** Sondage de démonstration : `prazoExpire` signale un délai dépassé (pastille rouge). */
export type EnqueteDemo = Enquete & { prazoExpire: boolean }

interface EnquetesTextes {
  titre: string
  chapeau: string
  nouvelleEnquete: string
  kpi: { actives: string; historique: string; participation: string; reponses: string }
  /** Pourcentage affiché (KPI de participation). */
  pct: (n: number) => string
  onglets: { actives: string; historique: string; creer: string }
  vide: { titre: string; desc: string }
  /** Libellé d'un statut (clé = valeur API ; repli sur la valeur brute). */
  statuts: Record<string, string>
  /** Libellé d'un type de question (clé = valeur PT envoyée à l'API ; repli sur la valeur brute). */
  types: Record<string, string>
  anonyme: string
  voirDetails: string
  cloturer: string
  /** Suite de « {réponses}/{total} » (espace initiale comprise). */
  ontRepondu: string
  /** Signe pourcent après le pourcentage d'une option (« {votes} ({pct}…) »). */
  pourcentOption: string
  /** Signe pourcent après le taux de participation de la carte. */
  pourcentCarte: string
  toasts: {
    details: string
    cloturer: string
    clotureBientot: string
    connexion: string
    creee: string
    erreurCreation: string
    reessayerPlusTard: string
    creeeDemo: string
    connexionRequise: string
  }
  formulaire: {
    titreModale: string
    titre: string
    titrePlaceholder: string
    description: string
    type: string
    immeuble: string
    immeublePlaceholder: string
    statut: string
    delai: string
    lotsConsultes: string
    lotsConsultesAide: string
    anonyme: string
    non: string
    oui: string
    options: string
    optionsAide: string
    optionsPlaceholder: string
    annuler: string
    creer: string
  }
  erreurs: { titre: string }
  demo: EnqueteDemo[]
}

export const ENQUETES_MESSAGES = defineMessages<EnquetesTextes>({
  'pt-PT': {
    titre: 'Enquetes & Sondagens',
    chapeau: 'Consulte a opinião dos condóminos de forma rápida e organizada',
    nouvelleEnquete: 'Nova Enquete',
    kpi: { actives: 'Enquetes Ativas', historique: 'Histórico Total', participation: 'Participação Média', reponses: 'Total Respostas' },
    pct: (n) => `${n}%`,
    onglets: { actives: 'Enquetes Ativas', historique: 'Histórico', creer: 'Criar Enquete' },
    vide: { titre: 'Sem enquetes', desc: 'Lance a primeira consulta aos condóminos' },
    statuts: { ativa: 'Ativa', a_decorrer: 'A decorrer', encerrada: 'Encerrada' },
    types: { 'Escolha Múltipla': 'Escolha Múltipla', 'Sim / Não': 'Sim / Não', 'Escala 1-5': 'Escala 1-5' },
    anonyme: 'Anónima',
    voirDetails: 'Ver detalhes',
    cloturer: 'Encerrar',
    ontRepondu: ' frações responderam',
    pourcentOption: '%)',
    pourcentCarte: '%',
    toasts: {
      details: 'Detalhes da enquete',
      cloturer: 'Encerrar enquete',
      clotureBientot: 'Gestão de encerramento em breve',
      connexion: 'Conecte-se como síndico',
      creee: 'Enquete criada',
      erreurCreation: 'Erro ao criar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'Enquete criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
    formulaire: {
      titreModale: 'Nova enquete',
      titre: 'Título',
      titrePlaceholder: 'Ex.: Horário de recolha de lixo',
      description: 'Descrição',
      type: 'Tipo',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      statut: 'Estado',
      delai: 'Prazo',
      lotsConsultes: 'Frações consultadas',
      lotsConsultesAide: 'Total de frações',
      anonyme: 'Anónima',
      non: 'Não',
      oui: 'Sim',
      options: 'Opções de resposta',
      optionsAide: 'Uma opção por linha',
      optionsPlaceholder: 'Manhã (7h-9h)\nTarde (14h-16h)\nNoite (20h-22h)',
      annuler: 'Cancelar',
      creer: 'Criar enquete',
    },
    erreurs: { titre: 'Indique o título da enquete.' },
    demo: [
      { id: 'p1', titulo: 'Horário de recolha de lixo', descricao: 'Qual o horário preferido para a recolha de lixo no condomínio? Solicitamos a participação de todas as frações', estado: 'ativa', tipo: 'Escolha Múltipla', edificio: 'Edifício Marquês', prazo: '8 dias restantes', prazoExpire: false, total: 40, options: [{ label: 'Manhã (7h-9h)', votes: 8 }, { label: 'Tarde (14h-16h)', votes: 3 }, { label: 'Noite (20h-22h)', votes: 12 }, { label: 'Sem preferência', votes: 2 }], anonima: false },
      { id: 'p2', titulo: 'Aprovação obra fachada', descricao: 'Concorda com a realização da obra de pintura da fachada prevista no orçamento de 2026?', estado: 'a_decorrer', tipo: 'Sim / Não', edificio: 'Edifício Marquês', prazo: 'Prazo expirado', prazoExpire: true, total: 32, options: [{ label: 'Sim', votes: 18 }, { label: 'Não', votes: 7 }], anonima: false },
      { id: 'p3', titulo: 'Satisfação serviço limpeza', descricao: 'De 1 a 5, como avalia a qualidade do serviço de limpeza das áreas comuns no último trimestre?', estado: 'ativa', tipo: 'Escala 1-5', edificio: 'Residência Boavista', prazo: 'Prazo expirado', prazoExpire: true, total: 40, options: [{ label: '1 - Muito Insatisfeito', votes: 1 }, { label: '2 - Insatisfeito', votes: 3 }, { label: '3 - Neutro', votes: 5 }, { label: '4 - Satisfeito', votes: 10 }, { label: '5 - Muito Satisfeito', votes: 6 }], anonima: true },
    ],
  },
  'fr-FR': {
    titre: 'Sondages & consultations',
    chapeau: "Recueillez rapidement l'avis des copropriétaires — consultation indicative : les décisions du syndicat se prennent en assemblée générale (art. 17 de la loi du 10 juillet 1965)",
    nouvelleEnquete: 'Nouveau sondage',
    kpi: { actives: 'Sondages en cours', historique: 'Historique (total)', participation: 'Participation moyenne', reponses: 'Réponses (total)' },
    pct: (n) => `${n} %`,
    onglets: { actives: 'Sondages en cours', historique: 'Historique', creer: 'Créer un sondage' },
    vide: { titre: 'Aucun sondage', desc: 'Lancez une première consultation des copropriétaires' },
    statuts: { ativa: 'Actif', a_decorrer: 'En cours', encerrada: 'Clôturé' },
    types: { 'Escolha Múltipla': 'Choix multiple', 'Sim / Não': 'Oui / Non', 'Escala 1-5': 'Échelle de 1 à 5' },
    anonyme: 'Anonyme',
    voirDetails: 'Voir le détail',
    cloturer: 'Clôturer',
    ontRepondu: ' lots ont répondu',
    pourcentOption: ' %)',
    pourcentCarte: ' %',
    toasts: {
      details: 'Détail du sondage',
      cloturer: 'Clôturer le sondage',
      clotureBientot: 'La clôture des sondages sera bientôt disponible',
      connexion: 'Connectez-vous en tant que syndic',
      creee: 'Sondage créé',
      erreurCreation: 'Erreur lors de la création',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'Sondage créé (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
    formulaire: {
      titreModale: 'Nouveau sondage',
      titre: 'Titre',
      titrePlaceholder: 'Ex. : Horaire de sortie des poubelles',
      description: 'Description',
      type: 'Type de question',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      statut: 'Statut',
      delai: 'Date limite',
      lotsConsultes: 'Lots consultés',
      lotsConsultesAide: 'Nombre total de lots',
      anonyme: 'Anonyme',
      non: 'Non',
      oui: 'Oui',
      options: 'Réponses proposées',
      optionsAide: 'Une réponse par ligne',
      optionsPlaceholder: 'Matin (7 h - 9 h)\nAprès-midi (14 h - 16 h)\nSoir (20 h - 22 h)',
      annuler: 'Annuler',
      creer: 'Créer le sondage',
    },
    erreurs: { titre: 'Indiquez le titre du sondage.' },
    demo: [
      { id: 'p1', titulo: 'Horaire de sortie des poubelles', descricao: "À quelle heure préférez-vous que les conteneurs à ordures de la résidence soient sortis ? Merci à chaque lot de participer", estado: 'ativa', tipo: 'Escolha Múltipla', edificio: 'Résidence Les Terreaux', prazo: '8 jours restants', prazoExpire: false, total: 40, options: [{ label: 'Matin (7 h - 9 h)', votes: 8 }, { label: 'Après-midi (14 h - 16 h)', votes: 3 }, { label: 'Soir (20 h - 22 h)', votes: 12 }, { label: 'Sans préférence', votes: 2 }], anonima: false },
      { id: 'p2', titulo: 'Ravalement de façade — avis préalable', descricao: "Souhaitez-vous que le ravalement de la façade envisagé pour 2026 soit inscrit à l'ordre du jour de la prochaine assemblée générale ?", estado: 'a_decorrer', tipo: 'Sim / Não', edificio: 'Résidence Les Terreaux', prazo: 'Délai dépassé', prazoExpire: true, total: 32, options: [{ label: 'Oui', votes: 18 }, { label: 'Non', votes: 7 }], anonima: false },
      { id: 'p3', titulo: 'Satisfaction — nettoyage des parties communes', descricao: 'De 1 à 5, comment évaluez-vous la qualité du nettoyage des parties communes au cours du dernier trimestre ?', estado: 'ativa', tipo: 'Escala 1-5', edificio: 'Résidence Bellecour', prazo: 'Délai dépassé', prazoExpire: true, total: 40, options: [{ label: '1 - Très insatisfait', votes: 1 }, { label: '2 - Insatisfait', votes: 3 }, { label: '3 - Neutre', votes: 5 }, { label: '4 - Satisfait', votes: 10 }, { label: '5 - Très satisfait', votes: 6 }], anonima: true },
    ],
  },
})
