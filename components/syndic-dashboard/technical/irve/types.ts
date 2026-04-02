import React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EtatDemande = 'recue' | 'en_cours' | 'acceptee' | 'refusee' | 'installation' | 'terminee'
export type TypeDemande = 'individuel' | 'collectif'
export type TypeBorne = 'wallbox' | 'prise_renforcee' | 'borne_rapide'
export type EtatBorne = 'active' | 'en_maintenance' | 'hors_service'
export type TypeInfra = 'individuelle' | 'collective'

export interface DemandeIRVE {
  id: string
  coproprietaire: string
  email?: string
  lot: string
  dateDemande: string
  dateEcheance: string         // +3 mois (ordonnance 2020-71)
  type: TypeDemande
  puissanceSouhaitee: number   // kW
  emplacement: string
  etat: EtatDemande
  motifRefus?: 'impossibilite_technique' | 'solution_collective_existante' | 'projet_collectif_en_cours'
  justificationRefus?: string
  dateDecision?: string
  dateInstallation?: string
  observations?: string
  createdAt: string
}

export interface BorneInstallee {
  id: string
  immeubleNom: string
  emplacementParking: string
  type: TypeBorne
  puissanceKw: number
  proprietaire: string
  typeInfra: TypeInfra
  dateInstallation: string
  compteurIndividuel: boolean
  etat: EtatBorne
  pilotageEnergetique: boolean
  observations?: string
}

export interface FAQItem {
  question: string
  reponse: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const ETAT_DEMANDE_CONFIG: Record<EtatDemande, { label: string; bg: string; color: string; dot: string }> = {
  recue:        { label: 'Demande reçue',     bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  en_cours:     { label: 'En cours d\'examen', bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  acceptee:     { label: 'Acceptée',           bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  refusee:      { label: 'Refusée',            bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
  installation: { label: 'Installation',       bg: '#E8F0FE', color: '#1967D2', dot: '#1967D2' },
  terminee:     { label: 'Terminée',           bg: '#F7F4EE', color: '#0D1B2E', dot: '#0D1B2E' },
}

export const TYPE_DEMANDE_LABELS: Record<TypeDemande, string> = {
  individuel: 'Individuel',
  collectif:  'Collectif',
}

export const TYPE_BORNE_CONFIG: Record<TypeBorne, { label: string; icon: string }> = {
  wallbox:          { label: 'Wallbox',            icon: '🔌' },
  prise_renforcee:  { label: 'Prise renforcée',   icon: '🔋' },
  borne_rapide:     { label: 'Borne rapide (DC)',  icon: '⚡' },
}

export const ETAT_BORNE_CONFIG: Record<EtatBorne, { label: string; bg: string; color: string }> = {
  active:          { label: 'Active',          bg: '#E6F4F2', color: '#1A7A6E' },
  en_maintenance:  { label: 'En maintenance',  bg: '#FEF5E4', color: '#D4830A' },
  hors_service:    { label: 'Hors service',    bg: '#FDECEA', color: '#C0392B' },
}

export const MOTIFS_OPPOSITION: Record<string, string> = {
  impossibilite_technique:       'Impossibilité technique sérieuse',
  solution_collective_existante: 'Solution collective existante ou décidée',
  projet_collectif_en_cours:     'Projet collectif de recharge en cours',
}

export const TIMELINE_STEPS = [
  { key: 'recue',        label: 'Demande reçue',              desc: 'Réception de la demande du copropriétaire' },
  { key: 'delai',        label: 'Délai réponse 3 mois',       desc: 'Ordonnance 2020-71, décret 2020-1720' },
  { key: 'decision',     label: 'Décision syndic',            desc: 'Acceptation ou refus motivé' },
  { key: 'installation', label: 'Installation',               desc: 'Mise en service de la borne' },
]

export const REGLEMENTATION_CARDS = [
  {
    ref: 'Ordonnance n°2020-71',
    date: '29 janvier 2020',
    titre: 'Droit à la prise',
    description: 'Consacre le droit pour tout copropriétaire ou locataire de demander l\'installation d\'une borne de recharge sur sa place de parking, y compris en parties communes. Le syndic dispose d\'un délai de 3 mois pour s\'opposer, sur des motifs limités.',
    icon: '⚖️',
  },
  {
    ref: 'Décret n°2020-1720',
    date: '24 décembre 2020',
    titre: 'Modalités d\'application',
    description: 'Précise les conditions d\'exercice du droit à la prise : contenu de la demande, délai de réponse, motifs d\'opposition, convention de raccordement, et rôle du syndic et de l\'AG.',
    icon: '📋',
  },
  {
    ref: 'Loi LOM — Art. 64',
    date: 'Loi d\'orientation des mobilités',
    titre: 'Pré-équipement 20% des parkings',
    description: 'Les copropriétés réalisant des travaux sur leur parc de stationnement depuis le 1er janvier 2025 doivent pré-équiper au moins 20% des emplacements pour permettre l\'installation ultérieure de bornes de recharge.',
    icon: '🏗️',
  },
  {
    ref: 'Loi Climat — Art. 24 & 25',
    date: 'Loi Climat et Résilience',
    titre: 'Vote en AG simplifié',
    description: 'L\'étude technique pour l\'IRVE se vote à la majorité simple (art. 24). Les travaux d\'installation d\'infrastructure collective se votent à la majorité absolue (art. 25). Facilite l\'adoption en copropriété.',
    icon: '🗳️',
  },
  {
    ref: 'Copropriétés neuves (PC > 11/03/2021)',
    date: 'Depuis le 11 mars 2021',
    titre: 'Pré-équipement obligatoire',
    description: 'Pour tout permis de construire déposé après le 11 mars 2021, les copropriétés de plus de 10 places de stationnement doivent être pré-équipées en infrastructure de recharge dès la construction.',
    icon: '🏢',
  },
  {
    ref: 'Norme technique',
    date: 'Applicable',
    titre: 'Max 22 kW + pilotage énergétique',
    description: 'Chaque borne individuelle est limitée à 22 kW de puissance. Le pilotage énergétique est obligatoire pour éviter la surcharge du réseau électrique de l\'immeuble et optimiser la consommation.',
    icon: '⚡',
  },
]

export const FAQ_DATA: FAQItem[] = [
  {
    question: 'Qu\'est-ce que le droit à la prise ?',
    reponse: 'Le droit à la prise permet à tout occupant (propriétaire ou locataire) d\'un immeuble collectif de demander l\'installation d\'une borne de recharge pour véhicule électrique sur sa place de parking, y compris lorsque celle-ci est en partie commune. Ce droit est encadré par l\'ordonnance n°2020-71.',
  },
  {
    question: 'Quel est le délai de réponse du syndic ?',
    reponse: 'Le syndic dispose d\'un délai de 3 mois à compter de la réception de la demande pour s\'y opposer. Passé ce délai, l\'absence de réponse vaut acceptation tacite. L\'opposition doit être motivée et relever de motifs limités définis par la loi.',
  },
  {
    question: 'Le syndic peut-il refuser la demande ?',
    reponse: 'L\'opposition n\'est possible que pour 3 motifs : (1) impossibilité technique sérieuse, (2) une solution collective de recharge existe déjà ou a été décidée, (3) un projet collectif de recharge est en cours. Tout autre motif de refus est irrecevable.',
  },
  {
    question: 'Qui paie l\'installation de la borne ?',
    reponse: 'Dans le cadre du droit à la prise, l\'ensemble des coûts (achat de la borne, installation, raccordement au réseau, compteur individuel) est à la charge du demandeur. La copropriété n\'a aucun coût à supporter, sauf si elle décide d\'une infrastructure collective.',
  },
  {
    question: 'Faut-il un vote en AG pour le droit à la prise ?',
    reponse: 'Non, le droit à la prise est un droit individuel qui ne nécessite pas de vote en AG. Cependant, la mise en place d\'une infrastructure collective (IRVE) nécessite un vote : majorité simple pour l\'étude technique, majorité absolue pour les travaux.',
  },
  {
    question: 'Qu\'est-ce qu\'un compteur individuel ?',
    reponse: 'Chaque borne individuelle doit être raccordée à un compteur dédié (ou sous-comptage) pour que le copropriétaire paie directement sa consommation électrique à son fournisseur d\'énergie, sans impact sur les charges communes.',
  },
  {
    question: 'Quelle puissance maximale est autorisée ?',
    reponse: 'La puissance maximale par borne est de 22 kW en courant alternatif (AC). Le pilotage énergétique est obligatoire pour réguler la charge en fonction de la capacité du réseau de l\'immeuble et éviter les dépassements.',
  },
  {
    question: 'Quelles aides financières existent ?',
    reponse: 'Plusieurs aides sont disponibles : la prime ADVENIR (jusqu\'à 50% HT pour l\'infrastructure collective), le crédit d\'impôt CIBRE (75% max 500€ pour les particuliers, jusqu\'au 31/12/2025), la TVA réduite à 5,5%, et des aides locales selon les collectivités.',
  },
]

// ─── Demo Data ───────────────────────────────────────────────────────────────

export const DEMO_DEMANDES: DemandeIRVE[] = [
  {
    id: 'dem-001',
    coproprietaire: 'Jean-Pierre Martin',
    email: 'jp.martin@email.fr',
    lot: 'Lot 12 — 3ème étage',
    dateDemande: '2026-02-01',
    dateEcheance: '2026-05-01',
    type: 'individuel',
    puissanceSouhaitee: 7.4,
    emplacement: 'Parking souterrain -1, place n°23',
    etat: 'en_cours',
    observations: 'Véhicule Tesla Model 3. Devis installateur fourni (Enedis).',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'dem-002',
    coproprietaire: 'Marie Dupont',
    email: 'marie.dupont@email.fr',
    lot: 'Lot 5 — 1er étage',
    dateDemande: '2026-01-15',
    dateEcheance: '2026-04-15',
    type: 'individuel',
    puissanceSouhaitee: 11,
    emplacement: 'Parking souterrain -1, place n°8',
    etat: 'acceptee',
    dateDecision: '2026-02-28',
    observations: 'Capacité réseau vérifiée par EDF. Installation prévue mars 2026.',
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'dem-003',
    coproprietaire: 'Conseil syndical',
    lot: 'Infrastructure collective',
    dateDemande: '2026-03-01',
    dateEcheance: '2026-06-01',
    type: 'collectif',
    puissanceSouhaitee: 22,
    emplacement: 'Parking souterrain -2, zone commune',
    etat: 'recue',
    observations: 'Projet d\'installation de 6 bornes collectives pour les résidents. Étude technique à programmer.',
    createdAt: '2026-03-01T14:00:00Z',
  },
  {
    id: 'dem-004',
    coproprietaire: 'Laurent Moreau',
    lot: 'Lot 18 — 5ème étage',
    dateDemande: '2025-11-10',
    dateEcheance: '2026-02-10',
    type: 'individuel',
    puissanceSouhaitee: 7.4,
    emplacement: 'Parking extérieur, place n°42',
    etat: 'refusee',
    motifRefus: 'projet_collectif_en_cours',
    justificationRefus: 'Un projet collectif d\'infrastructure IRVE est en cours de vote en AG. L\'installation individuelle est reportée.',
    dateDecision: '2026-01-20',
    createdAt: '2025-11-10T11:00:00Z',
  },
]

export const DEMO_BORNES: BorneInstallee[] = [
  {
    id: 'bor-001',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -1, place n°15',
    type: 'wallbox',
    puissanceKw: 7.4,
    proprietaire: 'Alain Bernard (Lot 7)',
    typeInfra: 'individuelle',
    dateInstallation: '2025-09-15',
    compteurIndividuel: true,
    etat: 'active',
    pilotageEnergetique: true,
  },
  {
    id: 'bor-002',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -1, place n°22',
    type: 'wallbox',
    puissanceKw: 11,
    proprietaire: 'Sophie Lefèvre (Lot 14)',
    typeInfra: 'individuelle',
    dateInstallation: '2025-11-20',
    compteurIndividuel: true,
    etat: 'active',
    pilotageEnergetique: true,
  },
  {
    id: 'bor-003',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -2, zone commune A',
    type: 'borne_rapide',
    puissanceKw: 22,
    proprietaire: 'Copropriété (infrastructure collective)',
    typeInfra: 'collective',
    dateInstallation: '2025-06-10',
    compteurIndividuel: false,
    etat: 'en_maintenance',
    pilotageEnergetique: true,
    observations: 'Maintenance préventive prévue pour remplacement du module de pilotage.',
  },
  {
    id: 'bor-004',
    immeubleNom: 'Résidence Bellevue',
    emplacementParking: 'Parking extérieur, place n°3',
    type: 'prise_renforcee',
    puissanceKw: 3.7,
    proprietaire: 'François Garcia (Lot 2)',
    typeInfra: 'individuelle',
    dateInstallation: '2024-12-01',
    compteurIndividuel: true,
    etat: 'hors_service',
    pilotageEnergetique: false,
    observations: 'Défaillance électrique signalée. Intervention technicien prévue.',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

export const fmtDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR') } catch { return s }
}

export const joursRestants = (dateStr: string): number => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export const addMonths = (dateStr: string, months: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export const getTimelineStep = (d: DemandeIRVE): number => {
  switch (d.etat) {
    case 'recue': return 0
    case 'en_cours': return 1
    case 'acceptee': case 'refusee': return 2
    case 'installation': return 3
    case 'terminee': return 4
    default: return 0
  }
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--sd-border, #E4DDD0)',
  borderRadius: 12,
  padding: 20,
}

export const btnPrimary: React.CSSProperties = {
  background: 'var(--sd-navy, #0D1B2E)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

export const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--sd-ink-2, #4A5E78)',
  border: '1px solid var(--sd-border, #E4DDD0)',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

export const btnGold: React.CSSProperties = {
  background: 'var(--sd-gold, #C9A84C)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--sd-border, #E4DDD0)',
  borderRadius: 8,
  fontSize: 13,
  background: 'var(--sd-cream, #F7F4EE)',
  color: 'var(--sd-navy, #0D1B2E)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--sd-ink-2, #4A5E78)',
  marginBottom: 4,
  display: 'block',
}

export const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(13,27,46,0.45)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

export const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 600,
  maxHeight: '90vh',
  overflow: 'auto',
  padding: 28,
  position: 'relative',
}
