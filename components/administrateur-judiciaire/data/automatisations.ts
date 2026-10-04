import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

export type StatutAutomatisation = 'Succès' | 'Partiel' | 'En pause'

/** Tâche planifiée de Tempo. Le statut et la pastille vont de pair (« En pause » ↔ gold, « Succès » ↔ sage). */
export interface Automatisation {
  id: string
  nom: string
  type: string
  agenda: string
  last: string
  statut: StatutAutomatisation
  pill: 'sage' | 'amber' | 'gold'
}

export const DEMO_AUTOMATISATIONS: Automatisation[] = [
  {
    id: 'a1',
    nom: 'Sauvegarde des documents — hebdomadaire',
    type: 'Sauvegarde',
    agenda: 'Chaque dimanche à 2 h',
    last: '31 mai',
    statut: 'Succès',
    pill: 'sage',
  },
  {
    id: 'a2',
    nom: 'Relance des impayés (plus de 30 jours)',
    type: 'Recouvrement',
    agenda: 'Chaque lundi à 10 h',
    last: '1 juin',
    statut: 'Partiel',
    pill: 'amber',
  },
  {
    id: 'a3',
    nom: 'Alerte échéance de mission (J-90)',
    type: 'Échéance légale',
    agenda: 'Quotidien à 8 h',
    last: '4 juin',
    statut: 'Succès',
    pill: 'sage',
  },
  {
    id: 'a4',
    nom: 'Rapport de gestion mensuel au tribunal',
    type: 'Rapport',
    agenda: 'Dernier jour du mois à 18 h',
    last: '31 mai',
    statut: 'Succès',
    pill: 'sage',
  },
  {
    id: 'a5',
    nom: 'Rappel de convocation AG élective (J-30)',
    type: 'Convocation',
    agenda: "30 jours avant l'AG",
    last: '—',
    statut: 'En pause',
    pill: 'gold',
  },
  {
    id: 'a6',
    nom: 'Notification des nouvelles ordonnances',
    type: 'Notification',
    agenda: 'À la désignation',
    last: '12 mai',
    statut: 'Succès',
    pill: 'sage',
  },
  {
    id: 'a7',
    nom: 'Relance de la taxation des honoraires',
    type: 'Taxation',
    agenda: 'Mensuel',
    last: '28 mai',
    statut: 'Succès',
    pill: 'sage',
  },
]

/** Action groupée proposée selon le rôle de travail. */
export interface AutomatisationRole {
  id: string
  label: string
  hint: string
  icon: string
  roles: RoleCabinet[]
  /** Message de résultat calculé sur les copropriétés de démonstration (jamais appelé par la maquette). */
  run: () => string
}

/**
 * Automatisations proposées par rôle. Le clic ne fait qu'afficher un toast de simulation :
 * `run` est conservé tel quel mais n'est appelé nulle part.
 */
export const AUTOMATISATIONS_PAR_ROLE: AutomatisationRole[] = [
  {
    id: 'conv',
    label: "Générer les convocations d'AG dues",
    hint: 'Missions à échéance < 120 j',
    icon: 'bank',
    roles: ['Juridique', 'Secrétariat'],
    run: () =>
      `${
        DEMO_COPROPRIETES.filter((copro) => {
          const jours = joursAvantDateFr(copro.echeance)
          return jours != null && jours <= 120
        }).length
      } convocation(s) générée(s) et planifiée(s)`,
  },
  {
    id: 'imp',
    label: "Lancer les relances d'impayés",
    hint: 'Copropriétés avec arriérés',
    icon: 'coin',
    roles: ['Comptabilité'],
    run: () => `${DEMO_COPROPRIETES.filter((copro) => copro.impayes > 0).length} relance(s) LRAR préparée(s)`,
  },
  {
    id: 'rap',
    label: 'Produire les rapports mensuels',
    hint: 'Rapport de gestion au tribunal',
    icon: 'doc',
    roles: ['Comptabilité', 'Secrétariat'],
    run: () => `${DEMO_COPROPRIETES.length} rapport(s) de gestion générés`,
  },
  {
    id: 'notif',
    label: 'Notifier les ordonnances en attente',
    hint: 'Art. 59 ou 62-5 · dans le mois du prononcé',
    icon: 'siren',
    roles: ['Secrétariat', 'Juridique'],
    run: () =>
      `${Math.max(
        1,
        DEMO_COPROPRIETES.filter((copro) => (copro.statut || '').toLowerCase().includes('notification')).length,
      )} notification(s) envoyée(s)`,
  },
]
