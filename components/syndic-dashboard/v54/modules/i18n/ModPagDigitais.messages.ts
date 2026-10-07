import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Paiement de démonstration : copropriétaire, lot, montant, mode de paiement, date. */
export type PaiementDemo = readonly [string, string, string, string, string]

/** Textes de l'écran « Pagamentos Digitais » / « Paiements en ligne ». */
interface PagDigitaisTextes {
  titre: string
  chapeau: string
  onglets: { dash: string; mb: string; rec: string; cfg: string }
  kpi: { encaisse: string; enAttente: string; taux: string; tauxValeur: string; retard: string }
  repartition: { titre: string; encaisse: string; enAttente: string }
  derniers: string
  colonnes: { coproprietaire: string; lot: string; montant: string; mode: string; date: string }
  demo: PaiementDemo[]
}

export const PAG_DIGITAIS_MESSAGES = defineMessages<PagDigitaisTextes>({
  'pt-PT': {
    titre: 'Pagamentos Digitais',
    chapeau: 'Gestão de cobranças, referências Multibanco e reconciliação bancária',
    onglets: { dash: 'Dashboard', mb: 'Referências MB', rec: 'Reconciliação', cfg: 'Configuração' },
    kpi: { encaisse: 'Total cobrado este mês', enAttente: 'Pagamentos pendentes', taux: 'Taxa de cobrança', tauxValeur: '0.0%', retard: 'Atraso médio (dias)' },
    repartition: { titre: 'Cobrado vs Pendente', encaisse: 'Cobrado', enAttente: 'Pendente' },
    derniers: 'Últimos 10 pagamentos recebidos',
    colonnes: { coproprietaire: 'Condómino', lot: 'Fração', montant: 'Valor', mode: 'Método', date: 'Data' },
    demo: [
      ['Ana Silva', 'A-1.°Esq', '185,00 €', 'Multibanco', '10/03/2026'],
      ['Carlos Mendes', 'B-2.°Dto', '210,50 €', 'MB Way', '09/03/2026'],
      ['Beatriz Costa', 'A-R/C', '150,00 €', 'Transferência', '08/03/2026'],
      ['Diogo Ferreira', 'C-3.°Esq', '195,75 €', 'Débito Direto', '07/03/2026'],
    ],
  },
  'fr-FR': {
    titre: 'Paiements en ligne',
    chapeau: 'Encaissement des appels de fonds, mandats de prélèvement SEPA et rapprochement bancaire',
    onglets: { dash: 'Tableau de bord', mb: 'Mandats SEPA', rec: 'Rapprochement bancaire', cfg: 'Configuration' },
    kpi: { encaisse: 'Total encaissé ce mois-ci', enAttente: 'Paiements en attente', taux: "Taux d'encaissement", tauxValeur: '0,0 %', retard: 'Retard moyen (jours)' },
    repartition: { titre: 'Encaissé / en attente', encaisse: 'Encaissé', enAttente: 'En attente' },
    derniers: '10 derniers paiements reçus',
    colonnes: { coproprietaire: 'Copropriétaire', lot: 'Lot', montant: 'Montant', mode: 'Mode de paiement', date: 'Date' },
    demo: [
      ['Anne Simon', 'Lot 12 — Apt A11', '185,00 €', 'Carte bancaire', '10/03/2026'],
      ['Claude Mercier', 'Lot 23 — Apt B22', '210,50 €', 'Virement instantané', '09/03/2026'],
      ['Béatrice Colin', 'Lot 2 — Apt A01', '150,00 €', 'Virement', '08/03/2026'],
      ['Damien Ferrand', 'Lot 31 — Apt C31', '195,75 €', 'Prélèvement SEPA', '07/03/2026'],
    ],
  },
})
