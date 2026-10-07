import { defineMessages } from '@/lib/syndic/v54/i18n'

interface AgLiveTextes {
  titre: string
  chapeau: string
  kpi: { total: string; cloturees: string; presents: string; voixValeur: string; voix: string }
  onglets: { live: string; ag: string; hist: string; cfg: string }
  vide: { titre: string; desc: string }
  planifier: string
  planificationBientot: string
}

export const AG_LIVE_MESSAGES = defineMessages<AgLiveTextes>({
  'pt-PT': {
    titre: 'Assembleia Geral Digital',
    chapeau: 'Sessão em tempo real · Votação instantânea · Controlo de presenças · Ata automática',
    kpi: { total: 'Total AGs', cloturees: 'Encerradas', presents: 'Presentes (live)', voixValeur: '0‰', voix: 'Permilagem (live)' },
    onglets: { live: 'Sessão Live', ag: 'Agendar AG', hist: 'Histórico', cfg: 'Configuração' },
    vide: { titre: 'Nenhuma AG em curso', desc: 'Agende uma AG ou inicie uma sessão agendada' },
    planifier: 'Agendar nova AG',
    planificationBientot: 'Agendamento de assembleias em desenvolvimento',
  },
  'fr-FR': {
    titre: 'AG en direct',
    chapeau: 'Séance en temps réel · Vote instantané · Feuille de présence · Procès-verbal automatique',
    kpi: { total: 'Total des AG', cloturees: 'Clôturées', presents: 'Présents (en direct)', voixValeur: '0', voix: 'Tantièmes présents et représentés (en direct)' },
    onglets: { live: 'Séance en direct', ag: 'Planifier une AG', hist: 'Historique', cfg: 'Configuration' },
    vide: { titre: 'Aucune AG en cours', desc: 'Planifiez une AG ou ouvrez une séance programmée' },
    planifier: 'Planifier une nouvelle AG',
    planificationBientot: 'Planification des assemblées en cours de développement',
  },
})
