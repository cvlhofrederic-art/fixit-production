/** Module du catalogue : [id de route, titre, description, icône, activé par défaut]. */
export type ModuleCatalogue = [id: string, titre: string, description: string, icone: string, actifParDefaut: boolean]

/** Catalogue de modules activables. Les ids reprennent des routes du registre, mais l'activation reste sans effet (démo). */
export const CATALOGUE_MODULES: ModuleCatalogue[] = [
  ['cockpit', 'Cockpit du jour', 'Pilotage quotidien & échéances', 'bolt', true],
  ['mandats', 'Mandats judiciaires', 'Suivi des ordonnances & missions', 'scale', true],
  ['compta', 'Comptabilité', 'Compte séparé, appels, reddition', 'bank', true],
  ['canal', 'Canal de communication', 'Échanges par dossier', 'chat', true],
  ['planning', 'Planning', 'Agenda hebdomadaire', 'calendar', true],
  ['doleances', 'Doléances', 'Incidents & réclamations', 'clipboard', true],
  ['pointage', 'Pointage terrain', 'Pointage géolocalisé automatique des gestionnaires', 'pin', true],
  ['tempsDossiers', 'Suivi des dossiers', 'Temps par dossier & alertes de retard', 'clock', true],
  ['rgpd', 'Centre RGPD', 'Registre & droits des titulaires', 'shield', false],
  ['signature', 'Signature électronique', 'Documents en signature eIDAS', 'pencil', false],
  ['nps', 'NPS prestataires', 'Satisfaction post-intervention', 'poll', false],
]
