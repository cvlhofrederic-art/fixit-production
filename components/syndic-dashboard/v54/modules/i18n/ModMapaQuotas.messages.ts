import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Situation de paiement d'un lot (code interne ; le libellé dépend de la langue). */
export type EtatQuota = 'emDia' | 'atraso' | 'divida'

/** Ligne de démonstration : lot, copropriétaire, tantièmes, surface, montants, situation, détail. */
export interface LigneQuotaDemo {
  frac: string
  cond: string
  perm: number
  area: number
  quota: string
  fcr: string
  total: string
  estado: EtatQuota
  detalhe?: string
}

type Toast = { titre: string; desc: string }

interface MapaQuotasTextes {
  titre: string
  chapeau: string
  /** Libellé devant le montant total des impayés (espace finale comprise). */
  detteTotale: string
  onglets: { map: string; sim: string; cob: string; rel: string }
  kpi: {
    budget: string
    budgetSous: string
    fcr: string
    fcrSous: string
    quota: string
    quotaSous: string
    taux: (n: number) => string
    tauxLbl: string
    tauxSous: (aJour: number, irreguliers: number) => string
  }
  champs: {
    budget: string
    fcr: string
    valeurAria: string
    mode: string
    fixa: string
    area: string
    perm: string
  }
  modes: { fixa: Toast; area: Toast; perm: Toast }
  colonnes: { frac: string; cond: string; perm: string; area: string; quota: string; fcr: string; total: string; estado: string }
  etats: Record<EtatQuota, string>
  enDette: (montant: string) => string
  demo: LigneQuotaDemo[]
}

export const MAPA_QUOTAS_MESSAGES = defineMessages<MapaQuotasTextes>({
  'pt-PT': {
    titre: 'Mapa de Quotas',
    chapeau: 'Gestão inteligente de quotas do condomínio',
    detteTotale: 'Dívida total: ',
    onglets: { map: 'Mapa de Quotas', sim: 'Simulador', cob: 'Cobranças', rel: 'Relatório' },
    kpi: {
      budget: 'Orçamento anual',
      budgetSous: '4000,00 €/mês',
      fcr: 'FCR anual',
      fcrSous: '10% (min. 10% DL 268/94)',
      quota: 'Quota média',
      quotaSous: '12 frações',
      taux: (n) => `${n}%`,
      tauxLbl: 'Taxa cobrança',
      tauxSous: (aJour, irreguliers) => `${aJour} em dia / ${irreguliers} irregulares`,
    },
    champs: {
      budget: 'Orçamento anual (EUR)',
      fcr: 'FCR (10%)',
      valeurAria: 'Valor',
      mode: 'Modo de cálculo',
      fixa: 'Fixa',
      area: 'Por área (m²)',
      perm: 'Permilagem',
    },
    modes: {
      fixa: { titre: 'Modo: Fixa', desc: 'Cálculo por quota fixa em breve' },
      area: { titre: 'Modo: Por área', desc: 'Cálculo por m² em breve' },
      perm: { titre: 'Modo: Permilagem', desc: 'Modo ativo' },
    },
    colonnes: { frac: 'Fração', cond: 'Condómino', perm: 'Permilagem', area: 'Área (m²)', quota: 'Quota mensal', fcr: 'FCR', total: 'Total mensal', estado: 'Estado' },
    etats: { emDia: 'Em dia', atraso: 'Atraso', divida: 'Dívida' },
    enDette: (montant) => `${montant} em dívida`,
    demo: [
      { frac: 'Fração A - R/C Esq.', cond: 'Ana Silva', perm: 70, area: 65, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Fração B - R/C Dto.', cond: 'Bruno Costa', perm: 75, area: 72, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Fração C - 1.° Esq.', cond: 'Carla Ferreira', perm: 90, area: 85, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Fração D - 1.° Dto.', cond: 'Daniel Oliveira', perm: 95, area: 90, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'atraso', detalhe: '45d atraso | 185,00 €' },
      { frac: 'Fração E - 2.° Esq.', cond: 'Elena Santos', perm: 82, area: 78, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Fração F - 2.° Dto.', cond: 'Francisco Rodrigues', perm: 100, area: 95, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Fração G - 3.° Esq.', cond: 'Gabriela Almeida', perm: 92, area: 88, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'divida', detalhe: '120d atraso | 1450,00 €' },
    ],
  },
  'fr-FR': {
    titre: 'Répartition des charges',
    chapeau: 'Répartition des charges par lot selon les tantièmes et suivi des appels de provisions',
    detteTotale: 'Total des impayés : ',
    onglets: { map: 'Répartition', sim: 'Simulateur', cob: 'Encaissements', rel: 'Rapport' },
    kpi: {
      budget: 'Budget prévisionnel annuel',
      budgetSous: '12 000,00 €/trimestre',
      fcr: 'Fonds de travaux annuel',
      fcrSous: '5 % (min. 5 % du budget — art. 14-2-1)',
      quota: 'Provision moyenne',
      quotaSous: '12 lots',
      taux: (n) => `${String(n).replace('.', ',')} %`,
      tauxLbl: "Taux d'encaissement",
      tauxSous: (aJour, irreguliers) => `${aJour} à jour / ${irreguliers} en retard`,
    },
    champs: {
      budget: 'Budget annuel (EUR)',
      fcr: 'Fonds de travaux (5 %)',
      valeurAria: 'Valeur',
      mode: 'Mode de calcul',
      fixa: 'Forfait',
      area: 'Par surface (m²)',
      perm: 'Tantièmes',
    },
    modes: {
      fixa: { titre: 'Mode : forfait', desc: 'Calcul au forfait bientôt disponible' },
      area: { titre: 'Mode : par surface', desc: 'Calcul au m² bientôt disponible' },
      perm: { titre: 'Mode : tantièmes', desc: 'Mode actif' },
    },
    colonnes: { frac: 'Lot', cond: 'Copropriétaire', perm: 'Tantièmes', area: 'Surface (m²)', quota: 'Provision trimestrielle', fcr: 'Fonds de travaux', total: 'Total trimestriel', estado: 'Statut' },
    etats: { emDia: 'À jour', atraso: 'En retard', divida: 'Impayé' },
    enDette: (montant) => `Reste dû : ${montant}`,
    demo: [
      { frac: 'Lot 1 - RDC gauche', cond: 'Anne Simon', perm: 70, area: 65, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Lot 2 - RDC droite', cond: 'Bruno Lacoste', perm: 75, area: 72, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Lot 3 - 1er étage gauche', cond: 'Carole Ferrand', perm: 90, area: 85, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Lot 4 - 1er étage droite', cond: 'Daniel Olivier', perm: 95, area: 90, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'atraso', detalhe: '45 j de retard | 185,00 €' },
      { frac: 'Lot 5 - 2e étage gauche', cond: 'Élise Sanchez', perm: 82, area: 78, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Lot 6 - 2e étage droite', cond: 'François Rodier', perm: 100, area: 95, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'emDia' },
      { frac: 'Lot 7 - 3e étage gauche', cond: 'Gabrielle Aubert', perm: 92, area: 88, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'divida', detalhe: '120 j de retard | 1 450,00 €' },
    ],
  },
})
