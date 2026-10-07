import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Priorité affichée d'une urgence (code interne ; le libellé dépend de la langue). */
export type PrioriteUrgence = 'critica' | 'alta' | 'media'

/**
 * État affiché d'une urgence (code interne). `procura`, `despacho`, `curso`,
 * `concluida`, `anulada` correspondent aux statuts de mission de l'API ;
 * `despachada` n'existe que dans la démonstration.
 */
export type EtatUrgence = 'procura' | 'despacho' | 'despachada' | 'curso' | 'concluida' | 'anulada'

/** Ligne de démonstration : intervention, immeuble, priorité, prestataire, état, délai. */
export interface UrgenceDemo {
  tipo: string
  edificio: string
  prioridade: PrioriteUrgence
  profissional: string
  estado: EtatUrgence
  tempo: string
}

interface UrgenciasTextes {
  titre: string
  chapeau: string
  nouvelleUrgence: string
  nouvelleUrgenceDesc: string
  onglets: { ativas: string; despacho: string; profissionais: string; hist: string }
  alerte: { titre: string; texte: string }
  kpi: { actives: string; enDispatch: string; disponibles: string; delaiMoyen: string; delaiMoyenDemo: string }
  panneau: string
  colonnes: { type: string; immeuble: string; priorite: string; prestataire: string; etat: string; delai: string }
  aucuneUrgence: string
  interventionParDefaut: string
  prioriteUrgente: string
  priorites: Record<PrioriteUrgence, string>
  etats: Record<EtatUrgence, string>
  demo: UrgenceDemo[]
}

export const URGENCIAS_MESSAGES = defineMessages<UrgenciasTextes>({
  'pt-PT': {
    titre: 'Urgências Técnicas',
    chapeau: 'Despacho imediato para o profissional VITFIX disponível',
    nouvelleUrgence: 'Nova urgência',
    nouvelleUrgenceDesc: 'Despacho de urgências em desenvolvimento',
    onglets: { ativas: 'Ativas', despacho: 'Despacho', profissionais: 'Profissionais', hist: 'Histórico' },
    alerte: {
      titre: 'Despacho automático ativo',
      texte: 'As urgências críticas são despachadas automaticamente para o profissional VITFIX disponível mais próximo, com confirmação em tempo real.',
    },
    kpi: {
      actives: 'Urgências ativas',
      enDispatch: 'Em despacho',
      disponibles: 'Profissionais disponíveis',
      delaiMoyen: 'Tempo médio de resposta',
      delaiMoyenDemo: '9 min',
    },
    panneau: 'Urgências ativas',
    colonnes: { type: 'Tipo', immeuble: 'Edifício', priorite: 'Prioridade', prestataire: 'Profissional', etat: 'Estado', delai: 'Tempo' },
    aucuneUrgence: 'Nenhuma urgência ativa.',
    interventionParDefaut: 'Intervenção',
    prioriteUrgente: 'Urgente',
    priorites: { critica: 'Crítica', alta: 'Alta', media: 'Média' },
    etats: { procura: 'À procura', despacho: 'Em despacho', despachada: 'Despachada', curso: 'Em curso', concluida: 'Concluída', anulada: 'Anulada' },
    demo: [
      { tipo: 'Fuga de água na garagem B2', edificio: 'Edifício Aurora', prioridade: 'critica', profissional: 'HidroPro Lda', estado: 'despachada', tempo: '6 min' },
      { tipo: 'Elevador bloqueado no 4.º', edificio: 'Edifício Bela Vista', prioridade: 'alta', profissional: 'ElevaTech', estado: 'despacho', tempo: '11 min' },
      { tipo: 'Curto-circuito no hall', edificio: 'Residencial Cedofeita', prioridade: 'alta', profissional: '—', estado: 'procura', tempo: '2 min' },
      { tipo: 'Infiltração no teto do R/C', edificio: 'Condomínio Boavista Center', prioridade: 'media', profissional: 'ConstruFix', estado: 'despachada', tempo: '18 min' },
    ],
  },
  'fr-FR': {
    titre: 'Urgences techniques',
    chapeau: 'Affectation immédiate au prestataire VitFix disponible',
    nouvelleUrgence: 'Nouvelle urgence',
    nouvelleUrgenceDesc: 'Affectation des urgences en cours de développement',
    onglets: { ativas: 'Actives', despacho: 'Affectation', profissionais: 'Prestataires', hist: 'Historique' },
    alerte: {
      titre: 'Affectation automatique activée',
      texte: 'Les urgences critiques sont confiées automatiquement au prestataire VitFix disponible le plus proche, avec confirmation en temps réel.',
    },
    kpi: {
      actives: 'Urgences actives',
      enDispatch: "En cours d'affectation",
      disponibles: 'Prestataires disponibles',
      delaiMoyen: 'Temps de réponse moyen',
      delaiMoyenDemo: '9 min',
    },
    panneau: 'Urgences actives',
    colonnes: { type: 'Type', immeuble: 'Immeuble', priorite: 'Priorité', prestataire: 'Prestataire', etat: 'Statut', delai: 'Délai' },
    aucuneUrgence: 'Aucune urgence active.',
    interventionParDefaut: 'Intervention',
    prioriteUrgente: 'Urgente',
    priorites: { critica: 'Critique', alta: 'Haute', media: 'Moyenne' },
    etats: { procura: "Recherche d'un prestataire", despacho: "En cours d'affectation", despachada: 'Affectée', curso: 'En cours', concluida: 'Terminée', anulada: 'Annulée' },
    demo: [
      { tipo: "Fuite d'eau au parking, niveau -2", edificio: 'Résidence Aurore', prioridade: 'critica', profissional: 'HydroPro SARL', estado: 'despachada', tempo: '6 min' },
      { tipo: 'Ascenseur bloqué au 4e étage', edificio: 'Résidence Belle Vue', prioridade: 'alta', profissional: 'ElevaTech', estado: 'despacho', tempo: '11 min' },
      { tipo: 'Court-circuit dans le hall', edificio: 'Résidence Croix-Rousse', prioridade: 'alta', profissional: '—', estado: 'procura', tempo: '2 min' },
      { tipo: 'Infiltration au plafond du RDC', edificio: 'Copropriété Bellecour Center', prioridade: 'media', profissional: 'ConstruFix SARL', estado: 'despachada', tempo: '18 min' },
    ],
  },
})
