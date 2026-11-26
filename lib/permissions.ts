// ══════════════════════════════════════════════════════════════════════════════
// VITFIX — Permission Engine for pro_societe sub-accounts
// Central authority for role-based access control
// ══════════════════════════════════════════════════════════════════════════════

export type AccessLevel = 'FULL' | 'READ' | 'NONE'

export type ProTeamRole =
  | 'GERANT'
  | 'CONDUCTEUR_TRAVAUX'
  | 'CHEF_CHANTIER'
  | 'SECRETAIRE'
  | 'COMPTABLE'
  | 'OUVRIER'

export const PRO_TEAM_ROLES: ProTeamRole[] = [
  'GERANT',
  'CONDUCTEUR_TRAVAUX',
  'CHEF_CHANTIER',
  'SECRETAIRE',
  'COMPTABLE',
  'OUVRIER',
]

// Labels FR / PT for each role
export const ROLE_LABELS: Record<ProTeamRole, { fr: string; pt: string }> = {
  GERANT:              { fr: 'Gérant',               pt: 'Gerente' },
  CONDUCTEUR_TRAVAUX:  { fr: 'Conducteur de travaux', pt: 'Diretor de obra' },
  CHEF_CHANTIER:       { fr: 'Chef de chantier',     pt: 'Encarregado' },
  SECRETAIRE:          { fr: 'Secrétaire',            pt: 'Administrativo(a)' },
  COMPTABLE:           { fr: 'Comptable',             pt: 'Contabilista' },
  OUVRIER:             { fr: 'Ouvrier',               pt: 'Operário' },
}

// All module slugs used in the pro_societe dashboard
// Includes shared modules from useModulesConfig + BTP-specific pages
export const ALL_PRO_MODULES = [
  // Shared
  'home', 'calendar', 'motifs', 'horaires', 'messages', 'clients',
  'devis', 'factures', 'rapports', 'contrats', 'stats', 'revenus',
  'comptabilite', 'materiaux', 'marches', 'wallet', 'portfolio',
  'pipeline', 'bibliotheque', 'parrainage', 'marketplace_btp',
  'photos_chantier', 'settings',
  // BTP-specific
  'chantiers', 'equipes', 'gantt', 'pointage',
  'compta_btp', 'rentabilite', 'rfq_btp',
  'situations', 'garanties', 'sous_traitance',
  'sous_traitance_offres', 'dpgf',
  // Écrans ouverts aux salariés dans l'appli (24/11/2026). Absents du catalogue jusque-là : getDefaultPermission
  // rendait NONE pour tout le monde et getEffectivePermissions jetait silencieusement toute dérogation posée sur eux
  // (`if (ov.module_id in base)`), donc le gérant ne pouvait ni les accorder ni les refuser.
  'meteo', 'dictionnaire_materiaux', 'estimation_materiaux',
  // Outils et véhicules de la société, vérifiés chaque vendredi par le responsable du chantier (26/11/2026).
  'outillage',
  // Admin
  'gestion_comptes',
] as const

export type ProModuleSlug = typeof ALL_PRO_MODULES[number]

// Module labels FR/PT (for the permissions UI)
export const MODULE_LABELS: Record<string, { fr: string; pt: string }> = {
  home:                  { fr: 'Tableau de bord',       pt: 'Painel' },
  calendar:              { fr: 'Agenda / Planning',     pt: 'Agenda / Planeamento' },
  chantiers:             { fr: 'Chantiers',             pt: 'Obras' },
  equipes:               { fr: 'Équipes',               pt: 'Equipas' },
  gantt:                 { fr: 'Planification Gantt',   pt: 'Planeamento Gantt' },
  pointage:              { fr: 'Pointage équipes',      pt: 'Registo de horas' },
  compta_btp:            { fr: 'Compta Intelligente',   pt: 'Contabilidade IA' },
  rentabilite:           { fr: 'Rentabilité Chantier',  pt: 'Rentabilidade' },
  rfq_btp:               { fr: 'Devis Fournisseurs',   pt: 'Orçamentos de fornecedores' },
  situations:            { fr: 'Situations de travaux', pt: 'Autos de medição' },
  garanties:             { fr: 'Retenues de garantie',  pt: 'Retenções para garantia' },
  sous_traitance:        { fr: 'Sous-traitance DC4',   pt: 'Subempreitadas' },
  sous_traitance_offres: { fr: 'Recruter sous-traitants', pt: 'Recrutar subempreiteiros' },
  dpgf:                  { fr: 'Appels d\'offres',      pt: 'Concursos / Mapas de quantidades' },
  meteo:                 { fr: 'Météo chantiers',       pt: 'Meteorologia das obras' },
  dictionnaire_materiaux:{ fr: 'Dictionnaire matériaux', pt: 'Dicionário de materiais' },
  estimation_materiaux:  { fr: 'Estimation matériaux',  pt: 'Estimativa de materiais' },
  outillage:             { fr: 'Outillage et véhicules', pt: 'Ferramentas e viaturas' },
  motifs:                { fr: 'Lots / Prestations',    pt: 'Lotes / Serviços' },
  horaires:              { fr: 'Horaires chantier',     pt: 'Horários de obra' },
  messages:              { fr: 'Messagerie',            pt: 'Mensagens' },
  clients:               { fr: 'Base clients',          pt: 'Base de clientes' },
  devis:                 { fr: 'Devis',                 pt: 'Orçamentos' },
  pipeline:              { fr: 'Pipeline',              pt: 'Pipeline' },
  factures:              { fr: 'Factures',              pt: 'Faturas' },
  rapports:              { fr: 'Rapports',              pt: 'Relatórios' },
  photos_chantier:       { fr: 'Photos Chantier',       pt: 'Fotos de obra' },
  bibliotheque:          { fr: 'Bibliothèque',          pt: 'Biblioteca' },
  contrats:              { fr: 'Contrats',              pt: 'Contratos' },
  stats:                 { fr: 'Statistiques',          pt: 'Estatísticas' },
  revenus:               { fr: 'Revenus',               pt: 'Receitas' },
  comptabilite:          { fr: 'Comptabilité',          pt: 'Contabilidade' },
  materiaux:             { fr: 'Matériaux & Appro',     pt: 'Materiais & Aprovisionamento' },
  marches:               { fr: 'Bourse aux Marchés',    pt: 'Bolsa de oportunidades' },
  marketplace_btp:       { fr: 'Marketplace BTP',       pt: 'Marketplace da construção' },
  wallet:                { fr: 'Conformité',            pt: 'Conformidade' },
  portfolio:             { fr: 'Références chantiers',  pt: 'Referências de obra' },
  parrainage:            { fr: 'Parrainage entreprises', pt: 'Programa de recomendação' },
  settings:              { fr: 'Paramètres',            pt: 'Definições' },
  gestion_comptes:       { fr: 'Gestion des comptes',   pt: 'Gestão de contas' },
}

// ══════════════════════════════════════════════════════════════════════════════
// DEFAULT PERMISSION MATRIX
// ══════════════════════════════════════════════════════════════════════════════

type PermissionMatrix = Record<ProTeamRole, Record<string, AccessLevel>>

/**
 * Salariés dont le poste de travail est le chantier : l'appli Vitfix Pro les ouvre sur le pointage
 * (lib/auth/destination-par-role.ts, même liste, vérifiée par tests/permissions.test.ts).
 */
export const ROLES_DE_TERRAIN: readonly ProTeamRole[] = ['OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX']

/** Le rôle d'équipe est-il un poste de chantier (ouvrier, chef de chantier, conducteur de travaux) ? */
export function estRoleDeTerrain(role: string | null | undefined): boolean {
  return typeof role === 'string' && (ROLES_DE_TERRAIN as readonly string[]).includes(role)
}

/**
 * Ce qu'un salarié de terrain ouvre par défaut. Décision de Frédéric du 25/11/2026 : « Les salariés doivent
 * uniquement recevoir les alertes météo, le chantier qui les concerne, et surtout le pointage très important ».
 * - `pointage` : pointer ses propres heures (/api/btp/pointage ne lit pas cette matrice ; elle ouvre l'écran) ;
 * - `chantiers` en lecture : /api/btp ne lui rend que les chantiers qui lui sont affectés, sans client ni montant
 *   (vue restreinte de lib/btp/perimetre-compte.ts) ;
 * - `meteo` en lecture : les prévisions et alertes de ces mêmes chantiers ;
 * - `dictionnaire_materiaux` en lecture (décision de Frédéric du 26/11/2026 : « Dictionnaire pour tous les employés ») ;
 *   il n'a pas de table : c'est un catalogue, sans donnée de la société (absent du menu en français, voir
 *   lib/dictionnaire-materiaux/disponibilite.ts) ;
 * - `settings` en lecture : « Mon profil » s'ouvre, pour changer son mot de passe ; /api/btp ne lui rend pas les
 *   réglages de la société et n'en accepte l'écriture qu'en FULL.
 * - `outillage` en lecture, pour le responsable de chantier seulement (`responsableDeChantier` : chef de chantier
 *   et conducteur de travaux, pas l'ouvrier) : les outils et véhicules de SES chantiers, et la vérification de chaque
 *   vendredi qu'il valide (demande de Frédéric du 26/11/2026). Comme le pointage, /api/btp/outillage laisse ce niveau
 *   valider la vérification de ses chantiers ; tenir le répertoire demande FULL.
 * Tout le reste est fermé ; le gérant rouvre ce qu'il veut, employé par employé (Gestion des comptes → Modifier).
 * Jusqu'au 25/11 le conducteur de travaux et le chef de chantier avaient en plus l'agenda, le Gantt, les devis, les
 * clients, la messagerie, les rapports, etc., et l'ouvrier l'agenda, les photos et le dictionnaire de matériaux.
 */
function ecransDuSalarieDeTerrain(responsableDeChantier: boolean): Record<string, AccessLevel> {
  return {
    ...Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'NONE' as AccessLevel])),
    pointage: 'READ', chantiers: 'READ', meteo: 'READ', dictionnaire_materiaux: 'READ',
    settings: 'READ',
    outillage: responsableDeChantier ? 'READ' : 'NONE',
  }
}

const DEFAULT_PERMISSIONS: PermissionMatrix = {
  GERANT: Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel])),

  CONDUCTEUR_TRAVAUX: ecransDuSalarieDeTerrain(true),

  CHEF_CHANTIER: ecransDuSalarieDeTerrain(true),

  // Tous les pouvoirs (décision de Frédéric du 24/11/2026, « la secrétaire Tatiana a tous les pouvoirs »), à une
  // exception : la gestion des comptes reste au compte de la société. Le serveur y réserve toute écriture au gérant
  // (app/api/pro/team/route.ts, trois `if (!isProGerant(user))`) ; lui donner FULL ici ouvrirait un écran dont
  // chaque bouton répondrait 403. L'ouvrir pour de bon demanderait de changer ces trois gardes, pas cette matrice.
  SECRETAIRE: {
    ...Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel])),
    gestion_comptes: 'NONE',
  },

  COMPTABLE: {
    home: 'READ', calendar: 'NONE', chantiers: 'NONE', equipes: 'NONE',
    gantt: 'NONE', pointage: 'NONE',
    compta_btp: 'FULL', rentabilite: 'FULL', rfq_btp: 'NONE',
    situations: 'FULL', garanties: 'FULL', sous_traitance: 'NONE',
    sous_traitance_offres: 'NONE', dpgf: 'NONE',
    motifs: 'NONE', horaires: 'NONE',
    messages: 'NONE', clients: 'NONE',
    devis: 'READ', pipeline: 'NONE', factures: 'FULL', rapports: 'READ',
    photos_chantier: 'NONE', bibliotheque: 'NONE', contrats: 'NONE',
    // Dictionnaire de matériaux pour tous les employés (26/11/2026), comptable compris.
    meteo: 'NONE', dictionnaire_materiaux: 'READ', estimation_materiaux: 'NONE', outillage: 'NONE',
    stats: 'FULL', revenus: 'FULL', comptabilite: 'FULL',
    materiaux: 'NONE', marches: 'NONE', marketplace_btp: 'NONE',
    wallet: 'NONE', portfolio: 'NONE', parrainage: 'NONE',
    settings: 'READ', gestion_comptes: 'NONE',
  },

  OUVRIER: ecransDuSalarieDeTerrain(false),
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

/** Get default permission for a role + module */
export function getDefaultPermission(role: ProTeamRole, moduleId: string): AccessLevel {
  return DEFAULT_PERMISSIONS[role]?.[moduleId] ?? 'NONE'
}

/** Get the full default matrix for a role */
export function getDefaultPermissionsForRole(role: ProTeamRole): Record<string, AccessLevel> {
  return { ...DEFAULT_PERMISSIONS[role] }
}

/** Merge default permissions with per-user overrides */
export function getEffectivePermissions(
  role: ProTeamRole,
  overrides: { module_id: string; access_level: AccessLevel }[] = []
): Record<string, AccessLevel> {
  const base = getDefaultPermissionsForRole(role)
  for (const ov of overrides) {
    if (ov.module_id in base) {
      base[ov.module_id] = ov.access_level
    }
  }
  return base
}

/** Can the user see this module (FULL or READ)? */
export function canAccess(permissions: Record<string, AccessLevel>, moduleId: string): boolean {
  const level = permissions[moduleId]
  return level === 'FULL' || level === 'READ'
}

/** Can the user write (create/edit/delete) in this module? */
export function canWrite(permissions: Record<string, AccessLevel>, moduleId: string): boolean {
  return permissions[moduleId] === 'FULL'
}

/** Is this user the gérant (company owner)? */
export function isGerantRole(proTeamRole: string | null | undefined): boolean {
  return !proTeamRole || proTeamRole === 'GERANT'
}

/** Get modules the user can access, sorted */
export function getAccessibleModules(permissions: Record<string, AccessLevel>): string[] {
  return Object.entries(permissions)
    .filter(([, level]) => level === 'FULL' || level === 'READ')
    .map(([moduleId]) => moduleId)
}

/** Validate that a role is a valid ProTeamRole */
export function isValidProTeamRole(role: string): role is ProTeamRole {
  return PRO_TEAM_ROLES.includes(role as ProTeamRole)
}
