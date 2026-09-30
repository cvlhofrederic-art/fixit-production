import { ROUTE_SOUS_TITRE, SECTIONS_NAVIGATION } from '@/components/administrateur-judiciaire/shell/nav-config'

/**
 * Accès des collaborateurs par rôle (écran « Équipe du cabinet ») : catalogue des modules attribuables, rôles de
 * l'équipe et préréglages d'accès appliqués à la création d'un compte.
 */

/** Pseudo-route de la section « Compte » (« Déconnexion »), jamais attribuable. */
const ROUTE_DECONNEXION = 'logout'

/**
 * Titres des sections de la barre latérale dont les modules peuvent être attribués. Sert uniquement de filtre :
 * l'ordre affiché suit la configuration de navigation (Agents IA d'abord), pas ce tableau.
 */
export const SECTIONS_MODULES_ATTRIBUABLES: readonly string[] = [
  'Mandat judiciaire',
  'Pilotage judiciaire',
  'Cabinet & supervision',
  'Gestion courante',
  'Patrimoine',
  'Comptabilité & finances',
  'Copropriétaires (Extranet)',
  'Technique & travaux',
  'Conformité légale',
  'Outils IA',
  'Agents IA',
]

/** Module attribuable : route, libellé et pictogramme de son entrée de navigation. */
export interface ModuleAttribuable {
  id: string
  label: string
  icon: string | undefined
}

/** Groupe de modules attribuables (une section de la barre latérale). */
export interface GroupeModules {
  title: string
  items: ModuleAttribuable[]
}

/**
 * Catalogue des modules attribuables, groupés par section dans l'ordre de la navigation, sans sous-titres ni
 * déconnexion ; les groupes vides sont retirés. 74 modules au total (affiché « Tous (74) », « sur 74 »).
 */
export const listerGroupesModulesAttribuables = (): GroupeModules[] =>
  SECTIONS_NAVIGATION.filter((section) => SECTIONS_MODULES_ATTRIBUABLES.includes(section.title))
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter((entree) => entree[0] !== ROUTE_SOUS_TITRE && entree[0] !== ROUTE_DECONNEXION)
        .map((entree) => ({
          id: entree[0],
          label: entree[1],
          icon: entree[2],
        })),
    }))
    .filter((groupe) => groupe.items.length)

/**
 * Rôles des membres de l'équipe (écran « Équipe du cabinet »), distincts des rôles de travail ROLES_CABINET.
 * L'ordre fixe celui des options du sélecteur « Rôle » et des lignes du tableau des accès par défaut.
 */
export const ROLES_EQUIPE_CABINET = [
  'Direction / syndic judiciaire',
  'Gestionnaire de mandats',
  'Gestionnaire technique',
  'Juriste',
  'Comptable',
  'Assistante',
] as const

export type RoleEquipeCabinet = (typeof ROLES_EQUIPE_CABINET)[number]

/** Teinte de l'avatar d'un membre (classe `team-dd-avatar accent-<teinte>`). */
export type TeinteRole = 'gold' | 'sage' | 'amber'

/** Sections accordées par défaut à chaque rôle ; « * » = tous les modules. */
export const SECTIONS_PAR_ROLE: Readonly<Record<RoleEquipeCabinet, '*' | readonly string[]>> = {
  'Direction / syndic judiciaire': '*',
  'Gestionnaire de mandats': [
    'Mandat judiciaire',
    'Gestion courante',
    'Patrimoine',
    'Comptabilité & finances',
    'Copropriétaires (Extranet)',
    'Conformité légale',
    'Outils IA',
    'Agents IA',
  ],
  'Gestionnaire technique': ['Gestion courante', 'Patrimoine', 'Technique & travaux'],
  Juriste: ['Mandat judiciaire', 'Pilotage judiciaire', 'Conformité légale', 'Agents IA'],
  Comptable: ['Comptabilité & finances'],
  Assistante: ['Copropriétaires (Extranet)', 'Gestion courante'],
}

/** Modules accordés en plus des sections (ajoutés seulement s'ils existent dans le catalogue attribuable). */
export const MODULES_SUPPLEMENTAIRES_PAR_ROLE: Readonly<Partial<Record<RoleEquipeCabinet, readonly string[]>>> = {
  'Gestionnaire technique': ['pointage', 'tempsDossiers'],
  'Gestionnaire de mandats': ['tempsDossiers'],
  Comptable: ['tempsDossiers', 'portefeuille'],
  Juriste: ['portefeuille'],
  Assistante: ['alfredo', 'signature', 'comDigitale'],
}

/** Teinte de l'avatar selon le rôle (à défaut, l'appelant retient « sage »). */
export const TEINTE_PAR_ROLE: Readonly<Record<RoleEquipeCabinet, TeinteRole>> = {
  'Direction / syndic judiciaire': 'gold',
  'Gestionnaire de mandats': 'sage',
  'Gestionnaire technique': 'sage',
  Juriste: 'amber',
  Comptable: 'sage',
  Assistante: 'sage',
}

/** Périmètre décrit dans le tableau des accès par défaut. */
export const PERIMETRE_PAR_ROLE: Readonly<Record<RoleEquipeCabinet, string>> = {
  'Direction / syndic judiciaire': 'Accès complet, validation & signature',
  'Gestionnaire de mandats': 'Gestion, copropriétés, compta, AG, extranet',
  'Gestionnaire technique': 'Travaux, prestataires, interventions, pointage terrain',
  Juriste: 'Pilotage judiciaire, ordonnances, conformité',
  Comptable: 'Comptabilité, appels, impayés, fonds, banque',
  Assistante: 'Extranet, communication, courriers, planning',
}

/** Vues des tables par rôle, indexables par une chaîne quelconque (valeur d'un <select>, rôle d'un membre). */
const sectionsParRole: Readonly<Partial<Record<string, '*' | readonly string[]>>> = SECTIONS_PAR_ROLE
const modulesSupplementairesParRole: Readonly<Partial<Record<string, readonly string[]>>> =
  MODULES_SUPPLEMENTAIRES_PAR_ROLE
const teintesParRole: Readonly<Partial<Record<string, TeinteRole>>> = TEINTE_PAR_ROLE

/** Teinte associée à un rôle quelconque (undefined pour un rôle inconnu). */
export const teinteDuRole = (role: string): TeinteRole | undefined => teintesParRole[role]

/**
 * Identifiants des modules accordés par défaut à un rôle : tout le catalogue pour « * », sinon les modules des
 * sections du rôle (ordre du catalogue) puis ses modules supplémentaires. Un rôle inconnu donne un ensemble vide.
 */
export const modulesParDefautDuRole = (role: string): Set<string> => {
  const groupes = listerGroupesModulesAttribuables()
  const tousLesModules = groupes.flatMap((groupe) => groupe.items.map((entree) => entree.id))
  const sections = sectionsParRole[role]
  if (sections === '*') return new Set(tousLesModules)
  const modules = new Set<string>()
  groupes.forEach((groupe) => {
    if (sections && sections.indexOf(groupe.title) >= 0) groupe.items.forEach((entree) => modules.add(entree.id))
  })
  ;(modulesSupplementairesParRole[role] || []).forEach((id) => {
    if (tousLesModules.indexOf(id) >= 0) modules.add(id)
  })
  return modules
}

/** Membre de l'équipe affiché dans l'écran « Équipe du cabinet ». access = identifiants des modules accordés. */
export interface MembreEquipe {
  init: string
  name: string
  role: string
  email: string
  accent: TeinteRole
  access: string[]
}

/** Saisie de la modale d'accès d'un collaborateur (création ou modification). */
export interface AccesCollaborateurSaisi {
  name: string
  email: string
  role: string
  access: string[]
}
