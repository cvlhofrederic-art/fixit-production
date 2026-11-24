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

const DEFAULT_PERMISSIONS: PermissionMatrix = {
  GERANT: Object.fromEntries(ALL_PRO_MODULES.map(m => [m, 'FULL' as AccessLevel])),

  CONDUCTEUR_TRAVAUX: {
    home: 'FULL', calendar: 'FULL', chantiers: 'READ', equipes: 'READ',
    gantt: 'FULL', pointage: 'READ',
    compta_btp: 'NONE', rentabilite: 'READ', rfq_btp: 'FULL',
    situations: 'FULL', garanties: 'READ', sous_traitance: 'FULL',
    sous_traitance_offres: 'FULL', dpgf: 'FULL',
    motifs: 'FULL', horaires: 'FULL',
    messages: 'FULL', clients: 'FULL',
    devis: 'FULL', pipeline: 'FULL', factures: 'READ', rapports: 'FULL',
    photos_chantier: 'FULL', bibliotheque: 'FULL', contrats: 'READ',
    stats: 'READ', revenus: 'READ', comptabilite: 'NONE',
    materiaux: 'FULL', marches: 'FULL', marketplace_btp: 'FULL',
    meteo: 'READ', dictionnaire_materiaux: 'READ', estimation_materiaux: 'NONE',
    wallet: 'READ', portfolio: 'FULL', parrainage: 'NONE',
    settings: 'READ', gestion_comptes: 'NONE',
  },

  CHEF_CHANTIER: {
    home: 'READ', calendar: 'FULL', chantiers: 'READ', equipes: 'READ',
    gantt: 'READ', pointage: 'READ',
    compta_btp: 'NONE', rentabilite: 'NONE', rfq_btp: 'READ',
    situations: 'READ', garanties: 'NONE', sous_traitance: 'NONE',
    sous_traitance_offres: 'NONE', dpgf: 'NONE',
    motifs: 'READ', horaires: 'READ',
    messages: 'FULL', clients: 'READ',
    devis: 'NONE', pipeline: 'NONE', factures: 'NONE', rapports: 'FULL',
    photos_chantier: 'FULL', bibliotheque: 'READ', contrats: 'NONE',
    meteo: 'READ', dictionnaire_materiaux: 'READ', estimation_materiaux: 'NONE',
    stats: 'NONE', revenus: 'NONE', comptabilite: 'NONE',
    materiaux: 'READ', marches: 'NONE', marketplace_btp: 'NONE',
    wallet: 'NONE', portfolio: 'NONE', parrainage: 'NONE',
    settings: 'READ', gestion_comptes: 'NONE',
  },

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
    meteo: 'NONE', dictionnaire_materiaux: 'NONE', estimation_materiaux: 'NONE',
    stats: 'FULL', revenus: 'FULL', comptabilite: 'FULL',
    materiaux: 'NONE', marches: 'NONE', marketplace_btp: 'NONE',
    wallet: 'NONE', portfolio: 'NONE', parrainage: 'NONE',
    settings: 'READ', gestion_comptes: 'NONE',
  },

  OUVRIER: {
    home: 'NONE', calendar: 'READ', chantiers: 'READ', equipes: 'NONE',
    gantt: 'NONE', pointage: 'READ',
    compta_btp: 'NONE', rentabilite: 'NONE', rfq_btp: 'NONE',
    situations: 'NONE', garanties: 'NONE', sous_traitance: 'NONE',
    sous_traitance_offres: 'NONE', dpgf: 'NONE',
    motifs: 'NONE', horaires: 'NONE',
    messages: 'NONE', clients: 'NONE',
    devis: 'NONE', pipeline: 'NONE', factures: 'NONE', rapports: 'NONE',
    photos_chantier: 'FULL', bibliotheque: 'NONE', contrats: 'NONE',
    meteo: 'READ', dictionnaire_materiaux: 'READ', estimation_materiaux: 'NONE',
    stats: 'NONE', revenus: 'NONE', comptabilite: 'NONE',
    materiaux: 'NONE', marches: 'NONE', marketplace_btp: 'NONE',
    wallet: 'NONE', portfolio: 'NONE', parrainage: 'NONE',
    settings: 'READ', gestion_comptes: 'NONE',
  },
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
