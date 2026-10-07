import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Immeuble de démonstration : nom, classe énergétique (code de couleur), libellé de la classe,
 * option tarifaire, consommation mensuelle (kWh), coût moyen (€), fournisseur, puissance,
 * économie potentielle (€/an). Fournisseurs et offres fictifs.
 */
export type ImmeubleEnergie = readonly [string, string, string, string, number, number, string, string, number]

interface ComparadorEnergiaTextes {
  titre: string
  chapeau: string
  marche: string
  kpi: { immeubles: string; coutMensuel: string; economie: string; classeMoyenne: string }
  onglets: { dash: string; cmp: string; sim: string; hist: string }
  profil: string
  immeubles: readonly ImmeubleEnergie[]
  /** Nombre affiché (mêmes valeurs dans les deux langues, séparateur décimal de la langue). */
  nombre: (n: number) => string
  consommation: string
  kwh: string
  coutMoyen: string
  fournisseur: string
  puissance: string
  economie: string
  euroParAn: string
}

export const COMPARADOR_ENERGIA_MESSAGES = defineMessages<ComparadorEnergiaTextes>({
  'pt-PT': {
    titre: 'Comparador de Tarifas de Energia Coletiva',
    chapeau: 'Analise, compare e otimize os custos energéticos dos seus edifícios',
    marche: 'ERSE 2024 - Mercado Liberalizado',
    kpi: { immeubles: 'Total edifícios', coutMensuel: 'Custo médio mensal', economie: 'Poupança potencial/ano', classeMoyenne: 'Classe energética média' },
    onglets: { dash: 'Dashboard', cmp: 'Comparar Tarifas', sim: 'Simulação', hist: 'Histórico' },
    profil: 'Perfil Energético por Edifício',
    immeubles: [
      ['Edifício Aurora', 'B', 'Classe B', 'Tri-Horário', 1075, 196.25, 'EDP Comercial', '6.9 kVA', 140.04],
      ['Edifício Belém', 'C', 'Classe C', 'Bi-Horário', 1737, 295.55, 'Galp Energia', '10.35 kVA', 163.0],
      ['Edifício Cascais', 'D', 'Classe D', 'Simples', 1738, 295.7, 'Endesa', '13.8 kVA', 197.36],
      ['Edifício Douro', 'B-', 'Classe B-', 'Tri-Horário', 1857, 313.55, 'EDP Comercial', '6.9 kVA', 225.91],
    ],
    nombre: (n) => String(n),
    consommation: 'Consumo mensal',
    kwh: 'kWh',
    coutMoyen: 'Custo médio',
    fournisseur: 'Fornecedor atual',
    puissance: 'Potência',
    economie: 'Poupança potencial',
    euroParAn: '€/ano',
  },
  'fr-FR': {
    titre: "Comparateur d'énergie — contrats collectifs",
    chapeau: 'Analysez, comparez et optimisez les coûts énergétiques des parties communes de vos immeubles',
    marche: 'Offres de marché — hors tarif réglementé',
    kpi: { immeubles: 'Immeubles (total)', coutMensuel: 'Coût mensuel moyen', economie: 'Économie potentielle / an', classeMoyenne: 'Classe énergétique moyenne (DPE)' },
    onglets: { dash: 'Tableau de bord', cmp: 'Comparer les offres', sim: 'Simulation', hist: 'Historique' },
    profil: 'Profil énergétique par immeuble',
    immeubles: [
      ['Résidence Aurore', 'B', 'DPE B', 'Heures creuses week-end', 1075, 196.25, 'Rhodanie Énergie', '6 kVA', 140.04],
      ['Résidence Confluence', 'C', 'DPE C', 'Heures pleines / creuses', 1737, 295.55, 'Ampère Copropriétés', '9 kVA', 163.0],
      ['Résidence Part-Dieu', 'D', 'DPE D', 'Base', 1738, 295.7, 'Watt Commun', '12 kVA', 197.36],
      ['Résidence Saône', 'B', 'DPE B', 'Heures creuses week-end', 1857, 313.55, 'Rhodanie Énergie', '6 kVA', 225.91],
    ],
    nombre: (n) => n.toLocaleString('fr-FR'),
    consommation: 'Consommation mensuelle',
    kwh: 'kWh',
    coutMoyen: 'Coût moyen',
    fournisseur: 'Fournisseur actuel',
    puissance: 'Puissance souscrite',
    economie: 'Économie potentielle',
    euroParAn: '€/an',
  },
})
