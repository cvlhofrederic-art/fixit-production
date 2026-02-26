'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPrice, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type CoproPage = 'accueil' | 'documents' | 'paiements' | 'annonces' | 'signalement' | 'assemblees' | 'historique' | 'parametres' | 'assistant'

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
    lienVisio: 'https://meet.example.com/ag-acacias-2026',
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
  art25: { label: 'Art. 25', color: 'bg-purple-100 text-purple-700' },
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

const NAV_ITEMS: { id: CoproPage; emoji: string; label: string }[] = [
  { id: 'accueil', emoji: '📊', label: 'Tableau de bord' },
  { id: 'documents', emoji: '📁', label: 'Documents' },
  { id: 'paiements', emoji: '💶', label: 'Paiements' },
  { id: 'annonces', emoji: '📢', label: 'Annonces' },
  { id: 'signalement', emoji: '🔔', label: 'Signalement' },
  { id: 'assemblees', emoji: '🏛️', label: 'Assemblées & Votes' },
  { id: 'historique', emoji: '📈', label: 'Historique' },
  { id: 'parametres', emoji: '⚙️', label: 'Paramètres' },
  { id: 'assistant', emoji: '🤖', label: 'Assistant IA Sofia' },
]

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CoproprietaireDashboard() {
  // Auth
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Navigation
  const [page, setPage] = useState<CoproPage>('accueil')
  const [sidebarOpen, setSidebarOpen] = useState(true)

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

  // Documents filters
  const [docFilterType, setDocFilterType] = useState<string>('tous')
  const [docFilterAnnee, setDocFilterAnnee] = useState<string>('toutes')
  const [docSearch, setDocSearch] = useState('')

  // Paiements
  const [paiementTab, setPaiementTab] = useState<'en_attente' | 'payee'>('en_attente')


  // Assemblées
  const [selectedAG, setSelectedAG] = useState<string | null>(null)

  // Historique
  const [histoFilter, setHistoFilter] = useState<string>('tous')

  // Paramètres
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ nom: '', prenom: '', email: '', telephone: '' })

  // Assistant IA
  const [assistantMessages, setAssistantMessages] = useState<{role:'user'|'assistant', content: string}[]>([])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const assistantEndRef = React.useRef<HTMLDivElement>(null)

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
        } catch { /* silent */ }
      } else {
        // Mode démo sans auth
        setProfile(PROFILE_DEMO)
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
      try { localStorage.setItem(`fixit_copro_${key}_${uid}`, JSON.stringify(data)) } catch {}
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
    } catch { /* silent */ }
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
      } catch { /* silent */ }
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
    const docsListe = documents.map(d => `- ${d.nom} (${d.annee}, ${DOC_TYPE_LABELS[d.type]?.label || d.type})`).join('\n')
    return `Tu es Sofia, l'assistante IA personnelle de ${profile.prenom} ${profile.nom}, copropriétaire au ${profile.immeuble}, bâtiment ${profile.batiment}, étage ${profile.etage}, lot n°${profile.numLot}. Tu as accès à toutes les informations de sa copropriété. Réponds de façon claire, conviviale et accessible — certaines personnes ne sont pas à l'aise avec la technologie. Réponds toujours en français.

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

  const sendAssistantMessage = async () => {
    if (!assistantInput.trim() || assistantLoading) return
    const userMsg = { role: 'user' as const, content: assistantInput.trim() }
    const newMessages = [...assistantMessages, userMsg]
    setAssistantMessages(newMessages)
    setAssistantInput('')
    setAssistantLoading(true)
    setTimeout(() => assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await fetch('/api/comptable-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, systemPrompt: buildCoproSystemPrompt() }),
      })
      const data = await res.json()
      const reply = data.response || data.message || 'Désolée, je n\'ai pas pu répondre pour le moment.'
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setAssistantMessages(prev => [...prev, { role: 'assistant', content: 'Une erreur est survenue. Veuillez réessayer.' }])
    } finally {
      setAssistantLoading(false)
      setTimeout(() => assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Chargement de votre espace...</p>
        </div>
      </div>
    )
  }

  // ── Rendu ──
  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">

      {/* ── BOUTON RETOUR ADMIN ── */}
      {isAdminOverride && (
        <div className="fixed top-3 right-3 z-[9999]">
          <button
            onClick={async () => {
              await supabase.auth.updateUser({ data: { ...user?.user_metadata, role: 'super_admin', _admin_override: false } })
              await supabase.auth.refreshSession()
              window.location.href = '/admin/dashboard'
            }}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-xs px-4 py-2 rounded-full shadow-lg transition"
          >
            ⚡ Retour Admin
          </button>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">⚡</span>
                <span className="font-bold text-[#FFC107] text-sm">VitFix</span>
                <span className="text-purple-400 font-bold text-sm">Copro</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{profile.immeuble}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const badge = item.id === 'annonces' ? annoncesNonLues : item.id === 'accueil' ? notifNonLues : 0
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                  page === item.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg flex-shrink-0">{item.emoji}</span>
                {sidebarOpen && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 ${page === item.id ? 'bg-white/20 text-white' : 'bg-purple-600 text-white'}`}>
                        {badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-purple-400 truncate">
                  Copropriétaire · Lot {profile.numLot}
                </p>
                <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-red-400 transition">
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {NAV_ITEMS.find(n => n.id === page)?.emoji} {NAV_ITEMS.find(n => n.id === page)?.label}
            </h1>
            <p className="text-sm text-gray-500">{profile.immeuble} · Bât. {profile.batiment} · Lot {profile.numLot} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            {notifNonLues > 0 && (
              <button onClick={() => setPage('accueil')} className="relative p-2 text-gray-400 hover:text-purple-600 transition" title="Notifications">
                <span className="text-xl">🔔</span>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {notifNonLues}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Contenu pages */}
        <div className="p-6">

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : ACCUEIL — TABLEAU DE BORD
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'accueil' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💶</span>
                    <span className="text-xs text-gray-500 font-medium">Charges du mois</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatPrice(chargesDuMois?.montant || 285)}</p>
                  <p className="text-xs mt-1">
                    {chargesDuMois?.statut === 'payee'
                      ? <span className="text-green-600">✓ Payée</span>
                      : <span className="text-amber-600">En attente</span>
                    }
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">📊</span>
                    <span className="text-xs text-gray-500 font-medium">Solde à payer</span>
                  </div>
                  <p className={`text-xl font-bold ${solde > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPrice(solde)}</p>
                  <p className="text-xs text-gray-500 mt-1">{paiementsEnAttente} paiement{paiementsEnAttente > 1 ? 's' : ''} en attente</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🏠</span>
                    <span className="text-xs text-gray-500 font-medium">Tantièmes</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{profile.tantiemes} / 10 000</p>
                  <p className="text-xs text-purple-600 mt-1">Quote-part : {profile.quotePart}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔔</span>
                    <span className="text-xs text-gray-500 font-medium">Notifications</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{notifNonLues}</p>
                  <p className="text-xs text-gray-500 mt-1">non lue{notifNonLues > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setPage('signalement')} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
                  🔔 Faire un signalement
                </button>
                <button onClick={() => setPage('paiements')} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 transition">
                  💶 Mes paiements
                </button>
                <button onClick={() => setPage('documents')} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 transition">
                  📁 Mes documents
                </button>
                <button onClick={() => setPage('assemblees')} className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 transition">
                  🗳️ Voter en AG
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Échéances */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">📅 Prochaines échéances</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                      <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                        <span className="text-lg mt-0.5">{ECHEANCE_TYPE_EMOJI[e.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{e.titre}</p>
                            {e.urgent && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Urgent</span>}
                          </div>
                          <p className="text-xs text-gray-500">{e.description}</p>
                          <p className="text-xs text-purple-600 font-medium mt-0.5">{formatDate(e.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900">🔔 Notifications</h2>
                    {notifNonLues > 0 && (
                      <button onClick={markAllNotifsRead} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {notifications.sort((a, b) => b.date.localeCompare(a.date)).map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotifRead(n.id)}
                        className={`px-5 py-3 flex items-start gap-3 cursor-pointer transition ${!n.lu ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="text-lg mt-0.5">{NOTIF_TYPE_EMOJI[n.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm truncate ${!n.lu ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{n.titre}</p>
                            {!n.lu && <span className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(n.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Annonces récentes */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">📢 Dernières annonces</h2>
                  <button onClick={() => setPage('annonces')} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                    Voir tout →
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {annonces.slice(0, 3).map(a => (
                    <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        a.importance === 'urgent' ? 'bg-red-100 text-red-700' :
                        a.importance === 'important' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {a.importance === 'urgent' ? '🔴 Urgent' : a.importance === 'important' ? '🟠 Important' : '🔵 Info'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!a.lu ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{a.titre}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.auteur} · {formatDate(a.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : DOCUMENTS
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'documents' && (
            <div className="space-y-6">
              {/* Filtres */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex flex-wrap gap-3">
                  <select
                    value={docFilterType}
                    onChange={e => setDocFilterType(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none bg-white"
                  >
                    <option value="tous">Tous les types</option>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                  <select
                    value={docFilterAnnee}
                    onChange={e => setDocFilterAnnee(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none bg-white"
                  >
                    <option value="toutes">Toutes les années</option>
                    {[...new Set(documents.map(d => d.annee))].sort((a, b) => b - a).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="🔍 Rechercher un document..."
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Grille documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents
                  .filter(d => docFilterType === 'tous' || d.type === docFilterType)
                  .filter(d => docFilterAnnee === 'toutes' || d.annee === Number(docFilterAnnee))
                  .filter(d => !docSearch || d.nom.toLowerCase().includes(docSearch.toLowerCase()))
                  .sort((a, b) => b.dateUpload.localeCompare(a.dateUpload))
                  .map(doc => (
                    <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{DOC_TYPE_LABELS[doc.type]?.emoji || '📄'}</span>
                          {!doc.consulte && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Nouveau</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${doc.public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {doc.public ? 'Public' : 'Personnel'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">{doc.nom}</h3>
                      <p className="text-xs text-gray-500 mb-1">{DOC_TYPE_LABELS[doc.type]?.label} · {doc.annee}</p>
                      <p className="text-xs text-gray-400 mb-3">{doc.taille} · Ajouté le {formatDate(doc.dateUpload)}</p>
                      {doc.consulte && doc.dateConsultation && (
                        <p className="text-xs text-green-600 mb-3">✓ Consulté le {formatDate(doc.dateConsultation)}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            markDocConsulte(doc.id)
                            alert(`Téléchargement de "${doc.nom}" en cours...`)
                          }}
                          className="flex-1 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-2 rounded-lg transition"
                        >
                          📥 Télécharger
                        </button>
                        {!doc.consulte && (
                          <button
                            onClick={() => markDocConsulte(doc.id)}
                            className="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium py-2 px-3 rounded-lg transition"
                          >
                            👁️ Marquer lu
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Derniers consultés */}
              {documents.filter(d => d.consulte).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">👁️ Derniers documents consultés</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {documents.filter(d => d.consulte && d.dateConsultation).sort((a, b) => (b.dateConsultation || '').localeCompare(a.dateConsultation || '')).slice(0, 5).map(doc => (
                      <div key={doc.id} className="px-5 py-3 flex items-center gap-3">
                        <span>{DOC_TYPE_LABELS[doc.type]?.emoji || '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.nom}</p>
                          <p className="text-xs text-gray-500">Consulté le {formatDate(doc.dateConsultation!)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : PAIEMENTS
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'paiements' && (
            <div className="space-y-6">
              {/* Résumé */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Total payé (année en cours)</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatPrice(paiements.filter(p => p.statut === 'payee' && p.datePaiement?.startsWith('2026')).reduce((s, p) => s + p.montant, 0))}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">En attente</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {formatPrice(paiements.filter(p => p.statut === 'en_attente').reduce((s, p) => s + p.montant, 0))}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">En retard</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {formatPrice(paiements.filter(p => p.statut === 'en_retard').reduce((s, p) => s + p.montant, 0))}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPaiementTab('en_attente')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${paiementTab === 'en_attente' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  À payer ({paiements.filter(p => p.statut !== 'payee').length})
                </button>
                <button
                  onClick={() => setPaiementTab('payee')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${paiementTab === 'payee' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  Historique ({paiements.filter(p => p.statut === 'payee').length})
                </button>
              </div>

              {/* Liste */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Référence</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Description</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Montant</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Échéance</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Statut</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paiements
                      .filter(p => paiementTab === 'payee' ? p.statut === 'payee' : p.statut !== 'payee')
                      .sort((a, b) => b.dateEcheance.localeCompare(a.dateEcheance))
                      .map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3 text-xs font-mono text-gray-500">{p.reference}</td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-gray-900">{p.description}</p>
                            <p className="text-xs text-gray-500 capitalize">{p.type.replace(/_/g, ' ')}</p>
                          </td>
                          <td className={`px-5 py-3 text-right text-sm font-bold ${p.montant < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                            {formatPrice(p.montant)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-600">{formatDate(p.dateEcheance)}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              p.statut === 'payee' ? 'bg-green-100 text-green-700' :
                              p.statut === 'en_retard' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {p.statut === 'payee' ? '✓ Payé' : p.statut === 'en_retard' ? '⚠ En retard' : '⏳ En attente'}
                            </span>
                            {p.datePaiement && <p className="text-xs text-gray-400 mt-1">le {formatDate(p.datePaiement)}</p>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {p.statut === 'payee' && (
                              <button
                                onClick={() => alert(`Téléchargement du reçu ${p.reference}...`)}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                              >
                                📥 Reçu
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : ANNONCES
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'annonces' && (
            <div className="space-y-4">
              {annonces.sort((a, b) => b.date.localeCompare(a.date)).map(a => (
                <div
                  key={a.id}
                  onClick={() => markAnnonceRead(a.id)}
                  className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition ${
                    !a.lu ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        a.importance === 'urgent' ? 'bg-red-100 text-red-700' :
                        a.importance === 'important' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {a.importance === 'urgent' ? '🔴 Urgent' : a.importance === 'important' ? '🟠 Important' : '🔵 Info'}
                      </span>
                      {!a.lu && <span className="w-2 h-2 bg-purple-600 rounded-full" />}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
                  </div>
                  <h3 className={`text-sm mb-2 ${!a.lu ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{a.titre}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{a.contenu}</p>
                  <p className="text-xs text-gray-400 mt-3">Par {a.auteur}</p>
                </div>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : SIGNALEMENT
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'signalement' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-purple-100 bg-purple-50">
                  <h3 className="font-bold text-purple-900">🔔 Nouveau signalement</h3>
                  <p className="text-xs text-purple-600 mt-0.5">Signalez un problème à votre gestionnaire de copropriété</p>
                </div>

                {signalemEnvoye ? (
                  <div className="p-12 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-lg font-bold text-green-700">Signalement envoyé !</h3>
                    <p className="text-sm text-gray-500 mt-2">Votre gestionnaire a été notifié. Un suivi apparaîtra dans votre historique.</p>
                    <button onClick={() => setPage('historique')} className="mt-4 text-sm text-purple-600 hover:text-purple-800 font-medium">
                      Voir l'historique →
                    </button>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">

                    {/* Localisation auto */}
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-purple-700 mb-2">📍 Votre localisation (auto-remplie)</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-white border border-purple-100 px-2 py-1 rounded-lg">🏢 {profile.immeuble}</span>
                        {profile.batiment && <span className="text-xs bg-white border border-purple-100 px-2 py-1 rounded-lg">Bât. {profile.batiment}</span>}
                        {profile.etage && <span className="text-xs bg-white border border-purple-100 px-2 py-1 rounded-lg">Étage {profile.etage}</span>}
                        {profile.numLot && <span className="text-xs bg-white border border-purple-100 px-2 py-1 rounded-lg">Lot {profile.numLot}</span>}
                      </div>
                    </div>

                    {/* Toggle partie commune */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Partie commune ?</p>
                        <p className="text-xs text-gray-500 mt-0.5">Cave, couloir, ascenseur, toiture, hall…</p>
                      </div>
                      <button
                        onClick={() => { setSignalemPartieCommune(v => !v); setSignalemZone('') }}
                        className={`relative w-11 h-6 rounded-full transition-colors ${signalemPartieCommune ? 'bg-orange-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${signalemPartieCommune ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Zone commune */}
                    {signalemPartieCommune && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Zone concernée</label>
                        <select
                          value={signalemZone}
                          onChange={e => setSignalemZone(e.target.value)}
                          className="w-full px-3 py-2.5 border-2 border-orange-200 rounded-lg text-sm focus:border-orange-400 focus:outline-none bg-white"
                        >
                          <option value="">Sélectionner une zone…</option>
                          {ZONES_COMMUNES.map(z => <option key={z} value={z}>{z}</option>)}
                          <option value="Autre">Autre (préciser dans la description)</option>
                        </select>
                      </div>
                    )}

                    {/* Type d'intervention */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type d'intervention *</label>
                      <select
                        value={signalemType}
                        onChange={e => setSignalemType(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none bg-white"
                      >
                        <option value="">Choisir le type…</option>
                        {TYPES_INTERVENTION.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description du problème *</label>
                      <textarea
                        value={signalemDesc}
                        onChange={e => setSignalemDesc(e.target.value)}
                        placeholder="Décrivez précisément le problème constaté..."
                        rows={4}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Urgence */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Niveau d'urgence</label>
                      <div className="flex gap-2">
                        {([
                          { val: 'normale' as const, label: '🟡 Normale', desc: 'Sous 48h' },
                          { val: 'urgente' as const, label: '🔴 Urgent', desc: 'Immédiat' },
                          { val: 'planifiee' as const, label: '🟢 Planifiée', desc: 'À programmer' },
                        ] as const).map(({ val, label, desc }) => (
                          <button
                            key={val}
                            onClick={() => setSignalemUrgence(val)}
                            className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-center transition ${
                              signalemUrgence === val
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <p className="text-xs font-bold text-gray-800">{label}</p>
                            <p className="text-xs text-gray-500">{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bouton envoi */}
                    <button
                      onClick={handleEnvoyerSignalement}
                      disabled={!signalemType || !signalemDesc}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
                    >
                      📤 Envoyer le signalement au syndic
                    </button>

                    <p className="text-xs text-gray-400 text-center">
                      Votre signalement sera transmis à votre gestionnaire de copropriété.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : ASSEMBLÉES & VOTES
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'assemblees' && (
            <div className="space-y-6">
              {/* Liste AG */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ags.map(ag => (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedAG(selectedAG === ag.id ? null : ag.id)}
                    className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition ${
                      selectedAG === ag.id ? 'border-purple-400 ring-2 ring-purple-100' : 'border-gray-200 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        ag.type === 'ordinaire' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {ag.type === 'ordinaire' ? 'AG Ordinaire' : 'AG Extraordinaire'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        ag.statut === 'cloturee' ? 'bg-gray-100 text-gray-600' :
                        ag.statut === 'en_cours' ? 'bg-green-100 text-green-700' :
                        ag.statut === 'convoquee' ? 'bg-purple-100 text-purple-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {ag.statut === 'cloturee' ? '✓ Clôturée' : ag.statut === 'en_cours' ? '● En cours' : ag.statut === 'convoquee' ? '📩 Convoquée' : '📅 Planifiée'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">{ag.titre}</h3>
                    <p className="text-sm text-gray-600 mb-1">📅 {new Date(ag.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-sm text-gray-500">📍 {ag.lieu}</p>
                    <p className="text-xs text-purple-600 font-medium mt-2">{ag.resolutions.length} résolution{ag.resolutions.length > 1 ? 's' : ''} · Cliquer pour détails</p>
                  </div>
                ))}
              </div>

              {/* Détail AG */}
              {selectedAG && (() => {
                const ag = ags.find(a => a.id === selectedAG)
                if (!ag) return null
                return (
                  <div className="space-y-6">
                    {/* Infos pratiques */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <h2 className="font-bold text-gray-900 text-lg mb-4">📋 Informations pratiques</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Date</p>
                          <p className="text-sm text-gray-900">{new Date(ag.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Lieu</p>
                          <p className="text-sm text-gray-900">{ag.lieu}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Type</p>
                          <p className="text-sm text-gray-900 capitalize">{ag.type}</p>
                        </div>
                        {ag.lienVisio && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Visioconférence</p>
                            <p className="text-sm text-purple-600 font-medium">🎥 Lien disponible</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ordre du jour */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <h2 className="font-bold text-gray-900 text-lg mb-4">📝 Ordre du jour</h2>
                      <ol className="space-y-2">
                        {ag.ordreDuJour.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                            <span className="text-sm text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Résolutions & Votes */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900 text-lg">🗳️ Résolutions</h2>
                        {ag.statut !== 'cloturee' && (
                          <p className="text-xs text-purple-600 mt-1">Vos tantièmes : {profile.tantiemes} / 10 000 — Votez en cliquant sur votre choix</p>
                        )}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {ag.resolutions.map(res => {
                          const totalVotes = res.votePour + res.voteContre + res.voteAbstention
                          const pctPour = totalVotes > 0 ? Math.round((res.votePour / totalVotes) * 100) : 0
                          const pctContre = totalVotes > 0 ? Math.round((res.voteContre / totalVotes) * 100) : 0
                          const pctAbst = totalVotes > 0 ? Math.round((res.voteAbstention / totalVotes) * 100) : 0
                          return (
                            <div key={res.id} className="p-5">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-sm font-bold text-gray-900">{res.titre}</h3>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${MAJORITE_LABELS[res.majorite]?.color || 'bg-gray-100 text-gray-600'}`}>
                                    {MAJORITE_LABELS[res.majorite]?.label}
                                  </span>
                                  {res.resultat && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.resultat === 'adoptée' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {res.resultat === 'adoptée' ? '✓ Adoptée' : '✗ Rejetée'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{res.description}</p>

                              {/* Mon vote */}
                              {res.monVote && (
                                <div className="mb-3">
                                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded ${
                                    res.monVote === 'pour' ? 'bg-green-100 text-green-700' :
                                    res.monVote === 'contre' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    Mon vote : {res.monVote === 'pour' ? '✓ POUR' : res.monVote === 'contre' ? '✗ CONTRE' : '○ ABSTENTION'}
                                  </span>
                                </div>
                              )}

                              {/* Barres de résultat (si clôturée ou déjà voté) */}
                              {(res.statut === 'cloturee' || res.monVote) && totalVotes > 0 && (
                                <div className="space-y-1.5 mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-16">Pour</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                      <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${pctPour}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{pctPour}%</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-16">Contre</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                      <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${pctContre}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{pctContre}%</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-16">Abstention</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                      <div className="bg-gray-400 h-full rounded-full transition-all" style={{ width: `${pctAbst}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{pctAbst}%</span>
                                  </div>
                                  <p className="text-xs text-gray-400">Total : {totalVotes.toLocaleString('fr-FR')} tantièmes exprimés</p>
                                </div>
                              )}

                              {/* Boutons vote */}
                              {res.statut === 'ouverte' && !res.monVote && (
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleVote(ag.id, res.id, 'pour')}
                                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-sm py-2.5 rounded-lg border border-green-200 transition"
                                  >
                                    ✓ Pour
                                  </button>
                                  <button
                                    onClick={() => handleVote(ag.id, res.id, 'contre')}
                                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-sm py-2.5 rounded-lg border border-red-200 transition"
                                  >
                                    ✗ Contre
                                  </button>
                                  <button
                                    onClick={() => handleVote(ag.id, res.id, 'abstention')}
                                    className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-sm py-2.5 rounded-lg border border-gray-200 transition"
                                  >
                                    ○ Abstention
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : HISTORIQUE & REPORTING
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'historique' && (
            <div className="space-y-6">
              {/* Récap */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Tantièmes</p>
                  <p className="text-xl font-bold text-gray-900">{profile.tantiemes}</p>
                  <p className="text-xs text-purple-600">/ 10 000</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Quote-part</p>
                  <p className="text-xl font-bold text-gray-900">{profile.quotePart}%</p>
                  <p className="text-xs text-gray-500">des charges</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Total payé 2025</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatPrice(historique.filter(h => h.type === 'paiement' && h.date.startsWith('2025') && h.montant && h.montant > 0).reduce((s, h) => s + (h.montant || 0), 0))}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Événements</p>
                  <p className="text-xl font-bold text-gray-900">{historique.length}</p>
                  <p className="text-xs text-gray-500">enregistrés</p>
                </div>
              </div>

              {/* Graphique charges (CSS) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 mb-4">📊 Évolution des charges (12 derniers mois)</h2>
                <div className="flex items-end gap-2 h-40">
                  {charges.sort((a, b) => a.mois.localeCompare(b.mois)).map(c => {
                    const maxCharge = Math.max(...charges.map(ch => ch.montant))
                    const height = maxCharge > 0 ? (c.montant / maxCharge) * 100 : 0
                    return (
                      <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500 font-medium">{formatPrice(c.montant)}</span>
                        <div
                          className={`w-full rounded-t-md transition-all ${c.statut === 'payee' ? 'bg-purple-500' : 'bg-purple-200'}`}
                          style={{ height: `${height}%`, minHeight: '4px' }}
                        />
                        <span className="text-xs text-gray-400">{c.mois.slice(5)}/{c.mois.slice(2, 4)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded" /> Payée</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-200 rounded" /> En attente</span>
                </div>
              </div>

              {/* Filtres */}
              <div className="flex gap-2">
                {['tous', 'paiement', 'vote', 'document', 'signalement', 'message'].map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      histoFilter === f ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {f === 'tous' ? 'Tous' : `${HISTORIQUE_TYPE_EMOJI[f] || ''} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="divide-y divide-gray-100">
                  {(() => {
                    const filtered = historique
                      .filter(h => histoFilter === 'tous' || h.type === histoFilter)
                      .sort((a, b) => b.date.localeCompare(a.date))
                    let lastMonth = ''
                    return filtered.map(h => {
                      const month = new Date(h.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                      const showHeader = month !== lastMonth
                      lastMonth = month
                      return (
                        <React.Fragment key={h.id}>
                          {showHeader && (
                            <div className="px-5 py-2 bg-gray-50">
                              <p className="text-xs font-bold text-gray-500 uppercase">{month}</p>
                            </div>
                          )}
                          <div className="px-5 py-3 flex items-start gap-3">
                            <span className="text-lg mt-0.5">{HISTORIQUE_TYPE_EMOJI[h.type]}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{h.titre}</p>
                              <p className="text-xs text-gray-500">{h.description}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDate(h.date)}</p>
                            </div>
                            {h.montant !== undefined && (
                              <span className={`text-sm font-bold ${h.montant < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {h.montant < 0 ? '+' : '-'}{formatPrice(Math.abs(h.montant))}
                              </span>
                            )}
                          </div>
                        </React.Fragment>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : PARAMÈTRES
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'parametres' && (
            <div className="space-y-6">
              {/* Profil */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg">👤 Mon profil</h2>
                  {!editProfile && (
                    <button
                      onClick={() => {
                        setProfileForm({ nom: profile.nom, prenom: profile.prenom, email: profile.email, telephone: profile.telephone })
                        setEditProfile(true)
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </div>

                {!editProfile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Nom complet</p>
                      <p className="text-sm text-gray-900 font-medium">{profile.prenom} {profile.nom}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Email</p>
                      <p className="text-sm text-gray-900">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Téléphone</p>
                      <p className="text-sm text-gray-900">{profile.telephone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Immeuble</p>
                      <p className="text-sm text-gray-900">{profile.immeuble}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Localisation</p>
                      <p className="text-sm text-gray-900">Bât. {profile.batiment} · Étage {profile.etage} · Lot {profile.numLot}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Tantièmes / Quote-part</p>
                      <p className="text-sm text-gray-900">{profile.tantiemes} / 10 000 ({profile.quotePart}%)</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                        <input
                          type="text"
                          value={profileForm.prenom}
                          onChange={e => setProfileForm({ ...profileForm, prenom: e.target.value })}
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                        <input
                          type="text"
                          value={profileForm.nom}
                          onChange={e => setProfileForm({ ...profileForm, nom: e.target.value })}
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                        <input
                          type="tel"
                          value={profileForm.telephone}
                          onChange={e => setProfileForm({ ...profileForm, telephone: e.target.value })}
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveProfile} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                        Enregistrer
                      </button>
                      <button onClick={() => setEditProfile(false)} className="bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 transition">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 text-lg mb-4">🔔 Préférences de notification</h2>
                <div className="space-y-4">
                  {[
                    { key: 'notifEmail' as const, label: 'Notifications par email', desc: 'Recevoir les alertes et rappels par email' },
                    { key: 'notifPush' as const, label: 'Notifications push', desc: 'Recevoir les alertes sur votre téléphone' },
                    { key: 'mailingAG' as const, label: 'Convocations AG', desc: 'Recevoir les convocations d\'assemblée générale' },
                    { key: 'alertesPaiement' as const, label: 'Alertes paiement', desc: 'Rappels d\'échéances de paiement' },
                    { key: 'alertesTravaux' as const, label: 'Alertes travaux', desc: 'Informations sur les travaux en cours' },
                    { key: 'resumeHebdo' as const, label: 'Résumé hebdomadaire', desc: 'Synthèse des événements de la semaine' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <button
                        onClick={() => setParams(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${params[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${params[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export PDF */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 text-lg mb-4">📥 Export & téléchargements</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => alert('Génération du récapitulatif annuel en PDF...')}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition text-left"
                  >
                    <span className="text-2xl">📊</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Récapitulatif annuel</p>
                      <p className="text-xs text-gray-500">Synthèse charges et paiements</p>
                    </div>
                  </button>
                  <button
                    onClick={() => alert('Génération du récapitulatif votes AG en PDF...')}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition text-left"
                  >
                    <span className="text-2xl">🗳️</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mes votes AG</p>
                      <p className="text-xs text-gray-500">Historique de tous vos votes</p>
                    </div>
                  </button>
                  <button
                    onClick={() => alert('Génération de l\'attestation de copropriété en PDF...')}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition text-left"
                  >
                    <span className="text-2xl">📜</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Attestation copropriété</p>
                      <p className="text-xs text-gray-500">Lot {profile.numLot} · {profile.tantiemes} tantièmes</p>
                    </div>
                  </button>
                  <button
                    onClick={() => window.location.href = '/coproprietaire/portail'}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition text-left"
                  >
                    <span className="text-2xl">🔔</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Portail signalements</p>
                      <p className="text-xs text-gray-500">Accéder au portail de signalement</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PAGE : ASSISTANT IA SOFIA
          ════════════════════════════════════════════════════════════════════════ */}
          {page === 'assistant' && (
            <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">

              {/* En-tête assistant */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-5 mb-4 flex items-center gap-4 shadow-md">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl flex-shrink-0">
                  🤖
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Sofia — Assistante IA</h2>
                  <p className="text-purple-200 text-sm">Je connais toute votre copropriété. Posez-moi n'importe quelle question !</p>
                </div>
                {assistantMessages.length > 0 && (
                  <button
                    onClick={() => setAssistantMessages([])}
                    className="ml-auto text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    Nouvelle conversation
                  </button>
                )}
              </div>

              {/* Zone de chat */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {assistantMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <div className="text-5xl mb-4">💬</div>
                      <p className="text-gray-600 font-medium text-lg mb-2">Bonjour {profile.prenom} !</p>
                      <p className="text-gray-500 text-sm mb-6 max-w-md">
                        Je suis Sofia, votre assistante personnelle pour la copropriété <strong>{profile.immeuble}</strong>.
                        Je peux répondre à toutes vos questions — même si vous n'êtes pas à l'aise avec la technologie !
                      </p>
                      <p className="text-xs text-gray-400 mb-4 font-medium">Questions fréquentes :</p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                        {[
                          'Combien je dois payer ce mois ?',
                          'Quelle est la prochaine assemblée générale ?',
                          'Quels documents puis-je télécharger ?',
                          'Quel est mon solde actuel ?',
                          'Comment voter pour une résolution ?',
                          'Y a-t-il des travaux prévus ?',
                          'Quand est la prochaine coupure d\'eau ?',
                          'C\'est quoi les tantièmes ?',
                        ].map(q => (
                          <button
                            key={q}
                            onClick={() => {
                              setAssistantInput(q)
                              setTimeout(() => {
                                const input = document.getElementById('assistant-input')
                                if (input) (input as HTMLInputElement).focus()
                              }, 50)
                            }}
                            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-2 rounded-full transition"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {assistantMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'assistant' && (
                            <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">
                              🤖
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-purple-600 text-white rounded-tr-sm'
                                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {assistantLoading && (
                        <div className="flex justify-start">
                          <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
                            🤖
                          </div>
                          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex gap-1 items-center">
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={assistantEndRef} />
                    </>
                  )}
                </div>

                {/* Suggestions rapides quand il y a déjà des messages */}
                {assistantMessages.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
                    {['Mes paiements en attente', 'Prochaine AG', 'Mes documents', 'Mon solde'].map(q => (
                      <button
                        key={q}
                        onClick={() => {
                          setAssistantInput(q)
                          setTimeout(() => {
                            const input = document.getElementById('assistant-input')
                            if (input) (input as HTMLInputElement).focus()
                          }, 50)
                        }}
                        className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full transition flex-shrink-0"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-gray-200">
                  <form
                    onSubmit={e => { e.preventDefault(); sendAssistantMessage() }}
                    className="flex gap-2"
                  >
                    <input
                      id="assistant-input"
                      type="text"
                      value={assistantInput}
                      onChange={e => setAssistantInput(e.target.value)}
                      placeholder="Posez votre question à Sofia…"
                      disabled={assistantLoading}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-60 transition"
                    />
                    <button
                      type="submit"
                      disabled={!assistantInput.trim() || assistantLoading}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl transition"
                    >
                      {assistantLoading ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </form>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Sofia peut répondre à toutes vos questions sur votre copropriété
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Bouton flottant assistant IA */}
        {page !== 'assistant' && (
          <button
            onClick={() => setPage('assistant')}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-3 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <span className="text-xl">🤖</span>
            <span className="text-sm">Assistant IA</span>
          </button>
        )}

      </main>
    </div>
  )
}
