// Config sidebar du dashboard syndic judiciaire FR — port byte-exact du SIDEBAR
// du mockup v8 (12 sections, 65 entrées + sous-en-têtes '__H__'). Réutilise les
// TYPES du namespace PT (SidebarSection / SidebarItem) — lecture seule.

import type { SidebarSection } from '@/components/syndic-dashboard/v54/shell/sidebar-config'
import { isItem } from '@/components/syndic-dashboard/v54/shell/sidebar-config'
import { URGENT_COUNT } from '../data/tasks'

export { isItem }

export const SIDEBAR_FR: SidebarSection[] = [
  { title: 'Agents IA', entries: [
    { id: 'fixy', label: 'Fixy', icon: 'bot', dot: true },
    { id: 'max', label: 'Max — Juridique', icon: 'grad' },
    { id: 'lea', label: 'Léa — Comptable', icon: 'sparkle' },
    { id: 'alfredo', label: 'Alfredo — Courriers', icon: 'mail' },
    { id: 'tempo', label: 'Tempo — Échéances', icon: 'clock' },
  ] },
  { title: 'Mandat judiciaire', entries: [
    { id: 'cockpit', label: "Aujourd'hui", icon: 'lightning', count: URGENT_COUNT },
    { id: 'dashboard', label: 'Tableau de bord', icon: 'grid' },
    { id: 'mandats', label: 'Ordonnances & missions', icon: 'scale', count: 4 },
    { id: 'agElective', label: 'AG élective', icon: 'bank' },
    { id: 'reddition', label: 'Reddition de comptes', icon: 'doc' },
    { id: 'honoraires', label: 'Honoraires & taxation', icon: 'coin' },
  ] },
  { title: 'Pilotage judiciaire', entries: [
    { id: 'priseFonction', label: 'Prise de fonction', icon: 'clipboard' },
    { id: 'dossierJud', label: 'Dossier juridictionnel', icon: 'scale' },
    { id: 'pouvoirs', label: 'Étendue des pouvoirs', icon: 'shield' },
    { id: 'redressement', label: 'Redressement (art. 29-1)', icon: 'siren' },
    { id: 'notifJud', label: 'Registre des notifications', icon: 'mail', count: 2 },
    { id: 'journal', label: "Journal d'activité", icon: 'clock' },
  ] },
  { title: 'Cabinet & supervision', entries: [
    { id: 'portefeuille', label: 'Portefeuille des mandats', icon: 'grid', count: 14 },
    { id: 'charge', label: 'Charge des collaborateurs', icon: 'users' },
    { id: 'validation', label: 'Circuit de validation', icon: 'check', count: 3 },
  ] },
  { title: 'Gestion courante', entries: [
    { id: 'interventions', label: 'Ordres de service', icon: 'clipboard', count: 4 },
    { id: 'canal', label: 'Canal de communication', icon: 'chat', count: 1 },
    { id: 'planning', label: 'Planning', icon: 'calendar' },
    { id: 'equipe', label: 'Mon cabinet', icon: 'team' },
  ] },
  { title: 'Patrimoine', entries: [
    { id: 'copros', label: 'Copropriétés', icon: 'building', count: 4 },
    { id: 'lots', label: 'Lots & copropriétaires', icon: 'users' },
    { id: 'prestataires', label: 'Prestataires', icon: 'wrench', count: 9 },
    { id: 'contrats', label: 'Contrats', icon: 'handshake' },
    { id: 'ascenseurs', label: 'Ascenseurs', icon: 'monitor' },
    { id: 'cctv', label: 'Vidéosurveillance', icon: 'monitor' },
  ] },
  { title: 'Comptabilité & finances', entries: [
    { id: 'compta', label: 'Comptabilité copropriété', icon: 'chart' },
    { id: 'appels', label: 'Appels de fonds', icon: 'coin' },
    { id: 'impayes', label: 'Impayés & recouvrement', icon: 'alert', count: 3 },
    { id: 'fondsTravaux', label: 'Fonds de travaux (ALUR)', icon: 'bank' },
    { id: 'openBanking', label: 'Open Banking', icon: 'bank' },
    { id: 'budget', label: 'Budget prévisionnel', icon: 'fact' },
  ] },
  { title: 'Copropriétaires (Extranet)', entries: [
    { id: 'extranet', label: 'Espace copropriétaire', icon: 'home' },
    { id: 'affichage', label: "Tableau d'affichage", icon: 'pin' },
    { id: 'sondages', label: 'Sondages', icon: 'poll' },
    { id: 'reservation', label: 'Réservation parties communes', icon: 'calendar' },
    { id: 'doleances', label: 'Doléances', icon: 'wrench' },
    { id: 'sms', label: 'WhatsApp / SMS', icon: 'chat' },
    { id: 'remboursements', label: 'Remboursements', icon: 'refresh' },
    { id: 'nps', label: 'Enquête de satisfaction', icon: 'heart' },
  ] },
  { title: 'Technique & travaux', entries: [
    { id: 'docsInterv', label: "Documents d'intervention", icon: 'folder' },
    { id: 'analyseDevis', label: 'Analyse devis / factures', icon: 'search' },
    { id: 'ppt', label: 'Plan pluriannuel (PPT)', icon: 'construction' },
    { id: 'carnet', label: "Carnet d'entretien", icon: 'book' },
    { id: 'visite', label: 'Visite technique / état daté', icon: 'clipboard' },
    { id: 'dtg', label: 'Diagnostic technique (DTG)', icon: 'fact' },
    { id: 'sinistres', label: 'Sinistres', icon: 'shield', count: 1 },
  ] },
  { title: 'Conformité légale', entries: [
    { header: 'Obligations' },
    { id: 'obligations', label: 'Obligations & échéances', icon: 'scale' },
    { id: 'calendrier', label: 'Calendrier réglementaire', icon: 'calendar' },
    { id: 'immat', label: 'Registre des copropriétés', icon: 'archive' },
    { header: 'Assurances & énergie' },
    { id: 'assurance', label: 'Assurance obligatoire', icon: 'shield' },
    { id: 'dpe', label: 'DPE & audit énergétique', icon: 'bolt' },
    { id: 'accessibilite', label: 'Accessibilité', icon: 'target' },
    { header: 'AG & gouvernance' },
    { id: 'prepAG', label: "Préparateur d'AG", icon: 'pencil' },
    { id: 'delibs', label: 'Tracker des délibérations', icon: 'bot' },
    { id: 'procurations', label: 'Procurations & présences', icon: 'doc' },
    { header: 'Données & sécurité' },
    { id: 'rgpd', label: 'RGPD', icon: 'lock' },
    { id: 'secIncendie', label: 'Sécurité incendie', icon: 'flame' },
  ] },
  { title: 'Outils IA', entries: [
    { id: 'saisieFactures', label: 'Saisie IA factures', icon: 'sparkle' },
    { id: 'redactionPV', label: 'Rédaction de PV (IA)', icon: 'pencil' },
    { id: 'comDigitale', label: 'Communication digitale', icon: 'chat' },
    { id: 'signature', label: 'Signature électronique', icon: 'stamp' },
    { id: 'ged', label: 'Coffre-fort numérique', icon: 'archive' },
  ] },
  { title: 'Compte', entries: [
    { id: 'modules', label: 'Mes modules', icon: 'puzzle' },
    { id: 'parametres', label: 'Paramètres', icon: 'cog' },
    { id: 'logout', label: 'Déconnexion', icon: 'logout' },
  ] },
]

/** Map id → label (titre du breadcrumb), dérivé de SIDEBAR_FR. */
export const SIDE_TITLES_FR: Record<string, string> = Object.fromEntries(
  SIDEBAR_FR.flatMap((s) => s.entries.filter(isItem).map((i) => [i.id, i.label])),
)

/** Routes « agent » (AgentChatPage) — mêmes ids que côté PT. */
export const AGENT_ROUTES_FR = new Set(['fixy', 'max', 'lea', 'alfredo', 'tempo'])
