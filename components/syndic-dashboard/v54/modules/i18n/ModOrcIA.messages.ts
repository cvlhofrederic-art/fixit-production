import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes de l'écran « Orçamento Anual com IA » / « Budget prévisionnel annuel assisté par IA ». */
interface OrcIATextes {
  titre: string
  chapeau: string
  kpi: { total: string; brouillon: string; propose: string; voteAG: string }
  onglets: { ger: string; hist: string; cmp: string; apr: string }
  parametres: string
  immeuble: string
  tousImmeubles: string
  aucunImmeuble: string
  inflation: string
  generation: string
  generer: string
  aide: string
  chargement: { titre: string; texte: string }
  vide: { titre: string; texte: string }
  toasts: {
    genere: string
    pret: string
    erreur: string
    indisponible: string
    demo: string
    connexionRequise: string
  }
  /** Message envoyé à l'agent Léa (lea-comptable). */
  prompt: (edificio: string, inflacao: string) => string
}

export const ORC_IA_MESSAGES = defineMessages<OrcIATextes>({
  'pt-PT': {
    titre: 'Orçamento Anual com IA',
    chapeau: 'Geração automática baseada nos últimos 3 exercícios + tendências económicas + inflação',
    kpi: { total: 'Total Orçamentos', brouillon: 'Rascunho', propose: 'Proposto', voteAG: 'Aprovado AG' },
    onglets: { ger: 'Gerador IA', hist: 'Histórico', cmp: 'Comparação', apr: 'Aprovação AG' },
    parametres: 'Parâmetros de Geração',
    immeuble: 'Edifício',
    tousImmeubles: 'Todos os edifícios',
    aucunImmeuble: 'Nenhum edifício',
    inflation: 'Taxa de inflação prevista (%)',
    generation: 'A gerar…',
    generer: 'Gerar Orçamento 2027',
    aide: 'O algoritmo analisa os últimos 3 exercícios contabilísticos, aplica médias ponderadas, deteta tendências de crescimento/redução por categoria, e ajusta pela inflação prevista. O fundo de reserva é automaticamente calculado ao mínimo legal de 10% (DL 268/94).',
    chargement: { titre: 'A gerar com IA…', texte: 'A Léa analisa os exercícios anteriores e aplica a inflação prevista.' },
    vide: { titre: 'Gere o seu primeiro orçamento com IA', texte: 'Selecione um edifício, defina a inflação prevista e clique em "Gerar"' },
    toasts: {
      genere: 'Orçamento gerado',
      pret: 'Proposta pronta para revisão',
      erreur: 'Erro ao gerar',
      indisponible: 'A Léa está indisponível, tente novamente',
      demo: 'Gerador IA (demo)',
      connexionRequise: 'Conecte-se como síndico para gerar com a Léa',
    },
    prompt: (edificio, inflacao) => `Gera uma proposta de orçamento previsional anual${edificio ? ` para o edifício "${edificio}"` : ''}, com taxa de inflação prevista de ${inflacao}%. Baseia-te em médias ponderadas dos últimos 3 exercícios, deteta tendências por categoria, calcula o fundo comum de reserva ao mínimo legal de 10% (DL 268/94), e apresenta as rubricas principais com o total previsto.`,
  },
  'fr-FR': {
    titre: 'Budget prévisionnel annuel assisté par IA',
    chapeau: 'Génération automatique à partir des 3 derniers exercices + tendances économiques + inflation',
    kpi: { total: 'Total des budgets', brouillon: 'Brouillon', propose: 'Proposé', voteAG: 'Voté en AG' },
    onglets: { ger: 'Générateur IA', hist: 'Historique', cmp: 'Comparaison', apr: 'Vote en AG' },
    parametres: 'Paramètres de génération',
    immeuble: 'Immeuble',
    tousImmeubles: 'Tous les immeubles',
    aucunImmeuble: 'Aucun immeuble',
    inflation: "Taux d'inflation prévu (%)",
    generation: 'Génération en cours…',
    generer: 'Générer le budget 2027',
    aide: "L'algorithme analyse les 3 derniers exercices comptables, applique des moyennes pondérées, détecte les tendances à la hausse ou à la baisse par poste de charges et ajuste selon l'inflation prévue. La cotisation annuelle au fonds de travaux est calculée automatiquement au minimum légal : au moins 5 % du budget prévisionnel et, si un plan pluriannuel de travaux a été adopté, au moins 2,5 % du montant des travaux qu'il prévoit (art. 14-2-1 de la loi n° 65-557 du 10 juillet 1965).",
    chargement: { titre: "Génération par l'IA en cours…", texte: "Léa analyse les exercices précédents et applique l'inflation prévue." },
    vide: { titre: "Générez votre premier budget prévisionnel avec l'IA", texte: "Sélectionnez un immeuble, indiquez l'inflation prévue et cliquez sur « Générer »" },
    toasts: {
      genere: 'Budget prévisionnel généré',
      pret: 'Proposition prête à être relue',
      erreur: 'Erreur lors de la génération',
      indisponible: 'Léa est indisponible, veuillez réessayer',
      demo: 'Générateur IA (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour générer le budget avec Léa',
    },
    prompt: (edificio, inflacao) => `Établis une proposition de budget prévisionnel annuel de copropriété${edificio ? ` pour l'immeuble « ${edificio} »` : ''}, avec un taux d'inflation prévu de ${inflacao} %. Le budget prévisionnel couvre les dépenses courantes de maintenance, de fonctionnement et d'administration des parties communes et équipements communs (art. 14-1 de la loi n° 65-557 du 10 juillet 1965). Les travaux autres que la maintenance (travaux de conservation ou d'amélioration, études techniques, diagnostics) n'en font pas partie : ils sont votés et appelés séparément. Appuie-toi sur les moyennes pondérées des 3 derniers exercices, détecte les tendances par poste de charges, calcule la cotisation annuelle au fonds de travaux (art. 14-2-1 : au moins 5 % du budget prévisionnel et au moins 2,5 % du montant des travaux prévus par le plan pluriannuel de travaux adopté), puis présente les principaux postes et le total prévu. Rappelle que le budget est voté chaque année par l'assemblée générale. Réponds en français.`,
  },
})
