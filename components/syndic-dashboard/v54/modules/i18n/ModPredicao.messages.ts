import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Teinte d'une classe de risque (jeton de couleur v54). */
export type TeinteRisque = 'rust' | 'amber' | 'gold' | 'sage'

interface PredicaoTextes {
  titre: string
  chapeau: string
  kpi: { equipements: string; critiques: string; degradation: string; scoreMoyen: string; scoreMoyenValeur: string; coutPrevu: string }
  onglets: { dash: string; eq: string; tl: string; al: string }
  /** Classes de risque : libellé et teinte. */
  risques: readonly (readonly [string, TeinteRisque])[]
  repartition: string
  parImmeuble: string
  choisirImmeuble: string
}

export const PREDICAO_MESSAGES = defineMessages<PredicaoTextes>({
  'pt-PT': {
    titre: 'Predição de Manutenção',
    chapeau: 'Machine Learning preditivo · Score de risco por equipamento · Timeline de intervenções',
    kpi: { equipements: 'Equipamentos', critiques: 'Críticos', degradation: 'Em degradação', scoreMoyen: 'Score médio risco', scoreMoyenValeur: '0%', coutPrevu: 'Custo previsto total' },
    onglets: { dash: 'Dashboard', eq: 'Equipamentos', tl: 'Timeline', al: 'Alertas (0)' },
    risques: [
      ['Crítico (>80%)', 'rust'],
      ['Atenção (60-80%)', 'amber'],
      ['Moderado (40-60%)', 'gold'],
      ['Bom (<40%)', 'sage'],
    ],
    repartition: 'Distribuição de Risco',
    parImmeuble: 'Risco por Edifício',
    choisirImmeuble: 'Selecione um edifício para ver o risco',
  },
  'fr-FR': {
    titre: 'Maintenance prédictive',
    chapeau: 'Apprentissage automatique prédictif · Score de risque par équipement · Chronologie des interventions',
    kpi: { equipements: 'Équipements', critiques: 'Critiques', degradation: 'En dégradation', scoreMoyen: 'Score de risque moyen', scoreMoyenValeur: '0 %', coutPrevu: 'Coût prévisionnel total' },
    onglets: { dash: 'Tableau de bord', eq: 'Équipements', tl: 'Chronologie', al: 'Alertes (0)' },
    risques: [
      ['Critique (> 80 %)', 'rust'],
      ['Vigilance (60-80 %)', 'amber'],
      ['Modéré (40-60 %)', 'gold'],
      ['Bon (< 40 %)', 'sage'],
    ],
    repartition: 'Répartition du risque',
    parImmeuble: 'Risque par immeuble',
    choisirImmeuble: 'Sélectionnez un immeuble pour afficher son niveau de risque',
  },
})
