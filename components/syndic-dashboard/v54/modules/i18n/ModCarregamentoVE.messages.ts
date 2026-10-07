import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut d'une demande (code interne ; le libellé dépend de la langue). */
export type StatutDemandeVE = 'analise' | 'aprovado' | 'pendente'

/** Demande de démonstration : demandeur, emplacement et puissance, statut, usage, notification, échéance. */
export interface DemandeVE {
  nom: string
  detail: string
  statut: StatutDemandeVE
  usage: string
  notification: string
  echeance: string
  /** Échéance dépassée (affichée en rouge). */
  depassee: boolean
  pct: number
  kind: 'rust' | 'sage' | 'amber'
}

/**
 * Textes de l'écran « Carregamento de Veículos Elétricos » (DL 101-D/2020) /
 * « Bornes de recharge » (droit à la prise : art. L113-16 du CCH ; art. 24-5 de la loi du 10 juillet 1965).
 */
interface CarregamentoVETextes {
  titre: string
  chapeau: string
  kpi: { actives: string; approuvees: string; bornes: string; puissance: string; consommation: string; consommationValeur: string; cout: string }
  onglets: { ped: string; inst: string; leg: string; inc: string }
  enregistrer: string
  enregistrerToast: string
  enDeveloppement: string
  statuts: Record<StatutDemandeVE, string>
  examiner: string
  examinerToast: string
  plusActions: string
  demo: DemandeVE[]
}

export const CARREGAMENTO_VE_MESSAGES = defineMessages<CarregamentoVETextes>({
  'pt-PT': {
    titre: 'Carregamento de Veículos Elétricos',
    chapeau: 'Gestão de infraestrutura VE em condomínios · DL 101-D/2020 · Art.° 59.°-A',
    kpi: { actives: 'Pedidos Ativos', approuvees: 'Aprovados', bornes: 'Postos Ativos', puissance: 'Potência Total', consommation: 'Consumo Total', consommationValeur: '2315 kWh', cout: 'Custo Total' },
    onglets: { ped: 'Pedidos', inst: 'Postos Instalados', leg: 'Legislação', inc: 'Incentivos' },
    enregistrer: '+ Registar Novo Pedido',
    enregistrerToast: 'Registar pedido',
    enDeveloppement: 'Gestão de carregamento VE em desenvolvimento',
    statuts: { analise: 'Em Análise', aprovado: 'Aprovado', pendente: 'Pendente' },
    examiner: 'Analisar',
    examinerToast: 'Analisar pedido',
    plusActions: 'Mais ações',
    demo: [
      { nom: 'Carlos Ferreira', detail: 'Fração B - 1.° Esq. · Garagem -1, Lugar 12 · 7.4 kW', statut: 'analise', usage: 'Uso Exclusivo', notification: 'Comunicação: 15/02/2026', echeance: 'Prazo decisão: 16/04/2026 (Expirado!)', depassee: true, pct: 75, kind: 'rust' },
      { nom: 'Ana Rodrigues', detail: 'Fração D - 3.° Dto. · Garagem -1, Lugar 28 · 11 kW', statut: 'aprovado', usage: 'Uso Exclusivo', notification: 'Comunicação: 10/01/2026', echeance: 'Decisão: 20/02/2026', depassee: false, pct: 100, kind: 'sage' },
      { nom: 'Miguel Santos', detail: 'Fração A - R/C · Garagem -2, Lugar 5 · 22 kW', statut: 'pendente', usage: 'Uso Partilhado', notification: 'Comunicação: 01/03/2026', echeance: 'Prazo decisão: 30/04/2026 (Expirado!)', depassee: true, pct: 50, kind: 'amber' },
    ],
  },
  'fr-FR': {
    titre: 'Bornes de recharge des véhicules électriques',
    chapeau: 'Infrastructures de recharge (IRVE) en copropriété · Droit à la prise (art. L113-16 du CCH) · Art. 24-5 de la loi du 10 juillet 1965',
    kpi: { actives: 'Demandes actives', approuvees: 'Acceptées', bornes: 'Bornes actives', puissance: 'Puissance totale', consommation: 'Consommation totale', consommationValeur: '2 315 kWh', cout: 'Coût total' },
    onglets: { ped: 'Demandes', inst: 'Bornes installées', leg: 'Réglementation', inc: 'Aides' },
    enregistrer: '+ Enregistrer une nouvelle demande',
    enregistrerToast: 'Enregistrer une demande',
    enDeveloppement: 'Gestion des bornes de recharge en cours de développement',
    statuts: { analise: "En cours d'examen", aprovado: 'Acceptée', pendente: 'En attente' },
    examiner: 'Examiner',
    examinerToast: 'Examiner la demande',
    plusActions: "Plus d'actions",
    demo: [
      { nom: 'Charles Ferrand', detail: 'Lot 14 — Apt B11 · Parking niveau -1, place 12 · 7,4 kW', statut: 'analise', usage: 'Usage individuel', notification: 'Notification : 16/01/2026', echeance: 'Réponse attendue : 16/04/2026 (dépassée !)', depassee: true, pct: 75, kind: 'rust' },
      { nom: 'Anne Rodier', detail: 'Lot 31 — Apt D32 · Parking niveau -1, place 28 · 11 kW', statut: 'aprovado', usage: 'Usage individuel', notification: 'Notification : 10/01/2026', echeance: 'Réponse : 20/02/2026', depassee: false, pct: 100, kind: 'sage' },
      { nom: 'Mickaël Sanchez', detail: 'Lot 2 — Apt A01 (RDC) · Parking niveau -2, place 5 · 22 kW', statut: 'pendente', usage: 'Usage partagé', notification: 'Notification : 30/01/2026', echeance: 'Réponse attendue : 30/04/2026 (dépassée !)', depassee: true, pct: 50, kind: 'amber' },
    ],
  },
})
