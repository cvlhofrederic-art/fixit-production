import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { IconName } from '@/lib/syndic/icon-names'
import type { PillKind } from '../../primitives/pill'

/** Priorité d'un signalement (codes de l'API : basse | normale | haute | urgente). */
export type PrioriteOcorrencia = 'urgente' | 'haute' | 'normale' | 'basse'

/** Statut affiché d'un signalement réel (code interne ; le libellé dépend de la langue). */
export type StatutOcorrencia = 'resolvido' | 'aberto' | 'curso'

/** Ligne de démonstration : icône, titre, immeuble — demandeur, état d'avancement, priorité, teinte. */
export interface OcorrenciaDemo {
  icone: IconName
  titre: string
  lieu: string
  etat: string
  priorite: PrioriteOcorrencia
  kind: PillKind
}

interface OcorrenciasTextes {
  titre: string
  chapeau: string
  nouvelle: string
  nouvelleTitre: string
  nouvelleDesc: string
  onglets: { painel: string; oc: string; mp: string; qr: string }
  kpi: { total: string; abertas: string; emCurso: string; resolvidas: string; tempoMedio: string }
  /** Délai moyen de résolution de la démonstration. */
  tempoMedioDemo: string
  distribution: string
  sla: string
  slaPct: string
  slaDansLesDelais: string
  slaObjectifs: string
  dernieres: string
  aucune: string
  /** Titre de repli d'un signalement sans description ni type. */
  ocorrenciaParDefaut: string
  priorites: Record<PrioriteOcorrencia, string>
  statuts: Record<StatutOcorrencia, string>
  demo: OcorrenciaDemo[]
}

export const OCORRENCIAS_MESSAGES = defineMessages<OcorrenciasTextes>({
  'pt-PT': {
    titre: 'Ocorrências e Manutenção',
    chapeau: 'Gestão de incidentes, manutenções e reportes do condomínio',
    nouvelle: '+ Nova ocorrência',
    nouvelleTitre: 'Nova ocorrência',
    nouvelleDesc: 'Criação de ocorrências em desenvolvimento',
    onglets: { painel: 'Painel', oc: 'Ocorrências', mp: 'Mapa', qr: 'QR Codes' },
    kpi: { total: 'Total ocorrências', abertas: 'Abertas', emCurso: 'Em curso', resolvidas: 'Resolvidas', tempoMedio: 'Tempo médio resolução' },
    tempoMedioDemo: '5d',
    distribution: 'Distribuição por prioridade',
    sla: 'Conformidade SLA',
    slaPct: '67%',
    slaDansLesDelais: 'Dentro do prazo',
    slaObjectifs: 'Objetivos: Urgente 1d | Alta 3d | Média 7d | Baixa 14d',
    dernieres: 'Últimas ocorrências',
    aucune: 'Nenhuma ocorrência registada.',
    ocorrenciaParDefaut: 'Ocorrência',
    priorites: { urgente: 'Urgente', haute: 'Alta', normale: 'Média', basse: 'Baixa' },
    statuts: { resolvido: 'Resolvido', aberto: 'Aberto', curso: 'Em curso' },
    demo: [
      { icone: 'water', titre: 'Infiltração no teto da garagem B2', lieu: 'Edifício Aurora — Ana Silva', etat: 'Em reparação', priorite: 'urgente', kind: 'rust' },
      { icone: 'elevator', titre: 'Elevador bloqueia no 4.° andar', lieu: 'Edifício Aurora — Manuel Costa', etat: 'Prestador contactado', priorite: 'haute', kind: 'amber' },
      { icone: 'lightning', titre: 'Curto-circuito na iluminação do hall', lieu: 'Edifício Bela Vista — Maria Lopes', etat: 'Em análise', priorite: 'haute', kind: 'amber' },
      { icone: 'water', titre: 'Fuga de água na canalização do R/C', lieu: 'Edifício Aurora — Pedro Santos', etat: 'Aberto', priorite: 'urgente', kind: 'rust' },
      { icone: 'bank', titre: 'Grafiti na fachada norte', lieu: 'Edifício Bela Vista — Carla Martins', etat: 'Resolvido', priorite: 'normale', kind: 'sage' },
    ],
  },
  'fr-FR': {
    titre: 'Incidents et maintenance',
    chapeau: "Gestion des incidents, de l'entretien et des signalements de la copropriété",
    nouvelle: '+ Nouvel incident',
    nouvelleTitre: 'Nouvel incident',
    nouvelleDesc: 'Création des incidents en cours de développement',
    onglets: { painel: 'Tableau de bord', oc: 'Incidents', mp: 'Carte', qr: 'QR codes' },
    kpi: { total: 'Total des incidents', abertas: 'Ouverts', emCurso: 'En cours', resolvidas: 'Résolus', tempoMedio: 'Délai moyen de résolution' },
    tempoMedioDemo: '5 j',
    distribution: 'Répartition par priorité',
    sla: 'Respect des délais (SLA)',
    slaPct: '67 %',
    slaDansLesDelais: 'Dans les délais',
    slaObjectifs: 'Objectifs : Urgente 1 j | Haute 3 j | Normale 7 j | Basse 14 j',
    dernieres: 'Derniers incidents',
    aucune: 'Aucun incident enregistré.',
    ocorrenciaParDefaut: 'Incident',
    priorites: { urgente: 'Urgente', haute: 'Haute', normale: 'Normale', basse: 'Basse' },
    statuts: { resolvido: 'Résolu', aberto: 'Ouvert', curso: 'En cours' },
    demo: [
      { icone: 'water', titre: 'Infiltration au plafond du parking B2', lieu: 'Résidence Aurore — Anne Simon', etat: 'En réparation', priorite: 'urgente', kind: 'rust' },
      { icone: 'elevator', titre: 'Ascenseur bloqué au 4e étage', lieu: 'Résidence Aurore — Michel Costes', etat: 'Prestataire contacté', priorite: 'haute', kind: 'amber' },
      { icone: 'lightning', titre: "Court-circuit sur l'éclairage du hall", lieu: 'Résidence Belle Vue — Marie Laporte', etat: "En cours d'analyse", priorite: 'haute', kind: 'amber' },
      { icone: 'water', titre: "Fuite d'eau sur la canalisation du RDC", lieu: 'Résidence Aurore — Pierre Sanchez', etat: 'Ouvert', priorite: 'urgente', kind: 'rust' },
      { icone: 'bank', titre: 'Graffitis sur la façade nord', lieu: 'Résidence Belle Vue — Carole Martin', etat: 'Résolu', priorite: 'normale', kind: 'sage' },
    ],
  },
})
