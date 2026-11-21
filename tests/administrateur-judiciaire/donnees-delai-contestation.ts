// Données d'exemple partagées par les tests du délai de contestation d'AG (décisions du 17/11/2026, J52 à J66).
import type { ChangementStatut, Courrier } from '@/lib/administrateur-judiciaire/db/schema'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'

/** Ligne de statut d'AG « PV signé → Notifiée » du 05/03/2026, rattachée au courrier k1 ; `surcharge` la modifie. */
export const ligne = (surcharge: Partial<ChangementStatut>): ChangementStatut => ({
  id: 'cs',
  entiteType: 'ag',
  entiteId: 'ag-1',
  statutAncien: 'PV signé',
  statutNouveau: 'Notifiée',
  dateEffet: d(2026, 3, 5),
  courrierId: 'k1',
  horsSequence: false,
  motif: null,
  createdAt: `${d(2026, 3, 6)}T10:00:00.000Z`,
  updatedAt: `${d(2026, 3, 6)}T10:00:00.000Z`,
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

/** Chaîne complète dont la notification est datée `notifLe` (convoquée le 01/10/2025, PV signé le 01/11/2025). */
export const chaineLe = (notifLe: string): ChangementStatut[] => [
  ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: d(2025, 10, 1), courrierId: null }),
  ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: d(2025, 11, 1), courrierId: null }),
  ligne({ id: 'c3', dateEffet: notifLe }),
]

/** Lettre recommandée électronique adressée à id-1, déposée et avisée le `date`. */
export const lreLe = (date: string, surcharge: Partial<Courrier> = {}): Courrier => ({
  id: 'k1',
  modeleId: 'm1',
  formeEnvoi: 'Email',
  modeNotification: 'lre',
  statut: 'A Suivre',
  objet: 'Notification du PV',
  coproprieteId: null,
  mandatId: null,
  personneId: 'id-1',
  entrepriseId: null,
  dateDepot: date,
  datePremierePresentation: null,
  dateAvisElectronique: date,
  dateAccuseReception: null,
  referenceDiffusion: null,
  createdAt: `${date}T09:00:00.000Z`,
  updatedAt: `${date}T09:00:00.000Z`,
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})
