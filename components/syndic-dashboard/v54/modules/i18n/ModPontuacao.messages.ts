import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes de l'écran « Pontuação de Saúde dos Edifícios » / « Score de santé des immeubles ». */
interface PontuacaoTextes {
  titre: string
  chapeau: string
  details: string
  classement: string
  actualiser: string
  toasts: {
    details: (n: number) => string
    meilleur: (nom: string) => string
    aucunImmeuble: string
    misAJour: string
    moyenne: (avg: number) => string
  }
  kpi: {
    scoreMoyen: string
    /** Suffixe affiché après le nombre d'immeubles (même nœud texte qu'à l'origine). */
    suffixeImmeubles: string
    meilleur: string
    pire: string
    alertes: string
    aRevoir: (n: number) => string
    toutEnOrdre: string
  }
  panneau: string
  vide: { titre: string; texte: string }
  colonnes: { immeuble: string; ville: string; lots: string; score: string; note: string }
}

export const PONTUACAO_MESSAGES = defineMessages<PontuacaoTextes>({
  'pt-PT': {
    titre: 'Pontuação de Saúde dos Edifícios',
    chapeau: 'Avaliação IA baseada em estado técnico, finanças, conformidade, satisfação e energia',
    details: 'Detalhes',
    classement: 'Ranking',
    actualiser: 'Atualizar',
    toasts: {
      details: (n) => `${n} edifício(s) avaliados`,
      meilleur: (nom) => `Melhor: ${nom}`,
      aucunImmeuble: 'Sem edifícios',
      misAJour: 'Pontuações atualizadas',
      moyenne: (avg) => `Média ${avg}/100`,
    },
    kpi: {
      scoreMoyen: 'Pontuação Média',
      suffixeImmeubles: ' edifício(s)',
      meilleur: 'Melhor Edifício',
      pire: 'Pior Edifício',
      alertes: 'Alertas Ativos',
      aRevoir: (n) => `${n} edifício(s) a rever`,
      toutEnOrdre: 'Tudo em ordem!',
    },
    panneau: 'EDIFÍCIOS',
    vide: { titre: 'Nenhum edifício', texte: 'Selecione um edifício para ver a análise completa' },
    colonnes: { immeuble: 'Edifício', ville: 'Cidade', lots: 'Frações', score: 'Pontuação', note: 'Nota' },
  },
  'fr-FR': {
    titre: 'Score de santé des immeubles',
    chapeau: "Évaluation par l'IA fondée sur l'état technique, les finances, la conformité, la satisfaction et l'énergie",
    details: 'Détails',
    classement: 'Classement',
    actualiser: 'Mettre à jour',
    toasts: {
      details: (n) => `${n} immeuble${n > 1 ? 's' : ''} évalué${n > 1 ? 's' : ''}`,
      meilleur: (nom) => `Meilleur : ${nom}`,
      aucunImmeuble: 'Aucun immeuble',
      misAJour: 'Scores mis à jour',
      moyenne: (avg) => `Moyenne : ${avg}/100`,
    },
    kpi: {
      scoreMoyen: 'Score moyen',
      suffixeImmeubles: ' immeuble(s)',
      meilleur: 'Meilleur immeuble',
      pire: 'Immeuble le moins bien noté',
      alertes: 'Alertes actives',
      aRevoir: (n) => `${n} immeuble${n > 1 ? 's' : ''} à revoir`,
      toutEnOrdre: 'Tout est en ordre !',
    },
    panneau: 'IMMEUBLES',
    vide: { titre: 'Aucun immeuble', texte: "Sélectionnez un immeuble pour voir l'analyse complète" },
    colonnes: { immeuble: 'Immeuble', ville: 'Ville', lots: 'Lots', score: 'Score', note: 'Note' },
  },
})
