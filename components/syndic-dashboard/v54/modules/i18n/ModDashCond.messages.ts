import { defineMessages } from '@/lib/syndic/v54/i18n'

interface DashCondTextes {
  titre: string
  chapeau: string
  kpi: { total: string; actifs: string; retard: string; interventions: string; dette: string }
  /** Montant en milliers d'euros (une décimale). */
  kEur: (n: number) => string
  rechercheAria: string
  recherchePlaceholder: string
  filtreAria: string
  tousLesImmeubles: string
  onglets: { vg: string; in: string; fn: string; cm: string }
}

export const DASH_COND_MESSAGES = defineMessages<DashCondTextes>({
  'pt-PT': {
    titre: 'Dashboard Condómino — Tempo Real',
    chapeau: 'Estado de cada condómino · Barra de progresso intervenções · Financeiro · Comunicação',
    kpi: { total: 'Total condóminos', actifs: 'Ativos (7 dias)', retard: 'Com atraso', interventions: 'Interv. pendentes', dette: 'Total em dívida' },
    kEur: (n) => `${(n / 1000).toFixed(1).replace('.', ',')}k€`,
    rechercheAria: 'Pesquisar condómino',
    recherchePlaceholder: 'Pesquisar condómino…',
    filtreAria: 'Filtrar por edifício',
    tousLesImmeubles: 'Todos os edifícios',
    onglets: { vg: 'Visão Geral', in: 'Intervenções', fn: 'Financeiro', cm: 'Comunicação' },
  },
  'fr-FR': {
    titre: 'Tableau de bord copropriétaire — temps réel',
    chapeau: 'Situation de chaque copropriétaire · Avancement des interventions · Finances · Communication',
    kpi: { total: 'Copropriétaires (total)', actifs: 'Accès extranet actifs', retard: 'En retard de paiement', interventions: 'Interv. en attente', dette: 'Total des impayés' },
    kEur: (n) => `${(n / 1000).toFixed(1).replace('.', ',')}\u00a0k€`,
    rechercheAria: 'Rechercher un copropriétaire',
    recherchePlaceholder: 'Rechercher un copropriétaire…',
    filtreAria: 'Filtrer par immeuble',
    tousLesImmeubles: 'Tous les immeubles',
    onglets: { vg: "Vue d'ensemble", in: 'Interventions', fn: 'Finances', cm: 'Communication' },
  },
})
