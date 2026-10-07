import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Indicateur de démonstration : valeur affichée, libellé, tendance vs mois précédent. */
interface KpiConso { num: string; lbl: string; tendance: string }

interface MonitorizacaoTextes {
  titre: string
  chapeau: string
  onglets: { dash: string; cons: string; al: string; cfg: string }
  kpi: { electricite: KpiConso; eau: KpiConso; gaz: KpiConso; cout: KpiConso; vsMoisPrecedent: string }
  /** Mois affichés sous les barres (de décembre à mai). */
  mois: string[]
  /** Titres des trois histogrammes (électricité, eau, gaz). */
  graphiques: [string, string, string]
  anneeEnCours: string
  anneePrecedente: string
  alertesActives: string
  nbActives: string
  alerteEau: string
  alerteElectricite: string
  avertissement: string
  info: string
}

export const MONITORIZACAO_MESSAGES = defineMessages<MonitorizacaoTextes>({
  'pt-PT': {
    titre: 'Monitorização de Consumos',
    chapeau: 'Eletricidade, água e gás — leituras, custos e alertas',
    onglets: { dash: 'Dashboard', cons: 'Consumos', al: 'Alertas', cfg: 'Configuração' },
    kpi: {
      electricite: { num: '1252 kWh', lbl: 'Eletricidade', tendance: '-3.1%' },
      eau: { num: '33 m³', lbl: 'Água', tendance: '-31.3%' },
      gaz: { num: '265 m³', lbl: 'Gás', tendance: '+31.8%' },
      cout: { num: '368,28 €', lbl: 'Custo total', tendance: '-18.6%' },
      vsMoisPrecedent: 'vs. mês anterior',
    },
    mois: ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'],
    graphiques: ['Eletricidade (kWh) — Últimos 6 meses', 'Água (m³) — Últimos 6 meses', 'Gás (m³) — Últimos 6 meses'],
    anneeEnCours: 'Ano atual',
    anneePrecedente: 'Ano anterior',
    alertesActives: 'Alertas ativos (2)',
    nbActives: '2 ativos',
    alerteEau: '● Consumo de água 28% acima da média dos últimos 3 meses',
    alerteElectricite: '● Custo mensal de eletricidade atingiu 85% do limite orçamental',
    avertissement: 'Aviso',
    info: 'Info',
  },
  'fr-FR': {
    titre: 'Suivi des consommations',
    chapeau: 'Électricité, eau et gaz des parties communes — relevés, coûts et alertes',
    onglets: { dash: 'Tableau de bord', cons: 'Consommations', al: 'Alertes', cfg: 'Paramètres' },
    kpi: {
      electricite: { num: '1 252 kWh', lbl: 'Électricité', tendance: '-3,1 %' },
      eau: { num: '33 m³', lbl: 'Eau', tendance: '-31,3 %' },
      gaz: { num: '265 m³', lbl: 'Gaz', tendance: '+31,8 %' },
      cout: { num: '368,28 €', lbl: 'Coût total', tendance: '-18,6 %' },
      vsMoisPrecedent: 'vs mois précédent',
    },
    mois: ['déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai'],
    graphiques: ['Électricité (kWh) — 6 derniers mois', 'Eau (m³) — 6 derniers mois', 'Gaz (m³) — 6 derniers mois'],
    anneeEnCours: 'Année en cours',
    anneePrecedente: 'Année précédente',
    alertesActives: 'Alertes actives (2)',
    nbActives: '2 actives',
    alerteEau: "● Consommation d'eau supérieure de 28 % à la moyenne des 3 derniers mois",
    alerteElectricite: "● Le coût mensuel de l'électricité atteint 85 % de l'enveloppe du budget prévisionnel",
    avertissement: 'Avertissement',
    info: 'Info',
  },
})
