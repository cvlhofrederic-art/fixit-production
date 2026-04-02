import React from 'react'
import { Clock, Calendar, HardHat, FileText, BarChart3, UserCog, Wrench, DollarSign } from 'lucide-react'

/* ══════════════════════════════════════════════════════════
   BTP Shared Types & Constants
══════════════════════════════════════════════════════════ */

export type TypeCompte = 'ouvrier' | 'chef_chantier' | 'conducteur_travaux' | 'secretaire' | 'gerant'
export type ModulePerms = 'pointage' | 'agenda' | 'chantiers' | 'devis' | 'rapports' | 'equipes' | 'materiaux' | 'comptabilite'

export interface PermMap { pointage: boolean; agenda: boolean; chantiers: boolean; devis: boolean; rapports: boolean; equipes: boolean; materiaux: boolean; comptabilite: boolean }
export interface Membre { id: string; prenom: string; nom: string; telephone: string; email: string; typeCompte: TypeCompte; rolePerso: string; equipeId: string; createdAt: string }
export interface EquipeBTP { id: string; nom: string; metier: string; chantierId: string; membreIds: string[]; createdAt: string }
export interface RolePerso { id: string; nom: string; permissions: PermMap }

export const TYPE_LABELS: Record<TypeCompte, string> = {
  ouvrier: 'Ouvrier',
  chef_chantier: 'Chef de chantier',
  conducteur_travaux: 'Conducteur de travaux',
  secretaire: 'Secrétaire',
  gerant: 'Gérant / Patron',
}
export const TYPE_COLORS: Record<TypeCompte, string> = {
  ouvrier: 'v22-tag v22-tag-gray',
  chef_chantier: 'v22-tag v22-tag-amber',
  conducteur_travaux: 'v22-tag v22-tag-yellow',
  secretaire: 'v22-tag v22-tag-green',
  gerant: 'v22-tag v22-tag-red',
}
export const MODULE_LABELS: Record<ModulePerms, string> = {
  pointage: 'Pointage', agenda: 'Agenda', chantiers: 'Chantiers',
  devis: 'Devis', rapports: 'Rapports', equipes: 'Équipes',
  materiaux: 'Matériaux', comptabilite: 'Comptabilité',
}
export const MODULE_ICONS: Record<ModulePerms, React.ReactNode> = {
  pointage: <Clock size={14} />, agenda: <Calendar size={14} />, chantiers: <HardHat size={14} />,
  devis: <FileText size={14} />, rapports: <BarChart3 size={14} />, equipes: <UserCog size={14} />,
  materiaux: <Wrench size={14} />, comptabilite: <DollarSign size={14} />,
}
export const MODULES: ModulePerms[] = ['pointage', 'agenda', 'chantiers', 'devis', 'rapports', 'equipes', 'materiaux', 'comptabilite']

export const DEFAULT_PERMS: Record<TypeCompte, PermMap> = {
  ouvrier:           { pointage: true,  agenda: false, chantiers: false, devis: false, rapports: true,  equipes: false, materiaux: false, comptabilite: false },
  chef_chantier:     { pointage: true,  agenda: true,  chantiers: true,  devis: false, rapports: true,  equipes: true,  materiaux: true,  comptabilite: false },
  conducteur_travaux:{ pointage: true,  agenda: true,  chantiers: true,  devis: true,  rapports: true,  equipes: true,  materiaux: true,  comptabilite: false },
  secretaire:        { pointage: false, agenda: true,  chantiers: false, devis: true,  rapports: false, equipes: false, materiaux: false, comptabilite: true  },
  gerant:            { pointage: true,  agenda: true,  chantiers: true,  devis: true,  rapports: true,  equipes: true,  materiaux: true,  comptabilite: true  },
}

export const METIERS_FR = ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Métallerie / Ferronnerie', 'Multi-corps']

export const EMPTY_PERM: PermMap = { pointage: false, agenda: false, chantiers: false, devis: false, rapports: false, equipes: false, materiaux: false, comptabilite: false }
