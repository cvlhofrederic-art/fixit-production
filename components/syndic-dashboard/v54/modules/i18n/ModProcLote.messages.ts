import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { IconName } from '@/lib/syndic/icon-names'

/** Carte d'action de masse : icône, intitulé, description. */
export type ActionLot = readonly [IconName, string, string]

interface ProcLoteTextes {
  titre: string
  chapeau: string
  kpi: { executions: string; terminees: string; erreurs: string; planifications: string }
  onglets: { exec: string; hist: string; ag: string; rel: string }
  immeubleCible: string
  tousLesImmeubles: string
  actions: readonly ActionLot[]
}

export const PROC_LOTE_MESSAGES = defineMessages<ProcLoteTextes>({
  'pt-PT': {
    titre: 'Processamentos em Lote',
    chapeau: 'Automatize tarefas repetitivas: emissão de quotas, relances, encerramento de exercício',
    kpi: { executions: 'Execuções totais', terminees: 'Concluídas', erreurs: 'Com erros', planifications: 'Agendamentos ativos' },
    onglets: { exec: '▶ Executar', hist: 'Histórico', ag: 'Agendamentos', rel: 'Relatório' },
    immeubleCible: 'Edifício alvo',
    tousLesImmeubles: 'Todos os edifícios',
    actions: [
      ['coin', 'Emissão de Quotas', 'Gerar avisos de pagamento de quotas para todos os condóminos'],
      ['alert', 'Relance de Impagados', 'Enviar avisos automáticos para quotas em atraso (30, 60, 90 dias)'],
      ['chart', 'Encerramento de Exercício', 'Fechar exercício fiscal: balanço, relatório de contas, preparar novo ano'],
      ['coin', 'Atualização Fundo de Reserva', 'Recalcular e atualizar fundo de reserva legal (mín. 10% orçamento - DL 268/94)'],
      ['doc', 'Geração de Recibos', 'Gerar recibos em lote para pagamentos recebidos no período'],
      ['bank', 'Convocatória AG em Lote', 'Enviar convocatórias para Assembleia Geral a todos os condóminos'],
    ],
  },
  'fr-FR': {
    titre: 'Traitements par lots',
    chapeau: "Automatisez les tâches répétitives : appels de fonds, relances, clôture de l'exercice",
    kpi: { executions: 'Exécutions au total', terminees: 'Terminées', erreurs: 'En erreur', planifications: 'Planifications actives' },
    onglets: { exec: '▶ Exécuter', hist: 'Historique', ag: 'Planifications', rel: 'Rapport' },
    immeubleCible: 'Immeuble ciblé',
    tousLesImmeubles: 'Tous les immeubles',
    actions: [
      ['coin', 'Appels de fonds', 'Émettre les appels de provisions sur charges pour tous les copropriétaires (art. 14-1 de la loi du 10 juillet 1965)'],
      ['alert', 'Relance des impayés', 'Envoyer des relances automatiques pour les charges impayées (30, 60, 90 jours), puis la mise en demeure'],
      ['chart', "Clôture de l'exercice", "Clôturer l'exercice comptable : comptes et annexes (décret n° 2005-240), préparation de l'exercice suivant"],
      ['coin', 'Cotisation au fonds de travaux', 'Calculer et appeler la cotisation annuelle au fonds de travaux (au moins 5 % du budget prévisionnel et 2,5 % des travaux du PPT adopté — art. 14-2-1 de la loi du 10 juillet 1965)'],
      ['doc', 'Édition des reçus', 'Éditer en lot les reçus des paiements encaissés sur la période'],
      ['bank', "Convocations d'AG en lot", "Envoyer la convocation à l'assemblée générale à tous les copropriétaires (au moins 21 jours avant — art. 9 du décret du 17 mars 1967)"],
    ],
  },
})
