// Moteur de tâches du cockpit — port byte-exact du mockup v8. Chaque tâche est
// rattachée à un rôle, une copropriété (code), un fondement légal, une échéance,
// et une action en un clic : génération d'acte (doc), navigation (nav) ou todo.

import { daysUntil } from '../lib/format'
import type { Role } from '../lib/role-context'
import { COPROS } from './mock'
import type { DocTemplateKey } from './doc-templates'

export interface Task {
  id: string
  role: Role
  code: string
  title: string
  basis: string
  due: string
  kind: 'doc' | 'nav' | 'todo'
  tpl?: DocTemplateKey
  nav?: string
  act?: string
}

export const TASKS: Task[] = [
  { id: 't01', role: 'Juridique', code: 'CV', title: "Convoquer l'assemblée générale élective", basis: 'art. 17 L. 1965 · art. 46 décret', due: '22/05/2026', kind: 'doc', tpl: 'convocation' },
  { id: 't02', role: 'Secrétariat', code: 'VM', title: "Notifier l'ordonnance aux copropriétaires", basis: 'art. 64 décret du 17 mars 1967', due: '28/05/2026', kind: 'doc', tpl: 'notification' },
  { id: 't03', role: 'Juridique', code: 'TL', title: 'Déposer la requête en prorogation de mission', basis: 'art. 29-1 L. 1965', due: '05/06/2026', kind: 'doc', tpl: 'requete' },
  { id: 't04', role: 'Comptabilité', code: 'LM', title: "Établir l'état de frais et honoraires", basis: 'CPC art. 704 à 718', due: '30/06/2026', kind: 'doc', tpl: 'etatfrais' },
  { id: 't05', role: 'Comptabilité', code: 'TL', title: 'Signifier la mise en demeure — SCI Belvédère', basis: 'art. 19 L. 1965 · 9 200 €', due: '02/06/2026', kind: 'doc', tpl: 'misedemeure' },
  { id: 't06', role: 'Gestion', code: 'LM', title: "Valider l'ordre de service OS-2026-050", basis: 'pouvoirs art. 18 à 18-2', due: '24/05/2026', kind: 'nav', nav: 'interventions', act: 'Ouvrir' },
  { id: 't07', role: 'Secrétariat', code: 'LM', title: "Finaliser le procès-verbal de l'AG du 18/05", basis: 'art. 17 décret', due: '01/06/2026', kind: 'doc', tpl: 'pv' },
  { id: 't08', role: 'Comptabilité', code: 'TL', title: 'Préparer la reddition de comptes au tribunal', basis: 'art. 29-1 et s. L. 1965', due: '05/06/2026', kind: 'nav', nav: 'reddition', act: 'Ouvrir' },
  { id: 't09', role: 'Gestion', code: 'TL', title: 'Planifier la visite technique toiture', basis: 'entretien parties communes', due: '08/06/2026', kind: 'nav', nav: 'planning', act: 'Planifier' },
  { id: 't10', role: 'Juridique', code: 'VM', title: "Mettre à jour l'immatriculation au registre", basis: 'loi ALUR · art. L.711-2 CCH', due: '28/07/2026', kind: 'nav', nav: 'immat', act: 'Ouvrir' },
  { id: 't11', role: 'Direction', code: 'LM', title: 'Signer électroniquement le PV du Méridien', basis: 'validation du syndic', due: '02/06/2026', kind: 'todo', act: 'Signer' },
  { id: 't12', role: 'Comptabilité', code: 'CV', title: "Renouveler l'assurance RC de la copropriété", basis: 'art. 9-1 L. 1965', due: '31/08/2026', kind: 'nav', nav: 'assurance', act: 'Ouvrir' },
  { id: 't13', role: 'Gestion', code: 'CV', title: 'Relancer le devis de ravalement de façade', basis: 'Façade & Ravalement IDF', due: '06/06/2026', kind: 'nav', nav: 'prestataires', act: 'Ouvrir' },
  { id: 't14', role: 'Juridique', code: 'LM', title: 'Vérifier le compte bancaire séparé', basis: 'art. 18 L. 1965', due: '15/06/2026', kind: 'nav', nav: 'compta', act: 'Vérifier' },
  { id: 't15', role: 'Comptabilité', code: 'LM', title: "Lancer l'appel de fonds du 3e trimestre", basis: 'budget prévisionnel voté', due: '10/06/2026', kind: 'nav', nav: 'appels', act: 'Ouvrir' },
  { id: 't16', role: 'Secrétariat', code: 'LM', title: 'Convoquer le conseil syndical', basis: 'réunion préparatoire AG', due: '03/06/2026', kind: 'todo', act: 'Planifier' },
]

/** Nombre de tâches urgentes (échéance ≤ 3 jours) — badge du cockpit. */
export const URGENT_COUNT = TASKS.filter((t) => {
  const d = daysUntil(t.due)
  return d != null && d <= 3
}).length

export interface BatchAction {
  id: string
  label: string
  hint: string
  icon: 'bank' | 'coin' | 'doc' | 'siren'
  roles: Role[]
  run: () => string
}

/** Actions par lot du cockpit (traitement groupé). */
export const BATCH: BatchAction[] = [
  { id: 'conv', label: "Générer les convocations d'AG dues", hint: 'Missions à échéance < 120 j', icon: 'bank', roles: ['Juridique', 'Secrétariat'],
    run: () => `${COPROS.filter((c) => { const d = daysUntil(c.echeance); return d != null && d <= 120 }).length} convocation(s) générée(s) et planifiée(s)` },
  { id: 'imp', label: "Lancer les relances d'impayés", hint: 'Copropriétés avec arriérés', icon: 'coin', roles: ['Comptabilité'],
    run: () => `${COPROS.filter((c) => c.impayes > 0).length} relance(s) LRAR préparée(s)` },
  { id: 'rap', label: 'Produire les rapports mensuels', hint: 'Rapport de gestion au tribunal', icon: 'doc', roles: ['Comptabilité', 'Secrétariat'],
    run: () => `${COPROS.length} rapport(s) de gestion générés` },
  { id: 'notif', label: 'Notifier les ordonnances en attente', hint: 'Art. 64 — dans le mois', icon: 'siren', roles: ['Secrétariat', 'Juridique'],
    run: () => `${Math.max(1, COPROS.filter((c) => (c.statut || '').toLowerCase().includes('notification')).length)} notification(s) envoyée(s)` },
]
