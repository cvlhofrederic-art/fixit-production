'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatPrice, formatDate } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/context'

// ─── Dynamic imports for extracted page sections ─────────────────────────────
const d = (loader: () => Promise<any>) => dynamic(loader, { ssr: false }) as React.ComponentType<any>

const CoproAccueilSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAccueilSection'))
const CoproDocumentsSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproDocumentsSection'))
const CoproPaiementsSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproPaiementsSection'))
const CoproAnnoncesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAnnoncesSection'))
const CoproSignalementSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproSignalementSection'))
const CoproAssembleesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAssembleesSection'))
const CoproHistoriqueSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproHistoriqueSection'))
const CoproModulesSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproModulesSection'))
const CoproParametresSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproParametresSection'))
const CoproAssistantSection = d(() => import('@/components/coproprietaire-dashboard/pages/CoproAssistantSection'))

// ─── Types ────────────────────────────────────────────────────────────────────

type CoproPage = 'accueil' | 'documents' | 'paiements' | 'annonces' | 'signalement' | 'assemblees' | 'historique' | 'parametres' | 'assistant' | 'interventions_suivi' | 'mes_charges' | 'quittances' | 'mon_bail' | 'modules'

interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

interface ChargesMensuelles {
  id: string
  mois: string
  montant: number
  statut: 'payee' | 'en_attente' | 'en_retard'
  datePaiement?: string
  dateEcheance: string
}

interface Echeance {
  id: string
  type: 'paiement' | 'assemblee' | 'maintenance' | 'document'
  titre: string
  date: string
  description: string
  urgent: boolean
}

interface CoproNotification {
  id: string
  type: 'rappel' | 'alerte' | 'document' | 'message' | 'vote'
  titre: string
  message: string
  date: string
  lu: boolean
}

interface DocumentCopro {
  id: string
  nom: string
  type: 'pv_ag' | 'compte_annuel' | 'budget' | 'contrat' | 'reglement' | 'appel_charges' | 'autre'
  dateUpload: string
  taille: string
  annee: number
  public: boolean
  consulte: boolean
  dateConsultation?: string
}

interface Paiement {
  id: string
  type: 'charges_trimestrielles' | 'appel_fonds' | 'travaux' | 'regularisation'
  description: string
  montant: number
  dateEcheance: string
  datePaiement?: string
  statut: 'payee' | 'en_attente' | 'en_retard'
  trimestre?: string
  reference: string
}

interface CanalMessage {
  auteur: string
  role: string
  texte: string
  date: string
  type?: string
}

interface Annonce {
  id: string
  titre: string
  contenu: string
  date: string
  auteur: string
  importance: 'info' | 'important' | 'urgent'
  lu: boolean
}

interface ResolutionVote {
  id: string
  titre: string
  description: string
  majorite: 'art24' | 'art25' | 'art26' | 'unanimite'
  monVote?: 'pour' | 'contre' | 'abstention'
  votePour: number
  voteContre: number
  voteAbstention: number
  statut: 'ouverte' | 'cloturee'
  resultat?: 'adoptée' | 'rejetée'
}

interface AssembleeGenerale {
  id: string
  titre: string
  date: string
  lieu: string
  type: 'ordinaire' | 'extraordinaire'
  statut: 'planifiee' | 'convoquee' | 'en_cours' | 'cloturee'
  ordreDuJour: string[]
  resolutions: ResolutionVote[]
  lienVisio?: string
}

interface HistoriqueEntry {
  id: string
  type: 'paiement' | 'vote' | 'document' | 'signalement' | 'message'
  titre: string
  description: string
  date: string
  montant?: number
}

interface ParamConfidentialite {
  notifEmail: boolean
  notifPush: boolean
  mailingAG: boolean
  alertesPaiement: boolean
  alertesTravaux: boolean
  resumeHebdo: boolean
}

// ─── Données démo ─────────────────────────────────────────────────────────────

const PROFILE_DEMO: CoproProfile = {
  id: 'copro-demo-1',
  nom: 'Xavier',
  prenom: 'Géraldine',
  email: 'geraldine.xavier@email.com',
  telephone: '06 12 34 56 78',
  immeuble: 'Résidence Les Acacias',
  batiment: 'D',
  etage: '4',
  numLot: '12',
  tantiemes: 450,
  quotePart: 4.5,
}

const CHARGES_DEMO: ChargesMensuelles[] = [
  { id: '1', mois: '2026-02', montant: 285.00, statut: 'payee', datePaiement: '2026-02-05', dateEcheance: '2026-02-10' },
  { id: '2', mois: '2026-01', montant: 285.00, statut: 'payee', datePaiement: '2026-01-08', dateEcheance: '2026-01-10' },
  { id: '3', mois: '2026-03', montant: 285.00, statut: 'en_attente', dateEcheance: '2026-03-10' },
  { id: '4', mois: '2025-12', montant: 285.00, statut: 'payee', datePaiement: '2025-12-09', dateEcheance: '2025-12-10' },
  { id: '5', mois: '2025-11', montant: 285.00, statut: 'payee', datePaiement: '2025-11-10', dateEcheance: '2025-11-10' },
  { id: '6', mois: '2025-10', montant: 285.00, statut: 'payee', datePaiement: '2025-10-07', dateEcheance: '2025-10-10' },
]

const PAIEMENTS_DEMO: Paiement[] = [
  { id: '1', type: 'charges_trimestrielles', description: 'Charges T1 2026', montant: 855.00, dateEcheance: '2026-01-15', datePaiement: '2026-01-12', statut: 'payee', trimestre: 'T1 2026', reference: 'PAY-2026-001' },
  { id: '2', type: 'charges_trimestrielles', description: 'Charges T2 2026', montant: 855.00, dateEcheance: '2026-04-15', statut: 'en_attente', trimestre: 'T2 2026', reference: 'PAY-2026-002' },
  { id: '3', type: 'appel_fonds', description: 'Fonds de travaux art. 14-2', montant: 220.00, dateEcheance: '2026-03-01', statut: 'en_attente', reference: 'FDT-2026-001' },
  { id: '4', type: 'travaux', description: 'Ravalement façade (quote-part)', montant: 1450.00, dateEcheance: '2026-06-01', statut: 'en_attente', reference: 'TRX-2026-001' },
  { id: '5', type: 'charges_trimestrielles', description: 'Charges T4 2025', montant: 830.00, dateEcheance: '2025-10-15', datePaiement: '2025-10-13', statut: 'payee', trimestre: 'T4 2025', reference: 'PAY-2025-004' },
  { id: '6', type: 'regularisation', description: 'Régularisation charges 2025', montant: -125.00, dateEcheance: '2026-03-30', datePaiement: '2026-02-28', statut: 'payee', reference: 'REG-2025-001' },
]

const DOCUMENTS_DEMO: DocumentCopro[] = [
  { id: '1', nom: 'PV AG Ordinaire 2025', type: 'pv_ag', dateUpload: '2025-06-20', taille: '2.4 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2025-07-01' },
  { id: '2', nom: 'Comptes annuels 2025', type: 'compte_annuel', dateUpload: '2026-01-15', taille: '1.8 Mo', annee: 2025, public: true, consulte: false },
  { id: '3', nom: 'Budget prévisionnel 2026', type: 'budget', dateUpload: '2025-11-20', taille: '980 Ko', annee: 2026, public: true, consulte: true, dateConsultation: '2025-12-01' },
  { id: '4', nom: 'Règlement de copropriété', type: 'reglement', dateUpload: '2020-03-10', taille: '5.2 Mo', annee: 2020, public: true, consulte: true, dateConsultation: '2024-06-15' },
  { id: '5', nom: 'Contrat assurance immeuble 2026', type: 'contrat', dateUpload: '2026-01-02', taille: '3.1 Mo', annee: 2026, public: true, consulte: false },
  { id: '6', nom: 'Appel de charges T1 2026', type: 'appel_charges', dateUpload: '2026-01-05', taille: '450 Ko', annee: 2026, public: false, consulte: true, dateConsultation: '2026-01-06' },
  { id: '7', nom: 'PV AG Extraordinaire Toiture 2025', type: 'pv_ag', dateUpload: '2025-10-01', taille: '1.6 Mo', annee: 2025, public: true, consulte: true, dateConsultation: '2025-10-05' },
  { id: '8', nom: 'Contrat gardiennage 2026', type: 'contrat', dateUpload: '2026-02-01', taille: '2.0 Mo', annee: 2026, public: true, consulte: false },
]

const ANNONCES_DEMO: Annonce[] = [
  { id: '1', titre: 'Travaux ravalement façade', contenu: 'Les travaux de ravalement commenceront le 15 mars 2026. Un échafaudage sera installé côté rue. Merci de ne pas stationner devant l\'immeuble durant cette période. Durée estimée : 3 mois.', date: '2026-02-20', auteur: 'Cabinet Dupont', importance: 'important', lu: false },
  { id: '2', titre: 'Coupure eau froide — 28 février', contenu: 'Une coupure d\'eau froide est prévue le 28/02 de 9h à 12h pour remplacement d\'une vanne dans le local technique. Merci de prévoir vos réserves.', date: '2026-02-24', auteur: 'Cabinet Dupont', importance: 'urgent', lu: false },
  { id: '3', titre: 'Nouvelle gardienne', contenu: 'Nous avons le plaisir de vous informer que Mme Sophie Bernard prendra ses fonctions de gardienne à compter du 1er mars 2026. Elle sera joignable au 01 23 45 67 89.', date: '2026-02-15', auteur: 'Cabinet Dupont', importance: 'info', lu: true },
  { id: '4', titre: 'Rappel — AG Ordinaire le 15 avril', contenu: 'L\'assemblée générale ordinaire se tiendra le 15 avril 2026 à 18h00 à la salle polyvalente. Merci de confirmer votre présence ou de donner pouvoir.', date: '2026-02-10', auteur: 'Cabinet Dupont', importance: 'important', lu: true },
]

const AG_DEMO: AssembleeGenerale[] = [
  {
    id: '1',
    titre: 'AG Ordinaire 2026',
    date: '2026-04-15T18:00:00',
    lieu: 'Salle polyvalente, 12 rue des Acacias, Paris 8e',
    type: 'ordinaire',
    statut: 'convoquee',
    ordreDuJour: [
      'Approbation des comptes de l\'exercice 2025',
      'Vote du budget prévisionnel 2026',
      'Travaux de ravalement façade — devis et financement',
      'Remplacement chaudière collective — devis et vote',
      'Désignation du syndic pour la période 2026-2029',
      'Questions diverses',
    ],
    resolutions: [
      { id: 'r1', titre: 'Approbation des comptes 2025', description: 'Approbation des comptes de l\'exercice clos au 31/12/2025, présentant un total de charges de 42 800 € et un solde positif de 2 200 €.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r2', titre: 'Budget prévisionnel 2026', description: 'Vote du budget prévisionnel pour l\'exercice 2026 d\'un montant total de 45 000 €, soit une augmentation de 5,1% par rapport à 2025.', majorite: 'art24', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r3', titre: 'Ravalement façade', description: 'Approbation des travaux de ravalement de la façade côté rue pour un montant de 85 000 € TTC (entreprise Renov\'Bat, devis du 12/01/2026). Financement : fonds travaux + appel exceptionnel.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r4', titre: 'Remplacement chaudière collective', description: 'Approbation du remplacement de la chaudière collective vétuste (installée en 1998) par une chaudière à condensation, montant 32 000 € TTC.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
      { id: 'r5', titre: 'Désignation du syndic', description: 'Renouvellement du mandat du Cabinet Dupont en qualité de syndic de la copropriété pour une durée de 3 ans (2026-2029), aux conditions du contrat joint.', majorite: 'art25', votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'ouverte' },
    ],
    lienVisio: '',
  },
  {
    id: '2',
    titre: 'AG Extraordinaire — Toiture',
    date: '2025-09-20T18:00:00',
    lieu: 'Salle polyvalente, 12 rue des Acacias, Paris 8e',
    type: 'extraordinaire',
    statut: 'cloturee',
    ordreDuJour: [
      'Réfection urgente de la toiture bâtiment D',
      'Modalités de financement des travaux',
    ],
    resolutions: [
      { id: 'r6', titre: 'Réfection toiture bât. D', description: 'Approbation des travaux urgents de réfection de la toiture du bâtiment D suite aux infiltrations constatées, montant 52 000 € TTC.', majorite: 'art25', monVote: 'pour', votePour: 6200, voteContre: 1800, voteAbstention: 500, statut: 'cloturee', resultat: 'adoptée' },
      { id: 'r7', titre: 'Emprunt collectif', description: 'Autorisation de contracter un emprunt collectif de 45 000 € sur 5 ans auprès de la Banque Postale pour financer les travaux de toiture.', majorite: 'art26', monVote: 'contre', votePour: 5500, voteContre: 3000, voteAbstention: 1000, statut: 'cloturee', resultat: 'rejetée' },
    ],
  },
]

const ECHEANCES_DEMO: Echeance[] = [
  { id: '1', type: 'paiement', titre: 'Fonds de travaux art. 14-2', date: '2026-03-01', description: '220,00 € — Appel de fonds annuel', urgent: true },
  { id: '2', type: 'maintenance', titre: 'Coupure eau froide', date: '2026-02-28', description: '9h-12h — Remplacement vanne local technique', urgent: true },
  { id: '3', type: 'document', titre: 'Comptes annuels 2025 à consulter', date: '2026-03-15', description: 'Nouveau document disponible', urgent: false },
  { id: '4', type: 'assemblee', titre: 'AG Ordinaire 2026', date: '2026-04-15', description: '18h00 — Salle polyvalente', urgent: false },
  { id: '5', type: 'paiement', titre: 'Charges T2 2026', date: '2026-04-15', description: '855,00 € — Charges trimestrielles', urgent: false },
]

const NOTIFICATIONS_DEMO: CoproNotification[] = [
  { id: '1', type: 'alerte', titre: 'Coupure eau froide demain', message: 'Coupure prévue le 28/02 de 9h à 12h pour remplacement vanne', date: '2026-02-27T10:00:00', lu: false },
  { id: '2', type: 'document', titre: 'Nouveau document disponible', message: 'Les comptes annuels 2025 sont consultables dans vos documents', date: '2026-01-15T14:00:00', lu: false },
  { id: '3', type: 'rappel', titre: 'Échéance fonds de travaux', message: 'Échéance le 01/03 — 220,00 € à régler', date: '2026-02-20T09:00:00', lu: true },
  { id: '4', type: 'vote', titre: 'Vote par correspondance ouvert', message: 'AG du 15/04 : vous pouvez voter en ligne avant le 10/04', date: '2026-02-25T08:00:00', lu: false },
  { id: '5', type: 'message', titre: 'Réponse du syndic', message: 'Votre signalement de fuite palier 4ème a été traité', date: '2026-02-22T16:30:00', lu: true },
]

const HISTORIQUE_DEMO: HistoriqueEntry[] = [
  { id: '1', type: 'paiement', titre: 'Charges T1 2026 réglées', description: 'Paiement de 855,00 € reçu', date: '2026-01-12', montant: 855.00 },
  { id: '2', type: 'vote', titre: 'Vote AG Extraordinaire — Toiture', description: 'Vous avez voté POUR la réfection toiture bât. D', date: '2025-09-20' },
  { id: '3', type: 'document', titre: 'PV AG Ordinaire 2025 consulté', description: 'Document téléchargé', date: '2025-07-01' },
  { id: '4', type: 'signalement', titre: 'Signalement fuite palier 4ème', description: 'Signalement créé et traité — intervention Marc Fontaine', date: '2025-08-15' },
  { id: '5', type: 'paiement', titre: 'Charges T4 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-10-13', montant: 830.00 },
  { id: '6', type: 'paiement', titre: 'Régularisation charges 2025', description: 'Trop-perçu remboursé', date: '2026-02-28', montant: -125.00 },
  { id: '7', type: 'document', titre: 'Budget prévisionnel 2026 consulté', description: 'Document consulté', date: '2025-12-01' },
  { id: '8', type: 'vote', titre: 'Vote AG Extraordinaire — Emprunt', description: 'Vous avez voté CONTRE l\'emprunt collectif', date: '2025-09-20' },
  { id: '9', type: 'paiement', titre: 'Charges T3 2025 réglées', description: 'Paiement de 830,00 € reçu', date: '2025-07-14', montant: 830.00 },
  { id: '10', type: 'signalement', titre: 'Signalement bruit ascenseur', description: 'Signalement créé — en attente intervention', date: '2025-06-20' },
]

const PARAMS_DEMO: ParamConfidentialite = {
  notifEmail: true,
  notifPush: true,
  mailingAG: true,
  alertesPaiement: true,
  alertesTravaux: true,
  resumeHebdo: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  pv_ag: { label: 'PV Assemblée', emoji: '📋' },
  compte_annuel: { label: 'Comptes annuels', emoji: '📊' },
  budget: { label: 'Budget', emoji: '💰' },
  contrat: { label: 'Contrat', emoji: '📑' },
  reglement: { label: 'Règlement', emoji: '📜' },
  appel_charges: { label: 'Appel de charges', emoji: '🧾' },
  autre: { label: 'Autre', emoji: '📄' },
}

const NOTIF_TYPE_EMOJI: Record<string, string> = {
  rappel: '⏰',
  alerte: '⚠️',
  document: '📄',
  message: '💬',
  vote: '🗳️',
}

const ECHEANCE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  assemblee: '🏛️',
  maintenance: '🔧',
  document: '📄',
}

const HISTORIQUE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  vote: '🗳️',
  document: '📄',
  signalement: '🔔',
  message: '💬',
}

const MAJORITE_LABELS: Record<string, { label: string; color: string }> = {
  art24: { label: 'Art. 24', color: 'bg-blue-100 text-blue-700' },
  art25: { label: 'Art. 25', color: 'bg-[rgba(201,168,76,0.15)] text-[#A8842A]' },
  art26: { label: 'Art. 26', color: 'bg-orange-100 text-orange-700' },
  unanimite: { label: 'Unanimité', color: 'bg-red-100 text-red-700' },
}

// ─── Signalement data ─────────────────────────────────────────────────────────

const TYPES_INTERVENTION = [
  '🔧 Plomberie (fuite, colonne, robinetterie)',
  '⚡ Électricité (panne, tableau, prise)',
  '🪟 Menuiserie (porte, fenêtre, serrure)',
  '🎨 Peinture / revêtement',
  '🏗️ Gros œuvre (fissure, infiltration)',
  '🌡️ Chauffage / climatisation',
  '🛗 Ascenseur',
  '🧹 Nettoyage / entretien',
  '🔥 Sinistre (dégât des eaux, incendie)',
  '🚨 Urgence sécurité',
  '🌿 Espaces verts',
  '💡 Éclairage parties communes',
  '🚪 Interphone / digicode',
  '📦 Autre',
]

const ZONES_COMMUNES = [
  'Hall d\'entrée',
  'Couloir / palier',
  'Escalier',
  'Cave / sous-sol',
  'Parking / garage',
  'Toiture / terrasse',
  'Jardin / espace vert',
  'Local poubelles',
  'Local vélos',
  'Façade extérieure',
  'Boîtes aux lettres',
  'Ascenseur',
  'Chaufferie',
  'Compteurs communs',
]

// ─── Nav items ────────────────────────────────────────────────────────────────

// ─── Types nouveaux ────────────────────────────────────────────────────────────

interface SuiviIntervention {
  id: string
  type: string
  description: string
  artisan: string
  artisanPhone: string
  statut: 'planifie' | 'en_route' | 'sur_place' | 'termine' | 'annule'
  dateRdv: string
  heureRdv: string
  progression: number
  note?: number
  commentaire?: string
  gpsLat?: number
  gpsLng?: number
  gpsEta?: number
  preuve?: { avantPhotos: number; apresPhotos: number; signee: boolean }
}

interface PosteCharge {
  label: string
  emoji: string
  montantAnnuel: number
  budget: number
  couleur: string
}

// ─── Données démo interventions ────────────────────────────────────────────────

const INTERVENTIONS_DEMO: SuiviIntervention[] = [
  {
    id: 'int-1',
    type: 'Plomberie',
    description: 'Fuite robinet salle de bain',
    artisan: 'Mohamed Ait — Plomberie Express',
    artisanPhone: '06 89 34 56 12',
    statut: 'en_route',
    dateRdv: '2026-02-26',
    heureRdv: '14:00',
    progression: 35,
    gpsLat: 48.8566,
    gpsLng: 2.3522,
    gpsEta: 12,
  },
  {
    id: 'int-2',
    type: 'Électricité',
    description: 'Remplacement tableau électrique',
    artisan: 'Paul Martin — Électro Services',
    artisanPhone: '06 12 78 45 90',
    statut: 'termine',
    dateRdv: '2026-02-20',
    heureRdv: '09:00',
    progression: 100,
    note: 5,
    commentaire: 'Travail très propre, artisan ponctuel',
    preuve: { avantPhotos: 3, apresPhotos: 4, signee: true },
  },
  {
    id: 'int-3',
    type: 'Serrurerie',
    description: 'Remplacement serrure porte palière',
    artisan: 'Jean Dupont — Serrurerie Dupont',
    artisanPhone: '06 55 43 21 98',
    statut: 'planifie',
    dateRdv: '2026-03-05',
    heureRdv: '10:30',
    progression: 0,
  },
  {
    id: 'int-4',
    type: 'Peinture',
    description: 'Reprise peinture couloir',
    artisan: 'Sophie Renard — Déco & Co',
    artisanPhone: '06 34 12 98 76',
    statut: 'sur_place',
    dateRdv: '2026-02-25',
    heureRdv: '08:00',
    progression: 65,
    preuve: { avantPhotos: 2, apresPhotos: 0, signee: false },
  },
]

const POSTES_CHARGES: PosteCharge[] = [
  { label: 'Gardiennage', emoji: '🔑', montantAnnuel: 1200, budget: 1300, couleur: '#6366f1' },
  { label: 'Assurance', emoji: '🛡️', montantAnnuel: 480, budget: 500, couleur: '#10b981' },
  { label: 'Entretien espaces verts', emoji: '🌿', montantAnnuel: 360, budget: 400, couleur: '#22c55e' },
  { label: 'Eau froide parties communes', emoji: '💧', montantAnnuel: 220, budget: 250, couleur: '#3b82f6' },
  { label: 'Électricité communes', emoji: '⚡', montantAnnuel: 310, budget: 320, couleur: '#f59e0b' },
  { label: 'Ascenseur (maintenance)', emoji: '🏢', montantAnnuel: 540, budget: 600, couleur: '#8b5cf6' },
  { label: 'Nettoyage', emoji: '🧹', montantAnnuel: 260, budget: 280, couleur: '#ec4899' },
  { label: 'Fonds travaux art.14-2', emoji: '🏗️', montantAnnuel: 880, budget: 880, couleur: '#ef4444' },
]

// ─── Composant MesInterventionsSection ────────────────────────────────────────

function MesInterventionsSection({ profile }: { profile: CoproProfile }) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [interventions, setInterventions] = useState<SuiviIntervention[]>(() => {
    if (typeof window === 'undefined') return INTERVENTIONS_DEMO
    const saved = localStorage.getItem(`fixit_interventions_copro_${profile.id}`)
    return saved ? JSON.parse(saved) : INTERVENTIONS_DEMO
  })
  const [selected, setSelected] = useState<SuiviIntervention | null>(null)
  const [noteModal, setNoteModal] = useState<SuiviIntervention | null>(null)
  const [noteVal, setNoteVal] = useState(5)
  const [noteComment, setNoteComment] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  const save = (list: SuiviIntervention[]) => {
    setInterventions(list)
    localStorage.setItem(`fixit_interventions_copro_${profile.id}`, JSON.stringify(list))
  }

  const submitNote = () => {
    if (!noteModal) return
    const updated = interventions.map(i => i.id === noteModal.id ? { ...i, note: noteVal, commentaire: noteComment } : i)
    save(updated)
    setNoteModal(null)
    setNoteComment('')
  }

  const statutCfg: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
    planifie:  { label: L ? 'Planeado' : 'Planifié',   color: 'text-blue-700',  bg: 'bg-blue-100',   emoji: '📅' },
    en_route:  { label: L ? 'A caminho' : 'En route',   color: 'text-amber-700', bg: 'bg-amber-100',  emoji: '🚗' },
    sur_place: { label: L ? 'No local' : 'Sur place',  color: 'text-[#A8842A]',bg: 'bg-[rgba(201,168,76,0.15)]', emoji: '🔧' },
    termine:   { label: L ? 'Concluído' : 'Terminé',    color: 'text-green-700', bg: 'bg-green-100',  emoji: '✅' },
    annule:    { label: L ? 'Cancelado' : 'Annulé',     color: 'text-red-700',   bg: 'bg-red-100',    emoji: '❌' },
  }

  const filtered = filterStatut === 'all' ? interventions : interventions.filter(i => i.statut === filterStatut)
  const enCours = interventions.filter(i => ['en_route', 'sur_place'].includes(i.statut))

  return (
    <div className="space-y-6">
      {/* Alerte intervention en cours */}
      {enCours.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="font-bold text-amber-800 text-sm">{enCours.length} {L ? (enCours.length > 1 ? 'intervenções em curso' : 'intervenção em curso') : `intervention${enCours.length > 1 ? 's' : ''} en cours`}</span>
          </div>
          {enCours.map(i => (
            <div key={i.id} onClick={() => setSelected(i)} className="mt-2 bg-white border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-[#0D1B2E]">{i.type} — {i.artisan.split('—')[0].trim()}</div>
                  <div className="text-xs text-[#8A9BB0] mt-0.5">{i.description}</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${statutCfg[i.statut].bg} ${statutCfg[i.statut].color}`}>
                    {statutCfg[i.statut].emoji} {statutCfg[i.statut].label}
                  </span>
                  {i.gpsEta && <div className="text-[10px] text-[#8A9BB0] mt-1">ETA : ~{i.gpsEta} min</div>}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-[#8A9BB0] mb-1">
                  <span>{L ? 'Progresso' : 'Progression'}</span>
                  <span>{i.progression}%</span>
                </div>
                <div className="h-2 bg-[#F7F4EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${i.progression}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['all', L ? 'Todas' : 'Toutes'], ['planifie', L ? '📅 Planeadas' : '📅 Planifiées'], ['en_route', L ? '🚗 A caminho' : '🚗 En route'], ['sur_place', L ? '🔧 No local' : '🔧 Sur place'], ['termine', L ? '✅ Concluídas' : '✅ Terminées']] as [string, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatut(v)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filterStatut === v ? 'bg-[#0D1B2E] text-white border-[#C9A84C]' : 'bg-white text-[#4A5E78] border-[#E4DDD0] hover:border-[#C9A84C]'
            }`}
          >{l}</button>
        ))}
      </div>

      {/* Liste interventions */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-12 text-center">
            <div className="text-5xl mb-3">🔧</div>
            <div className="text-sm text-[#4A5E78] font-medium">{L ? 'Nenhuma intervenção para este filtro' : 'Aucune intervention pour ce filtre'}</div>
          </div>
        )}
        {filtered.map(i => {
          const cfg = statutCfg[i.statut]
          return (
            <div
              key={i.id}
              onClick={() => setSelected(i)}
              className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm hover:border-[#C9A84C] hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                    <span className="text-xs text-[#8A9BB0]">{new Date(i.dateRdv).toLocaleDateString(dateFmtLocale)} · {i.heureRdv}</span>
                  </div>
                  <div className="font-semibold text-[#0D1B2E]">{i.type}</div>
                  <div className="text-sm text-[#8A9BB0] truncate">{i.description}</div>
                  <div className="text-xs text-[#8A9BB0] mt-1">👷 {i.artisan}</div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {i.note && (
                    <div className="text-sm font-bold text-amber-500">{'⭐'.repeat(i.note)}</div>
                  )}
                  {i.statut === 'termine' && !i.note && (
                    <button
                      onClick={e => { e.stopPropagation(); setNoteModal(i); setNoteVal(5); setNoteComment('') }}
                      className="text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1 rounded-full font-semibold transition"
                    >
                      {L ? '✍️ Avaliar' : '✍️ Noter'}
                    </button>
                  )}
                  {i.preuve && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {L ? '✅ Prova' : '✅ Preuve'} {i.preuve.signee ? (L ? '+ assinado' : '+ signé') : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar pour interventions non terminées */}
              {!['termine', 'annule', 'planifie'].includes(i.statut) && (
                <div className="mt-3">
                  <div className="h-1.5 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C] rounded-full transition-all" style={{ width: `${i.progression}%` }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal détail intervention */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4DDD0]">
              <div>
                <h3 className="text-lg font-bold text-[#0D1B2E]">{selected.type}</h3>
                <p className="text-sm text-[#8A9BB0]">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#8A9BB0] hover:text-[#4A5E78] text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Statut */}
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${statutCfg[selected.statut].bg} ${statutCfg[selected.statut].color}`}>
                  {statutCfg[selected.statut].emoji} {statutCfg[selected.statut].label}
                </span>
                {selected.gpsEta && (
                  <span className="text-sm text-amber-600 font-semibold">🛣️ ETA ~{selected.gpsEta} {L ? 'min' : 'min'}</span>
                )}
              </div>

              {/* Artisan */}
              <div className="bg-[#F7F4EE] rounded-xl p-4">
                <div className="text-xs text-[#8A9BB0] mb-1 font-medium">{L ? 'TÉCNICO' : 'ARTISAN'}</div>
                <div className="font-semibold text-[#0D1B2E]">{selected.artisan}</div>
                <a href={`tel:${selected.artisanPhone.replace(/\s/g, '')}`} className="text-sm text-[#C9A84C] hover:text-[#A8842A] font-medium mt-1 inline-block">
                  📞 {selected.artisanPhone}
                </a>
              </div>

              {/* RDV */}
              <div className="bg-[#F7F4EE] rounded-xl p-4">
                <div className="text-xs text-[#8A9BB0] mb-1 font-medium">{L ? 'MARCAÇÃO' : 'RDV'}</div>
                <div className="font-semibold text-[#0D1B2E]">
                  {new Date(selected.dateRdv).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} {L ? 'às' : 'à'} {selected.heureRdv}
                </div>
              </div>

              {/* GPS live */}
              {['en_route', 'sur_place'].includes(selected.statut) && selected.gpsLat && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 font-bold mb-1">{L ? '📍 POSIÇÃO EM TEMPO REAL' : '📍 POSITION EN TEMPS RÉEL'}</div>
                  <div className="text-sm text-amber-800">Lat: {selected.gpsLat.toFixed(4)}, Lng: {selected.gpsLng?.toFixed(4)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-700 font-medium">{L ? 'Sinal GPS ativo' : 'Signal GPS actif'}</span>
                  </div>
                </div>
              )}

              {/* Progression */}
              {selected.statut !== 'annule' && (
                <div>
                  <div className="flex justify-between text-sm text-[#4A5E78] mb-2">
                    <span className="font-medium">{L ? 'Progresso' : 'Progression'}</span>
                    <span className="font-bold">{selected.progression}%</span>
                  </div>
                  <div className="h-3 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${selected.progression}%`, backgroundColor: selected.progression === 100 ? '#10b981' : '#8b5cf6' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#8A9BB0] mt-1">
                    <span>{L ? 'Início' : 'Démarrage'}</span>
                    <span>{L ? 'Em curso' : 'En cours'}</span>
                    <span>{L ? 'Concluído' : 'Terminé'}</span>
                  </div>
                </div>
              )}

              {/* Preuve */}
              {selected.preuve && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-xs text-green-700 font-bold mb-2">{L ? '📸 PROVA DE INTERVENÇÃO' : '📸 PREUVE D\'INTERVENTION'}</div>
                  <div className="flex gap-4 text-sm text-green-800">
                    <span>📷 {selected.preuve.avantPhotos} {L ? (selected.preuve.avantPhotos > 1 ? 'fotos antes' : 'foto antes') : `photo${selected.preuve.avantPhotos > 1 ? 's' : ''} avant`}</span>
                    <span>📷 {selected.preuve.apresPhotos} {L ? (selected.preuve.apresPhotos > 1 ? 'fotos depois' : 'foto depois') : `photo${selected.preuve.apresPhotos > 1 ? 's' : ''} après`}</span>
                    {selected.preuve.signee && <span>{L ? '✍️ Assinado' : '✍️ Signé'}</span>}
                  </div>
                </div>
              )}

              {/* Note */}
              {selected.note && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 font-bold mb-1">{L ? 'A SUA AVALIAÇÃO' : 'VOTRE AVIS'}</div>
                  <div className="text-xl">{'⭐'.repeat(selected.note)}</div>
                  {selected.commentaire && <p className="text-sm text-[#4A5E78] mt-1 italic">&ldquo;{selected.commentaire}&rdquo;</p>}
                </div>
              )}

              {/* CTA noter */}
              {selected.statut === 'termine' && !selected.note && (
                <button
                  onClick={() => { setNoteModal(selected); setSelected(null); setNoteVal(5); setNoteComment('') }}
                  className="w-full bg-[#0D1B2E] hover:bg-[#152338] text-white font-bold py-3 rounded-xl transition"
                >
                  {L ? '⭐ Avaliar esta intervenção' : '⭐ Donner mon avis sur cette intervention'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal notation */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-[#E4DDD0]">
              <h3 className="text-lg font-bold text-[#0D1B2E]">{L ? '⭐ Avaliar a intervenção' : '⭐ Évaluer l\'intervention'}</h3>
              <p className="text-sm text-[#8A9BB0] mt-1">{noteModal.artisan.split('—')[0].trim()} — {noteModal.type}</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Stars */}
              <div>
                <div className="text-sm font-medium text-[#4A5E78] mb-2">{L ? 'A sua nota' : 'Votre note'}</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setNoteVal(n)}
                      className={`text-3xl transition-transform hover:scale-110 ${n <= noteVal ? 'opacity-100' : 'opacity-30'}`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <div className="text-sm text-[#8A9BB0] mt-1">
                  {noteVal === 1 ? (L ? 'Muito insatisfeito' : 'Très insatisfait') : noteVal === 2 ? (L ? 'Insatisfeito' : 'Insatisfait') : noteVal === 3 ? (L ? 'Razoável' : 'Correct') : noteVal === 4 ? (L ? 'Satisfeito' : 'Satisfait') : (L ? 'Muito satisfeito' : 'Très satisfait')}
                </div>
              </div>
              {/* Commentaire */}
              <div>
                <label className="text-sm font-medium text-[#4A5E78] block mb-1">{L ? 'Comentário (opcional)' : 'Commentaire (optionnel)'}</label>
                <textarea
                  value={noteComment}
                  onChange={e => setNoteComment(e.target.value)}
                  rows={3}
                  placeholder={L ? 'Descreva a sua experiência...' : 'Décrivez votre expérience...'}
                  className="w-full border border-[#E4DDD0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setNoteModal(null)} className="flex-1 border border-[#E4DDD0] text-[#4A5E78] py-2.5 rounded-xl text-sm font-medium hover:bg-[#F7F4EE] transition">
                  {L ? 'Cancelar' : 'Annuler'}
                </button>
                <button onClick={submitNote} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-xl text-sm font-bold transition">
                  {L ? 'Enviar avaliação' : 'Envoyer l\'avis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant MesChargesSection ───────────────────────────────────────────────

function MesChargesSection({ profile, paiements, charges }: { profile: CoproProfile; paiements: Paiement[]; charges: ChargesMensuelles[] }) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [anneeSelect, setAnneeSelect] = useState(2026)
  const [onglet, setOnglet] = useState<'dashboard' | 'postes' | 'calendrier'>('dashboard')

  const annees = [2026, 2025, 2024]
  const chargesAnnee = paiements.filter(p => new Date(p.dateEcheance).getFullYear() === anneeSelect)
  const totalPayeAnnee = chargesAnnee.filter(p => p.statut === 'payee').reduce((s, p) => s + Math.max(p.montant, 0), 0)
  const totalEnAttenteAnnee = chargesAnnee.filter(p => p.statut !== 'payee').reduce((s, p) => s + Math.max(p.montant, 0), 0)
  const totalBudgetAnnee = POSTES_CHARGES.reduce((s, p) => s + p.budget, 0)
  const totalReelAnnee = POSTES_CHARGES.reduce((s, p) => s + p.montantAnnuel, 0)
  const totalAnnee = totalPayeAnnee + totalEnAttenteAnnee

  const moisLabels = L ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] : ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const chargesParMois = moisLabels.map((m, idx) => {
    const moisStr = `${anneeSelect}-${String(idx + 1).padStart(2, '0')}`
    const c = charges.find(ch => ch.mois === moisStr)
    return { mois: m, montant: c?.montant || 0, statut: c?.statut || null }
  })
  const maxMontant = Math.max(...chargesParMois.map(m => m.montant), 1)

  return (
    <div className="space-y-6">
      {/* Header année */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-[#4A5E78]">{L ? 'Ano :' : 'Année :'}</div>
        <div className="flex gap-1">
          {annees.map(a => (
            <button
              key={a}
              onClick={() => setAnneeSelect(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${anneeSelect === a ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-[#4A5E78] hover:bg-[#F7F4EE]'}`}
            >{a}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Total pago' : 'Total payé'} {anneeSelect}</div>
          <div className="text-2xl font-black text-green-600">{formatPrice(totalPayeAnnee)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Por pagar' : 'Reste à payer'}</div>
          <div className={`text-2xl font-black ${totalEnAttenteAnnee > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPrice(totalEnAttenteAnnee)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Orçamento anual' : 'Budget annuel'}</div>
          <div className="text-2xl font-black text-[#0D1B2E]">{formatPrice(totalBudgetAnnee)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{L ? 'Quota-parte' : 'Quote-part'} {profile.quotePart}%</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Realizado / Orçamento' : 'Réalisé / Budget'}</div>
          <div className={`text-2xl font-black ${totalReelAnnee > totalBudgetAnnee ? 'text-red-600' : 'text-green-600'}`}>
            {Math.round((totalReelAnnee / totalBudgetAnnee) * 100)}%
          </div>
          <div className="text-xs text-[#8A9BB0] mt-1">{formatPrice(totalReelAnnee)} {L ? 'real' : 'réel'}</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[#F7F4EE] rounded-xl p-1">
        {([['dashboard', '📊 Dashboard'], ['postes', L ? '📋 Rubricas' : '📋 Postes'], ['calendrier', L ? '📅 Calendário' : '📅 Calendrier']] as [typeof onglet, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setOnglet(v)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${onglet === v ? 'bg-white shadow text-[#A8842A]' : 'text-[#8A9BB0] hover:text-[#4A5E78]'}`}
          >{l}</button>
        ))}
      </div>

      {/* Dashboard */}
      {onglet === 'dashboard' && (
        <div className="space-y-4">
          {/* Graphe barres mensuel */}
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
            <div className="text-sm font-bold text-[#4A5E78] mb-4">{L ? '📊 Quotas mensais' : '📊 Charges mensuelles'} {anneeSelect}</div>
            <div className="flex items-end gap-1 h-32">
              {chargesParMois.map((m) => {
                const h = m.montant > 0 ? Math.max((m.montant / maxMontant) * 100, 5) : 5
                const color = m.statut === 'payee' ? '#10b981' : m.statut === 'en_attente' ? '#f59e0b' : m.statut === 'en_retard' ? '#ef4444' : '#e5e7eb'
                return (
                  <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{ height: `${h}%`, backgroundColor: color }}
                      title={`${m.mois}: ${formatPrice(m.montant)}`}
                    />
                    <div className="text-[9px] text-[#8A9BB0] font-medium">{m.mois}</div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />{L ? 'Paga' : 'Payée'}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />{L ? 'Pendente' : 'En attente'}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />{L ? 'Em atraso' : 'En retard'}</span>
            </div>
          </div>

          {/* Répartition */}
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
            <div className="text-sm font-bold text-[#4A5E78] mb-3">{L ? '🥧 Distribuição orçamento' : '🥧 Répartition budget'}</div>
            <div className="space-y-2">
              {POSTES_CHARGES.sort((a, b) => b.montantAnnuel - a.montantAnnuel).map(p => (
                <div key={p.label} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 text-center">{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs text-[#4A5E78] mb-0.5">
                      <span className="truncate">{p.label}</span>
                      <span className="font-semibold flex-shrink-0 ml-2">{formatPrice(p.montantAnnuel)}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F4EE] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(p.montantAnnuel / totalReelAnnee) * 100}%`, backgroundColor: p.couleur }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-[#8A9BB0] flex-shrink-0 w-8 text-right">
                    {Math.round((p.montantAnnuel / totalReelAnnee) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Postes de charges */}
      {onglet === 'postes' && (
        <div className="space-y-3">
          {POSTES_CHARGES.map(p => {
            const over = p.montantAnnuel > p.budget
            return (
              <div key={p.label} className={`bg-white rounded-xl border p-4 shadow-sm ${over ? 'border-red-200' : 'border-[#E4DDD0]'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <div className="font-semibold text-[#0D1B2E] text-sm">{p.label}</div>
                      <div className="text-xs text-[#8A9BB0] mt-0.5">{L ? 'Orçamento' : 'Budget'} : {formatPrice(p.budget)} · {L ? 'Real' : 'Réel'} : {formatPrice(p.montantAnnuel)}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {over ? `+${formatPrice(p.montantAnnuel - p.budget)}` : `-${formatPrice(p.budget - p.montantAnnuel)}`}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((p.montantAnnuel / p.budget) * 100, 100)}%`,
                        backgroundColor: over ? '#ef4444' : p.couleur,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[#8A9BB0] mt-1">{Math.round((p.montantAnnuel / p.budget) * 100)}% {L ? 'do orçamento consumido' : 'du budget consommé'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Calendrier paiements */}
      {onglet === 'calendrier' && (
        <div className="space-y-3">
          <div className="text-xs text-[#8A9BB0] font-medium">{L ? 'Próximos vencimentos' : 'Prochaines échéances'}</div>
          {paiements
            .filter(p => p.statut !== 'payee' && new Date(p.dateEcheance) >= new Date())
            .sort((a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime())
            .map(p => {
              const daysLeft = Math.ceil((new Date(p.dateEcheance).getTime() - Date.now()) / 86400000)
              const urgent = daysLeft <= 14
              return (
                <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${urgent ? 'border-red-200 bg-red-50' : 'border-[#E4DDD0]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#0D1B2E] text-sm">{p.description}</div>
                      <div className="text-xs text-[#8A9BB0] mt-0.5">{p.reference} · {L ? 'Venc.' : 'Éch.'} {new Date(p.dateEcheance).toLocaleDateString(dateFmtLocale)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-lg ${p.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>{formatPrice(Math.abs(p.montant))}</div>
                      <div className={`text-[10px] font-bold mt-0.5 ${urgent ? 'text-red-600' : 'text-[#8A9BB0]'}`}>
                        {urgent ? `⚠️ J-${daysLeft}` : `J-${daysLeft}`}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

          <div className="text-xs text-[#8A9BB0] font-medium mt-4">{L ? 'Pagamentos efetuados' : 'Paiements effectués'}</div>
          {paiements
            .filter(p => p.statut === 'payee')
            .sort((a, b) => new Date(b.datePaiement!).getTime() - new Date(a.datePaiement!).getTime())
            .map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0D1B2E] text-sm">{p.description}</div>
                    <div className="text-xs text-[#8A9BB0] mt-0.5">{L ? 'Pago em' : 'Payé le'} {new Date(p.datePaiement!).toLocaleDateString(dateFmtLocale)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black text-lg ${p.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>{formatPrice(Math.abs(p.montant))}</div>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{L ? '✓ Pago' : '✓ Payé'}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Types Locataire ──────────────────────────────────────────────────────────

interface Quittance {
  id: string
  mois: string          // '2026-02'
  montant: number
  statut: 'emise' | 'tele_chargee'
  dateEmission: string
  reference: string
}

interface Bail {
  id: string
  dateDebut: string
  dateFin: string | null
  duree: number           // mois
  loyerBase: number
  charges: number
  depot: number
  indexation: 'irl' | 'icc'
  derniereRevision: string
  prochaineRevision: string
  indiceRef: number
  indiceActuel: number
  bailleur: string
  bailleurAdresse: string
  bailleurPhone: string
  agence?: string
  logement: string       // description
  surface: number        // m²
  numLot?: string
  preavis: number       // mois
}

// ─── Données démo locataire ───────────────────────────────────────────────────

const QUITTANCES_DEMO: Quittance[] = [
  { id: 'q1', mois: '2026-02', montant: 1250, statut: 'emise',         dateEmission: '2026-02-01', reference: 'QUI-2026-02' },
  { id: 'q2', mois: '2026-01', montant: 1250, statut: 'tele_chargee', dateEmission: '2026-01-01', reference: 'QUI-2026-01' },
  { id: 'q3', mois: '2025-12', montant: 1250, statut: 'tele_chargee', dateEmission: '2025-12-01', reference: 'QUI-2025-12' },
  { id: 'q4', mois: '2025-11', montant: 1250, statut: 'tele_chargee', dateEmission: '2025-11-01', reference: 'QUI-2025-11' },
  { id: 'q5', mois: '2025-10', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-10-01', reference: 'QUI-2025-10' },
  { id: 'q6', mois: '2025-09', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-09-01', reference: 'QUI-2025-09' },
  { id: 'q7', mois: '2025-08', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-08-01', reference: 'QUI-2025-08' },
  { id: 'q8', mois: '2025-07', montant: 1210, statut: 'tele_chargee', dateEmission: '2025-07-01', reference: 'QUI-2025-07' },
  { id: 'q9', mois: '2025-06', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-06-01', reference: 'QUI-2025-06' },
  { id: 'q10', mois: '2025-05', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-05-01', reference: 'QUI-2025-05' },
  { id: 'q11', mois: '2025-04', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-04-01', reference: 'QUI-2025-04' },
  { id: 'q12', mois: '2025-03', montant: 1180, statut: 'tele_chargee', dateEmission: '2025-03-01', reference: 'QUI-2025-03' },
]

const BAIL_DEMO: Bail = {
  id: 'bail-1',
  dateDebut: '2022-03-01',
  dateFin: null,
  duree: 36,
  loyerBase: 1100,
  charges: 150,
  depot: 2200,
  indexation: 'irl',
  derniereRevision: '2025-03-01',
  prochaineRevision: '2026-03-01',
  indiceRef: 136.27,
  indiceActuel: 140.38,
  bailleur: 'SCI Les Acacias',
  bailleurAdresse: '45 avenue Victor Hugo, 75016 Paris',
  bailleurPhone: '01 45 67 89 00',
  agence: 'Cabinet Dupont Immobilier',
  logement: 'Appartement T3, 3ème étage, Bâtiment D',
  surface: 68,
  numLot: '12',
  preavis: 3,
}

// ─── Composant QuittancesSection ──────────────────────────────────────────────

function QuittancesSection({ profile }: { profile: CoproProfile }) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [quittances] = React.useState<Quittance[]>(QUITTANCES_DEMO)
  const [downloaded, setDownloaded] = React.useState<Set<string>>(new Set())
  const [anneeFilter, setAnneeFilter] = React.useState<string>('2026')

  const annees = [...new Set(quittances.map(q => q.mois.split('-')[0]))].sort((a, b) => Number(b) - Number(a))
  const filtered = quittances.filter(q => q.mois.startsWith(anneeFilter))

  const moisLabel = (mois: string) => {
    const [y, m] = mois.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })
  }

  const handleDownload = (q: Quittance) => {
    const texte = L ? `RECIBO DE RENDA — ${q.reference}
══════════════════════════════════════════
Senhorio : ${BAIL_DEMO.bailleur}
Inquilino : ${profile.prenom} ${profile.nom}
Alojamento : ${BAIL_DEMO.logement}
Período : ${moisLabel(q.mois)}
══════════════════════════════════════════
Renda base          : ${formatPrice(BAIL_DEMO.loyerBase)}
Encargos            : ${formatPrice(BAIL_DEMO.charges)}
──────────────────────────────────────────
TOTAL               : ${formatPrice(q.montant)}
══════════════════════════════════════════
Data de emissão : ${new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}
Referência : ${q.reference}

Este recibo atesta que a renda do mês de ${moisLabel(q.mois)}
foi devidamente recebida.

Feito em Lisboa, a ${new Date().toLocaleDateString(dateFmtLocale)}
Assinatura do senhorio : ${BAIL_DEMO.bailleur}` : `QUITTANCE DE LOYER — ${q.reference}
══════════════════════════════════════════
Bailleur : ${BAIL_DEMO.bailleur}
Locataire : ${profile.prenom} ${profile.nom}
Logement : ${BAIL_DEMO.logement}
Période : ${moisLabel(q.mois)}
══════════════════════════════════════════
Loyer net           : ${formatPrice(BAIL_DEMO.loyerBase)}
Charges             : ${formatPrice(BAIL_DEMO.charges)}
─────────────────────────────────────────
TOTAL               : ${formatPrice(q.montant)}
══════════════════════════════════════════
Date d'émission : ${new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}
Référence : ${q.reference}

Cette quittance atteste que le loyer du mois de ${moisLabel(q.mois)}
a bien été reçu.

Fait à Paris, le ${new Date().toLocaleDateString(dateFmtLocale)}
Signature du bailleur : ${BAIL_DEMO.bailleur}`

    const blob = new Blob([texte], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${q.reference}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(prev => new Set([...prev, q.id]))
  }

  const totalAnnee = filtered.reduce((s, q) => s + q.montant, 0)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Renda mensal' : 'Loyer mensuel'}</div>
          <div className="text-2xl font-black text-[#0D1B2E]">{formatPrice(BAIL_DEMO.loyerBase + BAIL_DEMO.charges)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{formatPrice(BAIL_DEMO.loyerBase)} + {formatPrice(BAIL_DEMO.charges)} {L ? 'encargos' : 'charges'}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">Total {anneeFilter}</div>

          <div className="text-2xl font-black text-[#C9A84C]">{formatPrice(totalAnnee)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{filtered.length} {L ? (filtered.length > 1 ? 'recibos' : 'recibo') : `quittance${filtered.length > 1 ? 's' : ''}`}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Próxima revisão' : 'Prochaine révision'}</div>
          <div className="text-xl font-black text-amber-600">
            {new Date(BAIL_DEMO.prochaineRevision).toLocaleDateString(dateFmtLocale, { month: 'short', year: 'numeric' })}
          </div>
          <div className="text-xs text-[#8A9BB0] mt-1">{L ? 'Índice IRL' : 'Indice IRL'}</div>
        </div>
      </div>

      {/* Filtre année */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-[#4A5E78]">{L ? 'Ano :' : 'Année :'}</div>
        <div className="flex gap-1">
          {annees.map(a => (
            <button key={a} onClick={() => setAnneeFilter(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${anneeFilter === a ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-[#4A5E78] hover:bg-[#F7F4EE]'}`}
            >{a}</button>
          ))}
        </div>
      </div>

      {/* Liste quittances */}
      <div className="space-y-3">
        {filtered.map(q => (
          <div key={q.id} className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-[rgba(201,168,76,0.15)] rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🧾</span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#0D1B2E]">{moisLabel(q.mois)}</div>
                <div className="text-xs text-[#8A9BB0] mt-0.5">{q.reference} · {L ? 'Emitido em' : 'Émise le'} {new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="font-black text-[#0D1B2E]">{formatPrice(q.montant)}</div>
                {downloaded.has(q.id) && (
                  <div className="text-[10px] text-green-600 font-medium mt-0.5">{L ? '✓ Descarregado' : '✓ Téléchargée'}</div>
                )}
              </div>
              <button
                onClick={() => handleDownload(q)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition ${
                  downloaded.has(q.id)
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-[rgba(201,168,76,0.08)] border-[#C9A84C] text-[#A8842A] hover:bg-[rgba(201,168,76,0.15)]'
                }`}
              >
                {downloaded.has(q.id) ? '✓ OK' : (L ? '⬇ Descarregar' : '⬇ Télécharger')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Demande quittance */}
      <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-4 text-center">
        <div className="text-sm text-[#4A5E78] mb-2">{L ? 'Não encontra um recibo?' : 'Vous ne trouvez pas une quittance ?'}</div>
        <a
          href={`mailto:cabinet@dupont-immobilier.fr?subject=${L ? 'Pedido de recibo de renda' : 'Demande quittance de loyer'}`}
          className="text-sm text-[#C9A84C] hover:text-[#A8842A] font-semibold"
        >
          {L ? '📧 Contactar o gestor' : '📧 Contacter le gestionnaire'}
        </a>
      </div>
    </div>
  )
}

// ─── Composant MonBailSection ──────────────────────────────────────────────────

function MonBailSection({ profile }: { profile: CoproProfile }) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'
  const bail = BAIL_DEMO

  const dureeRestante = () => {
    if (!bail.dateFin) return null
    const months = Math.max(0, Math.ceil((new Date(bail.dateFin).getTime() - Date.now()) / (30.44 * 86400000)))
    return months
  }

  const anciennete = () => {
    const months = Math.floor((Date.now() - new Date(bail.dateDebut).getTime()) / (30.44 * 86400000))
    const years = Math.floor(months / 12)
    const rem = months % 12
    if (years === 0) return `${months} ${L ? 'meses' : 'mois'}`
    return `${years} ${L ? (years > 1 ? 'anos' : 'ano') : `an${years > 1 ? 's' : ''}`}${rem > 0 ? ` ${rem} ${L ? 'meses' : 'mois'}` : ''}`
  }

  const loyerRevise = () => {
    // Calcul IRL: loyer * (indice actuel / indice référence)
    const ratio = bail.indiceActuel / bail.indiceRef
    return Math.round(bail.loyerBase * ratio * 100) / 100
  }

  const hausse = loyerRevise() - bail.loyerBase
  const pctHausse = Math.round((hausse / bail.loyerBase) * 1000) / 10

  const daysToRevision = Math.ceil((new Date(bail.prochaineRevision).getTime() - Date.now()) / 86400000)

  return (
    <div className="space-y-6">
      {/* Alerte révision */}
      {daysToRevision <= 90 && daysToRevision >= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-amber-800">{L ? `Revisão de renda em ${daysToRevision} dias` : `Révision de loyer dans ${daysToRevision} jours`}</div>
            <div className="text-sm text-amber-700 mt-0.5">
              {L ? 'Revisão prevista em' : 'Révision prévue le'} {new Date(bail.prochaineRevision).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}.
              {L ? 'Nova renda estimada :' : 'Nouveau loyer estimé :'} <span className="font-bold">{formatPrice(loyerRevise())}</span> (+{formatPrice(hausse)} / +{pctHausse}%)
            </div>
          </div>
        </div>
      )}

      {/* Infos bail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Données clés */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm space-y-4">
          <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2">{L ? '📜 Informações do contrato' : '📜 Informations bail'}</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Data de início' : 'Date de début'}</span>
              <span className="font-semibold">{new Date(bail.dateDebut).toLocaleDateString(dateFmtLocale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Duração / Tipo' : 'Durée / Type'}</span>
              <span className="font-semibold">{bail.duree} {L ? 'meses · Contrato residencial' : 'mois · Bail résidentiel'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Antiguidade' : 'Ancienneté'}</span>
              <span className="font-semibold text-[#C9A84C]">{anciennete()}</span>
            </div>
            {bail.dateFin && (
              <div className="flex justify-between">
                <span className="text-[#8A9BB0]">{L ? 'Fim do contrato' : 'Fin de bail'}</span>
                <span className="font-semibold">{new Date(bail.dateFin).toLocaleDateString(dateFmtLocale)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Pré-aviso' : 'Préavis'}</span>
              <span className="font-semibold">{bail.preavis} {L ? 'meses' : 'mois'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Área' : 'Surface'}</span>
              <span className="font-semibold">{bail.surface} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Alojamento' : 'Logement'}</span>
              <span className="font-semibold text-right max-w-[55%]">{bail.logement}</span>
            </div>
          </div>
        </div>

        {/* Financier */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm space-y-4">
          <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2">{L ? '💶 Financeiro' : '💶 Financier'}</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Renda sem encargos' : 'Loyer hors charges'}</span>
              <span className="font-semibold">{formatPrice(bail.loyerBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Encargos forfetários' : 'Charges forfaitaires'}</span>
              <span className="font-semibold">{formatPrice(bail.charges)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E4DDD0] pt-2">
              <span className="font-bold text-[#4A5E78]">{L ? 'Total mensal' : 'Total mensuel'}</span>
              <span className="font-black text-[#0D1B2E]">{formatPrice(bail.loyerBase + bail.charges)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Caução' : 'Dépôt de garantie'}</span>
              <span className="font-semibold">{formatPrice(bail.depot)}</span>
            </div>
          </div>

          {/* Révision IRL */}
          <div className="bg-[rgba(201,168,76,0.08)] border border-[#C9A84C] rounded-xl p-3 mt-2">
            <div className="text-xs font-bold text-[#A8842A] mb-2">{L ? '📊 Revisão' : '📊 Révision'} {bail.indexation.toUpperCase()}</div>
            <div className="space-y-1.5 text-xs text-[#A8842A]">
              <div className="flex justify-between">
                <span>{L ? 'Índice de referência' : 'Indice de référence'}</span>
                <span className="font-bold">{bail.indiceRef}</span>
              </div>
              <div className="flex justify-between">
                <span>{L ? 'Índice atual' : 'Indice actuel'}</span>
                <span className="font-bold">{bail.indiceActuel}</span>
              </div>
              <div className="flex justify-between border-t border-[#C9A84C] pt-1.5">
                <span className="font-bold">{L ? 'Renda revista estimada' : 'Loyer révisé estimé'}</span>
                <span className="font-black text-[#0D1B2E]">{formatPrice(loyerRevise())} <span className="text-[10px]">(+{pctHausse}%)</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bailleur */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm">
        <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2 mb-4">{L ? '🏢 Senhorio / Gestor' : '🏢 Bailleur / Gestionnaire'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">🏢</span>
              <div><div className="text-xs text-[#8A9BB0]">{L ? 'Senhorio' : 'Bailleur'}</div><div className="font-semibold">{bail.bailleur}</div></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">📍</span>
              <div><div className="text-xs text-[#8A9BB0]">{L ? 'Morada' : 'Adresse'}</div><div className="font-semibold">{bail.bailleurAdresse}</div></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">📞</span>
              <div>
                <div className="text-xs text-[#8A9BB0]">{L ? 'Telefone' : 'Téléphone'}</div>
                <a href={`tel:${bail.bailleurPhone.replace(/\s/g, '')}`} className="font-semibold text-[#C9A84C] hover:text-[#A8842A]">{bail.bailleurPhone}</a>
              </div>
            </div>
            {bail.agence && (
              <div className="flex items-start gap-2">
                <span className="text-[#8A9BB0] w-5 flex-shrink-0">🏪</span>
                <div><div className="text-xs text-[#8A9BB0]">{L ? 'Agência' : 'Agence'}</div><div className="font-semibold">{bail.agence}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendrier bail */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm">
        <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2 mb-4">{L ? '📅 Datas importantes' : '📅 Échéances importantes'}</div>
        <div className="space-y-3">
          {[
            { label: L ? 'Última revisão de renda' : 'Dernière révision loyer', date: bail.derniereRevision, icon: '✅', color: 'text-green-600' },
            { label: L ? 'Próxima revisão IRL' : 'Prochaine révision IRL', date: bail.prochaineRevision, icon: daysToRevision <= 90 ? '⚠️' : '📅', color: daysToRevision <= 90 ? 'text-amber-600' : 'text-[#4A5E78]' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>{item.icon}</span>
                <span className="text-[#4A5E78]">{item.label}</span>
              </div>
              <span className={`text-sm font-bold ${item.color}`}>
                {new Date(item.date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span>📋</span>
              <span className="text-[#4A5E78]">{L ? 'Data de pré-aviso (em caso de saída)' : 'Date préavis (si départ)'}</span>
            </div>
            <span className="text-sm font-bold text-[#4A5E78]">
              {bail.preavis} {L ? 'meses antes do fim' : 'mois avant la fin'}
            </span>
          </div>
        </div>
      </div>

      {/* Signalement locataire */}
      <div className="bg-[rgba(201,168,76,0.08)] border border-[#C9A84C] rounded-xl p-4">
        <div className="font-bold text-[#0D1B2E] mb-2">{L ? '🔧 Reportar um problema ao senhorio' : '🔧 Signaler un problème au bailleur'}</div>
        <p className="text-sm text-[#A8842A] mb-3">{L ? 'Fuga, avaria, obras urgentes — contacte diretamente o seu gestor.' : 'Fuite, panne, travaux urgents — contactez directement votre gestionnaire.'}</p>
        <div className="flex gap-2">
          <a href={`tel:${bail.bailleurPhone.replace(/\s/g, '')}`}
            className="flex-1 text-center py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white text-sm font-bold rounded-xl transition">
            {L ? '📞 Ligar' : '📞 Appeler'}
          </a>
          <a href={`mailto:cabinet@dupont-immobilier.fr?subject=${L ? 'Ocorrência - Problema no alojamento' : 'Signalement - Problème logement'}`}
            className="flex-1 text-center py-2.5 bg-white border border-[#C9A84C] text-[#A8842A] text-sm font-bold rounded-xl hover:bg-[rgba(201,168,76,0.08)] transition">
            📧 Email
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Traductions FR / PT ────────────────────────────────────────────────────────

const T = {
  fr: {
    // Nav items
    nav_accueil: 'Tableau de bord',
    nav_documents: 'Documents',
    nav_paiements: 'Paiements',
    nav_mes_charges: 'Mes Charges',
    nav_quittances: 'Quittances loyer',
    nav_mon_bail: 'Mon Bail',
    nav_interventions: 'Mes Interventions',
    nav_annonces: 'Annonces',
    nav_signalement: 'Signalement',
    nav_assemblees: 'Assemblées & Votes',
    nav_historique: 'Historique',
    nav_modules: 'Modules',
    nav_parametres: 'Paramètres',
    nav_assistant: 'Assistant Fixy',
    // Sidebar categories
    cat_general: 'GÉNÉRAL',
    cat_financier: 'FINANCIER',
    cat_gestion: 'GESTION',
    cat_juridique: 'JURIDIQUE',
    cat_outils: 'OUTILS',
    // Module descriptions
    mod_documents: 'Accès aux PV, comptes et documents copro',
    mod_paiements: 'Suivi et historique de vos paiements',
    mod_mes_charges: 'Détail mensuel de vos charges',
    mod_quittances: 'Vos quittances de loyer mensuelles',
    mod_mon_bail: 'Informations de votre bail et renouvellement',
    mod_interventions: 'Suivi des travaux dans votre immeuble',
    mod_annonces: 'Annonces du syndic et de la copro',
    mod_signalement: 'Signaler un problème dans l\'immeuble',
    mod_assemblees: 'AG, résolutions et votes en ligne',
    mod_historique: 'Historique de toutes vos actions',
    mod_assistant: 'Posez vos questions à Fixy',
    // Header / loading
    loading: 'Chargement de votre espace...',
    retourAdmin: '⚡ Retour Admin',
    deconnexion: 'Déconnexion',
    reduire: 'Réduire',
    developper: 'Développer',
    coproLot: 'Copropriétaire · Lot',
    notifications: 'Notifications',
    bat: 'Bât.',
    lot: 'Lot',
    etage: 'Étage',
    // Accueil
    chargesDuMois: 'Charges du mois',
    payee: '✓ Payée',
    enAttente: 'En attente',
    soldeAPayer: 'Solde à payer',
    paiementsEnAttente: 'paiement(s) en attente',
    tantiemes: 'Tantièmes',
    quotePart: 'Quote-part',
    nonLues: 'non lue(s)',
    faireSignalement: '🔔 Faire un signalement',
    mesPaiements: '💶 Mes paiements',
    mesDocuments: '📁 Mes documents',
    voterAG: '🗳️ Voter en AG',
    prochainesEcheances: '📅 Prochaines échéances',
    urgent: 'Urgent',
    toutMarquerLu: 'Tout marquer lu',
    dernieresAnnonces: '📢 Dernières annonces',
    voirTout: 'Voir tout →',
    info: 'Info',
    important: 'Important',
    // Documents
    tousLesTypes: 'Tous les types',
    toutesLesAnnees: 'Toutes les années',
    rechercherDoc: '🔍 Rechercher un document...',
    nouveau: 'Nouveau',
    publique: 'Public',
    personnel: 'Personnel',
    ajouteLe: 'Ajouté le',
    consulteLe: '✓ Consulté le',
    telecharger: '📥 Télécharger',
    marquerLu: '👁️ Marquer comme lu',
    derniersConsultes: '👁️ Derniers documents consultés',
    // Paiements
    totalPaye: 'Total payé (année en cours)',
    enRetard: 'En retard',
    aPayer: 'À payer',
    historiquePaiements: 'Historique',
    reference: 'Référence',
    description: 'Description',
    montant: 'Montant',
    echeance: 'Échéance',
    statut: 'Statut',
    actions: 'Actions',
    statutPaye: '✓ Payé',
    statutEnRetard: '⚠ En retard',
    statutEnAttente: '⏳ En attente',
    recu: '📥 Reçu',
    // Annonces (badge)
    urgentLabel: '🔴 Urgent',
    importantLabel: '🟠 Important',
    infoLabel: '🔵 Info',
    par: 'Par',
    // Signalement
    nouveauSignalement: '🔔 Nouveau signalement',
    signalerProbleme: 'Signalez un problème à votre gestionnaire de copropriété',
    signalementEnvoye: 'Signalement envoyé !',
    signalementConfirm: 'Votre gestionnaire a été notifié. Un suivi apparaîtra dans votre historique.',
    voirHistorique: 'Voir l\'historique →',
    localisationAuto: '📍 Votre localisation (auto-remplie)',
    partieCommune: 'Partie commune ?',
    partieCommuneDesc: 'Cave, couloir, ascenseur, toiture, hall…',
    zoneConcernee: 'Zone concernée',
    selectionnerZone: 'Sélectionner une zone…',
    autrePreciser: 'Autre (préciser dans la description)',
    typeIntervention: 'Type d\'intervention *',
    choisirType: 'Choisir le type…',
    descriptionProbleme: 'Description du problème *',
    decrivezProbleme: 'Décrivez précisément le problème constaté...',
    niveauUrgence: 'Niveau d\'urgence',
    urgenceNormale: '🟡 Normale',
    urgenceNormaleDesc: 'Sous 48h',
    urgenceUrgent: '🔴 Urgent',
    urgenceUrgentDesc: 'Immédiat',
    urgencePlanifiee: '🟢 Planifiée',
    urgencePlanifieeDesc: 'À programmer',
    envoyerSignalement: '📤 Envoyer le signalement au syndic',
    signalementTransmis: 'Votre signalement sera transmis à votre gestionnaire de copropriété.',
    // AG
    agOrdinaire: 'AG Ordinaire',
    agExtraordinaire: 'AG Extraordinaire',
    cloturee: '✓ Clôturée',
    enCours: '● En cours',
    convoquee: '📩 Convoquée',
    planifiee: '📅 Planifiée',
    resolutions: 'résolution(s) · Cliquer pour détails',
    infosPratiques: '📋 Informations pratiques',
    date: 'Date',
    lieu: 'Lieu',
    type: 'Type',
    visioconference: 'Visioconférence',
    lienDispo: '🎥 Lien disponible',
    ordreDuJour: '📝 Ordre du jour',
    resolutionsTitle: '🗳️ Résolutions',
    vosTantiemes: 'Vos tantièmes',
    votezCliquant: '— Votez en cliquant sur votre choix',
    monVote: 'Mon vote :',
    votePour: '✓ POUR',
    voteContre: '✗ CONTRE',
    voteAbstention: '○ ABSTENTION',
    pour: 'Pour',
    contre: 'Contre',
    abstention: 'Abstention',
    totalExprime: 'tantièmes exprimés',
    adoptee: '✓ Adoptée',
    rejetee: '✗ Rejetée',
    contestationAG: 'Contestation de l\'AG',
    joursRestants: 'jour(s) restant(s)',
    contestationDelai: 'pour contester (délai légal : 2 mois après l\'AG, art. 42 loi du 10/07/1965)',
    contestationEcoulee: 'Le délai de contestation de 2 mois est écoulé.',
    rappelJuridique: 'Rappel juridique :',
    rappelJuridiqueTexte: 'Tout copropriétaire opposant ou défaillant peut contester une décision d\'AG dans un délai de 2 mois à compter de la notification du PV (article 42 de la loi du 10 juillet 1965). La contestation doit être faite par LRAR au syndic, puis si nécessaire devant le Tribunal judiciaire.',
    copierTemplate: '📋 Copier le template de mise en demeure',
    deadline: 'Deadline',
    envoiLRAR: '· Envoi par LRAR recommandé',
    // Historique
    totalPaye2025: 'Total payé 2025',
    evenements: 'Événements',
    enregistres: 'enregistrés',
    evolutionCharges: '📊 Évolution des charges (12 derniers mois)',
    chartPayee: 'Payée',
    chartEnAttente: 'En attente',
    tous: 'Tous',
    desCharges: 'des charges',
    // Modules
    mesModules: '🧩 Mes modules',
    mesModulesDesc: 'Personnalisez votre espace en activant les fonctionnalités utiles',
    actifs: 'actifs',
    astuce: 'Astuce',
    astuceTexte: 'Désactivez les modules que vous n\'utilisez pas pour simplifier votre espace. Les données ne sont pas supprimées — vous pouvez les réactiver à tout moment.',
    // Paramètres
    monProfil: '👤 Mon profil',
    modifier: '✏️ Modifier',
    nomComplet: 'Nom complet',
    email: 'Email',
    telephone: 'Téléphone',
    immeuble: 'Immeuble',
    localisation: 'Localisation',
    tantièmesQuotePart: 'Tantièmes / Quote-part',
    prenom: 'Prénom',
    nom: 'Nom',
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
    prefsNotif: '🔔 Préférences de notification',
    notifEmail: 'Notifications par email',
    notifEmailDesc: 'Recevoir les alertes et rappels par email',
    notifPush: 'Notifications push',
    notifPushDesc: 'Recevoir les alertes sur votre téléphone',
    mailingAG: 'Convocations AG',
    mailingAGDesc: 'Recevoir les convocations d\'assemblée générale',
    alertesPaiement: 'Alertes paiement',
    alertesPaiementDesc: 'Rappels d\'échéances de paiement',
    alertesTravaux: 'Alertes travaux',
    alertesTravauxDesc: 'Informations sur les travaux en cours',
    resumeHebdo: 'Résumé hebdomadaire',
    resumeHebdoDesc: 'Synthèse des événements de la semaine',
    exportTelecharge: '📥 Export & téléchargements',
    recapAnnuel: 'Récapitulatif annuel',
    recapAnnuelDesc: 'Synthèse charges et paiements',
    mesVotesAG: 'Mes votes AG',
    mesVotesAGDesc: 'Historique de tous vos votes',
    attestationCopro: 'Attestation copropriété',
    portailSignalements: 'Portail signalements',
    portailSignalementsDesc: 'Accéder au portail de signalement',
    // Assistant
    assistantTitre: 'Fixy — Assistant IA',
    assistantDesc: 'Je connais toute votre copropriété. Posez-moi n\'importe quelle question !',
    nouvelleConversation: 'Nouvelle conversation',
    bonjourPrenom: 'Bonjour',
    assistantIntro: 'Je suis Fixy, votre assistant personnel pour la copropriété',
    assistantIntro2: '. Je peux répondre à toutes vos questions — même si vous n\'êtes pas à l\'aise avec la technologie !',
    questionsFréquentes: 'Questions fréquentes :',
    assistantQ1: 'Combien je dois payer ce mois ?',
    assistantQ2: 'Quelle est la prochaine assemblée générale ?',
    assistantQ3: 'Quels documents puis-je télécharger ?',
    assistantQ4: 'Quel est mon solde actuel ?',
    assistantQ5: 'Comment voter pour une résolution ?',
    assistantQ6: 'Y a-t-il des travaux prévus ?',
    assistantQ7: 'Quand est la prochaine coupure d\'eau ?',
    assistantQ8: 'C\'est quoi les tantièmes ?',
    suggestionQ1: 'Mes paiements en attente',
    suggestionQ2: 'Prochaine AG',
    suggestionQ3: 'Mes documents',
    suggestionQ4: 'Mon solde',
    placeholderInput: 'Posez votre question à Fixy…',
    assistantPied: 'Fixy peut répondre à toutes vos questions sur votre copropriété',
    // Interventions
    interventionsEnCours: 'intervention(s) en cours',
    aucuneIntervention: 'Aucune intervention pour ce filtre',
    toutes: 'Toutes',
    planifiees: '📅 Planifiées',
    enRoute: '🚗 En route',
    surPlace: '🔧 Sur place',
    terminees: '✅ Terminées',
    noter: '✍️ Noter',
    preuve: '✅ Preuve',
    signe: '+ signé',
    progression: 'Progression',
    demarrage: 'Démarrage',
    enCoursLabel: 'En cours',
    termine: 'Terminé',
    positionTempsReel: '📍 POSITION EN TEMPS RÉEL',
    signalGPS: 'Signal GPS actif',
    preuveIntervention: '📸 PREUVE D\'INTERVENTION',
    photosAvant: 'photo(s) avant',
    photosApres: 'photo(s) après',
    votreAvis: 'VOTRE AVIS',
    donnerAvis: '⭐ Donner mon avis sur cette intervention',
    evaluerIntervention: '⭐ Évaluer l\'intervention',
    votreNote: 'Votre note',
    tresSatisfait: 'Très satisfait',
    satisfait: 'Satisfait',
    correct: 'Correct',
    insatisfait: 'Insatisfait',
    tresInsatisfait: 'Très insatisfait',
    commentaireOpt: 'Commentaire (optionnel)',
    decrivezExperience: 'Décrivez votre expérience...',
    envoyerAvis: 'Envoyer l\'avis',
    // Doc types
    docPvAg: 'PV Assemblée',
    docCompteAnnuel: 'Comptes annuels',
    docBudget: 'Budget',
    docContrat: 'Contrat',
    docReglement: 'Règlement',
    docAppelCharges: 'Appel de charges',
    docAutre: 'Autre',
    // Majorité
    unanimite: 'Unanimité',
    // Statuts intervention
    statutPlanifie: 'Planifié',
    statutEnRoute: 'En route',
    statutSurPlace: 'Sur place',
    statutTermine: 'Terminé',
    statutAnnule: 'Annulé',
    // Date locale
    dateLocale: 'fr-FR',
  },
  pt: {
    // Nav items
    nav_accueil: 'Painel',
    nav_documents: 'Documentos',
    nav_paiements: 'Pagamentos',
    nav_mes_charges: 'Minhas Quotas',
    nav_quittances: 'Recibos de renda',
    nav_mon_bail: 'Meu Contrato',
    nav_interventions: 'Minhas Intervenções',
    nav_annonces: 'Avisos',
    nav_signalement: 'Ocorrência',
    nav_assemblees: 'Assembleias & Votos',
    nav_historique: 'Histórico',
    nav_modules: 'Módulos',
    nav_parametres: 'Definições',
    nav_assistant: 'Assistente Fixy',
    // Sidebar categories
    cat_general: 'GERAL',
    cat_financier: 'FINANCEIRO',
    cat_gestion: 'GESTÃO',
    cat_juridique: 'JURÍDICO',
    cat_outils: 'FERRAMENTAS',
    // Module descriptions
    mod_documents: 'Acesso às atas, contas e documentos do condomínio',
    mod_paiements: 'Acompanhamento e histórico dos seus pagamentos',
    mod_mes_charges: 'Detalhe mensal das suas quotas',
    mod_quittances: 'Os seus recibos de renda mensais',
    mod_mon_bail: 'Informações do seu contrato e renovação',
    mod_interventions: 'Acompanhamento das obras no seu edifício',
    mod_annonces: 'Avisos do administrador e do condomínio',
    mod_signalement: 'Reportar um problema no edifício',
    mod_assemblees: 'Assembleias, deliberações e votações online',
    mod_historique: 'Histórico de todas as suas ações',
    mod_assistant: 'Faça as suas perguntas ao Fixy',
    // Header / loading
    loading: 'A carregar o seu espaço...',
    retourAdmin: '⚡ Voltar Admin',
    deconnexion: 'Terminar sessão',
    reduire: 'Minimizar',
    developper: 'Expandir',
    coproLot: 'Condómino · Fração',
    notifications: 'Notificações',
    bat: 'Bloco',
    lot: 'Fração',
    etage: 'Piso',
    // Accueil
    chargesDuMois: 'Quotas do mês',
    payee: '✓ Paga',
    enAttente: 'Pendente',
    soldeAPayer: 'Saldo a pagar',
    paiementsEnAttente: 'pagamento(s) pendente(s)',
    tantiemes: 'Permilagem',
    quotePart: 'Quota-parte',
    nonLues: 'não lida(s)',
    faireSignalement: '🔔 Reportar ocorrência',
    mesPaiements: '💶 Meus pagamentos',
    mesDocuments: '📁 Meus documentos',
    voterAG: '🗳️ Votar em Assembleia',
    prochainesEcheances: '📅 Próximos vencimentos',
    urgent: 'Urgente',
    toutMarquerLu: 'Marcar tudo como lido',
    dernieresAnnonces: '📢 Últimos avisos',
    voirTout: 'Ver tudo →',
    info: 'Info',
    important: 'Importante',
    // Documents
    tousLesTypes: 'Todos os tipos',
    toutesLesAnnees: 'Todos os anos',
    rechercherDoc: '🔍 Pesquisar documento...',
    nouveau: 'Novo',
    publique: 'Público',
    personnel: 'Pessoal',
    ajouteLe: 'Adicionado em',
    consulteLe: '✓ Consultado em',
    telecharger: '📥 Descarregar',
    marquerLu: '👁️ Marcar como lido',
    derniersConsultes: '👁️ Últimos documentos consultados',
    // Paiements
    totalPaye: 'Total pago (ano corrente)',
    enRetard: 'Em atraso',
    aPayer: 'A pagar',
    historiquePaiements: 'Histórico',
    reference: 'Referência',
    description: 'Descrição',
    montant: 'Valor',
    echeance: 'Vencimento',
    statut: 'Estado',
    actions: 'Ações',
    statutPaye: '✓ Pago',
    statutEnRetard: '⚠ Em atraso',
    statutEnAttente: '⏳ Pendente',
    recu: '📥 Recibo',
    // Annonces (badge)
    urgentLabel: '🔴 Urgente',
    importantLabel: '🟠 Importante',
    infoLabel: '🔵 Info',
    par: 'Por',
    // Signalement
    nouveauSignalement: '🔔 Nova ocorrência',
    signalerProbleme: 'Reporte um problema ao administrador do condomínio',
    signalementEnvoye: 'Ocorrência enviada!',
    signalementConfirm: 'O administrador foi notificado. O acompanhamento aparecerá no seu histórico.',
    voirHistorique: 'Ver histórico →',
    localisationAuto: '📍 A sua localização (preenchimento automático)',
    partieCommune: 'Parte comum?',
    partieCommuneDesc: 'Cave, corredor, elevador, cobertura, hall…',
    zoneConcernee: 'Zona em causa',
    selectionnerZone: 'Selecionar uma zona…',
    autrePreciser: 'Outra (especificar na descrição)',
    typeIntervention: 'Tipo de intervenção *',
    choisirType: 'Escolher o tipo…',
    descriptionProbleme: 'Descrição do problema *',
    decrivezProbleme: 'Descreva com precisão o problema constatado...',
    niveauUrgence: 'Nível de urgência',
    urgenceNormale: '🟡 Normal',
    urgenceNormaleDesc: 'Em 48h',
    urgenceUrgent: '🔴 Urgente',
    urgenceUrgentDesc: 'Imediato',
    urgencePlanifiee: '🟢 Planeada',
    urgencePlanifieeDesc: 'A programar',
    envoyerSignalement: '📤 Enviar ocorrência ao administrador',
    signalementTransmis: 'A sua ocorrência será transmitida ao administrador do condomínio.',
    // AG
    agOrdinaire: 'Assembleia Ordinária',
    agExtraordinaire: 'Assembleia Extraordinária',
    cloturee: '✓ Encerrada',
    enCours: '● Em curso',
    convoquee: '📩 Convocada',
    planifiee: '📅 Planeada',
    resolutions: 'deliberação(ões) · Clique para detalhes',
    infosPratiques: '📋 Informações práticas',
    date: 'Data',
    lieu: 'Local',
    type: 'Tipo',
    visioconference: 'Videoconferência',
    lienDispo: '🎥 Link disponível',
    ordreDuJour: '📝 Ordem do dia',
    resolutionsTitle: '🗳️ Deliberações',
    vosTantiemes: 'A sua permilagem',
    votezCliquant: '— Vote clicando na sua escolha',
    monVote: 'Meu voto:',
    votePour: '✓ A FAVOR',
    voteContre: '✗ CONTRA',
    voteAbstention: '○ ABSTENÇÃO',
    pour: 'A favor',
    contre: 'Contra',
    abstention: 'Abstenção',
    totalExprime: 'permilagens expressas',
    adoptee: '✓ Aprovada',
    rejetee: '✗ Rejeitada',
    contestationAG: 'Impugnação da Assembleia',
    joursRestants: 'dia(s) restante(s)',
    contestationDelai: 'para impugnar (prazo legal: 60 dias após a assembleia, art. 1433.º CC)',
    contestationEcoulee: 'O prazo de impugnação de 60 dias expirou.',
    rappelJuridique: 'Nota jurídica:',
    rappelJuridiqueTexte: 'Qualquer condómino que tenha ficado vencido pode impugnar as deliberações da assembleia no prazo de 60 dias a contar da deliberação (para os presentes) ou da comunicação (para os ausentes), nos termos do art. 1433.º do Código Civil.',
    copierTemplate: '📋 Copiar modelo de impugnação',
    deadline: 'Prazo limite',
    envoiLRAR: '· Envio por carta registada com AR',
    // Historique
    totalPaye2025: 'Total pago 2025',
    evenements: 'Eventos',
    enregistres: 'registados',
    evolutionCharges: '📊 Evolução das quotas (últimos 12 meses)',
    chartPayee: 'Paga',
    chartEnAttente: 'Pendente',
    tous: 'Todos',
    desCharges: 'das quotas',
    // Modules
    mesModules: '🧩 Meus módulos',
    mesModulesDesc: 'Personalize o seu espaço ativando as funcionalidades úteis',
    actifs: 'ativos',
    astuce: 'Dica',
    astuceTexte: 'Desative os módulos que não utiliza para simplificar o seu espaço. Os dados não são apagados — pode reativá-los a qualquer momento.',
    // Paramètres
    monProfil: '👤 Meu perfil',
    modifier: '✏️ Editar',
    nomComplet: 'Nome completo',
    email: 'Email',
    telephone: 'Telefone',
    immeuble: 'Edifício',
    localisation: 'Localização',
    tantièmesQuotePart: 'Permilagem / Quota-parte',
    prenom: 'Nome próprio',
    nom: 'Apelido',
    enregistrer: 'Guardar',
    annuler: 'Cancelar',
    prefsNotif: '🔔 Preferências de notificação',
    notifEmail: 'Notificações por email',
    notifEmailDesc: 'Receber alertas e lembretes por email',
    notifPush: 'Notificações push',
    notifPushDesc: 'Receber alertas no seu telemóvel',
    mailingAG: 'Convocatórias de assembleia',
    mailingAGDesc: 'Receber convocatórias de assembleia geral',
    alertesPaiement: 'Alertas de pagamento',
    alertesPaiementDesc: 'Lembretes de vencimento de pagamento',
    alertesTravaux: 'Alertas de obras',
    alertesTravauxDesc: 'Informações sobre obras em curso',
    resumeHebdo: 'Resumo semanal',
    resumeHebdoDesc: 'Síntese dos eventos da semana',
    exportTelecharge: '📥 Exportar & descarregar',
    recapAnnuel: 'Resumo anual',
    recapAnnuelDesc: 'Síntese de quotas e pagamentos',
    mesVotesAG: 'Meus votos AG',
    mesVotesAGDesc: 'Histórico de todos os seus votos',
    attestationCopro: 'Declaração de condomínio',
    portailSignalements: 'Portal de ocorrências',
    portailSignalementsDesc: 'Aceder ao portal de ocorrências',
    // Assistant
    assistantTitre: 'Fixy — Assistente IA',
    assistantDesc: 'Conheço todo o seu condomínio. Faça-me qualquer pergunta!',
    nouvelleConversation: 'Nova conversa',
    bonjourPrenom: 'Olá',
    assistantIntro: 'Sou o Fixy, o seu assistente pessoal do condomínio',
    assistantIntro2: '. Posso responder a todas as suas perguntas — mesmo que não esteja à vontade com a tecnologia!',
    questionsFréquentes: 'Perguntas frequentes:',
    assistantQ1: 'Quanto tenho de pagar este mês?',
    assistantQ2: 'Quando é a próxima assembleia?',
    assistantQ3: 'Que documentos posso descarregar?',
    assistantQ4: 'Qual é o meu saldo atual?',
    assistantQ5: 'Como votar numa deliberação?',
    assistantQ6: 'Há obras previstas?',
    assistantQ7: 'Quando é o próximo corte de água?',
    assistantQ8: 'O que é a permilagem?',
    suggestionQ1: 'Meus pagamentos pendentes',
    suggestionQ2: 'Próxima assembleia',
    suggestionQ3: 'Meus documentos',
    suggestionQ4: 'Meu saldo',
    placeholderInput: 'Faça a sua pergunta ao Fixy…',
    assistantPied: 'O Fixy pode responder a todas as perguntas sobre o seu condomínio',
    // Interventions
    interventionsEnCours: 'intervenção(ões) em curso',
    aucuneIntervention: 'Nenhuma intervenção para este filtro',
    toutes: 'Todas',
    planifiees: '📅 Planeadas',
    enRoute: '🚗 A caminho',
    surPlace: '🔧 No local',
    terminees: '✅ Concluídas',
    noter: '✍️ Avaliar',
    preuve: '✅ Prova',
    signe: '+ assinado',
    progression: 'Progresso',
    demarrage: 'Início',
    enCoursLabel: 'Em curso',
    termine: 'Concluído',
    positionTempsReel: '📍 POSIÇÃO EM TEMPO REAL',
    signalGPS: 'Sinal GPS ativo',
    preuveIntervention: '📸 PROVA DE INTERVENÇÃO',
    photosAvant: 'foto(s) antes',
    photosApres: 'foto(s) depois',
    votreAvis: 'A SUA AVALIAÇÃO',
    donnerAvis: '⭐ Avaliar esta intervenção',
    evaluerIntervention: '⭐ Avaliar a intervenção',
    votreNote: 'A sua nota',
    tresSatisfait: 'Muito satisfeito',
    satisfait: 'Satisfeito',
    correct: 'Razoável',
    insatisfait: 'Insatisfeito',
    tresInsatisfait: 'Muito insatisfeito',
    commentaireOpt: 'Comentário (opcional)',
    decrivezExperience: 'Descreva a sua experiência...',
    envoyerAvis: 'Enviar avaliação',
    // Doc types
    docPvAg: 'Ata da Assembleia',
    docCompteAnnuel: 'Contas anuais',
    docBudget: 'Orçamento',
    docContrat: 'Contrato',
    docReglement: 'Regulamento',
    docAppelCharges: 'Aviso de quotas',
    docAutre: 'Outro',
    // Majorité
    unanimite: 'Unanimidade',
    // Statuts intervention
    statutPlanifie: 'Planeado',
    statutEnRoute: 'A caminho',
    statutSurPlace: 'No local',
    statutTermine: 'Concluído',
    statutAnnule: 'Cancelado',
    // Date locale
    dateLocale: 'pt-PT',
  },
} as const

type TKey = keyof typeof T['fr']
type TDict = Record<TKey, string>

// ─── Helper : get translation function based on locale ──────────────────────────

function getT(locale: string): TDict {
  return (locale === 'pt' ? T.pt : T.fr) as TDict
}

// ─── Signalement data (locale-aware) ─────────────────────────────────────────

function getTypesIntervention(locale: string): string[] {
  if (locale === 'pt') return [
    '🔧 Canalização (fuga, coluna, torneira)',
    '⚡ Eletricidade (avaria, quadro, tomada)',
    '🪟 Carpintaria (porta, janela, fechadura)',
    '🎨 Pintura / revestimento',
    '🏗️ Obra pesada (fissura, infiltração)',
    '🌡️ Aquecimento / climatização',
    '🛗 Elevador',
    '🧹 Limpeza / manutenção',
    '🔥 Sinistro (inundação, incêndio)',
    '🚨 Urgência de segurança',
    '🌿 Espaços verdes',
    '💡 Iluminação partes comuns',
    '🚪 Intercomunicador / código',
    '📦 Outro',
  ]
  return TYPES_INTERVENTION
}

function getZonesCommunes(locale: string): string[] {
  if (locale === 'pt') return [
    'Entrada / hall',
    'Corredor / patamar',
    'Escadas',
    'Cave / subsolo',
    'Estacionamento / garagem',
    'Cobertura / terraço',
    'Jardim / espaço verde',
    'Sala do lixo',
    'Sala de bicicletas',
    'Fachada exterior',
    'Caixas de correio',
    'Elevador',
    'Central térmica',
    'Contadores comuns',
  ]
  return ZONES_COMMUNES
}

// ─── Sidebar categories ──────────────────────────────────────────────────────

type NavCategory = { label: string; items: CoproPage[] }

function getNavCategories(t: TDict): NavCategory[] {
  return [
    { label: t.cat_general, items: ['accueil'] },
    { label: t.cat_financier, items: ['paiements', 'mes_charges', 'quittances'] },
    { label: t.cat_gestion, items: ['documents', 'mon_bail', 'interventions_suivi', 'annonces', 'signalement'] },
    { label: t.cat_juridique, items: ['assemblees', 'historique'] },
    { label: t.cat_outils, items: ['modules', 'parametres', 'assistant'] },
  ]
}

// ─── Doc type labels (locale-aware) ──────────────────────────────────────────

function getDocTypeLabels(t: TDict): Record<string, { label: string; emoji: string }> {
  return {
    pv_ag: { label: t.docPvAg, emoji: '📋' },
    compte_annuel: { label: t.docCompteAnnuel, emoji: '📊' },
    budget: { label: t.docBudget, emoji: '💰' },
    contrat: { label: t.docContrat, emoji: '📑' },
    reglement: { label: t.docReglement, emoji: '📜' },
    appel_charges: { label: t.docAppelCharges, emoji: '🧾' },
    autre: { label: t.docAutre, emoji: '📄' },
  }
}

// ─── Majorité labels (locale-aware) ──────────────────────────────────────────

function getMajoriteLabels(locale: string): Record<string, { label: string; color: string }> {
  if (locale === 'pt') return {
    art24: { label: 'Maioria simples', color: 'bg-blue-100 text-blue-700' },
    art25: { label: '2/3 do valor', color: 'bg-[rgba(201,168,76,0.15)] text-[#A8842A]' },
    art26: { label: 'Dupla maioria', color: 'bg-orange-100 text-orange-700' },
    unanimite: { label: 'Unanimidade', color: 'bg-red-100 text-red-700' },
  }
  return MAJORITE_LABELS
}

// ─── Modules configurables (locale-aware) ─────────────────────────────────────

function getCoproModules(t: TDict) {
  return [
    { key: 'documents' as const, label: t.nav_documents, icon: '📁', description: t.mod_documents, default: true },
    { key: 'paiements' as const, label: t.nav_paiements, icon: '💶', description: t.mod_paiements, default: true },
    { key: 'mes_charges' as const, label: t.nav_mes_charges, icon: '💰', description: t.mod_mes_charges, default: true },
    { key: 'quittances' as const, label: t.nav_quittances, icon: '🧾', description: t.mod_quittances, default: false },
    { key: 'mon_bail' as const, label: t.nav_mon_bail, icon: '📜', description: t.mod_mon_bail, default: false },
    { key: 'interventions_suivi' as const, label: t.nav_interventions, icon: '🔧', description: t.mod_interventions, default: true },
    { key: 'annonces' as const, label: t.nav_annonces, icon: '📢', description: t.mod_annonces, default: true },
    { key: 'signalement' as const, label: t.nav_signalement, icon: '🔔', description: t.mod_signalement, default: true },
    { key: 'assemblees' as const, label: t.nav_assemblees, icon: '🏛️', description: t.mod_assemblees, default: true },
    { key: 'historique' as const, label: t.nav_historique, icon: '📈', description: t.mod_historique, default: false },
    { key: 'assistant' as const, label: t.nav_assistant, icon: '🤖', description: t.mod_assistant, default: true },
  ]
}

// ─── Navigation items (locale-aware) ────────────────────────────────────────

function getNavItems(t: TDict): { id: CoproPage; emoji: string; label: string }[] {
  return [
    { id: 'accueil', emoji: '📊', label: t.nav_accueil },
    { id: 'documents', emoji: '📁', label: t.nav_documents },
    { id: 'paiements', emoji: '💶', label: t.nav_paiements },
    { id: 'mes_charges', emoji: '💰', label: t.nav_mes_charges },
    { id: 'quittances', emoji: '🧾', label: t.nav_quittances },
    { id: 'mon_bail', emoji: '📜', label: t.nav_mon_bail },
    { id: 'interventions_suivi', emoji: '🔧', label: t.nav_interventions },
    { id: 'annonces', emoji: '📢', label: t.nav_annonces },
    { id: 'signalement', emoji: '🔔', label: t.nav_signalement },
    { id: 'assemblees', emoji: '🏛️', label: t.nav_assemblees },
    { id: 'historique', emoji: '📈', label: t.nav_historique },
    { id: 'modules', emoji: '🧩', label: t.nav_modules },
    { id: 'parametres', emoji: '⚙️', label: t.nav_parametres },
    { id: 'assistant', emoji: '🤖', label: t.nav_assistant },
  ]
}

// ─── Modules configurables (static, for default loading) ─────────────────────

const COPRO_MODULES = [
  { key: 'documents', label: 'Documents', icon: '📁', description: 'Accès aux PV, comptes et documents copro', default: true },
  { key: 'paiements', label: 'Paiements', icon: '💶', description: 'Suivi et historique de vos paiements', default: true },
  { key: 'mes_charges', label: 'Mes Charges', icon: '💰', description: 'Détail mensuel de vos charges', default: true },
  { key: 'quittances', label: 'Quittances loyer', icon: '🧾', description: 'Vos quittances de loyer mensuelles', default: false },
  { key: 'mon_bail', label: 'Mon Bail', icon: '📜', description: 'Informations de votre bail et renouvellement', default: false },
  { key: 'interventions_suivi', label: 'Mes Interventions', icon: '🔧', description: 'Suivi des travaux dans votre immeuble', default: true },
  { key: 'annonces', label: 'Annonces', icon: '📢', description: 'Annonces du syndic et de la copro', default: true },
  { key: 'signalement', label: 'Signalement', icon: '🔔', description: 'Signaler un problème dans l\'immeuble', default: true },
  { key: 'assemblees', label: 'Assemblées & Votes', icon: '🏛️', description: 'AG, résolutions et votes en ligne', default: true },
  { key: 'historique', label: 'Historique', icon: '📈', description: 'Historique de toutes vos actions', default: false },
  { key: 'assistant', label: 'Assistant Fixy', icon: '🤖', description: 'Posez vos questions à Fixy', default: true },
] as const
type CoproModuleKey = typeof COPRO_MODULES[number]['key']

// ─── Navigation (static, for reference) ────────────────────────────────────────

const NAV_ITEMS: { id: CoproPage; emoji: string; label: string }[] = [
  { id: 'accueil', emoji: '📊', label: 'Tableau de bord' },
  { id: 'documents', emoji: '📁', label: 'Documents' },
  { id: 'paiements', emoji: '💶', label: 'Paiements' },
  { id: 'mes_charges', emoji: '💰', label: 'Mes Charges' },
  { id: 'quittances', emoji: '🧾', label: 'Quittances loyer' },
  { id: 'mon_bail', emoji: '📜', label: 'Mon Bail' },
  { id: 'interventions_suivi', emoji: '🔧', label: 'Mes Interventions' },
  { id: 'annonces', emoji: '📢', label: 'Annonces' },
  { id: 'signalement', emoji: '🔔', label: 'Signalement' },
  { id: 'assemblees', emoji: '🏛️', label: 'Assemblées & Votes' },
  { id: 'historique', emoji: '📈', label: 'Historique' },
  { id: 'modules', emoji: '🧩', label: 'Modules' },
  { id: 'parametres', emoji: '⚙️', label: 'Paramètres' },
  { id: 'assistant', emoji: '🤖', label: 'Assistant Fixy' },
]

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CoproprietaireDashboard() {
  // ── Locale ──
  const locale = useLocale()
  const t = useMemo(() => getT(locale), [locale])
  const navItems = useMemo(() => getNavItems(t), [t])
  const navCategories = useMemo(() => getNavCategories(t), [t])
  const coproModules = useMemo(() => getCoproModules(t), [t])
  const docTypeLabels = useMemo(() => getDocTypeLabels(t), [t])
  const majoriteLabels = useMemo(() => getMajoriteLabels(locale), [locale])
  const typesIntervention = useMemo(() => getTypesIntervention(locale), [locale])
  const zonesCommunes = useMemo(() => getZonesCommunes(locale), [locale])
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  // Auth
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Navigation
  const [page, setPage] = useState<CoproPage>('accueil')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── Modules personnalisables ──
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})

  // Données
  const [profile, setProfile] = useState<CoproProfile>(PROFILE_DEMO)
  const [charges, setCharges] = useState<ChargesMensuelles[]>(CHARGES_DEMO)
  const [paiements, setPaiements] = useState<Paiement[]>(PAIEMENTS_DEMO)
  const [documents, setDocuments] = useState<DocumentCopro[]>(DOCUMENTS_DEMO)
  const [annonces, setAnnonces] = useState<Annonce[]>(ANNONCES_DEMO)
  const [ags, setAgs] = useState<AssembleeGenerale[]>(AG_DEMO)
  const [echeances, setEcheances] = useState<Echeance[]>(ECHEANCES_DEMO)
  const [notifications, setNotifications] = useState<CoproNotification[]>(NOTIFICATIONS_DEMO)
  const [historique, setHistorique] = useState<HistoriqueEntry[]>(HISTORIQUE_DEMO)
  const [params, setParams] = useState<ParamConfidentialite>(PARAMS_DEMO)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Signalement (mini form dans Communication)
  const [signalemType, setSignalemType] = useState('')
  const [signalemDesc, setSignalemDesc] = useState('')
  const [signalemUrgence, setSignalemUrgence] = useState<'normale' | 'urgente' | 'planifiee'>('normale')
  const [signalemPartieCommune, setSignalemPartieCommune] = useState(false)
  const [signalemZone, setSignalemZone] = useState('')
  const [signalemEnvoye, setSignalemEnvoye] = useState(false)

  // (docFilterType, docFilterAnnee, docSearch internalized in CoproDocumentsSection)
  // (paiementTab internalized in CoproPaiementsSection)
  // (selectedAG internalized in CoproAssembleesSection)
  // (histoFilter internalized in CoproHistoriqueSection)

  // Paramètres
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ nom: '', prenom: '', email: '', telephone: '' })

  // (assistantMessages, assistantInput, assistantLoading, assistantEndRef internalized in CoproAssistantSection)

  // ── Auth ──
  useEffect(() => {
    const check = async () => {
      await supabase.auth.refreshSession()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        setUser(u)
        // Load localStorage data
        const uid = u.id
        try {
          const k = (key: string) => localStorage.getItem(`fixit_copro_${key}_${uid}`)
          const p = (key: string, fallback: any) => {
            const raw = k(key)
            return raw ? JSON.parse(raw) : fallback
          }
          setProfile(p('profile', PROFILE_DEMO))
          setCharges(p('charges', CHARGES_DEMO))
          setPaiements(p('paiements', PAIEMENTS_DEMO))
          setDocuments(p('documents', DOCUMENTS_DEMO))
          setAnnonces(p('annonces', ANNONCES_DEMO))
          setAgs(p('ags', AG_DEMO))
          setEcheances(p('echeances', ECHEANCES_DEMO))
          setNotifications(p('notifications', NOTIFICATIONS_DEMO))
          setHistorique(p('historique', HISTORIQUE_DEMO))
          setParams(p('params', PARAMS_DEMO))
          // Load enabled modules
          try {
            const savedModules = localStorage.getItem(`fixit_modules_copro_${uid}`)
            if (savedModules) {
              setEnabledModules(JSON.parse(savedModules))
            } else {
              const defaults: Record<string, boolean> = {}
              COPRO_MODULES.forEach(m => { defaults[m.key] = m.default })
              setEnabledModules(defaults)
            }
          } catch (e) {
            console.warn('[dashboard] localStorage modules read failed (private browsing?)', e)
          }
        } catch (e) {
          console.warn('[dashboard] localStorage data load failed (private browsing?)', e)
        }
      } else {
        // Mode démo sans auth
        setProfile(PROFILE_DEMO)
        const defaults: Record<string, boolean> = {}
        COPRO_MODULES.forEach(m => { defaults[m.key] = m.default })
        setEnabledModules(defaults)
      }
      setDataLoaded(true)
      setLoading(false)
    }
    check()
  }, [])

  // ── Save to localStorage ──
  useEffect(() => {
    if (!dataLoaded) return
    const uid = user?.id || 'demo'
    const s = (key: string, data: any) => {
      try { localStorage.setItem(`fixit_copro_${key}_${uid}`, JSON.stringify(data)) } catch (e) {
        console.warn(`[dashboard] localStorage.setItem fixit_copro_${key} failed (private browsing?)`, e)
      }
    }
    s('profile', profile)
    s('charges', charges)
    s('paiements', paiements)
    s('documents', documents)
    s('annonces', annonces)
    s('ags', ags)
    s('echeances', echeances)
    s('notifications', notifications)
    s('historique', historique)
    s('params', params)
  }, [profile, charges, paiements, documents, annonces, ags, echeances, notifications, historique, params, dataLoaded, user])

  // ── Computed ──
  const chargesDuMois = charges.find(c => c.mois === new Date().toISOString().slice(0, 7))
  const solde = paiements.filter(p => p.statut !== 'payee').reduce((sum, p) => sum + p.montant, 0)
  const paiementsEnAttente = paiements.filter(p => p.statut === 'en_attente').length
  const notifNonLues = notifications.filter(n => !n.lu).length
  const annoncesNonLues = annonces.filter(a => !a.lu).length

  const userName = `${profile.prenom} ${profile.nom}`
  const initials = `${profile.prenom[0]}${profile.nom[0]}`
  const isAdminOverride = user?.user_metadata?._admin_override === true

  // ── Actions ──
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const markNotifRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const markAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const markAnnonceRead = (id: string) => {
    setAnnonces(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a))
  }

  const markDocConsulte = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, consulte: true, dateConsultation: new Date().toISOString().slice(0, 10) } : d))
  }

  const handleEnvoyerSignalement = () => {
    if (!signalemType || !signalemDesc) return
    const locationLabel = signalemPartieCommune
      ? `Partie commune — ${signalemZone || 'Zone non précisée'}`
      : `${profile.immeuble} · Bât. ${profile.batiment} · Ét. ${profile.etage} · Lot ${profile.numLot}`
    const msgTexte = `📋 SIGNALEMENT — ${signalemType}\n\n👤 De : ${profile.prenom} ${profile.nom} (Copropriétaire)\n📍 Localisation : ${locationLabel}\n🔔 Urgence : ${signalemUrgence === 'urgente' ? '🔴 URGENT' : signalemUrgence === 'planifiee' ? '🟢 Planifiée' : '🟡 Normale'}\n\n📝 Description :\n${signalemDesc}`
    const newMsg: CanalMessage = {
      auteur: `${profile.prenom} ${profile.nom}`,
      role: 'coproprio',
      texte: msgTexte,
      date: new Date().toISOString(),
      type: 'signalement',
    }
    // Sauvegarder dans le canal partagé avec le portail
    const canalKey = `canal_demandeur_${profile.prenom}_${profile.nom}`
    try {
      const existing = JSON.parse(localStorage.getItem(canalKey) || '[]')
      localStorage.setItem(canalKey, JSON.stringify([...existing, newMsg]))
    } catch (e) {
      console.warn('[dashboard] localStorage canal write failed (private browsing?)', e)
    }
    // Créer la mission dans les données syndic
    const missionData = {
      id: Date.now().toString(),
      type: signalemType,
      description: signalemDesc,
      priorite: signalemUrgence,
      statut: 'en_attente',
      dateCreation: new Date().toISOString(),
      immeuble: signalemPartieCommune ? signalemZone : profile.immeuble,
      batiment: profile.batiment,
      etage: profile.etage,
      numLot: profile.numLot,
      artisan: '',
      locataire: `${profile.prenom} ${profile.nom}`,
      telephoneLocataire: profile.telephone,
      demandeurNom: `${profile.prenom} ${profile.nom}`,
      demandeurRole: 'coproprio',
      demandeurEmail: profile.email,
      estPartieCommune: signalemPartieCommune,
      zoneSignalee: signalemZone,
      demandeurMessages: [newMsg],
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fixit_syndic_missions_')) continue
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        existing.unshift(missionData)
        localStorage.setItem(key, JSON.stringify(existing))
        break
      } catch (e) {
        console.warn('[dashboard] localStorage syndic missions write failed (private browsing?)', e)
      }
    }
    // Ajouter à l'historique
    const newEntry: HistoriqueEntry = {
      id: Date.now().toString(),
      type: 'signalement',
      titre: `Signalement — ${signalemType.split(' ').slice(1).join(' ')}`,
      description: signalemDesc.slice(0, 80) + (signalemDesc.length > 80 ? '…' : ''),
      date: new Date().toISOString().slice(0, 10),
    }
    setHistorique(prev => [newEntry, ...prev])
    setSignalemEnvoye(true)
    setSignalemType('')
    setSignalemDesc('')
    setSignalemUrgence('normale')
    setSignalemPartieCommune(false)
    setSignalemZone('')
    setTimeout(() => setSignalemEnvoye(false), 3000)
  }

  const handleVote = (agId: string, resId: string, vote: 'pour' | 'contre' | 'abstention') => {
    setAgs(prev => prev.map(ag => {
      if (ag.id !== agId) return ag
      return {
        ...ag,
        resolutions: ag.resolutions.map(r => {
          if (r.id !== resId || r.monVote) return r
          return {
            ...r,
            monVote: vote,
            votePour: r.votePour + (vote === 'pour' ? profile.tantiemes : 0),
            voteContre: r.voteContre + (vote === 'contre' ? profile.tantiemes : 0),
            voteAbstention: r.voteAbstention + (vote === 'abstention' ? profile.tantiemes : 0),
          }
        })
      }
    }))
  }

  const saveProfile = () => {
    setProfile(prev => ({
      ...prev,
      nom: profileForm.nom || prev.nom,
      prenom: profileForm.prenom || prev.prenom,
      email: profileForm.email || prev.email,
      telephone: profileForm.telephone || prev.telephone,
    }))
    setEditProfile(false)
  }

  // ── Assistant IA ──
  const buildCoproSystemPrompt = () => {
    const paiementsAttente = paiements.filter(p => p.statut === 'en_attente')
    const docsListe = documents.map(d => `- ${d.nom} (${d.annee}, ${docTypeLabels[d.type]?.label || d.type})`).join('\n')
    const isPT = locale === 'pt'
    return isPT
      ? `Tu és o Fixy, o assistente IA pessoal de ${profile.prenom} ${profile.nom}, condómino no ${profile.immeuble}, bloco ${profile.batiment}, piso ${profile.etage}, fração n.º ${profile.numLot}. Tens acesso a todas as informações do condomínio. Responde de forma clara, simpática e acessível — algumas pessoas não estão à vontade com a tecnologia. Responde sempre em português.

=== PERFIL DO CONDÓMINO ===
Nome: ${profile.prenom} ${profile.nom}
Email: ${profile.email} | Telefone: ${profile.telephone}
Edifício: ${profile.immeuble} | Bloco: ${profile.batiment} | Piso: ${profile.etage} | Fração: ${profile.numLot}
Permilagem: ${profile.tantiemes}/10 000 | Quota-parte: ${profile.quotePart}%

=== SITUAÇÃO FINANCEIRA ===
Quotas do mês: ${chargesDuMois?.montant || 285}€ — ${chargesDuMois?.statut === 'payee' ? 'PAGA' : 'PENDENTE'}
Saldo total a pagar: ${solde}€ (${paiementsAttente.length} pagamento(s) pendente(s))
Detalhe pagamentos pendentes:
${paiementsAttente.map(p => `- ${p.description}: ${p.montant}€ (vencimento ${formatDate(p.dateEcheance)}, ref: ${p.reference})`).join('\n') || '- Nenhum pagamento pendente'}

=== PRÓXIMOS VENCIMENTOS ===
${echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => `- [${formatDate(e.date)}] ${e.titre}: ${e.description}${e.urgent ? ' ⚠️ URGENTE' : ''}`).join('\n')}

=== DOCUMENTOS DISPONÍVEIS (separador Documentos) ===
${docsListe}

=== AVISOS DO ADMINISTRADOR ===
${annonces.map(a => `- [${a.date}] ${a.importance.toUpperCase()} — ${a.titre}: ${a.contenu}`).join('\n')}

=== ASSEMBLEIAS GERAIS ===
${ags.map(ag => {
  const resLines = ag.resolutions.map(r =>
    `  • ${r.titre}: ${r.description.slice(0, 120)} | Meu voto: ${r.monVote || 'ainda não votou'} | Resultado: ${r.resultat || (r.statut === 'ouverte' ? 'votação em curso' : 'N/A')} | A favor: ${r.votePour} permilagens, Contra: ${r.voteContre}, Abstenção: ${r.voteAbstention}`
  ).join('\n')
  return `AG: ${ag.titre} — ${formatDate(ag.date)}, ${ag.lieu}\nEstado: ${ag.statut}\nOrdem do dia:${ag.ordreDuJour.map(o => `\n  • ${o}`).join('')}\nDeliberações:\n${resLines}`
}).join('\n\n---\n\n')}

=== HISTÓRICO RECENTE ===
${historique.slice(0, 15).map(h => `- [${h.date}] ${h.titre}: ${h.description}${h.montant !== undefined ? ` (${h.montant >= 0 ? '+' : ''}${h.montant}€)` : ''}`).join('\n')}

=== REGRAS DE RESPOSTA ===
- Sê preciso com os números e datas dos dados acima.
- Para descarregar um documento → direcionar para o separador "Documentos" do menu.
- Para votar em AG → separador "Assembleias & Votos".
- Para pagar → separador "Pagamentos".
- Para uma ocorrência → separador "Ocorrência".
- Ajuda as pessoas menos à vontade com a tecnologia com explicações simples e acolhedoras.
- Podes responder a TODAS as perguntas: finanças, regulamento do condomínio, obras, votos, contabilidade, direitos do condómino, etc.`
      : `Tu es Fixy, l'assistant IA personnel de ${profile.prenom} ${profile.nom}, copropriétaire au ${profile.immeuble}, bâtiment ${profile.batiment}, étage ${profile.etage}, lot n°${profile.numLot}. Tu as accès à toutes les informations de sa copropriété. Réponds de façon claire, conviviale et accessible — certaines personnes ne sont pas à l'aise avec la technologie. Réponds toujours en français.

=== PROFIL COPROPRIÉTAIRE ===
Nom: ${profile.prenom} ${profile.nom}
Email: ${profile.email} | Téléphone: ${profile.telephone}
Immeuble: ${profile.immeuble} | Bâtiment: ${profile.batiment} | Étage: ${profile.etage} | Lot: ${profile.numLot}
Tantièmes: ${profile.tantiemes}/10 000 | Quote-part: ${profile.quotePart}%

=== SITUATION FINANCIÈRE ===
Charges du mois: ${chargesDuMois?.montant || 285}€ — ${chargesDuMois?.statut === 'payee' ? 'PAYÉE' : 'EN ATTENTE'}
Solde total à régler: ${solde}€ (${paiementsAttente.length} paiement(s) en attente)
Détail paiements en attente:
${paiementsAttente.map(p => `- ${p.description}: ${p.montant}€ (échéance ${formatDate(p.dateEcheance)}, réf: ${p.reference})`).join('\n') || '- Aucun paiement en attente'}

=== PROCHAINES ÉCHÉANCES ===
${echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => `- [${formatDate(e.date)}] ${e.titre}: ${e.description}${e.urgent ? ' ⚠️ URGENT' : ''}`).join('\n')}

=== DOCUMENTS DISPONIBLES (onglet Documents) ===
${docsListe}

=== ANNONCES DU SYNDIC ===
${annonces.map(a => `- [${a.date}] ${a.importance.toUpperCase()} — ${a.titre}: ${a.contenu}`).join('\n')}

=== ASSEMBLÉES GÉNÉRALES ===
${ags.map(ag => {
  const resLines = ag.resolutions.map(r =>
    `  • ${r.titre}: ${r.description.slice(0, 120)} | Mon vote: ${r.monVote || 'pas encore voté'} | Résultat: ${r.resultat || (r.statut === 'ouverte' ? 'vote en cours' : 'N/A')} | Pour: ${r.votePour} tantièmes, Contre: ${r.voteContre}, Abstention: ${r.voteAbstention}`
  ).join('\n')
  return `AG: ${ag.titre} — ${formatDate(ag.date)}, ${ag.lieu}\nStatut: ${ag.statut}\nOrdre du jour:${ag.ordreDuJour.map(o => `\n  • ${o}`).join('')}\nRésolutions:\n${resLines}`
}).join('\n\n---\n\n')}

=== HISTORIQUE RÉCENT ===
${historique.slice(0, 15).map(h => `- [${h.date}] ${h.titre}: ${h.description}${h.montant !== undefined ? ` (${h.montant >= 0 ? '+' : ''}${h.montant}€)` : ''}`).join('\n')}

=== RÈGLES DE RÉPONSE ===
- Sois précis avec les chiffres et les dates issus des données ci-dessus.
- Pour télécharger un document → orienter vers l'onglet "Documents" du menu.
- Pour voter en AG → onglet "Assemblées & Votes".
- Pour payer → onglet "Paiements".
- Pour un signalement → onglet "Signalement".
- Aide les personnes peu à l'aise avec la technologie avec des explications simples et bienveillantes.
- Tu peux répondre à TOUTES les questions: finances, règlement de copropriété, travaux, votes, comptabilité, droits du copropriétaire, etc.`
  }

  // (sendAssistantMessage internalized in CoproAssistantSection)

  // ── Module helpers ──
  const isModuleEnabled = (key: string): boolean => {
    if (Object.keys(enabledModules).length === 0) {
      return COPRO_MODULES.find(m => m.key === key)?.default ?? true
    }
    return enabledModules[key] ?? COPRO_MODULES.find(m => m.key === key)?.default ?? true
  }

  const toggleModule = (key: string) => {
    const updated = { ...enabledModules, [key]: !isModuleEnabled(key) }
    setEnabledModules(updated)
    if (user) localStorage.setItem(`fixit_modules_copro_${user.id}`, JSON.stringify(updated))
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4EE]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#4A5E78] font-medium">{t.loading}</p>
        </div>
      </div>
    )
  }

  // ── Rendu ──
  return (
    <div id="copro-dashboard" className="flex h-screen bg-[#F7F4EE] overflow-hidden">

      {/* ── BOUTON RETOUR ADMIN ── */}
      {isAdminOverride && (
        <div className="fixed top-3 right-3 z-[9999]">
          <button
            onClick={async () => {
              await supabase.auth.updateUser({ data: { ...user?.user_metadata, role: 'super_admin', _admin_override: false } })
              await supabase.auth.refreshSession()
              window.location.href = '/admin/dashboard'
            }}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-[#0D1B2E] font-bold text-xs px-4 py-2 rounded-full shadow-lg transition"
          >
            {t.retourAdmin}
          </button>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside
        style={{ width: sidebarOpen ? 240 : 64, background: 'var(--sd-navy)', flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease', borderRight: '1px solid var(--sd-border-dark)', position: 'relative', overflowY: 'auto' }}
      >
        {/* Grid texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ padding: '0 20px', height: 80, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--sd-border-dark)', position: 'relative', gap: 12, flexShrink: 0 }}>
          <div
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", color: 'var(--sd-navy)', fontSize: 17, fontWeight: 600, boxShadow: '0 4px 12px rgba(201,168,76,0.3)', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? t.reduire : t.developper}
          >V</div>
          {sidebarOpen && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", color: '#fff', fontSize: 16, lineHeight: 1.1, letterSpacing: '0.5px' }}>VitFix Copro</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase' as const, color: 'var(--sd-gold)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {profile.immeuble}
              </div>
            </div>
          )}
        </div>

        {/* Nav — categorized */}
        <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8, overflowY: 'auto', position: 'relative' }}>
          {navCategories.map((cat, ci) => {
            const visibleItems = navItems.filter(item => cat.items.includes(item.id) && (['accueil', 'parametres', 'modules'].includes(item.id) || isModuleEnabled(item.id)))
            if (visibleItems.length === 0) return null
            return (
              <div key={ci}>
                {/* Category label */}
                {sidebarOpen && (
                  <div style={{ padding: '10px 24px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.25)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif", marginTop: ci > 0 ? 8 : 0 }}>
                    {cat.label}
                  </div>
                )}
                {!sidebarOpen && ci > 0 && (
                  <div style={{ margin: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                )}
                {visibleItems.map(item => {
                  const isActive = page === item.id
                  const badge = item.id === 'annonces' ? annoncesNonLues : item.id === 'accueil' ? notifNonLues : 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPage(item.id)}
                      style={{
                        width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11,
                        padding: '10px 16px', margin: '1px 8px',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 500 : 400,
                        fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                        transition: 'all 0.18s ease', border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', textAlign: 'left' as const,
                        background: isActive ? 'var(--sd-gold-dim)' : 'transparent',
                        color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.45)',
                        position: 'relative' as const,
                      }}
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' } }}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' } }}
                    >
                      {isActive && <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: 'var(--sd-gold)', borderRadius: '0 3px 3px 0' }} />}
                      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, filter: isActive ? 'none' : 'grayscale(30%)' }}>{item.emoji}</span>
                      {sidebarOpen && (
                        <>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.label}</span>
                          {badge > 0 && (
                            <span style={{ marginLeft: 'auto', background: isActive ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.1)', color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <button
            onClick={handleLogout}
            style={{ width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', margin: '1px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.45)', textAlign: 'left' as const, transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.15)'; (e.currentTarget as HTMLElement).style.color = '#e74c3c' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>🚪</span>
            {sidebarOpen && <span>{t.deconnexion}</span>}
          </button>
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sd-border-dark)', position: 'relative', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'default' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sd-navy)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{userName}</div>
                <div style={{ color: 'var(--sd-gold)', fontSize: 10, letterSpacing: '0.4px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {t.coproLot} {profile.numLot}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--sd-cream)' }}>
        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid var(--sd-border)', padding: '0 36px', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 var(--sd-border), 0 4px 16px rgba(13,27,46,0.04)' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400, color: 'var(--sd-navy)', letterSpacing: '0.2px' }}>
              {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', letterSpacing: '0.3px' }}>
              {profile.immeuble} · {t.bat} {profile.batiment} · {t.lot} {profile.numLot} · {new Date().toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setPage('accueil')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, var(--sd-gold), #A8842A)', color: 'var(--sd-navy)', border: 'none', padding: '9px 18px', borderRadius: 9, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 2px 8px rgba(201,168,76,0.35)', position: 'relative' }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--sd-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"/><path d="M6.5 12.5a1.5 1.5 0 003 0"/></svg>
              {t.notifications}
              {notifNonLues > 0 && (
                <span style={{ background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 2 }}>
                  {notifNonLues > 9 ? '9+' : notifNonLues}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Contenu pages */}
        <div className="p-6">

          {/* PAGE : ACCUEIL */}
          {page === 'accueil' && (
            <CoproAccueilSection
              t={t} locale={locale} profile={profile} chargesDuMois={chargesDuMois} solde={solde}
              paiementsEnAttente={paiementsEnAttente} notifNonLues={notifNonLues}
              echeances={echeances} notifications={notifications} annonces={annonces}
              setPage={setPage} markNotifRead={markNotifRead} markAllNotifsRead={markAllNotifsRead}
            />
          )}

          {/* PAGE : DOCUMENTS */}
          {page === 'documents' && (
            <CoproDocumentsSection t={t} locale={locale} documents={documents} docTypeLabels={docTypeLabels} markDocConsulte={markDocConsulte} />
          )}

          {/* PAGE : PAIEMENTS */}
          {page === 'paiements' && (
            <CoproPaiementsSection t={t} locale={locale} paiements={paiements} />
          )}

          {/* PAGE : ANNONCES */}
          {page === 'annonces' && (
            <CoproAnnoncesSection t={t} annonces={annonces} markAnnonceRead={markAnnonceRead} />
          )}

          {/* PAGE : SIGNALEMENT */}
          {page === 'signalement' && (
            <CoproSignalementSection
              t={t} profile={profile} typesIntervention={typesIntervention} zonesCommunes={zonesCommunes}
              setPage={setPage} handleEnvoyerSignalement={handleEnvoyerSignalement}
              signalemType={signalemType} setSignalemType={setSignalemType}
              signalemDesc={signalemDesc} setSignalemDesc={setSignalemDesc}
              signalemUrgence={signalemUrgence} setSignalemUrgence={setSignalemUrgence}
              signalemPartieCommune={signalemPartieCommune} setSignalemPartieCommune={setSignalemPartieCommune}
              signalemZone={signalemZone} setSignalemZone={setSignalemZone}
              signalemEnvoye={signalemEnvoye}
            />
          )}

          {/* PAGE : ASSEMBLEES & VOTES */}
          {page === 'assemblees' && (
            <CoproAssembleesSection t={t} locale={locale} ags={ags} profile={profile} majoriteLabels={majoriteLabels} handleVote={handleVote} />
          )}

          {/* PAGE : HISTORIQUE & REPORTING */}
          {page === 'historique' && (
            <CoproHistoriqueSection t={t} locale={locale} profile={profile} charges={charges} historique={historique} />
          )}

          {/* PAGE : MODULES */}
          {page === 'modules' && (
            <CoproModulesSection t={t} coproModules={coproModules} isModuleEnabled={isModuleEnabled} toggleModule={toggleModule} />
          )}

          {/* PAGE : PARAMETRES */}
          {page === 'parametres' && (
            <CoproParametresSection
              t={t} locale={locale} profile={profile} params={params} setParams={setParams}
              saveProfile={saveProfile} editProfile={editProfile} setEditProfile={setEditProfile}
              profileForm={profileForm} setProfileForm={setProfileForm}
            />
          )}

          {/* PAGE : ASSISTANT IA SOFIA */}
          {page === 'assistant' && (
            <CoproAssistantSection t={t} profile={profile} buildCoproSystemPrompt={buildCoproSystemPrompt} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MES INTERVENTIONS — SUIVI TEMPS RÉEL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'interventions_suivi' && (
            <MesInterventionsSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : QUITTANCES DE LOYER
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'quittances' && (
            <QuittancesSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MON BAIL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'mon_bail' && (
            <MonBailSection profile={profile} />
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : MES CHARGES — BREAKDOWN ANNUEL
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'mes_charges' && (
            <MesChargesSection profile={profile} paiements={paiements} charges={charges} />
          )}

        </div>

        {/* Bouton flottant Fixy */}
        {page !== 'assistant' && (
          <button
            onClick={() => setPage('assistant')}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#C9A84C] hover:bg-[#F0D898] text-[#0D1B2E] font-bold px-5 py-3 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="25" y="45" width="50" height="35" rx="8" fill="#C9A84C"/>
              <rect x="28" y="18" width="44" height="30" rx="10" fill="#F0D898"/>
              <circle cx="40" cy="30" r="5" fill="#1a1a2e"/><circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
              <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <line x1="50" y1="18" x2="50" y2="8" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="50" cy="6" r="4" fill="#FF9800"/>
            </svg>
            <span className="text-sm">Fixy</span>
          </button>
        )}

      </main>
    </div>
  )
}
