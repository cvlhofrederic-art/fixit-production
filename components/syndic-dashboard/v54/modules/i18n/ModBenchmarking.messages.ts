import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Immeuble } from '@/components/syndic-dashboard/types'

/** Textes de l'écran « Benchmarking Imóveis » / « Comparatif des immeubles ». */
interface BenchmarkingTextes {
  titre: string
  chapeau: string
  exporter: string
  onglets: { ranking: string; kpis: string; outliers: string; export: string }
  kpi: { compares: string; meilleur: string; percentileMoyen: string; outliers: string }
  panneau: string
  vide: { titre: string; desc: string }
  colonnes: { immeuble: string; score: string; coutLot: string; interventions: string; percentile: string }
  toasts: { titre: string; ajouterImmeubles: string; connexionRequise: string }
  /** Export CSV : nom du fichier et en-têtes de colonnes. */
  csv: { fichier: string; entetes: string[] }
  /** Immeubles de démonstration (preview anonyme). */
  demo: Immeuble[]
}

export const BENCHMARKING_MESSAGES = defineMessages<BenchmarkingTextes>({
  'pt-PT': {
    titre: 'Benchmarking Imóveis',
    chapeau: 'Comparação de KPIs entre edifícios · Rankings · Percentis · Alertas de outliers · Exportação',
    exporter: 'Exportar',
    onglets: { ranking: 'Ranking', kpis: 'KPIs', outliers: 'Outliers', export: 'Exportação' },
    kpi: { compares: 'Edifícios comparados', meilleur: 'Melhor performance', percentileMoyen: 'Percentil médio', outliers: 'Outliers detetados' },
    panneau: 'Ranking de edifícios',
    vide: { titre: 'Sem edifícios para comparar', desc: 'Adicione edifícios em « Edifícios » para gerar o benchmarking.' },
    colonnes: { immeuble: 'Edifício', score: 'Score de saúde', coutLot: 'Custo/fração', interventions: 'Intervenções', percentile: 'Percentil' },
    toasts: { titre: 'Exportar benchmarking', ajouterImmeubles: 'Adicione edifícios para exportar.', connexionRequise: 'Conecte-se como síndico para exportar.' },
    csv: { fichier: 'benchmarking-edificios.csv', entetes: ['Posição', 'Edifício', 'Score saúde', 'Custo / fração (€)'] },
    demo: [
      { id: 'b1', nom: 'Edifício Aurora', adresse: '', ville: 'Porto', codePostal: '', nbLots: 20, anneeConstruction: 2015, typeImmeuble: '', gestionnaire: '', nbInterventions: 2, budgetAnnuel: 50000, depensesAnnee: 30000 },
      { id: 'b2', nom: 'Residencial Cedofeita', adresse: '', ville: 'Porto', codePostal: '', nbLots: 18, anneeConstruction: 2008, typeImmeuble: '', gestionnaire: '', nbInterventions: 3, budgetAnnuel: 45000, depensesAnnee: 31500 },
      { id: 'b3', nom: 'Condomínio Boavista Center', adresse: '', ville: 'Porto', codePostal: '', nbLots: 16, anneeConstruction: 2000, typeImmeuble: '', gestionnaire: '', nbInterventions: 5, budgetAnnuel: 40000, depensesAnnee: 34000 },
      { id: 'b4', nom: 'Edifício Bela Vista', adresse: '', ville: 'Porto', codePostal: '', nbLots: 12, anneeConstruction: 1992, typeImmeuble: '', gestionnaire: '', nbInterventions: 8, budgetAnnuel: 30000, depensesAnnee: 28500 },
    ],
  },
  'fr-FR': {
    titre: 'Comparatif des immeubles',
    chapeau: 'Comparaison des indicateurs entre immeubles · Classements · Percentiles · Alertes sur les valeurs atypiques · Export',
    exporter: 'Exporter',
    onglets: { ranking: 'Classement', kpis: 'Indicateurs', outliers: 'Valeurs atypiques', export: 'Export' },
    kpi: { compares: 'Immeubles comparés', meilleur: 'Meilleure performance', percentileMoyen: 'Percentile moyen', outliers: 'Valeurs atypiques détectées' },
    panneau: 'Classement des immeubles',
    vide: { titre: 'Aucun immeuble à comparer', desc: 'Ajoutez des immeubles dans « Immeubles » pour générer le comparatif.' },
    colonnes: { immeuble: 'Immeuble', score: 'Score de santé', coutLot: 'Coût / lot', interventions: 'Interventions', percentile: 'Percentile' },
    toasts: { titre: 'Exporter le comparatif', ajouterImmeubles: 'Ajoutez des immeubles pour exporter.', connexionRequise: 'Connectez-vous en tant que syndic pour exporter.' },
    csv: { fichier: 'comparatif-immeubles.csv', entetes: ['Rang', 'Immeuble', 'Score de santé', 'Coût / lot (€)'] },
    demo: [
      { id: 'b1', nom: 'Résidence Aurore', adresse: '', ville: 'Lyon', codePostal: '', nbLots: 20, anneeConstruction: 2015, typeImmeuble: '', gestionnaire: '', nbInterventions: 2, budgetAnnuel: 50000, depensesAnnee: 30000 },
      { id: 'b2', nom: 'Résidence Croix-Rousse', adresse: '', ville: 'Lyon', codePostal: '', nbLots: 18, anneeConstruction: 2008, typeImmeuble: '', gestionnaire: '', nbInterventions: 3, budgetAnnuel: 45000, depensesAnnee: 31500 },
      { id: 'b3', nom: 'Copropriété Bellecour Center', adresse: '', ville: 'Lyon', codePostal: '', nbLots: 16, anneeConstruction: 2000, typeImmeuble: '', gestionnaire: '', nbInterventions: 5, budgetAnnuel: 40000, depensesAnnee: 34000 },
      { id: 'b4', nom: 'Résidence Belle Vue', adresse: '', ville: 'Lyon', codePostal: '', nbLots: 12, anneeConstruction: 1992, typeImmeuble: '', gestionnaire: '', nbInterventions: 8, budgetAnnuel: 30000, depensesAnnee: 28500 },
    ],
  },
})
