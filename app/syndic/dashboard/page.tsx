'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import FixyChatGeneric from '@/components/FixyChatGeneric'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'accueil' | 'immeubles' | 'artisans' | 'missions' | 'canal' | 'planning' | 'documents' | 'facturation' | 'coproprios' | 'alertes' | 'emails' | 'reglementaire' | 'rapport' | 'ia' | 'parametres' | 'equipe' | 'comptabilite_tech' | 'analyse_devis' | 'docs_interventions' | 'compta_copro' | 'ag_digitale' | 'impayés' | 'carnet_entretien' | 'sinistres' | 'extranet' | 'pointage' | 'echéances' | 'recouvrement' | 'preparateur_ag' | 'modules'

// Pages accessibles par rôle
const ROLE_PAGES: Record<string, Page[]> = {
  // Directeur / Propriétaire du cabinet — accès total
  syndic: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'reglementaire', 'rapport', 'documents', 'facturation', 'compta_copro', 'ag_digitale', 'impayés', 'carnet_entretien', 'sinistres', 'extranet', 'alertes', 'emails', 'ia', 'equipe', 'parametres', 'echéances', 'recouvrement', 'preparateur_ag', 'modules'],
  // Administrateur cabinet — accès large sauf terrain
  syndic_admin: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'reglementaire', 'rapport', 'documents', 'facturation', 'compta_copro', 'ag_digitale', 'impayés', 'analyse_devis', 'alertes', 'emails', 'ia', 'equipe', 'parametres', 'echéances', 'recouvrement', 'preparateur_ag', 'modules'],
  // Gestionnaire Technique — interventions, terrain, comptabilité tech
  syndic_tech: ['accueil', 'missions', 'planning', 'pointage', 'canal', 'immeubles', 'artisans', 'coproprios', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'facturation', 'alertes', 'emails', 'ia', 'parametres', 'modules'],
  // Secrétaire — coordination, planning de toute l'équipe, communication
  syndic_secretaire: ['accueil', 'coproprios', 'immeubles', 'artisans', 'missions', 'canal', 'planning', 'documents', 'alertes', 'emails', 'ia', 'parametres', 'modules'],
  // Gestionnaire Copropriété — déjà paramétré, ne pas modifier
  syndic_gestionnaire: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'reglementaire', 'alertes', 'documents', 'facturation', 'emails', 'ia', 'parametres', 'echéances', 'preparateur_ag', 'modules'],
  // Comptable — finances, rapports, comptabilité copropriété
  syndic_comptable: ['accueil', 'facturation', 'compta_copro', 'impayés', 'analyse_devis', 'rapport', 'documents', 'emails', 'ia', 'parametres', 'recouvrement', 'modules'],
}

const SYNDIC_MODULES = [
  { key: 'missions', label: 'Ordres de mission', icon: '📋', description: 'Créer et suivre les interventions', default: true },
  { key: 'pointage', label: 'Pointage Terrain', icon: '📍', description: 'Contrôle GPS des interventions', default: false },
  { key: 'canal', label: 'Canal Communications', icon: '💬', description: 'Messagerie interne et avec artisans', default: true },
  { key: 'planning', label: 'Planning', icon: '📅', description: 'Vue calendrier des interventions', default: true },
  { key: 'docs_interventions', label: 'Documents Interventions', icon: '🗂️', description: 'Rapports et preuves d\'intervention', default: false },
  { key: 'comptabilite_tech', label: 'Comptabilité Technique', icon: '📊', description: 'Suivi financier des interventions', default: false },
  { key: 'analyse_devis', label: 'Analyse Devis/Factures', icon: '🔍', description: 'Comparaison et validation des devis', default: false },
  { key: 'facturation', label: 'Facturation', icon: '💶', description: 'Gestion des factures', default: true },
  { key: 'reglementaire', label: 'Calendrier réglementaire', icon: '⚖️', description: 'Obligations légales et échéances', default: false },
  { key: 'rapport', label: 'Rapport mensuel', icon: '📄', description: 'Rapports d\'activité automatisés', default: false },
  { key: 'compta_copro', label: 'Comptabilité Copro', icon: '💶', description: 'Comptabilité de la copropriété', default: false },
  { key: 'ag_digitale', label: 'AG Digitales', icon: '🏛️', description: 'Assemblées générales en ligne', default: true },
  { key: 'impayés', label: 'Impayés', icon: '⚠️', description: 'Suivi et relance des impayés', default: false },
  { key: 'carnet_entretien', label: 'Carnet d\'Entretien', icon: '📖', description: 'Historique d\'entretien des immeubles', default: false },
  { key: 'sinistres', label: 'Sinistres', icon: '🚨', description: 'Pipeline de gestion des sinistres', default: false },
  { key: 'extranet', label: 'Extranet Copros', icon: '👥', description: 'Portail copropriétaires', default: false },
  { key: 'echéances', label: 'Échéances légales', icon: '📅', description: 'Rappels des échéances réglementaires', default: false },
  { key: 'recouvrement', label: 'Recouvrement auto', icon: '💸', description: 'Procédure automatisée de recouvrement', default: false },
  { key: 'preparateur_ag', label: 'Préparateur AG', icon: '📝', description: 'Préparer les assemblées générales', default: false },
  { key: 'emails', label: 'Emails Max IA', icon: '📧', description: 'Gestion des emails avec IA', default: true },
  { key: 'ia', label: 'Assistant Max IA', icon: '🤖', description: 'Assistant IA pour le syndic', default: true },
] as const

interface Immeuble {
  id: string
  nom: string
  adresse: string
  ville: string
  codePostal: string
  nbLots: number
  anneeConstruction: number
  typeImmeuble: string
  gestionnaire: string
  prochainControle?: string
  nbInterventions: number
  budgetAnnuel: number
  depensesAnnee: number
  // ── Géolocalisation ──
  latitude?: number                    // Coordonnée GPS latitude
  longitude?: number                   // Coordonnée GPS longitude
  geolocActivee?: boolean              // Géolocalisation activée/désactivée
  rayonDetection?: number              // Rayon de détection en mètres (défaut 150)
  // ── Règlement de copropriété ──
  reglementTexte?: string              // Texte complet du règlement (saisi ou extrait PDF)
  reglementPdfNom?: string             // Nom du fichier PDF
  reglementDateMaj?: string            // Date de dernière mise à jour
  reglementChargesRepartition?: string // Règle de répartition des charges
  reglementMajoriteAG?: string         // Majorités requises art 24/25/26
  reglementFondsTravaux?: boolean      // Fonds travaux art 14-2
  reglementFondsRoulementPct?: number  // % fonds de roulement
  reglementClausesIA?: string          // Résumé des clauses clés généré par IA
}

interface Artisan {
  id: string
  nom: string
  prenom?: string
  nom_famille?: string
  metier: string
  telephone: string
  email: string
  siret: string
  rcProValide: boolean
  rc_pro_valide?: boolean
  rcProExpiration: string
  rc_pro_expiration?: string
  note: number
  nbInterventions: number
  nb_interventions?: number
  statut: 'actif' | 'suspendu' | 'en_attente'
  vitfixCertifie: boolean
  vitfix_certifie?: boolean
  artisan_user_id?: string | null
  compte_existant?: boolean
  cabinet_id?: string
}

interface SyndicMessage {
  id: string
  cabinet_id: string
  artisan_user_id: string
  sender_id: string
  sender_role: 'syndic' | 'artisan'
  sender_name: string
  content: string
  mission_id?: string | null
  message_type: 'text' | 'rapport' | 'proof_of_work' | 'devis' | 'photo'
  read_at?: string | null
  created_at: string
}

interface CanalInterneMsg {
  id: string
  de: string
  deRole: string
  type: 'message' | 'tache' | 'planning'
  contenu: string
  date: string
  lu: boolean
  planningDate?: string
  planningHeure?: string
  planningResident?: string
  planningResidence?: string
  planningMissionCreee?: boolean
  tacheAssignee?: string
  tachePriorite?: 'normale' | 'urgente'
  tacheStatut?: 'en_attente' | 'en_cours' | 'terminee'
}

interface Mission {
  id: string
  immeuble: string
  artisan: string
  type: string
  description: string
  priorite: 'urgente' | 'normale' | 'planifiee'
  statut: 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
  dateCreation: string
  dateIntervention?: string
  montantDevis?: number
  montantFacture?: number
  // Champs locataire / fiche intervention
  batiment?: string
  etage?: string
  numLot?: string
  locataire?: string
  telephoneLocataire?: string
  accesLogement?: string
  // Rapport d'intervention
  rapportArtisan?: string
  travailEffectue?: string
  materiauxUtilises?: string
  problemesConstates?: string
  recommandations?: string
  dateRapport?: string
  dureeIntervention?: string
  // Canal messages liés à cette mission (artisan ↔ gestionnaire)
  canalMessages?: { auteur: string; role: string; texte: string; date: string }[]
  // Canal demandeur (copropriétaire / locataire / technicien → gestionnaire)
  demandeurNom?: string
  demandeurRole?: 'coproprio' | 'locataire' | 'technicien'
  demandeurEmail?: string
  demandeurMessages?: { auteur: string; role: string; texte: string; date: string }[]
  // Localisation demandeur (peut différer si technicien signale partie commune)
  zoneSignalee?: string       // ex: "Parties communes", "Cave", "Parking", "Toiture"
  estPartieCommune?: boolean
  trackingToken?: string   // Token de suivi GPS en temps réel
}

interface Alerte {
  id: string
  type: 'rc_pro' | 'controle' | 'budget' | 'mission' | 'document'
  message: string
  urgence: 'haute' | 'moyenne' | 'basse'
  date: string
}

interface PlanningEvent {
  id: string
  titre: string
  date: string        // YYYY-MM-DD
  heure: string       // HH:MM
  dureeMin: number
  type: 'reunion' | 'visite' | 'rdv' | 'tache' | 'autre'
  assigneA: string
  assigneRole: string
  description?: string
  creePar: string
  statut: 'planifie' | 'termine' | 'annule'
}

// ─── Données démo ─────────────────────────────────────────────────────────────

const IMMEUBLES_DEMO: Immeuble[] = []

const ARTISANS_DEMO: Artisan[] = []

const MISSIONS_DEMO: Mission[] = []

const ALERTES_DEMO: Alerte[] = []

// ─── Équipe démo (utilisée pour l'assignation planning) ──────────────────────

const EQUIPE_NOMS_DEMO = [
  { nom: 'Toute l\'équipe', role: '' },
]

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  reunion: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  visite:  { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  rdv:     { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  tache:   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
  autre:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300' },
}

const PLANNING_EVENTS_DEMO: PlanningEvent[] = []

// ─── Composants UI ────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, sub, color = 'yellow' }: { emoji: string; label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    yellow: 'bg-amber-50 border-amber-200',
    purple: 'bg-purple-50 border-purple-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
  }
  return (
    <div className={`rounded-2xl border-2 p-5 ${colors[color] || colors.yellow}`}>
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function Badge({ statut }: { statut: Mission['statut'] }) {
  const map: Record<string, string> = {
    en_attente: 'bg-yellow-100 text-yellow-700',
    acceptee: 'bg-blue-100 text-blue-700',
    en_cours: 'bg-orange-100 text-orange-700',
    terminee: 'bg-green-100 text-green-700',
    annulee: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    en_attente: 'En attente', acceptee: 'Acceptée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[statut]}`}>{labels[statut]}</span>
}

function PrioriteBadge({ p }: { p: Mission['priorite'] }) {
  const map: Record<string, string> = {
    urgente: 'bg-red-100 text-red-700',
    normale: 'bg-blue-100 text-blue-700',
    planifiee: 'bg-gray-100 text-gray-600',
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[p]}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
}

// ─── Types Email Agent ─────────────────────────────────────────────────────────

interface EmailAnalysed {
  id: string
  gmail_message_id: string
  from_email: string
  from_name: string
  subject: string
  body_preview: string
  received_at: string
  urgence: 'haute' | 'moyenne' | 'basse'
  type_demande: string
  resume_ia: string
  immeuble_detecte: string | null
  locataire_detecte: string | null
  actions_suggerees: string[]
  reponse_suggeree: string | null
  statut: 'nouveau' | 'traite' | 'archive' | 'mission_cree'
  note_interne: string
}

const TYPE_EMAIL_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  signalement_panne: { emoji: '🔧', label: 'Signalement panne', color: 'bg-orange-100 text-orange-700' },
  demande_devis:     { emoji: '📝', label: 'Demande devis',      color: 'bg-blue-100 text-blue-700' },
  reclamation:       { emoji: '⚠️', label: 'Réclamation',        color: 'bg-red-100 text-red-700' },
  ag:                { emoji: '🔑', label: 'Assemblée générale', color: 'bg-indigo-100 text-indigo-700' },
  facturation:       { emoji: '💶', label: 'Facturation',        color: 'bg-green-100 text-green-700' },
  resiliation:       { emoji: '📤', label: 'Résiliation',        color: 'bg-pink-100 text-pink-700' },
  information:       { emoji: 'ℹ️', label: 'Information',        color: 'bg-gray-100 text-gray-600' },
  autre:             { emoji: '📄', label: 'Autre',              color: 'bg-gray-100 text-gray-500' },
}

// ─── Bouton connexion Gmail ────────────────────────────────────────────────────

function GmailConnectButton({ syndicId, userEmail }: { syndicId?: string; userEmail?: string }) {
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)

  useEffect(() => {
    // Vérifier si déjà connecté via URL params (après callback OAuth)
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_connected') === 'true') {
      setConnected(true)
      setGmailEmail(decodeURIComponent(params.get('email') || ''))
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('email_error')) {
      console.error('Gmail OAuth error:', params.get('email_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Vérifier si un token existe déjà en Supabase
    if (syndicId) {
      fetch(`/api/email-agent/poll?syndic_id=${syndicId}&limit=1`)
        .then(r => r.json())
        .then(data => {
          if (data.emails && data.emails.length >= 0) {
            // La table existe et contient des données → connexion active
            setConnected(true)
          }
        })
        .catch(() => {})
    }
  }, [syndicId])

  const handleConnect = async () => {
    if (!syndicId) return
    setLoading(true)
    // Récupérer le token de session pour l'envoyer à la route connect
    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    if (session?.access_token) {
      window.location.href = `/api/email-agent/connect?token=${session.access_token}`
    } else {
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">Gmail connecté</p>
            <p className="text-xs text-green-600">{gmailEmail || 'Boîte synchronisée · Analyse automatique active'}</p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          className="w-full text-xs text-gray-500 hover:text-red-500 transition py-1"
        >
          Reconnecter / Changer de compte
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-purple-400 text-gray-700 hover:text-purple-700 py-3 rounded-xl font-semibold transition disabled:opacity-60"
    >
      {loading ? (
        <span className="text-sm">Redirection vers Google...</span>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
            <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
            <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
            <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
          </svg>
          <span className="text-sm">Connecter ma boîte Gmail</span>
        </>
      )}
    </button>
  )
}

// ─── Canal Interne — données démo ─────────────────────────────────────────────

const CANAL_INTERNE_DEMO: CanalInterneMsg[] = []

// ─── Composant Équipe ─────────────────────────────────────────────────────────

const ROLE_LABELS_TEAM: Record<string, string> = {
  syndic_admin: 'Administrateur',
  syndic_tech: 'Gestionnaire Technique',
  syndic_secretaire: 'Secrétaire',
  syndic_gestionnaire: 'Gestionnaire Copropriété',
  syndic_comptable: 'Comptable',
}
const ROLE_COLORS: Record<string, string> = {
  syndic_admin: 'bg-purple-100 text-purple-800',
  syndic_tech: 'bg-blue-100 text-blue-800',
  syndic_secretaire: 'bg-green-100 text-green-800',
  syndic_gestionnaire: 'bg-yellow-100 text-yellow-800',
  syndic_comptable: 'bg-orange-100 text-orange-800',
}
const ROLE_EMOJIS_TEAM: Record<string, string> = {
  syndic_admin: '👑',
  syndic_tech: '🔧',
  syndic_secretaire: '📋',
  syndic_gestionnaire: '🏢',
  syndic_comptable: '💶',
}

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  invite_token: string | null
  invite_sent_at: string | null
  accepted_at: string | null
  is_active: boolean
  created_at: string
}

function EquipeSection({ cabinetId, currentUserRole }: { cabinetId: string; currentUserRole: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'syndic_tech' })
  const [submitting, setSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isAdmin = currentUserRole === 'syndic' || currentUserRole === 'syndic_admin'

  const fetchTeam = async () => {
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/syndic/team', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMembers(data.members || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTeam() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/syndic/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: form.email, full_name: form.full_name, memberRole: form.role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      setInviteUrl(data.invite_url)
      setForm({ email: '', full_name: '', role: 'syndic_tech' })
      setShowForm(false)
      fetchTeam()
    } catch { setError('Erreur réseau') }
    finally { setSubmitting(false) }
  }

  const handleToggleActive = async (member: TeamMember) => {
    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    await fetch('/api/syndic/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ member_id: member.id, is_active: !member.is_active }),
    })
    fetchTeam()
  }

  const handleDelete = async (memberId: string) => {
    if (!confirm('Supprimer ce membre ?')) return
    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    await fetch(`/api/syndic/team?member_id=${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    fetchTeam()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 Mon Équipe</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} membre{members.length > 1 ? 's' : ''} dans votre cabinet</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition flex items-center gap-2"
          >
            + Inviter un membre
          </button>
        )}
      </div>

      {/* Lien d'invitation */}
      {inviteUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">✅ Invitation créée ! Partagez ce lien :</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-xs text-gray-700 truncate">{inviteUrl}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(inviteUrl); alert('Lien copié !') }}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition"
            >
              Copier
            </button>
          </div>
          <button onClick={() => setInviteUrl(null)} className="text-xs text-gray-500 mt-2 hover:text-gray-600">Fermer</button>
        </div>
      )}

      {/* Formulaire invitation */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Inviter un nouveau membre</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom et Nom</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jean Dupont"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jean@cabinet.fr"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {Object.entries(ROLE_LABELS_TEAM).map(([val, label]) => (
                  <option key={val} value={val}>{ROLE_EMOJIS_TEAM[val]} {label}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-60"
              >
                {submitting ? 'Envoi...' : 'Créer l\'invitation'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste membres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {members.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-gray-500 font-medium">Aucun membre pour l'instant</p>
            <p className="text-sm text-gray-500 mt-1">Invitez votre équipe pour collaborer</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center text-lg">
                        {ROLE_EMOJIS_TEAM[m.role] || '👤'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{m.full_name}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_LABELS_TEAM[m.role] || m.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {m.accepted_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" /> En attente
                      </span>
                    )}
                    {!m.is_active && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        Suspendu
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {!m.accepted_at && m.invite_token && (
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/syndic/invite?token=${m.invite_token}`
                              navigator.clipboard.writeText(url)
                              alert('Lien copié !')
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                          >
                            Copier lien
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`text-xs px-2 py-1 rounded border transition ${m.is_active ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                        >
                          {m.is_active ? 'Suspendre' : 'Réactiver'}
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Description des rôles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Description des rôles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { role: 'syndic_admin', desc: 'Accès complet : gestion, configuration, équipe, facturation' },
            { role: 'syndic_tech', desc: 'Missions, artisans, planning, comptabilité technique des interventions' },
            { role: 'syndic_secretaire', desc: 'Copropriétaires, planning, emails, documents' },
            { role: 'syndic_gestionnaire', desc: 'Immeubles, missions, artisans, alertes, calendrier réglementaire' },
            { role: 'syndic_comptable', desc: 'Facturation, rapport mensuel, documents financiers' },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
              <span className="text-xl">{ROLE_EMOJIS_TEAM[role]}</span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{ROLE_LABELS_TEAM[role]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Composant Analyse Devis / Factures ───────────────────────────────────────

interface DevisExtracted {
  artisan_nom?: string
  artisan_metier?: string
  type_document?: string
  description_travaux?: string
  immeuble?: string
  montant_ht?: number
  montant_ttc?: number
  date_intervention?: string
  artisan_email?: string
  artisan_telephone?: string
  priorite?: 'urgente' | 'normale' | 'planifiee'
}

type InputMode = 'drop' | 'paste'

function AnalyseDevisSection({ artisans, setPage, missions, setMissions, user }: { artisans: Artisan[]; setPage: (p: Page) => void; missions: Mission[]; setMissions: React.Dispatch<React.SetStateAction<Mission[]>>; user: any }) {
  const [mode, setMode] = useState<'main' | 'history'>('main')
  const [inputMode, setInputMode] = useState<InputMode>('drop')
  const [docText, setDocText] = useState('')
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false) // extraction PDF en cours
  const [pdfReady, setPdfReady] = useState(false)     // PDF extrait, prêt à analyser
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<DevisExtracted | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<{ id: string; filename: string; date: string; verdict: string; score: string; analysis: string; extracted?: DevisExtracted }[]>([])
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)
  // Modal création mission
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [missionForm, setMissionForm] = useState({
    artisan: '', immeuble: '', adresseImmeuble: '', batiment: '', etage: '', numLot: '',
    locataire: '', telephoneLocataire: '', accesLogement: '',
    type: '', description: '',
    priorite: 'normale' as 'urgente' | 'normale' | 'planifiee',
    montantDevis: 0, dateIntervention: '',
  })
  const [missionCreating, setMissionCreating] = useState(false)
  const [missionSuccess, setMissionSuccess] = useState(false)

  // Charger l'historique depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vitfix_analyse_devis_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  // ── Extraction PDF ──────────────────────────────────────────────────────────
  const handleFileDrop = async (file: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setError('')
    setExtracting(true)
    setPdfReady(false)
    setDocText('')
    setFilename(file.name)
    setAnalysis(null)
    setExtracted(null)
    setMissionSuccess(false)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/syndic/extract-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.isScanned) {
          // PDF scanné → basculer en mode texte avec message explicatif
          setError('Ce PDF est un document scanné (image). Veuillez copier-coller le texte manuellement dans l\'onglet "Saisir le texte".')
          setInputMode('paste')
        } else if (data.isPasswordProtected) {
          setError('Ce PDF est protégé par un mot de passe. Déverrouillez-le d\'abord (ouvrez-le, allez dans Fichier → Exporter/Enregistrer sous sans mot de passe), puis réessayez.')
        } else if (data.isCorrupt) {
          setError('Ce fichier PDF semble corrompu ou invalide. Essayez de l\'ouvrir dans un lecteur PDF et de le ré-exporter.')
        } else {
          setError(data.error || 'Erreur lors de l\'extraction du PDF. Réessayez ou utilisez l\'onglet "Saisir le texte".')
        }
        return
      }
      setDocText(data.text)
      setPdfReady(true)
    } catch {
      setError('Erreur réseau lors de l\'extraction')
    } finally {
      setExtracting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileDrop(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileDrop(file)
    // Reset l'input pour pouvoir re-déposer le même fichier
    e.target.value = ''
  }

  const saveToHistory = (fname: string, result: string, ext?: DevisExtracted) => {
    const verdictMatch = result.match(/\*\*Statut\*\*\s*:\s*([^\n]+)/)
    const scoreMatch = result.match(/\*\*Score de conformité\*\*\s*:\s*([^\n]+)/)
    const entry = {
      id: Date.now().toString(),
      filename: fname || 'Document sans nom',
      date: new Date().toLocaleDateString('fr-FR'),
      verdict: verdictMatch ? verdictMatch[1].trim() : '—',
      score: scoreMatch ? scoreMatch[1].trim() : '—',
      analysis: result,
      extracted: ext,
    }
    const updated = [entry, ...history].slice(0, 20)
    setHistory(updated)
    try { localStorage.setItem('vitfix_analyse_devis_history', JSON.stringify(updated)) } catch {}
  }

  const handleAnalyse = async () => {
    if (!docText.trim() || loading) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    setExtracted(null)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/syndic/analyse-devis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ content: docText, filename }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur lors de l\'analyse'); return }
      setAnalysis(data.analysis)
      setExtracted(data.extracted || null)
      saveToHistory(filename || 'Document analysé', data.analysis, data.extracted)
    } catch {
      setError('Erreur réseau, veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setDocText('')
    setFilename('')
    setAnalysis(null)
    setExtracted(null)
    setError('')
    setPdfReady(false)
    setMissionSuccess(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Ouvrir le modal de création mission avec les données pré-remplies
  const handleOpenMissionModal = (ext: DevisExtracted) => {
    // Trouver l'artisan correspondant dans la liste (par nom ou email)
    const matchedArtisan = artisans.find(a => {
      if (ext.artisan_email && a.email?.toLowerCase() === ext.artisan_email.toLowerCase()) return true
      if (ext.artisan_nom && a.nom?.toLowerCase().includes(ext.artisan_nom.toLowerCase())) return true
      if (ext.artisan_nom && ext.artisan_nom.toLowerCase().includes(a.nom?.toLowerCase() || '')) return true
      return false
    })
    setMissionForm({
      artisan: matchedArtisan?.nom || ext.artisan_nom || '',
      immeuble: ext.immeuble || '',
      adresseImmeuble: '',
      batiment: '',
      etage: '',
      numLot: '',
      locataire: '',
      telephoneLocataire: '',
      accesLogement: '',
      type: ext.artisan_metier || '',
      description: ext.description_travaux || '',
      priorite: ext.priorite || 'normale',
      montantDevis: ext.montant_ht || 0,
      dateIntervention: ext.date_intervention || '',
    })
    setShowMissionModal(true)
  }

  // Créer la mission
  const handleCreateMission = async () => {
    if (!missionForm.artisan || !missionForm.description) return
    setMissionCreating(true)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      // Trouver l'artisan dans la liste pour récupérer son email
      const artisanObj = artisans.find(a => a.nom === missionForm.artisan)
      const artisanEmail = artisanObj?.email || ''

      const res = await fetch('/api/syndic/assign-mission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          artisan_email: artisanEmail,
          artisan_name: missionForm.artisan,
          description: missionForm.description,
          type: missionForm.type,
          immeuble: missionForm.immeuble,
          priorite: missionForm.priorite,
          montant_devis: missionForm.montantDevis,
          date_intervention: missionForm.dateIntervention || null,
          source: 'devis_analyse',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // ── Créer la mission locale avec message automatique dans le canal ──
        const newMissionId = `mission_${Date.now()}`
        const now = new Date()

        // Construire le message d'ordre de mission automatique
        const dateIntervStr = missionForm.dateIntervention
          ? new Date(missionForm.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : 'à définir'
        const localisationDetail = [
          missionForm.batiment ? `Bâtiment ${missionForm.batiment}` : null,
          missionForm.etage ? `Étage ${missionForm.etage}` : null,
          missionForm.numLot ? `Appartement / Lot ${missionForm.numLot}` : null,
        ].filter(Boolean).join(' · ')
        const locataireDetail = missionForm.locataire
          ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}`
          : ''
        const accesDetail = missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''

        const msgAuto = `📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${dateIntervStr}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

        const autoMsg = {
          auteur: 'Gestionnaire',
          role: 'syndic',
          texte: msgAuto,
          date: now.toISOString(),
        }

        const newMission: Mission = {
          id: newMissionId,
          immeuble: missionForm.immeuble,
          artisan: missionForm.artisan,
          type: missionForm.type || 'Intervention',
          description: missionForm.description,
          priorite: missionForm.priorite,
          statut: 'en_attente',
          dateCreation: now.toISOString(),
          dateIntervention: missionForm.dateIntervention || undefined,
          montantDevis: missionForm.montantDevis || undefined,
          batiment: missionForm.batiment || undefined,
          etage: missionForm.etage || undefined,
          numLot: missionForm.numLot || undefined,
          locataire: missionForm.locataire || undefined,
          telephoneLocataire: missionForm.telephoneLocataire || undefined,
          accesLogement: missionForm.accesLogement || undefined,
          canalMessages: [autoMsg],
        }

        // Stocker localement
        const updatedMissions = [newMission, ...missions]
        setMissions(updatedMissions)
        try {
          const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
          localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify([newMission, ...stored]))
        } catch {}

        // Stocker aussi dans une clé partagée accessible côté artisan
        try {
          const artisanKey = `canal_missions_${artisanObj?.artisan_user_id || missionForm.artisan.replace(/\s+/g, '_').toLowerCase()}`
          const artisanMissions = JSON.parse(localStorage.getItem(artisanKey) || '[]')
          artisanMissions.unshift(newMission)
          localStorage.setItem(artisanKey, JSON.stringify(artisanMissions))
        } catch {}

        setMissionSuccess(true)
        setShowMissionModal(false)
        // Reset form
        setMissionForm({
          artisan: '', immeuble: '', adresseImmeuble: '', batiment: '', etage: '', numLot: '',
          locataire: '', telephoneLocataire: '', accesLogement: '',
          type: '', description: '',
          priorite: 'normale',
          montantDevis: 0, dateIntervention: '',
        })
      } else {
        // Même sans API fonctionnelle, créer localement
        const newMissionId = `mission_${Date.now()}`
        const now = new Date()
        const dateIntervStr = missionForm.dateIntervention
          ? new Date(missionForm.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : 'à définir'
        const localisationDetail = [
          missionForm.batiment ? `Bâtiment ${missionForm.batiment}` : null,
          missionForm.etage ? `Étage ${missionForm.etage}` : null,
          missionForm.numLot ? `Appartement / Lot ${missionForm.numLot}` : null,
        ].filter(Boolean).join(' · ')
        const locataireDetail = missionForm.locataire
          ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}`
          : ''
        const accesDetail = missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''
        const msgAuto = `📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${dateIntervStr}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`
        const autoMsg = { auteur: 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }
        const newMission: Mission = {
          id: newMissionId,
          immeuble: missionForm.immeuble,
          artisan: missionForm.artisan,
          type: missionForm.type || 'Intervention',
          description: missionForm.description,
          priorite: missionForm.priorite,
          statut: 'en_attente',
          dateCreation: now.toISOString(),
          dateIntervention: missionForm.dateIntervention || undefined,
          montantDevis: missionForm.montantDevis || undefined,
          batiment: missionForm.batiment || undefined,
          etage: missionForm.etage || undefined,
          numLot: missionForm.numLot || undefined,
          locataire: missionForm.locataire || undefined,
          telephoneLocataire: missionForm.telephoneLocataire || undefined,
          accesLogement: missionForm.accesLogement || undefined,
          canalMessages: [autoMsg],
        }
        const updatedMissions = [newMission, ...missions]
        setMissions(updatedMissions)
        try {
          const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
          localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify([newMission, ...stored]))
        } catch {}
        setMissionSuccess(true)
        setShowMissionModal(false)
        setMissionForm({
          artisan: '', immeuble: '', adresseImmeuble: '', batiment: '', etage: '', numLot: '',
          locataire: '', telephoneLocataire: '', accesLogement: '',
          type: '', description: '',
          priorite: 'normale',
          montantDevis: 0, dateIntervention: '',
        })
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setMissionCreating(false)
    }
  }

  // Colorer le verdict
  const getVerdictColor = (verdict: string) => {
    if (verdict.includes('CONFORME') && !verdict.includes('PARTIELLEMENT') && !verdict.includes('NON')) return 'text-green-700 bg-green-50 border-green-200'
    if (verdict.includes('PARTIELLEMENT')) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    if (verdict.includes('NON CONFORME')) return 'text-red-700 bg-red-50 border-red-200'
    return 'text-gray-700 bg-gray-50 border-gray-200'
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔍 Analyse Devis &amp; Factures</h1>
          <p className="text-sm text-gray-500 mt-1">Conformité juridique · Benchmark prix marché · Prévention litiges</p>
        </div>
        <button
          onClick={() => setMode(mode === 'history' ? 'main' : 'history')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${mode === 'history' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          🕐 Historique ({history.length})
        </button>
      </div>

      {/* Bandeaux info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="font-semibold text-blue-900 text-sm">Conformité juridique</p>
            <p className="text-xs text-blue-600 mt-0.5">SIRET, TVA, RC Pro, garantie décennale</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-semibold text-green-900 text-sm">Benchmark prix marché</p>
            <p className="text-xs text-green-600 mt-0.5">Tarifs 2024-2025 par corps de métier</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">Prévention litiges</p>
            <p className="text-xs text-amber-600 mt-0.5">Détection des risques juridiques</p>
          </div>
        </div>
      </div>

      {/* ── MODE PRINCIPAL ── */}
      {mode === 'main' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Onglets PDF / Texte */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => { setInputMode('drop'); setError('') }}
                  className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${inputMode === 'drop' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  📄 Déposer un PDF
                </button>
                <button
                  onClick={() => { setInputMode('paste'); setError('') }}
                  className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${inputMode === 'paste' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  ✏️ Saisir le texte
                </button>
              </div>

              <div className="p-6 space-y-4">

                {/* ─ Zone Drop PDF ─ */}
                {inputMode === 'drop' && (
                  <div className="space-y-4">
                    {!pdfReady ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                          dragOver
                            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                            : extracting
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                        {extracting ? (
                          <div className="space-y-3">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="font-semibold text-blue-700">Extraction du texte en cours...</p>
                            <p className="text-sm text-blue-500">{filename}</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-6xl">📄</div>
                            <div>
                              <p className="text-lg font-bold text-gray-800">Glissez votre PDF ici</p>
                              <p className="text-sm text-gray-500 mt-1">ou cliquez pour sélectionner un fichier</p>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
                              📂 Choisir un PDF
                            </div>
                            <p className="text-xs text-gray-500">Devis, facture, bon de commande — max 20 Mo</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* PDF extrait et prêt */
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">✅</span>
                            <div>
                              <p className="font-semibold text-green-800 text-sm">{filename}</p>
                              <p className="text-xs text-green-600">{docText.length.toLocaleString('fr-FR')} caractères extraits · Prêt à analyser</p>
                            </div>
                          </div>
                          <button
                            onClick={handleReset}
                            className="text-sm text-gray-500 hover:text-red-500 transition"
                          >
                            Changer ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Zone Texte manuel ─ */}
                {inputMode === 'paste' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Nom du document <span className="font-normal text-gray-500">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        placeholder="ex : Devis plomberie Marc Fontaine — 24/02/2026"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Texte du document <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={docText}
                        onChange={e => setDocText(e.target.value)}
                        placeholder={"Collez ici le contenu du devis ou de la facture...\n\nEx :\nEntreprise Fontaine Plomberie SARL\nSIRET : 12345678901234\nDEVIS N° 2026-042 — Date : 24/02/2026\nRemplacement colonne eau chaude cave\n1 275,00 € HT — TVA 10% — Total TTC : 1 402,50 €\nRC Pro Allianz n°12345, valide jusqu'au 31/12/2026"}
                        rows={10}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono resize-y"
                      />
                      <p className="text-xs text-gray-500 mt-1">{docText.length} caractères</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-500 flex gap-2 items-start">
                      <span>💡</span>
                      <span>Pour extraire le texte d&apos;un PDF : ouvrir → Ctrl+A → Ctrl+C → coller ici. Pour un PDF scanné (image), utilisez Google Lens ou Adobe Acrobat.</span>
                    </div>
                  </div>
                )}

                {/* Erreur */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton analyser */}
                <button
                  onClick={handleAnalyse}
                  disabled={loading || extracting || docText.trim().length < 10}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition disabled:opacity-40 flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyse IA en cours...
                    </>
                  ) : (
                    <>🔍 Analyser le document</>
                  )}
                </button>
              </div>
            </div>

          ) : (
            /* ─ Résultat ─ */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  📊 Résultat {filename && <span className="font-normal text-gray-500 text-base">— {filename}</span>}
                </h2>
                <button onClick={handleReset} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                  ← Nouvelle analyse
                </button>
              </div>

              {/* Carte récap extraite + bouton mission */}
              {extracted && (extracted.artisan_nom || extracted.description_travaux) && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Informations extraites automatiquement</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                        {extracted.artisan_nom && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🔧</span>
                            <span className="text-gray-700"><strong>{extracted.artisan_nom}</strong>{extracted.artisan_metier ? ` — ${extracted.artisan_metier}` : ''}</span>
                          </div>
                        )}
                        {extracted.description_travaux && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">📋</span>
                            <span className="text-gray-700 truncate">{extracted.description_travaux}</span>
                          </div>
                        )}
                        {extracted.immeuble && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🏢</span>
                            <span className="text-gray-700">{extracted.immeuble}</span>
                          </div>
                        )}
                        {(extracted.montant_ht || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">💰</span>
                            <span className="text-gray-700">
                              <strong>{extracted.montant_ht?.toLocaleString('fr-FR')}€ HT</strong>
                              {(extracted.montant_ttc || 0) > 0 && <span className="text-gray-500"> / {extracted.montant_ttc?.toLocaleString('fr-FR')}€ TTC</span>}
                            </span>
                          </div>
                        )}
                        {extracted.date_intervention && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">📅</span>
                            <span className="text-gray-700">{new Date(extracted.date_intervention).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                        {extracted.priorite && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🚦</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              extracted.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
                              extracted.priorite === 'normale' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{extracted.priorite.charAt(0).toUpperCase() + extracted.priorite.slice(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {missionSuccess ? (
                        <div className="bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                          ✅ Mission créée !
                          <button onClick={() => setPage('missions')} className="underline text-green-800 hover:text-green-900 ml-1">Voir →</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenMissionModal(extracted)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 shadow-sm"
                        >
                          📋 Créer la mission
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }} />
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    const blob = new Blob([analysis], { type: 'text/plain; charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `analyse-${filename || 'devis'}-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                >
                  💾 Exporter
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(analysis).then(() => alert('Analyse copiée !'))}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                >
                  📋 Copier
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition"
                >
                  🔍 Analyser un autre
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE HISTORIQUE ── */}
      {mode === 'history' && (
        <div className="space-y-4">
          <button onClick={() => setMode('main')} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">← Retour</button>
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
              <div className="text-4xl mb-3">📂</div>
              <p className="font-semibold text-gray-700">Aucune analyse enregistrée</p>
              <p className="text-sm text-gray-500 mt-1">Lancez votre première analyse pour la retrouver ici</p>
            </div>
          ) : selectedHistory ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedHistory(null)} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                ← Retour à l&apos;historique
              </button>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: formatAnalysis(history.find(h => h.id === selectedHistory)?.analysis || '') }} />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <p className="font-medium text-gray-900 text-sm">{h.filename}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{h.date}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">{h.score}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getVerdictColor(h.verdict)}`}>
                          {h.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => setSelectedHistory(h.id)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Voir →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal création mission ── */}
      {showMissionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">📋 Nouvel ordre de mission</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Un message automatique sera envoyé à l'artisan dans le canal de la mission</p>
                </div>
                <button onClick={() => setShowMissionModal(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Section artisan + type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Artisan prestataire <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={missionForm.artisan}
                    onChange={e => setMissionForm(f => ({ ...f, artisan: e.target.value }))}
                    list="artisans-list-devis"
                    placeholder="Nom de l'artisan"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                  <datalist id="artisans-list-devis">
                    {artisans.map(a => <option key={a.id} value={a.nom} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type de travaux</label>
                  <input
                    type="text"
                    value={missionForm.type}
                    onChange={e => setMissionForm(f => ({ ...f, type: e.target.value }))}
                    placeholder="ex : Plomberie, Électricité…"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Section localisation */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📍 Localisation de l&apos;intervention</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la résidence <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={missionForm.immeuble}
                      onChange={e => setMissionForm(f => ({ ...f, immeuble: e.target.value }))}
                      placeholder="ex : Résidence Les Pins"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse complète</label>
                    <input
                      type="text"
                      value={missionForm.adresseImmeuble}
                      onChange={e => setMissionForm(f => ({ ...f, adresseImmeuble: e.target.value }))}
                      placeholder="12 rue de la Paix, 75001 Paris"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bâtiment</label>
                    <input
                      type="text"
                      value={missionForm.batiment}
                      onChange={e => setMissionForm(f => ({ ...f, batiment: e.target.value }))}
                      placeholder="ex : A, B, C…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Étage</label>
                    <input
                      type="text"
                      value={missionForm.etage}
                      onChange={e => setMissionForm(f => ({ ...f, etage: e.target.value }))}
                      placeholder="ex : 2, RDC…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Appartement / N° lot</label>
                    <input
                      type="text"
                      value={missionForm.numLot}
                      onChange={e => setMissionForm(f => ({ ...f, numLot: e.target.value }))}
                      placeholder="ex : 12, 4B…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Locataire / Occupant</label>
                    <input
                      type="text"
                      value={missionForm.locataire}
                      onChange={e => setMissionForm(f => ({ ...f, locataire: e.target.value }))}
                      placeholder="Nom du locataire (optionnel)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone locataire</label>
                    <input
                      type="tel"
                      value={missionForm.telephoneLocataire}
                      onChange={e => setMissionForm(f => ({ ...f, telephoneLocataire: e.target.value }))}
                      placeholder="06 XX XX XX XX"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">🔑 Instructions d&apos;accès</label>
                  <input
                    type="text"
                    value={missionForm.accesLogement}
                    onChange={e => setMissionForm(f => ({ ...f, accesLogement: e.target.value }))}
                    placeholder="ex : Clé chez gardien, code portail 1234…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
                  />
                </div>
              </div>

              {/* Motif + date + priorité */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Motif / Description de l&apos;intervention <span className="text-red-500">*</span></label>
                <textarea
                  value={missionForm.description}
                  onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Décrivez précisément les travaux à effectuer…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date d&apos;intervention</label>
                  <input
                    type="date"
                    value={missionForm.dateIntervention}
                    onChange={e => setMissionForm(f => ({ ...f, dateIntervention: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priorité</label>
                  <select
                    value={missionForm.priorite}
                    onChange={e => setMissionForm(f => ({ ...f, priorite: e.target.value as 'urgente' | 'normale' | 'planifiee' }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  >
                    <option value="urgente">🔴 Urgente</option>
                    <option value="normale">🔵 Normale</option>
                    <option value="planifiee">⚪ Planifiée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Montant devis (€ HT)</label>
                  <input
                    type="number"
                    value={missionForm.montantDevis || ''}
                    onChange={e => setMissionForm(f => ({ ...f, montantDevis: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Aperçu du message automatique */}
              {missionForm.artisan && missionForm.immeuble && missionForm.description && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">👁️ Aperçu du message automatique envoyé à l&apos;artisan</p>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto leading-relaxed">
                    {`📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ') ? `\n📌 ${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ')}` : ''}${missionForm.locataire ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}` : ''}${missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${missionForm.dateIntervention ? new Date(missionForm.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'à définir'}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={handleCreateMission}
                disabled={missionCreating || !missionForm.artisan || !missionForm.description || !missionForm.immeuble}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {missionCreating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création en cours...</>
                ) : '📤 Créer l\'ordre de mission + envoyer dans le canal'}
              </button>
              <button
                onClick={() => setShowMissionModal(false)}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Convertit le markdown Groq en HTML lisible (table, bold, headers)
function formatAnalysis(text: string): string {
  if (!text) return ''
  let html = text
    // Échapper les balises HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers ##
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-6 mb-2 border-b border-gray-100 pb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-gray-800 mt-4 mb-1">$1</h3>')
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic *text*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Tables (simple)
    .replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim())
      const isHeader = cells.some(c => c.match(/^[-:]+$/))
      if (isHeader) return ''
      const tag = 'td'
      const tdCells = cells.map(c => `<${tag} class="px-3 py-2 border border-gray-200 text-sm">${c}</${tag}>`).join('')
      return `<tr>${tdCells}</tr>`
    })
    // Wrap table rows (remplace les <tr> consécutifs par un tableau)
    .split(/(<tr>(?:[^<]|<(?!\/tr>))*<\/tr>)/)
    .map((chunk, i, arr) => chunk)
    .join('')
    .replace(/(<tr>[^]*?<\/tr>)+/g, (match) =>
      `<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden"><tbody>${match}</tbody></table></div>`
    )
    // Line items with ✅ ❌ ⚠️ 🔴 🟡 🟢
    .replace(/^([✅❌⚠️🔴🟡🟢🔍💰🛡️📋🏷️]) (.+)$/gm, (_, emoji, rest) =>
      `<div class="flex items-start gap-2 py-0.5"><span class="text-base flex-shrink-0">${emoji}</span><span class="text-sm text-gray-700">${rest}</span></div>`
    )
    // Horizontal rule ---
    .replace(/^---$/gm, '<hr class="my-4 border-gray-100" />')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br />')

  return `<p class="mb-2">${html}</p>`
}

// ─── Composant Documents Interventions ────────────────────────────────────────

interface DocIntervention {
  id: string
  mission_id?: string
  artisan_nom: string
  artisan_metier: string
  immeuble: string
  date_intervention: string
  type: 'facture' | 'devis' | 'rapport' | 'photo' | 'autre'
  filename: string
  url: string
  envoye_compta: boolean
  envoye_compta_at?: string
  notes?: string
  montant?: number
}

function DocsInterventionsSection({ artisans, setPage }: { artisans: Artisan[]; setPage: (p: Page) => void }) {
  const [docs, setDocs] = useState<DocIntervention[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<'all' | 'envoye' | 'non_envoye'>('all')
  const [filterArtisan, setFilterArtisan] = useState<string>('all')
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    artisan_nom: '', artisan_metier: '', immeuble: '',
    date_intervention: new Date().toISOString().split('T')[0],
    type: 'facture' as DocIntervention['type'],
    notes: '', montant: '',
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [sendingCompta, setSendingCompta] = useState<string | null>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)

  // Charger depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vitfix_docs_interventions')
      if (saved) setDocs(JSON.parse(saved))
    } catch {}
  }, [])

  const saveDocs = (updated: DocIntervention[]) => {
    setDocs(updated)
    try { localStorage.setItem('vitfix_docs_interventions', JSON.stringify(updated)) } catch {}
  }

  // Upload document
  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.artisan_nom || !uploadForm.immeuble) return
    setUploading(true)
    setUploadError('')
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('bucket', 'artisan-documents')
      form.append('folder', 'syndic-interventions')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error || 'Erreur upload'); return }

      const newDoc: DocIntervention = {
        id: Date.now().toString(),
        artisan_nom: uploadForm.artisan_nom,
        artisan_metier: uploadForm.artisan_metier,
        immeuble: uploadForm.immeuble,
        date_intervention: uploadForm.date_intervention,
        type: uploadForm.type,
        filename: uploadFile.name,
        url: data.url,
        envoye_compta: false,
        notes: uploadForm.notes,
        montant: uploadForm.montant ? parseFloat(uploadForm.montant) : undefined,
      }
      saveDocs([newDoc, ...docs])
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadForm({ artisan_nom: '', artisan_metier: '', immeuble: '', date_intervention: new Date().toISOString().split('T')[0], type: 'facture', notes: '', montant: '' })
    } catch { setUploadError('Erreur réseau') }
    finally { setUploading(false) }
  }

  // Marquer comme envoyé à la comptabilité
  const handleEnvoyerCompta = async (doc: DocIntervention) => {
    setSendingCompta(doc.id)
    // Simuler envoi (dans une vraie app : envoyer email/notification à syndic_comptable)
    await new Promise(r => setTimeout(r, 800))
    const updated = docs.map(d => d.id === doc.id
      ? { ...d, envoye_compta: true, envoye_compta_at: new Date().toISOString() }
      : d
    )
    saveDocs(updated)
    setSendingCompta(null)
  }

  // Annuler l'envoi
  const handleAnnulerEnvoi = (docId: string) => {
    const updated = docs.map(d => d.id === docId ? { ...d, envoye_compta: false, envoye_compta_at: undefined } : d)
    saveDocs(updated)
  }

  // Supprimer
  const handleDelete = (docId: string) => {
    if (!confirm('Supprimer ce document ?')) return
    saveDocs(docs.filter(d => d.id !== docId))
  }

  // Filtres
  const filtered = docs.filter(d => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase()) &&
        !d.artisan_nom.toLowerCase().includes(search.toLowerCase()) &&
        !d.immeuble.toLowerCase().includes(search.toLowerCase()) &&
        !d.notes?.toLowerCase().includes(search.toLowerCase()) &&
        !d.artisan_metier.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType !== 'all' && d.type !== filterType) return false
    if (filterStatut === 'envoye' && !d.envoye_compta) return false
    if (filterStatut === 'non_envoye' && d.envoye_compta) return false
    if (filterArtisan !== 'all' && d.artisan_nom !== filterArtisan) return false
    return true
  })

  const typeConfig: Record<string, { emoji: string; label: string; color: string }> = {
    facture:  { emoji: '🧾', label: 'Facture',  color: 'bg-green-100 text-green-700' },
    devis:    { emoji: '📝', label: 'Devis',    color: 'bg-blue-100 text-blue-700' },
    rapport:  { emoji: '📋', label: 'Rapport',  color: 'bg-purple-100 text-purple-700' },
    photo:    { emoji: '📷', label: 'Photo',    color: 'bg-orange-100 text-orange-700' },
    autre:    { emoji: '📄', label: 'Autre',    color: 'bg-gray-100 text-gray-600' },
  }

  const artisansList = Array.from(new Set(docs.map(d => d.artisan_nom))).filter(Boolean)

  const stats = {
    total: docs.length,
    envoyes: docs.filter(d => d.envoye_compta).length,
    nonEnvoyes: docs.filter(d => !d.envoye_compta).length,
    factures: docs.filter(d => d.type === 'facture').length,
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗂️ Documents Interventions</h1>
          <p className="text-sm text-gray-500 mt-1">Factures · Devis · Rapports · Photos — Transmission comptabilité</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition flex items-center gap-2"
        >
          + Ajouter un document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total documents</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.nonEnvoyes}</div>
          <div className="text-xs text-red-500 mt-1">Non transmis compta</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.envoyes}</div>
          <div className="text-xs text-green-500 mt-1">Transmis comptabilité</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.factures}</div>
          <div className="text-xs text-blue-500 mt-1">Factures</div>
        </div>
      </div>

      {/* Filtres rapides — Pastilles rouge/vert */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatut('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition ${filterStatut === 'all' ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
        >
          🔄 Tous
          <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{docs.length}</span>
        </button>
        <button
          onClick={() => setFilterStatut('non_envoye')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition ${filterStatut === 'non_envoye' ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-700 hover:border-red-400'}`}
        >
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block" />
          À envoyer
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filterStatut === 'non_envoye' ? 'bg-white/20 text-white' : 'bg-red-200 text-red-700'}`}>{stats.nonEnvoyes}</span>
        </button>
        <button
          onClick={() => setFilterStatut('envoye')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition ${filterStatut === 'envoye' ? 'border-green-600 bg-green-600 text-white' : 'border-green-200 bg-green-50 text-green-700 hover:border-green-400'}`}
        >
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
          Envoyés &amp; classés
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filterStatut === 'envoye' ? 'bg-white/20 text-white' : 'bg-green-200 text-green-700'}`}>{stats.envoyes}</span>
        </button>
      </div>

      {/* Filtres avancés */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-3 flex-wrap items-center">
          {/* Recherche */}
          <div className="flex-1 min-w-64 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par artisan, immeuble, fichier, notes..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          {/* Type */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">📄 Tous types</option>
            <option value="facture">🧾 Factures</option>
            <option value="devis">📝 Devis</option>
            <option value="rapport">📋 Rapports</option>
            <option value="photo">📷 Photos</option>
            <option value="autre">📄 Autres</option>
          </select>
          {/* Artisan */}
          <select
            value={filterArtisan}
            onChange={e => setFilterArtisan(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">👷 Tous artisans</option>
            {artisansList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* Reset */}
          {(search || filterType !== 'all' || filterStatut !== 'all' || filterArtisan !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterType('all'); setFilterStatut('all'); setFilterArtisan('all') }}
              className="px-3 py-2.5 text-sm text-gray-500 hover:text-red-500 transition"
            >
              ✕ Effacer tout
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">{filtered.length} document{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</p>
      </div>

      {/* Liste documents */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="font-semibold text-gray-700">{docs.length === 0 ? 'Aucun document' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-500 mt-1">{docs.length === 0 ? 'Ajoutez des factures, devis et rapports d\'intervention' : 'Modifiez vos filtres de recherche'}</p>
          {docs.length === 0 && (
            <button onClick={() => setShowUploadModal(true)} className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition">
              + Ajouter un document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <div
              key={doc.id}
              className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition ${
                doc.envoye_compta ? 'border-green-200' : 'border-red-200'
              }`}
            >
              {/* Barre de statut colorée en haut */}
              <div className={`h-1.5 w-full ${doc.envoye_compta ? 'bg-green-500' : 'bg-red-500'}`} />

              <div className="flex items-start gap-4 p-5">
                {/* Indicateur pastille + type */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-50 border border-gray-100">
                    {typeConfig[doc.type]?.emoji || '📄'}
                  </div>
                  {/* Pastille rouge/vert */}
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow ${doc.envoye_compta ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} title={doc.envoye_compta ? 'Envoyé à la comptabilité' : 'À envoyer à la comptabilité'} />
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{doc.filename}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeConfig[doc.type]?.color}`}>
                      {typeConfig[doc.type]?.label}
                    </span>
                    {/* Badge transmission */}
                    {doc.envoye_compta ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                        ✅ Classé — Transmis compta
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
                        🔴 À envoyer
                      </span>
                    )}
                    {doc.montant && (
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        {doc.montant.toLocaleString('fr-FR')}€ HT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span>🔧 {doc.artisan_nom}{doc.artisan_metier ? ` — ${doc.artisan_metier}` : ''}</span>
                    <span>🏢 {doc.immeuble}</span>
                    <span>📅 {new Date(doc.date_intervention).toLocaleDateString('fr-FR')}</span>
                    {doc.envoye_compta_at && (
                      <span className="text-green-600">✅ transmis le {new Date(doc.envoye_compta_at).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic truncate">💬 {doc.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Ouvrir */}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Ouvrir"
                  >
                    👁️
                  </a>

                  {/* Analyser (si facture/devis) */}
                  {(doc.type === 'facture' || doc.type === 'devis') && (
                    <button
                      onClick={() => setPage('analyse_devis')}
                      className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      title="Analyser avec IA"
                    >
                      🔍
                    </button>
                  )}

                  {/* Envoyer / Annuler compta */}
                  {!doc.envoye_compta ? (
                    <button
                      onClick={() => handleEnvoyerCompta(doc)}
                      disabled={sendingCompta === doc.id}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-60"
                      title="Envoyer à la comptabilité"
                    >
                      {sendingCompta === doc.id ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : '📤'}
                      Envoyer compta
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAnnulerEnvoi(doc.id)}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      title="Annuler l'envoi"
                    >
                      ↩️ Annuler
                    </button>
                  )}

                  {/* Supprimer */}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ajout document ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900">📎 Ajouter un document</h3>
                <p className="text-sm text-gray-500 mt-0.5">Facture, devis, rapport ou photo d&apos;intervention</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Fichier */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fichier <span className="text-red-500">*</span></label>
                <div
                  onClick={() => uploadFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${uploadFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}
                >
                  <input
                    ref={uploadFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <div className="text-3xl">✅</div>
                      <p className="font-semibold text-green-700 text-sm">{uploadFile.name}</p>
                      <p className="text-xs text-green-500">{(uploadFile.size / 1024).toFixed(0)} Ko · Cliquer pour changer</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-3xl">📎</div>
                      <p className="text-sm text-gray-600">Glissez ou cliquez pour choisir</p>
                      <p className="text-xs text-gray-500">PDF, JPG, PNG — max 10 Mo</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Type de document</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(typeConfig) as [DocIntervention['type'], typeof typeConfig[string]][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setUploadForm(f => ({ ...f, type: k }))}
                      className={`py-2.5 rounded-xl text-center transition border-2 ${uploadForm.type === k ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="text-xl">{v.emoji}</div>
                      <div className="text-xs mt-0.5 font-medium text-gray-600">{v.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Artisan <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uploadForm.artisan_nom}
                    onChange={e => setUploadForm(f => ({ ...f, artisan_nom: e.target.value }))}
                    list="artisans-docs-list"
                    placeholder="Nom de l'artisan"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                  <datalist id="artisans-docs-list">
                    {artisans.map(a => <option key={a.id} value={a.nom} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Métier</label>
                  <input
                    type="text"
                    value={uploadForm.artisan_metier}
                    onChange={e => setUploadForm(f => ({ ...f, artisan_metier: e.target.value }))}
                    placeholder="ex: Plomberie"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Immeuble <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={uploadForm.immeuble}
                    onChange={e => setUploadForm(f => ({ ...f, immeuble: e.target.value }))}
                    placeholder="Résidence / adresse"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date intervention</label>
                  <input
                    type="date"
                    value={uploadForm.date_intervention}
                    onChange={e => setUploadForm(f => ({ ...f, date_intervention: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Montant HT (€)</label>
                  <input
                    type="number"
                    value={uploadForm.montant}
                    onChange={e => setUploadForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={uploadForm.notes}
                    onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Commentaire..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {uploadError}</div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadForm.artisan_nom || !uploadForm.immeuble}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Upload...</> : '📤 Ajouter le document'}
              </button>
              <button onClick={() => setShowUploadModal(false)} className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant Comptabilité Technique ─────────────────────────────────────────

function ComptabiliteTechSection({
  missions,
  artisans,
  immeubles,
}: {
  missions: Mission[]
  artisans: Artisan[]
  immeubles: Immeuble[]
}) {
  const [filterArtisan, setFilterArtisan] = useState('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<'all' | '30' | '90' | '365'>('all')

  const now = new Date()

  const filteredMissions = missions.filter(m => {
    if (filterArtisan && m.artisan !== filterArtisan) return false
    if (filterImmeuble && m.immeuble !== filterImmeuble) return false
    if (filterStatut && m.statut !== filterStatut) return false
    if (filterPeriod !== 'all' && m.dateIntervention) {
      const days = parseInt(filterPeriod)
      const mDate = new Date(m.dateIntervention)
      const diffDays = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > days) return false
    }
    return true
  })

  const totalMontant = filteredMissions.reduce((s, m) => s + (m.montantDevis || 0), 0)
  const terminees = filteredMissions.filter(m => m.statut === 'terminee').length
  const enCours = filteredMissions.filter(m => m.statut === 'en_cours').length

  // Regroupement par artisan
  const byArtisan = filteredMissions.reduce<Record<string, { count: number; montant: number; missions: Mission[] }>>(
    (acc, m) => {
      const key = m.artisan || 'Non assigné'
      if (!acc[key]) acc[key] = { count: 0, montant: 0, missions: [] }
      acc[key].count++
      acc[key].montant += m.montantDevis || 0
      acc[key].missions.push(m)
      return acc
    }, {}
  )

  // Regroupement par immeuble
  const byImmeuble = filteredMissions.reduce<Record<string, { count: number; montant: number }>>(
    (acc, m) => {
      const key = m.immeuble || 'Non défini'
      if (!acc[key]) acc[key] = { count: 0, montant: 0 }
      acc[key].count++
      acc[key].montant += m.montantDevis || 0
      return acc
    }, {}
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📊 Comptabilité Technique</h1>
        <p className="text-sm text-gray-500 mt-1">Suivi des interventions par artisan, copropriété et période</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Artisan</label>
            <select
              value={filterArtisan}
              onChange={e => setFilterArtisan(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Tous les artisans</option>
              {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Immeuble</label>
            <select
              value={filterImmeuble}
              onChange={e => setFilterImmeuble(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Tous les immeubles</option>
              {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="terminee">Terminée</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as typeof filterPeriod)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">Toute la période</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">12 derniers mois</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Interventions', value: filteredMissions.length, icon: '📋', color: 'bg-blue-50 border-blue-100' },
          { label: 'Terminées', value: terminees, icon: '✅', color: 'bg-green-50 border-green-100' },
          { label: 'En cours', value: enCours, icon: '⚙️', color: 'bg-yellow-50 border-yellow-100' },
          { label: 'Montant total', value: `${totalMontant.toLocaleString('fr-FR')} €`, icon: '💶', color: 'bg-purple-50 border-purple-100' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.color} border rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Répartition par artisan */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Par artisan</h3>
        {Object.keys(byArtisan).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Aucune intervention pour les filtres sélectionnés</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Artisan</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Missions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Montant</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Moy./mission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byArtisan).sort((a, b) => b[1].montant - a[1].montant).map(([name, stats]) => (
                  <tr key={name} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{stats.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{stats.montant.toLocaleString('fr-FR')} €</td>
                    <td className="px-4 py-3 text-right text-gray-500">{stats.count > 0 ? Math.round(stats.montant / stats.count).toLocaleString('fr-FR') : 0} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-center font-bold">{filteredMissions.length}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700">{totalMontant.toLocaleString('fr-FR')} €</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Répartition par immeuble */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Par immeuble / copropriété</h3>
        {Object.keys(byImmeuble).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Aucune données</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byImmeuble).sort((a, b) => b[1].montant - a[1].montant).map(([imm, stats]) => {
              const pct = totalMontant > 0 ? Math.round(stats.montant / totalMontant * 100) : 0
              return (
                <div key={imm} className="flex items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{imm}</p>
                    <p className="text-xs text-gray-500">{stats.count} mission{stats.count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-sm font-semibold text-gray-900 w-28 text-right">
                    {stats.montant.toLocaleString('fr-FR')} €
                  </div>
                  <div className="text-xs text-gray-500 w-10 text-right">{pct}%</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Liste détaillée */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Détail des interventions ({filteredMissions.length})</h3>
        {filteredMissions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Aucune intervention</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Immeuble</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Artisan</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Priorité</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Statut</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMissions.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition">
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                      {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900">{m.immeuble}</td>
                    <td className="px-3 py-3 text-gray-600">{m.type}</td>
                    <td className="px-3 py-3 text-gray-600">{m.artisan || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
                        m.priorite === 'planifiee' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{m.priorite}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.statut === 'terminee' ? 'bg-green-100 text-green-700' :
                        m.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{m.statut.replace('_', ' ')}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">
                      {m.montantDevis ? `${m.montantDevis.toLocaleString('fr-FR')} €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composant Emails Section ──────────────────────────────────────────────────

function EmailsSection({ syndicId, onNavigateParams }: { syndicId: string; onNavigateParams: () => void }) {
  const [emails, setEmails] = useState<EmailAnalysed[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [filterUrgence, setFilterUrgence] = useState<'' | 'haute' | 'moyenne' | 'basse'>('')
  const [filterType, setFilterType] = useState('')
  const [filterStatut, setFilterStatut] = useState<'' | 'nouveau' | 'traite' | 'archive'>('')
  const [selectedEmail, setSelectedEmail] = useState<EmailAnalysed | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'liste' | 'rapport'>('liste')

  const loadEmails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ syndic_id: syndicId, limit: '100' })
      if (filterUrgence) params.set('urgence', filterUrgence)
      if (filterStatut) params.set('statut', filterStatut)
      const res = await fetch(`/api/email-agent/poll?${params}`)
      const data = await res.json()
      setEmails(data.emails || [])
    } catch {
      // Table probablement pas encore créée — afficher état vide
      setEmails([])
    }
    setLoading(false)
  }

  useEffect(() => { loadEmails() }, [filterUrgence, filterStatut])

  const handlePoll = async () => {
    setPolling(true)
    try {
      await fetch('/api/email-agent/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndic_id: syndicId }),
      })
      await loadEmails()
    } catch {}
    setPolling(false)
  }

  const handleAction = async (emailId: string, action: string, note?: string) => {
    await fetch('/api/email-agent/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: emailId, syndic_id: syndicId, action, note }),
    })
    setSelectedEmail(null)
    await loadEmails()
  }

  const filtered = emails.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !search || [e.subject, e.from_email, e.from_name, e.resume_ia, e.immeuble_detecte || '', e.locataire_detecte || ''].some(v => v.toLowerCase().includes(q))
    const matchType = !filterType || e.type_demande === filterType
    return matchSearch && matchType
  })

  // Stats pour le rapport
  const stats = {
    total: emails.length,
    nouveaux: emails.filter(e => e.statut === 'nouveau').length,
    urgents: emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').length,
    traites: emails.filter(e => e.statut === 'traite').length,
    byType: Object.keys(TYPE_EMAIL_CONFIG).map(type => ({
      type, count: emails.filter(e => e.type_demande === type).length,
      ...TYPE_EMAIL_CONFIG[type]
    })).filter(t => t.count > 0),
  }

  const URGENCE_CONFIG = {
    haute:   { emoji: '🔴', label: 'Urgente',  color: 'bg-red-100 text-red-700 border-red-200' },
    moyenne: { emoji: '🟡', label: 'Moyenne',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
    basse:   { emoji: '🟢', label: 'Basse',    color: 'bg-green-100 text-green-700 border-green-200' },
  }

  const STATUT_CONFIG = {
    nouveau:      { label: 'Nouveau',      color: 'bg-blue-100 text-blue-700' },
    traite:       { label: 'Traité',       color: 'bg-green-100 text-green-700' },
    archive:      { label: 'Archivé',      color: 'bg-gray-100 text-gray-500' },
    mission_cree: { label: 'Mission créée', color: 'bg-purple-100 text-purple-700' },
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-gray-500 text-sm">
            Analyse IA de votre boîte email · <span className="font-semibold text-gray-700">{stats.total} emails</span>
            {stats.urgents > 0 && <span className="ml-2 font-bold text-red-600">· {stats.urgents} urgent{stats.urgents > 1 ? 's' : ''} non traité{stats.urgents > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button onClick={() => setActiveTab('liste')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'liste' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              📋 Liste
            </button>
            <button onClick={() => setActiveTab('rapport')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'rapport' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              📊 Rapport
            </button>
          </div>
          <button onClick={handlePoll} disabled={polling}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {polling ? <span className="animate-spin">⟳</span> : '⟳'} Analyser maintenant
          </button>
        </div>
      </div>

      {/* ── Bandeau si Gmail non connecté ── */}
      {!loading && emails.length === 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">📧</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Connectez votre boîte Gmail</h3>
          <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
            Max analysera automatiquement tous vos emails entrants — urgences, types de demandes, suggestions d'actions et brouillons de réponse.
          </p>
          <button onClick={onNavigateParams}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-semibold transition inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="white" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
            </svg>
            Connecter Gmail dans les Paramètres
          </button>
        </div>
      )}

      {activeTab === 'liste' && (
        <>
          {/* ── Stats rapides ── */}
          {emails.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Non traités', nb: stats.nouveaux, emoji: '📬', color: 'bg-blue-50 border-blue-200' },
                { label: 'Urgents',     nb: stats.urgents,  emoji: '🔴', color: stats.urgents > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200' },
                { label: 'Traités',     nb: stats.traites,  emoji: '✅', color: 'bg-green-50 border-green-200' },
                { label: 'Total',       nb: stats.total,    emoji: '📧', color: 'bg-purple-50 border-purple-200' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border-2 p-3 ${s.color}`}>
                  <div className="text-xl mb-0.5">{s.emoji}</div>
                  <div className="text-xl font-bold text-gray-900">{s.nb}</div>
                  <div className="text-xs text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filtres ── */}
          {emails.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex flex-wrap gap-3">
                {/* Recherche */}
                <div className="relative flex-1 min-w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher dans les emails..."
                    className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                {/* Urgence */}
                <select value={filterUrgence} onChange={e => setFilterUrgence(e.target.value as any)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  <option value="">Toutes urgences</option>
                  <option value="haute">🔴 Urgente</option>
                  <option value="moyenne">🟡 Moyenne</option>
                  <option value="basse">🟢 Basse</option>
                </select>
                {/* Type */}
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  <option value="">Tous types</option>
                  {Object.entries(TYPE_EMAIL_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
                {/* Statut */}
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as any)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  <option value="">Tous statuts</option>
                  <option value="nouveau">📬 Nouveaux</option>
                  <option value="traite">✅ Traités</option>
                  <option value="archive">📦 Archivés</option>
                </select>
                {/* Compteur */}
                <div className="flex items-center text-sm text-gray-500 ml-auto">
                  <span className="font-semibold text-purple-700">{filtered.length}</span>&nbsp;email{filtered.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* ── Liste emails ── */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3 animate-pulse">📧</div>
              <p className="text-gray-500">Chargement des emails...</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(email => {
                const urg = URGENCE_CONFIG[email.urgence]
                const typeCfg = TYPE_EMAIL_CONFIG[email.type_demande] || TYPE_EMAIL_CONFIG.autre
                const statutCfg = STATUT_CONFIG[email.statut] || STATUT_CONFIG.nouveau
                const isNew = email.statut === 'nouveau'

                return (
                  <div key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`bg-white rounded-xl shadow-sm border-2 p-4 cursor-pointer hover:border-purple-300 transition ${
                      email.urgence === 'haute' && isNew ? 'border-red-200 bg-red-50/30' : isNew ? 'border-blue-100' : 'border-gray-100'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      {/* Gauche */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Badge urgence */}
                        <div className={`flex-shrink-0 mt-0.5 text-lg`}>{urg.emoji}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urg.color}`}>{urg.label}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statutCfg.color}`}>{statutCfg.label}</span>
                          </div>
                          <p className={`text-sm font-semibold text-gray-900 truncate ${isNew ? '' : 'opacity-70'}`}>{email.subject}</p>
                          <p className="text-xs text-purple-700 font-medium mt-0.5 truncate">💡 {email.resume_ia || 'Analyse en cours...'}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>✉️ {email.from_name || email.from_email}</span>
                            {email.immeuble_detecte && <span>🏢 {email.immeuble_detecte}</span>}
                            {email.locataire_detecte && <span>👤 {email.locataire_detecte}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Date */}
                      <div className="text-xs text-gray-500 flex-shrink-0 mt-1 text-right">
                        <p>{new Date(email.received_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                        <p>{new Date(email.received_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    {/* Actions rapides */}
                    {isNew && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                        {email.urgence === 'haute' && (
                          <button onClick={() => handleAction(email.id, 'creer_mission')}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                            🚨 Créer mission urgente
                          </button>
                        )}
                        <button onClick={() => handleAction(email.id, 'marquer_traite')}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium transition">
                          ✅ Marquer traité
                        </button>
                        <button onClick={() => handleAction(email.id, 'archiver')}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition">
                          📦 Archiver
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : emails.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">🔍</div>
              <p>Aucun email ne correspond aux filtres</p>
            </div>
          ) : null}
        </>
      )}

      {activeTab === 'rapport' && (
        <div className="space-y-4">
          {emails.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📊</div>
              <p>Aucune donnée — connectez Gmail pour générer des rapports</p>
            </div>
          ) : (
            <>
              {/* Rapport synthèse */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total analysés',  nb: stats.total,    emoji: '📧', color: 'bg-purple-50 border-purple-200' },
                  { label: 'Non traités',      nb: stats.nouveaux, emoji: '📬', color: 'bg-blue-50 border-blue-200' },
                  { label: '🔴 Urgents',        nb: stats.urgents,  emoji: '🔴', color: stats.urgents > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200' },
                  { label: 'Traités',          nb: stats.traites,  emoji: '✅', color: 'bg-green-50 border-green-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl border-2 p-5 ${s.color}`}>
                    <div className="text-3xl mb-2">{s.emoji}</div>
                    <div className="text-3xl font-bold text-gray-900">{s.nb}</div>
                    <div className="text-sm text-gray-600 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Répartition par type */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Répartition par type de demande</h3>
                <div className="space-y-2">
                  {stats.byType.sort((a, b) => b.count - a.count).map(t => (
                    <div key={t.type} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full w-40 text-center ${t.color}`}>
                        {t.emoji} {t.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className="bg-purple-500 h-3 rounded-full transition-all"
                          style={{ width: `${stats.total > 0 ? (t.count / stats.total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-8 text-right">{t.count}</span>
                      <span className="text-xs text-gray-500 w-10">({stats.total > 0 ? Math.round((t.count / stats.total) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emails urgents non traités */}
              {emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-6">
                  <h3 className="font-bold text-red-700 mb-4">🚨 Emails urgents à traiter en priorité</h3>
                  <div className="space-y-2">
                    {emails.filter(e => e.urgence === 'haute' && e.statut === 'nouveau').map(email => (
                      <div key={email.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100"
                        onClick={() => setSelectedEmail(email)}>
                        <div className="flex-1 min-w-0 cursor-pointer">
                          <p className="text-sm font-semibold text-gray-900 truncate">{email.subject}</p>
                          <p className="text-xs text-red-600">💡 {email.resume_ia}</p>
                          <p className="text-xs text-gray-500">{email.from_name || email.from_email} · {new Date(email.received_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <button onClick={e => { e.stopPropagation(); handleAction(email.id, 'marquer_traite') }}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition">✅</button>
                          <button onClick={e => { e.stopPropagation(); handleAction(email.id, 'archiver') }}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-300 transition">📦</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal détail email ── */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className={`p-5 rounded-t-2xl ${
              selectedEmail.urgence === 'haute' ? 'bg-red-50 border-b-2 border-red-200' :
              selectedEmail.urgence === 'moyenne' ? 'bg-amber-50 border-b-2 border-amber-200' :
              'bg-gray-50 border-b-2 border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{URGENCE_CONFIG[selectedEmail.urgence].emoji}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${URGENCE_CONFIG[selectedEmail.urgence].color}`}>
                        {URGENCE_CONFIG[selectedEmail.urgence].label}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).color}`}>
                        {(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).emoji} {(TYPE_EMAIL_CONFIG[selectedEmail.type_demande] || TYPE_EMAIL_CONFIG.autre).label}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900">{selectedEmail.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ✉️ {selectedEmail.from_name || selectedEmail.from_email} · {new Date(selectedEmail.received_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="text-gray-500 hover:text-gray-600 text-xl ml-3">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Résumé IA */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-bold text-purple-600 mb-1">🤖 Analyse de Max</p>
                <p className="text-sm text-purple-900 font-medium">{selectedEmail.resume_ia}</p>
                {selectedEmail.immeuble_detecte && <p className="text-xs text-purple-600 mt-1">🏢 Immeuble : {selectedEmail.immeuble_detecte}</p>}
                {selectedEmail.locataire_detecte && <p className="text-xs text-purple-600">👤 Résident : {selectedEmail.locataire_detecte}</p>}
              </div>

              {/* Corps de l'email */}
              {selectedEmail.body_preview && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">CONTENU DE L'EMAIL</p>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 max-h-40 overflow-y-auto">
                    {selectedEmail.body_preview}
                  </div>
                </div>
              )}

              {/* Réponse suggérée */}
              {selectedEmail.reponse_suggeree && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">✉️ BROUILLON DE RÉPONSE (généré par Max)</p>
                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700 border border-blue-100">
                    <p className="whitespace-pre-wrap">{selectedEmail.reponse_suggeree}</p>
                    <button
                      onClick={() => {
                        const mailto = `mailto:${selectedEmail.from_email}?subject=Re: ${encodeURIComponent(selectedEmail.subject)}&body=${encodeURIComponent(selectedEmail.reponse_suggeree || '')}`
                        window.open(mailto)
                      }}
                      className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      📧 Ouvrir dans ma messagerie
                    </button>
                  </div>
                </div>
              )}

              {/* Actions suggérées */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">ACTIONS SUGGÉRÉES PAR MAX</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(selectedEmail.actions_suggerees) ? selectedEmail.actions_suggerees : []).map(action => (
                    <span key={action} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full">
                      ⚡ {action}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions manuelles */}
              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
                {selectedEmail.statut === 'nouveau' && (
                  <>
                    {selectedEmail.urgence === 'haute' && (
                      <button onClick={() => handleAction(selectedEmail.id, 'creer_mission')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition">
                        🚨 Créer mission urgente
                      </button>
                    )}
                    <button onClick={() => handleAction(selectedEmail.id, 'marquer_traite')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                      ✅ Marquer traité
                    </button>
                    <button onClick={() => handleAction(selectedEmail.id, 'archiver')}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold transition">
                      📦 Archiver
                    </button>
                  </>
                )}
                {selectedEmail.statut !== 'nouveau' && (
                  <div className="w-full text-center py-2 text-sm text-gray-500">
                    Email {STATUT_CONFIG[selectedEmail.statut]?.label.toLowerCase() || 'traité'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Nouvelle Mission ────────────────────────────────────────────────────

function ModalNouveilleMission({
  onClose,
  onAdd,
  batimentsConnus,
  artisans,
  coproprios = [],
}: {
  onClose: () => void
  onAdd: (m: Partial<Mission> & { demandeurEmail?: string; heureIntervention?: string }) => void
  batimentsConnus: string[]
  artisans: Artisan[]
  coproprios?: any[]
}) {
  const [form, setForm] = useState({
    immeuble: '',
    adresseImmeuble: '',
    batiment: '',
    etage: '',
    numLot: '',
    locataire: '',
    telephoneLocataire: '',
    emailLocataire: '',
    accesLogement: '',
    artisan: '',
    type: 'Plomberie',
    description: '',
    priorite: 'normale' as Mission['priorite'],
    dateIntervention: '',
    heureIntervention: '',
    montantDevis: '',
    notifierDemandeur: true,
  })
  const [immeubleInput, setImmeubleInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showCoproSearch, setShowCoproSearch] = useState(false)
  const [coproSearch, setCoproSearch] = useState('')

  // Autocomplete intelligent : pour les saisies courtes (<3 chars),
  // exiger une correspondance en début de mot pour éviter les faux positifs ("LA" matchant tout)
  const suggestions = (() => {
    if (immeubleInput.length === 0) return []
    const q = immeubleInput.toLowerCase().trim()
    if (q.length < 3) {
      // Court : match début de mot uniquement (word boundary)
      const wordBoundaryRegex = new RegExp(`(^|\\s|[-'/])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      return batimentsConnus.filter(b => wordBoundaryRegex.test(b))
    }
    // 3+ chars : substring match classique, trié par pertinence (commence par > contient)
    const matches = batimentsConnus.filter(b => b.toLowerCase().includes(q))
    return matches.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts
    })
  })()

  // Auto-remplissage depuis copropriétaire existant
  const filteredCopros = coproprios.filter((c: any) => {
    const q = coproSearch.toLowerCase()
    return !q || (c.nom || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.lot || '').toLowerCase().includes(q) || (c.nomLocataire || '').toLowerCase().includes(q)
  }).slice(0, 8)

  const autoFillFromCopro = (copro: any) => {
    setForm(f => ({
      ...f,
      immeuble: copro.immeuble || f.immeuble,
      batiment: copro.batiment || f.batiment,
      etage: String(copro.etage || f.etage),
      numLot: copro.numeroPorte || copro.lot || f.numLot,
      locataire: copro.nomLocataire ? `${copro.prenomLocataire || ''} ${copro.nomLocataire}`.trim() : (copro.nomProprietaire ? `${copro.prenomProprietaire || ''} ${copro.nomProprietaire}`.trim() : f.locataire),
      telephoneLocataire: copro.telephoneLocataire || copro.telephoneProprietaire || f.telephoneLocataire,
      emailLocataire: copro.emailLocataire || copro.emailProprietaire || f.emailLocataire,
    }))
    if (copro.immeuble) setImmeubleInput(copro.immeuble)
    setShowCoproSearch(false)
    setCoproSearch('')
  }

  const canSubmit = form.type.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const now = new Date()
    const nomImmeuble = immeubleInput.trim() || form.immeuble || '—'
    const artisanNom = form.artisan || 'le prestataire'

    // Message automatique ordre de mission
    const dateIntervStr = form.dateIntervention
      ? new Date(form.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'à définir'
    const localisationDetail = [
      form.batiment ? `Bâtiment ${form.batiment}` : null,
      form.etage ? `Étage ${form.etage}` : null,
      form.numLot ? `Appartement / Lot ${form.numLot}` : null,
    ].filter(Boolean).join(' · ')
    const locataireDetail = form.locataire
      ? `\n👤 Locataire : ${form.locataire}${form.telephoneLocataire ? ` — Tél : ${form.telephoneLocataire}` : ''}`
      : ''
    const accesDetail = form.accesLogement ? `\n🔑 Accès : ${form.accesLogement}` : ''

    const heureStr = form.heureIntervention ? ` à ${form.heureIntervention}` : ''

    const msgAuto = `📋 ORDRE DE MISSION — ${form.type}

Bonjour ${artisanNom},

Une intervention vous est assignée :

🏢 Résidence : ${nomImmeuble}${form.adresseImmeuble ? `\n📍 Adresse : ${form.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${form.description || form.type}
📅 Date d'intervention : ${dateIntervStr}${heureStr}
⚡ Priorité : ${form.priorite === 'urgente' ? '🔴 URGENTE' : form.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${form.montantDevis ? `\n💰 Budget estimé : ${Number(form.montantDevis).toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

    const autoMsg = { auteur: 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }

    onAdd({
      ...form,
      immeuble: nomImmeuble,
      montantDevis: form.montantDevis ? Number(form.montantDevis) : undefined,
      dateIntervention: form.dateIntervention || undefined,
      heureIntervention: form.heureIntervention || undefined,
      demandeurEmail: form.emailLocataire || undefined,
      canalMessages: [autoMsg],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-900">📋 Nouvel ordre de mission</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="space-y-4">

            {/* ── Auto-remplissage depuis copropriétaire ── */}
            {coproprios.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-800">⚡ Auto-remplissage depuis un copropriétaire</p>
                    <p className="text-xs text-blue-600 mt-0.5">Sélectionnez un copropriétaire pour pré-remplir automatiquement les infos</p>
                  </div>
                  <button
                    onClick={() => setShowCoproSearch(!showCoproSearch)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                  >
                    {showCoproSearch ? '✕ Fermer' : '🔍 Sélectionner'}
                  </button>
                </div>
                {showCoproSearch && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={coproSearch}
                      onChange={e => setCoproSearch(e.target.value)}
                      placeholder="Rechercher par nom, lot, email…"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                      autoFocus
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto bg-white rounded-lg border border-blue-100 shadow-sm">
                      {filteredCopros.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">Aucun résultat</p>
                      ) : filteredCopros.map((c: any, i: number) => (
                        <button
                          key={c.id || i}
                          onClick={() => autoFillFromCopro(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {c.prenomProprietaire ? `${c.prenomProprietaire} ` : ''}{c.nomProprietaire || c.nom || '—'}
                                {c.nomLocataire && <span className="text-xs text-blue-600 ml-1">(loc. {c.prenomLocataire || ''} {c.nomLocataire})</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                {c.immeuble && `🏢 ${c.immeuble} · `}
                                {c.batiment && `Bât. ${c.batiment} · `}
                                {c.etage !== undefined && `Ét. ${c.etage} · `}
                                Lot {c.numeroPorte || c.lot || '—'}
                              </p>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Remplir →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prestataire + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👷 Artisan / Prestataire</label>
                <select
                  value={form.artisan}
                  onChange={e => {
                    const selected = artisans.find(a => a.nom === e.target.value)
                    const metierToType: Record<string, string> = {
                      'Chauffage / Climatisation': 'Chauffage / Clim',
                      'Jardinage / Espaces verts': 'Espaces verts',
                      'Multi-services': 'Autre',
                    }
                    const TYPES = ['Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Menuiserie', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Chauffage / Clim', 'Toiture', 'Vitrerie', 'Espaces verts', 'Autre']
                    let autoType = form.type
                    if (selected?.metier) {
                      const mapped = metierToType[selected.metier] || selected.metier
                      if (TYPES.includes(mapped)) autoType = mapped
                    }
                    setForm({ ...form, artisan: e.target.value, type: autoType })
                  }}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm"
                >
                  <option value="">— Non assigné —</option>
                  {artisans.filter(a => a.statut === 'actif' || a.statut === 'en_attente').map(a => (
                    <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔧 Type de travaux <span className="text-red-500">*</span></label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm"
                >
                  {['Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Menuiserie', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Chauffage / Clim', 'Toiture', 'Vitrerie', 'Espaces verts', 'Autre'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Localisation */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📍 Localisation</p>
              {/* Résidence */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la résidence</label>
                <input
                  type="text"
                  value={immeubleInput}
                  onChange={e => { setImmeubleInput(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Ex : Résidence Les Acacias…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-32 overflow-y-auto">
                    {suggestions.map(s => (
                      <button key={s} onMouseDown={() => { setImmeubleInput(s); setShowSuggestions(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-700 transition">🏢 {s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse complète</label>
                <input type="text" value={form.adresseImmeuble} onChange={e => setForm({ ...form, adresseImmeuble: e.target.value })} placeholder="12 rue de la Paix, 75001 Paris" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bâtiment</label>
                  <input type="text" value={form.batiment} onChange={e => setForm({ ...form, batiment: e.target.value })} placeholder="A, B, C…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Étage</label>
                  <input type="text" value={form.etage} onChange={e => setForm({ ...form, etage: e.target.value })} placeholder="2, RDC…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Appart / Lot</label>
                  <input type="text" value={form.numLot} onChange={e => setForm({ ...form, numLot: e.target.value })} placeholder="12, 4B…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Locataire / Occupant</label>
                  <input type="text" value={form.locataire} onChange={e => setForm({ ...form, locataire: e.target.value })} placeholder="Nom (optionnel)" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tél. locataire</label>
                  <input type="tel" value={form.telephoneLocataire} onChange={e => setForm({ ...form, telephoneLocataire: e.target.value })} placeholder="06 XX XX XX XX" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🔑 Instructions d&apos;accès</label>
                <input type="text" value={form.accesLogement} onChange={e => setForm({ ...form, accesLogement: e.target.value })} placeholder="Code portail, clé gardien…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm bg-white" />
              </div>
            </div>

            {/* Description + date + priorité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Description / Motif <span className="text-gray-500 font-normal text-xs">(optionnel)</span></label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none resize-none text-sm" placeholder="Décrivez l'intervention nécessaire…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">📅 Date souhaitée</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({ ...form, dateIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🕐 Heure d&apos;intervention</label>
                <input type="time" value={form.heureIntervention} onChange={e => setForm({ ...form, heureIntervention: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">⚡ Priorité</label>
                <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as Mission['priorite'] })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  <option value="urgente">🔴 Urgente</option>
                  <option value="normale">🔵 Normale</option>
                  <option value="planifiee">⚪ Planifiée</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">💶 Budget € HT</label>
                <input type="number" value={form.montantDevis} onChange={e => setForm({ ...form, montantDevis: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" placeholder="0" min={0} />
              </div>
            </div>

            {/* Email locataire pour notification retour */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">📧 Email locataire / demandeur <span className="text-gray-500 font-normal">(pour la notification de confirmation)</span></label>
              <input type="email" value={form.emailLocataire} onChange={e => setForm({ ...form, emailLocataire: e.target.value })} placeholder="locataire@email.fr" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
            </div>

            {/* Toggle notification demandeur */}
            <div className={`rounded-xl border-2 p-3 transition ${form.notifierDemandeur ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">🔔 Notifier le demandeur à la création</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.notifierDemandeur
                      ? 'Un message de confirmation sera envoyé dans le canal du demandeur : "Demande traitée, l\'artisan interviendra le…"'
                      : 'Pas de notification au demandeur'}
                  </p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, notifierDemandeur: !f.notifierDemandeur }))}
                  className={`flex-shrink-0 w-12 h-6 rounded-full transition relative ${form.notifierDemandeur ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.notifierDemandeur ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Info messages auto */}
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-amber-500 text-base flex-shrink-0">🔧</span>
                <p className="text-xs text-amber-800">L&apos;artisan <strong>{form.artisan || '…'}</strong> reçoit automatiquement l&apos;ordre de mission complet dans son canal (localisation, accès, date, heure).</p>
              </div>
              {form.notifierDemandeur && (form.locataire || form.emailLocataire) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-green-500 text-base flex-shrink-0">✅</span>
                  <p className="text-xs text-green-800">
                    <strong>{form.locataire || form.emailLocataire}</strong> recevra dans son canal : <em>&quot;Demande traitée — l&apos;artisan {form.artisan || '…'} interviendra le {form.dateIntervention ? new Date(form.dateIntervention).toLocaleDateString('fr-FR') : '…'}{form.heureIntervention ? ` à ${form.heureIntervention}` : ''}&quot;</em>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-40 text-sm"
            >
              📤 Créer &amp; ouvrir le canal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── GED — Types & données ────────────────────────────────────────────────────

type TypeDocument = 'rapport' | 'facture' | 'devis' | 'contrat' | 'diagnostic' | 'ag' | 'plan' | 'controle' | 'assurance' | 'autre'

interface GEDDocument {
  id: string
  nom: string
  type: TypeDocument
  immeuble: string
  artisan: string
  locataire: string
  dateDocument: string
  dateAjout: string
  taille: string
  tags: string[]
  url?: string // URL réelle si uploadé
}

const TYPE_DOC_CONFIG: Record<TypeDocument, { emoji: string; label: string; color: string }> = {
  rapport:    { emoji: '📋', label: 'Rapport intervention', color: 'bg-purple-100 text-purple-700' },
  facture:    { emoji: '💶', label: 'Facture',              color: 'bg-green-100 text-green-700' },
  devis:      { emoji: '📝', label: 'Devis',                color: 'bg-amber-100 text-amber-700' },
  contrat:    { emoji: '📜', label: 'Contrat',              color: 'bg-blue-100 text-blue-700' },
  diagnostic: { emoji: '🏛️', label: 'Diagnostic légal',     color: 'bg-indigo-100 text-indigo-700' },
  ag:         { emoji: '🔑', label: 'PV Assemblée',         color: 'bg-pink-100 text-pink-700' },
  plan:       { emoji: '🏗️', label: 'Plan / Carnet',        color: 'bg-orange-100 text-orange-700' },
  controle:   { emoji: '⚙️', label: 'Contrôle réglementaire', color: 'bg-red-100 text-red-700' },
  assurance:  { emoji: '🛡️', label: 'Assurance / RC Pro',   color: 'bg-teal-100 text-teal-700' },
  autre:      { emoji: '📄', label: 'Autre',                color: 'bg-gray-100 text-gray-600' },
}

const GED_DEMO: GEDDocument[] = []

// ─── Composant GED ─────────────────────────────────────────────────────────────

function GEDSection({ immeubles, artisans, userId }: { immeubles: Immeuble[]; artisans: Artisan[]; userId?: string }) {
  const gedKey = userId ? `fixit_ged_${userId}` : 'fixit_ged_local'
  const FAKE_GED_IDS = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15']
  const [docs, setDocs] = useState<GEDDocument[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(gedKey)
      if (!raw) return []
      const parsed: GEDDocument[] = JSON.parse(raw)
      // Purge des faux documents demo (IDs courts numériques '1'-'15')
      const hasFake = parsed.some(d => FAKE_GED_IDS.includes(String(d.id)))
      if (hasFake) { localStorage.removeItem(gedKey); return [] }
      return parsed
    } catch { return [] }
  })

  // Persister docs dans localStorage à chaque changement
  useEffect(() => {
    try { localStorage.setItem(gedKey, JSON.stringify(docs)) } catch {}
  }, [docs, gedKey])
  const [search, setSearch] = useState('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterArtisan, setFilterArtisan] = useState('')
  const [filterLocataire, setFilterLocataire] = useState('')
  const [filterType, setFilterType] = useState<TypeDocument | ''>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<GEDDocument | null>(null)
  const [uploadForm, setUploadForm] = useState({ nom: '', type: 'rapport' as TypeDocument, immeuble: '', artisan: '', locataire: '', tags: '' })
  const [gedUploadFile, setGedUploadFile] = useState<File | null>(null)
  const [gedUploading, setGedUploading] = useState(false)
  const gedFileRef = useRef<HTMLInputElement>(null)

  const stats = {
    total: docs.length,
    rapports: docs.filter(d => d.type === 'rapport').length,
    factures: docs.filter(d => d.type === 'facture').length,
    devis: docs.filter(d => d.type === 'devis').length,
  }

  const filtered = docs.filter(doc => {
    const q = search.toLowerCase()
    const matchSearch = !search || [doc.nom, doc.artisan, doc.locataire, doc.immeuble, ...doc.tags].some(v => v.toLowerCase().includes(q))
    const matchImmeuble = !filterImmeuble || doc.immeuble === filterImmeuble
    const matchArtisan = !filterArtisan || doc.artisan === filterArtisan
    const matchLocataire = !filterLocataire || doc.locataire.toLowerCase().includes(filterLocataire.toLowerCase())
    const matchType = !filterType || doc.type === filterType
    return matchSearch && matchImmeuble && matchArtisan && matchLocataire && matchType
  })

  const clearFilters = () => { setSearch(''); setFilterImmeuble(''); setFilterArtisan(''); setFilterLocataire(''); setFilterType('') }
  const hasFilters = search || filterImmeuble || filterArtisan || filterLocataire || filterType

  const handleUpload = async () => {
    if (!uploadForm.nom) return
    setGedUploading(true)
    let fileUrl: string | undefined
    let fileTaille = '—'
    // Upload réel si fichier sélectionné
    if (gedUploadFile) {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        const formData = new FormData()
        formData.append('file', gedUploadFile)
        formData.append('bucket', 'artisan-documents')
        formData.append('folder', 'syndic-ged')
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          fileUrl = data.url
        }
        fileTaille = gedUploadFile.size > 1024 * 1024
          ? `${(gedUploadFile.size / 1024 / 1024).toFixed(1)} Mo`
          : `${(gedUploadFile.size / 1024).toFixed(0)} Ko`
      } catch { /* silencieux */ }
    }
    const newDoc: GEDDocument = {
      id: Date.now().toString(),
      nom: uploadForm.nom || (gedUploadFile?.name ?? 'Document'),
      type: uploadForm.type,
      immeuble: uploadForm.immeuble || 'Tous',
      artisan: uploadForm.artisan,
      locataire: uploadForm.locataire,
      dateDocument: new Date().toISOString().split('T')[0],
      dateAjout: new Date().toISOString().split('T')[0],
      taille: fileTaille,
      tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      url: fileUrl,
    }
    setDocs(prev => [newDoc, ...prev])
    setShowUpload(false)
    setUploadForm({ nom: '', type: 'rapport', immeuble: '', artisan: '', locataire: '', tags: '' })
    setGedUploadFile(null)
    setGedUploading(false)
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">GED — {stats.total} documents · {stats.rapports} rapports · {stats.factures} factures · {stats.devis} devis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500 text-sm">
            {viewMode === 'list' ? '⊞' : '☰'}
          </button>
          <button onClick={() => setShowUpload(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            + Ajouter un document
          </button>
        </div>
      </div>

      {/* ── Stats rapides ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Rapports',    nb: stats.rapports, type: 'rapport'    as TypeDocument, emoji: '📋', color: 'border-purple-200 bg-purple-50' },
          { label: 'Factures',    nb: stats.factures, type: 'facture'    as TypeDocument, emoji: '💶', color: 'border-green-200 bg-green-50' },
          { label: 'Devis',       nb: stats.devis,    type: 'devis'      as TypeDocument, emoji: '📝', color: 'border-amber-200 bg-amber-50' },
          { label: 'Tous',        nb: stats.total,    type: ''           as TypeDocument | '', emoji: '📁', color: 'border-gray-200 bg-gray-50' },
        ].map(s => (
          <button key={s.label}
            onClick={() => setFilterType(filterType === s.type ? '' : s.type as TypeDocument)}
            className={`rounded-xl border-2 p-4 text-left transition hover:shadow-sm ${s.color} ${filterType === s.type ? 'ring-2 ring-purple-400' : ''}`}>
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-xl font-bold text-gray-900">{s.nb}</div>
            <div className="text-xs text-gray-600">{s.label}</div>
          </button>
        ))}
      </div>

      {/* ── Barre de recherche + filtres ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col gap-3">
          {/* Recherche plein texte */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans tous les documents, tags, noms..."
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-sm"
            />
          </div>

          {/* Filtres multi-critères */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Bâtiment */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 Bâtiment</label>
              <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="">Tous les immeubles</option>
                <option value="Tous">Commun à tous</option>
                {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
              </select>
            </div>

            {/* Artisan / Technicien */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">🔧 Artisan / Technicien</label>
              <select value={filterArtisan} onChange={e => setFilterArtisan(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="">Tous les artisans</option>
                {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>)}
              </select>
            </div>

            {/* Locataire / Propriétaire */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">👤 Locataire / Propriétaire</label>
              <input
                type="text"
                value={filterLocataire}
                onChange={e => setFilterLocataire(e.target.value)}
                placeholder="Nom du résident..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm"
              />
            </div>

            {/* Type de document */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">📄 Type de document</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as TypeDocument | '')}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="">Tous les types</option>
                {(Object.entries(TYPE_DOC_CONFIG) as [TypeDocument, { emoji: string; label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Résultats + reset */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-purple-700">{filtered.length}</span> document{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {hasFilters && <span className="text-gray-500"> sur {docs.length} au total</span>}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-semibold transition flex items-center gap-1">
                ✕ Effacer les filtres
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Liste des documents ── */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">Aucun document trouvé</p>
              <p className="text-sm mt-1">Modifiez vos critères de recherche</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* En-tête tableau */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div className="col-span-4">Document</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Bâtiment</div>
                <div className="col-span-2">Artisan</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Actions</div>
              </div>
              {filtered.map(doc => {
                const cfg = TYPE_DOC_CONFIG[doc.type]
                return (
                  <div key={doc.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-purple-50/40 transition group items-center">
                    {/* Nom + tags */}
                    <div className="col-span-4">
                      <div className="flex items-start gap-2">
                        <span className="text-xl mt-0.5 flex-shrink-0">{cfg.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 leading-tight">{doc.nom}</p>
                          {doc.locataire && (
                            <p className="text-xs text-purple-600 mt-0.5">👤 {doc.locataire}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.tags.slice(0, 3).map(tag => (
                              <button key={tag} onClick={() => setSearch(tag)}
                                className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded hover:bg-purple-100 hover:text-purple-700 transition">
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Type */}
                    <div className="col-span-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {/* Bâtiment */}
                    <div className="col-span-2 text-sm text-gray-600 truncate">{doc.immeuble}</div>
                    {/* Artisan */}
                    <div className="col-span-2 text-sm text-gray-600 truncate">{doc.artisan || <span className="text-gray-300">—</span>}</div>
                    {/* Date */}
                    <div className="col-span-1 text-xs text-gray-500">
                      {new Date(doc.dateDocument).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                    {/* Actions */}
                    <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setSelectedDoc(doc)} title="Détails"
                        className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-lg transition text-xs">👁</button>
                      <button
                        onClick={() => {
                          if (doc.url) {
                            const a = document.createElement('a'); a.href = doc.url; a.download = doc.nom; a.click()
                          } else {
                            const blob = new Blob([`Document: ${doc.nom}\nImmeuble: ${doc.immeuble}\nArtisan: ${doc.artisan}\nDate: ${doc.dateDocument}\nType: ${doc.type}`], { type: 'text/plain;charset=utf-8' })
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = doc.nom + '.txt'; a.click(); URL.revokeObjectURL(a.href)
                          }
                        }}
                        title="Télécharger"
                        className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-lg transition text-xs">⬇️</button>
                      <button
                        onClick={() => { if (window.confirm(`Supprimer "${doc.nom}" ?`)) setDocs(prev => prev.filter(d => d.id !== doc.id)) }}
                        title="Supprimer"
                        className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition text-xs">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Vue grille */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-4 text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">Aucun document trouvé</p>
            </div>
          ) : filtered.map(doc => {
            const cfg = TYPE_DOC_CONFIG[doc.type]
            return (
              <div key={doc.id} onClick={() => setSelectedDoc(doc)}
                className="bg-white rounded-2xl border-2 border-gray-100 p-4 hover:border-purple-300 hover:shadow-md transition cursor-pointer">
                <div className="text-3xl mb-2">{cfg.emoji}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <p className="text-sm font-medium text-gray-900 mt-2 leading-snug line-clamp-2">{doc.nom}</p>
                <p className="text-xs text-gray-500 mt-2">{doc.immeuble}</p>
                {doc.artisan && <p className="text-xs text-gray-500">🔧 {doc.artisan}</p>}
                {doc.locataire && <p className="text-xs text-purple-600">👤 {doc.locataire}</p>}
                <p className="text-xs text-gray-500 mt-2">{new Date(doc.dateDocument).toLocaleDateString('fr-FR')} · {doc.taille}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Détail document ── */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{TYPE_DOC_CONFIG[selectedDoc.type].emoji}</span>
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_DOC_CONFIG[selectedDoc.type].color}`}>
                    {TYPE_DOC_CONFIG[selectedDoc.type].label}
                  </span>
                  <h3 className="font-bold text-gray-900 mt-1 leading-snug">{selectedDoc.nom}</h3>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-gray-500 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">🏢 Bâtiment</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.immeuble}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📅 Date document</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateDocument).toLocaleDateString('fr-FR')}</p>
                </div>
                {selectedDoc.artisan && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">🔧 Artisan / Technicien</p>
                    <p className="font-semibold text-gray-800">{selectedDoc.artisan}</p>
                  </div>
                )}
                {selectedDoc.locataire && (
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-xs text-purple-400 mb-0.5">👤 Locataire / Propriétaire</p>
                    <p className="font-semibold text-purple-800">{selectedDoc.locataire}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📦 Taille</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.taille}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📥 Ajouté le</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateAjout).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              {selectedDoc.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDoc.tags.map(tag => (
                      <button key={tag} onClick={() => { setSelectedDoc(null); setSearch(tag) }}
                        className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full hover:bg-purple-100 transition">
                        🏷 {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (selectedDoc.url) {
                    const a = document.createElement('a'); a.href = selectedDoc.url; a.download = selectedDoc.nom; a.click()
                  } else {
                    const content = `Document: ${selectedDoc.nom}\nType: ${selectedDoc.type}\nImmeuble: ${selectedDoc.immeuble}\nArtisan: ${selectedDoc.artisan}\nLocataire: ${selectedDoc.locataire}\nDate du document: ${selectedDoc.dateDocument}\nDate d'ajout: ${selectedDoc.dateAjout}\nTaille: ${selectedDoc.taille}\nTags: ${selectedDoc.tags.join(', ')}`
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = selectedDoc.nom + '.txt'; a.click(); URL.revokeObjectURL(a.href)
                  }
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-semibold transition text-sm"
              >
                ⬇️ Télécharger
              </button>
              <button onClick={() => setSelectedDoc(null)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                Fermer
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer "${selectedDoc.nom}" ?`)) {
                    setDocs(prev => prev.filter(d => d.id !== selectedDoc.id))
                    setSelectedDoc(null)
                  }
                }}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2.5 px-4 rounded-lg font-semibold transition text-sm"
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Upload ── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-5">Ajouter un document</h3>
            <div className="space-y-4">
              {/* Upload fichier */}
              <div
                onClick={() => gedFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-purple-400') }}
                onDragLeave={e => e.currentTarget.classList.remove('border-purple-400')}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-purple-400')
                  const f = e.dataTransfer.files[0]
                  if (f) { setGedUploadFile(f); if (!uploadForm.nom) setUploadForm(prev => ({ ...prev, nom: f.name.replace(/\.[^.]+$/, '') })) }
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${gedUploadFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'}`}
              >
                <input
                  ref={gedFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setGedUploadFile(f); if (!uploadForm.nom) setUploadForm(prev => ({ ...prev, nom: f.name.replace(/\.[^.]+$/, '') })) }
                  }}
                  className="hidden"
                />
                {gedUploadFile ? (
                  <>
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-sm font-semibold text-green-700">{gedUploadFile.name}</p>
                    <p className="text-xs text-green-500 mt-1">{(gedUploadFile.size / 1024).toFixed(0)} Ko · Cliquer pour changer</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📎</div>
                    <p className="text-sm font-medium text-gray-700">Glissez un fichier ou cliquez pour sélectionner</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel, Images — Max 50 MB</p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du document *</label>
                <input type="text" value={uploadForm.nom} onChange={e => setUploadForm({ ...uploadForm, nom: e.target.value })}
                  placeholder="Ex: Rapport plomberie cave immeuble Les Acacias"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Type de document</label>
                  <select value={uploadForm.type} onChange={e => setUploadForm({ ...uploadForm, type: e.target.value as TypeDocument })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                    {(Object.entries(TYPE_DOC_CONFIG) as [TypeDocument, { emoji: string; label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 Bâtiment</label>
                  <select value={uploadForm.immeuble} onChange={e => setUploadForm({ ...uploadForm, immeuble: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                    <option value="">Sélectionner...</option>
                    <option value="Tous">Commun à tous</option>
                    {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🔧 Artisan / Technicien</label>
                  <select value={uploadForm.artisan} onChange={e => setUploadForm({ ...uploadForm, artisan: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                    <option value="">Aucun / Non applicable</option>
                    {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">👤 Locataire / Propriétaire</label>
                  <input type="text" value={uploadForm.locataire} onChange={e => setUploadForm({ ...uploadForm, locataire: e.target.value })}
                    placeholder="Nom du résident (si lié)"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🏷 Tags (séparés par des virgules)</label>
                <input type="text" value={uploadForm.tags} onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  placeholder="Ex: plomberie, fuite, cave, urgent"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowUpload(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={handleUpload} disabled={!uploadForm.nom || gedUploading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 flex items-center justify-center gap-2">
                {gedUploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Upload...</> : '📎 Ajouter le document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Types Copropriétaires ────────────────────────────────────────────────────

interface Coproprio {
  id: string
  immeuble: string
  batiment: string
  etage: number
  numeroPorte: string
  nomProprietaire: string
  prenomProprietaire: string
  emailProprietaire: string
  telephoneProprietaire: string
  nomLocataire?: string
  prenomLocataire?: string
  emailLocataire?: string
  telephoneLocataire?: string
  estOccupe: boolean
  notes?: string
}

const COPROPRIOS_DEMO: Coproprio[] = []

// ─── Composant Copropriétaires ────────────────────────────────────────────────

// Clé localStorage copropriétaires — userId injecté via window si dispo
function getCoproKey(): string {
  if (typeof window === 'undefined') return 'fixit_copros_unknown'
  // Chercher l'uid dans les clés syndic déjà utilisées
  const candidate = Object.keys(localStorage).find(k => k.startsWith('fixit_syndic_immeubles_'))
  const uid = candidate ? candidate.replace('fixit_syndic_immeubles_', '') : 'local'
  return `fixit_copros_${uid}`
}

function CopropriosSection({ immeubles, userId }: { immeubles: Immeuble[]; userId?: string }) {
  const storageKey = userId ? `fixit_copros_${userId}` : getCoproKey()
  const FAKE_COPRO_IDS = ['1','2','3','4','5','6']
  const [coproprios, setCoproprios] = useState<Coproprio[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      const parsed: Coproprio[] = JSON.parse(raw)
      // Purge des fausses données demo
      const hasFake = parsed.some(c => FAKE_COPRO_IDS.includes(String(c.id)))
      if (hasFake) { localStorage.removeItem(storageKey); return [] }
      return parsed
    } catch { return [] }
  })
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Coproprio | null>(null)
  const [form, setForm] = useState<Partial<Coproprio>>({ immeuble: '', batiment: '', etage: 0, numeroPorte: '', nomProprietaire: '', prenomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', estOccupe: false })

  // Persister dans localStorage à chaque modification
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(coproprios)) } catch {}
  }, [coproprios, storageKey])

  const filtered = coproprios.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || [c.nomProprietaire, c.prenomProprietaire, c.nomLocataire || '', c.prenomLocataire || '', c.emailProprietaire, c.numeroPorte].some(v => v.toLowerCase().includes(q))
    const matchImm = !filterImmeuble || c.immeuble === filterImmeuble
    return matchSearch && matchImm
  })

  // Grouper par immeuble → bâtiment → étage
  const grouped: Record<string, Record<string, Coproprio[]>> = {}
  filtered.forEach(c => {
    if (!grouped[c.immeuble]) grouped[c.immeuble] = {}
    const key = `${c.batiment} — Étage ${c.etage === 0 ? 'RDC' : c.etage}`
    if (!grouped[c.immeuble][key]) grouped[c.immeuble][key] = []
    grouped[c.immeuble][key].push(c)
    grouped[c.immeuble][key].sort((a, b) => a.numeroPorte.localeCompare(b.numeroPorte))
  })

  const openAdd = () => { setEditItem(null); setForm({ immeuble: '', batiment: '', etage: 0, numeroPorte: '', nomProprietaire: '', prenomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', estOccupe: false }); setShowModal(true) }
  const openEdit = (c: Coproprio) => { setEditItem(c); setForm({ ...c }); setShowModal(true) }
  const handleSave = () => {
    if (!form.nomProprietaire || !form.immeuble || !form.numeroPorte) return
    if (editItem) {
      setCoproprios(prev => prev.map(c => c.id === editItem.id ? { ...c, ...form } as Coproprio : c))
    } else {
      setCoproprios(prev => [...prev, { ...form, id: Date.now().toString() } as Coproprio])
    }
    setShowModal(false)
  }
  const handleDelete = (id: string) => {
    if (!window.confirm('Supprimer ce copropriétaire / lot ? Cette action est irréversible.')) return
    setCoproprios(prev => prev.filter(c => c.id !== id))
  }

  const exportCSV = () => {
    const rows = [['Immeuble', 'Bâtiment', 'Étage', 'Porte', 'Propriétaire', 'Email Proprio', 'Tel Proprio', 'Locataire', 'Email Locataire', 'Tel Locataire', 'Occupé']]
    coproprios.forEach(c => rows.push([c.immeuble, c.batiment, c.etage === 0 ? 'RDC' : String(c.etage), c.numeroPorte, `${c.prenomProprietaire} ${c.nomProprietaire}`, c.emailProprietaire, c.telephoneProprietaire, c.nomLocataire ? `${c.prenomLocataire} ${c.nomLocataire}` : '', c.emailLocataire || '', c.telephoneLocataire || '', c.estOccupe ? 'Oui' : 'Non']))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'coproprios.csv'; a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, porte..." className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
          </div>
          <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
            <option value="">Tous les immeubles</option>
            {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="border-2 border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold transition">📥 Export CSV</button>
          <button onClick={openAdd} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">+ Ajouter</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{coproprios.length}</div>
          <div className="text-xs text-gray-600">Lots total</div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-700">{coproprios.filter(c => c.estOccupe).length}</div>
          <div className="text-xs text-gray-600">Occupés</div>
        </div>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-700">{coproprios.filter(c => !c.estOccupe).length}</div>
          <div className="text-xs text-gray-600">Vacants</div>
        </div>
      </div>

      {/* Tableau arborescent */}
      {Object.entries(grouped).map(([immeuble, batiments]) => (
        <div key={immeuble} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-purple-600 px-5 py-3 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">🏢 {immeuble}</h3>
            <span className="text-purple-200 text-xs">{Object.values(batiments).flat().length} lots</span>
          </div>
          {Object.entries(batiments).map(([batEtage, lots]) => (
            <div key={batEtage}>
              <div className="px-5 py-2 bg-gray-50 border-y border-gray-100 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">📍 {batEtage}</span>
                <span className="text-xs text-gray-500">({lots.length} lot{lots.length > 1 ? 's' : ''})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {lots.map(c => (
                  <div key={c.id} className="px-5 py-3 hover:bg-gray-50 transition group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                          {c.numeroPorte}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">🏠 {c.prenomProprietaire} {c.nomProprietaire}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.estOccupe ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {c.estOccupe ? 'Occupé' : 'Vacant'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                            {c.emailProprietaire && <span>✉️ {c.emailProprietaire}</span>}
                            {c.telephoneProprietaire && <span>📞 {c.telephoneProprietaire}</span>}
                          </div>
                          {c.nomLocataire && (
                            <div className="mt-1 flex items-center gap-3 text-xs text-purple-600 flex-wrap">
                              <span>🔑 Locataire : {c.prenomLocataire} {c.nomLocataire}</span>
                              {c.emailLocataire && <span>✉️ {c.emailLocataire}</span>}
                              {c.telephoneLocataire && <span>📞 {c.telephoneLocataire}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition text-xs">✏️</button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && <div className="bg-white rounded-2xl p-12 text-center text-gray-500"><div className="text-4xl mb-3">👥</div><p>Aucun copropriétaire trouvé</p></div>}

      {/* Modal Ajout/Édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-5">{editItem ? 'Modifier' : 'Ajouter'} un copropriétaire</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 Immeuble *</label>
                  <select value={form.immeuble} onChange={e => setForm({ ...form, immeuble: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                    <option value="">Sélectionner...</option>
                    {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Bâtiment</label>
                  <input type="text" value={form.batiment || ''} onChange={e => setForm({ ...form, batiment: e.target.value })} placeholder="Bât A" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Étage (0 = RDC)</label>
                  <input type="number" min={0} value={form.etage ?? 0} onChange={e => setForm({ ...form, etage: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">N° de porte *</label>
                  <input type="text" value={form.numeroPorte || ''} onChange={e => setForm({ ...form, numeroPorte: e.target.value })} placeholder="12" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div className="col-span-2"><hr className="border-gray-100" /><p className="text-xs font-bold text-gray-500 mt-2">PROPRIÉTAIRE</p></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label>
                  <input type="text" value={form.prenomProprietaire || ''} onChange={e => setForm({ ...form, prenomProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label>
                  <input type="text" value={form.nomProprietaire || ''} onChange={e => setForm({ ...form, nomProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.emailProprietaire || ''} onChange={e => setForm({ ...form, emailProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label>
                  <input type="tel" value={form.telephoneProprietaire || ''} onChange={e => setForm({ ...form, telephoneProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div className="col-span-2 flex items-center gap-3 py-1">
                  <label className="text-sm font-medium text-gray-700">Lot occupé par un locataire ?</label>
                  <button onClick={() => setForm({ ...form, estOccupe: !form.estOccupe })} className={`w-10 h-5 rounded-full transition-all ${form.estOccupe ? 'bg-purple-600' : 'bg-gray-200'}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow transition-all mx-auto" style={{ marginLeft: form.estOccupe ? '22px' : '2px' }} />
                  </button>
                </div>
                {form.estOccupe && (<>
                  <div className="col-span-2"><p className="text-xs font-bold text-gray-500">LOCATAIRE</p></div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom</label>
                    <input type="text" value={form.prenomLocataire || ''} onChange={e => setForm({ ...form, prenomLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nom</label>
                    <input type="text" value={form.nomLocataire || ''} onChange={e => setForm({ ...form, nomLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                    <input type="email" value={form.emailLocataire || ''} onChange={e => setForm({ ...form, emailLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label>
                    <input type="tel" value={form.telephoneLocataire || ''} onChange={e => setForm({ ...form, telephoneLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                  </div>
                </>)}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
              <button onClick={handleSave} disabled={!form.nomProprietaire || !form.immeuble || !form.numeroPorte} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">
                {editItem ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Types Calendrier Réglementaire ──────────────────────────────────────────

type TypeEcheance = 'dpe' | 'ascenseur' | 'amiante' | 'plomb' | 'gaz' | 'electricite' | 'ag' | 'assurance' | 'ravalement' | 'autre'

interface EcheanceReglementaire {
  id: string
  immeuble: string
  type: TypeEcheance
  label: string
  dateEcheance: string
  periodicite: number
  notes?: string
}

const ECHEANCE_CONFIG: Record<TypeEcheance, { emoji: string; label: string; color: string }> = {
  dpe:          { emoji: '🏷️', label: 'DPE',                     color: 'bg-blue-100 text-blue-700' },
  ascenseur:    { emoji: '🛗', label: 'Contrôle ascenseur',       color: 'bg-orange-100 text-orange-700' },
  amiante:      { emoji: '⚠️', label: 'Diagnostic amiante',       color: 'bg-red-100 text-red-700' },
  plomb:        { emoji: '🔩', label: 'Diagnostic plomb (CREP)',  color: 'bg-gray-100 text-gray-700' },
  gaz:          { emoji: '🔥', label: 'Contrôle gaz',             color: 'bg-yellow-100 text-yellow-700' },
  electricite:  { emoji: '⚡', label: 'Contrôle électricité',     color: 'bg-indigo-100 text-indigo-700' },
  ag:           { emoji: '🔑', label: 'Assemblée Générale',       color: 'bg-purple-100 text-purple-700' },
  assurance:    { emoji: '🛡️', label: 'Renouvellement assurance', color: 'bg-teal-100 text-teal-700' },
  ravalement:   { emoji: '🏗️', label: 'Ravalement façade',        color: 'bg-pink-100 text-pink-700' },
  autre:        { emoji: '📋', label: 'Autre',                    color: 'bg-gray-100 text-gray-500' },
}

const ECHEANCES_DEMO: EcheanceReglementaire[] = []

function getStatutEcheance(dateStr: string): 'expire' | 'urgent' | 'proche' | 'ok' {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = (date.getTime() - now.getTime()) / (1000 * 86400)
  if (diff < 0) return 'expire'
  if (diff <= 30) return 'urgent'
  if (diff <= 90) return 'proche'
  return 'ok'
}

const STATUT_ECHEANCE_CONFIG = {
  expire: { label: 'Expiré',  color: 'bg-red-100 text-red-700 border-red-300',       dot: 'bg-red-500' },
  urgent: { label: 'Urgent',  color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
  proche: { label: 'Proche',  color: 'bg-amber-100 text-amber-700 border-amber-300',  dot: 'bg-amber-400' },
  ok:     { label: 'OK',      color: 'bg-green-100 text-green-700 border-green-300',  dot: 'bg-green-500' },
}

function CalendrierReglementaireSection({ immeubles, userId }: { immeubles: Immeuble[]; userId?: string }) {
  const ecKey = userId ? `fixit_cal_regl_${userId}` : 'fixit_cal_regl_local'
  const FAKE_ECH_IDS = ['1','2','3','4','5','6','7','8']
  const [echeances, setEcheances] = useState<EcheanceReglementaire[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(ecKey)
      if (!raw) return []
      const parsed: EcheanceReglementaire[] = JSON.parse(raw)
      // Purge des fausses échéances demo (IDs '1'-'8')
      const hasFake = parsed.some(e => FAKE_ECH_IDS.includes(String(e.id)))
      if (hasFake) { localStorage.removeItem(ecKey); return [] }
      return parsed
    } catch { return [] }
  })
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<EcheanceReglementaire>>({ immeuble: '', type: 'autre', label: '', dateEcheance: '', periodicite: 1 })

  // Persister dans localStorage à chaque changement
  useEffect(() => {
    try { localStorage.setItem(ecKey, JSON.stringify(echeances)) } catch {}
  }, [echeances, ecKey])

  const filtered = echeances.filter(e => {
    const matchImm = !filterImmeuble || e.immeuble === filterImmeuble
    const statut = getStatutEcheance(e.dateEcheance)
    const matchStatut = !filterStatut || statut === filterStatut
    return matchImm && matchStatut
  }).sort((a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime())

  const stats = {
    expire: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'expire').length,
    urgent: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'urgent').length,
    proche: echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'proche').length,
    ok:     echeances.filter(e => getStatutEcheance(e.dateEcheance) === 'ok').length,
  }

  const handleAdd = () => {
    if (!form.label || !form.immeuble || !form.dateEcheance) return
    setEcheances(prev => [...prev, { ...form, id: Date.now().toString() } as EcheanceReglementaire])
    setShowModal(false)
    setForm({ immeuble: '', type: 'autre', label: '', dateEcheance: '', periodicite: 1 })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-sm">Suivi des obligations légales et réglementaires</p>
        <div className="flex gap-2">
          <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-purple-400 focus:outline-none">
            <option value="">Tous immeubles</option>
            {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-purple-400 focus:outline-none">
            <option value="">Tous statuts</option>
            <option value="expire">🔴 Expiré</option>
            <option value="urgent">🟠 Urgent</option>
            <option value="proche">🟡 Proche</option>
            <option value="ok">🟢 OK</option>
          </select>
          <button onClick={() => setShowModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">+ Ajouter</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([['expire', '🔴', 'Expirés'], ['urgent', '🟠', 'Urgents (< 30j)'], ['proche', '🟡', 'Proches (< 90j)'], ['ok', '🟢', 'À jour']] as const).map(([key, emoji, label]) => (
          <button key={key} onClick={() => setFilterStatut(filterStatut === key ? '' : key)}
            className={`rounded-xl border-2 p-3 text-left transition hover:shadow-sm ${STATUT_ECHEANCE_CONFIG[key].color} ${filterStatut === key ? 'ring-2 ring-purple-400' : ''}`}>
            <div className="text-xl mb-0.5">{emoji}</div>
            <div className="text-xl font-bold">{(stats as any)[key]}</div>
            <div className="text-xs">{label}</div>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-3">Immeuble</div>
          <div className="col-span-3">Type</div>
          <div className="col-span-2">Libellé</div>
          <div className="col-span-2">Échéance</div>
          <div className="col-span-1">Statut</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(e => {
          const statut = getStatutEcheance(e.dateEcheance)
          const sConfig = STATUT_ECHEANCE_CONFIG[statut]
          const tConfig = ECHEANCE_CONFIG[e.type]
          const daysLeft = Math.ceil((new Date(e.dateEcheance).getTime() - Date.now()) / 86400000)
          return (
            <div key={e.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 group items-center ${statut === 'expire' ? 'bg-red-50/40' : statut === 'urgent' ? 'bg-orange-50/30' : ''}`}>
              <div className="col-span-3 text-sm font-medium text-gray-800 truncate">{e.immeuble}</div>
              <div className="col-span-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${tConfig.color}`}>{tConfig.emoji} {tConfig.label}</span></div>
              <div className="col-span-2 text-sm text-gray-600 truncate">{e.label}</div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-900">{new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                <p className="text-xs text-gray-500">{daysLeft < 0 ? `Il y a ${Math.abs(daysLeft)}j` : `Dans ${daysLeft}j`}</p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${sConfig.dot}`} title={sConfig.label} />
              </div>
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => { if (window.confirm('Supprimer cette échéance ?')) setEcheances(prev => prev.filter(x => x.id !== e.id)) }}
                  className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-red-500 text-sm p-1 rounded"
                  title="Supprimer"
                >🗑️</button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">Aucune échéance trouvée</div>}
      </div>

      {/* Modal ajout */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ajouter une échéance</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Immeuble *</label>
                <select value={form.immeuble} onChange={e => setForm({ ...form, immeuble: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  <option value="">Sélectionner...</option>
                  {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TypeEcheance })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                  {(Object.entries(ECHEANCE_CONFIG) as [TypeEcheance, any][]).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Libellé *</label>
                <input type="text" value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Description de l'échéance" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date échéance *</label>
                  <input type="date" value={form.dateEcheance || ''} onChange={e => setForm({ ...form, dateEcheance: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Périodicité (ans)</label>
                  <input type="number" min={1} value={form.periodicite || 1} onChange={e => setForm({ ...form, periodicite: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
              <button onClick={handleAdd} disabled={!form.label || !form.immeuble || !form.dateEcheance} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant Signature Électronique (art. 1367 Code Civil) ──────────────────

interface SignatureData {
  svg_data: string
  signataire: string
  timestamp: string
  document_ref: string
  hash_sha256: string
}

function SignatureModal({ documentRef, signataire, onClose, onSign }: {
  documentRef: string
  signataire: string
  onClose: () => void
  onSign: (sig: SignatureData) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<{ x: number; y: number }[][]>([])
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const [nom, setNom] = useState(signataire)
  const [signing, setSigning] = useState(false)

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return
    e.preventDefault()
    setDrawing(true)
    const pos = getPos(e, canvas)
    setCurrentStroke([pos])
    const ctx = canvas.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    e.preventDefault()
    const pos = getPos(e, canvas)
    setCurrentStroke(prev => [...prev, pos])
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f'
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }

  const endDraw = () => {
    if (!drawing) return
    setDrawing(false)
    setPoints(prev => [...prev, currentStroke])
    setCurrentStroke([])
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setPoints([]); setCurrentStroke([])
  }

  const buildSVG = () => {
    const paths = points.filter(s => s.length > 1).map(stroke => {
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      return `<path d="${d}" stroke="#1e3a5f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160">${paths}</svg>`
  }

  const handleSign = async () => {
    if (points.length === 0 || !nom.trim()) return
    setSigning(true)
    try {
      const svg = buildSVG()
      const timestamp = new Date().toISOString()
      const payload = `${nom}|${timestamp}|${documentRef}|${svg.length}`
      const encoder = new TextEncoder()
      const data = encoder.encode(payload)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      onSign({ svg_data: svg, signataire: nom, timestamp, document_ref: documentRef, hash_sha256: hash })
    } catch {
      onSign({ svg_data: buildSVG(), signataire: nom, timestamp: new Date().toISOString(), document_ref: documentRef, hash_sha256: 'hash_error' })
    }
    setSigning(false)
  }

  const isEmpty = points.length === 0

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">✍️ Signature électronique</h3>
            <p className="text-xs text-gray-500">Conforme art. 1367 Code Civil · SHA-256</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-700">📄 Document : <span className="font-semibold">{documentRef}</span></p>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du signataire *</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
        </div>

        <div className="mb-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500">Signature *</label>
            <button onClick={clearCanvas} className="text-xs text-red-500 hover:text-red-700 transition">🗑 Effacer</button>
          </div>
          <canvas ref={canvasRef} width={400} height={160}
            className={`w-full border-2 rounded-xl cursor-crosshair touch-none ${isEmpty ? 'border-dashed border-gray-300 bg-gray-50' : 'border-purple-300 bg-white'}`}
            style={{ touchAction: 'none' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
          {isEmpty && <p className="text-xs text-gray-500 text-center mt-1">Signez ici avec votre souris ou votre doigt</p>}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-500">
          🕐 Horodatage : {new Date().toLocaleString('fr-FR')} · 🔐 Empreinte SHA-256 générée à la validation
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
          <button onClick={handleSign} disabled={isEmpty || !nom.trim() || signing}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">
            {signing ? '⏳ Signature...' : '✅ Valider la signature'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant Rapport Mensuel ────────────────────────────────────────────────

function RapportMensuelSection({ immeubles, missions, artisans, syndicId, coproprios }: {
  immeubles: Immeuble[]
  missions: Mission[]
  artisans: Artisan[]
  syndicId: string
  coproprios: Coproprio[]
}) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [selectedYear, setSelectedYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [generating, setGenerating] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const rapportRef = useRef<HTMLDivElement>(null)

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`

  // Filtrer missions du mois sélectionné
  const moisMissions = missions.filter(m => {
    if (!m.dateIntervention) return false
    const d = new Date(m.dateIntervention)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  const totalBudget = immeubles.reduce((a, i) => a + i.budgetAnnuel, 0)
  const totalDepenses = immeubles.reduce((a, i) => a + i.depensesAnnee, 0)
  const totalMontantMois = moisMissions.reduce((a, m) => a + (m.montantFacture || m.montantDevis || 0), 0)

  // Tous les emails des copropriétaires
  const allEmails = coproprios.filter(c => c.emailProprietaire).map(c => ({
    email: c.emailProprietaire,
    nom: `${c.prenomProprietaire} ${c.nomProprietaire}`,
    immeuble: c.immeuble,
  }))

  const generatePDF = async () => {
    if (!rapportRef.current) return
    setGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(rapportRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794 })
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height / canvas.width) * pdfWidth
      const pageHeight = pdf.internal.pageSize.getHeight()
      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight)
      while (imgHeight > pageHeight + Math.abs(position)) { position -= pageHeight; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight) }
      pdf.save(`rapport-mensuel-${monthLabel.replace(' ', '-').toLowerCase()}.pdf`)
    } catch { alert('Erreur génération PDF') }
    setGenerating(false)
  }

  const handleSend = () => {
    if (selectedRecipients.length === 0) return
    const subject = encodeURIComponent(`Rapport mensuel de gestion — ${monthLabel}`)
    const body = encodeURIComponent(`Madame, Monsieur,\n\nVeuillez trouver ci-joint le rapport mensuel de gestion pour le mois de ${monthLabel}.\n\nCe rapport comprend :\n- Le bilan des interventions réalisées\n- L'état du budget\n- Les alertes réglementaires\n\nCordialement,\nVotre gestionnaire Vitfix Pro`)
    const to = selectedRecipients.join(',')
    window.open(`mailto:${to}?subject=${subject}&body=${body}`)
    setShowSendModal(false)
  }

  const toggleRecipient = (email: string) => setSelectedRecipients(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])

  return (
    <div className="space-y-4">
      {/* Contrôles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Mois</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-purple-400 focus:outline-none">
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Année</label>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-purple-400 focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowSendModal(true)} className="flex items-center gap-2 border-2 border-purple-300 text-purple-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-50 transition">
            📨 Envoyer aux copropriétaires
          </button>
          <button onClick={generatePDF} disabled={generating} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {generating ? '⏳' : '📄'} {generating ? 'Génération...' : 'Télécharger PDF'}
          </button>
        </div>
      </div>

      {/* Aperçu rapport */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <p className="text-xs text-gray-500 mb-4 text-center">Aperçu du rapport — ce contenu sera généré en PDF</p>
        {/* Template caché pour jsPDF */}
        <div ref={rapportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '794px', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          {/* En-tête */}
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: '32px 40px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>⚡ Vitfix Pro</div>
                <div style={{ fontSize: '14px', opacity: 0.85 }}>Rapport Mensuel de Gestion</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{monthLabel}</div>
                <div style={{ fontSize: '12px', opacity: 0.75 }}>Généré le {new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          </div>
          {/* Contenu */}
          <div style={{ padding: '32px 40px' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              {[
                { label: 'Immeubles gérés', value: immeubles.length, color: '#7c3aed' },
                { label: 'Interventions du mois', value: moisMissions.length, color: '#2563eb' },
                { label: 'Montant travaux', value: `${totalMontantMois.toLocaleString('fr-FR')} €`, color: '#16a34a' },
                { label: 'Budget consommé', value: `${Math.round((totalDepenses / totalBudget) * 100)}%`, color: totalDepenses / totalBudget > 0.85 ? '#dc2626' : '#16a34a' },
              ].map(s => (
                <div key={s.label} style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Interventions */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                📋 Interventions — {monthLabel}
              </div>
              {moisMissions.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Immeuble', 'Type', 'Artisan', 'Date', 'Montant', 'Statut'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moisMissions.map((m, i) => (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.immeuble}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.type}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.artisan}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: '600' }}>{(m.montantFacture || m.montantDevis || 0).toLocaleString('fr-FR')} €</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{m.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Aucune intervention ce mois.</p>
              )}
            </div>
            {/* Budget */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                💶 Budget Global {selectedYear}
              </div>
              {immeubles.map(imm => {
                const pct = Math.round((imm.depensesAnnee / imm.budgetAnnuel) * 100)
                return (
                  <div key={imm.id} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600' }}>{imm.nom}</span>
                      <span>{imm.depensesAnnee.toLocaleString('fr-FR')} € / {imm.budgetAnnuel.toLocaleString('fr-FR')} € ({pct}%)</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                      <div style={{ background: pct > 85 ? '#dc2626' : '#7c3aed', borderRadius: '9999px', height: '8px', width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Pied de page */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
              <span>⚡ Vitfix Pro — Gestion de copropriété</span>
              <span>Document généré automatiquement — {new Date().toLocaleString('fr-FR')}</span>
            </div>
          </div>
        </div>

        {/* Aperçu visible */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">⚡ Vitfix Pro</div>
                <div className="text-purple-200 text-sm">Rapport Mensuel de Gestion</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{monthLabel}</div>
                <div className="text-purple-200 text-xs">Généré le {new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Immeubles', value: immeubles.length, color: 'bg-purple-50 border-purple-200' },
              { label: 'Interventions du mois', value: moisMissions.length, color: 'bg-blue-50 border-blue-200' },
              { label: 'Montant travaux', value: `${totalMontantMois.toLocaleString('fr-FR')} €`, color: 'bg-green-50 border-green-200' },
              { label: 'Budget consommé', value: `${Math.round((totalDepenses / totalBudget) * 100)}%`, color: totalDepenses / totalBudget > 0.85 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border-2 p-4 text-center ${s.color}`}>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-600 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {moisMissions.length > 0 ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-semibold text-gray-700 text-sm">📋 Interventions du mois</div>
              <div className="divide-y divide-gray-100">
                {moisMissions.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{m.immeuble} — {m.type}</p>
                      <p className="text-xs text-gray-500">{m.artisan} · {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                    <span className="font-bold text-gray-900">{(m.montantFacture || m.montantDevis || 0).toLocaleString('fr-FR')} €</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
              Aucune intervention enregistrée pour {monthLabel}
            </div>
          )}
        </div>
      </div>

      {/* Modal envoi */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSendModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">📨 Envoyer le rapport aux copropriétaires</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedRecipients.length} destinataire{selectedRecipients.length !== 1 ? 's' : ''} sélectionné{selectedRecipients.length !== 1 ? 's' : ''}</p>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedRecipients(allEmails.map(e => e.email))} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 transition font-medium">✓ Tous</button>
              <button onClick={() => setSelectedRecipients([])} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition font-medium">✕ Aucun</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
              {Object.entries(
                allEmails.reduce((acc, e) => { if (!acc[e.immeuble]) acc[e.immeuble] = []; acc[e.immeuble].push(e); return acc }, {} as Record<string, typeof allEmails>)
              ).map(([imm, residents]) => (
                <div key={imm}>
                  <div className="text-xs font-bold text-gray-500 px-2 py-1 bg-gray-50 rounded-lg mb-1">{imm}</div>
                  {residents.map(r => (
                    <label key={r.email} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={selectedRecipients.includes(r.email)} onChange={() => toggleRecipient(r.email)} className="accent-purple-600" />
                      <span className="text-sm text-gray-800 flex-1">{r.nom}</span>
                      <span className="text-xs text-gray-500">{r.email}</span>
                    </label>
                  ))}
                </div>
              ))}
              {allEmails.length === 0 && <p className="text-center text-gray-500 text-sm py-6">Aucun email copropriétaire renseigné</p>}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
              <button onClick={handleSend} disabled={selectedRecipients.length === 0} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">
                📨 Ouvrir messagerie ({selectedRecipients.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard Principal ───────────────────────────────────────────────────────

export default function SyndicDashboard() {
  const [page, setPage] = useState<Page>('accueil')
  // ── Modules personnalisables ──
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
  const [moduleOrder, setModuleOrder] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // ── Données persistées en localStorage (clé par user.id, chargées après auth) ──
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [artisans, setArtisans] = useState<Artisan[]>(ARTISANS_DEMO)
  const [missions, setMissions] = useState<Mission[]>(MISSIONS_DEMO)
  const [alertes, setAlertes] = useState<Alerte[]>(ALERTES_DEMO)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [showModalMission, setShowModalMission] = useState(false)
  // ── Bâtiments connus (champ libre avec suggestions) ──────────────────────────
  const [batimentsConnus, setBatimentsConnus] = useState<string[]>([])
  // ── Immeuble management ─────────────────────────────────────────────────────
  const [showModalImmeuble, setShowModalImmeuble] = useState(false)
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null)
  const [immeubleForm, setImmeubleForm] = useState<Partial<Immeuble>>({ nom: '', adresse: '', ville: '', codePostal: '', nbLots: 1, anneeConstruction: 2000, typeImmeuble: 'Copropriété', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, nbInterventions: 0 })
  // ── Missions filter ─────────────────────────────────────────────────────────
  const [missionsFilter, setMissionsFilter] = useState<'Toutes' | 'Urgentes' | 'En cours' | 'Terminées'>('Toutes')
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [showMissionDetails, setShowMissionDetails] = useState(false)
  // ── Planning navigation ─────────────────────────────────────────────────────
  const [planningDate, setPlanningDate] = useState(new Date())
  const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>(PLANNING_EVENTS_DEMO)
  const [showPlanningModal, setShowPlanningModal] = useState(false)
  const [selectedPlanningDay, setSelectedPlanningDay] = useState<string | null>(null)
  const [planningViewFilter, setPlanningViewFilter] = useState('tous')
  const [planningNeedsMigration, setPlanningNeedsMigration] = useState(false)
  // ── Membres de l'équipe (chargés depuis Supabase) ────────────────────────────
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [planningEventForm, setPlanningEventForm] = useState({
    titre: '',
    type: 'visite' as PlanningEvent['type'],
    heure: '09:00',
    dureeMin: 60,
    assigneA: '',
    description: '',
  })
  // ── Canal Interne ────────────────────────────────────────────────────────────
  const [canalInternalTab, setCanalInternalTab] = useState<'artisans' | 'interne'>('artisans')
  const [canalInterneMessages, setCanalInterneMessages] = useState<CanalInterneMsg[]>(CANAL_INTERNE_DEMO)
  const [canalInterneInput, setCanalInterneInput] = useState('')
  const [canalInterneType, setCanalInterneType] = useState<'message' | 'tache' | 'planning'>('message')
  const [canalPlanDate, setCanalPlanDate] = useState(new Date().toISOString().slice(0, 10))
  const [canalPlanHeure, setCanalPlanHeure] = useState('09:00')
  const [canalPlanResident, setCanalPlanResident] = useState('')
  const [canalPlanResidence, setCanalPlanResidence] = useState('')
  const [canalTacheAssignee, setCanalTacheAssignee] = useState('')
  const [canalTachePriorite, setCanalTachePriorite] = useState<'normale' | 'urgente'>('normale')
  const canalInterneEndRef = useRef<HTMLDivElement>(null)
  // ── Paramètres ──────────────────────────────────────────────────────────────
  const [cabinetNom, setCabinetNom] = useState('')
  const [cabinetEmail, setCabinetEmail] = useState('')
  const [notifSettings, setNotifSettings] = useState([
    { label: 'Alertes RC Pro expirées', checked: true },
    { label: 'Contrôles réglementaires imminents', checked: true },
    { label: 'Nouvelles missions créées', checked: true },
    { label: 'Signalements copropriétaires', checked: false },
    { label: 'Résumé hebdomadaire', checked: true },
  ])
  const [paramSaved, setParamSaved] = useState(false)
  // ── Artisan management ──────────────────────────────────────────────────────
  const [showModalArtisan, setShowModalArtisan] = useState(false)
  const [artisanForm, setArtisanForm] = useState({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' })
  const [artisanSearchResult, setArtisanSearchResult] = useState<{ found: boolean; name?: string; role?: string } | null>(null)
  const [artisanSearchLoading, setArtisanSearchLoading] = useState(false)
  const [artisanSubmitting, setArtisanSubmitting] = useState(false)
  const [artisanError, setArtisanError] = useState('')
  const [artisanSuccess, setArtisanSuccess] = useState('')
  const [artisansLoaded, setArtisansLoaded] = useState(false)
  // ── Canal communication ─────────────────────────────────────────────────────
  const [selectedArtisanChat, setSelectedArtisanChat] = useState<Artisan | null>(null)
  const [messages, setMessages] = useState<SyndicMessage[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [iaMessages, setIaMessages] = useState<{ role: 'user' | 'assistant'; content: string; action?: any; actionStatus?: 'pending' | 'confirmed' | 'cancelled' | 'error' }[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis **Max**, votre assistant IA expert Vitfix Pro.\n\nJ\'ai accès à **toutes vos données en temps réel** : immeubles, artisans, missions, alertes, échéances réglementaires.\n\nJe peux aussi **agir directement** : créer une mission, naviguer vers une page, générer un courrier...\n\n🎙️ Vous pouvez me parler à voix haute en cliquant sur le micro !\n\nComment puis-je vous aider ?' }
  ])
  const [iaInput, setIaInput] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaPendingAction, setIaPendingAction] = useState<{ action: any; iaToken: string } | null>(null)
  const iaEndRef = useRef<HTMLDivElement>(null)
  // ── Voice & Speech ─────────────────────────────────────────────────────────
  const [iaVoiceActive, setIaVoiceActive] = useState(false)
  const [iaVoiceSupported, setIaVoiceSupported] = useState(false)
  const [iaSpeechEnabled, setIaSpeechEnabled] = useState(false)
  const [iaSpeaking, setIaSpeaking] = useState(false)
  const iaRecognitionRef = useRef<any>(null)
  const iaSendTimerRef = useRef<any>(null)
  // ── Voice V2 — états enrichis ──────────────────────────────────────────────
  const [iaVoiceDuration, setIaVoiceDuration] = useState(0)
  const [iaVoiceInterim, setIaVoiceInterim] = useState('')
  const [iaVoiceHelp, setIaVoiceHelp] = useState(false)
  const [iaVoiceSendTrigger, setIaVoiceSendTrigger] = useState<string | null>(null)
  const [iaVoiceConfidence, setIaVoiceConfidence] = useState(0)
  const [iaAvailableVoices, setIaAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const iaVoiceDurationRef = useRef<any>(null)
  const iaTranscriptRef = useRef('')

  useEffect(() => {
    // Vérifier support Web Speech API
    if (typeof window !== 'undefined') {
      const supported = !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      )
      setIaVoiceSupported(supported)

      // Charger préférence TTS
      try {
        const savedPref = localStorage.getItem(`fixit_tts_enabled_${user?.id}`)
        if (savedPref === 'true') setIaSpeechEnabled(true)
      } catch {}

      // Charger voix disponibles
      if (window.speechSynthesis) {
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices()
          if (voices.length) setIaAvailableVoices(voices)
        }
        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    }
  }, [user?.id])

  // ── Notifications in-app ──────────────────────────────────────────────────
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }[]>([])
  const notifUnread = notifs.filter(n => !n.read).length

  useEffect(() => {
    if (!user?.id) return
    // Charger les notifs existantes
    const loadNotifs = async () => {
      try {
        const res = await fetch(`/api/syndic/notify-artisan?syndic_id=${user.id}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          if (data.notifications) setNotifs(data.notifications)
        }
      } catch { /* silencieux */ }
    }
    loadNotifs()

    // Supabase Realtime — nouvelles notifs en temps réel
    const channel = supabase
      .channel(`syndic_notifs_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'syndic_notifications',
        filter: `syndic_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as any
        setNotifs(prev => [{ id: n.id, title: n.title, body: n.body, type: n.type, read: false, created_at: n.created_at }, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // ── Persistance canal interne ──
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`fixit_canal_interne_${user.id}`, JSON.stringify(canalInterneMessages))
    } catch {}
  }, [canalInterneMessages, user?.id])

  // ── Persistance planning events ──
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`fixit_planning_events_${user.id}`, JSON.stringify(planningEvents))
    } catch {}
  }, [planningEvents, user?.id])

  const markAllNotifsRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    if (!user?.id) return
    try {
      await fetch(`/api/syndic/notify-artisan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndic_id: user.id, mark_all_read: true }),
      })
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    const getUser = async () => {
      // Forcer le rafraîchissement du token pour obtenir les user_metadata à jour
      await supabase.auth.refreshSession()
      // getUser() fait un appel réseau frais (contrairement à getSession() qui lit les cookies)
      const { data: { user: freshUser } } = await supabase.auth.getUser()
      const userRole = freshUser?.user_metadata?.role || ''
      const isAdminOverride = freshUser?.user_metadata?._admin_override === true
      const isSyndic = userRole === 'syndic' || userRole.startsWith('syndic_') || isAdminOverride
      if (!freshUser || !isSyndic) {
        window.location.href = '/syndic/login'
        return
      }
      setUser(freshUser)
      setCabinetNom(freshUser?.user_metadata?.company_name || freshUser?.user_metadata?.full_name || '')
      setCabinetEmail(freshUser?.email || '')

      // ── Charger données : localStorage d'abord (rapide), puis Supabase (sync) ──
      const uid = freshUser.id

      // ── Noms des faux immeubles de démo — utilisés pour filtrer partout ──────
      const FAKE_BUILDING_NAMES = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']

      // ── Purge one-shot v6 : efface TOUT l'ancien localStorage syndic ─────────
      // Flag UID-spécifique → chaque utilisateur est purgé une seule fois indépendamment
      // v6 : force re-purge pour éliminer toutes les fausses données persistantes
      if (!localStorage.getItem(`fixit_clean_v6_${uid}`)) {
        const keysToNuke = [
          `fixit_syndic_missions_${uid}`,
          `fixit_syndic_immeubles_${uid}`,
          `fixit_syndic_batiments_${uid}`,
          `fixit_canal_interne_${uid}`,
          `fixit_planning_events_${uid}`,
          `fixit_copros_${uid}`,
          `fixit_ged_${uid}`,
          `fixit_cal_regl_${uid}`,
          // Anciens flags
          `fixit_clean_v5_${uid}`,
          'fixit_clean_v4',
          'fixit_clean_v3',
        ]
        keysToNuke.forEach(k => localStorage.removeItem(k))
        // Purger toutes les clés liées à cet uid (balayage complet)
        Object.keys(localStorage)
          .filter(k =>
            k.startsWith('canal_missions_') ||
            k.startsWith('fixit_copros_local') ||
            k.startsWith('syndic_transferts_') ||
            (k.includes(uid) && (
              k.startsWith('fixit_') ||
              k.startsWith('vitfix_') ||
              k.startsWith('canal_')
            ))
          )
          .forEach(k => localStorage.removeItem(k))
        localStorage.setItem(`fixit_clean_v6_${uid}`, '1')
      }

      try {
        const savedMissions = localStorage.getItem(`fixit_syndic_missions_${uid}`)
        if (savedMissions) {
          try {
            const parsed = JSON.parse(savedMissions)
            // Filtre les missions référençant des faux immeubles OU IDs courts
            const FAKE_IDS = ['1','2','3','4','5']
            const real = parsed.filter((m: any) =>
              !FAKE_IDS.includes(String(m.id)) &&
              !FAKE_BUILDING_NAMES.includes(m.immeuble)
            )
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_missions_${uid}`, JSON.stringify(real))
            }
            setMissions(real)
          } catch { localStorage.removeItem(`fixit_syndic_missions_${uid}`) }
        }

        const savedImmeubles = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
        if (savedImmeubles) {
          try {
            const parsed = JSON.parse(savedImmeubles)
            const real = parsed.filter((i: any) =>
              !['1','2','3'].includes(String(i.id)) &&
              !FAKE_BUILDING_NAMES.includes(i.nom)
            )
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_immeubles_${uid}`, JSON.stringify(real))
            }
            setImmeubles(real)
          } catch { localStorage.removeItem(`fixit_syndic_immeubles_${uid}`) }
        }

        const savedBatiments = localStorage.getItem(`fixit_syndic_batiments_${uid}`)
        if (savedBatiments) {
          try {
            const parsed = JSON.parse(savedBatiments)
            const real = parsed.filter((n: string) => !FAKE_BUILDING_NAMES.includes(n))
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_syndic_batiments_${uid}`, JSON.stringify(real))
            }
            setBatimentsConnus(real)
          } catch { setBatimentsConnus([]) }
        }

        const savedCanalInterne = localStorage.getItem(`fixit_canal_interne_${uid}`)
        if (savedCanalInterne) {
          try {
            const parsed = JSON.parse(savedCanalInterne)
            // Purge si contient des IDs de démo ou des références à de faux immeubles
            const hasFake = parsed.some((m: any) =>
              /^(ci|pe)-\d+$/.test(String(m.id)) ||
              ['ci-1','ci-2','ci-3'].includes(String(m.id)) ||
              FAKE_BUILDING_NAMES.some(n => String(m.texte || '').includes(n) || String(m.sujet || '').includes(n))
            )
            if (hasFake) {
              localStorage.removeItem(`fixit_canal_interne_${uid}`)
            } else {
              setCanalInterneMessages(parsed)
            }
          } catch { localStorage.removeItem(`fixit_canal_interne_${uid}`) }
        }

        const savedPlanningEvents = localStorage.getItem(`fixit_planning_events_${uid}`)
        if (savedPlanningEvents) {
          try {
            const parsed = JSON.parse(savedPlanningEvents)
            // Filtrer les events assignés à de faux membres (IDs courts)
            const FAKE_PERSON_NAMES = ['Jean-Pierre Martin','Marie Dupont','Sophie Leroy','Bernard Petit','Directeur Général']
            const real = parsed.filter((e: any) => !FAKE_PERSON_NAMES.includes(e.assigneA))
            setPlanningEvents(real)
            if (real.length < parsed.length) {
              localStorage.setItem(`fixit_planning_events_${uid}`, JSON.stringify(real))
            }
          } catch { localStorage.removeItem(`fixit_planning_events_${uid}`) }
        }

        // Load enabled modules
        const savedModules = localStorage.getItem(`fixit_modules_syndic_${uid}`)
        if (savedModules) setEnabledModules(JSON.parse(savedModules))
        // Load module order
        const savedOrder = localStorage.getItem(`fixit_modules_order_syndic_${uid}`)
        if (savedOrder) setModuleOrder(JSON.parse(savedOrder))
      } catch { /* silencieux */ }
      setDataLoaded(true)

      // ── Sync Supabase en arrière-plan ──────────────────────────────────────
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return

        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

        // Charger missions, immeubles, planning, canal interne, équipe depuis Supabase
        const [mRes, iRes, peRes, ciRes, teamRes] = await Promise.all([
          fetch('/api/syndic/missions', { headers }),
          fetch('/api/syndic/immeubles', { headers }),
          fetch('/api/syndic/planning-events', { headers }),
          fetch('/api/syndic/canal-interne', { headers }),
          fetch('/api/syndic/team', { headers }),
        ])

        if (mRes.ok) {
          const { missions: dbMissions } = await mRes.json()
          if (dbMissions) {
            // Séparer vraies missions des fausses missions de démo
            const FAKE_BUILDING_NAMES_DB = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']
            const fakeMissions = dbMissions.filter((m: any) => FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
            const realMissions = dbMissions.filter((m: any) => !FAKE_BUILDING_NAMES_DB.includes(m.immeuble))
            // AUTO-CLEANUP DB : supprimer définitivement les fausses missions de Supabase
            if (fakeMissions.length > 0) {
              for (const fm of fakeMissions) {
                try {
                  await fetch(`/api/syndic/missions?id=${encodeURIComponent(fm.id)}`, { method: 'DELETE', headers })
                } catch {}
              }
            }
            setMissions(realMissions)
            try { localStorage.setItem(`fixit_syndic_missions_${uid}`, JSON.stringify(realMissions)) } catch {}
          }
        }

        if (iRes.ok) {
          const { immeubles: dbImmeubles } = await iRes.json()
          if (dbImmeubles) {
            // Séparer vrais immeubles des faux immeubles de démo
            const FAKE_BUILDING_NAMES = ['Résidence Les Acacias', 'Le Clos Vendôme', 'Tour Horizon']
            const fakeImmeubles = dbImmeubles.filter((i: any) => FAKE_BUILDING_NAMES.includes(i.nom))
            const realImmeubles = dbImmeubles.filter((i: any) => !FAKE_BUILDING_NAMES.includes(i.nom))
            // AUTO-CLEANUP DB : supprimer définitivement les faux immeubles de Supabase
            if (fakeImmeubles.length > 0) {
              for (const fi of fakeImmeubles) {
                try {
                  await fetch(`/api/syndic/immeubles?id=${encodeURIComponent(fi.id)}`, { method: 'DELETE', headers })
                } catch {}
              }
            }
            if (realImmeubles.length > 0) {
              setImmeubles(realImmeubles)
              // Mettre à jour les bâtiments connus depuis Supabase (sans faux noms)
              const noms = realImmeubles.map((i: any) => i.nom).filter(Boolean)
              if (noms.length > 0) {
                setBatimentsConnus((prev: string[]) => {
                  const merged = Array.from(new Set([...prev, ...noms])).sort()
                  try { localStorage.setItem(`fixit_syndic_batiments_${uid}`, JSON.stringify(merged)) } catch {}
                  return merged
                })
              }
              try { localStorage.setItem(`fixit_syndic_immeubles_${uid}`, JSON.stringify(realImmeubles)) } catch {}
            }
          }
        }
        // Charger planning events depuis Supabase (partagés entre tous les membres)
        if (peRes.ok) {
          const { events: dbEvents, needsMigration } = await peRes.json()
          if (needsMigration) {
            setPlanningNeedsMigration(true)
          } else if (dbEvents) {
            setPlanningEvents(dbEvents)
            try { localStorage.setItem(`fixit_planning_events_${uid}`, JSON.stringify(dbEvents)) } catch {}
          }
        }

        // Charger canal interne depuis Supabase (partagé entre tous les membres)
        if (ciRes.ok) {
          const { messages: dbMsgs } = await ciRes.json()
          if (dbMsgs && dbMsgs.length > 0) {
            const converted: CanalInterneMsg[] = dbMsgs.map((m: any) => {
              // Le contenu est un JSON sérialisé du CanalInterneMsg complet
              try {
                const parsed = JSON.parse(m.texte)
                if (parsed && parsed.contenu) return { ...parsed, id: m.id, lu: m.lu ?? true }
              } catch {}
              return { id: m.id, de: m.auteur, deRole: m.auteurRole || '', type: 'message' as const, contenu: m.texte, date: m.createdAt, lu: m.lu ?? true }
            })
            setCanalInterneMessages(converted)
          }
        }

        // Charger membres de l'équipe depuis Supabase
        if (teamRes.ok) {
          const { members } = await teamRes.json()
          if (members) setTeamMembers(members.filter((m: any) => m.is_active !== false))
        }

      } catch { /* silencieux — Supabase optionnel */ }
    }
    getUser()
  }, [])

  // ── Polling toutes les 15s — sync planning + canal interne entre membres équipe ─
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        const h = { 'Authorization': `Bearer ${token}` }

        const [peRes, ciRes] = await Promise.all([
          fetch('/api/syndic/planning-events', { headers: h }),
          fetch('/api/syndic/canal-interne', { headers: h }),
        ])

        if (peRes.ok) {
          const { events } = await peRes.json()
          if (events) setPlanningEvents(events)
        }
        if (ciRes.ok) {
          const { messages: dbMsgs } = await ciRes.json()
          if (dbMsgs && dbMsgs.length > 0) {
            const converted: CanalInterneMsg[] = dbMsgs.map((m: any) => {
              try {
                const p = JSON.parse(m.texte)
                if (p?.contenu) return { ...p, id: m.id, lu: m.lu ?? true }
              } catch {}
              return { id: m.id, de: m.auteur, deRole: m.auteurRole || '', type: 'message' as const, contenu: m.texte, date: m.createdAt, lu: m.lu ?? true }
            })
            setCanalInterneMessages(converted)
          }
        }
      } catch { /* silencieux */ }
    }
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [dataLoaded, user?.id])

  // ── Sauvegarder missions dans localStorage à chaque changement ───────────────
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    try { localStorage.setItem(`fixit_syndic_missions_${user.id}`, JSON.stringify(missions)) } catch {}
  }, [missions, dataLoaded, user?.id])

  // ── Sauvegarder immeubles dans localStorage à chaque changement ──────────────
  useEffect(() => {
    if (!dataLoaded || !user?.id) return
    try { localStorage.setItem(`fixit_syndic_immeubles_${user.id}`, JSON.stringify(immeubles)) } catch {}
  }, [immeubles, dataLoaded, user?.id])

  // ── Sauvegarder bâtiments connus dans localStorage ───────────────────────────
  useEffect(() => {
    if (!user?.id || batimentsConnus.length === 0) return
    try { localStorage.setItem(`fixit_syndic_batiments_${user.id}`, JSON.stringify(batimentsConnus)) } catch {}
  }, [batimentsConnus, user?.id])

  // ── Helper : mémoriser un bâtiment saisi ────────────────────────────────────
  const enregistrerBatiment = (nom: string) => {
    const n = nom.trim()
    if (!n) return
    setBatimentsConnus(prev => prev.includes(n) ? prev : [...prev, n].sort())
  }

  // ── Charger les artisans depuis l'API quand on ouvre la page artisans ────────
  useEffect(() => {
    if (page === 'artisans' && !artisansLoaded && user) {
      fetchArtisans()
    }
  }, [page, user, artisansLoaded])

  const fetchArtisans = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/syndic/artisans', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.artisans && data.artisans.length > 0) {
          // Convertir format API → format Artisan local
          const mapped: Artisan[] = data.artisans.map((a: Artisan) => ({
            ...a,
            nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
            rcProValide: a.rc_pro_valide ?? a.rcProValide ?? false,
            rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration ?? '',
            nbInterventions: a.nb_interventions ?? a.nbInterventions ?? 0,
            vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie ?? false,
          }))
          setArtisans(mapped)
        }
        setArtisansLoaded(true)
      }
    } catch { /* silencieux */ }
  }

  // ── Charger messages du canal de communication ────────────────────────────────
  const fetchMessages = async (artisan: Artisan) => {
    if (!artisan.artisan_user_id) return
    setMsgLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/syndic/messages?artisan_id=${artisan.artisan_user_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch { /* silencieux */ }
    setMsgLoading(false)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || !selectedArtisanChat?.artisan_user_id) return
    const content = msgInput.trim()
    setMsgInput('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      await fetch('/api/syndic/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content,
          artisan_user_id: selectedArtisanChat.artisan_user_id,
        })
      })
      await fetchMessages(selectedArtisanChat)
    } catch { /* silencieux */ }
  }

  // ── Ajouter/créer un artisan ─────────────────────────────────────────────────
  const handleArtisanEmailSearch = async (email: string) => {
    if (!email || !email.includes('@')) return
    setArtisanSearchLoading(true)
    setArtisanSearchResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/syndic/artisans/search?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setArtisanSearchResult(data)
        if (data.found) {
          // Auto-remplir les champs avec les infos du compte existant
          const fullName = data.name || ''
          const parts = fullName.trim().split(' ')
          // "Lepore Sebastien" ou "Sebastien Lepore" — le prénom est généralement le 1er mot
          const prenom = parts.length > 1 ? parts[0] : ''
          const nom = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || ''
          setArtisanForm(f => ({
            ...f,
            nom,
            prenom,
            ...(data.telephone ? { telephone: data.telephone } : {}),
            ...(data.metier ? { metier: data.metier } : {}),
            ...(data.siret ? { siret: data.siret } : {}),
          }))
        }
      } else {
        // Même si l'API renvoie une erreur, on affiche "non trouvé"
        setArtisanSearchResult({ found: false })
      }
    } catch {
      setArtisanSearchResult({ found: false })
    }
    setArtisanSearchLoading(false)
  }

  const handleAddArtisan = async (createAccount: boolean) => {
    setArtisanError('')
    setArtisanSuccess('')
    setArtisanSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/syndic/artisans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...artisanForm, action: createAccount ? 'create' : 'link' })
      })
      const data = await res.json()
      if (!res.ok) {
        setArtisanError(data.error || 'Erreur lors de l\'ajout')
      } else {
        setArtisanSuccess(data.message || 'Artisan ajouté avec succès !')
        setArtisansLoaded(false) // Forcer rechargement
        setTimeout(() => {
          setShowModalArtisan(false)
          setArtisanForm({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' })
          setArtisanSearchResult(null)
          setArtisanSuccess('')
          fetchArtisans()
        }, 1500)
      }
    } catch {
      setArtisanError('Une erreur est survenue')
    }
    setArtisanSubmitting(false)
  }

  const handleDeleteArtisan = async (artisanId: string, artisanNom: string) => {
    if (!window.confirm(`Supprimer ${artisanNom} de votre cabinet ? Cette action est irréversible.`)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/syndic/artisans?artisan_id=${artisanId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setArtisans(prev => prev.filter(a => a.id !== artisanId))
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      alert('Une erreur est survenue')
    }
  }

  useEffect(() => {
    iaEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [iaMessages])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/syndic/login'
  }

  const sendCanalInterne = async () => {
    const contenuOk = canalInterneInput.trim() ||
      (canalInterneType === 'planning' && canalPlanResident.trim())
    if (!contenuOk) return

    const autoContenu = canalInterneType === 'planning' && !canalInterneInput.trim()
      ? `Visite ${canalPlanResident} à ${canalPlanHeure} — ${canalPlanResidence}`
      : canalInterneInput.trim()

    const msg: CanalInterneMsg = {
      id: Date.now().toString(),
      de: userName,
      deRole: ROLE_LABELS_TEAM[userRole] || 'Gestionnaire',
      type: canalInterneType,
      contenu: autoContenu,
      date: new Date().toISOString(),
      lu: true,
      ...(canalInterneType === 'planning' ? {
        planningDate: canalPlanDate,
        planningHeure: canalPlanHeure,
        planningResident: canalPlanResident,
        planningResidence: canalPlanResidence,
        planningMissionCreee: false,
      } : {}),
      ...(canalInterneType === 'tache' ? {
        tacheAssignee: canalTacheAssignee,
        tachePriorite: canalTachePriorite,
        tacheStatut: 'en_attente' as const,
      } : {}),
    }

    if (canalInterneType === 'planning' && canalPlanDate && canalPlanResident.trim()) {
      const newMission: Mission = {
        id: `ci-${Date.now()}`,
        type: `Visite — ${canalPlanResident}`,
        description: canalInterneInput.trim() || `Visite ${canalPlanResident} à ${canalPlanHeure}, ${canalPlanResidence}`,
        statut: 'en_attente',
        priorite: 'planifiee',
        dateCreation: new Date().toISOString(),
        dateIntervention: canalPlanDate,
        immeuble: canalPlanResidence || '',
        artisan: '',
        locataire: canalPlanResident,
        telephoneLocataire: '',
        demandeurNom: userName,
        demandeurRole: 'technicien',
        canalMessages: [],
      }
      setMissions(prev => {
        const updated = [newMission, ...prev]
        try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
        return updated
      })
      msg.planningMissionCreee = true
    }

    setCanalInterneMessages(prev => [...prev, msg])
    setCanalInterneInput('')
    if (canalInterneType === 'planning') {
      setCanalPlanResident('')
      setCanalPlanResidence('')
    }
    if (canalInterneType === 'tache') setCanalTacheAssignee('')
    setTimeout(() => canalInterneEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    // Sauvegarder en DB pour partage entre membres équipe
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/syndic/canal-interne', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auteur: msg.de,
            auteurRole: msg.deRole,
            // Stocker le JSON complet du message pour préserver les champs spéciaux
            texte: JSON.stringify(msg),
            sujet: '',
          }),
        })
      }
    } catch { /* silencieux — l'optimistic update est déjà en place */ }
  }

  const addPlanningEvent = async () => {
    if (!planningEventForm.titre.trim() || !selectedPlanningDay) return
    const assignedMember = teamMembers.find(m => m.full_name === planningEventForm.assigneA)
    const newEvent: PlanningEvent = {
      id: `tmp-${Date.now()}`,
      titre: planningEventForm.titre.trim(),
      date: selectedPlanningDay,
      heure: planningEventForm.heure,
      dureeMin: planningEventForm.dureeMin,
      type: planningEventForm.type,
      assigneA: planningEventForm.assigneA || userName,
      assigneRole: planningEventForm.assigneA
        ? (assignedMember ? ROLE_LABELS_TEAM[assignedMember.role] || assignedMember.role : '')
        : (ROLE_LABELS_TEAM[userRole] || 'Gestionnaire'),
      description: planningEventForm.description,
      creePar: userName,
      statut: 'planifie',
    }
    // Optimistic update local
    setPlanningEvents(prev => [...prev, newEvent])
    setShowPlanningModal(false)
    setPlanningEventForm({ titre: '', type: 'visite', heure: '09:00', dureeMin: 60, assigneA: '', description: '' })

    // Sauvegarder en DB pour partage entre membres équipe
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/syndic/planning-events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        })
        if (res.ok) {
          const { event } = await res.json()
          // Remplacer l'ID temporaire par l'UUID Supabase
          if (event?.id) {
            setPlanningEvents(prev => prev.map(e => e.id === newEvent.id ? { ...e, id: event.id } : e))
          }
        } else if ((await res.json().catch(() => ({}))).error === 'needsMigration') {
          setPlanningNeedsMigration(true)
        }
      }
    } catch { /* silencieux — optimistic update déjà en place */ }
  }

  // ── Gestion Immeubles ────────────────────────────────────────────────────────
  const openAddImmeuble = () => {
    setEditingImmeuble(null)
    setImmeubleForm({ nom: '', adresse: '', ville: '', codePostal: '', nbLots: 1, anneeConstruction: 2000, typeImmeuble: 'Copropriété', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, nbInterventions: 0 })
    setShowModalImmeuble(true)
  }
  const openEditImmeuble = (imm: Immeuble) => {
    setEditingImmeuble(imm)
    setImmeubleForm({ ...imm })
    setShowModalImmeuble(true)
  }
  const handleSaveImmeuble = async () => {
    if (!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()) return
    enregistrerBatiment(immeubleForm.nom || '')

    // Optimistic update local
    if (editingImmeuble) {
      setImmeubles(prev => prev.map(i => i.id === editingImmeuble.id ? { ...i, ...immeubleForm } as Immeuble : i))
    } else {
      const newImm: Immeuble = {
        id: Date.now().toString(),
        nom: immeubleForm.nom || '',
        adresse: immeubleForm.adresse || '',
        ville: immeubleForm.ville || '',
        codePostal: immeubleForm.codePostal || '',
        nbLots: immeubleForm.nbLots || 1,
        anneeConstruction: immeubleForm.anneeConstruction || 2000,
        typeImmeuble: immeubleForm.typeImmeuble || 'Copropriété',
        gestionnaire: immeubleForm.gestionnaire || '',
        prochainControle: immeubleForm.prochainControle,
        nbInterventions: 0,
        budgetAnnuel: immeubleForm.budgetAnnuel || 0,
        depensesAnnee: immeubleForm.depensesAnnee || 0,
      }
      setImmeubles(prev => [newImm, ...prev])
    }
    setShowModalImmeuble(false)

    // Sync Supabase en arrière-plan
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      if (editingImmeuble) {
        await fetch('/api/syndic/immeubles', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: editingImmeuble.id, ...immeubleForm }),
        })
      } else {
        const res = await fetch('/api/syndic/immeubles', {
          method: 'POST',
          headers,
          body: JSON.stringify(immeubleForm),
        })
        if (res.ok) {
          const { immeuble } = await res.json()
          // Remplacer l'ID local par l'UUID Supabase
          if (immeuble?.id) {
            setImmeubles(prev => prev.map(i => i.nom === immeubleForm.nom && !i.id?.includes('-') ? { ...i, id: immeuble.id } : i))
          }
        }
      }
    } catch { /* silencieux */ }
  }
  const handleDeleteImmeuble = async (id: string) => {
    if (!confirm('Supprimer cet immeuble ? Cette action est irréversible.')) return
    setImmeubles(prev => prev.filter(i => i.id !== id))
    // Sync Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      await fetch(`/api/syndic/immeubles?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch { /* silencieux */ }
  }

  // ── Gestion Missions ─────────────────────────────────────────────────────────
  const getFilteredMissions = () => {
    switch (missionsFilter) {
      case 'Urgentes': return missions.filter(m => m.priorite === 'urgente')
      case 'En cours': return missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee')
      case 'Terminées': return missions.filter(m => m.statut === 'terminee')
      default: return missions
    }
  }
  const handleValiderMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, statut: 'acceptee' as const } : m))
  }

  const handleDeleteMission = async (id: string) => {
    if (!confirm('Supprimer cette mission définitivement ? Cette action est irréversible.')) return
    // Suppression immédiate de l'état local
    setMissions(prev => prev.filter(m => m.id !== id))
    // Suppression localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
      localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(stored.filter((m: any) => m.id !== id)))
    } catch {}
    // Suppression Supabase
    try { await fetch(`/api/syndic/missions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  }

  const handleDeletePlanningEvent = async (id: string) => {
    if (!confirm('Supprimer cet événement du planning ?')) return
    setPlanningEvents(prev => prev.filter(e => e.id !== id))
    // Supprimer en DB aussi
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch(`/api/syndic/planning-events?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
      }
    } catch {}
  }

  // ── Gestion Alertes ──────────────────────────────────────────────────────────
  const handleTraiterAlerte = (id: string) => {
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  // ── Planning navigation ──────────────────────────────────────────────────────
  const planningYear = planningDate.getFullYear()
  const planningMonth = planningDate.getMonth()
  const planningMonthLabel = planningDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const planningDaysInMonth = new Date(planningYear, planningMonth + 1, 0).getDate()
  const planningFirstDay = new Date(planningYear, planningMonth, 1).getDay() // 0=dim
  const planningOffset = planningFirstDay === 0 ? 6 : planningFirstDay - 1 // lundi=0
  const todayDay = new Date().getDate()
  const isCurrentMonth = planningYear === new Date().getFullYear() && planningMonth === new Date().getMonth()

  // ── Paramètres ───────────────────────────────────────────────────────────────
  const handleSaveParams = () => {
    // Sauvegarde locale (pour une vraie implémentation, appeler l'API Supabase)
    setParamSaved(true)
    setTimeout(() => setParamSaved(false), 2500)
  }

  // ── Contexte complet cabinet ─────────────────────────────────────────────────
  const buildSyndicContext = () => ({
    cabinet: { nom: companyName, gestionnaire: userName },
    immeubles: immeubles.map(i => ({
      nom: i.nom, ville: i.ville, nbLots: i.nbLots,
      budgetAnnuel: i.budgetAnnuel, depensesAnnee: i.depensesAnnee,
      pctBudget: i.budgetAnnuel > 0 ? Math.round(i.depensesAnnee / i.budgetAnnuel * 100) : 0,
    })),
    artisans: artisans.map(a => ({
      nom: a.nom, metier: a.metier, statut: a.statut,
      email: a.email, // IMPORTANT : pour l'attribution vocale de missions
      telephone: a.telephone,
      rcProValide: a.rc_pro_valide ?? a.rcProValide,
      rcProExpiration: a.rc_pro_expiration ?? a.rcProExpiration,
      note: a.note, vitfixCertifie: a.vitfix_certifie ?? a.vitfixCertifie,
      artisan_user_id: a.artisan_user_id,
    })),
    missions: missions.map(m => ({
      immeuble: m.immeuble, artisan: m.artisan, type: m.type,
      description: m.description, priorite: m.priorite, statut: m.statut,
      dateIntervention: m.dateIntervention, montantDevis: m.montantDevis,
    })),
    alertes: alertes.map(a => ({ type: a.type, message: a.message, urgence: a.urgence })),
    echeances: ECHEANCES_DEMO,
    coproprios_count: (() => { try { const k = Object.keys(localStorage).find(k => k.startsWith('fixit_copros_')); return k ? JSON.parse(localStorage.getItem(k) || '[]').length : 0 } catch { return 0 } })(),
    stats: {
      totalBudget: immeubles.reduce((s, i) => s + i.budgetAnnuel, 0),
      totalDepenses: immeubles.reduce((s, i) => s + i.depensesAnnee, 0),
      missionsUrgentes: missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee').length,
      artisansRcExpiree: artisans.filter(a => !a.rcProValide).length,
    },
  })

  // ── Refresh missions depuis la DB (après mutation IA) ───────────────────────
  const refreshMissionsFromDB = async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s?.access_token) return
      const res = await fetch('/api/syndic/missions', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
      if (res.ok) {
        const { missions: dbMissions } = await res.json()
        if (dbMissions) {
          setMissions(dbMissions)
          try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(dbMissions)) } catch {}
        }
      }
    } catch { /* silencieux */ }
  }

  // ── Journal d'audit actions IA ──────────────────────────────────────────────
  const logAiAction = (actionType: string, actionData: any, result: 'success' | 'error' | 'cancelled', details?: string) => {
    try {
      const key = `fixit_syndic_audit_${user?.id}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      existing.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        actionType, actionData, result,
        details: details || '',
        user: userName,
      })
      if (existing.length > 200) existing.length = 200
      localStorage.setItem(key, JSON.stringify(existing))
    } catch {}
    console.info(`[Max AI Audit] ${result.toUpperCase()}: ${actionType}`, actionData)
  }

  // ── NLP Pré-traitement vocal — détection d'intention + normalisation ────────
  const preprocessVoiceCommand = (transcript: string): { type: 'navigate' | 'ai_query'; text: string; page?: string } => {
    const t = transcript.toLowerCase().trim()

    // Navigation rapide (exécution instantanée, sans IA)
    const navPatterns: [RegExp, string][] = [
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:missions?|interventions?)/, 'missions'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:alertes?|urgences?)/, 'alertes'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:artisans?|prestataires?)/, 'artisans'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:immeubles?|bâtiments?|résidences?)/, 'immeubles'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:budget|comptabilité|finances?|compta)/, 'facturation'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:documents?|courriers?)/, 'documents'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:accueil|tableau de bord|dashboard)/, 'accueil'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:échéances?|réglementaire|contrôles?)/, 'reglementaire'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:canal|messagerie|messages?)/, 'canal'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:planning|agenda|calendrier)/, 'planning'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:paramètres?|réglages?|settings?)/, 'parametres'],
      [/(?:va|aller|montre|affiche|ouvre|accède)[^\n]*(?:équipe|collaborateurs?|personnel)/, 'equipe'],
    ]

    for (const [pattern, page] of navPatterns) {
      if (pattern.test(t)) {
        return { type: 'navigate', text: transcript, page }
      }
    }

    // Normalisation des erreurs STT courantes en gestion immobilière
    let normalized = transcript
      // Noms propres fréquents déformés par le STT
      .replace(/\ble?\s*port\b/gi, 'Lepore')
      .replace(/\bpar\s*corot?\b/gi, 'Parc Corot')
      .replace(/\bla\s*cacia[s]?\b/gi, 'Les Acacias')
      // Termes métier
      .replace(/\bpart[ie]?\s*commun[es]?\b/gi, 'partie commune')
      .replace(/\bélagage?\b/gi, 'élagage')
      .replace(/\bplombe?rie?\b/gi, 'plomberie')
      .replace(/\bélectricit[ée]?\b/gi, 'électricité')
      .replace(/\bserrur[ie]+r?\b/gi, 'serrurerie')
      .replace(/\bdégâts?\s*des?\s*eaux?\b/gi, 'dégât des eaux')
      .replace(/\bchauffe?\s*eau\b/gi, 'chauffe-eau')
      .replace(/\bdigicode?\b/gi, 'digicode')
      // Priorités parlées
      .replace(/\b(?:très\s+)?urgent[e]?\b/gi, 'urgente')
      .replace(/\bnormal[e]?\b/gi, 'normale')
      // Dates parlées (le STT écrit souvent le mot au lieu du chiffre)
      .replace(/\bpremier\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi, '1er $1')
      .replace(/\bdemain\b/gi, new Date(Date.now() + 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))
      .replace(/\baprès[\s-]demain\b/gi, new Date(Date.now() + 172800000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))
      .replace(/\blundi\s+prochain\b/gi, (() => {
        const d = new Date(); d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
        return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      })())

    return { type: 'ai_query', text: normalized }
  }

  // ── Synthèse vocale V2 — voix HD + chunked speech ─────────────────────────────
  const speakResponse = (text: string) => {
    if (!iaSpeechEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()

    // Nettoyer le markdown pour la parole
    const cleanText = text
      .replace(/##ACTION##[\s\S]*?##/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[-•]\s/g, '')
      .replace(/✅|❌|🔔|⚡|📋|📍|👤|🔧|📅|🚫|🔴/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!cleanText) return

    // Sélection de voix optimale (préférer les voix HD/Natural)
    const selectBestVoice = (): SpeechSynthesisVoice | null => {
      const voices = iaAvailableVoices.length ? iaAvailableVoices : window.speechSynthesis.getVoices()
      const frVoices = voices.filter(v => v.lang.startsWith('fr'))
      if (!frVoices.length) return null

      // Priorité : Google HD > Google > Premium > Enhanced > Default
      const priorities = ['Google', 'Premium', 'Enhanced', 'Natural', 'Amelie', 'Thomas']
      for (const prio of priorities) {
        const match = frVoices.find(v => v.name.includes(prio))
        if (match) return match
      }
      // Préférer les voix locales (moins de latence)
      return frVoices.find(v => v.localService) || frVoices[0]
    }

    // Chunked speech : découper en phrases pour les longs textes
    const chunks = cleanText.length > 300
      ? cleanText.match(/[^.!?]+[.!?]+\s*/g) || [cleanText]
      : [cleanText]

    // Limiter à 800 caractères max total
    let totalChars = 0
    const limitedChunks: string[] = []
    for (const chunk of chunks) {
      if (totalChars + chunk.length > 800) break
      limitedChunks.push(chunk.trim())
      totalChars += chunk.length
    }
    if (!limitedChunks.length) limitedChunks.push(cleanText.substring(0, 800))

    const selectedVoice = selectBestVoice()

    limitedChunks.forEach((chunk, idx) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = 'fr-FR'
      utterance.rate = 1.05
      utterance.pitch = 1.0
      if (selectedVoice) utterance.voice = selectedVoice

      if (idx === 0) utterance.onstart = () => setIaSpeaking(true)
      if (idx === limitedChunks.length - 1) {
        utterance.onend = () => setIaSpeaking(false)
        utterance.onerror = () => setIaSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  // Sauvegarder préférence TTS
  const toggleSpeechEnabled = () => {
    setIaSpeechEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(`fixit_tts_enabled_${user?.id}`, String(next)) } catch {}
      if (!next && iaSpeaking) window.speechSynthesis?.cancel()
      return next
    })
  }

  // ── Reconnaissance vocale V2 — latence optimisée + NLP + auto-restart ────────
  const startVoiceRecognition = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // Toggle off si déjà actif
    if (iaVoiceActive && iaRecognitionRef.current) {
      iaRecognitionRef.current.stop()
      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
      return
    }

    // Couper la synthèse vocale en cours (écouter > parler)
    if (iaSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIaSpeaking(false)
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    let finalTranscript = ''
    let restartCount = 0
    const MAX_RESTARTS = 3

    recognition.onstart = () => {
      setIaVoiceActive(true)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
      iaTranscriptRef.current = ''
      // Timer durée d'enregistrement
      clearInterval(iaVoiceDurationRef.current)
      iaVoiceDurationRef.current = setInterval(() => {
        setIaVoiceDuration(prev => prev + 1)
      }, 1000)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      finalTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }

      const displayText = (finalTranscript + (interim ? ' ' + interim : '')).trim()
      setIaInput(displayText)
      setIaVoiceInterim(interim)
      iaTranscriptRef.current = displayText

      // Confidence (0-1)
      const lastResult = event.results[event.results.length - 1]
      if (lastResult?.[0]?.confidence) {
        setIaVoiceConfidence(Math.round(lastResult[0].confidence * 100))
      }

      // Résultat final → auto-send après 800ms de silence
      if (lastResult?.isFinal && finalTranscript.trim()) {
        clearTimeout(iaSendTimerRef.current)
        iaSendTimerRef.current = setTimeout(() => {
          const text = iaTranscriptRef.current.trim()
          if (!text) return

          // Stop recognition
          try { recognition.stop() } catch {}
          clearInterval(iaVoiceDurationRef.current)
          setIaVoiceActive(false)
          setIaVoiceDuration(0)
          setIaVoiceInterim('')
          setIaVoiceConfidence(0)

          // NLP pré-traitement
          const processed = preprocessVoiceCommand(text)

          if (processed.type === 'navigate' && processed.page) {
            // Navigation instantanée — pas besoin de l'IA
            setPage(processed.page as Page)
            setIaInput('')
            setIaMessages(prev => [...prev,
              { role: 'user', content: `🎙️ ${text}` },
              { role: 'assistant', content: `✅ Navigation vers **${processed.page}**`, action: { type: 'navigate', page: processed.page } },
            ])
          } else {
            // Envoyer à Max via le trigger (évite les problèmes de closure)
            setIaVoiceSendTrigger(processed.text)
          }
        }, 800)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)

      // Auto-restart sur timeout "no-speech" (micro ouvert mais pas de voix)
      if (event.error === 'no-speech' && restartCount < MAX_RESTARTS) {
        restartCount++
        try { recognition.start() } catch {}
        return
      }

      // Micro refusé → désactiver la feature
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIaVoiceSupported(false)
      }

      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
      setIaVoiceInterim('')
      setIaVoiceConfidence(0)
    }

    recognition.onend = () => {
      setIaVoiceActive(false)
      clearInterval(iaVoiceDurationRef.current)
      setIaVoiceDuration(0)
    }

    iaRecognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      console.error('Failed to start voice recognition:', err)
      setIaVoiceActive(false)
    }
  }

  // Cleanup : arrêter la reconnaissance si le composant démonte
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (iaRecognitionRef.current) try { iaRecognitionRef.current.stop() } catch {}
      clearInterval(iaVoiceDurationRef.current)
      clearTimeout(iaSendTimerRef.current)
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [])

  // ── Exécution réelle des actions IA (écriture DB) ─────────────────────────────
  const executeIaAction = async (action: any, iaToken: string) => {
    try {
      if (action.type === 'create_mission') {
        // 1. Persister en base via POST /api/syndic/missions
        const res = await fetch('/api/syndic/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
          body: JSON.stringify({
            immeuble: action.immeuble || '',
            artisan: action.artisan || '',
            type: action.type_travaux || 'Divers',
            description: action.description || '',
            priorite: action.priorite || 'normale',
            statut: 'en_attente',
            dateCreation: new Date().toISOString().split('T')[0],
            dateIntervention: action.date_intervention || null,
          }),
        })
        if (!res.ok) throw new Error('Erreur création mission en base')
        const { mission } = await res.json()

        // 2. Si artisan email + date → assigner sur son agenda
        if (action.date_intervention && action.artisan_email) {
          const assignRes = await fetch('/api/syndic/assign-mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
            body: JSON.stringify({
              artisan_email: action.artisan_email,
              artisan_name: action.artisan,
              description: action.description,
              type_travaux: action.type_travaux,
              date_intervention: action.date_intervention,
              immeuble: action.immeuble,
              priorite: action.priorite || 'normale',
              notes: action.notes || '',
            }),
          })
          const d = await assignRes.json()
          if (d.success) {
            setIaMessages(prev => [...prev, {
              role: 'assistant',
              content: `✅ **Mission envoyée sur l'agenda de ${action.artisan}** — Il a reçu une notification et la mission apparaît dans son planning.`,
            }])
            speakResponse(`Mission envoyée sur l'agenda de ${action.artisan}.`)
          }
        }

        // 3. Refresh depuis DB pour cohérence
        await refreshMissionsFromDB()
        logAiAction('create_mission', action, 'success', `Mission ${mission.id} créée`)

        setIaMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Mission créée en base** — ${action.type_travaux || 'Intervention'} à ${action.immeuble || 'N/A'}${action.artisan ? ` pour ${action.artisan}` : ''}`,
        }])

      } else if (action.type === 'assign_mission') {
        // 1. D'abord créer la mission en DB
        const missionRes = await fetch('/api/syndic/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
          body: JSON.stringify({
            immeuble: action.immeuble || action.lieu || '',
            artisan: action.artisan || '',
            type: action.type_travaux || 'Intervention',
            description: action.description || '',
            priorite: action.priorite || 'normale',
            statut: 'en_attente',
            dateCreation: new Date().toISOString().split('T')[0],
            dateIntervention: action.date_intervention || null,
          }),
        })
        let dbMissionId = null
        if (missionRes.ok) {
          const { mission } = await missionRes.json()
          dbMissionId = mission?.id
        }

        // 2. Puis assigner sur l'agenda artisan (booking + notification)
        if (action.artisan_email && action.date_intervention) {
          const assignRes = await fetch('/api/syndic/assign-mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
            body: JSON.stringify({
              artisan_email: action.artisan_email,
              artisan_name: action.artisan,
              description: action.description,
              type_travaux: action.type_travaux,
              date_intervention: action.date_intervention,
              immeuble: action.immeuble || action.lieu || '',
              priorite: action.priorite || 'normale',
              notes: action.notes || '',
            }),
          })
          const d = await assignRes.json()
          const msg = d.artisan_found
            ? `✅ **Mission assignée !**\n\n📅 **${action.type_travaux || action.description}** — ${action.immeuble || action.lieu || ''}\n👤 **${action.artisan}** — ${new Date(action.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n\nNotification envoyée — la mission apparaît sur son agenda.`
            : `⚠️ Mission créée en base mais **${action.artisan}** n'a pas de compte Vitfix. Ajoutez-le dans l'onglet Artisans pour la synchronisation agenda.`
          setIaMessages(prev => [...prev, { role: 'assistant', content: msg }])
          speakResponse(d.artisan_found ? `Mission assignée à ${action.artisan}` : `Mission créée. L'artisan n'est pas encore sur Vitfix.`)
        }

        // 3. Refresh
        await refreshMissionsFromDB()
        logAiAction('assign_mission', action, 'success', `Mission DB ${dbMissionId}, assignée à ${action.artisan}`)

      } else if (action.type === 'update_mission') {
        // Mise à jour d'une mission existante
        if (!action.mission_id) {
          // Chercher par artisan + immeuble si pas d'ID
          const found = missions.find(m =>
            (action.artisan && m.artisan?.toLowerCase().includes(action.artisan.toLowerCase())) ||
            (action.immeuble && m.immeuble?.toLowerCase().includes(action.immeuble.toLowerCase()))
          )
          if (found) action.mission_id = found.id
        }

        if (!action.mission_id) {
          setIaMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Impossible de mettre à jour : mission non trouvée. Précisez l\'artisan ou l\'immeuble.' }])
          logAiAction('update_mission', action, 'error', 'mission_id non résolu')
          return
        }

        const updatePayload: Record<string, any> = { id: action.mission_id }
        if (action.statut) updatePayload.statut = action.statut
        if (action.artisan) updatePayload.artisan = action.artisan
        if (action.priorite) updatePayload.priorite = action.priorite
        if (action.description) updatePayload.description = action.description
        if (action.date_intervention) updatePayload.dateIntervention = action.date_intervention

        const res = await fetch('/api/syndic/missions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
          body: JSON.stringify(updatePayload),
        })
        if (!res.ok) throw new Error('Erreur mise à jour mission')

        await refreshMissionsFromDB()

        const statusLabels: Record<string, string> = { en_cours: 'en cours', terminee: 'terminée', annulee: 'annulée', acceptee: 'acceptée', en_attente: 'en attente' }
        setIaMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Mission mise à jour** — ${action.statut ? `Statut → ${statusLabels[action.statut] || action.statut}` : 'Modifiée avec succès'}`,
        }])
        logAiAction('update_mission', action, 'success', `Mission ${action.mission_id} mise à jour`)

      } else if (action.type === 'create_alert') {
        const newAlerte: Alerte = {
          id: Date.now().toString(),
          type: 'mission',
          message: action.message || 'Alerte créée par Max',
          urgence: action.urgence || 'moyenne',
          date: new Date().toISOString().split('T')[0],
        }
        setAlertes(prev => [newAlerte, ...prev])
        try {
          const key = `fixit_syndic_alertes_${user?.id}`
          const existing = JSON.parse(localStorage.getItem(key) || '[]')
          existing.unshift(newAlerte)
          localStorage.setItem(key, JSON.stringify(existing))
        } catch {}

        setIaMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔔 **Alerte créée** — [${newAlerte.urgence.toUpperCase()}] ${newAlerte.message}`,
        }])
        logAiAction('create_alert', action, 'success', `Alerte ${newAlerte.id}`)

      } else if (action.type === 'navigate') {
        if (action.page) setPage(action.page as Page)
        logAiAction('navigate', action, 'success', `→ ${action.page}`)

      } else if (action.type === 'send_message') {
        const targetArtisan = artisans.find(a =>
          a.nom.toLowerCase().includes((action.artisan || '').toLowerCase()) ||
          (action.artisan || '').toLowerCase().includes(a.nom.toLowerCase())
        )
        if (targetArtisan?.artisan_user_id && action.content) {
          await fetch('/api/syndic/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
            body: JSON.stringify({
              content: action.content,
              artisan_user_id: targetArtisan.artisan_user_id,
            }),
          })
          setIaMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Message envoyé à ${action.artisan}**`,
          }])
        }
        logAiAction('send_message', action, 'success', `→ ${action.artisan}`)

      } else if (action.type === 'create_document') {
        if (action.contenu) {
          setIaMessages(prev => [...prev, {
            role: 'assistant',
            content: `📄 **Document généré — ${action.type_doc || 'Courrier'}**\n\n---\n\n${action.contenu}`,
          }])
        }
        logAiAction('create_document', action, 'success', `Type: ${action.type_doc}`)
      }
    } catch (err: any) {
      console.error('[Max AI] Action execution error:', err)
      logAiAction(action.type, action, 'error', err.message)
      setIaMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Erreur lors de l'exécution** : ${err.message || 'Erreur inconnue'}. Réessayez ou créez la mission manuellement.`,
      }])
    }
  }

  // ── Envoi message Max IA ─────────────────────────────────────────────────────
  const sendIaMessage = async (overrideText?: string) => {
    const msgText = overrideText || iaInput
    if (!msgText.trim() || iaLoading) return
    const userMsg = msgText.trim()
    setIaInput('')
    setIaMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIaLoading(true)

    try {
      const { data: { session: iaSession } } = await supabase.auth.getSession()
      const iaToken = iaSession?.access_token

      const res = await fetch('/api/syndic/max-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
        body: JSON.stringify({
          message: userMsg,
          syndic_context: buildSyndicContext(),
          conversation_history: iaMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const responseText = data.response || 'Désolé, je n\'ai pas pu répondre. Réessayez.'
      const action = data.action || null

      setIaMessages(prev => [...prev, { role: 'assistant', content: responseText, action }])

      // ── Exécuter l'action si présente ─────────────────────────────────────
      if (action) {
        const CONFIRM_ACTIONS = ['create_mission', 'assign_mission', 'update_mission']
        if (CONFIRM_ACTIONS.includes(action.type)) {
          // Actions critiques → demander confirmation via carte interactive
          setIaMessages(prev => prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, actionStatus: 'pending' as const } : msg
          ))
          setIaPendingAction({ action, iaToken: iaToken || '' })
        } else {
          // Actions non-destructives → exécuter immédiatement
          executeIaAction(action, iaToken || '')
        }
      }

      speakResponse(responseText)

    } catch {
      setIaMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Vérifiez votre réseau et réessayez.' }])
    }
    setIaLoading(false)
  }

  // ── Voice send trigger — évite les closures stales dans recognition.onresult ─
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (iaVoiceSendTrigger) {
      setIaVoiceSendTrigger(null)
      setIaInput('')
      sendIaMessage(iaVoiceSendTrigger)
    }
  }, [iaVoiceSendTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirmation / Annulation action IA ──────────────────────────────────────
  const handleConfirmIaAction = async () => {
    if (!iaPendingAction) return
    const { action, iaToken } = iaPendingAction
    setIaPendingAction(null)
    setIaMessages(prev => prev.map(msg =>
      msg.actionStatus === 'pending' ? { ...msg, actionStatus: 'confirmed' as const } : msg
    ))
    await executeIaAction(action, iaToken)
  }

  const handleCancelIaAction = () => {
    if (!iaPendingAction) return
    const { action } = iaPendingAction
    setIaMessages(prev => prev.map(msg =>
      msg.actionStatus === 'pending' ? { ...msg, actionStatus: 'cancelled' as const } : msg
    ))
    setIaMessages(prev => [...prev, {
      role: 'assistant',
      content: '🚫 Action annulée. Dites-moi si vous souhaitez faire autre chose.',
    }])
    logAiAction(action.type, action, 'cancelled', 'Annulé par l\'utilisateur')
    setIaPendingAction(null)
  }

  const companyName = user?.user_metadata?.company_name || 'Mon Cabinet'
  const userName = user?.user_metadata?.full_name || 'Gestionnaire'
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)

  const userRole = user?.user_metadata?.role || 'syndic'
  const allowedPages = ROLE_PAGES[userRole] || ROLE_PAGES['syndic']

  const isModuleEnabled = (key: string): boolean => {
    if (Object.keys(enabledModules).length === 0) {
      return SYNDIC_MODULES.find(m => m.key === key)?.default ?? true
    }
    return enabledModules[key] ?? SYNDIC_MODULES.find(m => m.key === key)?.default ?? true
  }

  const toggleModule = (key: string) => {
    const updated = { ...enabledModules, [key]: !isModuleEnabled(key) }
    setEnabledModules(updated)
    if (user) localStorage.setItem(`fixit_modules_syndic_${user.id}`, JSON.stringify(updated))
  }

  // ── Ordre personnalisé — couvre TOUS les items du menu ───────────────────
  const getNavOrder = (): string[] => {
    const allIds = allNavItems.map(n => n.id as string)
    if (moduleOrder.length === 0) return allIds
    const ordered = moduleOrder.filter(k => allIds.includes(k))
    const missing = allIds.filter(k => !ordered.includes(k))
    return [...ordered, ...missing]
  }

  const saveNavOrder = (newOrder: string[]) => {
    setModuleOrder(newOrder)
    if (user) localStorage.setItem(`fixit_modules_order_syndic_${user.id}`, JSON.stringify(newOrder))
  }

  const moveNavItemUp = (id: string, visibleIds: string[]) => {
    const order = getNavOrder()
    // On bouge uniquement parmi les items visibles : trouver le précédent visible
    const visIdx = visibleIds.indexOf(id)
    if (visIdx <= 0) return
    const prevId = visibleIds[visIdx - 1]
    // Échanger dans l'ordre global
    const n = [...order]
    const a = n.indexOf(id)
    const b = n.indexOf(prevId)
    if (a === -1 || b === -1) return
    ;[n[a], n[b]] = [n[b], n[a]]
    saveNavOrder(n)
  }

  const moveNavItemDown = (id: string, visibleIds: string[]) => {
    const order = getNavOrder()
    const visIdx = visibleIds.indexOf(id)
    if (visIdx === -1 || visIdx === visibleIds.length - 1) return
    const nextId = visibleIds[visIdx + 1]
    const n = [...order]
    const a = n.indexOf(id)
    const b = n.indexOf(nextId)
    if (a === -1 || b === -1) return
    ;[n[a], n[b]] = [n[b], n[a]]
    saveNavOrder(n)
  }

  const allNavItems: { id: Page; emoji: string; label: string; badge?: number }[] = [
    { id: 'accueil', emoji: '📊', label: 'Tableau de bord' },
    { id: 'missions', emoji: '📋', label: 'Ordres de mission', badge: missions.filter(m => m.statut === 'en_cours').length },
    { id: 'pointage', emoji: '📍', label: 'Pointage Terrain' },
    { id: 'canal', emoji: '💬', label: 'Canal Communications', badge: missions.filter(m => (m.canalMessages?.length || 0) > 0).length + canalInterneMessages.filter(m => !m.lu).length },
    { id: 'planning', emoji: '📅', label: 'Planning' },
    { id: 'immeubles', emoji: '🏢', label: 'Immeubles', badge: immeubles.length },
    { id: 'artisans', emoji: '🔧', label: 'Artisans', badge: artisans.filter(a => a.statut === 'actif').length },
    { id: 'coproprios', emoji: '👥', label: 'Copropriétaires' },
    { id: 'docs_interventions', emoji: '🗂️', label: 'Documents Interventions' },
    { id: 'comptabilite_tech', emoji: '📊', label: 'Comptabilité Technique' },
    { id: 'analyse_devis', emoji: '🔍', label: 'Analyse Devis/Factures' },
    { id: 'facturation', emoji: '💶', label: 'Facturation' },
    { id: 'alertes', emoji: '🔔', label: 'Alertes', badge: alertes.filter(a => a.urgence === 'haute').length },
    { id: 'rapport', emoji: '📄', label: 'Rapport mensuel' },
    { id: 'reglementaire', emoji: '⚖️', label: 'Calendrier réglementaire' },
    { id: 'documents', emoji: '📁', label: 'Documents (GED)' },
    { id: 'compta_copro', emoji: '💶', label: 'Comptabilité Copro' },
    { id: 'ag_digitale', emoji: '🏛️', label: 'AG Digitales' },
    { id: 'impayés', emoji: '⚠️', label: 'Impayés' },
    { id: 'carnet_entretien', emoji: '📖', label: "Carnet d'Entretien" },
    { id: 'sinistres', emoji: '🚨', label: 'Sinistres' },
    { id: 'extranet', emoji: '👥', label: 'Extranet Copros' },
    { id: 'echéances', emoji: '📅', label: 'Échéances légales' },
    { id: 'recouvrement', emoji: '💸', label: 'Recouvrement auto' },
    { id: 'preparateur_ag', emoji: '📝', label: 'Préparateur AG' },
    { id: 'equipe', emoji: '👤', label: 'Mon Équipe' },
    { id: 'emails', emoji: '📧', label: 'Emails Max IA' },
    { id: 'ia', emoji: '🤖', label: 'Assistant Max IA' },
    { id: 'modules', emoji: '🧩', label: 'Mes Modules' },
    { id: 'parametres', emoji: '⚙️', label: 'Paramètres' },
  ]
  const ALWAYS_VISIBLE = ['accueil', 'immeubles', 'artisans', 'coproprios', 'alertes', 'equipe', 'parametres', 'modules', 'documents']
  const navOrder = getNavOrder()

  const navItems = allNavItems
    .filter(item => {
      if (!allowedPages.includes(item.id)) return false
      if (ALWAYS_VISIBLE.includes(item.id)) return true
      return isModuleEnabled(item.id)
    })
    .sort((a, b) => {
      // Ordre 100% personnalisé — s'applique à tous les items sans exception
      const aIdx = navOrder.indexOf(a.id)
      const bIdx = navOrder.indexOf(b.id)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })

  const totalBudget = immeubles.reduce((a, i) => a + i.budgetAnnuel, 0)
  const totalDepenses = immeubles.reduce((a, i) => a + i.depensesAnnee, 0)

  const isAdminOverride = user?.user_metadata?._admin_override === true

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
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-white transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">⚡</span>
                <span className="font-bold text-[#FFC107] text-sm">Vitfix</span>
                <span className="text-purple-400 font-bold text-sm">Pro</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{companyName}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                page === item.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.emoji}</span>
              {sidebarOpen && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 ${page === item.id ? 'bg-white/20 text-white' : 'bg-purple-600 text-white'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all text-gray-500 hover:bg-red-900/30 hover:text-red-400"
          >
            <span className="text-lg flex-shrink-0">🚪</span>
            {sidebarOpen && <span className="text-sm font-medium truncate">Déconnexion</span>}
          </button>
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
                  {ROLE_LABELS_TEAM[userRole] || 'Admin Cabinet'}
                </p>
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
              {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
            </h1>
            <p className="text-sm text-gray-500">{companyName} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge alertes urgentes */}
            {alertes.filter(a => a.urgence === 'haute').length > 0 && (
              <button onClick={() => setPage('alertes')} className="relative p-2 text-gray-500 hover:text-red-500 transition" title="Alertes urgentes">
                <span className="text-xl">⚠️</span>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {alertes.filter(a => a.urgence === 'haute').length}
                </span>
              </button>
            )}
            {/* Badge notifications in-app */}
            <div className="relative">
              <button
                onClick={() => { setNotifPanelOpen(!notifPanelOpen); if (!notifPanelOpen && notifUnread > 0) markAllNotifsRead() }}
                className="relative p-2 text-gray-500 hover:text-purple-600 transition"
                title="Notifications"
              >
                <span className="text-xl">🔔</span>
                {notifUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>
              {/* Panel notifications */}
              {notifPanelOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-sm">🔔 Notifications</span>
                    <button onClick={() => setNotifPanelOpen(false)} className="text-purple-200 hover:text-white text-lg leading-none">×</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {notifs.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Aucune notification</div>
                    ) : notifs.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-purple-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {n.type === 'rapport_intervention' ? '📋' : n.type === 'new_mission' ? '✅' : n.type === 'mission_completed' ? '🏁' : '📣'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                            {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {!n.read && <div className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0 mt-1.5" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  {notifs.length > 0 && (
                    <div className="p-3 border-t border-gray-100">
                      <button onClick={markAllNotifsRead} className="w-full text-xs text-purple-600 hover:text-purple-800 font-medium">
                        Tout marquer comme lu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowModalMission(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm flex items-center gap-2"
            >
              <span>+</span> Nouvelle mission
            </button>
          </div>
        </div>

        <div className="p-6">

          {/* ── ACCUEIL ── */}
          {page === 'accueil' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard emoji="🏢" label="Immeubles gérés" value={immeubles.length} sub={`${immeubles.reduce((a, i) => a + i.nbLots, 0)} lots au total`} color="purple" />
                <StatCard emoji="🔧" label="Artisans actifs" value={artisans.filter(a => a.statut === 'actif').length} sub={`${artisans.filter(a => a.vitfixCertifie).length} certifiés Vitfix`} color="yellow" />
                <StatCard emoji="📋" label="Missions en cours" value={missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee').length} sub={`${missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee').length} urgentes`} color="blue" />
                <StatCard emoji="🔔" label="Alertes actives" value={alertes.length} sub={`${alertes.filter(a => a.urgence === 'haute').length} urgentes`} color={alertes.filter(a => a.urgence === 'haute').length > 0 ? 'red' : 'green'} />
              </div>

              {/* Budget global */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Budget global — {new Date().getFullYear()}</h2>
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Budget total</p>
                    <p className="text-2xl font-bold text-gray-900">{totalBudget.toLocaleString('fr-FR')} €</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dépensé</p>
                    <p className="text-2xl font-bold text-orange-500">{totalDepenses.toLocaleString('fr-FR')} €</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Restant</p>
                    <p className="text-2xl font-bold text-green-600">{(totalBudget - totalDepenses).toLocaleString('fr-FR')} €</p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-700 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((totalDepenses / totalBudget) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round((totalDepenses / totalBudget) * 100)}% consommé</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Alertes urgentes */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">🔴 Alertes urgentes</h2>
                  <div className="space-y-3">
                    {alertes.filter(a => a.urgence === 'haute').map(a => (
                      <div key={a.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                        <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                        <div>
                          <p className="text-sm text-gray-800 font-medium">{a.message}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
                        </div>
                      </div>
                    ))}
                    {alertes.filter(a => a.urgence === 'haute').length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">Aucune alerte urgente ✅</p>
                    )}
                  </div>
                </div>

                {/* Missions récentes — affichées seulement si des missions existent */}
                {missions.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">📋 Missions récentes</h2>
                    <div className="space-y-3">
                      {missions.slice(0, 4).map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.immeuble}</p>
                            <p className="text-xs text-gray-500 truncate">{m.type} · {m.artisan}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <PrioriteBadge p={m.priorite} />
                            <Badge statut={m.statut} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setPage('missions')} className="w-full mt-3 text-purple-600 hover:text-purple-700 text-sm font-semibold transition">
                      Voir toutes les missions →
                    </button>
                  </div>
                )}
              </div>

              {/* Immeubles aperçu */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🏢 Mes immeubles</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {immeubles.map(i => (
                    <div key={i.id} className="border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition cursor-pointer" onClick={() => setPage('immeubles')}>
                      <h3 className="font-bold text-gray-900 text-sm mb-1">{i.nom}</h3>
                      <p className="text-xs text-gray-500 mb-3">{i.adresse}, {i.ville}</p>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>🏠 {i.nbLots} lots</span>
                        <span>📋 {i.nbInterventions} interventions</span>
                      </div>
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Budget : {Math.round((i.depensesAnnee / i.budgetAnnuel) * 100)}% consommé</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── IMMEUBLES ── */}
          {page === 'immeubles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">{immeubles.length} immeubles dans votre portefeuille</p>
                <button onClick={openAddImmeuble} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + Ajouter un immeuble
                </button>
              </div>
              {immeubles.map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{i.nom}</h3>
                      <p className="text-gray-500 text-sm">{i.adresse}, {i.codePostal} {i.ville}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                          🏢 {i.nbLots} lots
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditImmeuble(i)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition font-medium">✏️ Modifier</button>
                      <button onClick={() => handleDeleteImmeuble(i.id)} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition font-medium">🗑️ Supprimer</button>
                      <button onClick={() => setShowModalMission(true)} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition font-medium">+ Mission</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{i.nbLots}</p>
                      <p className="text-xs text-gray-500">Lots</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{i.anneeConstruction}</p>
                      <p className="text-xs text-gray-500">Construction</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{i.nbInterventions}</p>
                      <p className="text-xs text-gray-500">Interventions</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${i.prochainControle && new Date(i.prochainControle) < new Date(Date.now() + 30 * 86400000) ? 'text-red-500' : 'text-green-600'}`}>
                        {i.prochainControle ? new Date(i.prochainControle).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">Prochain contrôle</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Budget {new Date().getFullYear()}</span>
                        <span>{i.depensesAnnee.toLocaleString('fr-FR')} € / {i.budgetAnnuel.toLocaleString('fr-FR')} €</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${(i.depensesAnnee / i.budgetAnnuel) > 0.85 ? 'bg-red-500' : 'bg-purple-500'}`}
                          style={{ width: `${Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* ── Règlement de copropriété ── */}
                  {(i.reglementTexte || i.reglementPdfNom) ? (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">📜 Règlement de copropriété</span>
                        <div className="flex items-center gap-2">
                          {i.reglementDateMaj && <span className="text-xs text-gray-500">Mis à jour le {new Date(i.reglementDateMaj).toLocaleDateString('fr-FR')}</span>}
                          <button onClick={() => openEditImmeuble(i)} className="text-xs text-purple-600 hover:underline">Modifier</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        {i.reglementChargesRepartition && (
                          <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-xs">
                            <p className="text-gray-500 text-[10px]">Répartition</p>
                            <p className="font-medium text-purple-700">{i.reglementChargesRepartition}</p>
                          </div>
                        )}
                        {i.reglementMajoriteAG && (
                          <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-xs">
                            <p className="text-gray-500 text-[10px]">Majorités AG</p>
                            <p className="font-medium text-purple-700">{i.reglementMajoriteAG}</p>
                          </div>
                        )}
                        {i.reglementFondsTravaux !== undefined && (
                          <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-xs">
                            <p className="text-gray-500 text-[10px]">Fonds travaux art.14-2</p>
                            <p className={`font-medium ${i.reglementFondsTravaux ? 'text-green-600' : 'text-gray-500'}`}>{i.reglementFondsTravaux ? '✅ Oui' : '—'}</p>
                          </div>
                        )}
                        {i.reglementFondsRoulementPct !== undefined && i.reglementFondsRoulementPct > 0 && (
                          <div className="bg-purple-50 rounded-lg px-2 py-1.5 text-xs">
                            <p className="text-gray-500 text-[10px]">Fonds roulement</p>
                            <p className="font-medium text-purple-700">{i.reglementFondsRoulementPct}%</p>
                          </div>
                        )}
                      </div>
                      {i.reglementTexte && (
                        <details className="group">
                          <summary className="text-xs text-purple-600 cursor-pointer hover:underline select-none list-none flex items-center gap-1">
                            <span className="group-open:rotate-90 inline-block transition-transform">▶</span> Voir le texte du règlement
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono leading-relaxed whitespace-pre-wrap border border-gray-200">
                            {i.reglementTexte}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => openEditImmeuble(i)}
                        className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1 transition"
                      >
                        <span>📜</span> Ajouter le règlement de copropriété
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── ARTISANS ── */}
          {page === 'artisans' && !selectedArtisanChat && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">{artisans.length} artisans référencés · {artisans.filter(a => a.vitfixCertifie || a.vitfix_certifie).length} certifiés Vitfix</p>
                <button onClick={() => { setShowModalArtisan(true); setArtisanForm({ email: '', nom: '', prenom: '', telephone: '', metier: '', siret: '' }); setArtisanSearchResult(null); setArtisanError(''); setArtisanSuccess(''); }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + Ajouter un artisan
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {artisans.map(a => {
                  const certifie = a.vitfixCertifie || a.vitfix_certifie
                  const rcOk = a.rcProValide || a.rc_pro_valide
                  const rcExp = a.rcProExpiration || a.rc_pro_expiration || ''
                  const nbInterv = a.nbInterventions || a.nb_interventions || 0
                  const hasChat = !!(a.artisan_user_id)
                  return (
                    <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-6 border-2 ${a.statut === 'suspendu' ? 'border-red-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{a.nom}</h3>
                            {certifie && <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-bold">⚡ Certifié</span>}
                            {a.compte_existant && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">🔗 Synchronisé</span>}
                          </div>
                          <p className="text-sm text-gray-500">{a.metier}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#FFC107]">★ {a.note || '—'}</div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            a.statut === 'actif' ? 'bg-green-100 text-green-700' :
                            a.statut === 'suspendu' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {a.statut === 'actif' ? 'Actif' : a.statut === 'suspendu' ? 'Suspendu' : 'En attente'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                        <div>📞 {a.telephone || '—'}</div>
                        <div>📧 {a.email}</div>
                        <div>📋 {nbInterv} interventions</div>
                        <div className={`${rcOk ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                          {rcOk ? '✅ RC Pro valide' : '❌ RC Pro manquante'}
                        </div>
                      </div>
                      {!rcOk && rcExp && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-3">
                          ⚠️ RC Pro expirée le {new Date(rcExp).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {hasChat ? (
                          <button onClick={() => { setSelectedArtisanChat(a); fetchMessages(a) }} className="flex-1 text-xs bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1">
                            💬 Canal dédié
                          </button>
                        ) : (
                          <button className="flex-1 text-xs border border-gray-200 text-gray-500 py-1.5 rounded-lg cursor-not-allowed" title="Compte Vitfix non lié">
                            💬 Pas de compte lié
                          </button>
                        )}
                        <button onClick={() => setShowModalMission(true)} className="flex-1 text-xs bg-purple-600 text-white py-1.5 rounded-lg hover:bg-purple-700 transition">Créer mission</button>
                        <button
                          onClick={() => handleDeleteArtisan(a.id, a.nom)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-2 rounded-lg transition"
                          title="Retirer cet artisan du cabinet"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CANAL COMMUNICATION ARTISAN ── */}
          {page === 'artisans' && selectedArtisanChat && (
            <div className="flex flex-col h-[calc(100vh-200px)]">
              {/* Header canal */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-3">
                <button onClick={() => { setSelectedArtisanChat(null); setMessages([]) }} className="text-gray-500 hover:text-gray-600 transition">
                  ← Retour
                </button>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg font-bold text-purple-700">
                  {selectedArtisanChat.nom.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedArtisanChat.nom}</h3>
                  <p className="text-xs text-gray-500">{selectedArtisanChat.metier} · Canal dédié interventions</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setShowModalMission(true)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition">
                    + Nouvelle mission
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-y-auto space-y-3 mb-4">
                {msgLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!msgLoading && messages.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="font-medium">Canal de communication dédié</p>
                    <p className="text-sm mt-1">Envoyez votre premier message à {selectedArtisanChat.nom}</p>
                    <p className="text-xs mt-2 text-gray-300">Les missions assignées, rapports et proof of work apparaîtront ici</p>
                  </div>
                )}
                {messages.map(msg => {
                  const isMine = msg.sender_role === 'syndic'
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        {!isMine && <p className="text-xs font-semibold mb-1 text-purple-600">{msg.sender_name}</p>}
                        {msg.message_type === 'proof_of_work' && <p className="text-xs font-bold mb-1">📸 Proof of Work</p>}
                        {msg.message_type === 'rapport' && <p className="text-xs font-bold mb-1">📋 Rapport d'intervention</p>}
                        {msg.message_type === 'devis' && <p className="text-xs font-bold mb-1">💶 Devis</p>}
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-purple-200' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isMine && msg.read_at && ' · Lu'}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Zone de saisie */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex gap-2">
                <input
                  type="text"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={`Message à ${selectedArtisanChat.nom}...`}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={sendMessage}
                  disabled={!msgInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                >
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {/* ── MISSIONS ── */}
          {page === 'missions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {(['Toutes', 'Urgentes', 'En cours', 'Terminées'] as const).map(f => (
                    <button key={f} onClick={() => setMissionsFilter(f)} className={`text-sm px-3 py-1.5 rounded-lg border transition ${missionsFilter === f ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold' : 'border-gray-200 hover:border-purple-400 hover:text-purple-600'}`}>
                      {f}
                      {f === 'Urgentes' && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.priorite === 'urgente').length}</span>}
                      {f === 'En cours' && <span className="ml-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee').length}</span>}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowModalMission(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + Nouvelle mission
                </button>
              </div>
              {getFilteredMissions().length === 0 && (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
                  Aucune mission pour ce filtre
                </div>
              )}
              <div className="space-y-3">
                {getFilteredMissions().map(m => (
                  <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 hover:border-purple-200 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PrioriteBadge p={m.priorite} />
                          <Badge statut={m.statut} />
                          <span className="text-xs text-gray-500">#{m.id}</span>
                          {m.locataire && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">👤 {m.locataire}</span>}
                          {m.etage && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🏢 {m.batiment ? `Bât. ${m.batiment} · ` : ''}Ét. {m.etage}</span>}
                        </div>
                        <h3 className="font-bold text-gray-900">{m.immeuble}</h3>
                        <p className="text-sm text-gray-600">{m.type} · {m.description}</p>
                        {m.numLot && <p className="text-xs text-gray-500 mt-0.5">Lot {m.numLot}</p>}
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        {m.montantDevis && <p className="text-sm font-semibold text-gray-900">{m.montantDevis.toLocaleString('fr-FR')} €</p>}
                        {m.montantFacture && <p className="text-xs text-green-600">Facturé : {m.montantFacture.toLocaleString('fr-FR')} €</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span>🔧 {m.artisan}</span>
                        {m.dateIntervention && <span>📅 {new Date(m.dateIntervention).toLocaleDateString('fr-FR')}</span>}
                        {(m.canalMessages?.length || 0) > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">💬 {m.canalMessages!.length} msg</span>}
                      </div>
                      <div className="flex gap-2">
                        {m.statut === 'en_attente' && (
                          <button onClick={() => handleValiderMission(m.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition font-medium">✅ Valider</button>
                        )}
                        {m.statut === 'terminee' && (
                          <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition font-medium">📄 Rapport</button>
                        )}
                        <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition font-medium">📋 Ouvrir</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMission(m.id) }} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200 transition font-medium" title="Supprimer la mission">🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CANAL COMMUNICATIONS ── */}
          {page === 'canal' && (
            <div className="space-y-4">
              {/* Onglets Artisans / Interne */}
              <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setCanalInternalTab('artisans')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${canalInternalTab === 'artisans' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  💬 Canal Artisans
                </button>
                <button
                  onClick={async () => {
                    setCanalInternalTab('interne')
                    setCanalInterneMessages(prev => prev.map(m => ({ ...m, lu: true })))
                    // Marquer comme lu en DB
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (session?.access_token) {
                        await fetch('/api/syndic/canal-interne', {
                          method: 'PATCH',
                          headers: { 'Authorization': `Bearer ${session.access_token}` },
                        })
                      }
                    } catch {}
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition relative ${canalInternalTab === 'interne' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  🏢 Canal Interne
                  {canalInterneMessages.filter(m => !m.lu).length > 0 && canalInternalTab !== 'interne' && (
                    <span className="absolute top-2 right-6 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {canalInterneMessages.filter(m => !m.lu).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Canal Artisans */}
              {canalInternalTab === 'artisans' && (
                <CanalCommunicationsPage
                  missions={missions}
                  artisans={artisans}
                  userRole={userRole}
                  user={user}
                  onUpdateMission={(updated) => {
                    setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
                    try {
                      const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
                      const newStored = stored.map((m: Mission) => m.id === updated.id ? updated : m)
                      if (!newStored.find((m: Mission) => m.id === updated.id)) newStored.unshift(updated)
                      localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(newStored))
                    } catch {}
                  }}
                  onAddMission={(newM) => {
                    setMissions(prev => {
                      const updated = [newM, ...prev]
                      try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
                      return updated
                    })
                  }}
                  onOpenMission={(m) => { setSelectedMission(m); setShowMissionDetails(true) }}
                  onCreateMission={() => setShowModalMission(true)}
                />
              )}

              {/* Canal Interne */}
              {canalInternalTab === 'interne' && (
                <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 230px)' }}>

                  {/* En-tête */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <span className="text-xl">🏢</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Canal Interne — Équipe Syndic</p>
                      <p className="text-xs text-gray-500">Assignez des tâches, ajoutez des rendez-vous au planning</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {canalInterneMessages.length === 0 && (
                      <div className="text-center py-16 text-gray-500">
                        <p className="text-4xl mb-3">🏢</p>
                        <p className="font-medium text-gray-600">Canal interne vide</p>
                        <p className="text-sm">Envoyez un message à votre équipe ci-dessous</p>
                      </div>
                    )}
                    {[...canalInterneMessages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(msg => {
                      const isMine = msg.de === userName
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {!isMine && (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 mr-2 flex-shrink-0 mt-1">
                              {msg.de.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={`max-w-[72%]`}>
                            {!isMine && (
                              <p className="text-xs text-gray-500 mb-1 ml-1">{msg.de} · <span className="text-purple-600">{msg.deRole}</span></p>
                            )}

                            {/* Planning card */}
                            {msg.type === 'planning' && (
                              <div className={`rounded-2xl overflow-hidden border-2 border-blue-200 ${isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                                <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2">
                                  <span>📅</span>
                                  <span className="text-xs font-bold tracking-wide">AJOUT AU PLANNING</span>
                                </div>
                                <div className="bg-blue-50 px-4 py-3">
                                  <p className="font-bold text-gray-900">{msg.planningResident}</p>
                                  <p className="text-blue-700 font-semibold text-sm">{msg.planningHeure} · {msg.planningResidence}</p>
                                  {msg.contenu && <p className="text-gray-600 text-xs mt-1 italic">{msg.contenu}</p>}
                                  <p className="text-xs text-gray-500 mt-1">
                                    {msg.planningDate && new Date(msg.planningDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                  </p>
                                  {msg.planningMissionCreee ? (
                                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-medium">
                                      ✓ Ajouté au planning
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const newMission: Mission = {
                                          id: `ci-btn-${msg.id}`,
                                          type: `Visite — ${msg.planningResident}`,
                                          description: msg.contenu || `Visite ${msg.planningResident} à ${msg.planningHeure}, ${msg.planningResidence}`,
                                          statut: 'en_attente',
                                          priorite: 'planifiee',
                                          dateCreation: msg.date,
                                          dateIntervention: msg.planningDate,
                                          immeuble: msg.planningResidence || '',
                                          artisan: '',
                                          locataire: msg.planningResident,
                                          telephoneLocataire: '',
                                          demandeurNom: msg.de,
                                          demandeurRole: 'technicien',
                                          canalMessages: [],
                                        }
                                        setMissions(prev => {
                                          const updated = [newMission, ...prev]
                                          try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
                                          return updated
                                        })
                                        setCanalInterneMessages(prev => prev.map(m => m.id === msg.id ? { ...m, planningMissionCreee: true } : m))
                                      }}
                                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-full font-medium transition"
                                    >
                                      + Ajouter au planning
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Tâche card */}
                            {msg.type === 'tache' && (
                              <div className={`rounded-2xl overflow-hidden border-2 ${msg.tachePriorite === 'urgente' ? 'border-red-200' : 'border-amber-200'} ${isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                                <div className={`${msg.tachePriorite === 'urgente' ? 'bg-red-500' : 'bg-amber-500'} text-white px-4 py-2 flex items-center gap-2`}>
                                  <span>✅</span>
                                  <span className="text-xs font-bold tracking-wide">TÂCHE{msg.tachePriorite === 'urgente' ? ' — URGENTE 🔴' : ''}</span>
                                </div>
                                <div className={`${msg.tachePriorite === 'urgente' ? 'bg-red-50' : 'bg-amber-50'} px-4 py-3`}>
                                  <p className="text-sm text-gray-800 font-medium">{msg.contenu}</p>
                                  {msg.tacheAssignee && <p className="text-xs text-gray-500 mt-1">👤 Pour : <span className="font-medium">{msg.tacheAssignee}</span></p>}
                                  <button
                                    onClick={() => setCanalInterneMessages(prev => prev.map(m =>
                                      m.id === msg.id ? { ...m, tacheStatut: m.tacheStatut === 'terminee' ? 'en_attente' : 'terminee' } : m
                                    ))}
                                    className={`inline-flex items-center gap-1 mt-2 text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${msg.tacheStatut === 'terminee' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                  >
                                    {msg.tacheStatut === 'terminee' ? '✓ Terminée — cliquer pour rouvrir' : '⏳ En attente — marquer terminée'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Message simple */}
                            {msg.type === 'message' && (
                              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isMine ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                                {msg.contenu}
                              </div>
                            )}

                            <p className={`text-xs text-gray-500 mt-1 ${isMine ? 'text-right' : ''}`}>
                              {new Date(msg.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={canalInterneEndRef} />
                  </div>

                  {/* Zone de composition */}
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {/* Sélecteur de type */}
                    <div className="flex gap-2 mb-3">
                      {(['message', 'planning', 'tache'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setCanalInterneType(t)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${canalInterneType === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                        >
                          {t === 'message' ? '💬 Message' : t === 'planning' ? '📅 Planning' : '✅ Tâche'}
                        </button>
                      ))}
                    </div>

                    {/* Champs Planning */}
                    {canalInterneType === 'planning' && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Résident (ex: Mme Lebrun)"
                          value={canalPlanResident}
                          onChange={e => setCanalPlanResident(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Résidence (ex: Résidence Les Acacias)"
                          value={canalPlanResidence}
                          onChange={e => setCanalPlanResidence(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                        <input
                          type="date"
                          value={canalPlanDate}
                          onChange={e => setCanalPlanDate(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                        <input
                          type="time"
                          value={canalPlanHeure}
                          onChange={e => setCanalPlanHeure(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                      </div>
                    )}

                    {/* Champs Tâche */}
                    {canalInterneType === 'tache' && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Assignée à (ex: Gestionnaire Tech)"
                          value={canalTacheAssignee}
                          onChange={e => setCanalTacheAssignee(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                        <select
                          value={canalTachePriorite}
                          onChange={e => setCanalTachePriorite(e.target.value as 'normale' | 'urgente')}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white"
                        >
                          <option value="normale">Priorité normale</option>
                          <option value="urgente">🔴 Urgente</option>
                        </select>
                      </div>
                    )}

                    {/* Input + Envoyer */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={
                          canalInterneType === 'planning'
                            ? 'Note complémentaire (optionnel)…'
                            : canalInterneType === 'tache'
                            ? 'Description de la tâche…'
                            : 'Message à l\'équipe…'
                        }
                        value={canalInterneInput}
                        onChange={e => setCanalInterneInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendCanalInterne()}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 bg-white"
                      />
                      <button
                        onClick={sendCanalInterne}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl transition font-medium text-sm"
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PLANNING ── */}
          {page === 'planning' && (() => {
            const canAssign = userRole === 'syndic_secretaire' || userRole === 'syndic' || userRole === 'syndic_admin'
            const filteredEvents = planningViewFilter === 'tous'
              ? planningEvents
              : planningEvents.filter(e => e.assigneA === planningViewFilter || e.creePar === planningViewFilter)
            const monthEvents = filteredEvents.filter(e => {
              const d = new Date(e.date + 'T00:00:00')
              return d.getFullYear() === planningYear && d.getMonth() === planningMonth
            })
            const monthMissions = missions.filter(m => {
              if (!m.dateIntervention) return false
              const d = new Date(m.dateIntervention)
              return d.getFullYear() === planningYear && d.getMonth() === planningMonth
            })
            return (
              <div className="space-y-4">
                {/* Banner migration DB si table pas encore créée */}
                {planningNeedsMigration && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">Migration requise — Planning partagé</p>
                      <p className="text-xs text-amber-700 mt-1">Pour activer la synchronisation du planning entre tous les membres, exécutez ce SQL dans votre <a href="https://supabase.com/dashboard" target="_blank" className="underline font-medium">Supabase SQL Editor</a> :</p>
                      <pre className="mt-2 bg-amber-100 text-amber-900 text-xs rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS syndic_planning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_id UUID NOT NULL,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  date DATE NOT NULL,
  heure TEXT NOT NULL DEFAULT '09:00',
  duree_min INTEGER DEFAULT 60,
  assigne_a TEXT NOT NULL DEFAULT '',
  assigne_role TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cree_par TEXT NOT NULL DEFAULT '',
  statut TEXT DEFAULT 'planifie',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_events_cabinet ON syndic_planning_events(cabinet_id);`}</pre>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900 capitalize">Planning — {planningMonthLabel}</h2>
                      <button
                        onClick={() => { setSelectedPlanningDay(new Date().toISOString().slice(0,10)); setShowPlanningModal(true) }}
                        className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition font-medium"
                      >
                        + Ajouter
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Filtre employé — visible secrétaire/admin */}
                      {canAssign && (
                        <select
                          value={planningViewFilter}
                          onChange={e => setPlanningViewFilter(e.target.value)}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 bg-white"
                        >
                          <option value="tous">👥 Toute l'équipe</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.full_name}>{m.full_name}{m.role ? ` — ${ROLE_LABELS_TEAM[m.role] || m.role}` : ''}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">←</button>
                      <button onClick={() => setPlanningDate(new Date())} className={`text-sm px-3 py-1.5 rounded-lg transition ${isCurrentMonth ? 'border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>Aujourd'hui</button>
                      <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">→</button>
                    </div>
                  </div>

                  {/* Légende types */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries({ reunion: 'Réunion', visite: 'Visite', rdv: 'RDV', tache: 'Tâche', autre: 'Autre' }).map(([k, v]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[k].bg} ${EVENT_COLORS[k].text}`}>{v}</span>
                    ))}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">🔧 Mission artisan</span>
                  </div>

                  {/* Grille calendrier */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: planningOffset }, (_, i) => (
                      <div key={`empty-${i}`} className="min-h-20 p-1 rounded-lg" />
                    ))}
                    {Array.from({ length: planningDaysInMonth }, (_, i) => i + 1).map(day => {
                      const dateStr = `${planningYear}-${String(planningMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const dayMissions = missions.filter(m => m.dateIntervention === dateStr)
                      const dayEvents = filteredEvents.filter(e => e.date === dateStr)
                      const isToday = isCurrentMonth && day === todayDay
                      const total = dayMissions.length + dayEvents.length
                      return (
                        <div
                          key={day}
                          onClick={() => { setSelectedPlanningDay(dateStr); setPlanningEventForm(f => ({ ...f, heure: '09:00' })); setShowPlanningModal(true) }}
                          className={`min-h-20 p-1 rounded-lg border text-xs cursor-pointer transition group relative ${isToday ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-purple-300 hover:bg-purple-50/40'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-semibold text-xs ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>{day}</span>
                            {total > 0 && <span className="text-gray-500 text-xs">{total}</span>}
                          </div>
                          {/* Events */}
                          {dayEvents.slice(0, 2).map(e => (
                            <div key={e.id} className={`text-xs px-1 py-0.5 rounded mb-0.5 flex items-center gap-0.5 font-medium ${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`} title={`${e.heure} — ${e.titre} (${e.assigneA})`}>
                              <span className="truncate flex-1">{e.heure} {e.titre}</span>
                              <button onClick={ev => { ev.stopPropagation(); handleDeletePlanningEvent(e.id) }} className="flex-shrink-0 opacity-60 hover:opacity-100 font-bold leading-none text-xs" title="Supprimer">×</button>
                            </div>
                          ))}
                          {/* Missions */}
                          {dayMissions.slice(0, 2 - Math.min(dayEvents.length, 2)).map(m => (
                            <div key={m.id} onClick={ev => { ev.stopPropagation(); setSelectedMission(m); setShowMissionDetails(true) }} className={`text-xs p-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-80 ${m.priorite === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`} title={`${m.immeuble} — ${m.artisan}`}>
                              🔧 {m.type}
                            </div>
                          ))}
                          {total > 2 && <div className="text-gray-500 text-xs">+{total - 2}</div>}
                          {/* "+" hint on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                            <span className="text-purple-400 text-lg font-light">+</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Liste mensuelle */}
                <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-3">📋 Agenda du mois — {planningMonthLabel}</h3>
                  {monthEvents.length === 0 && monthMissions.length === 0 && (
                    <p className="text-sm text-gray-500 py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">Aucun événement ce mois</p>
                  )}
                  <div className="space-y-2">
                    {[
                      ...monthEvents.map(e => ({ key: `e-${e.id}`, date: e.date, heure: e.heure, label: e.titre, sub: e.assigneA, color: `${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`, tag: e.type, statut: e.statut, onClick: () => {}, onDelete: () => handleDeletePlanningEvent(e.id) })),
                      ...monthMissions.map(m => ({ key: `m-${m.id}`, date: m.dateIntervention!, heure: '08:00', label: `${m.immeuble} — ${m.type}`, sub: m.artisan, color: m.priorite === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700', tag: '🔧', statut: m.statut, onClick: () => { setSelectedMission(m); setShowMissionDetails(true) }, onDelete: () => handleDeleteMission(m.id) })),
                    ].sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)).map(item => (
                      <div key={item.key} onClick={item.onClick} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-xl text-sm cursor-pointer transition">
                        <div className="text-center w-14 flex-shrink-0">
                          <p className="font-bold text-purple-700 text-xs">{new Date(item.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                          <p className="text-gray-500 text-xs">{item.heure}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${item.color}`}>{item.tag}</span>
                        <span className="flex-1 font-medium truncate text-gray-800">{item.label}</span>
                        <span className="text-gray-500 text-xs flex-shrink-0 hidden md:block">{item.sub}</span>
                        <button onClick={ev => { ev.stopPropagation(); item.onDelete() }} className="flex-shrink-0 text-xs bg-red-100 text-red-500 hover:bg-red-200 px-2 py-0.5 rounded-lg transition font-medium" title="Supprimer">🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── DOCUMENTS GED ── */}
          {page === 'documents' && <GEDSection immeubles={immeubles} artisans={artisans} userId={user?.id} />}

          {/* ── FACTURATION ── */}
          {page === 'facturation' && (
            <FacturationPageWithTransferts missions={missions} user={user} userRole={userRole} onOpenMission={(m) => { setSelectedMission(m); setShowMissionDetails(true) }} />
          )}

          {/* ── COPROPRIÉTAIRES ── */}
          {page === 'coproprios' && <CopropriosSection immeubles={immeubles} userId={user?.id} />}

          {/* ── CALENDRIER RÉGLEMENTAIRE ── */}
          {page === 'reglementaire' && <CalendrierReglementaireSection immeubles={immeubles} userId={user?.id} />}

          {/* ── RAPPORT MENSUEL ── */}
          {page === 'rapport' && user && (
            <RapportMensuelSection
              immeubles={immeubles}
              missions={missions}
              artisans={artisans}
              syndicId={user.id}
              coproprios={(() => { try { const k = Object.keys(localStorage).find(k => k.startsWith('fixit_copros_')); return k ? JSON.parse(localStorage.getItem(k) || '[]') : [] } catch { return [] } })()}
            />
          )}

          {/* ── ALERTES ── */}
          {page === 'alertes' && (
            <div className="space-y-3">
              {alertes.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="font-semibold text-gray-600">Toutes les alertes ont été traitées !</p>
                </div>
              )}
              {alertes.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${
                  a.urgence === 'haute' ? 'border-l-red-500' :
                  a.urgence === 'moyenne' ? 'border-l-amber-500' : 'border-l-gray-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">
                        {a.type === 'rc_pro' ? '📄' : a.type === 'controle' ? '⚙️' : a.type === 'budget' ? '💶' : '📁'}
                      </span>
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          a.urgence === 'haute' ? 'bg-red-100 text-red-700' :
                          a.urgence === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {a.urgence === 'haute' ? '🔴 Urgente' : a.urgence === 'moyenne' ? '🟡 Moyenne' : '🟢 Basse'}
                        </span>
                        <p className="text-gray-900 font-medium mt-2">{a.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{a.date}</p>
                      </div>
                    </div>
                    <button onClick={() => handleTraiterAlerte(a.id)} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 transition font-medium ml-4 flex-shrink-0">
                      ✓ Traiter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EMAILS MAX IA ── */}
          {page === 'emails' && user && <EmailsSection syndicId={user.id} onNavigateParams={() => setPage('parametres')} />}

          {/* ── AGENT IA MAX ── */}
          {page === 'ia' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>

                {/* ── Header Max IA ── */}
                <div className="bg-gradient-to-r from-purple-700 to-purple-900 p-4 flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-purple-700"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-white font-bold text-base">Max — Expert Vitfix Pro</h2>
                      {iaSpeaking && (
                        <span className="bg-green-400/20 text-green-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Parle...
                        </span>
                      )}
                    </div>
                    <p className="text-purple-300 text-xs">Copropriété · Droit ALUR/ELAN · Artisans · Budget · Accès complet cabinet</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle synthèse vocale */}
                    <button
                      onClick={toggleSpeechEnabled}
                      title={iaSpeechEnabled ? 'Désactiver voix Max' : 'Activer voix Max'}
                      className={`p-2 rounded-lg transition text-lg ${iaSpeechEnabled ? 'bg-white/20 text-white' : 'text-purple-400 hover:text-purple-200'}`}
                    >
                      {iaSpeechEnabled ? '🔊' : '🔇'}
                    </button>
                    {/* Bouton effacer */}
                    <button
                      onClick={() => setIaMessages([{ role: 'assistant', content: 'Conversation effacée. Comment puis-je vous aider ?' }])}
                      title="Effacer la conversation"
                      className="p-2 rounded-lg text-purple-400 hover:text-purple-200 transition text-sm"
                    >
                      🗑️
                    </button>
                    {/* Stats contexte */}
                    <div className="hidden md:flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                      <span className="text-xs text-purple-200">📊 {immeubles.length} imm · 🔧 {artisans.length} art · 📋 {missions.length} missions</span>
                    </div>
                  </div>
                </div>

                {/* ── Bandeau vocal actif V2 ── */}
                {iaVoiceActive && (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Waveform animée */}
                      <div className="flex gap-0.5 items-center flex-shrink-0">
                        {[0, 1, 2, 3, 4, 5, 6].map(i => (
                          <div
                            key={i}
                            className="w-1 bg-red-500 rounded-full"
                            style={{
                              height: `${6 + Math.sin((Date.now() / 200) + i) * 8 + (i % 3) * 4}px`,
                              animation: `pulse 0.${4 + (i % 3)}s ease-in-out infinite alternate`,
                              animationDelay: `${i * 0.08}s`,
                            }}
                          />
                        ))}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-red-700 text-sm font-semibold">🎙️ Max vous écoute</span>
                          <span className="text-red-400 text-xs font-mono bg-red-100 px-1.5 py-0.5 rounded">
                            {String(Math.floor(iaVoiceDuration / 60)).padStart(2, '0')}:{String(iaVoiceDuration % 60).padStart(2, '0')}
                          </span>
                          {iaVoiceConfidence > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${iaVoiceConfidence > 80 ? 'bg-green-100 text-green-700' : iaVoiceConfidence > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {iaVoiceConfidence}%
                            </span>
                          )}
                        </div>
                        {/* Transcription live */}
                        <div className="mt-1 text-sm truncate">
                          {iaInput ? (
                            <>
                              <span className="text-gray-800">{iaInput.replace(iaVoiceInterim, '')}</span>
                              {iaVoiceInterim && <span className="text-gray-400 italic">{iaVoiceInterim}</span>}
                            </>
                          ) : (
                            <span className="text-red-400 italic text-xs">Parlez maintenant...</span>
                          )}
                        </div>
                      </div>

                      {/* Bouton stop */}
                      <button
                        onClick={() => {
                          iaRecognitionRef.current?.stop()
                          setIaVoiceActive(false)
                          clearInterval(iaVoiceDurationRef.current)
                          setIaVoiceDuration(0)
                          setIaVoiceInterim('')
                          setIaVoiceConfidence(0)
                        }}
                        className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        ⏹ Arrêter
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Zone messages ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {iaMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5">🤖</div>
                      )}
                      <div className="max-w-[85%] flex flex-col gap-1.5">
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white rounded-tr-sm'
                            : 'bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm'
                        }`}>
                          {msg.role === 'assistant' ? (
                            // Rendu markdown sécurisé (XSS-safe)
                            <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }} />
                          ) : msg.content}
                        </div>
                        {/* Badge action / Carte de confirmation */}
                        {msg.action && (
                          <div className="mt-1">
                            {msg.actionStatus === 'pending' ? (
                              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2 max-w-sm">
                                <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                                  ⚡ Action proposée :
                                  {msg.action.type === 'create_mission' && ' Créer une mission'}
                                  {msg.action.type === 'assign_mission' && ` Assigner à ${msg.action.artisan || 'un artisan'}`}
                                  {msg.action.type === 'update_mission' && ' Mettre à jour une mission'}
                                </p>
                                <div className="text-xs text-amber-700 space-y-0.5">
                                  {(msg.action.immeuble || msg.action.lieu) && <p>📍 {msg.action.immeuble || msg.action.lieu}</p>}
                                  {msg.action.artisan && <p>👤 {msg.action.artisan}</p>}
                                  {msg.action.description && <p>📋 {msg.action.description}</p>}
                                  {msg.action.type_travaux && <p>🔧 {msg.action.type_travaux}</p>}
                                  {msg.action.date_intervention && <p>📅 {new Date(msg.action.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                                  {msg.action.priorite && <p>⚡ Priorité : {msg.action.priorite}</p>}
                                  {msg.action.statut && <p>📊 Statut → {msg.action.statut}</p>}
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button onClick={handleConfirmIaAction} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg font-semibold transition">
                                    ✓ Confirmer
                                  </button>
                                  <button onClick={handleCancelIaAction} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm py-2 rounded-lg font-semibold transition">
                                    ✕ Annuler
                                  </button>
                                </div>
                              </div>
                            ) : msg.actionStatus === 'confirmed' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                                ✅ Action exécutée :
                                {msg.action.type === 'create_mission' && ` Mission créée — ${msg.action.immeuble || ''}`}
                                {msg.action.type === 'assign_mission' && ` Mission assignée — ${msg.action.artisan || ''}`}
                                {msg.action.type === 'update_mission' && ` Mission mise à jour`}
                              </span>
                            ) : msg.actionStatus === 'cancelled' ? (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                                🚫 Action annulée
                              </span>
                            ) : msg.actionStatus === 'error' ? (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                                ❌ Erreur d&apos;exécution
                              </span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                                ⚡ Action exécutée :
                                {msg.action.type === 'create_mission' && ` Mission créée — ${msg.action.immeuble || ''}`}
                                {msg.action.type === 'navigate' && ` Navigation → ${msg.action.page}`}
                                {msg.action.type === 'create_alert' && ` Alerte créée`}
                                {msg.action.type === 'send_message' && ` Message envoyé`}
                                {msg.action.type === 'create_document' && ` Document généré`}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Bouton lecture voix */}
                        {msg.role === 'assistant' && !iaSpeaking && (
                          <button
                            onClick={() => speakResponse(msg.content)}
                            className="self-start text-xs text-gray-500 hover:text-purple-600 transition flex items-center gap-1 px-1"
                          >
                            🔊 <span>Lire</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loader thinking */}
                  {iaLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">🤖</div>
                      <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm">
                        <div className="flex gap-1 items-center">
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          <span className="text-xs text-gray-500 ml-2">Max réfléchit...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={iaEndRef} />
                </div>

                {/* ── Suggestions rapides ── */}
                <div className="px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
                  {[
                    { icon: '🔴', text: 'Alertes urgentes ?' },
                    { icon: '💶', text: 'Analyse mon budget' },
                    { icon: '📋', text: 'Crée une mission urgente' },
                    { icon: '⚖️', text: 'Prochains contrôles réglementaires' },
                    { icon: '📄', text: 'Artisans RC Pro expirée ?' },
                    { icon: '✉️', text: 'Rédige un courrier convocation AG' },
                    { icon: '📊', text: 'Résumé du cabinet' },
                    { icon: '🧾', text: 'Mise en demeure impayés' },
                  ].map(s => (
                    <button
                      key={s.text}
                      onClick={() => { setIaInput(s.text); setTimeout(() => document.getElementById('ia-input')?.focus(), 50) }}
                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-purple-100 transition flex-shrink-0 flex items-center gap-1"
                    >
                      <span>{s.icon}</span> {s.text}
                    </button>
                  ))}
                </div>

                {/* ── Voice Help Overlay ── */}
                {iaVoiceHelp && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-2xl p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800 text-base">🎙️ Commandes vocales Fixy</h3>
                      <button onClick={() => setIaVoiceHelp(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">📋 Créer une mission</h4>
                        <p className="text-gray-600 italic">&quot;Crée une mission plomberie pour Dupont, Résidence Les Acacias, urgente&quot;</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">👷 Assigner un artisan</h4>
                        <p className="text-gray-600 italic">&quot;Assigne Lepore Sébastien, élagage, 10 mars, Parc Corot&quot;</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">✏️ Mettre à jour</h4>
                        <p className="text-gray-600 italic">&quot;Passe la mission de Lepore en terminée&quot;</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">🔔 Créer une alerte</h4>
                        <p className="text-gray-600 italic">&quot;Crée une alerte haute pour fuite dans le parking&quot;</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">🧭 Navigation rapide</h4>
                        <p className="text-gray-600 italic">&quot;Va aux missions&quot; · &quot;Montre les alertes&quot; · &quot;Ouvre le budget&quot;</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 mb-1">📄 Générer un document</h4>
                        <p className="text-gray-600 italic">&quot;Rédige un courrier de convocation AG&quot;</p>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-gray-500 text-xs">💡 Les commandes de navigation sont exécutées instantanément. Les missions et alertes demandent confirmation avant exécution.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Input + Micro V2 ── */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    {/* Bouton micro avec état enrichi */}
                    {iaVoiceSupported && (
                      <button
                        onClick={startVoiceRecognition}
                        title={iaVoiceActive ? 'Arrêter l\'écoute' : 'Parler à Max'}
                        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all text-lg relative ${
                          iaVoiceActive
                            ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600 hover:shadow-md'
                        }`}
                      >
                        {iaVoiceActive ? (
                          <>
                            <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-30" />
                            <span className="relative">⏹</span>
                          </>
                        ) : '🎙️'}
                      </button>
                    )}
                    <div className="flex-1 relative">
                      <input
                        id="ia-input"
                        type="text"
                        value={iaInput}
                        onChange={e => setIaInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey && !iaLoading && !iaPendingAction) sendIaMessage()
                        }}
                        placeholder={iaVoiceActive ? '🎙️ Parlez maintenant — envoi auto après silence...' : 'Posez une question à Max ou dites une action...'}
                        className={`w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none text-sm pr-10 transition ${
                          iaVoiceActive
                            ? 'border-red-300 bg-red-50 text-red-800 focus:border-red-400'
                            : 'border-gray-200 focus:border-purple-400'
                        }`}
                        disabled={iaLoading || !!iaPendingAction}
                      />
                      {iaInput && !iaVoiceActive && (
                        <button onClick={() => setIaInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 text-sm">×</button>
                      )}
                    </div>
                    <button
                      id="ia-send-btn"
                      onClick={() => sendIaMessage()}
                      disabled={iaLoading || !iaInput.trim() || !!iaPendingAction || iaVoiceActive}
                      className="flex-shrink-0 w-11 h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center font-bold text-lg transition disabled:opacity-40"
                    >
                      {iaLoading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : '↑'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-500">
                      {iaVoiceActive
                        ? '🔴 Enregistrement en cours — envoi automatique après 0.8s de silence'
                        : iaVoiceSupported
                          ? '🎙️ Commande vocale disponible · Max exécute les actions en temps réel'
                          : 'Max a accès à toutes vos données · Les actions sont exécutées en temps réel'}
                    </p>
                    {iaVoiceSupported && !iaVoiceActive && (
                      <button
                        onClick={() => setIaVoiceHelp(p => !p)}
                        className="text-xs text-purple-500 hover:text-purple-700 transition flex-shrink-0 ml-2"
                        title="Aide commandes vocales"
                      >
                        ❓ Aide
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── MON ÉQUIPE ── */}
          {page === 'compta_copro' && user && <ComptaCoproSection user={user} userRole={userRole} immeubles={immeubles} />}

          {page === 'ag_digitale' && user && <AGDigitaleSection user={user} userRole={userRole} />}
          {page === 'impayés' && user && <ImpayésSection user={user} userRole={userRole} />}
          {page === 'carnet_entretien' && user && <CarnetEntretienSection user={user} userRole={userRole} />}
          {page === 'sinistres' && user && <SinistresSection user={user} userRole={userRole} artisans={artisans} />}
          {page === 'extranet' && user && <ExtranetSection user={user} userRole={userRole} />}

          {page === 'pointage' && user && <PointageSection immeubles={immeubles} user={user} onUpdateImmeuble={(updated) => setImmeubles(prev => prev.map(i => i.id === updated.id ? updated : i))} />}

          {page === 'echéances' && user && <EcheancesSection user={user} userRole={userRole} immeubles={immeubles} />}
          {page === 'recouvrement' && user && <RecouvrementSection user={user} userRole={userRole} />}
          {page === 'preparateur_ag' && user && <PreparateurAGSection user={user} userRole={userRole} immeubles={immeubles} />}

          {page === 'equipe' && user && (
            <EquipeSection cabinetId={user.id} currentUserRole={userRole} />
          )}

          {/* ── COMPTABILITÉ TECHNIQUE ── */}
          {page === 'comptabilite_tech' && user && (
            <ComptabiliteTechSection missions={missions} artisans={artisans} immeubles={immeubles} />
          )}

          {/* ── ANALYSE DEVIS / FACTURES ── */}
          {page === 'analyse_devis' && (
            <AnalyseDevisSection artisans={artisans} setPage={setPage} missions={missions} setMissions={setMissions} user={user} />
          )}

          {/* ── DOCUMENTS INTERVENTIONS ── */}
          {page === 'docs_interventions' && (
            <DocsInterventionsSection artisans={artisans} setPage={setPage} />
          )}

          {/* ── MODULES ── */}
          {page === 'modules' && (
            <div className="max-w-4xl mx-auto">
              {(() => {
                // Modules autorisés pour ce rôle uniquement
                const roleAllowedKeys = (ROLE_PAGES[userRole] || ROLE_PAGES['syndic']) as readonly string[]
                const roleModules = SYNDIC_MODULES.filter(m => roleAllowedKeys.includes(m.key))

                // Groupes avec filtrage par rôle
                const GROUPS = [
                  {
                    title: '📋 Gestion courante',
                    keys: ['missions', 'canal', 'planning', 'facturation', 'emails', 'ia'],
                  },
                  {
                    title: '🔧 Terrain & Interventions',
                    keys: ['pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'carnet_entretien', 'sinistres'],
                  },
                  {
                    title: '🏛️ Copropriété & AG',
                    keys: ['compta_copro', 'ag_digitale', 'impayés', 'extranet', 'recouvrement', 'preparateur_ag'],
                  },
                  {
                    title: '⚖️ Réglementaire',
                    keys: ['reglementaire', 'rapport', 'echéances'],
                  },
                ]

                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">🧩 Mes modules</h2>
                        <p className="text-sm text-gray-500 mt-1">Modules disponibles pour votre poste</p>
                      </div>
                      <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-bold">
                        {roleModules.filter(m => isModuleEnabled(m.key)).length}/{roleModules.length} actifs
                      </div>
                    </div>

                    <div className="space-y-6">
                      {GROUPS.map(group => {
                        const groupMods = roleModules.filter(m => group.keys.includes(m.key))
                        if (groupMods.length === 0) return null
                        return (
                          <div key={group.title}>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{group.title}</h3>
                            <div className="grid gap-3 md:grid-cols-2">
                              {groupMods.map(mod => {
                                const enabled = isModuleEnabled(mod.key)
                                return (
                                  <div key={mod.key} className={`bg-white rounded-2xl p-4 border-2 transition-all ${enabled ? 'border-purple-300 shadow-sm' : 'border-gray-200 opacity-70'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${enabled ? 'bg-purple-100' : 'bg-gray-100'}`}>{mod.icon}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-gray-900">{mod.label}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
                                      </div>
                                      <button onClick={() => toggleModule(mod.key)} className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                        <div className="w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all" style={{ left: enabled ? '24px' : '4px' }} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* ── Ordre complet du menu — tous les items visibles ── */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">↕️ Ordre du menu</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Glissez ou utilisez ▲▼ — la sidebar se met à jour en temps réel</p>
                  </div>
                  <button
                    onClick={() => saveNavOrder(allNavItems.map(n => n.id as string))}
                    className="text-xs text-gray-500 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
                  >
                    ↺ Réinitialiser
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {(() => {
                    // Mêmes items que navItems, dans l'ordre personnalisé — sans la page "modules" elle-même
                    const visibleItems = navItems.filter(item => item.id !== 'modules')
                    const visibleIds = visibleItems.map(n => n.id as string)
                    return visibleItems.map((item, idx) => {
                      const isMod = SYNDIC_MODULES.some(m => m.key === item.id)
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all group ${isMod ? 'border-purple-200 hover:border-purple-400' : 'border-gray-200 hover:border-gray-400'}`}
                        >
                          {/* Poignée */}
                          <span className="text-gray-300 group-hover:text-gray-500 select-none text-lg leading-none font-mono">⠿</span>
                          {/* Emoji */}
                          <span className="text-xl w-6 text-center">{item.emoji}</span>
                          {/* Label */}
                          <span className="flex-1 font-semibold text-sm text-gray-800">{item.label}</span>
                          {/* Type badge */}
                          {!isMod && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">fixe</span>
                          )}
                          {/* Position */}
                          <span className="text-xs text-gray-500 font-mono w-5 text-center">{idx + 1}</span>
                          {/* Flèches */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveNavItemUp(item.id as string, visibleIds)}
                              disabled={idx === 0}
                              className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                            >▲</button>
                            <button
                              onClick={() => moveNavItemDown(item.id as string, visibleIds)}
                              disabled={idx === visibleItems.length - 1}
                              className="w-6 h-5 flex items-center justify-center rounded text-gray-500 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs font-bold"
                            >▼</button>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <div className="font-semibold text-blue-800 text-sm">Astuce</div>
                    <div className="text-xs text-blue-600 mt-0.5">Les modules désactivés disparaissent de la barre latérale mais restent accessibles à tout moment. Vos données ne sont jamais supprimées.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES ── */}
          {page === 'parametres' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Mon cabinet</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du cabinet</label>
                    <input
                      type="text"
                      value={cabinetNom}
                      onChange={e => setCabinetNom(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none"
                      placeholder="Ex : Syndic Dupont & Associés"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={cabinetEmail}
                      onChange={e => setCabinetEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveParams} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-semibold transition">
                      Sauvegarder
                    </button>
                    {paramSaved && (
                      <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                        ✅ Paramètres sauvegardés !
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Abonnement</h2>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-purple-900">Essai gratuit</p>
                      <p className="text-sm text-purple-700">14 jours restants · Accès complet</p>
                    </div>
                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">TRIAL</span>
                  </div>
                </div>
                <button className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-bold transition">
                  Choisir un abonnement → à partir de 49€/mois
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">📧 Agent Email Max IA</h2>
                <p className="text-sm text-gray-500 mb-4">Connectez votre boîte Gmail pour que Max analyse automatiquement vos emails : urgences, types de demandes, suggestions d'actions.</p>
                <GmailConnectButton syndicId={user?.id} userEmail={user?.email} />
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Notifications</h2>
                {notifSettings.map((n, idx) => (
                  <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <button
                      onClick={() => setNotifSettings(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))}
                      className={`w-11 h-6 rounded-full transition-all cursor-pointer relative ${n.checked ? 'bg-purple-600' : 'bg-gray-200'}`}
                      aria-label={`Activer/désactiver ${n.label}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all`} style={{ left: n.checked ? '22px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal Nouvelle Mission */}
      {showModalMission && (
        <ModalNouveilleMission
          onClose={() => setShowModalMission(false)}
          batimentsConnus={batimentsConnus}
          artisans={artisans}
          coproprios={(() => { try { return JSON.parse(localStorage.getItem(`fixit_copros_${user?.id}`) || '[]') } catch { return [] } })()}
          onAdd={async (m) => {
            // Mémoriser le bâtiment saisi
            if (m.immeuble?.trim()) enregistrerBatiment(m.immeuble)
            const missionId = Date.now().toString()
            const newMission: Mission = { ...m, id: missionId, statut: 'en_attente', dateCreation: new Date().toISOString().split('T')[0] } as Mission
            setMissions(prev => {
              const updated = [newMission, ...prev]
              try { localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(updated)) } catch {}
              return updated
            })
            // Sync Supabase
            try {
              const { data: { session } } = await supabase.auth.getSession()
              const token = session?.access_token
              if (token) {
                const res = await fetch('/api/syndic/missions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(newMission),
                })
                if (res.ok) {
                  const { mission } = await res.json()
                  if (mission?.id) setMissions(prev => prev.map(mi => mi.id === missionId ? { ...mi, id: mission.id } : mi))
                }
              }
            } catch { /* silencieux */ }

            // ── Notification au demandeur (canal copropriétaire) ──
            if ((m as any).demandeurEmail || (m as any).locataire) {
              const demandeurKey = `canal_demandeur_${((m as any).demandeurEmail || (m as any).locataire || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
              const now = new Date()
              const dateIntervStr = m.dateIntervention
                ? new Date(m.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : null
              const heureStr = (m as any).heureIntervention || null
              const notifMsg = {
                id: Date.now().toString(),
                date: now.toISOString(),
                type: 'mission_traitee',
                texte: `✅ Votre demande a bien été prise en charge.\n\n📋 Mission : ${m.type || 'Intervention'}\n🔧 Artisan : ${m.artisan || 'En cours d\'assignation'}${dateIntervStr ? `\n📅 Intervention prévue le : ${dateIntervStr}${heureStr ? ` à ${heureStr}` : ''}` : '\n📅 Date d\'intervention : en cours de planification'}\n\nVous serez informé(e) de l'évolution de la mission via ce canal.`,
                missionId,
                artisan: m.artisan,
                dateIntervention: m.dateIntervention,
              }
              try {
                const existing = JSON.parse(localStorage.getItem(demandeurKey) || '[]')
                existing.unshift(notifMsg)
                localStorage.setItem(demandeurKey, JSON.stringify(existing))
              } catch {}
            }

            // ── Canal artisan : créer/mettre à jour la file des ordres de mission ──
            if (m.artisan) {
              const artisanKey = `canal_artisan_${m.artisan.replace(/\s+/g, '_').toLowerCase()}`
              try {
                const artisanMissions = JSON.parse(localStorage.getItem(artisanKey) || '[]')
                artisanMissions.unshift({ ...newMission, id: missionId })
                localStorage.setItem(artisanKey, JSON.stringify(artisanMissions))
              } catch {}
            }
          }}
        />
      )}

      {/* ── Modal Ajouter un Artisan ── */}
      {showModalArtisan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">🔧 Ajouter un artisan</h2>
                <button onClick={() => setShowModalArtisan(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>

              {artisanSuccess ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-green-700 font-semibold text-lg">{artisanSuccess}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Étape 1 : email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de l'artisan *</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={artisanForm.email}
                        onChange={e => { setArtisanForm(f => ({ ...f, email: e.target.value })); setArtisanSearchResult(null) }}
                        placeholder="artisan@exemple.fr"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                      />
                      <button
                        onClick={() => handleArtisanEmailSearch(artisanForm.email)}
                        disabled={artisanSearchLoading || !artisanForm.email.includes('@')}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition disabled:opacity-40"
                      >
                        {artisanSearchLoading ? '⏳' : '🔍 Vérifier'}
                      </button>
                    </div>
                    {artisanSearchResult && (
                      <div className={`mt-2 p-3 rounded-lg text-sm ${artisanSearchResult.found ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                        {artisanSearchResult.found
                          ? <>✅ Compte Vitfix trouvé — <strong>{artisanSearchResult.name}</strong> ({artisanSearchResult.role === 'artisan' ? 'artisan certifié' : artisanSearchResult.role})<br/><span className="text-xs">Il sera synchronisé avec votre cabinet.</span></>
                          : <>⚠️ Aucun compte Vitfix. Vous pouvez créer un compte artisan ou l'ajouter sans compte.</>
                        }
                      </div>
                    )}
                  </div>

                  {/* Infos artisan */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                      <input type="text" value={artisanForm.prenom} onChange={e => setArtisanForm(f => ({ ...f, prenom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" placeholder="Jean" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                      <input type="text" value={artisanForm.nom} onChange={e => setArtisanForm(f => ({ ...f, nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" placeholder="Dupont" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                      <input type="tel" value={artisanForm.telephone} onChange={e => setArtisanForm(f => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" placeholder="06 12 34 56 78" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Corps de métier</label>
                      <select value={artisanForm.metier} onChange={e => setArtisanForm(f => ({ ...f, metier: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                        <option value="">Sélectionner...</option>
                        <option>Plomberie</option>
                        <option>Électricité</option>
                        <option>Peinture</option>
                        <option>Menuiserie</option>
                        <option>Chauffage / Climatisation</option>
                        <option>Serrurerie</option>
                        <option>Maçonnerie</option>
                        <option>Toiture</option>
                        <option>Ascenseur</option>
                        <option>Jardinage / Espaces verts</option>
                        <option>Nettoyage</option>
                        <option>Multi-services</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SIRET (optionnel)</label>
                    <input type="text" value={artisanForm.siret} onChange={e => setArtisanForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" placeholder="12345678901234" maxLength={14} />
                  </div>

                  {artisanError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{artisanError}</div>
                  )}

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowModalArtisan(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                      Annuler
                    </button>
                    {artisanSearchResult?.found ? (
                      <button
                        onClick={() => handleAddArtisan(false)}
                        disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                      >
                        {artisanSubmitting ? 'Synchronisation...' : '🔗 Synchroniser avec mon cabinet'}
                      </button>
                    ) : artisanSearchResult && !artisanSearchResult.found ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <button
                          onClick={() => handleAddArtisan(true)}
                          disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                        >
                          {artisanSubmitting ? 'Création...' : '+ Créer le compte artisan'}
                        </button>
                        <button
                          onClick={() => handleAddArtisan(false)}
                          disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                          className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
                        >
                          Ajouter sans compte Vitfix
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddArtisan(false)}
                        disabled={artisanSubmitting || !artisanForm.email || !artisanForm.nom}
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                      >
                        {artisanSubmitting ? 'Ajout...' : '+ Ajouter l\'artisan'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ajouter/Modifier un Immeuble ── */}
      {showModalImmeuble && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingImmeuble ? '✏️ Modifier l\'immeuble' : '🏢 Ajouter un immeuble'}
                </h2>
                <button onClick={() => setShowModalImmeuble(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'immeuble *</label>
                  <input
                    type="text"
                    value={immeubleForm.nom || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    placeholder="Résidence Les Acacias"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
                  <input
                    type="text"
                    value={immeubleForm.adresse || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, adresse: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    placeholder="12 rue des Acacias"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                    <input
                      type="text"
                      value={immeubleForm.codePostal || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, codePostal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                      placeholder="75008"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                    <input
                      type="text"
                      value={immeubleForm.ville || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, ville: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                      placeholder="Paris"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de lots</label>
                    <input
                      type="number"
                      min={1}
                      value={immeubleForm.nbLots || 1}
                      onChange={e => setImmeubleForm(f => ({ ...f, nbLots: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Année de construction</label>
                    <input
                      type="number"
                      min={1800}
                      max={new Date().getFullYear()}
                      value={immeubleForm.anneeConstruction || 2000}
                      onChange={e => setImmeubleForm(f => ({ ...f, anneeConstruction: parseInt(e.target.value) || 2000 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={immeubleForm.typeImmeuble || 'Copropriété'}
                      onChange={e => setImmeubleForm(f => ({ ...f, typeImmeuble: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    >
                      <option>Copropriété</option>
                      <option>Résidence</option>
                      <option>Immeuble mixte</option>
                      <option>Parc résidentiel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gestionnaire</label>
                    <input
                      type="text"
                      value={immeubleForm.gestionnaire || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, gestionnaire: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                      placeholder="Jean Dupont"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget annuel (€)</label>
                    <input
                      type="number"
                      min={0}
                      value={immeubleForm.budgetAnnuel || 0}
                      onChange={e => setImmeubleForm(f => ({ ...f, budgetAnnuel: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prochain contrôle</label>
                    <input
                      type="date"
                      value={immeubleForm.prochainControle || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, prochainControle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
                {/* ── Section Règlement de copropriété ── */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <p className="text-sm font-semibold text-gray-700 mb-3">📜 Règlement de copropriété</p>
                  <div className="space-y-3">
                    {/* Upload PDF ou texte */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Importer le règlement (PDF ou texte)</label>
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 rounded-lg text-xs text-purple-700 font-medium transition flex-1">
                          <span>📄</span>
                          <span>{immeubleForm.reglementPdfNom || 'Choisir un PDF…'}</span>
                          <input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setImmeubleForm(f => ({ ...f, reglementPdfNom: file.name, reglementDateMaj: new Date().toISOString().split('T')[0] }))
                              // Lire le fichier texte si c'est un .txt
                              if (file.type === 'text/plain') {
                                const text = await file.text()
                                setImmeubleForm(f => ({ ...f, reglementTexte: text }))
                              }
                            }}
                          />
                        </label>
                        {immeubleForm.reglementPdfNom && (
                          <button onClick={() => setImmeubleForm(f => ({ ...f, reglementPdfNom: '', reglementTexte: '' }))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                    {/* Texte libre */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Texte du règlement <span className="text-gray-500">(coller ou saisir)</span></label>
                      <textarea
                        rows={5}
                        value={immeubleForm.reglementTexte || ''}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementTexte: e.target.value, reglementDateMaj: new Date().toISOString().split('T')[0] }))}
                        placeholder="Collez ici le texte du règlement de copropriété, ou les articles importants (répartition des charges, majorités AG, fonds de travaux…)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-purple-400 resize-none font-mono leading-relaxed"
                      />
                    </div>
                    {/* Métadonnées clés */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Répartition des charges</label>
                        <input
                          type="text"
                          value={immeubleForm.reglementChargesRepartition || ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementChargesRepartition: e.target.value }))}
                          placeholder="Ex: tantièmes / millièmes"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Majorités AG (art. 24/25/26)</label>
                        <input
                          type="text"
                          value={immeubleForm.reglementMajoriteAG || ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementMajoriteAG: e.target.value }))}
                          placeholder="Ex: art.24 majorité simple…"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!immeubleForm.reglementFondsTravaux}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsTravaux: e.target.checked }))}
                          className="rounded"
                        />
                        Fonds de travaux obligatoire (art. 14-2)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Fonds roulement (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={immeubleForm.reglementFondsRoulementPct ?? ''}
                          onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsRoulementPct: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                    {immeubleForm.reglementDateMaj && (
                      <p className="text-xs text-gray-500">Dernière mise à jour : {new Date(immeubleForm.reglementDateMaj).toLocaleDateString('fr-FR')}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowModalImmeuble(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveImmeuble}
                    disabled={!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                  >
                    {editingImmeuble ? '✅ Sauvegarder' : '+ Ajouter l\'immeuble'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détails Mission ── */}
      {showMissionDetails && selectedMission && (
        <MissionDetailsModal
          mission={selectedMission}
          onClose={() => setShowMissionDetails(false)}
          onUpdate={(updated) => {
            setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
            setSelectedMission(updated)
            // Persist to localStorage
            const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
            const newStored = stored.map((m: Mission) => m.id === updated.id ? updated : m)
            if (!newStored.find((m: Mission) => m.id === updated.id)) newStored.push(updated)
            localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(newStored))
          }}
          onValider={() => { handleValiderMission(selectedMission.id); setShowMissionDetails(false) }}
          userRole={userRole}
        />
      )}

      {/* ── Modal Ajout Événement Planning ── */}
      {showPlanningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanningModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">Nouvel événement</h3>
                {selectedPlanningDay && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(selectedPlanningDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                )}
              </div>
              <button onClick={() => setShowPlanningModal(false)} className="text-gray-500 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Titre *</label>
                <input
                  type="text"
                  value={planningEventForm.titre}
                  onChange={e => setPlanningEventForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex : Visite Mme Dupont, Réunion CA..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Type + Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select
                    value={planningEventForm.type}
                    onChange={e => setPlanningEventForm(f => ({ ...f, type: e.target.value as PlanningEvent['type'] }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="visite">Visite</option>
                    <option value="reunion">Réunion</option>
                    <option value="rdv">Rendez-vous</option>
                    <option value="tache">Tâche</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Heure</label>
                  <input
                    type="time"
                    value={planningEventForm.heure}
                    onChange={e => setPlanningEventForm(f => ({ ...f, heure: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Durée */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Durée</label>
                <select
                  value={planningEventForm.dureeMin}
                  onChange={e => setPlanningEventForm(f => ({ ...f, dureeMin: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 heure</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2 heures</option>
                  <option value={180}>3 heures</option>
                </select>
              </div>

              {/* Assigné à — visible secrétaire / admin / syndic */}
              {(userRole === 'syndic' || userRole === 'syndic_admin' || userRole === 'syndic_secretaire') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Assigné à</label>
                  <select
                    value={planningEventForm.assigneA}
                    onChange={e => setPlanningEventForm(f => ({ ...f, assigneA: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Moi-même ({userName})</option>
                    {teamMembers.filter(m => m.full_name !== userName).map(m => (
                      <option key={m.id} value={m.full_name}>{m.full_name}{m.role ? ` (${ROLE_LABELS_TEAM[m.role] || m.role})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="text-gray-500 font-normal">(optionnel)</span></label>
                <textarea
                  value={planningEventForm.description}
                  onChange={e => setPlanningEventForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails complémentaires..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowPlanningModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={addPlanningEvent}
                disabled={!planningEventForm.titre.trim()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-40 shadow-sm"
              >
                ✅ Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fixy Assistant IA ─── */}
      {user && (
        <FixyChatGeneric
          role={userRole === 'syndic_tech' ? 'syndic_tech' : 'syndic'}
          userName={userName}
          context={{
            immeubles: `${immeubles.length} copropriété(s) gérée(s)`,
            interventions: `${missions.filter((m: any) => m.statut === 'en_cours' || m.statut === 'planifiée').length} intervention(s) en cours`,
          }}
          getAuthToken={async () => {
            const { data: { session } } = await supabase.auth.getSession()
            return session?.access_token || null
          }}
        />
      )}
    </div>
  )
}


/* ══════════ ÉCHÉANCES LÉGALES MULTI-IMMEUBLES ══════════ */
function EcheancesSection({ user, userRole, immeubles }: { user: any; userRole: string; immeubles: Immeuble[] }) {
  type EcheanceType = 'inspection_ascenseur' | 'ramonage' | 'controle_elec' | 'dta' | 'dtg' | 'pppt' | 'ag_annuelle' | 'verification_extincteurs' | 'controle_gaz' | 'assurance_immeuble' | 'audit_energetique' | 'revision_budget'
  interface Echeance {
    id: string; type: EcheanceType; label: string; description: string
    immeuble_id: string; immeuble_nom: string; date_echeance: string
    periodicite_ans: number; statut: 'fait' | 'a_faire'; notes: string
    date_realisation?: string; prestataire?: string; added_at: string
  }
  const TYPES: { key: EcheanceType; label: string; icon: string; desc: string; periodicite: number; obligatoire: boolean; refs: string }[] = [
    { key: 'ag_annuelle', label: 'AG annuelle', icon: '🏛️', desc: 'Assemblée Générale ordinaire annuelle', periodicite: 1, obligatoire: true, refs: 'Art. 7 Décret n°67-223 du 17/03/1967' },
    { key: 'revision_budget', label: 'Budget prévisionnel', icon: '💶', desc: 'Vote du budget en Assemblée Générale', periodicite: 1, obligatoire: true, refs: 'Art. 14-1 Loi n°65-557 du 10/07/1965' },
    { key: 'verification_extincteurs', label: 'Vérification extincteurs', icon: '🧯', desc: 'Contrôle annuel obligatoire', periodicite: 1, obligatoire: true, refs: 'Code du travail R.4227-38' },
    { key: 'assurance_immeuble', label: 'Renouvellement assurance', icon: '🛡️', desc: 'Assurance multirisque immeuble', periodicite: 1, obligatoire: true, refs: 'Loi du 13/07/1965 — Art. 9-1' },
    { key: 'controle_gaz', label: 'Contrôle installations gaz', icon: '🔌', desc: 'Révision chaudière collective + réseau gaz', periodicite: 1, obligatoire: false, refs: 'Arrêtés 02/08/1977 et 23/06/1978' },
    { key: 'ramonage', label: 'Ramonage cheminées', icon: '🔥', desc: 'Obligatoire 2x/an pour conduits collectifs', periodicite: 0.5, obligatoire: true, refs: 'Arrêté du 22/10/1969' },
    { key: 'inspection_ascenseur', label: 'Inspection ascenseur', icon: '🛗', desc: 'Contrôle obligatoire quinquennal', periodicite: 5, obligatoire: true, refs: 'Décret n°2004-964 du 09/09/2004' },
    { key: 'controle_elec', label: 'Contrôle électrique', icon: '⚡', desc: 'Parties communes — NF C 15-100', periodicite: 5, obligatoire: true, refs: 'NF C 15-100 + décret du 14/06/1969' },
    { key: 'dta', label: 'DTA (amiante)', icon: '⚠️', desc: 'Dossier Technique Amiante — vérification', periodicite: 3, obligatoire: true, refs: 'Code de la santé pub. L.1334-13' },
    { key: 'dtg', label: 'DTG', icon: '🏗️', desc: 'Diagnostic Technique Global', periodicite: 10, obligatoire: true, refs: 'Loi ALUR art. 58 — > 10 ans' },
    { key: 'pppt', label: 'Plan Pluriannuel Travaux', icon: '🔨', desc: 'PPT obligatoire pour immeubles > 15 ans', periodicite: 10, obligatoire: true, refs: 'Loi Climat & Résilience 2022' },
    { key: 'audit_energetique', label: 'Audit énergétique DPE', icon: '🌿', desc: 'DPE collectif et audit énergétique', periodicite: 10, obligatoire: false, refs: 'Loi ELAN 2018 — Décret 2021-919' },
  ]
  const storageKey = `fixit_echeances_${user.id}`
  const [echeances, setEcheances] = useState<Echeance[]>([])
  const [filterImmeuble, setFilterImmeuble] = useState('tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ type: 'ag_annuelle' as EcheanceType, immeuble_id: '', date_echeance: '', notes: '', prestataire: '' })
  const [selectedE, setSelectedE] = useState<Echeance | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) try { setEcheances(JSON.parse(saved)) } catch {}
  }, [storageKey])

  const save = (list: Echeance[]) => { setEcheances(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const addEcheance = () => {
    if (!formData.immeuble_id || !formData.date_echeance) return
    const typeInfo = TYPES.find(t => t.key === formData.type)!
    const imm = immeubles.find(i => i.id === formData.immeuble_id)!
    save([...echeances, { id: Date.now().toString(36), type: formData.type, label: typeInfo.label, description: typeInfo.desc, immeuble_id: formData.immeuble_id, immeuble_nom: imm.nom, date_echeance: formData.date_echeance, periodicite_ans: typeInfo.periodicite, statut: 'a_faire', notes: formData.notes, prestataire: formData.prestataire, added_at: new Date().toISOString() }])
    setShowAddModal(false)
    setFormData({ type: 'ag_annuelle', immeuble_id: '', date_echeance: '', notes: '', prestataire: '' })
  }

  const markDone = (id: string) => save(echeances.map(e => e.id === id ? { ...e, statut: 'fait' as const, date_realisation: new Date().toISOString().split('T')[0] } : e))
  const deleteE = (id: string) => save(echeances.filter(e => e.id !== id))

  const autoInit = () => {
    const newOnes: Echeance[] = []
    immeubles.forEach(imm => {
      TYPES.filter(t => t.obligatoire).forEach(t => {
        if (echeances.some(e => e.immeuble_id === imm.id && e.type === t.key)) return
        const next = new Date()
        next.setMonth(next.getMonth() + Math.floor(t.periodicite * 12))
        newOnes.push({ id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, type: t.key, label: t.label, description: t.desc, immeuble_id: imm.id, immeuble_nom: imm.nom, date_echeance: next.toISOString().split('T')[0], periodicite_ans: t.periodicite, statut: 'a_faire', notes: '', added_at: new Date().toISOString() })
      })
    })
    if (newOnes.length > 0) save([...echeances, ...newOnes])
  }

  const getDaysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const getColor = (e: Echeance) => {
    if (e.statut === 'fait') return 'bg-green-100 text-green-700 border-green-200'
    const d = getDaysLeft(e.date_echeance)
    if (d < 0) return 'bg-red-100 text-red-700 border-red-200'
    if (d < 30) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (d < 90) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }
  const getLabel = (e: Echeance) => {
    if (e.statut === 'fait') return '✓ Réalisée'
    const d = getDaysLeft(e.date_echeance)
    if (d < 0) return `⚠ En retard (${Math.abs(d)}j)`
    if (d === 0) return "📍 Aujourd'hui !"
    return `Dans ${d}j`
  }

  const filtered = echeances
    .filter(e => filterImmeuble === 'tous' || e.immeuble_id === filterImmeuble)
    .filter(e => {
      if (filterStatut === 'tous') return true
      if (filterStatut === 'urgent') return e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 30 && getDaysLeft(e.date_echeance) >= 0
      if (filterStatut === 'en_retard') return e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 0
      if (filterStatut === 'fait') return e.statut === 'fait'
      return true
    })
    .sort((a, b) => a.statut === 'fait' && b.statut !== 'fait' ? 1 : b.statut === 'fait' && a.statut !== 'fait' ? -1 : new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())

  const urgentC = echeances.filter(e => e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 30 && getDaysLeft(e.date_echeance) >= 0).length
  const retardC = echeances.filter(e => e.statut !== 'fait' && getDaysLeft(e.date_echeance) < 0).length

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📅 Échéances légales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des obligations réglementaires multi-immeubles</p>
        </div>
        <div className="flex gap-2">
          {immeubles.length > 0 && <button onClick={autoInit} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-200 transition">⚡ Auto-init</button>}
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">+ Ajouter</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', val: echeances.length, cls: 'bg-gray-50 border-gray-200 text-gray-800' },
          { label: 'En retard', val: retardC, cls: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Urgent < 30j', val: urgentC, cls: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Réalisées', val: echeances.filter(e => e.statut === 'fait').length, cls: 'bg-green-50 border-green-200 text-green-700' },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl p-3 text-center ${k.cls}`}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400">
          <option value="tous">Tous les immeubles</option>
          {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400">
          <option value="tous">Tous les statuts</option>
          <option value="en_retard">En retard</option>
          <option value="urgent">Urgent (&lt;30j)</option>
          <option value="a_faire">À faire</option>
          <option value="fait">Réalisées</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="text-5xl mb-3">📅</div>
          <h3 className="font-bold text-gray-700 mb-1">Aucune échéance</h3>
          <p className="text-sm text-gray-500 mb-4">Utilisez "Auto-init" pour générer automatiquement toutes les obligations légales de vos immeubles</p>
          {immeubles.length > 0 && <button onClick={autoInit} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold">⚡ Générer automatiquement</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-purple-200 transition cursor-pointer" onClick={() => setSelectedE(e)}>
              <div className="text-2xl flex-shrink-0">{TYPES.find(t => t.key === e.type)?.icon || '📋'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{e.label}</p>
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">{e.immeuble_nom}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}{e.prestataire ? ` · ${e.prestataire}` : ''}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex-shrink-0 ${getColor(e)}`}>{getLabel(e)}</div>
              <div className="flex gap-1 flex-shrink-0" onClick={ev => ev.stopPropagation()}>
                {e.statut !== 'fait' && <button onClick={() => markDone(e.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition">✓</button>}
                <button onClick={() => deleteE(e.id)} className="px-2 py-1.5 text-red-400 hover:text-red-600 text-xs">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Nouvelle échéance</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'obligation</label>
                <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value as EcheanceType }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}{t.obligatoire ? ' *' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Immeuble</label>
                <select value={formData.immeuble_id} onChange={e => setFormData(f => ({ ...f, immeuble_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                  <option value="">Sélectionner...</option>
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance</label>
                <input type="date" value={formData.date_echeance} onChange={e => setFormData(f => ({ ...f, date_echeance: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prestataire (optionnel)</label>
                <input type="text" placeholder="Nom du prestataire..." value={formData.prestataire} onChange={e => setFormData(f => ({ ...f, prestataire: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none" placeholder="Observations..." />
              </div>
              {formData.type && <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">📖 {TYPES.find(t => t.key === formData.type)?.refs}</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={addEcheance} disabled={!formData.immeuble_id || !formData.date_echeance} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-60">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {selectedE && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedE(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{TYPES.find(t => t.key === selectedE.type)?.icon} {selectedE.label}</h3>
              <button onClick={() => setSelectedE(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Immeuble</p><p className="font-semibold">{selectedE.immeuble_nom}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Échéance</p><p className="font-semibold">{new Date(selectedE.date_echeance).toLocaleDateString('fr-FR')}</p></div>
                {selectedE.prestataire && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Prestataire</p><p className="font-semibold">{selectedE.prestataire}</p></div>}
                {selectedE.date_realisation && <div className="bg-green-50 rounded-xl p-3"><p className="text-xs text-green-600 mb-1">Réalisée le</p><p className="font-semibold text-green-700">{new Date(selectedE.date_realisation).toLocaleDateString('fr-FR')}</p></div>}
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 mb-1 font-semibold">Base légale</p>
                <p className="text-blue-800">{TYPES.find(t => t.key === selectedE.type)?.refs}</p>
                <p className="text-blue-600 mt-1 text-xs">{selectedE.description}</p>
              </div>
              {selectedE.notes && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-gray-700">{selectedE.notes}</p></div>}
            </div>
            <div className="flex gap-2 mt-4">
              {selectedE.statut !== 'fait' && <button onClick={() => { markDone(selectedE.id); setSelectedE(null) }} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">✓ Marquer comme réalisée</button>}
              <button onClick={() => { deleteE(selectedE.id); setSelectedE(null) }} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">🗑️</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ RECOUVREMENT AUTOMATISÉ ══════════ */
function RecouvrementSection({ user, userRole }: { user: any; userRole: string }) {
  type StageRec = 'amiable' | 'relance_1' | 'relance_2' | 'mise_en_demeure' | 'contentieux' | 'huissier' | 'regle'
  interface DossierRec {
    id: string; coproprio_nom: string; coproprio_email: string; coproprio_lot: string
    immeuble_nom: string; montant_initial: number; montant_actuel: number
    date_premiere_echeance: string; stage: StageRec
    historique: { date: string; action: string; auteur: string }[]
    notes: string; date_derniere_action: string; added_at: string
  }
  const STAGES: { key: StageRec; label: string; icon: string; color: string; action: string }[] = [
    { key: 'amiable', label: 'Contact amiable', icon: '📞', color: 'blue', action: 'Rappel amiable envoyé' },
    { key: 'relance_1', label: 'Relance 1', icon: '📧', color: 'amber', action: '1ère lettre de relance' },
    { key: 'relance_2', label: 'Relance 2', icon: '📨', color: 'orange', action: '2ème relance recommandée' },
    { key: 'mise_en_demeure', label: 'Mise en demeure', icon: '⚖️', color: 'red', action: 'Mise en demeure LRAR' },
    { key: 'contentieux', label: 'Contentieux', icon: '🏛️', color: 'purple', action: 'Saisine tribunal judiciaire' },
    { key: 'huissier', label: 'Huissier', icon: '🔔', color: 'gray', action: 'Transmission à huissier' },
    { key: 'regle', label: 'Réglé ✓', icon: '✅', color: 'green', action: 'Dossier clôturé — réglé' },
  ]
  const STAGE_ORDER: StageRec[] = ['amiable', 'relance_1', 'relance_2', 'mise_en_demeure', 'contentieux', 'huissier', 'regle']
  const stageCls: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200', amber: 'bg-amber-100 text-amber-700 border-amber-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200', red: 'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200', gray: 'bg-gray-100 text-gray-600 border-gray-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  }

  const storageKey = `fixit_recouvrement_${user.id}`
  const [dossiers, setDossiers] = useState<DossierRec[]>([])
  const [selected, setSelected] = useState<DossierRec | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const [form, setForm] = useState({ coproprio_nom: '', coproprio_email: '', coproprio_lot: '', immeuble_nom: '', montant_initial: '', date_premiere_echeance: '' })
  const [copiedLetter, setCopiedLetter] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem(storageKey)
    if (s) try { setDossiers(JSON.parse(s)) } catch {}
  }, [storageKey])

  const saveDossiers = (list: DossierRec[]) => { setDossiers(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const addDossier = () => {
    if (!form.coproprio_nom || !form.montant_initial) return
    saveDossiers([...dossiers, { id: Date.now().toString(36), coproprio_nom: form.coproprio_nom, coproprio_email: form.coproprio_email, coproprio_lot: form.coproprio_lot, immeuble_nom: form.immeuble_nom, montant_initial: parseFloat(form.montant_initial), montant_actuel: parseFloat(form.montant_initial), date_premiere_echeance: form.date_premiere_echeance, stage: 'amiable', historique: [{ date: new Date().toISOString(), action: 'Dossier ouvert', auteur: 'Syndic' }], notes: '', date_derniere_action: new Date().toISOString(), added_at: new Date().toISOString() }])
    setShowAdd(false)
    setForm({ coproprio_nom: '', coproprio_email: '', coproprio_lot: '', immeuble_nom: '', montant_initial: '', date_premiere_echeance: '' })
  }

  const escalate = (id: string) => {
    const updated = dossiers.map(d => {
      if (d.id !== id) return d
      const idx = STAGE_ORDER.indexOf(d.stage)
      const next = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)]
      const info = STAGES.find(s => s.key === next)!
      return { ...d, stage: next, date_derniere_action: new Date().toISOString(), historique: [...d.historique, { date: new Date().toISOString(), action: info.action, auteur: 'Syndic' }] }
    })
    saveDossiers(updated)
    if (selected?.id === id) setSelected(updated.find(d => d.id === id) || null)
  }

  const markRegle = (id: string) => {
    const updated = dossiers.map(d => d.id !== id ? d : { ...d, stage: 'regle' as StageRec, date_derniere_action: new Date().toISOString(), historique: [...d.historique, { date: new Date().toISOString(), action: 'Dossier réglé — clôture', auteur: 'Syndic' }] })
    saveDossiers(updated)
    setSelected(null)
  }

  const generateLetter = (d: DossierRec) => {
    const templates: Partial<Record<StageRec, string>> = {
      amiable: `Objet : Rappel amiable — Arriéré de charges de copropriété\n\nMonsieur/Madame ${d.coproprio_nom},\n\nNous vous contactons au sujet d'un arriéré de charges de copropriété d'un montant de ${d.montant_actuel.toFixed(2)} € relatif au lot n°${d.coproprio_lot || '?'} de la résidence ${d.immeuble_nom || '?'}.\n\nNous vous invitons à régulariser cette situation dans les meilleurs délais. Pour tout arrangement, n'hésitez pas à nous contacter.\n\nCordialement,\nLe Syndic`,
      relance_1: `Objet : 1ère Relance — Charges de copropriété impayées\n\nMonsieur/Madame ${d.coproprio_nom},\n\nMalgré notre précédent rappel amiable, votre solde débiteur de ${d.montant_actuel.toFixed(2)} € (lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}) n'a pas été régularisé.\n\nNous vous demandons de procéder au règlement sous 15 jours. À défaut, nous serons contraints d'engager une procédure de recouvrement.\n\nCordialement,\nLe Syndic`,
      relance_2: `Objet : 2ème Relance (Recommandée) — Urgence règlement charges\n\nMonsieur/Madame ${d.coproprio_nom},\n\nEn l'absence de règlement de votre part malgré nos précédentes demandes, nous vous adressons cette seconde relance par recommandé.\n\nMontant dû : ${d.montant_actuel.toFixed(2)} € — Lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}\n\nVous disposez de 8 jours pour régulariser. Passé ce délai, un courrier de mise en demeure vous sera adressé.\n\nCordialement,\nLe Syndic`,
      mise_en_demeure: `MISE EN DEMEURE\n\nMonsieur/Madame ${d.coproprio_nom},\n\nPar la présente, nous vous mettons en demeure de régler, dans un délai de 8 jours à compter de la réception de ce courrier, la somme de ${d.montant_actuel.toFixed(2)} € représentant vos charges de copropriété impayées (lot n°${d.coproprio_lot || '?'} — ${d.immeuble_nom || '?'}).\n\nÀ défaut de règlement dans ce délai, nous nous réservons le droit de saisir le tribunal judiciaire compétent, conformément aux articles 14-1 et 19-2 de la loi du 10 juillet 1965.\n\nFait à ______, le ${new Date().toLocaleDateString('fr-FR')}\n\nLE SYNDIC\n[Signature]`,
    }
    setLetter(templates[d.stage] || `Dossier : ${d.coproprio_nom} — Lot n°${d.coproprio_lot || '?'}\nImmeuble : ${d.immeuble_nom || '?'}\nMontant : ${d.montant_actuel.toFixed(2)} €\nStade : ${STAGES.find(s => s.key === d.stage)?.label}\n\n[Adapter le courrier selon le stade actuel]`)
  }

  const actifs = dossiers.filter(d => d.stage !== 'regle')
  const regles = dossiers.filter(d => d.stage === 'regle')
  const totalEncours = actifs.reduce((s, d) => s + d.montant_actuel, 0)
  const totalRegle = regles.reduce((s, d) => s + d.montant_actuel, 0)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💸 Recouvrement automatisé</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline d'escalade — charges impayées copropriétaires</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">+ Nouveau dossier</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-700">{totalEncours.toFixed(0)} €</p><p className="text-xs text-red-500 mt-0.5">En cours de recouvrement</p></div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-gray-700">{actifs.length}</p><p className="text-xs text-gray-500 mt-0.5">Dossiers actifs</p></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-700">{totalRegle.toFixed(0)} €</p><p className="text-xs text-green-500 mt-0.5">Récupérés</p></div>
      </div>

      {actifs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pipeline d'escalade</p>
          <div className="flex gap-2 min-w-max">
            {STAGES.filter(s => s.key !== 'regle').map(stage => {
              const cnt = actifs.filter(d => d.stage === stage.key).length
              return (
                <div key={stage.key} className={`flex-1 min-w-24 rounded-xl border p-3 text-center transition ${cnt > 0 ? stageCls[stage.color] : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-lg mb-1">{stage.icon}</div>
                  <p className="text-xs font-bold">{stage.label}</p>
                  <p className={`text-xl font-bold mt-1 ${cnt > 0 ? '' : 'text-gray-500'}`}>{cnt}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dossiers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="text-5xl mb-3">💸</div>
          <h3 className="font-bold text-gray-700 mb-1">Aucun dossier</h3>
          <p className="text-sm text-gray-500">Ajoutez un dossier d'impayé pour suivre son escalade automatiquement</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actifs.map(d => {
            const si = STAGES.find(s => s.key === d.stage)!
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-purple-200 transition cursor-pointer" onClick={() => setSelected(d)}>
                <div className="text-2xl flex-shrink-0">{si.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{d.coproprio_nom}</p>
                    {d.coproprio_lot && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Lot {d.coproprio_lot}</span>}
                    {d.immeuble_nom && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">{d.immeuble_nom}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Depuis le {new Date(d.added_at).toLocaleDateString('fr-FR')} · Dernière action {new Date(d.date_derniere_action).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-red-600 text-base">{d.montant_actuel.toFixed(2)} €</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${stageCls[si.color]}`}>{si.label}</span>
                </div>
              </div>
            )
          })}
          {regles.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-600 font-medium">✅ {regles.length} dossier(s) réglé(s) — {totalRegle.toFixed(0)} € récupérés</summary>
              <div className="mt-2 space-y-2">
                {regles.map(d => (
                  <div key={d.id} className="bg-green-50 rounded-xl border border-green-100 p-3 flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div className="flex-1"><p className="text-sm font-semibold text-green-800">{d.coproprio_nom}</p><p className="text-xs text-green-600">{d.immeuble_nom} · {d.montant_actuel.toFixed(2)} € récupérés</p></div>
                    <button onClick={() => saveDossiers(dossiers.filter(x => x.id !== d.id))} className="text-red-400 hover:text-red-600 text-xs p-1">🗑️</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Nouveau dossier impayé</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom copropriétaire *</label><input type="text" placeholder="Jean Dupont" value={form.coproprio_nom} onChange={e => setForm(f => ({ ...f, coproprio_nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot</label><input type="text" placeholder="42" value={form.coproprio_lot} onChange={e => setForm(f => ({ ...f, coproprio_lot: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" placeholder="jean.dupont@email.com" value={form.coproprio_email} onChange={e => setForm(f => ({ ...f, coproprio_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Résidence / Immeuble</label><input type="text" placeholder="Résidence Les Pins" value={form.immeuble_nom} onChange={e => setForm(f => ({ ...f, immeuble_nom: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Montant dû (€) *</label><input type="number" min="0" step="0.01" placeholder="1250.00" value={form.montant_initial} onChange={e => setForm(f => ({ ...f, montant_initial: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">1ère échéance</label><input type="date" value={form.date_premiere_echeance} onChange={e => setForm(f => ({ ...f, date_premiere_echeance: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={addDossier} disabled={!form.coproprio_nom || !form.montant_initial} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-60">Créer le dossier</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Dossier — {selected.coproprio_nom}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {STAGES.filter(s => s.key !== 'regle').map(s => (
                <div key={s.key} className={`flex-1 min-w-14 text-center p-2 rounded-lg text-xs font-bold border transition ${selected.stage === s.key ? stageCls[s.color] : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  <div className="text-base mb-0.5">{s.icon}</div>{s.label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-red-700">{selected.montant_actuel.toFixed(2)} €</p><p className="text-xs text-red-500">Montant dû</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-sm font-bold text-gray-700">Lot {selected.coproprio_lot || 'N/A'}</p><p className="text-xs text-gray-500">{selected.immeuble_nom || 'N/D'}</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-sm font-bold text-gray-700">{new Date(selected.added_at).toLocaleDateString('fr-FR')}</p><p className="text-xs text-gray-500">Ouverture</p></div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Historique</p>
              <div className="space-y-2">
                {[...selected.historique].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                    <div><p className="text-sm text-gray-700 font-medium">{h.action}</p><p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString('fr-FR')} · {h.auteur}</p></div>
                  </div>
                ))}
              </div>
            </div>
            {selected.stage !== 'regle' && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => generateLetter(selected)} className="flex-1 min-w-32 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">📝 Générer courrier</button>
                <button onClick={() => escalate(selected.id)} className="flex-1 min-w-32 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition">⬆️ Escalader</button>
                <button onClick={() => markRegle(selected.id)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">✅ Réglé</button>
                <button onClick={() => { saveDossiers(dossiers.filter(d => d.id !== selected.id)); setSelected(null) }} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition">🗑️</button>
              </div>
            )}
          </div>
        </div>
      )}

      {letter && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setLetter(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">📝 Courrier généré</h3>
              <button onClick={() => setLetter(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <textarea readOnly value={letter} rows={14} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono resize-none focus:outline-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { navigator.clipboard.writeText(letter); setCopiedLetter(true); setTimeout(() => setCopiedLetter(false), 2000) }} className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition ${copiedLetter ? 'bg-green-600 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                {copiedLetter ? '✓ Copié !' : '📋 Copier le courrier'}
              </button>
              {selected?.coproprio_email && (
                <a href={`mailto:${selected.coproprio_email}?subject=Charges%20de%20copropri%C3%A9t%C3%A9%20impay%C3%A9es&body=${encodeURIComponent(letter)}`} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition text-center">📧 Envoyer par email</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ PRÉPARATEUR AG AUTOMATIQUE ══════════ */
function PreparateurAGSection({ user, userRole, immeubles }: { user: any; userRole: string; immeubles: Immeuble[] }) {
  type AGStep = 'infos' | 'ordre_du_jour' | 'documents' | 'convocation' | 'export'
  type AGStatut = 'brouillon' | 'convocations_envoyees' | 'termine'
  interface AGResolution { id: string; type: 'ordinaire' | 'majorite_renforcee' | 'double_majorite'; titre: string; description: string; obligatoire: boolean }
  interface AGProject { id: string; immeuble_id: string; date_ag: string; heure_ag: string; lieu: string; type_ag: 'ordinaire' | 'extraordinaire'; resolutions: AGResolution[]; notes_president: string; created_at: string; statut: AGStatut }

  const RESOLUTIONS_STD: AGResolution[] = [
    { id: 'approbation_comptes', type: 'ordinaire', titre: "Approbation des comptes de l'exercice", description: 'Vote à la majorité simple — art. 24 loi 1965', obligatoire: true },
    { id: 'budget_previsionnel', type: 'ordinaire', titre: 'Vote du budget prévisionnel', description: 'Budget exercice suivant — art. 14-1 loi 1965', obligatoire: true },
    { id: 'fonds_travaux', type: 'ordinaire', titre: 'Cotisation fonds de travaux', description: '5% min du budget prévisionnel — loi ALUR', obligatoire: true },
    { id: 'designation_syndic', type: 'majorite_renforcee', titre: 'Désignation/renouvellement du syndic', description: 'Contrat de syndic — art. 25 loi 1965', obligatoire: false },
    { id: 'conseil_syndical', type: 'ordinaire', titre: 'Élection du conseil syndical', description: 'Membres du CS — art. 21 loi 1965', obligatoire: false },
    { id: 'travaux_pc', type: 'majorite_renforcee', titre: 'Autorisation travaux parties communes', description: 'Majorité art. 25 ou art. 26 selon travaux', obligatoire: false },
    { id: 'contrats_entretien', type: 'ordinaire', titre: 'Renouvellement contrats entretien', description: 'Ascenseur, espaces verts, nettoyage...', obligatoire: false },
    { id: 'assurance', type: 'ordinaire', titre: "Renouvellement contrat d'assurance", description: 'Assurance multirisque immeuble', obligatoire: false },
    { id: 'divers', type: 'ordinaire', titre: 'Questions diverses', description: 'Points remontés par le CS ou copropriétaires', obligatoire: false },
  ]

  const STEPS_NAV: { key: AGStep; label: string; icon: string }[] = [
    { key: 'infos', label: 'Infos', icon: '📋' },
    { key: 'ordre_du_jour', label: 'Ordre du jour', icon: '📝' },
    { key: 'documents', label: 'Documents', icon: '📁' },
    { key: 'convocation', label: 'Convocation', icon: '📧' },
    { key: 'export', label: 'Export', icon: '✅' },
  ]

  const DOCS_CHECKLIST = [
    { doc: "Comptes de l'exercice précédent", obligatoire: true, note: 'Bilan + compte de résultat signé par le syndic' },
    { doc: 'Budget prévisionnel détaillé', obligatoire: true, note: 'Détail par poste de charge' },
    { doc: 'Relevé des charges individuelles', obligatoire: true, note: 'Par lot — répartition tantièmes' },
    { doc: "État de la dette de la copropriété", obligatoire: true, note: 'Impayés, provisions et créances' },
    { doc: 'Formulaire de pouvoir (mandataire)', obligatoire: true, note: 'Pour mandater un représentant en AG' },
    { doc: 'Projet de contrat syndic', obligatoire: false, note: 'Si renouvellement syndic à l\'ordre du jour' },
    { doc: 'Note d\'information travaux', obligatoire: false, note: 'Descriptif et devis si travaux à voter' },
    { doc: 'Devis comparatifs (3 minimum)', obligatoire: false, note: 'Obligatoires si vote travaux > seuil' },
  ]

  const storageKey = `fixit_ag_projects_${user.id}`
  const [projects, setProjects] = useState<AGProject[]>([])
  const [current, setCurrent] = useState<AGProject | null>(null)
  const [step, setStep] = useState<AGStep>('infos')
  const [convocation, setConvocation] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem(storageKey)
    if (s) try { setProjects(JSON.parse(s)) } catch {}
  }, [storageKey])

  const saveProjects = (list: AGProject[]) => { setProjects(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const updateCurrent = (p: AGProject) => {
    setCurrent(p)
    const updated = projects.find(x => x.id === p.id) ? projects.map(x => x.id === p.id ? p : x) : [...projects, p]
    saveProjects(updated)
  }

  const createNew = () => {
    const p: AGProject = { id: Date.now().toString(36), immeuble_id: immeubles[0]?.id || '', date_ag: '', heure_ag: '18:00', lieu: '', type_ag: 'ordinaire', resolutions: RESOLUTIONS_STD.filter(r => r.obligatoire), notes_president: '', created_at: new Date().toISOString(), statut: 'brouillon' }
    setCurrent(p)
    setStep('infos')
  }

  const toggleRes = (res: AGResolution) => {
    if (!current) return
    const exists = current.resolutions.find(r => r.id === res.id)
    updateCurrent({ ...current, resolutions: exists ? current.resolutions.filter(r => r.id !== res.id) : [...current.resolutions, res] })
  }

  const genConvocation = () => {
    if (!current) return
    const imm = immeubles.find(i => i.id === current.immeuble_id)
    const dateAG = current.date_ag ? new Date(current.date_ag).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '[DATE À DÉFINIR]'
    const dateEnvoi = current.date_ag ? new Date(new Date(current.date_ag).getTime() - 21 * 86400000).toLocaleDateString('fr-FR') : '[21 jours avant AG]'
    const typeLabel: Record<string, string> = { ordinaire: 'Art. 24 — majorité simple', majorite_renforcee: 'Art. 25 — majorité renforcée', double_majorite: 'Art. 26 — double majorité' }
    const odj = current.resolutions.map((r, i) => `  ${i + 1}. ${r.titre}\n     → ${r.description}\n     → Vote : ${typeLabel[r.type] || r.type}`).join('\n\n')
    const conv = `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ${current.type_ag === 'extraordinaire' ? 'EXTRAORDINAIRE' : 'ORDINAIRE'}\n\nRésidence : ${imm?.nom || '[NOM RÉSIDENCE]'}\n${imm?.adresse || '[ADRESSE]'}\n\nDate d'envoi de la convocation : ${dateEnvoi}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nMadame, Monsieur,\n\nNous avons l'honneur de vous convoquer à l'Assemblée Générale ${current.type_ag === 'extraordinaire' ? 'Extraordinaire' : 'Ordinaire'} des copropriétaires qui se tiendra :\n\n  📅 Le : ${dateAG}\n  🕐 À : ${current.heure_ag || '[HEURE]'}\n  📍 Au : ${current.lieu || '[LIEU À DÉFINIR]'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nORDRE DU JOUR\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${odj}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nLes pièces justificatives (comptes, budget, contrats) sont tenues à votre disposition au cabinet syndic. Vous pouvez vous faire représenter par un mandataire de votre choix (formulaire de pouvoir ci-joint).\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.\n\nLe Syndic\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️  Document généré par Fixit — À adapter selon les spécificités de la copropriété\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    setConvocation(conv)
  }

  const typeClsRes: Record<string, string> = { ordinaire: 'bg-blue-50 text-blue-600 border-blue-200', majorite_renforcee: 'bg-orange-50 text-orange-600 border-orange-200', double_majorite: 'bg-red-50 text-red-600 border-red-200' }
  const typeLabels: Record<string, string> = { ordinaire: 'Art. 24', majorite_renforcee: 'Art. 25', double_majorite: 'Art. 26' }

  if (!current) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📝 Préparateur AG</h1>
            <p className="text-sm text-gray-500 mt-0.5">Générez convocations et ordre du jour en quelques clics</p>
          </div>
          <button onClick={createNew} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">+ Nouvelle AG</button>
        </div>
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">🏛️</div>
            <h3 className="font-bold text-gray-700 mb-1">Aucune AG préparée</h3>
            <p className="text-sm text-gray-500 mb-4">Préparez votre prochaine assemblée générale avec convocation, ordre du jour et checklist documents</p>
            <button onClick={createNew} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">Commencer la préparation</button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => {
              const imm = immeubles.find(i => i.id === p.immeuble_id)
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-purple-200 transition cursor-pointer" onClick={() => { setCurrent(p); setStep('infos') }}>
                  <div className="text-2xl">🏛️</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">AG {p.type_ag === 'extraordinaire' ? 'Extraordinaire' : 'Ordinaire'} — {imm?.nom || 'Immeuble non défini'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.date_ag ? new Date(p.date_ag).toLocaleDateString('fr-FR') : 'Date non définie'} · {p.resolutions.length} résolutions</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold flex-shrink-0 ${p.statut === 'termine' ? 'bg-green-100 text-green-700' : p.statut === 'convocations_envoyees' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.statut === 'termine' ? '✅ Terminée' : p.statut === 'convocations_envoyees' ? '📧 Convoquée' : '✏️ Brouillon'}
                  </span>
                  <button onClick={ev => { ev.stopPropagation(); saveProjects(projects.filter(x => x.id !== p.id)) }} className="text-red-400 hover:text-red-600 text-sm p-1 flex-shrink-0">🗑️</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const imm = immeubles.find(i => i.id === current.immeuble_id)
  const stepIdx = STEPS_NAV.findIndex(s => s.key === step)

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => { setCurrent(null); setConvocation('') }} className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition">← Retour à la liste</button>

      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-5 mb-4 text-white">
        <h2 className="font-bold text-lg mb-1">📝 AG {current.type_ag === 'extraordinaire' ? 'Extraordinaire' : 'Ordinaire'} — {imm?.nom || 'Immeuble'}</h2>
        <p className="text-purple-200 text-sm">{current.date_ag ? new Date(current.date_ag).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Date à définir'} · {current.lieu || 'Lieu à définir'}</p>
        <div className="flex gap-1 mt-3">
          {STEPS_NAV.map((s, i) => (
            <button key={s.key} onClick={() => setStep(s.key)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${step === s.key ? 'bg-white text-purple-700' : i < stepIdx ? 'bg-purple-400 text-white' : 'bg-purple-700/50 text-purple-300'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {step === 'infos' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Informations générales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Immeuble</label>
                <select value={current.immeuble_id} onChange={e => updateCurrent({ ...current, immeuble_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                  {immeubles.length === 0 ? <option value="">Aucun immeuble</option> : immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'AG</label>
                <select value={current.type_ag} onChange={e => updateCurrent({ ...current, type_ag: e.target.value as 'ordinaire' | 'extraordinaire' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                  <option value="ordinaire">AG Ordinaire (annuelle)</option>
                  <option value="extraordinaire">AG Extraordinaire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de l'AG</label>
                <input type="date" value={current.date_ag} onChange={e => updateCurrent({ ...current, date_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                <input type="time" value={current.heure_ag} onChange={e => updateCurrent({ ...current, heure_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                <input type="text" placeholder="Salle polyvalente de la résidence, 12 rue des Pins..." value={current.lieu} onChange={e => updateCurrent({ ...current, lieu: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>
            {current.date_ag && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                📧 Convocations à envoyer avant le : <strong>{new Date(new Date(current.date_ag).getTime() - 21 * 86400000).toLocaleDateString('fr-FR')}</strong> (21 jours min — art. 9 décret 1967)
              </div>
            )}
            <button onClick={() => setStep('ordre_du_jour')} className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">Suivant : Ordre du jour →</button>
          </div>
        )}

        {step === 'ordre_du_jour' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Ordre du jour ({current.resolutions.length} résolutions)</h3>
            <div className="space-y-2">
              {RESOLUTIONS_STD.map(res => {
                const sel = !!current.resolutions.find(r => r.id === res.id)
                return (
                  <div key={res.id} onClick={() => !res.obligatoire && toggleRes(res)} className={`rounded-xl border p-3 flex items-start gap-3 transition ${sel ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'} ${!res.obligatoire ? 'cursor-pointer hover:border-purple-200' : ''}`}>
                    <div className={`w-5 h-5 rounded mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${sel ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                      {sel && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{res.titre}</p>
                        {res.obligatoire && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">Obligatoire</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${typeClsRes[res.type]}`}>{typeLabels[res.type]}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{res.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('infos')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">← Retour</button>
              <button onClick={() => setStep('documents')} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">Suivant : Documents →</button>
            </div>
          </div>
        )}

        {step === 'documents' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Checklist documents à joindre</h3>
            <p className="text-sm text-gray-500">Documents obligatoires à annexer à la convocation (art. 11 décret 1967)</p>
            <div className="space-y-2">
              {DOCS_CHECKLIST.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.obligatoire ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${item.obligatoire ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {item.obligatoire && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.doc} {item.obligatoire && <span className="text-xs text-blue-600 font-medium">(obligatoire)</span>}</p>
                    <p className="text-xs text-gray-500">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes pour le président de séance</label>
              <textarea rows={3} value={current.notes_president} onChange={e => updateCurrent({ ...current, notes_president: e.target.value })} placeholder="Points à surveiller, contexte particulier, tensions attendues, ordre de vote..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('ordre_du_jour')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">← Retour</button>
              <button onClick={() => setStep('convocation')} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">Suivant : Convocation →</button>
            </div>
          </div>
        )}

        {step === 'convocation' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Génération de la convocation</h3>
            {!convocation ? (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">📧</div>
                <h4 className="font-bold text-purple-800 mb-1">Convocation légale prête</h4>
                <p className="text-sm text-purple-600 mb-4">{current.resolutions.length} résolutions · Format conforme décret 1967</p>
                <button onClick={genConvocation} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition text-sm">📄 Générer la convocation</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">Aperçu de la convocation</p>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(convocation); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${copied ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>{copied ? '✓ Copié !' : '📋 Copier'}</button>
                    <button onClick={() => setConvocation('')} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 border border-gray-200 hover:bg-gray-50">↩ Regénérer</button>
                  </div>
                </div>
                <textarea readOnly value={convocation} rows={18} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono resize-none focus:outline-none" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep('documents')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">← Retour</button>
              <button onClick={() => { updateCurrent({ ...current, statut: 'convocations_envoyees' }); setStep('export') }} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">Suivant : Export final →</button>
            </div>
          </div>
        )}

        {step === 'export' && (
          <div className="space-y-4 text-center">
            <div className="text-6xl mb-2">✅</div>
            <h3 className="font-bold text-gray-800 text-xl">AG prête !</h3>
            <p className="text-gray-500 text-sm">Votre assemblée générale est correctement configurée et prête à être envoyée</p>
            <div className="grid grid-cols-3 gap-3 text-left mt-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-gray-800">{current.resolutions.length}</p><p className="text-xs text-gray-500">Résolutions</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.date_ag ? new Date(current.date_ag).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'N/A'}</p><p className="text-xs text-gray-500">Date AG</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.heure_ag}</p><p className="text-xs text-gray-500">Heure</p></div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-4">
              <button onClick={() => { genConvocation(); setStep('convocation') }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">📋 Voir convocation</button>
              <button onClick={() => { updateCurrent({ ...current, statut: 'termine' }); setCurrent(null) }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">✅ Marquer AG terminée</button>
              <button onClick={() => setCurrent(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">Retour à la liste</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ AGENT COMPTABLE IA COPROPRIÉTÉ ══════════ */
function AgentComptableCopro({
  immeubles, selectedImmeubleId, setSelectedImmeubleId,
  lots, ecritures, appels, budgets,
}: {
  immeubles: Immeuble[]
  selectedImmeubleId: string
  setSelectedImmeubleId: (id: string) => void
  lots: any[]
  ecritures: any[]
  appels: any[]
  budgets: any[]
}) {
  const imm = immeubles.find(i => i.id === selectedImmeubleId) || immeubles[0] || null

  type Msg = { role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const SUGGESTIONS = [
    'Explique la règle de répartition des charges de cette copropriété',
    'Comment voter ces travaux selon le règlement ? (majorité requise)',
    'Quel est le montant du fonds de travaux obligatoire ?',
    'Génère un appel de charges trimestriel pour cette copro',
    'Y a-t-il des incohérences dans le journal comptable ?',
    'Quelles sont les dépenses dépassant le budget prévisionnel ?',
    'Rédige un courrier de relance impayé conforme à la loi Alur',
    'Quelles charges sont récupérables sur les locataires ?',
    'Synthèse comptable pour l\'assemblée générale',
  ]

  const buildSystemPrompt = () => {
    if (!imm) return 'Tu es un assistant comptable spécialisé en copropriété.'

    const reglementBlock = imm.reglementTexte
      ? `\n\n📜 RÈGLEMENT DE COPROPRIÉTÉ — ${imm.nom}:\n${imm.reglementTexte.substring(0, 6000)}`
      : imm.reglementChargesRepartition || imm.reglementMajoriteAG
        ? `\n\n📜 RÈGLEMENT (éléments clés) — ${imm.nom}:\n- Répartition des charges : ${imm.reglementChargesRepartition || 'Non renseigné'}\n- Majorités AG : ${imm.reglementMajoriteAG || 'Non renseigné'}\n- Fonds travaux art.14-2 : ${imm.reglementFondsTravaux ? 'Oui' : 'Non'}\n- Fonds roulement : ${imm.reglementFondsRoulementPct || 0}%`
        : '\n\n⚠️ Aucun règlement de copropriété renseigné pour cet immeuble. Rappelle à l\'utilisateur d\'ajouter le règlement dans la fiche immeuble.'

    const totalTantiemes = lots.reduce((s: number, l: any) => s + (l.tantieme || 0), 0)
    const lotsBlock = lots.length > 0
      ? `\n\n🏠 LOTS ET TANTIÈMES (${lots.length} lots enregistrés, total : ${totalTantiemes} tantièmes):\n` +
        `  Formule quote-part : (tantièmes du lot / ${totalTantiemes}) × charge totale\n` +
        lots.map((l: any) => {
          const pct = totalTantiemes > 0 ? ((l.tantieme / totalTantiemes) * 100).toFixed(2) : '0'
          const quotePart = totalTantiemes > 0 && imm ? ((l.tantieme / totalTantiemes) * imm.budgetAnnuel).toFixed(2) : '0'
          return `  - Lot ${l.numero} | ${l.proprietaire} | ${l.tantieme} tantièmes (${pct}%) | Quote-part budget : ${quotePart} € | Ét. ${l.etage} | ${l.surface}m²`
        }).join('\n')
      : '\n\n🏠 LOTS : Aucun lot enregistré. Invite l\'utilisateur à ajouter les lots dans l\'onglet "Lots / Tantièmes".'

    const ecrituresBlock = ecritures.length > 0
      ? `\n\n📒 JOURNAL COMPTABLE (${ecritures.length} écritures):\n  Débit total : ${ecritures.reduce((s: number, e: any) => s + (e.debit || 0), 0).toLocaleString('fr-FR')} €\n  Crédit total : ${ecritures.reduce((s: number, e: any) => s + (e.credit || 0), 0).toLocaleString('fr-FR')} €\n  Solde : ${(ecritures.reduce((s: number, e: any) => s + (e.credit || 0), 0) - ecritures.reduce((s: number, e: any) => s + (e.debit || 0), 0)).toLocaleString('fr-FR')} €\n${ecritures.slice(0, 20).map((e: any) => `  [${e.date}] ${e.journal} | ${e.libelle} | D:${e.debit}€ C:${e.credit}€ | Cpte:${e.compte}`).join('\n')}`
      : '\n\n📒 JOURNAL COMPTABLE : Aucune écriture enregistrée.'

    const appelsBlock = appels.length > 0
      ? `\n\n📬 APPELS DE CHARGES:\n${appels.map((a: any) => `  [${a.statut}] ${a.periode} | Budget : ${a.totalBudget.toLocaleString('fr-FR')} € | ${a.lots}`).join('\n')}`
      : '\n\n📬 APPELS DE CHARGES : Aucun appel enregistré.'

    const budgetBlock = budgets.length > 0
      ? `\n\n📋 BUDGETS PRÉVISIONNELS:\n${budgets.map((b: any) => `  ${b.immeuble} ${b.annee} | Postes : ${b.postes.map((p: any) => `${p.libelle} : ${p.budget}€ prévu / ${p.realise}€ réalisé`).join(', ')}`).join('\n')}`
      : ''

    return `Tu es Léa, assistante comptable IA experte en droit de la copropriété (loi du 10 juillet 1965, décret du 17 mars 1967, loi Alur 2014, loi Elan 2018).

Tu analyses les données réelles de la copropriété "${imm.nom}" située au ${imm.adresse}, ${imm.codePostal} ${imm.ville}.
- Type : ${imm.typeImmeuble} | ${imm.nbLots} lots | Construction ${imm.anneeConstruction}
- Budget annuel : ${imm.budgetAnnuel.toLocaleString('fr-FR')} € | Dépenses : ${imm.depensesAnnee.toLocaleString('fr-FR')} €
${reglementBlock}
${lotsBlock}
${ecrituresBlock}
${appelsBlock}
${budgetBlock}

INSTRUCTIONS IMPÉRATIVES :
- Réponds TOUJOURS en français, de façon précise et professionnelle
- BASE-TOI UNIQUEMENT sur les données réelles fournies ci-dessus (lots, tantièmes, écritures, budget, règlement)
- Pour chaque calcul de charge ou quote-part : montre le calcul complet → (tantièmes lot / total tantièmes) × montant
- Pour toute question de majorité AG : cite l'article EXACT de la loi du 10/07/1965 (art.24 majorité simple, art.25 majorité absolue, art.26 double majorité)
- Si le règlement est disponible : cite les articles concernés et adapte tes réponses à ses dispositions SPÉCIFIQUES
- Si le règlement n'est PAS renseigné : réponds quand même avec la loi générale mais rappelle d'ajouter le règlement dans la fiche immeuble
- Pour les appels de charges : calcule automatiquement le montant dû par chaque lot selon ses tantièmes
- Identifie proactivement les anomalies comptables, dépassements de budget, irrégularités
- Structure tes réponses avec des tableaux clairs quand tu présentes des données chiffrées
- Sois précis sur les montants (2 décimales), dates et délais légaux
- NE te présente PAS à chaque message (seulement si c'est la première interaction)`
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/comptable-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: buildSystemPrompt(),
        }),
      })
      const data = await res.json()
      const reply = data.reply || data.message || 'Désolé, une erreur est survenue.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur de connexion à l\'IA.' }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const hasReglement = !!(imm?.reglementTexte || imm?.reglementChargesRepartition || imm?.reglementMajoriteAG)

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl">
      {/* Header + sélecteur immeuble */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">🤖 Agent Comptable Léa <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">IA</span></h2>
            <p className="text-sm text-gray-500 mt-0.5">Analyse le règlement de copropriété et les données comptables pour répondre à vos questions</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Copropriété :</label>
            <select
              value={selectedImmeubleId}
              onChange={e => setSelectedImmeubleId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
            >
              {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
          </div>
        </div>

        {/* Badge règlement */}
        {imm && (
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${hasReglement ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {hasReglement ? (
              <>✅ Règlement chargé — {imm.reglementPdfNom || 'Texte saisi'}
                {imm.reglementDateMaj && <span className="text-gray-500 font-normal ml-1">· MàJ {new Date(imm.reglementDateMaj).toLocaleDateString('fr-FR')}</span>}
              </>
            ) : (
              <>⚠️ Aucun règlement de copropriété pour <strong>{imm.nom}</strong> — Ajoutez-le dans la fiche immeuble pour des réponses précises</>
            )}
          </div>
        )}
      </div>

      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
            <div className="text-5xl">🤖</div>
            <div>
              <p className="font-bold text-gray-800 text-lg">Bonjour, je suis Léa !</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md">Je suis votre assistante comptable IA spécialisée en copropriété. Je connais le règlement de <strong>{imm?.nom || 'votre copropriété'}</strong> et toutes vos données comptables.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setInput(s)} className="text-left text-xs bg-gray-50 hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-200 px-3 py-2 rounded-xl transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${msg.role === 'user' ? 'bg-orange-400 text-white' : 'bg-gradient-to-br from-orange-500 to-amber-400 text-white'}`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-orange-500 text-white rounded-tr-sm' : 'bg-gray-50 text-gray-800 border border-gray-200 rounded-tl-sm'}`}
                  dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Saisie */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex-shrink-0">
        {messages.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {SUGGESTIONS.slice(0, 4).map((s, i) => (
              <button key={i} onClick={() => setInput(s)} className="text-xs bg-gray-100 hover:bg-orange-50 hover:text-orange-700 px-2.5 py-1 rounded-full transition border border-transparent hover:border-orange-200">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            rows={2}
            placeholder={`Posez une question sur ${imm?.nom || 'la copropriété'}… (règlement, charges, AG, impayés…)`}
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-400 outline-none resize-none"
          />
          <div className="flex flex-col gap-1">
            <button onClick={send} disabled={!input.trim() || loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-5 rounded-xl font-bold text-sm transition">
              Envoyer
            </button>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs text-gray-500 hover:text-gray-600 text-center">Effacer</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════ COMPTABILITÉ COPROPRIÉTÉ SECTION ══════════ */
function ComptaCoproSection({ user, userRole, immeubles }: { user: any; userRole: string; immeubles: Immeuble[] }) {
  type Lot = { id: string; numero: string; proprietaire: string; tantieme: number; etage: string; surface: number }
  type AppelCharges = { id: string; periode: string; totalBudget: number; lots: string; statut: 'Brouillon' | 'Envoyé' | 'Soldé'; dateCreation: string }
  type EcritureCompta = { id: string; date: string; journal: 'BANQUE' | 'CAISSE' | 'FOURNISSEURS' | 'COPRO' | 'CHARGES'; libelle: string; debit: number; credit: number; compte: string; immeuble: string }
  type Budget = { id: string; immeuble: string; annee: number; postes: { libelle: string; budget: number; realise: number }[] }

  const uid = user?.id || 'demo'
  const [activeTab, setActiveTab] = useState<'tableau' | 'lots' | 'appels' | 'journal' | 'budget' | 'cloture' | 'rapports' | 'agent'>('tableau')

  // ── Immeuble sélectionné pour l'agent IA ──
  const [selectedImmeubleId, setSelectedImmeubleId] = useState<string>(immeubles[0]?.id || '')
  const selectedImmeuble = immeubles.find(i => i.id === selectedImmeubleId) || immeubles[0] || null

  // ── Lots / Tantièmes ──
  const [lots, setLots] = useState<Lot[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_lots_${uid}`) || '[]') } catch { return [] }
  })
  const [showLotModal, setShowLotModal] = useState(false)
  const [lotForm, setLotForm] = useState({ numero: '', proprietaire: '', tantieme: '', etage: '', surface: '' })

  // ── Appels de charges ──
  const [appels, setAppels] = useState<AppelCharges[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_appels_${uid}`) || '[]') } catch { return [] }
  })
  const [showAppelModal, setShowAppelModal] = useState(false)
  const [appelForm, setAppelForm] = useState({ periode: '', totalBudget: '', immeuble: '' })

  // ── Journal comptable ──
  const [ecritures, setEcritures] = useState<EcritureCompta[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_journal_${uid}`) || '[]') } catch { return [] }
  })
  const [showEcritureModal, setShowEcritureModal] = useState(false)
  const [ecritureForm, setEcritureForm] = useState({ date: new Date().toISOString().split('T')[0], journal: 'BANQUE', libelle: '', debit: '', credit: '', compte: '', immeuble: '' })

  // ── Budget ──
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_budgets_${uid}`) || '[]') } catch { return [] }
  })
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ immeuble: '', annee: new Date().getFullYear().toString() })
  const [budgetPostes, setBudgetPostes] = useState([
    { libelle: "Charges d'ascenseur", budget: 0, realise: 0 },
    { libelle: 'Entretien parties communes', budget: 0, realise: 0 },
    { libelle: 'Eau froide collective', budget: 0, realise: 0 },
    { libelle: 'Électricité communes', budget: 0, realise: 0 },
    { libelle: 'Assurance immeuble', budget: 0, realise: 0 },
    { libelle: 'Honoraires syndic', budget: 0, realise: 0 },
    { libelle: 'Travaux votés en AG', budget: 0, realise: 0 },
    { libelle: 'Fonds de travaux (art 14-2)', budget: 0, realise: 0 },
  ])

  const JOURNALS = ['BANQUE', 'CAISSE', 'FOURNISSEURS', 'COPRO', 'CHARGES']

  // Helpers save
  const saveLots = (updated: Lot[]) => { setLots(updated); localStorage.setItem(`fixit_lots_${uid}`, JSON.stringify(updated)) }
  const saveAppels = (updated: AppelCharges[]) => { setAppels(updated); localStorage.setItem(`fixit_appels_${uid}`, JSON.stringify(updated)) }
  const saveEcritures = (updated: EcritureCompta[]) => { setEcritures(updated); localStorage.setItem(`fixit_journal_${uid}`, JSON.stringify(updated)) }
  const saveBudgets = (updated: Budget[]) => { setBudgets(updated); localStorage.setItem(`fixit_budgets_${uid}`, JSON.stringify(updated)) }

  // Calculs tableau de bord
  const totalTantiemes = lots.reduce((s, l) => s + (l.tantieme || 0), 0)
  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0)
  const solde = totalCredit - totalDebit
  const appelsEnvoyes = appels.filter(a => a.statut !== 'Brouillon').length
  const appelsSoldes = appels.filter(a => a.statut === 'Soldé').length

  // Handlers
  const handleAddLot = () => {
    if (!lotForm.numero.trim()) return
    const l: Lot = { id: Date.now().toString(), numero: lotForm.numero, proprietaire: lotForm.proprietaire, tantieme: parseFloat(lotForm.tantieme) || 0, etage: lotForm.etage, surface: parseFloat(lotForm.surface) || 0 }
    saveLots([...lots, l])
    setShowLotModal(false)
    setLotForm({ numero: '', proprietaire: '', tantieme: '', etage: '', surface: '' })
  }

  const handleAddAppel = () => {
    if (!appelForm.periode.trim()) return
    const totalBudget = parseFloat(appelForm.totalBudget) || 0
    const a: AppelCharges = { id: Date.now().toString(), periode: appelForm.periode, totalBudget, lots: `${lots.length} lots`, statut: 'Brouillon', dateCreation: new Date().toISOString() }
    saveAppels([a, ...appels])
    setShowAppelModal(false)
    setAppelForm({ periode: '', totalBudget: '', immeuble: '' })
  }

  const handleEnvoyerAppel = (id: string) => {
    saveAppels(appels.map(a => a.id === id ? { ...a, statut: 'Envoyé' as const } : a))
  }

  const handleSolderAppel = (id: string) => {
    saveAppels(appels.map(a => a.id === id ? { ...a, statut: 'Soldé' as const } : a))
  }

  const handleAddEcriture = () => {
    if (!ecritureForm.libelle.trim()) return
    const e: EcritureCompta = {
      id: Date.now().toString(),
      date: ecritureForm.date,
      journal: ecritureForm.journal as EcritureCompta['journal'],
      libelle: ecritureForm.libelle,
      debit: parseFloat(ecritureForm.debit) || 0,
      credit: parseFloat(ecritureForm.credit) || 0,
      compte: ecritureForm.compte,
      immeuble: ecritureForm.immeuble,
    }
    saveEcritures([e, ...ecritures])
    setShowEcritureModal(false)
    setEcritureForm({ date: new Date().toISOString().split('T')[0], journal: 'BANQUE', libelle: '', debit: '', credit: '', compte: '', immeuble: '' })
  }

  const handleAddBudget = () => {
    if (!budgetForm.immeuble.trim()) return
    const b: Budget = { id: Date.now().toString(), immeuble: budgetForm.immeuble, annee: parseInt(budgetForm.annee) || new Date().getFullYear(), postes: budgetPostes }
    saveBudgets([b, ...budgets])
    setShowBudgetModal(false)
    setBudgetForm({ immeuble: '', annee: new Date().getFullYear().toString() })
    setBudgetPostes(budgetPostes.map(p => ({ ...p, budget: 0, realise: 0 })))
  }

  // Export journal CSV
  const exportJournalCSV = () => {
    const header = 'Date,Journal,Libellé,Débit,Crédit,Compte,Immeuble\n'
    const rows = ecritures.map(e => `${e.date},${e.journal},"${e.libelle}",${e.debit},${e.credit},${e.compte},${e.immeuble}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `journal_comptable_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const TABS = [
    { key: 'tableau', label: '📊 Tableau de bord' },
    { key: 'lots', label: '🏠 Lots & Tantièmes' },
    { key: 'appels', label: '📬 Appels de charges' },
    { key: 'journal', label: '📒 Journal comptable' },
    { key: 'budget', label: '📋 Budget prévisionnel' },
    { key: 'cloture', label: '📁 Clôture exercice' },
    { key: 'rapports', label: '📄 Rapports AG' },
    { key: 'agent', label: '🤖 Agent Comptable IA' },
  ]

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-orange-400 shadow-sm">
        <h1 className="text-2xl font-semibold">💶 Comptabilité Copropriété</h1>
        <p className="text-sm text-gray-500">Outils professionnels de comptabilité pour syndics et gestionnaires</p>
      </div>

      {/* Onglets */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition ${activeTab === tab.key ? 'border-orange-400 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 lg:p-8">

        {/* ── TABLEAU DE BORD ── */}
        {activeTab === 'tableau' && (
          <div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-400">
                <div className="text-sm text-gray-500 mb-1">Lots gérés</div>
                <div className="text-3xl font-bold text-orange-600">{lots.length}</div>
                <div className="text-xs text-gray-500 mt-1">{totalTantiemes.toFixed(0)} tantièmes</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-400">
                <div className="text-sm text-gray-500 mb-1">Appels de charges</div>
                <div className="text-3xl font-bold text-blue-600">{appels.length}</div>
                <div className="text-xs text-gray-500 mt-1">{appelsEnvoyes} envoyés · {appelsSoldes} soldés</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-400">
                <div className="text-sm text-gray-500 mb-1">Total crédits</div>
                <div className="text-3xl font-bold text-green-600">{totalCredit.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">encaissements</div>
              </div>
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${solde >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                <div className="text-sm text-gray-500 mb-1">Solde trésorerie</div>
                <div className={`text-3xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">{totalDebit.toLocaleString('fr-FR')} € débits</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4">📬 Derniers appels de charges</h2>
                {appels.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <div className="font-semibold">{a.periode}</div>
                      <div className="text-sm text-gray-500">{a.lots} · {a.totalBudget.toLocaleString('fr-FR')} €</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.statut === 'Soldé' ? 'bg-green-100 text-green-700' : a.statut === 'Envoyé' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{a.statut}</span>
                  </div>
                ))}
                {appels.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Aucun appel de charges</p>}
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4">📒 Dernières écritures</h2>
                {ecritures.slice(0, 5).map(e => (
                  <div key={e.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <div className="font-semibold text-sm">{e.libelle}</div>
                      <div className="text-xs text-gray-500">{e.date} · {e.journal}</div>
                    </div>
                    <div className="text-right">
                      {e.debit > 0 && <div className="text-red-600 font-semibold text-sm">-{e.debit.toLocaleString('fr-FR')} €</div>}
                      {e.credit > 0 && <div className="text-green-600 font-semibold text-sm">+{e.credit.toLocaleString('fr-FR')} €</div>}
                    </div>
                  </div>
                ))}
                {ecritures.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Aucune écriture comptable</p>}
              </div>
            </div>

            {/* Alertes */}
            <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-amber-800 mb-3">⚠️ Points d&apos;attention</h2>
              <div className="space-y-2">
                {lots.length === 0 && <div className="text-sm text-amber-700">• Aucun lot enregistré — commencez par ajouter les lots de la copropriété</div>}
                {appels.filter(a => a.statut === 'Brouillon').length > 0 && <div className="text-sm text-amber-700">• {appels.filter(a => a.statut === 'Brouillon').length} appel(s) de charges en brouillon à envoyer</div>}
                {totalTantiemes > 0 && totalTantiemes !== 10000 && <div className="text-sm text-amber-700">• Total tantièmes : {totalTantiemes} (devrait être 10 000 pour une copropriété standard)</div>}
                {lots.length > 0 && totalTantiemes === 10000 && appels.length > 0 && <div className="text-sm text-green-700">✅ Tantièmes équilibrés (10 000/10 000)</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── LOTS & TANTIÈMES ── */}
        {activeTab === 'lots' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">🏠 Lots & Tantièmes</h2>
                <p className="text-sm text-gray-500 mt-1">Total : {totalTantiemes.toFixed(0)} / 10 000 tantièmes · {lots.length} lots</p>
              </div>
              <button onClick={() => setShowLotModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">+ Ajouter un lot</button>
            </div>

            {/* Barre de progression tantièmes */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Tantièmes attribués</span>
                <span className={`font-bold ${totalTantiemes === 10000 ? 'text-green-600' : 'text-orange-600'}`}>{totalTantiemes.toFixed(0)} / 10 000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${totalTantiemes === 10000 ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((totalTantiemes / 10000) * 100, 100)}%` }} />
              </div>
            </div>

            {lots.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">🏠</div>
                <h3 className="text-xl font-bold mb-2">Aucun lot</h3>
                <p className="text-gray-500 mb-6">Commencez par enregistrer les lots de votre copropriété</p>
                <button onClick={() => setShowLotModal(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">+ Ajouter le premier lot</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 text-sm text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">N° Lot</th>
                      <th className="px-5 py-3 text-left font-semibold">Propriétaire</th>
                      <th className="px-5 py-3 text-left font-semibold">Étage</th>
                      <th className="px-5 py-3 text-right font-semibold">Surface (m²)</th>
                      <th className="px-5 py-3 text-right font-semibold">Tantièmes</th>
                      <th className="px-5 py-3 text-right font-semibold">Quote-part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l, i) => (
                      <tr key={l.id} className={`border-t ${i % 2 === 0 ? '' : 'bg-gray-50/50'} hover:bg-orange-50 transition`}>
                        <td className="px-5 py-3 font-bold text-orange-700">{l.numero}</td>
                        <td className="px-5 py-3">{l.proprietaire || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{l.etage || '—'}</td>
                        <td className="px-5 py-3 text-right">{l.surface || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold">{l.tantieme.toFixed(0)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{totalTantiemes > 0 ? ((l.tantieme / totalTantiemes) * 100).toFixed(2) : '0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50 font-bold border-t-2 border-orange-200">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-orange-800">TOTAL ({lots.length} lots)</td>
                      <td className="px-5 py-3 text-right text-orange-800">{totalTantiemes.toFixed(0)}</td>
                      <td className="px-5 py-3 text-right text-orange-800">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── APPELS DE CHARGES ── */}
        {activeTab === 'appels' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">📬 Appels de charges</h2>
              <button onClick={() => setShowAppelModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">+ Nouvel appel</button>
            </div>

            {appels.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📬</div>
                <h3 className="text-xl font-bold mb-2">Aucun appel de charges</h3>
                <p className="text-gray-500 mb-4">Créez vos appels de charges trimestriels ou mensuels</p>
                <button onClick={() => setShowAppelModal(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">+ Créer un appel</button>
              </div>
            ) : (
              <div className="space-y-4">
                {appels.map(a => {
                  const totalTantiemesLocal = lots.reduce((s, l) => s + l.tantieme, 0)
                  return (
                    <div key={a.id} className="bg-white rounded-2xl shadow-sm p-6">
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-bold text-lg">{a.periode}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.statut === 'Soldé' ? 'bg-green-100 text-green-700' : a.statut === 'Envoyé' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{a.statut}</span>
                          </div>
                          <div className="flex gap-6 text-sm text-gray-600 mb-4">
                            <span>💰 Budget total : <strong>{a.totalBudget.toLocaleString('fr-FR')} €</strong></span>
                            <span>🏠 {lots.length} lots</span>
                            <span>📅 {new Date(a.dateCreation).toLocaleDateString('fr-FR')}</span>
                          </div>
                          {lots.length > 0 && totalTantiemesLocal > 0 && (
                            <div className="overflow-x-auto">
                              <table className="text-xs border-collapse w-full max-w-xl">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="border border-gray-200 px-2 py-1 text-left">Lot</th>
                                    <th className="border border-gray-200 px-2 py-1 text-left">Propriétaire</th>
                                    <th className="border border-gray-200 px-2 py-1 text-right">Tantièmes</th>
                                    <th className="border border-gray-200 px-2 py-1 text-right font-bold text-orange-700">Quote-part</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lots.slice(0, 4).map(l => (
                                    <tr key={l.id}>
                                      <td className="border border-gray-200 px-2 py-1 font-bold">{l.numero}</td>
                                      <td className="border border-gray-200 px-2 py-1">{l.proprietaire || '—'}</td>
                                      <td className="border border-gray-200 px-2 py-1 text-right">{l.tantieme}</td>
                                      <td className="border border-gray-200 px-2 py-1 text-right font-bold text-orange-700">{((l.tantieme / totalTantiemesLocal) * a.totalBudget).toFixed(2)} €</td>
                                    </tr>
                                  ))}
                                  {lots.length > 4 && <tr><td colSpan={4} className="border border-gray-200 px-2 py-1 text-center text-gray-500">... et {lots.length - 4} autres lots</td></tr>}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {a.statut === 'Brouillon' && <button onClick={() => handleEnvoyerAppel(a.id)} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition">📤 Envoyer</button>}
                          {a.statut === 'Envoyé' && <button onClick={() => handleSolderAppel(a.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition">✅ Solder</button>}
                          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">📄 Imprimer</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── JOURNAL COMPTABLE ── */}
        {activeTab === 'journal' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">📒 Journal comptable</h2>
                <p className="text-sm text-gray-500 mt-1">Solde : <span className={`font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString('fr-FR')} €</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportJournalCSV} className="border-2 border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition">📥 Export CSV</button>
                <button onClick={() => setShowEcritureModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">+ Écriture</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totalDebit.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">Total débits</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalCredit.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">Total crédits</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className={`text-2xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-500 mt-1">Solde</div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">{ecritures.length}</div>
                <div className="text-xs text-gray-500 mt-1">Écritures</div>
              </div>
            </div>

            {ecritures.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📒</div>
                <h3 className="text-xl font-bold mb-2">Journal vide</h3>
                <p className="text-gray-500 mb-6">Commencez à saisir vos écritures comptables</p>
                <button onClick={() => setShowEcritureModal(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">+ Première écriture</button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Journal</th>
                      <th className="px-4 py-3 text-left">Libellé</th>
                      <th className="px-4 py-3 text-left">Compte</th>
                      <th className="px-4 py-3 text-right">Débit</th>
                      <th className="px-4 py-3 text-right">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecritures.map((e, i) => (
                      <tr key={e.id} className={`border-t hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 text-gray-600">{e.date}</td>
                        <td className="px-4 py-3"><span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono font-bold">{e.journal}</span></td>
                        <td className="px-4 py-3 font-medium">{e.libelle}</td>
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{e.compte || '—'}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">{e.debit > 0 ? e.debit.toLocaleString('fr-FR') + ' €' : ''}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{e.credit > 0 ? e.credit.toLocaleString('fr-FR') + ' €' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── BUDGET PRÉVISIONNEL ── */}
        {activeTab === 'budget' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">📋 Budget prévisionnel</h2>
              <button onClick={() => setShowBudgetModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">+ Nouveau budget</button>
            </div>

            {budgets.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-xl font-bold mb-2">Aucun budget</h3>
                <p className="text-gray-500 mb-6">Créez le budget prévisionnel de votre copropriété</p>
                <button onClick={() => setShowBudgetModal(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">+ Créer un budget</button>
              </div>
            ) : (
              budgets.map(b => {
                const totalBudgetItem = b.postes.reduce((s, p) => s + p.budget, 0)
                const totalRealise = b.postes.reduce((s, p) => s + p.realise, 0)
                const ecart = totalBudgetItem - totalRealise
                return (
                  <div key={b.id} className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold">{b.immeuble}</h3>
                        <p className="text-gray-500">Exercice {b.annee}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Budget total</div>
                        <div className="text-2xl font-bold text-orange-600">{totalBudgetItem.toLocaleString('fr-FR')} €</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left">Poste de charge</th>
                            <th className="px-4 py-2 text-right">Budget</th>
                            <th className="px-4 py-2 text-right">Réalisé</th>
                            <th className="px-4 py-2 text-right">Écart</th>
                            <th className="px-4 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.postes.map((p, i) => {
                            const e = p.budget - p.realise
                            const pct = p.budget > 0 ? (p.realise / p.budget) * 100 : 0
                            return (
                              <tr key={i} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2">{p.libelle}</td>
                                <td className="px-4 py-2 text-right">{p.budget.toLocaleString('fr-FR')} €</td>
                                <td className="px-4 py-2 text-right">{p.realise.toLocaleString('fr-FR')} €</td>
                                <td className={`px-4 py-2 text-right font-semibold ${e >= 0 ? 'text-green-600' : 'text-red-600'}`}>{e.toLocaleString('fr-FR')} €</td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                    <span className="text-xs">{pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="font-bold bg-orange-50 border-t-2 border-orange-200">
                          <tr>
                            <td className="px-4 py-3 text-orange-800">TOTAL</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalBudgetItem.toLocaleString('fr-FR')} €</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalRealise.toLocaleString('fr-FR')} €</td>
                            <td className={`px-4 py-3 text-right ${ecart >= 0 ? 'text-green-700' : 'text-red-700'}`}>{ecart.toLocaleString('fr-FR')} €</td>
                            <td className="px-4 py-3 text-right text-orange-800">{totalBudgetItem > 0 ? ((totalRealise / totalBudgetItem) * 100).toFixed(0) : 0}%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── CLÔTURE EXERCICE ── */}
        {activeTab === 'cloture' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-6">📁 Clôture d&apos;exercice</h2>
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">✅ Checklist de clôture annuelle</h3>
              <div className="space-y-3">
                {[
                  { label: 'Vérification de la balance générale', done: ecritures.length > 0 },
                  { label: 'Rapprochement bancaire effectué', done: false },
                  { label: 'Tous les appels de charges soldés', done: appels.every(a => a.statut === 'Soldé') && appels.length > 0 },
                  { label: 'Tableau de répartition par tantièmes vérifié', done: Math.abs(totalTantiemes - 10000) < 1 && lots.length > 0 },
                  { label: 'Validation du budget prévisionnel N+1', done: budgets.some(b => b.annee === new Date().getFullYear() + 1) },
                  { label: "Préparation du rapport pour l'AG annuelle", done: false },
                  { label: 'Export des pièces comptables', done: false },
                  { label: 'Archivage des documents (10 ans)', done: false },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.done ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${item.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{item.done ? '✓' : (i + 1)}</div>
                    <span className={`text-sm ${item.done ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-lg mb-4">📊 Résumé de l&apos;exercice {new Date().getFullYear()}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Total charges</div>
                  <div className="text-xl font-bold text-red-600">{totalDebit.toLocaleString('fr-FR')} €</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Total produits</div>
                  <div className="text-xl font-bold text-green-600">{totalCredit.toLocaleString('fr-FR')} €</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Résultat</div>
                  <div className={`text-xl font-bold ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solde.toLocaleString('fr-FR')} €</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Nombre de lots</div>
                  <div className="text-xl font-bold text-orange-600">{lots.length}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={exportJournalCSV} className="flex-1 border-2 border-orange-300 text-orange-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-orange-50 transition text-sm">📥 Exporter journal CSV</button>
                <button className="flex-1 bg-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition text-sm">📄 Rapport PDF</button>
              </div>
            </div>
          </div>
        )}

        {/* ── RAPPORTS AG ── */}
        {activeTab === 'rapports' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-6">📄 Rapports pour l&apos;Assemblée Générale</h2>
            <div className="space-y-4">
              {[
                { titre: 'Rapport financier annuel', desc: 'Bilan comptable, charges par poste, comparatif N/N-1', icon: '💰' },
                { titre: 'État des charges par lot', desc: 'Répartition par tantièmes pour chaque copropriétaire', icon: '🏠' },
                { titre: 'Budget prévisionnel N+1', desc: 'Propositions de budget pour le prochain exercice', icon: '📋' },
                { titre: 'Appels de charges — récapitulatif', desc: 'Tous les appels envoyés et leur statut de paiement', icon: '📬' },
                { titre: 'Fonds de travaux (article 14-2)', desc: 'État du fonds de réserve obligatoire', icon: '🏗️' },
                { titre: 'Contrats en cours', desc: "Liste des contrats d'entretien et prestataires", icon: '📑' },
              ].map((rapport, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex justify-between items-center hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{rapport.icon}</span>
                    <div>
                      <h3 className="font-bold">{rapport.titre}</h3>
                      <p className="text-sm text-gray-500">{rapport.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-semibold transition">👁 Prévisualiser</button>
                    <button className="text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-2 rounded-lg font-semibold transition">📄 PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AGENT IA COMPTABLE ── */}
        {activeTab === 'agent' && (
          <AgentComptableCopro
            immeubles={immeubles}
            selectedImmeubleId={selectedImmeubleId}
            setSelectedImmeubleId={setSelectedImmeubleId}
            lots={lots}
            ecritures={ecritures}
            appels={appels}
            budgets={budgets}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {showLotModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🏠 Nouveau lot</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">N° de lot *</label>
                  <input value={lotForm.numero} onChange={e => setLotForm({...lotForm, numero: e.target.value})} placeholder="Ex: 12 ou A205" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Étage</label>
                  <input value={lotForm.etage} onChange={e => setLotForm({...lotForm, etage: e.target.value})} placeholder="RDC, 1er, 2ème..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Propriétaire</label>
                <input value={lotForm.proprietaire} onChange={e => setLotForm({...lotForm, proprietaire: e.target.value})} placeholder="Nom du propriétaire" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Tantièmes</label>
                  <input type="number" value={lotForm.tantieme} onChange={e => setLotForm({...lotForm, tantieme: e.target.value})} placeholder="Ex: 250" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                  <p className="text-xs text-gray-500 mt-1">Sur 10 000 total</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Surface (m²)</label>
                  <input type="number" value={lotForm.surface} onChange={e => setLotForm({...lotForm, surface: e.target.value})} placeholder="45" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowLotModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAddLot} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {showAppelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📬 Nouvel appel de charges</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Période *</label>
                <input value={appelForm.periode} onChange={e => setAppelForm({...appelForm, periode: e.target.value})} placeholder="Ex: T1 2026, Janvier 2026..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Budget total (€)</label>
                <input type="number" value={appelForm.totalBudget} onChange={e => setAppelForm({...appelForm, totalBudget: e.target.value})} placeholder="Ex: 12500" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              {lots.length > 0 && parseFloat(appelForm.totalBudget) > 0 && (
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-800 mb-2">Répartition automatique par tantièmes :</p>
                  {lots.slice(0, 3).map(l => (
                    <div key={l.id} className="flex justify-between text-sm text-orange-700">
                      <span>Lot {l.numero} ({l.tantieme} tièmes)</span>
                      <span className="font-bold">{((l.tantieme / Math.max(totalTantiemes, 1)) * parseFloat(appelForm.totalBudget)).toFixed(2)} €</span>
                    </div>
                  ))}
                  {lots.length > 3 && <p className="text-xs text-orange-500 mt-1">...et {lots.length - 3} autres lots</p>}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAppelModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAddAppel} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Créer l&apos;appel</button>
            </div>
          </div>
        </div>
      )}

      {showEcritureModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📒 Nouvelle écriture comptable</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Date *</label>
                  <input type="date" value={ecritureForm.date} onChange={e => setEcritureForm({...ecritureForm, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Journal</label>
                  <select value={ecritureForm.journal} onChange={e => setEcritureForm({...ecritureForm, journal: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none">
                    {JOURNALS.map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Libellé *</label>
                <input value={ecritureForm.libelle} onChange={e => setEcritureForm({...ecritureForm, libelle: e.target.value})} placeholder="Ex: Facture électricité parties communes" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Débit (€)</label>
                  <input type="number" value={ecritureForm.debit} onChange={e => setEcritureForm({...ecritureForm, debit: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Crédit (€)</label>
                  <input type="number" value={ecritureForm.credit} onChange={e => setEcritureForm({...ecritureForm, credit: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">N° compte</label>
                  <input value={ecritureForm.compte} onChange={e => setEcritureForm({...ecritureForm, compte: e.target.value})} placeholder="Ex: 606100" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Immeuble</label>
                  <input value={ecritureForm.immeuble} onChange={e => setEcritureForm({...ecritureForm, immeuble: e.target.value})} placeholder="Résidence..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowEcritureModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAddEcriture} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Saisir</button>
            </div>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 Nouveau budget prévisionnel</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Immeuble / Résidence *</label>
                  <input value={budgetForm.immeuble} onChange={e => setBudgetForm({...budgetForm, immeuble: e.target.value})} placeholder="Résidence Les Pins" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Année</label>
                  <input type="number" value={budgetForm.annee} onChange={e => setBudgetForm({...budgetForm, annee: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <h3 className="font-bold text-gray-700 mt-2">Postes de charges</h3>
              {budgetPostes.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 flex-1">{p.libelle}</span>
                  <input
                    type="number"
                    value={p.budget || ''}
                    onChange={e => setBudgetPostes(budgetPostes.map((pp, ii) => ii === i ? { ...pp, budget: parseFloat(e.target.value) || 0 } : pp))}
                    placeholder="Budget €"
                    className="w-28 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-orange-400 outline-none text-right"
                  />
                  <span className="text-xs text-gray-500">€</span>
                </div>
              ))}
              <div className="bg-orange-50 rounded-xl p-3 flex justify-between">
                <span className="font-bold text-orange-800">Total budget</span>
                <span className="font-bold text-orange-600">{budgetPostes.reduce((s, p) => s + p.budget, 0).toLocaleString('fr-FR')} €</span>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowBudgetModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAddBudget} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Créer le budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ AG DIGITALE SECTION ══════════ */
function AGDigitaleSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'

  // Types enrichis — vote par correspondance + majorités légales
  type MajoriteType = 'art24' | 'art25' | 'art26' | 'unanimite'
  type VoteCorrespondance = { copropriétaire: string; tantiemes: number; vote: 'pour' | 'contre' | 'abstention'; recu: string }
  type Resolution = {
    id: string; titre: string; description: string; majorite: MajoriteType
    votePour: number; voteContre: number; voteAbstention: number
    votesCorrespondance: VoteCorrespondance[]
    statut: 'en_cours' | 'adoptée' | 'rejetée'
  }
  type AG = {
    id: string; titre: string; immeuble: string; date: string; lieu: string
    type: 'ordinaire' | 'extraordinaire'; statut: 'brouillon' | 'convoquée' | 'en_cours' | 'clôturée'
    ordre_du_jour: string[]; resolutions: Resolution[]
    quorum: number; totalTantiemes: number; presents: number
    signataireNom: string; signataireRole: string; signatureTs: string
    createdAt: string
  }

  const [ags, setAGs] = useState<AG[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_ags_${uid}`) || '[]') } catch { return [] } })
  const [activeAG, setActiveAG] = useState<AG | null>(null)
  const [showNewAG, setShowNewAG] = useState(false)
  const [showVote, setShowVote] = useState<Resolution | null>(null)
  const [showVoteCorr, setShowVoteCorr] = useState<Resolution | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [activeTab, setActiveTab] = useState<'liste' | 'details' | 'votes' | 'correspondance' | 'pv'>('liste')
  const [agForm, setAgForm] = useState({ titre: '', immeuble: '', date: '', lieu: '', type: 'ordinaire', quorum: '50', totalTantiemes: '10000', odj: '' })
  const [newResolution, setNewResolution] = useState({ titre: '', description: '', majorite: 'art24' as MajoriteType })
  const [voteCorForm, setVoteCorForm] = useState({ copropriétaire: '', tantiemes: '', vote: 'pour' as 'pour' | 'contre' | 'abstention', recu: new Date().toISOString().split('T')[0] })
  const [sigForm, setSigForm] = useState({ nom: '', role: 'Président de séance' })
  const [pvPdfLoading, setPvPdfLoading] = useState(false)
  const [quorumInput, setQuorumInput] = useState('')
  const [newResDesc, setNewResDesc] = useState('')
  const [voteInputs, setVoteInputs] = useState<Record<string, number>>({})

  const saveAGs = (updated: AG[]) => { setAGs(updated); localStorage.setItem(`fixit_ags_${uid}`, JSON.stringify(updated)) }

  // Calcul majorité selon la loi du 10/07/1965
  const calculerMajorite = (res: Resolution, totalTantièmes: number): { adopté: boolean; detail: string } => {
    const exprimés = res.votePour + res.voteContre // abstentions exclues pour art24
    const total = res.votePour + res.voteContre + res.voteAbstention
    switch (res.majorite) {
      case 'art24': // majorité simple des voix exprimées
        return { adopté: exprimés > 0 && res.votePour > res.voteContre, detail: `Art. 24 — Majorité simple : ${res.votePour} POUR / ${res.voteContre} CONTRE` }
      case 'art25': // majorité absolue des tantièmes du syndicat (>50% du total)
        return { adopté: res.votePour > totalTantièmes / 2, detail: `Art. 25 — Majorité absolue : ${res.votePour}/${totalTantièmes} (seuil : ${(totalTantièmes / 2).toFixed(0)})` }
      case 'art26': // double majorité : ≥2/3 des tantièmes ET >50% des copropriétaires (ici on fait 2/3 tantièmes)
        return { adopté: res.votePour >= totalTantièmes * 2 / 3, detail: `Art. 26 — Double majorité : ${res.votePour}/${totalTantièmes} (seuil : ${(totalTantièmes * 2 / 3).toFixed(0)})` }
      case 'unanimite':
        return { adopté: total > 0 && res.voteContre === 0 && res.voteAbstention === 0, detail: `Unanimité requise — ${total > 0 && res.voteContre === 0 ? 'AUCUN VOTE CONTRE' : `${res.voteContre} CONTRE`}` }
    }
  }

  const MAJORITE_LABELS: Record<MajoriteType, string> = { art24: 'Art. 24 — Majorité simple', art25: 'Art. 25 — Majorité absolue', art26: 'Art. 26 — Double majorité (2/3)', unanimite: 'Unanimité' }

  const handleCreateAG = () => {
    if (!agForm.titre.trim() || !agForm.date) return
    const ag: AG = {
      id: Date.now().toString(), titre: agForm.titre, immeuble: agForm.immeuble, date: agForm.date, lieu: agForm.lieu,
      type: agForm.type as any, statut: 'brouillon', ordre_du_jour: agForm.odj.split('\n').filter(l => l.trim()),
      resolutions: [], quorum: parseFloat(agForm.quorum) || 50, totalTantiemes: parseInt(agForm.totalTantiemes) || 10000,
      presents: 0, signataireNom: '', signataireRole: '', signatureTs: '', createdAt: new Date().toISOString()
    }
    const updated = [ag, ...ags]
    saveAGs(updated)
    setShowNewAG(false)
    setActiveAG(ag)
    setActiveTab('details')
    setAgForm({ titre: '', immeuble: '', date: '', lieu: '', type: 'ordinaire', quorum: '50', totalTantiemes: '10000', odj: '' })
  }

  const handleAddResolution = () => {
    if (!newResolution.titre.trim() || !activeAG) return
    const res: Resolution = { id: Date.now().toString(), titre: newResolution.titre, description: newResDesc, majorite: newResolution.majorite, votePour: 0, voteContre: 0, voteAbstention: 0, votesCorrespondance: [], statut: 'en_cours' }
    const updated = ags.map(a => a.id === activeAG.id ? { ...a, resolutions: [...a.resolutions, res] } : a)
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setNewResolution({ titre: '', description: '', majorite: 'art24' })
    setNewResDesc('')
  }

  const handleVoteSeance = (resId: string) => {
    if (!activeAG) return
    const pour = voteInputs[`${resId}_pour`] || 0
    const contre = voteInputs[`${resId}_contre`] || 0
    const abs = voteInputs[`${resId}_abs`] || 0
    const updated = ags.map(a => {
      if (a.id !== activeAG.id) return a
      const res = a.resolutions.map(r => {
        if (r.id !== resId) return r
        const newPour = r.votePour + pour
        const newContre = r.voteContre + contre
        const newAbs = r.voteAbstention + abs
        const { adopté } = calculerMajorite({ ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs }, a.totalTantiemes)
        return { ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs, statut: (newPour + newContre + newAbs > 0 ? (adopté ? 'adoptée' : 'rejetée') : 'en_cours') as Resolution['statut'] }
      })
      return { ...a, resolutions: res }
    })
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setVoteInputs(prev => { const n = {...prev}; delete n[`${resId}_pour`]; delete n[`${resId}_contre`]; delete n[`${resId}_abs`]; return n })
  }

  const handleVoteCorrespondance = () => {
    if (!showVoteCorr || !activeAG || !voteCorForm.copropriétaire.trim()) return
    const vc: VoteCorrespondance = { copropriétaire: voteCorForm.copropriétaire, tantiemes: parseInt(voteCorForm.tantiemes) || 0, vote: voteCorForm.vote, recu: voteCorForm.recu }
    const updated = ags.map(a => {
      if (a.id !== activeAG.id) return a
      const res = a.resolutions.map(r => {
        if (r.id !== showVoteCorr.id) return r
        const newVotesCorr = [...r.votesCorrespondance, vc]
        const newPour = r.votePour + (vc.vote === 'pour' ? vc.tantiemes : 0)
        const newContre = r.voteContre + (vc.vote === 'contre' ? vc.tantiemes : 0)
        const newAbs = r.voteAbstention + (vc.vote === 'abstention' ? vc.tantiemes : 0)
        const { adopté } = calculerMajorite({ ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs }, a.totalTantiemes)
        return { ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs, votesCorrespondance: newVotesCorr, statut: (newPour + newContre + newAbs > 0 ? (adopté ? 'adoptée' : 'rejetée') : 'en_cours') as Resolution['statut'] }
      })
      return { ...a, resolutions: res }
    })
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setShowVoteCorr(null)
    setVoteCorForm({ copropriétaire: '', tantiemes: '', vote: 'pour', recu: new Date().toISOString().split('T')[0] })
  }

  const handleSignerPV = () => {
    if (!activeAG || !sigForm.nom.trim()) return
    const ts = new Date().toISOString()
    const updated = ags.map(a => a.id === activeAG.id ? { ...a, signataireNom: sigForm.nom, signataireRole: sigForm.role, signatureTs: ts } : a)
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setShowSignature(false)
  }

  const handleConvoquer = (agId: string) => { const u = ags.map(a => a.id === agId ? { ...a, statut: 'convoquée' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null) }
  const handleDemarrer = (agId: string) => { const u = ags.map(a => a.id === agId ? { ...a, statut: 'en_cours' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null) }
  const handleCloture = (agId: string) => { const u = ags.map(a => a.id === agId ? { ...a, statut: 'clôturée' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null) }

  const exportPVPdf = async (ag: AG) => {
    setPvPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const addLine = (text: string, size = 10, bold = false, color: [number,number,number] = [0,0,0]) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, textWidth)
        lines.forEach((line: string) => { if (y > 270) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += size * 0.45 })
        y += 2
      }

      // En-tête
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 35, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('PROCÈS-VERBAL D\'ASSEMBLÉE GÉNÉRALE', W/2, 15, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica','normal')
      doc.text(ag.type === 'ordinaire' ? 'ASSEMBLÉE GÉNÉRALE ORDINAIRE' : 'ASSEMBLÉE GÉNÉRALE EXTRAORDINAIRE', W/2, 24, { align: 'center' })
      y = 45

      addLine(ag.titre, 14, true, [30,64,175])
      y += 2
      addLine(`Immeuble : ${ag.immeuble || '—'}`, 10, false, [80,80,80])
      addLine(`Date : ${new Date(ag.date).toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`, 10)
      addLine(`Lieu : ${ag.lieu || 'Non précisé'}`, 10)
      y += 4

      // Quorum
      doc.setFillColor(239,246,255); doc.rect(margin, y, textWidth, 22, 'F')
      y += 6
      addLine('QUORUM', 11, true, [37,99,235])
      addLine(`Tantièmes présents/représentés : ${ag.presents} / ${ag.totalTantiemes} (${ag.totalTantiemes > 0 ? ((ag.presents/ag.totalTantiemes)*100).toFixed(1) : 0}%)  —  Quorum requis : ${ag.quorum}%`, 9)
      y += 4

      // Ordre du jour
      addLine('ORDRE DU JOUR', 12, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4
      ag.ordre_du_jour.forEach((item, i) => addLine(`${i+1}. ${item}`, 10))
      y += 4

      // Résolutions
      addLine('RÉSOLUTIONS ET VOTES', 12, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4
      ag.resolutions.forEach((r, i) => {
        if (y > 240) { doc.addPage(); y = 20 }
        const { adopté, detail } = calculerMajorite(r, ag.totalTantiemes)
        doc.setFillColor(adopté ? 240 : 254, adopté ? 253 : 242, adopté ? 244 : 242)
        doc.rect(margin, y-2, textWidth, 44, 'F')
        addLine(`Résolution ${i+1} — ${r.titre}`, 11, true, adopté ? [22,101,52] : [185,28,28])
        addLine(MAJORITE_LABELS[r.majorite], 9, false, [100,100,100])
        if (r.description) addLine(r.description, 9)
        addLine(`POUR : ${r.votePour} tantièmes   |   CONTRE : ${r.voteContre} tantièmes   |   ABSTENTION : ${r.voteAbstention} tantièmes`, 9)
        addLine(detail, 9, false, [80,80,80])
        addLine(`RÉSULTAT : ${r.statut.toUpperCase()}`, 10, true, adopté ? [22,101,52] : [185,28,28])
        if (r.votesCorrespondance.length > 0) {
          addLine(`Votes par correspondance (${r.votesCorrespondance.length}) :`, 9, true)
          r.votesCorrespondance.forEach(vc => addLine(`  • ${vc.copropriétaire} — ${vc.tantiemes} tantièmes — ${vc.vote.toUpperCase()} (reçu le ${new Date(vc.recu).toLocaleDateString('fr-FR')})`, 8))
        }
        y += 4
      })

      // Résumé
      const adopted = ag.resolutions.filter(r => r.statut === 'adoptée').length
      const rejected = ag.resolutions.filter(r => r.statut === 'rejetée').length
      y += 4
      doc.setFillColor(249,250,251); doc.rect(margin, y, textWidth, 18, 'F')
      y += 5
      addLine(`RÉSUMÉ : ${adopted} résolution(s) adoptée(s)  ·  ${rejected} rejetée(s)  ·  ${ag.resolutions.length - adopted - rejected} en cours`, 10, true)
      y += 8

      // Signature
      if (ag.signataireNom) {
        doc.setFillColor(240,253,244); doc.rect(margin, y, textWidth, 28, 'F')
        y += 5
        addLine('SIGNATURE ÉLECTRONIQUE', 11, true, [22,101,52])
        addLine(`Signé par : ${ag.signataireNom} — ${ag.signataireRole}`, 10)
        addLine(`Horodatage : ${new Date(ag.signatureTs).toLocaleString('fr-FR')}`, 9)
        addLine(`Empreinte : ${btoa(ag.id + ag.signataireNom + ag.signatureTs).substring(0,32).toUpperCase()}`, 8, false, [100,100,100])
      } else {
        addLine('⚠️  PV non encore signé', 10, true, [180,83,9])
      }

      // Pied de page
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,150)
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.text(`Vitfix Pro — Généré le ${new Date().toLocaleString('fr-FR')}  |  Page ${p}/${pages}`, W/2, 290, { align: 'center' })
      }

      doc.save(`PV_AG_${ag.titre.replace(/\s+/g,'_')}_${ag.date.split('T')[0]}.pdf`)
    } catch(e) { alert('Erreur génération PDF : ' + e) }
    setPvPdfLoading(false)
  }

  const STATUS_COLORS: Record<string, string> = { brouillon: 'bg-gray-100 text-gray-700', convoquée: 'bg-blue-100 text-blue-700', en_cours: 'bg-orange-100 text-orange-700', clôturée: 'bg-green-100 text-green-700' }
  const RES_COLORS: Record<string, string> = { en_cours: 'bg-orange-100 text-orange-700', adoptée: 'bg-green-100 text-green-700', rejetée: 'bg-red-100 text-red-700' }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">🏛️ Assemblées Générales Digitales</h1><p className="text-sm text-gray-500">Convocation · Vote séance & correspondance · Majorités loi 1965 · PV PDF signé</p></div>
        <button onClick={() => setShowNewAG(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm">+ Nouvelle AG</button>
      </div>

      {!activeAG ? (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">Total AG</div><div className="text-3xl font-bold text-blue-600">{ags.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-400"><div className="text-sm text-gray-500">En cours</div><div className="text-3xl font-bold text-orange-600">{ags.filter(a => a.statut === 'en_cours').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Clôturées</div><div className="text-3xl font-bold text-green-600">{ags.filter(a => a.statut === 'clôturée').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-400"><div className="text-sm text-gray-500">Résolutions totales</div><div className="text-3xl font-bold text-purple-600">{ags.reduce((s, a) => s + a.resolutions.length, 0)}</div></div>
          </div>
          {ags.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-6xl mb-4">🏛️</div><h3 className="text-xl font-bold mb-2">Aucune AG</h3><p className="text-gray-500 mb-6">Organisez vos assemblées générales 100% en ligne avec vote par correspondance</p><button onClick={() => setShowNewAG(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">+ Créer la première AG</button></div>
          ) : (
            <div className="space-y-4">
              {ags.map(ag => (
                <div key={ag.id} onClick={() => { setActiveAG(ag); setActiveTab('details') }} className="bg-white rounded-2xl shadow-sm p-6 cursor-pointer hover:shadow-md transition hover:border-blue-200 border-2 border-transparent">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap"><h3 className="font-bold text-lg">{ag.titre}</h3><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[ag.statut]}`}>{ag.statut}</span><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{ag.type}</span>{ag.signataireNom && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">✍️ Signé</span>}</div>
                      <div className="flex gap-4 text-sm text-gray-500 flex-wrap">{ag.immeuble && <span>🏢 {ag.immeuble}</span>}<span>📅 {new Date(ag.date).toLocaleDateString('fr-FR')}</span>{ag.lieu && <span>📍 {ag.lieu}</span>}<span>📋 {ag.resolutions.length} résolution(s)</span><span>✅ {ag.resolutions.filter(r => r.statut === 'adoptée').length} adoptée(s)</span><span>📮 {ag.resolutions.reduce((s,r) => s + r.votesCorrespondance.length, 0)} vote(s) correspondance</span></div>
                    </div>
                    <div className="text-gray-300 text-2xl">›</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 lg:p-8">
          <button onClick={() => setActiveAG(null)} className="flex items-center gap-2 text-blue-600 hover:underline mb-6 font-semibold">← Retour à la liste</button>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-2xl font-bold">{activeAG.titre}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_COLORS[activeAG.statut]}`}>{activeAG.statut}</span>
            {activeAG.signataireNom && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">✍️ Signé par {activeAG.signataireNom}</span>}
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {activeAG.statut === 'brouillon' && <button onClick={() => handleConvoquer(activeAG.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">📤 Envoyer convocations</button>}
            {activeAG.statut === 'convoquée' && <button onClick={() => handleDemarrer(activeAG.id)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600">▶️ Démarrer l'AG</button>}
            {activeAG.statut === 'en_cours' && <button onClick={() => handleCloture(activeAG.id)} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700">✅ Clôturer l'AG</button>}
            {activeAG.statut === 'clôturée' && !activeAG.signataireNom && <button onClick={() => setShowSignature(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700">✍️ Signer le PV</button>}
            {activeAG.statut === 'clôturée' && <button onClick={() => exportPVPdf(activeAG)} disabled={pvPdfLoading} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-900 disabled:opacity-60">{pvPdfLoading ? '⏳ Génération…' : '📄 Exporter PV PDF'}</button>}
          </div>

          <div className="flex gap-1 mb-6 border-b overflow-x-auto">
            {(['details', 'votes', 'correspondance', 'pv'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                {tab === 'details' ? '📋 Détails & Quorum' : tab === 'votes' ? '🗳️ Votes en séance' : tab === 'correspondance' ? '📮 Vote par correspondance' : '📄 Procès-Verbal'}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-lg mb-4">📋 Informations</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2"><span className="text-gray-500 w-36">Immeuble</span><span className="font-semibold">{activeAG.immeuble || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">Date</span><span className="font-semibold">{new Date(activeAG.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">Lieu</span><span>{activeAG.lieu || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">Type</span><span className="capitalize">{activeAG.type === 'ordinaire' ? 'Assemblée Générale Ordinaire (AGO)' : 'Assemblée Générale Extraordinaire (AGE)'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">Quorum requis</span><span className="font-semibold">{activeAG.quorum}%</span></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-lg mb-4">👥 Quorum — {activeAG.presents} / {activeAG.totalTantiemes} tantièmes</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1"><span>Taux de présence</span><span className={`font-bold ${activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? 'text-green-600' : 'text-orange-500'}`}>{activeAG.totalTantiemes > 0 ? ((activeAG.presents / activeAG.totalTantiemes) * 100).toFixed(1) : 0}% {activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? '✅ Atteint' : '⚠️ Insuffisant'}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden"><div className={`h-4 rounded-full transition-all ${activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((activeAG.presents / activeAG.totalTantiemes) * 100, 100)}%` }} /></div>
                  <div className="text-xs text-gray-500 mt-1">Seuil quorum : {(activeAG.totalTantiemes * activeAG.quorum / 100).toFixed(0)} tantièmes</div>
                </div>
                {activeAG.statut === 'en_cours' && (
                  <div className="flex gap-2 mt-3">
                    <input type="number" value={quorumInput} onChange={e => setQuorumInput(e.target.value)} placeholder="Tantièmes à ajouter" className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                    <button onClick={() => { const v = parseInt(quorumInput || '0'); if (v > 0) { const u = ags.map(a => a.id === activeAG.id ? { ...a, presents: a.presents + v } : a); saveAGs(u); setActiveAG(u.find(a => a.id === activeAG.id) || null); setQuorumInput('') } }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">+ Ajouter</button>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6 xl:col-span-2">
                <h3 className="font-bold text-lg mb-4">📝 Ordre du jour</h3>
                {activeAG.ordre_du_jour.length === 0 ? <p className="text-gray-500 text-sm">Aucun point défini</p> : <ol className="list-decimal pl-5 space-y-2 text-sm">{activeAG.ordre_du_jour.map((item, i) => <li key={i} className="py-1 border-b border-gray-100 last:border-0">{item}</li>)}</ol>}
              </div>
            </div>
          )}

          {activeTab === 'votes' && (
            <div>
              {activeAG.statut === 'en_cours' && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                  <h3 className="font-bold mb-4">+ Nouvelle résolution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={newResolution.titre} onChange={e => setNewResolution({...newResolution, titre: e.target.value})} placeholder="Titre de la résolution *" className="md:col-span-2 border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm" />
                    <select value={newResolution.majorite} onChange={e => setNewResolution({...newResolution, majorite: e.target.value as MajoriteType})} className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm">
                      {(Object.entries(MAJORITE_LABELS) as [MajoriteType, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <textarea value={newResDesc} onChange={e => setNewResDesc(e.target.value)} placeholder="Description (optionnelle)" rows={2} className="md:col-span-3 border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm resize-none" />
                    <button onClick={handleAddResolution} className="md:col-span-3 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">Ajouter la résolution</button>
                  </div>
                </div>
              )}
              {activeAG.resolutions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">Aucune résolution. {activeAG.statut === 'en_cours' ? 'Ajoutez des résolutions à mettre aux votes.' : ''}</div>
              ) : (
                <div className="space-y-4">
                  {activeAG.resolutions.map((res, i) => {
                    const { adopté, detail } = calculerMajorite(res, activeAG.totalTantiemes)
                    const total = res.votePour + res.voteContre + res.voteAbstention
                    return (
                      <div key={res.id} className={`bg-white rounded-2xl shadow-sm p-6 border-l-4 ${res.statut === 'adoptée' ? 'border-green-400' : res.statut === 'rejetée' ? 'border-red-400' : 'border-orange-300'}`}>
                        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                          <div>
                            <h4 className="font-bold text-lg">Résolution {i + 1} — {res.titre}</h4>
                            {res.description && <p className="text-sm text-gray-500 mt-1">{res.description}</p>}
                            <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">{MAJORITE_LABELS[res.majorite]}</span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${RES_COLORS[res.statut]}`}>{res.statut}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="text-center bg-green-50 rounded-xl p-3"><div className="text-2xl font-bold text-green-600">{res.votePour}</div><div className="text-xs text-gray-500">✅ Pour (tantièmes)</div></div>
                          <div className="text-center bg-red-50 rounded-xl p-3"><div className="text-2xl font-bold text-red-600">{res.voteContre}</div><div className="text-xs text-gray-500">❌ Contre</div></div>
                          <div className="text-center bg-gray-50 rounded-xl p-3"><div className="text-2xl font-bold text-gray-600">{res.voteAbstention}</div><div className="text-xs text-gray-500">⬜ Abstention</div></div>
                        </div>
                        {total > 0 && (
                          <div className="mb-3">
                            <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
                              <div className="bg-green-400 h-full" style={{ width: `${total > 0 ? (res.votePour/total*100) : 0}%` }} />
                              <div className="bg-red-400 h-full" style={{ width: `${total > 0 ? (res.voteContre/total*100) : 0}%` }} />
                              <div className="bg-gray-300 h-full" style={{ width: `${total > 0 ? (res.voteAbstention/total*100) : 0}%` }} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{detail}</div>
                          </div>
                        )}
                        {res.votesCorrespondance.length > 0 && <div className="text-xs text-purple-600 mb-3">📮 {res.votesCorrespondance.length} vote(s) par correspondance inclus</div>}
                        {activeAG.statut === 'en_cours' && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <input type="number" min="0" placeholder="Pour" value={voteInputs[`${res.id}_pour`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_pour`]: parseInt(e.target.value)||0}))} className="border-2 border-green-200 rounded-xl px-3 py-2 text-sm focus:border-green-500 outline-none" />
                            <input type="number" min="0" placeholder="Contre" value={voteInputs[`${res.id}_contre`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_contre`]: parseInt(e.target.value)||0}))} className="border-2 border-red-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 outline-none" />
                            <input type="number" min="0" placeholder="Abstention" value={voteInputs[`${res.id}_abs`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_abs`]: parseInt(e.target.value)||0}))} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-gray-400 outline-none" />
                            <button onClick={() => handleVoteSeance(res.id)} className="col-span-3 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">🗳️ Valider ce vote en séance</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'correspondance' && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-blue-800"><strong>📮 Vote par correspondance</strong> — Conformément à l'article 17-1A de la loi du 10/07/1965, les copropriétaires peuvent voter par correspondance avant l'AG. Ces votes sont automatiquement intégrés dans le calcul des majorités.</p>
              </div>
              {activeAG.resolutions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">Aucune résolution. Créez d'abord des résolutions dans l'onglet "Votes en séance".</div>
              ) : (
                <div className="space-y-4">
                  {activeAG.resolutions.map((res, i) => (
                    <div key={res.id} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-bold">Résolution {i+1} — {res.titre}</h4>
                          <span className="text-xs text-blue-600">{MAJORITE_LABELS[res.majorite]}</span>
                        </div>
                        {(activeAG.statut === 'convoquée' || activeAG.statut === 'en_cours') && (
                          <button onClick={() => setShowVoteCorr(res)} className="bg-purple-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-purple-700">+ Enregistrer vote correspondance</button>
                        )}
                      </div>
                      {res.votesCorrespondance.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">Aucun vote par correspondance</div>
                      ) : (
                        <div className="space-y-1">
                          {res.votesCorrespondance.map((vc, j) => (
                            <div key={j} className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl px-3 py-2">
                              <span className="font-semibold flex-1">{vc.copropriétaire}</span>
                              <span className="text-gray-500">{vc.tantiemes} tantièmes</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${vc.vote === 'pour' ? 'bg-green-100 text-green-700' : vc.vote === 'contre' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{vc.vote.toUpperCase()}</span>
                              <span className="text-gray-500 text-xs">reçu le {new Date(vc.recu).toLocaleDateString('fr-FR')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pv' && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                <h3 className="font-bold text-lg">📄 Procès-Verbal</h3>
                <div className="flex gap-2 flex-wrap">
                  {activeAG.statut === 'clôturée' && !activeAG.signataireNom && <button onClick={() => setShowSignature(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700">✍️ Signer</button>}
                  <button onClick={() => exportPVPdf(activeAG)} disabled={pvPdfLoading} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-900 disabled:opacity-60">{pvPdfLoading ? '⏳…' : '📥 PDF'}</button>
                </div>
              </div>
              <div className="font-mono text-xs bg-gray-50 rounded-xl p-5 whitespace-pre-wrap leading-relaxed border">
{`PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE ${activeAG.type.toUpperCase()}
════════════════════════════════════════════
${activeAG.titre}
${activeAG.immeuble ? `Immeuble : ${activeAG.immeuble}\n` : ''}Date  : ${new Date(activeAG.date).toLocaleString('fr-FR')}
Lieu  : ${activeAG.lieu || 'Non précisé'}

QUORUM
Tantièmes présents/représentés : ${activeAG.presents} / ${activeAG.totalTantiemes} (${activeAG.totalTantiemes > 0 ? ((activeAG.presents/activeAG.totalTantiemes)*100).toFixed(1) : 0}%)
Quorum requis : ${activeAG.quorum}%

ORDRE DU JOUR
${activeAG.ordre_du_jour.map((item, i) => `${i+1}. ${item}`).join('\n') || 'Non défini'}

RÉSOLUTIONS
${activeAG.resolutions.map((r, i) => {
  const { adopté, detail } = calculerMajorite(r, activeAG.totalTantiemes)
  return `\nRésolution ${i+1} : ${r.titre}
  Règle de majorité : ${MAJORITE_LABELS[r.majorite]}
  Pour : ${r.votePour} tantièmes | Contre : ${r.voteContre} | Abstention : ${r.voteAbstention}
  Votes par correspondance : ${r.votesCorrespondance.length}
  ${detail}
  ► RÉSULTAT : ${r.statut.toUpperCase()}`
}).join('\n────────────────\n')}

RÉSUMÉ
Adoptées : ${activeAG.resolutions.filter(r=>r.statut==='adoptée').length} | Rejetées : ${activeAG.resolutions.filter(r=>r.statut==='rejetée').length} | Total : ${activeAG.resolutions.length}

${activeAG.signataireNom ? `SIGNATURE ÉLECTRONIQUE
Signé par : ${activeAG.signataireNom} (${activeAG.signataireRole})
Horodatage : ${new Date(activeAG.signatureTs).toLocaleString('fr-FR')}
Hash : ${typeof btoa !== 'undefined' ? btoa(activeAG.id + activeAG.signataireNom + activeAG.signatureTs).substring(0,32).toUpperCase() : 'N/A'}` : '⚠️  PV non encore signé'}
`}
              </div>
              {activeAG.statut !== 'clôturée' && <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">⚠️ L'AG doit être clôturée avant de pouvoir signer le PV.</div>}
            </div>
          )}
        </div>
      )}

      {showNewAG && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🏛️ Nouvelle Assemblée Générale</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Titre *</label><input value={agForm.titre} onChange={e => setAgForm({...agForm, titre: e.target.value})} placeholder="AG Annuelle 2026 — Résidence Les Pins" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Immeuble</label><input value={agForm.immeuble} onChange={e => setAgForm({...agForm, immeuble: e.target.value})} placeholder="Résidence Les Pins, 12 rue..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Date *</label><input type="datetime-local" value={agForm.date} onChange={e => setAgForm({...agForm, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Type</label><select value={agForm.type} onChange={e => setAgForm({...agForm, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none"><option value="ordinaire">Ordinaire (AGO)</option><option value="extraordinaire">Extraordinaire (AGE)</option></select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Lieu</label><input value={agForm.lieu} onChange={e => setAgForm({...agForm, lieu: e.target.value})} placeholder="Salle de réunion, 12 rue..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Quorum (%)</label><input type="number" value={agForm.quorum} onChange={e => setAgForm({...agForm, quorum: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Total tantièmes</label><input type="number" value={agForm.totalTantiemes} onChange={e => setAgForm({...agForm, totalTantiemes: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Ordre du jour (un point par ligne)</label><textarea value={agForm.odj} onChange={e => setAgForm({...agForm, odj: e.target.value})} rows={5} placeholder={"Approbation des comptes 2025\nVote du budget 2026\nTravaux de ravalement\nQuestions diverses"} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowNewAG(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreateAG} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Créer l'AG</button>
            </div>
          </div>
        </div>
      )}

      {showVoteCorr && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📮 Vote par correspondance</h2><p className="text-sm text-gray-500 mt-1">{showVoteCorr.titre}</p></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Copropriétaire *</label><input value={voteCorForm.copropriétaire} onChange={e => setVoteCorForm({...voteCorForm, copropriétaire: e.target.value})} placeholder="Nom du copropriétaire" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Tantièmes *</label><input type="number" value={voteCorForm.tantiemes} onChange={e => setVoteCorForm({...voteCorForm, tantiemes: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Date réception</label><input type="date" value={voteCorForm.recu} onChange={e => setVoteCorForm({...voteCorForm, recu: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-2">Sens du vote *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pour', 'contre', 'abstention'] as const).map(v => (
                    <button key={v} onClick={() => setVoteCorForm({...voteCorForm, vote: v})} className={`py-2 rounded-xl text-sm font-semibold border-2 transition ${voteCorForm.vote === v ? (v === 'pour' ? 'bg-green-500 text-white border-green-500' : v === 'contre' ? 'bg-red-500 text-white border-red-500' : 'bg-gray-500 text-white border-gray-500') : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {v === 'pour' ? '✅ POUR' : v === 'contre' ? '❌ CONTRE' : '⬜ ABSTENTION'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowVoteCorr(null)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleVoteCorrespondance} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showSignature && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">✍️ Signature électronique du PV</h2><p className="text-sm text-gray-500 mt-1">Cette action est horodatée et irréversible</p></div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">La signature électronique horodate le document et génère une empreinte unique. Elle constitue la preuve de validation du PV.</div>
              <div><label className="block text-sm font-semibold mb-1">Nom du signataire *</label><input value={sigForm.nom} onChange={e => setSigForm({...sigForm, nom: e.target.value})} placeholder="Prénom NOM" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Qualité / Rôle</label><select value={sigForm.role} onChange={e => setSigForm({...sigForm, role: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 outline-none"><option>Président de séance</option><option>Syndic</option><option>Secrétaire de séance</option><option>Scrutateur</option></select></div>
              <div className="text-xs text-gray-500">Horodatage : {new Date().toLocaleString('fr-FR')}</div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowSignature(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleSignerPV} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">✍️ Signer le PV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ IMPAYÉS SECTION ══════════ */
function ImpayésSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'

  type AppelFonds = { id: string; immeuble: string; periode: string; montantTotalBudget: number; dateEmission: string; dateEcheance: string; lots: { lot: string; copropriétaire: string; tantiemes: number; montant: number }[] }
  type Impayé = { id: string; copropriétaire: string; lot: string; immeuble: string; montant: number; dateEchéance: string; dateRelance1?: string; dateRelance2?: string; dateRelance3?: string; statut: 'impayé' | 'relance_1' | 'relance_2' | 'contentieux' | 'soldé'; notes: string }

  const [activeTab, setActiveTab] = useState<'impayés' | 'appels'>('impayés')
  const [impayés, setImpayés] = useState<Impayé[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_impayés_${uid}`) || '[]') } catch { return [] } })
  const [appels, setAppels] = useState<AppelFonds[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_appels_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [showAppelModal, setShowAppelModal] = useState(false)
  const [filter, setFilter] = useState<'tous' | 'impayé' | 'relance_1' | 'relance_2' | 'contentieux' | 'soldé'>('tous')
  const [form, setForm] = useState({ copropriétaire: '', lot: '', immeuble: '', montant: '', dateEchéance: '', notes: '' })
  const [appelForm, setAppelForm] = useState({ immeuble: '', periode: '', montantTotalBudget: '', dateEmission: new Date().toISOString().split('T')[0], dateEcheance: '', lotsText: '' })
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  const saveImpayés = (u: Impayé[]) => { setImpayés(u); localStorage.setItem(`fixit_impayés_${uid}`, JSON.stringify(u)) }
  const saveAppels = (u: AppelFonds[]) => { setAppels(u); localStorage.setItem(`fixit_appels_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.copropriétaire.trim() || !form.montant) return
    const i: Impayé = { id: Date.now().toString(), copropriétaire: form.copropriétaire, lot: form.lot, immeuble: form.immeuble, montant: parseFloat(form.montant), dateEchéance: form.dateEchéance, statut: 'impayé', notes: form.notes }
    saveImpayés([i, ...impayés])
    setShowModal(false)
    setForm({ copropriétaire: '', lot: '', immeuble: '', montant: '', dateEchéance: '', notes: '' })
  }

  const handleRelance = (id: string) => {
    const i = impayés.find(imp => imp.id === id)
    if (!i) return
    const now = new Date().toISOString().split('T')[0]
    let update: Partial<Impayé> = {}
    if (i.statut === 'impayé') update = { statut: 'relance_1', dateRelance1: now }
    else if (i.statut === 'relance_1') update = { statut: 'relance_2', dateRelance2: now }
    else if (i.statut === 'relance_2') update = { statut: 'contentieux', dateRelance3: now }
    saveImpayés(impayés.map(imp => imp.id === id ? { ...imp, ...update } : imp))
  }

  const handleSolder = (id: string) => { saveImpayés(impayés.map(imp => imp.id === id ? { ...imp, statut: 'soldé' } : imp)) }

  const handleCreateAppel = () => {
    if (!appelForm.immeuble.trim() || !appelForm.periode.trim()) return
    const lots = appelForm.lotsText.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(';').map(p => p.trim())
      return { lot: parts[0] || '', copropriétaire: parts[1] || '', tantiemes: parseInt(parts[2]) || 0, montant: parseFloat(parts[3]) || 0 }
    })
    const af: AppelFonds = { id: Date.now().toString(), immeuble: appelForm.immeuble, periode: appelForm.periode, montantTotalBudget: parseFloat(appelForm.montantTotalBudget) || 0, dateEmission: appelForm.dateEmission, dateEcheance: appelForm.dateEcheance, lots }
    saveAppels([af, ...appels])
    setShowAppelModal(false)
    setAppelForm({ immeuble: '', periode: '', montantTotalBudget: '', dateEmission: new Date().toISOString().split('T')[0], dateEcheance: '', lotsText: '' })
  }

  const exportAppelPdf = async (af: AppelFonds) => {
    setPdfLoading(`appel_${af.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const addText = (text: string, size = 10, bold = false, color: [number,number,number] = [0,0,0], align: 'left' | 'center' | 'right' = 'left') => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color)
        if (align !== 'left') { doc.text(text, align === 'center' ? W/2 : W - margin, y, { align }); y += size * 0.45 + 2 }
        else { const lines = doc.splitTextToSize(text, textWidth); lines.forEach((l: string) => { if (y > 270) { doc.addPage(); y = 20 }; doc.text(l, margin, y); y += size * 0.45 }); y += 2 }
      }

      // En-tête bleu
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('APPEL DE FONDS', W/2, 14, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`${af.immeuble}  ·  ${af.periode}`, W/2, 23, { align: 'center' })
      doc.text(`Émis le ${new Date(af.dateEmission).toLocaleDateString('fr-FR')}  ·  Échéance : ${af.dateEcheance ? new Date(af.dateEcheance).toLocaleDateString('fr-FR') : 'N/A'}`, W/2, 30, { align: 'center' })
      y = 48

      // Budget global
      doc.setFillColor(239,246,255); doc.rect(margin, y, textWidth, 14, 'F')
      y += 5
      addText(`Budget prévisionnel total : ${af.montantTotalBudget.toLocaleString('fr-FR')} €`, 12, true, [37,99,235])
      y += 4

      // Tableau des lots
      addText('DÉTAIL PAR LOT', 11, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4

      // En-têtes tableau
      doc.setFillColor(249,250,251); doc.rect(margin, y-2, textWidth, 8, 'F')
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80)
      doc.text('LOT', margin+2, y+3)
      doc.text('COPROPRIÉTAIRE', margin+25, y+3)
      doc.text('TANTIÈMES', margin+100, y+3)
      doc.text('MONTANT APPELÉ', margin+130, y+3)
      y += 10

      const totalMontant = af.lots.reduce((s, l) => s + l.montant, 0)
      af.lots.forEach((lot, idx) => {
        if (y > 260) { doc.addPage(); y = 20 }
        if (idx % 2 === 0) { doc.setFillColor(248,250,252); doc.rect(margin, y-3, textWidth, 8, 'F') }
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        doc.text(lot.lot, margin+2, y+2)
        doc.text(lot.copropriétaire, margin+25, y+2)
        doc.text(lot.tantiemes.toString(), margin+105, y+2, { align: 'right' })
        doc.setFont('helvetica','bold'); doc.setTextColor(37,99,235)
        doc.text(`${lot.montant.toLocaleString('fr-FR')} €`, W-margin-2, y+2, { align: 'right' })
        y += 8
      })

      y += 4
      doc.setFillColor(37,99,235); doc.rect(margin, y, textWidth, 10, 'F')
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text('TOTAL APPELÉ', margin+5, y+7)
      doc.text(`${totalMontant.toLocaleString('fr-FR')} €`, W-margin-5, y+7, { align: 'right' })
      y += 20

      // Modalités paiement
      doc.setFillColor(254,249,195); doc.rect(margin, y, textWidth, 24, 'F')
      y += 5
      addText('MODALITÉS DE PAIEMENT', 10, true, [146,64,14])
      addText(`Veuillez virer le montant correspondant à votre lot avant le ${af.dateEcheance ? new Date(af.dateEcheance).toLocaleDateString('fr-FR') : 'la date indiquée'}.`, 9, false, [80,80,80])
      addText('IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX  ·  BIC : XXXXXXXX', 9, false, [80,80,80])
      addText('Référence : Appel de fonds ' + af.periode + ' — Lot N° [votre lot]', 9, false, [80,80,80])

      // Pied de page
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,150)
        doc.text(`Vitfix Pro — Appel de fonds généré le ${new Date().toLocaleString('fr-FR')}  |  Page ${p}/${pages}`, W/2, 290, { align: 'center' })
      }
      doc.save(`AppelFonds_${af.immeuble.replace(/\s+/g,'_')}_${af.periode.replace(/\s+/g,'_')}.pdf`)
    } catch(e) { alert('Erreur PDF : ' + e) }
    setPdfLoading(null)
  }

  const exportRelatancePdf = async (i: Impayé) => {
    setPdfLoading(`relance_${i.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const relanceNum = i.statut === 'relance_1' ? 1 : i.statut === 'relance_2' ? 2 : i.statut === 'contentieux' ? 3 : 1
      const colors: Record<number, [number,number,number]> = { 1: [234,88,12], 2: [202,138,4], 3: [147,51,234] }
      const color = colors[relanceNum] || [234,88,12]
      const titles: Record<number, string> = { 1: 'PREMIER RAPPEL AMIABLE', 2: 'MISE EN DEMEURE', 3: 'MISE EN DEMEURE AVANT CONTENTIEUX' }

      // En-tête coloré selon niveau relance
      doc.setFillColor(...color); doc.rect(0, 0, W, 40, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text(titles[relanceNum], W/2, 16, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`Charges de copropriété impayées — ${i.immeuble || 'Résidence'}`, W/2, 26, { align: 'center' })
      doc.text(`Lot ${i.lot || 'N/A'}  ·  ${new Date().toLocaleDateString('fr-FR')}`, W/2, 34, { align: 'center' })
      y = 52

      // Destinataire
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text(`À l'attention de : ${i.copropriétaire}`, margin, y); y += 8
      if (i.lot) { doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Lot n° ${i.lot}${i.immeuble ? ` — ${i.immeuble}` : ''}`, margin, y); y += 6 }
      y += 8

      // Corps lettre
      const bodies: Record<number, string> = {
        1: `Madame, Monsieur,

Nous vous informons qu'à ce jour, votre compte de charges de copropriété présente un solde débiteur. Nous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais.

Après vérification de notre comptabilité, vous restez redevable de la somme de :`,
        2: `Madame, Monsieur,

Malgré notre premier rappel qui vous a été adressé le ${i.dateRelance1 ? new Date(i.dateRelance1).toLocaleDateString('fr-FR') : 'récemment'}, votre compte de charges de copropriété présente toujours un solde débiteur.

Par la présente, nous vous mettons en demeure de régler la somme de :`,
        3: `Madame, Monsieur,

Nous avons déjà eu l'occasion de vous contacter à deux reprises concernant votre dette de charges de copropriété, sans qu'aucune régularisation n'ait été effectuée à ce jour.

En l'absence de règlement dans un délai de 8 jours, nous serons dans l'obligation de transmettre ce dossier à notre conseil juridique pour engagement d'une procédure de recouvrement devant le Tribunal judiciaire. Vous en supporterez alors les frais.

Le montant restant dû s'élève à :`
      }

      doc.setFontSize(10); doc.setFont('helvetica','normal')
      const bodyLines = doc.splitTextToSize(bodies[relanceNum], textWidth)
      bodyLines.forEach((line: string) => { if (y > 255) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += 5 })
      y += 6

      // Montant encadré
      doc.setFillColor(254,242,242); doc.rect(margin, y, textWidth, 16, 'F')
      doc.setDrawColor(...color); doc.setLineWidth(0.5); doc.rect(margin, y, textWidth, 16)
      doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(...color)
      doc.text(`${i.montant.toLocaleString('fr-FR')} €`, W/2, y+11, { align: 'center' })
      y += 26

      // Suite lettre
      const endings: Record<number, string> = {
        1: `Nous restons à votre disposition pour tout renseignement complémentaire et espérons une régularisation rapide de votre situation.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
        2: `Nous vous demandons de bien vouloir procéder à ce règlement dans un délai de 15 jours à compter de la réception du présent courrier.\n\nEn l'absence de règlement, nous serons contraints d'engager une procédure de recouvrement amiable puis contentieuse.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
        3: `Nous vous accordons un ultime délai de 8 jours pour régulariser votre situation avant tout engagement de procédure judiciaire.\n\nVeuillez agréer, Madame, Monsieur, nos salutations distinguées.`
      }
      const endLines = doc.splitTextToSize(endings[relanceNum], textWidth)
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
      endLines.forEach((line: string) => { if (y > 255) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += 5 })
      y += 15

      // Signature syndic
      doc.text('Le Syndic de copropriété', margin, y); y += 5
      doc.text('_________________________________', margin, y); y += 4
      doc.setFontSize(8); doc.setTextColor(120,120,120)
      doc.text(`Généré par Vitfix Pro — ${new Date().toLocaleString('fr-FR')}`, margin, y)

      doc.save(`Relance${relanceNum}_${i.copropriétaire.replace(/\s+/g,'_')}_${i.lot || 'lot'}.pdf`)
    } catch(e) { alert('Erreur PDF : ' + e) }
    setPdfLoading(null)
  }

  const filtered = filter === 'tous' ? impayés : impayés.filter(i => i.statut === filter)
  const totalImpayé = impayés.filter(i => i.statut !== 'soldé').reduce((s, i) => s + i.montant, 0)
  const STATUS_COLORS: Record<string, string> = { impayé: 'bg-red-100 text-red-700', relance_1: 'bg-orange-100 text-orange-700', relance_2: 'bg-yellow-100 text-yellow-800', contentieux: 'bg-purple-100 text-purple-700', soldé: 'bg-green-100 text-green-700' }
  const STATUS_LABELS: Record<string, string> = { impayé: '⚠️ Impayé', relance_1: '📨 Relance 1', relance_2: '📨 Relance 2', contentieux: '⚖️ Contentieux', soldé: '✅ Soldé' }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-red-400 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">⚠️ Impayés & Appels de Fonds</h1><p className="text-sm text-gray-500">Relances graduées PDF · Lettres de mise en demeure · Appels de fonds par lot</p></div>
        <div className="flex gap-2">
          {activeTab === 'impayés' && <button onClick={() => setShowModal(true)} className="bg-red-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition">+ Impayé</button>}
          {activeTab === 'appels' && <button onClick={() => setShowAppelModal(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition">+ Appel de fonds</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex">
        <button onClick={() => setActiveTab('impayés')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === 'impayés' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}>⚠️ Suivi Impayés</button>
        <button onClick={() => setActiveTab('appels')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === 'appels' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>📋 Appels de Fonds</button>
      </div>

      {activeTab === 'impayés' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400 xl:col-span-2"><div className="text-sm text-gray-500">Total impayés en cours</div><div className="text-3xl font-bold text-red-600">{totalImpayé.toLocaleString('fr-FR')} €</div></div>
            {(['impayé', 'relance_1', 'relance_2', 'contentieux'] as const).map(s => (
              <div key={s} className="bg-white p-4 rounded-2xl shadow-sm text-center"><div className="text-2xl font-bold">{impayés.filter(i => i.statut === s).length}</div><div className="text-xs text-gray-500 mt-1">{STATUS_LABELS[s]}</div></div>
            ))}
          </div>

          <div className="flex gap-2 mb-6 flex-wrap">
            {(['tous', 'impayé', 'relance_1', 'relance_2', 'contentieux', 'soldé'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === f ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{f === 'tous' ? 'Tous' : STATUS_LABELS[f]} ({f === 'tous' ? impayés.length : impayés.filter(i => i.statut === f).length})</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">✅</div><h3 className="text-xl font-bold mb-2">{filter === 'tous' ? 'Aucun impayé' : 'Aucun résultat'}</h3></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Copropriétaire</th>
                    <th className="px-4 py-3 text-left">Lot / Immeuble</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-center">Échéance</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{i.copropriétaire}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{i.lot || '—'}{i.immeuble ? ` · ${i.immeuble}` : ''}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{i.montant.toLocaleString('fr-FR')} €</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{i.dateEchéance ? new Date(i.dateEchéance).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{STATUS_LABELS[i.statut]}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {i.statut !== 'soldé' && i.statut !== 'contentieux' && <button onClick={() => handleRelance(i.id)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-orange-200 whitespace-nowrap">📨 Relancer</button>}
                          {(i.statut === 'relance_1' || i.statut === 'relance_2' || i.statut === 'contentieux') && (
                            <button onClick={() => exportRelatancePdf(i)} disabled={pdfLoading === `relance_${i.id}`} className="text-xs bg-purple-100 text-purple-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-purple-200 whitespace-nowrap disabled:opacity-60">{pdfLoading === `relance_${i.id}` ? '⏳' : '📄 Lettre PDF'}</button>
                          )}
                          {i.statut !== 'soldé' && <button onClick={() => handleSolder(i.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-green-200">✅ Solder</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'appels' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">Appels de fonds</div><div className="text-3xl font-bold text-blue-600">{appels.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Total appelé</div><div className="text-2xl font-bold text-green-600">{appels.reduce((s, a) => s + a.montantTotalBudget, 0).toLocaleString('fr-FR')} €</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-400"><div className="text-sm text-gray-500">Lots totaux</div><div className="text-3xl font-bold text-purple-600">{appels.reduce((s, a) => s + a.lots.length, 0)}</div></div>
          </div>
          {appels.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📋</div><h3 className="text-xl font-bold mb-2">Aucun appel de fonds</h3><p className="text-gray-500 mb-6">Créez des appels de fonds pour les copropriétaires et générez le PDF</p><button onClick={() => setShowAppelModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">+ Premier appel de fonds</button></div>
          ) : (
            <div className="space-y-4">
              {appels.map(af => (
                <div key={af.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <h3 className="font-bold text-lg">{af.immeuble}</h3>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                        <span>📅 {af.periode}</span>
                        <span>💰 Budget : {af.montantTotalBudget.toLocaleString('fr-FR')} €</span>
                        <span>🏠 {af.lots.length} lots</span>
                        <span>📆 Émis le {new Date(af.dateEmission).toLocaleDateString('fr-FR')}</span>
                        {af.dateEcheance && <span>⚠️ Échéance : {new Date(af.dateEcheance).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                    <button onClick={() => exportAppelPdf(af)} disabled={pdfLoading === `appel_${af.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap">{pdfLoading === `appel_${af.id}` ? '⏳ Génération…' : '📄 Exporter PDF'}</button>
                  </div>
                  {af.lots.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead><tr className="text-gray-500 border-b"><th className="text-left py-1 pr-4">Lot</th><th className="text-left py-1 pr-4">Copropriétaire</th><th className="text-right py-1 pr-4">Tantièmes</th><th className="text-right py-1">Montant appelé</th></tr></thead>
                        <tbody>{af.lots.map((l, j) => <tr key={j} className="border-b border-gray-50"><td className="py-1 pr-4 font-medium">{l.lot}</td><td className="py-1 pr-4 text-gray-600">{l.copropriétaire}</td><td className="py-1 pr-4 text-right">{l.tantiemes}</td><td className="py-1 text-right font-semibold text-blue-600">{l.montant.toLocaleString('fr-FR')} €</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">⚠️ Enregistrer un impayé</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Copropriétaire *</label><input value={form.copropriétaire} onChange={e => setForm({...form, copropriétaire: e.target.value})} placeholder="Nom du copropriétaire" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Lot</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder="Apt 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Montant (€) *</label><input type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Immeuble</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder="Résidence..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Date d'échéance</label><input type="date" value={form.dateEchéance} onChange={e => setForm({...form, dateEchéance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Informations complémentaires..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showAppelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 Nouvel appel de fonds</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Immeuble *</label><input value={appelForm.immeuble} onChange={e => setAppelForm({...appelForm, immeuble: e.target.value})} placeholder="Résidence Les Pins" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Période *</label><input value={appelForm.periode} onChange={e => setAppelForm({...appelForm, periode: e.target.value})} placeholder="T1 2026 / Janvier 2026" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Budget prévisionnel total (€)</label><input type="number" value={appelForm.montantTotalBudget} onChange={e => setAppelForm({...appelForm, montantTotalBudget: e.target.value})} placeholder="50000" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Date émission</label><input type="date" value={appelForm.dateEmission} onChange={e => setAppelForm({...appelForm, dateEmission: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Date échéance</label><input type="date" value={appelForm.dateEcheance} onChange={e => setAppelForm({...appelForm, dateEcheance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Lots (un par ligne : lot;copropriétaire;tantièmes;montant)</label>
                <textarea value={appelForm.lotsText} onChange={e => setAppelForm({...appelForm, lotsText: e.target.value})} rows={6} placeholder={"A101;Dupont Jean;450;1125.00\nB203;Martin Sophie;380;950.00\nC305;Garcia Pedro;170;425.00"} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none font-mono text-sm" />
                <p className="text-xs text-gray-500 mt-1">Format : Numéro lot ; Nom copropriétaire ; Tantièmes ; Montant appelé</p>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAppelModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreateAppel} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">Créer l'appel de fonds</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ CARNET D'ENTRETIEN SECTION ══════════ */
function CarnetEntretienSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'

  type Intervention = { id: string; date: string; nature: string; immeuble: string; localisation: string; prestataire: string; cout: number; garantie: string; statut: 'réalisé' | 'planifié' | 'en_cours'; notes: string; dpe?: string }
  type EtatDate = { id: string; immeuble: string; adresse: string; dateVente: string; acquereur: string; vendeur: string; notaire: string; syndicNom: string; syndicAdresse: string; dateGeneration: string; chargesExercice: number; chargesRestant: number; travoteVotee: number; travauxRestant: number; fondsTravaux: number; impayesCopro: number; proceduresEnCours: string; diagnosticsDPE: string; reglement: string; notes: string }

  const [activeTab, setActiveTab] = useState<'carnet' | 'etat_date' | 'dpe'>('carnet')
  const [interventions, setInterventions] = useState<Intervention[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_carnet_${uid}`) || '[]') } catch { return [] } })
  const [etats, setEtats] = useState<EtatDate[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_etat_date_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [showEtatModal, setShowEtatModal] = useState(false)
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterDpe, setFilterDpe] = useState<string>('')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], nature: '', immeuble: '', localisation: '', prestataire: '', cout: '', garantie: '', statut: 'réalisé', notes: '', dpe: '' })
  const [etatForm, setEtatForm] = useState({ immeuble: '', adresse: '', dateVente: '', acquereur: '', vendeur: '', notaire: '', syndicNom: '', syndicAdresse: '', chargesExercice: '', chargesRestant: '', travoteVotee: '', travauxRestant: '', fondsTravaux: '', impayesCopro: '', proceduresEnCours: '', diagnosticsDPE: '', reglement: '', notes: '' })

  const saveInterventions = (u: Intervention[]) => { setInterventions(u); localStorage.setItem(`fixit_carnet_${uid}`, JSON.stringify(u)) }
  const saveEtats = (u: EtatDate[]) => { setEtats(u); localStorage.setItem(`fixit_etat_date_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.nature.trim()) return
    const i: Intervention = { id: Date.now().toString(), date: form.date, nature: form.nature, immeuble: form.immeuble, localisation: form.localisation, prestataire: form.prestataire, cout: parseFloat(form.cout) || 0, garantie: form.garantie, statut: form.statut as any, notes: form.notes, dpe: form.dpe }
    saveInterventions([i, ...interventions])
    setShowModal(false)
    setForm({ date: new Date().toISOString().split('T')[0], nature: '', immeuble: '', localisation: '', prestataire: '', cout: '', garantie: '', statut: 'réalisé', notes: '', dpe: '' })
  }

  const handleCreateEtat = () => {
    if (!etatForm.immeuble.trim()) return
    const e: EtatDate = { id: Date.now().toString(), ...etatForm, chargesExercice: parseFloat(etatForm.chargesExercice) || 0, chargesRestant: parseFloat(etatForm.chargesRestant) || 0, travoteVotee: parseFloat(etatForm.travoteVotee) || 0, travauxRestant: parseFloat(etatForm.travauxRestant) || 0, fondsTravaux: parseFloat(etatForm.fondsTravaux) || 0, impayesCopro: parseFloat(etatForm.impayesCopro) || 0, dateGeneration: new Date().toISOString() }
    saveEtats([e, ...etats])
    setShowEtatModal(false)
    setEtatForm({ immeuble: '', adresse: '', dateVente: '', acquereur: '', vendeur: '', notaire: '', syndicNom: '', syndicAdresse: '', chargesExercice: '', chargesRestant: '', travoteVotee: '', travauxRestant: '', fondsTravaux: '', impayesCopro: '', proceduresEnCours: '', diagnosticsDPE: '', reglement: '', notes: '' })
  }

  const exportEtatDatePdf = async (e: EtatDate) => {
    setPdfLoading(`etat_${e.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 18; const textWidth = W - 2 * margin
      let y = 18

      const line = (txt: string, size = 9, bold = false, clr: [number,number,number] = [0,0,0], xa = margin) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...clr)
        const ls = doc.splitTextToSize(txt, textWidth - (xa - margin))
        ls.forEach((l: string) => { if (y > 272) { doc.addPage(); y = 18 }; doc.text(l, xa, y); y += size * 0.43 }); y += 1.5
      }
      const sectionTitle = (title: string) => {
        y += 3; doc.setFillColor(37,99,235); doc.rect(margin, y-4, textWidth, 8, 'F')
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text(title, margin+4, y+0.5); y += 8
      }
      const row = (label: string, val: string, highlight = false) => {
        if (highlight) { doc.setFillColor(254,249,195); doc.rect(margin, y-3, textWidth, 7, 'F') }
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80); doc.text(label, margin+3, y+0.5)
        doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        const vlines = doc.splitTextToSize(val || '—', textWidth - 72)
        vlines.forEach((vl: string, vi: number) => { doc.text(vl, margin + 72, y + vi * 4.5) })
        y += Math.max(6, vlines.length * 4.5); doc.setDrawColor(230,230,230); doc.line(margin, y-1, margin+textWidth, y-1)
      }

      // En-tête officiel
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 45, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont('helvetica','bold')
      doc.text('ÉTAT DATÉ', W/2, 13, { align: 'center' })
      doc.setFontSize(9); doc.setFont('helvetica','normal')
      doc.text('Article 5 du Décret n°67-223 du 17 mars 1967 — Loi n°65-557 du 10 juillet 1965', W/2, 21, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica','bold')
      doc.text(e.immeuble, W/2, 31, { align: 'center' })
      if (e.adresse) { doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text(e.adresse, W/2, 38, { align: 'center' }) }
      y = 52

      // Infos mutation
      sectionTitle('I. IDENTIFICATION DE LA MUTATION')
      row('Date de vente prévue', e.dateVente ? new Date(e.dateVente).toLocaleDateString('fr-FR') : '—')
      row('Acquéreur', e.acquereur)
      row('Vendeur / Cédant', e.vendeur)
      row('Notaire chargé de l\'acte', e.notaire)

      sectionTitle('II. IDENTIFICATION DU SYNDIC')
      row('Cabinet syndic', e.syndicNom)
      row('Adresse du syndic', e.syndicAdresse)
      row('Date d\'établissement', new Date(e.dateGeneration).toLocaleDateString('fr-FR'))

      sectionTitle('III. CHARGES ET PROVISIONS')
      row('Charges budget exercice en cours', e.chargesExercice > 0 ? `${e.chargesExercice.toLocaleString('fr-FR')} €` : '—', e.chargesExercice > 0)
      row('Charges restant à solder (quote-part lot)', e.chargesRestant > 0 ? `${e.chargesRestant.toLocaleString('fr-FR')} €` : '—', e.chargesRestant > 0)
      row('Travaux votés non encore appelés', e.travoteVotee > 0 ? `${e.travoteVotee.toLocaleString('fr-FR')} €` : '0 €')
      row('Travaux restant à effectuer (quote-part)', e.travauxRestant > 0 ? `${e.travauxRestant.toLocaleString('fr-FR')} €` : '—', e.travauxRestant > 0)

      sectionTitle('IV. FONDS DE TRAVAUX (Art. 14-2 Loi 1965)')
      row('Fonds de travaux — quote-part lot', e.fondsTravaux > 0 ? `${e.fondsTravaux.toLocaleString('fr-FR')} €` : '—', e.fondsTravaux > 0)

      sectionTitle('V. SITUATION DES IMPAYÉS')
      row('Impayés de charges de la copropriété', e.impayesCopro > 0 ? `${e.impayesCopro.toLocaleString('fr-FR')} €` : 'Néant', e.impayesCopro > 0)
      row('Procédures en cours', e.proceduresEnCours || 'Aucune')

      if (e.diagnosticsDPE) {
        sectionTitle('VI. DIAGNOSTICS & DPE')
        line(e.diagnosticsDPE, 9)
      }

      if (e.reglement || e.notes) {
        sectionTitle('VII. INFORMATIONS COMPLÉMENTAIRES')
        if (e.reglement) { line('Règlement de copropriété : ' + e.reglement, 9) }
        if (e.notes) { line(e.notes, 9) }
      }

      // Certification
      y += 6
      doc.setFillColor(240,253,244); doc.rect(margin, y, textWidth, 24, 'F')
      doc.setDrawColor(22,101,52); doc.rect(margin, y, textWidth, 24)
      y += 6
      line('CERTIFICATION DU SYNDIC', 10, true, [22,101,52])
      line(`Je soussigné(e), représentant le cabinet syndic ${e.syndicNom || '[Cabinet]'}, certifie l'exactitude des informations figurant dans le présent état daté établi conformément aux textes légaux en vigueur.`, 9, false, [40,40,40])
      y += 4
      doc.setFontSize(9); doc.setTextColor(80,80,80)
      doc.text('Date et signature :', margin+5, y)
      doc.text('_______________________________', margin+50, y)
      y += 10

      // Mentions légales
      doc.setFontSize(7); doc.setTextColor(150,150,150)
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.text(`État daté — ${e.immeuble}  |  Généré par Vitfix Pro le ${new Date().toLocaleString('fr-FR')}  |  Page ${p}/${pages}`, W/2, 292, { align: 'center' })
      }
      doc.save(`EtatDate_${e.immeuble.replace(/\s+/g,'_')}_${new Date(e.dateGeneration).toISOString().split('T')[0]}.pdf`)
    } catch(err) { alert('Erreur PDF : ' + err) }
    setPdfLoading(null)
  }

  const exportCarnetPdf = async () => {
    setPdfLoading('carnet')
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 18
      let y = 18

      doc.setFillColor(13,148,136); doc.rect(0,0,W,35,'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('CARNET D\'ENTRETIEN', W/2, 14, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${interventions.length} intervention(s)`, W/2, 24, { align: 'center' })
      y = 45

      const byYear: Record<string, Intervention[]> = {}
      interventions.forEach(i => { const yr = new Date(i.date).getFullYear().toString(); if (!byYear[yr]) byYear[yr] = []; byYear[yr].push(i) })
      const years = Object.keys(byYear).sort((a,b) => parseInt(b)-parseInt(a))

      years.forEach(yr => {
        if (y > 240) { doc.addPage(); y = 18 }
        doc.setFillColor(13,148,136); doc.rect(margin, y-3, W-2*margin, 9, 'F')
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text(`ANNÉE ${yr}`, margin+4, y+3); y += 10

        byYear[yr].forEach((itv, idx) => {
          if (y > 265) { doc.addPage(); y = 18 }
          if (idx%2===0) { doc.setFillColor(248,250,252); doc.rect(margin, y-2, W-2*margin, 18, 'F') }
          doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
          doc.text(new Date(itv.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }), margin+2, y+4)
          doc.text(itv.nature, margin+25, y+4)
          const sc: Record<string, string> = { réalisé: '✓ Réalisé', planifié: '⋯ Planifié', en_cours: '→ En cours' }
          doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80)
          doc.text(sc[itv.statut] || itv.statut, W-margin-35, y+4)
          y += 6
          doc.setFontSize(8); doc.setTextColor(100,100,100)
          const details = [itv.immeuble && `🏢 ${itv.immeuble}`, itv.localisation && `📍 ${itv.localisation}`, itv.prestataire && `👷 ${itv.prestataire}`, itv.cout>0 && `💰 ${itv.cout.toLocaleString('fr-FR')} €`, itv.garantie && `🛡️ ${itv.garantie}`].filter(Boolean).join('  ·  ')
          if (details) { const ls = doc.splitTextToSize(details, W-2*margin-10); ls.forEach((l: string) => { doc.text(l, margin+25, y); y += 4 }) }
          y += 4; doc.setDrawColor(220,220,220); doc.line(margin, y, W-margin, y); y += 3
        })
        y += 4
      })

      const pages = doc.getNumberOfPages()
      for (let p=1; p<=pages; p++) { doc.setPage(p); doc.setFontSize(7); doc.setTextColor(150,150,150); doc.text(`Vitfix Pro — Carnet d'entretien — Page ${p}/${pages}`, W/2, 292, { align: 'center' }) }
      doc.save(`CarnetEntretien_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch(err) { alert('Erreur PDF : ' + err) }
    setPdfLoading(null)
  }

  const immeubles = [...new Set(interventions.map(i => i.immeuble).filter(Boolean))]
  const filtered = filterImmeuble ? interventions.filter(i => i.immeuble === filterImmeuble) : interventions
  const totalCouts = filtered.reduce((s, i) => s + i.cout, 0)
  const STATUS_COLORS: Record<string, string> = { réalisé: 'bg-green-100 text-green-700', planifié: 'bg-blue-100 text-blue-700', en_cours: 'bg-orange-100 text-orange-700' }
  const DPE_COLORS: Record<string, string> = { A: 'bg-green-700 text-white', B: 'bg-green-500 text-white', C: 'bg-lime-400 text-gray-900', D: 'bg-yellow-400 text-gray-900', E: 'bg-orange-400 text-white', F: 'bg-orange-600 text-white', G: 'bg-red-600 text-white' }
  const NATURES = ['Entretien ascenseur', 'Ravalement façade', 'Toiture / étanchéité', 'Plomberie collective', 'Électricité commune', 'Espaces verts', 'Nettoyage parties communes', 'Chaufferie / chaudière', 'Parking', 'Digicode / Interphone', 'Peinture parties communes', 'Menuiserie', 'Désinfection / dératisation', 'Contrôle technique', 'Diagnostic DPE collectif', 'Autre']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-teal-500 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">📖 Carnet d'Entretien & État Daté</h1><p className="text-sm text-gray-500">Traçabilité travaux · État daté PDF mutation · Suivi DPE collectif</p></div>
        <div className="flex gap-2">
          {activeTab === 'carnet' && <><button onClick={exportCarnetPdf} disabled={pdfLoading === 'carnet' || interventions.length === 0} className="bg-gray-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-60">{pdfLoading === 'carnet' ? '⏳' : '📄 Export PDF'}</button><button onClick={() => setShowModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700">+ Intervention</button></>}
          {activeTab === 'etat_date' && <button onClick={() => setShowEtatModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-700">+ Nouvel état daté</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex overflow-x-auto">
        <button onClick={() => setActiveTab('carnet')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'carnet' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>📖 Carnet d'entretien</button>
        <button onClick={() => setActiveTab('etat_date')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'etat_date' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500'}`}>📋 État Daté (mutation)</button>
        <button onClick={() => setActiveTab('dpe')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'dpe' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'}`}>🏷️ Suivi DPE Collectif</button>
      </div>

      {/* ── CARNET ── */}
      {activeTab === 'carnet' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-teal-400"><div className="text-sm text-gray-500">Interventions</div><div className="text-3xl font-bold text-teal-600">{filtered.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">Planifiées</div><div className="text-3xl font-bold text-blue-600">{filtered.filter(i => i.statut === 'planifié').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Coût total</div><div className="text-2xl font-bold text-green-600">{totalCouts.toLocaleString('fr-FR')} €</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-400"><div className="text-sm text-gray-500">Immeubles</div><div className="text-3xl font-bold text-purple-600">{immeubles.length}</div></div>
          </div>

          {immeubles.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              <button onClick={() => setFilterImmeuble('')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${!filterImmeuble ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>Tous ({interventions.length})</button>
              {immeubles.map(im => <button key={im} onClick={() => setFilterImmeuble(im)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filterImmeuble === im ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>{im}</button>)}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📖</div><h3 className="text-xl font-bold mb-2">Carnet vide</h3><p className="text-gray-500 mb-6">Enregistrez toutes les interventions pour traçabilité complète</p><button onClick={() => setShowModal(true)} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700">+ Première intervention</button></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col md:flex-row gap-4">
                  <div className="w-20 text-center flex-shrink-0 bg-gray-50 rounded-xl py-3">
                    <div className="text-xs text-gray-500">{new Date(i.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-lg font-bold text-gray-700">{new Date(i.date).getFullYear()}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap"><h3 className="font-bold">{i.nature}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{i.statut}</span>{i.dpe && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${DPE_COLORS[i.dpe] || 'bg-gray-100 text-gray-600'}`}>DPE {i.dpe}</span>}</div>
                    <div className="flex gap-3 text-sm text-gray-500 flex-wrap">
                      {i.immeuble && <span>🏢 {i.immeuble}</span>}
                      {i.localisation && <span>📍 {i.localisation}</span>}
                      {i.prestataire && <span>👷 {i.prestataire}</span>}
                      {i.cout > 0 && <span className="font-semibold text-gray-700">💰 {i.cout.toLocaleString('fr-FR')} €</span>}
                      {i.garantie && <span>🛡️ {i.garantie}</span>}
                    </div>
                    {i.notes && <p className="text-xs text-gray-500 mt-1">{i.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ÉTAT DATÉ ── */}
      {activeTab === 'etat_date' && (
        <div className="p-6 lg:p-8">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
            <p className="text-sm text-indigo-800"><strong>📋 État daté — Art. 5 Décret 67-223</strong> — Document obligatoire lors de toute mutation de lot de copropriété. Générez un PDF conforme en quelques secondes.</p>
          </div>
          {etats.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📋</div><h3 className="text-xl font-bold mb-2">Aucun état daté</h3><p className="text-gray-500 mb-6">Générez des états datés conformes à la loi pour chaque mutation de lot</p><button onClick={() => setShowEtatModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">+ Créer un état daté</button></div>
          ) : (
            <div className="space-y-4">
              {etats.map(e => (
                <div key={e.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <h3 className="font-bold text-lg">{e.immeuble}</h3>
                      <div className="text-sm text-gray-500 mt-1 flex gap-4 flex-wrap">
                        {e.adresse && <span>📍 {e.adresse}</span>}
                        {e.acquereur && <span>👤 Acquéreur : {e.acquereur}</span>}
                        {e.dateVente && <span>📅 Vente : {new Date(e.dateVente).toLocaleDateString('fr-FR')}</span>}
                        <span>📆 Généré le {new Date(e.dateGeneration).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex gap-4 text-sm mt-2 flex-wrap">
                        {e.chargesRestant > 0 && <span className="text-orange-600 font-semibold">Charges restant : {e.chargesRestant.toLocaleString('fr-FR')} €</span>}
                        {e.fondsTravaux > 0 && <span className="text-blue-600 font-semibold">Fonds travaux : {e.fondsTravaux.toLocaleString('fr-FR')} €</span>}
                        {e.impayesCopro > 0 && <span className="text-red-600 font-semibold">⚠️ Impayés : {e.impayesCopro.toLocaleString('fr-FR')} €</span>}
                      </div>
                    </div>
                    <button onClick={() => exportEtatDatePdf(e)} disabled={pdfLoading === `etat_${e.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap">{pdfLoading === `etat_${e.id}` ? '⏳ Génération…' : '📄 Exporter État Daté PDF'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DPE COLLECTIF ── */}
      {activeTab === 'dpe' && (
        <div className="p-6 lg:p-8">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
            <p className="text-sm text-orange-800"><strong>🏷️ DPE Collectif</strong> — Depuis le 1er janvier 2024, le DPE collectif est obligatoire pour les copropriétés &gt;200 lots et progressivement pour toutes. Filtrez vos interventions par classe DPE pour le suivi.</p>
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            <button onClick={() => setFilterDpe('')} className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${!filterDpe ? 'bg-gray-700 text-white' : 'bg-white text-gray-600'}`}>Tous</button>
            {['A','B','C','D','E','F','G'].map(cl => (
              <button key={cl} onClick={() => setFilterDpe(filterDpe === cl ? '' : cl)} className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${filterDpe === cl ? DPE_COLORS[cl] : 'bg-white text-gray-600 border-2 border-gray-200'}`}>{cl}</button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3 mb-8">
            {['A','B','C','D','E','F','G'].map(cl => {
              const count = interventions.filter(i => i.dpe === cl).length
              return (
                <div key={cl} className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <div className={`w-10 h-10 rounded-xl ${DPE_COLORS[cl]} flex items-center justify-center text-lg font-black mx-auto mb-2`}>{cl}</div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-gray-500">{count === 1 ? 'immeuble' : 'immeubles'}</div>
                </div>
              )
            })}
          </div>

          {interventions.filter(i => i.nature.toLowerCase().includes('dpe') || i.dpe).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center"><div className="text-4xl mb-3">🏷️</div><p className="text-gray-500">Ajoutez des interventions de type "Diagnostic DPE collectif" avec la classe DPE pour les suivre ici.</p></div>
          ) : (
            <div className="space-y-3">
              {interventions.filter(i => (i.nature.toLowerCase().includes('dpe') || i.dpe) && (!filterDpe || i.dpe === filterDpe)).map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
                  {i.dpe && <div className={`w-12 h-12 rounded-xl ${DPE_COLORS[i.dpe]} flex items-center justify-center text-xl font-black flex-shrink-0`}>{i.dpe}</div>}
                  <div className="flex-1">
                    <div className="font-bold">{i.immeuble || 'Immeuble non précisé'}</div>
                    <div className="text-sm text-gray-500">{new Date(i.date).toLocaleDateString('fr-FR')} · {i.prestataire || 'Prestataire non précisé'}</div>
                    {i.garantie && <div className="text-xs text-gray-500">Validité : {i.garantie}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{i.statut}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Intervention */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📖 Nouvelle intervention</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Statut</label><select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="réalisé">✅ Réalisé</option><option value="en_cours">🔄 En cours</option><option value="planifié">📅 Planifié</option></select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Nature des travaux *</label><select value={form.nature} onChange={e => setForm({...form, nature: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">Choisir...</option>{NATURES.map(n => <option key={n}>{n}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Immeuble</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder="Résidence..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Localisation</label><input value={form.localisation} onChange={e => setForm({...form, localisation: e.target.value})} placeholder="Bât A, cage 2..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Prestataire</label><input value={form.prestataire} onChange={e => setForm({...form, prestataire: e.target.value})} placeholder="Nom entreprise" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Coût (€)</label><input type="number" value={form.cout} onChange={e => setForm({...form, cout: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Garantie</label><input value={form.garantie} onChange={e => setForm({...form, garantie: e.target.value})} placeholder="10 ans / jusqu'au 2036" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Classe DPE (si diagnostic)</label><select value={form.dpe} onChange={e => setForm({...form, dpe: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">Sans objet</option>{['A','B','C','D','E','F','G'].map(c => <option key={c} value={c}>Classe {c}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal État Daté */}
      {showEtatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 Nouvel État Daté</h2><p className="text-sm text-gray-500 mt-1">Art. 5 Décret 67-223 — Document de mutation de lot</p></div>
            <div className="p-6 space-y-5">
              {/* Immeuble */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">Immeuble et Mutation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="block text-sm font-semibold mb-1">Immeuble / Résidence *</label><input value={etatForm.immeuble} onChange={e => setEtatForm({...etatForm, immeuble: e.target.value})} placeholder="Résidence Les Pins" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div className="col-span-2"><label className="block text-sm font-semibold mb-1">Adresse</label><input value={etatForm.adresse} onChange={e => setEtatForm({...etatForm, adresse: e.target.value})} placeholder="12 rue de la Paix, 75001 Paris" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Date de vente prévue</label><input type="date" value={etatForm.dateVente} onChange={e => setEtatForm({...etatForm, dateVente: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Notaire</label><input value={etatForm.notaire} onChange={e => setEtatForm({...etatForm, notaire: e.target.value})} placeholder="Me Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Acquéreur</label><input value={etatForm.acquereur} onChange={e => setEtatForm({...etatForm, acquereur: e.target.value})} placeholder="Prénom NOM" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Vendeur / Cédant</label><input value={etatForm.vendeur} onChange={e => setEtatForm({...etatForm, vendeur: e.target.value})} placeholder="Prénom NOM" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                </div>
              </div>

              {/* Syndic */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">Syndic</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold mb-1">Nom du cabinet</label><input value={etatForm.syndicNom} onChange={e => setEtatForm({...etatForm, syndicNom: e.target.value})} placeholder="Cabinet XYZ Syndic" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Adresse syndic</label><input value={etatForm.syndicAdresse} onChange={e => setEtatForm({...etatForm, syndicAdresse: e.target.value})} placeholder="5 av. des Ternes, 75017 Paris" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                </div>
              </div>

              {/* Finances */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">Situation Financière</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold mb-1">Charges exercice en cours (€)</label><input type="number" value={etatForm.chargesExercice} onChange={e => setEtatForm({...etatForm, chargesExercice: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Charges restant à solder (€)</label><input type="number" value={etatForm.chargesRestant} onChange={e => setEtatForm({...etatForm, chargesRestant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Travaux votés non appelés (€)</label><input type="number" value={etatForm.travoteVotee} onChange={e => setEtatForm({...etatForm, travoteVotee: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Travaux restant lot (€)</label><input type="number" value={etatForm.travauxRestant} onChange={e => setEtatForm({...etatForm, travauxRestant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Fonds de travaux lot (€)</label><input type="number" value={etatForm.fondsTravaux} onChange={e => setEtatForm({...etatForm, fondsTravaux: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Impayés copropriété (€)</label><input type="number" value={etatForm.impayesCopro} onChange={e => setEtatForm({...etatForm, impayesCopro: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
                </div>
                <div className="mt-3"><label className="block text-sm font-semibold mb-1">Procédures en cours</label><input value={etatForm.proceduresEnCours} onChange={e => setEtatForm({...etatForm, proceduresEnCours: e.target.value})} placeholder="Aucune / Décrivez les procédures" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none" /></div>
              </div>

              {/* DPE et autres */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">Diagnostics & Informations</h3>
                <div className="space-y-3">
                  <div><label className="block text-sm font-semibold mb-1">Diagnostics & DPE collectif</label><textarea value={etatForm.diagnosticsDPE} onChange={e => setEtatForm({...etatForm, diagnosticsDPE: e.target.value})} rows={2} placeholder="DPE collectif classe C — valide jusqu'au 01/2030" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none resize-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Notes sur le règlement</label><textarea value={etatForm.reglement} onChange={e => setEtatForm({...etatForm, reglement: e.target.value})} rows={2} placeholder="Règlement de copropriété, date, modifications..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none resize-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">Notes complémentaires</label><textarea value={etatForm.notes} onChange={e => setEtatForm({...etatForm, notes: e.target.value})} rows={2} placeholder="Toute information complémentaire..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 outline-none resize-none" /></div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowEtatModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreateEtat} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Créer l'état daté</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ SINISTRES SECTION ══════════ */
function SinistresSection({ user, userRole, artisans = [] }: { user: any; userRole: string; artisans?: Artisan[] }) {
  const uid = user?.id || 'demo'

  // ── Types ──
  type SinistreStatut = 'déclaré' | 'artisan_assigné' | 'en_expertise' | 'résolution' | 'indemnisé' | 'clôturé' | 'refusé'
  type SinistreEvent = { id: string; date: string; auteur: string; type: 'statut' | 'note' | 'mission' | 'assurance'; contenu: string }
  type Sinistre = {
    id: string; titre: string; immeuble: string; lot: string; type: string
    dateDeclaration: string; declarantNom: string; declarantRole: 'coproprio' | 'locataire' | 'technicien' | 'syndic'
    assureur: string; numDossier: string; emailAssureur: string
    artisanAssigne: string; missionId: string
    montantEstime: number; montantIndemnise: number
    statut: SinistreStatut; urgence: 'haute' | 'normale'
    notes: string; events: SinistreEvent[]
  }

  const PIPELINE: { key: SinistreStatut; label: string; icon: string; color: string }[] = [
    { key: 'déclaré',        label: 'Déclaré',          icon: '🚨', color: 'bg-red-500' },
    { key: 'artisan_assigné',label: 'Artisan assigné',  icon: '🔨', color: 'bg-orange-500' },
    { key: 'en_expertise',   label: 'En expertise',     icon: '🔍', color: 'bg-blue-500' },
    { key: 'résolution',     label: 'Résolution',        icon: '🔧', color: 'bg-purple-500' },
    { key: 'indemnisé',      label: 'Indemnisé',         icon: '💰', color: 'bg-teal-500' },
    { key: 'clôturé',        label: 'Clôturé',           icon: '✅', color: 'bg-green-500' },
  ]
  const STATUS_COLORS: Record<string, string> = {
    déclaré: 'bg-red-100 text-red-700', artisan_assigné: 'bg-orange-100 text-orange-700',
    en_expertise: 'bg-blue-100 text-blue-700', résolution: 'bg-purple-100 text-purple-700',
    indemnisé: 'bg-teal-100 text-teal-700', clôturé: 'bg-green-100 text-green-700', refusé: 'bg-gray-100 text-gray-600'
  }
  const TYPES = ['Dégât des eaux', 'Incendie', 'Vol / Cambriolage', 'Vandalisme', 'Bris de glace', 'Catastrophe naturelle', 'Effondrement', 'Infiltration', 'Bris de canalisations', 'Autre']

  // Artisans réels du cabinet (passés en props)
  const artisanNoms = artisans.map(a => a.nom).filter(Boolean)

  const emptyForm = { titre: '', immeuble: '', lot: '', type: 'Dégât des eaux', dateDeclaration: new Date().toISOString().split('T')[0], declarantNom: '', declarantRole: 'coproprio' as 'coproprio' | 'locataire' | 'technicien' | 'syndic', assureur: '', numDossier: '', emailAssureur: '', artisanAssigne: '', missionId: '', montantEstime: '', montantIndemnise: '', notes: '', urgence: 'normale' as 'haute' | 'normale' }

  const [sinistres, setSinistres] = useState<Sinistre[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_sinistres_v2_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [selectedSinistre, setSelectedSinistre] = useState<Sinistre | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [noteInput, setNoteInput] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [showEmailTemplate, setShowEmailTemplate] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  const save = (u: Sinistre[]) => { setSinistres(u); localStorage.setItem(`fixit_sinistres_v2_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.titre.trim()) return
    const now = new Date().toISOString()
    const s: Sinistre = {
      id: Date.now().toString(), ...form,
      montantEstime: parseFloat(form.montantEstime) || 0,
      montantIndemnise: parseFloat(form.montantIndemnise) || 0,
      statut: 'déclaré',
      events: [{ id: '1', date: now, auteur: 'Système', type: 'statut', contenu: `Sinistre déclaré par ${form.declarantNom || 'le gestionnaire'} — ${form.type}` }]
    }
    save([s, ...sinistres])
    setShowModal(false)
    setForm(emptyForm)
  }

  const advanceStatut = (id: string, statut: SinistreStatut, extra?: Partial<Sinistre>) => {
    const now = new Date().toISOString()
    const label = PIPELINE.find(p => p.key === statut)?.label || statut
    const updated = sinistres.map(s => s.id === id ? {
      ...s, ...extra, statut,
      events: [...(s.events || []), { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'statut' as const, contenu: `Statut → ${label}` }]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
  }

  const addNote = (id: string) => {
    if (!noteInput.trim()) return
    const now = new Date().toISOString()
    const updated = sinistres.map(s => s.id === id ? {
      ...s, events: [...(s.events || []), { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'note' as const, contenu: noteInput.trim() }]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
    setNoteInput('')
  }

  const assignArtisan = (id: string, artisan: string) => {
    const now = new Date().toISOString()
    const updated = sinistres.map(s => s.id === id ? {
      ...s, artisanAssigne: artisan, statut: 'artisan_assigné' as SinistreStatut,
      events: [...(s.events || []),
        { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'mission' as const, contenu: `Artisan assigné : ${artisan}` },
        { id: (Date.now() + 1).toString(), date: now, auteur: 'Système', type: 'statut' as const, contenu: 'Statut → Artisan assigné' }
      ]
    } : s)
    save(updated)
    if (selectedSinistre?.id === id) setSelectedSinistre(updated.find(s => s.id === id) || null)
  }

  const generateEmailAssureur = (s: Sinistre) => {
    return `Objet : Déclaration de sinistre — ${s.titre} — ${s.immeuble}

Madame, Monsieur,

Nous vous contactons pour déclarer un sinistre survenu dans la copropriété que nous gérons.

📋 INFORMATIONS DU SINISTRE
• Type : ${s.type}
• Immeuble : ${s.immeuble}${s.lot ? ` — Lot/Appartement : ${s.lot}` : ''}
• Date de déclaration : ${new Date(s.dateDeclaration).toLocaleDateString('fr-FR')}
• Déclarant : ${s.declarantNom || 'Non précisé'} (${s.declarantRole})
• Description : ${s.titre}
${s.montantEstime > 0 ? `• Montant estimé des dégâts : ${s.montantEstime.toLocaleString('fr-FR')} €` : ''}
${s.artisanAssigne ? `• Artisan intervenant : ${s.artisanAssigne}` : ''}
${s.numDossier ? `• N° dossier existant : ${s.numDossier}` : ''}

Nous restons à votre disposition pour tout complément d'information.

Cordialement,
Le Gestionnaire — Cabinet de Syndic`
  }

  const filteredSinistres = filterStatut ? sinistres.filter(s => s.statut === filterStatut) : sinistres
  const actifs = sinistres.filter(s => s.statut !== 'clôturé' && s.statut !== 'refusé')
  const urgents = sinistres.filter(s => s.urgence === 'haute' && s.statut !== 'clôturé')
  const totalEstime = sinistres.reduce((t, s) => t + s.montantEstime, 0)
  const totalIndemnise = sinistres.reduce((t, s) => t + s.montantIndemnise, 0)

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-orange-400 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">🚨 Pipeline Sinistres</h1>
          <p className="text-sm text-gray-500">Déclaration → Artisan → Expertise → Indemnisation → Clôture</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 shadow-sm">
          + Nouveau sinistre
        </button>
      </div>

      <div className="p-6 lg:p-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400">
            <div className="text-sm text-gray-500">Sinistres actifs</div>
            <div className="text-3xl font-bold text-red-600">{actifs.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-amber-400">
            <div className="text-sm text-gray-500">Urgences</div>
            <div className="text-3xl font-bold text-amber-600">{urgents.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400">
            <div className="text-sm text-gray-500">Montant estimé</div>
            <div className="text-2xl font-bold text-blue-600">{totalEstime.toLocaleString('fr-FR')} €</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400">
            <div className="text-sm text-gray-500">Indemnisations</div>
            <div className="text-2xl font-bold text-green-600">{totalIndemnise.toLocaleString('fr-FR')} €</div>
          </div>
        </div>

        {/* Pipeline kanban view */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 overflow-x-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Vue pipeline</p>
          <div className="flex gap-2 min-w-max">
            {PIPELINE.map(stage => {
              const count = sinistres.filter(s => s.statut === stage.key).length
              return (
                <div
                  key={stage.key}
                  onClick={() => setFilterStatut(filterStatut === stage.key ? '' : stage.key)}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl cursor-pointer transition-all min-w-[100px] ${filterStatut === stage.key ? stage.color + ' text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}
                >
                  <span className="text-xl">{stage.icon}</span>
                  <span className="text-xs font-bold text-center leading-tight">{stage.label}</span>
                  <span className={`text-lg font-black ${filterStatut === stage.key ? 'text-white' : 'text-gray-800'}`}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Liste sinistres */}
        {filteredSinistres.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold mb-2">{filterStatut ? 'Aucun sinistre à ce stade' : 'Aucun sinistre'}</h3>
            <p className="text-gray-500 mb-6">
              {filterStatut ? 'Changez de filtre ou déclarez un nouveau sinistre.' : 'Déclarez et suivez vos sinistres de bout en bout — de la déclaration à l\'indemnisation.'}
            </p>
            <button onClick={() => setShowModal(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600">+ Déclarer un sinistre</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSinistres.map(s => {
              const pipelineIdx = PIPELINE.findIndex(p => p.key === s.statut)
              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-2xl shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-all ${s.urgence === 'haute' ? 'border-red-500' : 'border-orange-300'}`}
                  onClick={() => setSelectedSinistre(s)}
                >
                  <div className="p-4 flex flex-col md:flex-row gap-3 items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {s.urgence === 'haute' && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 URGENT</span>}
                        <h3 className="font-bold text-gray-900">{s.titre}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[s.statut] || 'bg-gray-100 text-gray-600'}`}>{s.statut.replace('_', ' ')}</span>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{s.type}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {s.immeuble && <span>🏢 {s.immeuble}{s.lot ? ` · Lot ${s.lot}` : ''}</span>}
                        <span>📅 {new Date(s.dateDeclaration).toLocaleDateString('fr-FR')}</span>
                        {s.artisanAssigne && <span>🔨 {s.artisanAssigne}</span>}
                        {s.assureur && <span>🛡️ {s.assureur}{s.numDossier ? ` · N° ${s.numDossier}` : ''}</span>}
                        {s.montantEstime > 0 && <span>💰 {s.montantEstime.toLocaleString('fr-FR')} €</span>}
                      </div>
                    </div>
                    {/* Mini-pipeline */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {PIPELINE.slice(0, 5).map((stage, i) => (
                        <div key={stage.key} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i <= pipelineIdx ? stage.color + ' text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {i < pipelineIdx ? '✓' : stage.icon}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Détails Sinistre ── */}
      {selectedSinistre && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {selectedSinistre.urgence === 'haute' && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 URGENT</span>}
                  <h2 className="text-lg font-bold text-gray-900">{selectedSinistre.titre}</h2>
                </div>
                <p className="text-sm text-gray-500">{selectedSinistre.type} · {selectedSinistre.immeuble}</p>
              </div>
              <button onClick={() => setSelectedSinistre(null)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Pipeline steps */}
              <div className="flex items-center gap-1">
                {PIPELINE.map((stage, i) => {
                  const idx = PIPELINE.findIndex(p => p.key === selectedSinistre.statut)
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <button
                        onClick={() => { if (i > idx) advanceStatut(selectedSinistre.id, stage.key) }}
                        className={`flex flex-col items-center flex-1 transition-all ${i <= idx ? 'opacity-100' : 'opacity-40 hover:opacity-70 cursor-pointer'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i < idx ? 'bg-green-500 text-white' : i === idx ? stage.color + ' text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>
                          {i < idx ? '✓' : stage.icon}
                        </div>
                        <span className="text-[9px] mt-1 text-center font-semibold text-gray-600 leading-tight">{stage.label}</span>
                      </button>
                      {i < PIPELINE.length - 1 && <div className={`h-0.5 w-2 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />}
                    </div>
                  )
                })}
              </div>

              {/* Infos */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Déclarant</p>
                  <p className="font-semibold text-gray-800">{selectedSinistre.declarantNom || '—'}</p>
                  <p className="text-xs text-gray-500 capitalize">{selectedSinistre.declarantRole}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Assureur</p>
                  <p className="font-semibold text-gray-800">{selectedSinistre.assureur || '—'}</p>
                  {selectedSinistre.numDossier && <p className="text-xs text-gray-500">N° {selectedSinistre.numDossier}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Montant estimé</p>
                  <p className="font-bold text-blue-600 text-lg">{selectedSinistre.montantEstime > 0 ? `${selectedSinistre.montantEstime.toLocaleString('fr-FR')} €` : '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Indemnisation</p>
                  <p className="font-bold text-green-600 text-lg">{selectedSinistre.montantIndemnise > 0 ? `${selectedSinistre.montantIndemnise.toLocaleString('fr-FR')} €` : '—'}</p>
                </div>
              </div>

              {/* Assigner artisan */}
              {selectedSinistre.statut === 'déclaré' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-orange-800 mb-2">🔨 Assigner un artisan</p>
                  <div className="flex gap-2">
                    <select
                      id="artisan-select"
                      className="flex-1 border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="">Choisir un artisan...</option>
                      {artisanNoms.length === 0
                        ? <option disabled>Aucun artisan dans le cabinet</option>
                        : artisanNoms.map(a => <option key={a} value={a}>{a}</option>)
                      }
                    </select>
                    <button
                      onClick={() => {
                        const sel = (document.getElementById('artisan-select') as HTMLSelectElement)?.value
                        if (sel) assignArtisan(selectedSinistre.id, sel)
                      }}
                      className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600"
                    >
                      Assigner
                    </button>
                  </div>
                </div>
              )}

              {selectedSinistre.artisanAssigne && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl">🔨</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Artisan assigné</p>
                    <p className="text-sm font-semibold text-amber-900">{selectedSinistre.artisanAssigne}</p>
                  </div>
                </div>
              )}

              {/* Email assureur */}
              <div>
                <button
                  onClick={() => setShowEmailTemplate(!showEmailTemplate)}
                  className="w-full bg-blue-50 border border-blue-200 text-blue-700 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-100 transition"
                >
                  {showEmailTemplate ? '▲ Masquer' : '📧 Générer email déclaration assureur'}
                </button>
                {showEmailTemplate && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-600">Email pré-rempli (à copier)</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generateEmailAssureur(selectedSinistre)).then(() => { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000) })
                        }}
                        className={`text-xs font-bold px-3 py-1 rounded-lg transition ${emailCopied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                      >
                        {emailCopied ? '✅ Copié' : 'Copier'}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {generateEmailAssureur(selectedSinistre)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Timeline événements */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📅 Historique</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {(selectedSinistre.events || []).map((ev, i) => (
                    <div key={ev.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${ev.type === 'statut' ? 'bg-orange-100 text-orange-600' : ev.type === 'mission' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {ev.type === 'statut' ? '→' : ev.type === 'mission' ? '🔨' : '💬'}
                        </div>
                        {i < (selectedSinistre.events?.length || 0) - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                      </div>
                      <div className="pb-2 flex-1">
                        <p className="text-gray-700 font-medium leading-snug">{ev.contenu}</p>
                        <p className="text-xs text-gray-500">{ev.auteur} · {new Date(ev.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ajouter note */}
              <div className="flex gap-2">
                <input
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote(selectedSinistre.id)}
                  placeholder="Ajouter une note..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button onClick={() => addNote(selectedSinistre.id)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600">
                  ✓
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap gap-2">
              {selectedSinistre.statut !== 'clôturé' && selectedSinistre.statut !== 'refusé' && (
                <button
                  onClick={() => advanceStatut(selectedSinistre.id, 'refusé')}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50"
                >
                  ❌ Marquer refusé
                </button>
              )}
              {selectedSinistre.statut !== 'clôturé' && (
                <button
                  onClick={() => advanceStatut(selectedSinistre.id, 'clôturé')}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600"
                >
                  ✅ Clôturer
                </button>
              )}
              <button onClick={() => setSelectedSinistre(null)} className="ml-auto px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nouveau Sinistre ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">🚨 Déclarer un sinistre</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Titre *</label><input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder="Ex: Dégât des eaux appartement 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white">{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="block text-sm font-semibold mb-1">Urgence</label><select value={form.urgence} onChange={e => setForm({...form, urgence: e.target.value as 'haute' | 'normale'})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white"><option value="normale">Normale</option><option value="haute">🔴 Haute</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Immeuble</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder="Résidence..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Lot / Appartement</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder="Apt 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Déclarant (nom)</label><input value={form.declarantNom} onChange={e => setForm({...form, declarantNom: e.target.value})} placeholder="Marie Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Rôle déclarant</label><select value={form.declarantRole} onChange={e => setForm({...form, declarantRole: e.target.value as any})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none bg-white"><option value="coproprio">Copropriétaire</option><option value="locataire">Locataire</option><option value="technicien">Technicien</option><option value="syndic">Syndic</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Assureur</label><input value={form.assureur} onChange={e => setForm({...form, assureur: e.target.value})} placeholder="AXA, Allianz..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">N° dossier existant</label><input value={form.numDossier} onChange={e => setForm({...form, numDossier: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Email assureur</label><input type="email" value={form.emailAssureur} onChange={e => setForm({...form, emailAssureur: e.target.value})} placeholder="contact@assureur.fr" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Montant estimé (€)</label><input type="number" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Date déclaration</label><input type="date" value={form.dateDeclaration} onChange={e => setForm({...form, dateDeclaration: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Notes / Description</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-orange-400 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAdd} disabled={!form.titre.trim()} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-40">🚨 Déclarer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ EXTRANET COPROPRIÉTAIRES SECTION ══════════ */
// ─── POINTAGE TERRAIN ─────────────────────────────────────────────────────────

const RAYON_DETECTION_DEFAUT = 150

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface PointageSession {
  id: string
  immeubleId: string
  immeubleNom: string
  immeubleAdresse: string
  dateDebut: string
  dateFin: string
  dureeSecondes: number
  mode: 'manuel' | 'geo'
}

interface PointageActif {
  immeubleId: string
  immeubleNom: string
  immeubleAdresse: string
  dateDebut: string
  mode: 'manuel' | 'geo'
}

function PointageSection({ immeubles, user, onUpdateImmeuble }: { immeubles: Immeuble[]; user: any; onUpdateImmeuble: (imm: Immeuble) => void }) {
  const uid = user?.id || 'demo'
  const SESSIONS_KEY = `fixit_pointage_sessions_${uid}`
  const ACTIF_KEY = `fixit_pointage_actif_${uid}`

  // Immeubles avec géoloc activée et coordonnées renseignées
  const immeublesGeoActifs = immeubles.filter(i => i.geolocActivee && i.latitude != null && i.longitude != null)

  const [sessions, setSessions] = useState<PointageSession[]>(() => {
    try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
  })
  const [sessionActive, setSessionActive] = useState<PointageActif | null>(() => {
    try { return JSON.parse(localStorage.getItem(ACTIF_KEY) || 'null') } catch { return null }
  })

  const [selectedImmId, setSelectedImmId] = useState('')
  const [pointageMode, setPointageMode] = useState<'manuel' | 'geo'>('manuel')
  const [activeTab, setActiveTab] = useState<'pointer' | 'geoloc' | 'historique'>('pointer')
  const [filtreImmeuble, setFiltreImmeuble] = useState('')
  const [filtreDate, setFiltreDate] = useState('')

  // Géolocalisation
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [geoPosition, setGeoPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState('')
  const [proches, setProches] = useState<{ immeuble: Immeuble; distance: number; rayon: number }[]>([])
  const watchRef = useRef<number | null>(null)

  // Géocodage en cours (par immeuble id)
  const [geocodingId, setGeocodingId] = useState<string | null>(null)

  // Timer live
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const saveSessions = (s: PointageSession[]) => { setSessions(s); localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)) }

  // Géocoder l'adresse d'un immeuble via API adresse.data.gouv.fr
  const geocoderImmeuble = async (imm: Immeuble) => {
    const adresse = `${imm.adresse} ${imm.codePostal} ${imm.ville}`.trim()
    if (!adresse) return
    setGeocodingId(imm.id)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`)
      const data = await res.json()
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates
        onUpdateImmeuble({ ...imm, latitude: lat, longitude: lng, geolocActivee: true, rayonDetection: imm.rayonDetection || RAYON_DETECTION_DEFAUT })
      }
    } catch { /* silent */ }
    setGeocodingId(null)
  }

  const startGeo = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non disponible.'); setGeoStatus('error'); return }
    setGeoStatus('loading')
    setGeoError('')
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoPosition({ lat, lng })
        setGeoStatus('ok')
        const p: { immeuble: Immeuble; distance: number; rayon: number }[] = []
        immeublesGeoActifs.forEach(imm => {
          const rayon = imm.rayonDetection || RAYON_DETECTION_DEFAUT
          const d = haversineMetres(lat, lng, imm.latitude!, imm.longitude!)
          if (d <= rayon) p.push({ immeuble: imm, distance: Math.round(d), rayon })
        })
        setProches(p.sort((a, b) => a.distance - b.distance))
      },
      (err) => { setGeoStatus('error'); setGeoError(err.code === 1 ? 'Permission refusée.' : 'Position introuvable.') },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  const stopGeo = () => {
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null }
    setGeoStatus('idle')
    setGeoPosition(null)
    setProches([])
  }

  const demarrerDepuis = (imm: Immeuble, mode: 'manuel' | 'geo') => {
    const actif: PointageActif = {
      immeubleId: imm.id,
      immeubleNom: imm.nom,
      immeubleAdresse: `${imm.adresse}, ${imm.codePostal} ${imm.ville}`,
      dateDebut: new Date().toISOString(),
      mode,
    }
    setSessionActive(actif)
    localStorage.setItem(ACTIF_KEY, JSON.stringify(actif))
    setSelectedImmId('')
    if (mode === 'geo') stopGeo()
  }

  const arreter = () => {
    if (!sessionActive) return
    const dateFin = new Date().toISOString()
    const dureeSecondes = Math.round((new Date(dateFin).getTime() - new Date(sessionActive.dateDebut).getTime()) / 1000)
    saveSessions([{ id: Date.now().toString(), ...sessionActive, dateFin, dureeSecondes }, ...sessions])
    setSessionActive(null)
    localStorage.removeItem(ACTIF_KEY)
    setActiveTab('historique')
  }

  const deleteSession = (id: string) => saveSessions(sessions.filter(s => s.id !== id))

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  const fmtDuree = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
    return `${s}s`
  }

  const elapsedSec = sessionActive ? Math.round((now - new Date(sessionActive.dateDebut).getTime()) / 1000) : 0
  const sessionsFiltrees = sessions.filter(s => (!filtreImmeuble || s.immeubleId === filtreImmeuble) && (!filtreDate || s.dateDebut.startsWith(filtreDate)))
  const statsByImm = useMemo(() => {
    const m: Record<string, { nom: string; passages: number; totalSecondes: number }> = {}
    sessions.forEach(s => {
      if (!m[s.immeubleId]) m[s.immeubleId] = { nom: s.immeubleNom, passages: 0, totalSecondes: 0 }
      m[s.immeubleId].passages++
      m[s.immeubleId].totalSecondes += s.dureeSecondes
    })
    return Object.values(m).sort((a, b) => b.totalSecondes - a.totalSecondes)
  }, [sessions])

  // Chrono display
  const chronoDisplay = `${String(Math.floor(elapsedSec / 3600)).padStart(2, '0')}:${String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📍 Pointage Terrain</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enregistrez vos présences et durées sur les copropriétés</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pointer')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'pointer' ? 'bg-yellow-400 text-gray-900' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            Pointer
          </button>
          <button onClick={() => setActiveTab('geoloc')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'geoloc' ? 'bg-yellow-400 text-gray-900' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            📍 Géoloc {immeublesGeoActifs.length > 0 && <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{immeublesGeoActifs.length}</span>}
          </button>
          <button onClick={() => setActiveTab('historique')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'historique' ? 'bg-yellow-400 text-gray-900' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            Historique {sessions.length > 0 && <span className="ml-1 bg-gray-200 text-gray-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{sessions.length}</span>}
          </button>
        </div>
      </div>

      {activeTab === 'pointer' && (
        <div className="space-y-5">
          {/* Carte principale */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {!sessionActive ? (
              <div className="p-6 space-y-5">
                {/* Toggle Manuel / Géo */}
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => { setPointageMode('manuel'); stopGeo() }}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${pointageMode === 'manuel' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ✋ Manuel
                  </button>
                  <button
                    onClick={() => { setPointageMode('geo'); if (geoStatus === 'idle') startGeo() }}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${pointageMode === 'geo' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    📡 Géolocalisation
                  </button>
                </div>

                {/* Mode Manuel */}
                {pointageMode === 'manuel' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Copropriété</label>
                      <select
                        value={selectedImmId}
                        onChange={e => setSelectedImmId(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 bg-gray-50"
                      >
                        <option value="">-- Sélectionner une copropriété --</option>
                        {immeubles.map(imm => (
                          <option key={imm.id} value={imm.id}>{imm.nom} — {imm.adresse}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => { const imm = immeubles.find(i => i.id === selectedImmId); if (imm) demarrerDepuis(imm, 'manuel') }}
                      disabled={!selectedImmId}
                      className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-2xl shadow-md transition"
                    >
                      <span className="text-2xl">▶</span> Démarrer le pointage
                    </button>
                  </div>
                )}

                {/* Mode Géo */}
                {pointageMode === 'geo' && (
                  <div className="space-y-3">
                    {/* Alerte si aucun immeuble géolocalisé */}
                    {immeublesGeoActifs.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                        <p className="font-semibold mb-1">📍 Aucune copropriété géolocalisée</p>
                        <p>Pour activer le pointage GPS, ouvrez la fiche d&apos;un immeuble, cliquez sur <strong>Modifier</strong>, puis activez l&apos;option <strong>Géolocalisation</strong> en renseignant les coordonnées GPS.</p>
                      </div>
                    )}

                    {/* Statut GPS */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        {geoStatus === 'loading' && <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse inline-block" />}
                        {geoStatus === 'ok' && <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />}
                        {geoStatus === 'error' && <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />}
                        {geoStatus === 'idle' && <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />}
                        <span className="text-sm text-gray-600">
                          {geoStatus === 'loading' && 'Localisation en cours…'}
                          {geoStatus === 'ok' && geoPosition && `${geoPosition.lat.toFixed(5)}, ${geoPosition.lng.toFixed(5)}`}
                          {geoStatus === 'error' && geoError}
                          {geoStatus === 'idle' && 'GPS inactif'}
                        </span>
                      </div>
                      {geoStatus !== 'idle' ? (
                        <button onClick={stopGeo} className="text-xs text-red-500 hover:text-red-700 font-medium">Arrêter GPS</button>
                      ) : (
                        <button onClick={startGeo} disabled={immeublesGeoActifs.length === 0} className="text-xs text-blue-500 hover:text-blue-700 font-medium disabled:opacity-40">Activer GPS</button>
                      )}
                    </div>

                    {/* Immeubles proches */}
                    {geoStatus === 'ok' && proches.length === 0 && (
                      <div className="text-center py-6 text-sm text-gray-500">
                        Aucune copropriété détectée à proximité.
                        <p className="text-xs mt-1 text-gray-500">{immeublesGeoActifs.length} copropriété(s) avec géoloc activée.</p>
                      </div>
                    )}
                    {proches.map(({ immeuble: imm, distance, rayon }) => (
                      <div key={imm.id} className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{imm.nom}</p>
                          <p className="text-xs text-gray-500">{imm.adresse} • <span className="text-green-600 font-medium">{distance}m</span> <span className="text-gray-500">(rayon {rayon}m)</span></p>
                        </div>
                        <button
                          onClick={() => demarrerDepuis(imm, 'geo')}
                          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm px-4 py-2 rounded-xl transition"
                        >
                          ▶ Démarrer
                        </button>
                      </div>
                    ))}

                    {/* Résumé immeubles géolocalisés */}
                    {immeublesGeoActifs.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-500 mb-2">{immeublesGeoActifs.length} copropriété(s) avec géolocalisation active :</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {immeublesGeoActifs.map(imm => (
                            <div key={imm.id} className="text-xs flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                              <span className="truncate text-gray-700 flex-1">{imm.nom}</span>
                              <span className="text-green-600 font-mono text-[10px]">{imm.latitude!.toFixed(4)}, {imm.longitude!.toFixed(4)}</span>
                              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{imm.rayonDetection || RAYON_DETECTION_DEFAUT}m</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── SESSION ACTIVE ── */
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-10 text-white text-center space-y-5">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-semibold opacity-90 uppercase tracking-wide">
                    Session en cours {sessionActive.mode === 'geo' ? '• 📡 Géoloc' : '• ✋ Manuel'}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold">{sessionActive.immeubleNom}</p>
                  <p className="text-sm opacity-75 mt-1">{sessionActive.immeubleAdresse}</p>
                  <p className="text-xs opacity-60 mt-1">Démarré le {fmtDate(sessionActive.dateDebut)}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-2xl py-6 px-10 inline-block">
                  <p className="text-6xl font-bold font-mono tabular-nums tracking-widest">{chronoDisplay}</p>
                  <p className="text-xs text-center opacity-70 mt-2 tracking-widest">HEURES : MINUTES : SECONDES</p>
                </div>
                <div>
                  <button
                    onClick={arreter}
                    className="inline-flex items-center gap-3 bg-white text-green-700 hover:bg-red-50 hover:text-red-600 border-2 border-white/50 hover:border-red-200 font-bold text-lg px-12 py-4 rounded-2xl shadow-lg transition"
                  >
                    <span className="text-2xl">⏹</span> Arrêter le pointage
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          {statsByImm.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">📊 Résumé par copropriété</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {statsByImm.map(s => (
                  <div key={s.nom} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.nom}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-yellow-500">{s.passages}</p>
                        <p className="text-xs text-gray-500">passage{s.passages > 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">⏱ {fmtDuree(s.totalSecondes)}</p>
                        <p className="text-xs text-gray-500">total</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET CONFIG GÉOLOCALISATION ── */}
      {activeTab === 'geoloc' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">📍 Géolocalisation des copropriétés</h2>
            <p className="text-sm text-gray-500 mb-4">Activez la géolocalisation par copropriété et paramétrez le rayon de détection. L'adresse est géocodée automatiquement.</p>

            <div className="space-y-3">
              {immeubles.map(imm => {
                const hasCoords = imm.latitude != null && imm.longitude != null
                const isActive = !!imm.geolocActivee
                const isGeocoding = geocodingId === imm.id
                return (
                  <div key={imm.id} className={`border rounded-xl p-4 transition ${isActive && hasCoords ? 'border-green-200 bg-green-50/50' : isActive ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{imm.nom}</p>
                        <p className="text-xs text-gray-500 truncate">{imm.adresse}, {imm.codePostal} {imm.ville}</p>
                      </div>
                      {/* Toggle activer/désactiver */}
                      <button
                        onClick={() => {
                          const updated = { ...imm, geolocActivee: !isActive }
                          // Si on active et pas de coords, géocoder automatiquement
                          if (!isActive && !hasCoords) {
                            geocoderImmeuble(updated)
                          } else {
                            onUpdateImmeuble(updated)
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {isActive && (
                      <div className="mt-3 space-y-2">
                        {/* Coordonnées GPS */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasCoords ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-mono">
                              {imm.latitude!.toFixed(5)}, {imm.longitude!.toFixed(5)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg">
                              Coordonnées manquantes
                            </span>
                          )}
                          <button
                            onClick={() => geocoderImmeuble(imm)}
                            disabled={isGeocoding}
                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-medium transition disabled:opacity-40"
                          >
                            {isGeocoding ? '⏳ Géocodage…' : hasCoords ? '🔄 Re-géocoder' : '🔍 Géocoder l\'adresse'}
                          </button>
                        </div>

                        {/* Rayon de détection */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-500">Rayon de détection</label>
                            <span className="text-xs font-bold text-purple-700">{imm.rayonDetection || RAYON_DETECTION_DEFAUT}m</span>
                          </div>
                          <input
                            type="range"
                            min={50}
                            max={500}
                            step={10}
                            value={imm.rayonDetection || RAYON_DETECTION_DEFAUT}
                            onChange={e => onUpdateImmeuble({ ...imm, rayonDetection: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                          />
                          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                            <span>50m</span>
                            <span>150m</span>
                            <span>300m</span>
                            <span>500m</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Résumé */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{immeublesGeoActifs.length} active(s)</span>
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">{immeubles.filter(i => i.geolocActivee && (i.latitude == null || i.longitude == null)).length} sans coordonnées</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{immeubles.filter(i => !i.geolocActivee).length} désactivée(s)</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historique' && (
        <div className="space-y-4">
          {/* Session active visible depuis l'historique */}
          {sessionActive && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{sessionActive.immeubleNom} — en cours</p>
                  <p className="text-xs text-gray-500">Démarré à {fmtDate(sessionActive.dateDebut)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-2xl font-bold text-green-600 font-mono tabular-nums">{chronoDisplay}</p>
                <button onClick={arreter} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm px-4 py-2 rounded-xl transition">
                  ⏹ Arrêter
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={filtreImmeuble} onChange={e => setFiltreImmeuble(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300">
                <option value="">Tous les immeubles</option>
                {immeubles.map(imm => <option key={imm.id} value={imm.id}>{imm.nom}</option>)}
              </select>
              <input type="date" value={filtreDate} onChange={e => setFiltreDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              {(filtreImmeuble || filtreDate) && (
                <button onClick={() => { setFiltreImmeuble(''); setFiltreDate('') }} className="text-sm text-gray-500 hover:text-gray-600">Effacer filtres</button>
              )}
            </div>

            {sessionsFiltrees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm text-gray-500">Aucune session enregistrée.</p>
                <p className="text-xs text-gray-500 mt-1">Démarrez votre premier pointage dans l'onglet "Pointer"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessionsFiltrees.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-600 rounded-xl p-2.5 text-xl flex-shrink-0">🏢</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900">{s.immeubleNom}</p>
                          <span className="text-xs text-gray-500">{s.mode === 'geo' ? '📡' : '✋'}</span>
                        </div>
                        <p className="text-xs text-gray-500">{s.immeubleAdresse}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-green-600 font-medium">▶ {fmtDate(s.dateDebut)}</span>
                          <span className="text-xs text-red-500 font-medium">⏹ {fmtDate(s.dateFin)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600 font-mono">{fmtDuree(s.dureeSecondes)}</p>
                        <p className="text-xs text-gray-500">durée</p>
                      </div>
                      <button onClick={() => deleteSession(s.id)} className="text-gray-300 hover:text-red-400 transition text-sm ml-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ExtranetSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'
  type Coproprietaire = { id: string; nom: string; email: string; lot: string; tantieme: number; telephone: string; solde: number; dateAdhesion: string; accesActif: boolean }

  const [copros, setCopros] = useState<Coproprietaire[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_copros_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', lot: '', tantieme: '', telephone: '', solde: '' })
  const [showInvite, setShowInvite] = useState<Coproprietaire | null>(null)
  const [copied, setCopied] = useState(false)

  const save = (u: Coproprietaire[]) => { setCopros(u); localStorage.setItem(`fixit_copros_${uid}`, JSON.stringify(u)) }
  const handleAdd = () => {
    if (!form.nom.trim()) return
    const c: Coproprietaire = { id: Date.now().toString(), nom: form.nom, email: form.email, lot: form.lot, tantieme: parseFloat(form.tantieme) || 0, telephone: form.telephone, solde: parseFloat(form.solde) || 0, dateAdhesion: new Date().toISOString().split('T')[0], accesActif: true }
    save([...copros, c])
    setShowModal(false)
    setForm({ nom: '', email: '', lot: '', tantieme: '', telephone: '', solde: '' })
  }
  const toggleAcces = (id: string) => { save(copros.map(c => c.id === id ? { ...c, accesActif: !c.accesActif } : c)) }

  const totalSolde = copros.reduce((s, c) => s + c.solde, 0)
  const enRetard = copros.filter(c => c.solde < 0).length

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-indigo-500 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">👥 Extranet Copropriétaires</h1><p className="text-sm text-gray-500">Registre · Accès portail · Suivi des soldes</p></div>
        <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700">+ Copropriétaire</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-indigo-400"><div className="text-sm text-gray-500">Copropriétaires</div><div className="text-3xl font-bold text-indigo-600">{copros.length}</div></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Accès actifs</div><div className="text-3xl font-bold text-green-600">{copros.filter(c => c.accesActif).length}</div></div>
          <div className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 ${totalSolde >= 0 ? 'border-green-400' : 'border-red-400'}`}><div className="text-sm text-gray-500">Solde global</div><div className={`text-3xl font-bold ${totalSolde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalSolde.toLocaleString('fr-FR')} €</div></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400"><div className="text-sm text-gray-500">En retard</div><div className="text-3xl font-bold text-red-600">{enRetard}</div></div>
        </div>

        {copros.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">👥</div><h3 className="text-xl font-bold mb-2">Registre vide</h3><p className="text-gray-500 mb-6">Ajoutez vos copropriétaires pour leur donner accès au portail</p><button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">+ Premier copropriétaire</button></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-5 py-3 text-left">Copropriétaire</th><th className="px-5 py-3 text-left">Lot</th><th className="px-5 py-3 text-right">Tantièmes</th><th className="px-5 py-3 text-right">Solde</th><th className="px-5 py-3 text-center">Accès</th><th className="px-5 py-3 text-center">Actions</th></tr></thead>
              <tbody>
                {copros.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-5 py-4"><div className="font-semibold">{c.nom}</div><div className="text-xs text-gray-500">{c.email}</div></td>
                    <td className="px-5 py-4 text-gray-600">{c.lot || '—'}</td>
                    <td className="px-5 py-4 text-right">{c.tantieme}</td>
                    <td className={`px-5 py-4 text-right font-bold ${c.solde < 0 ? 'text-red-600' : 'text-green-600'}`}>{c.solde.toLocaleString('fr-FR')} €</td>
                    <td className="px-5 py-4 text-center"><button onClick={() => toggleAcces(c.id)} className={`px-3 py-1 rounded-full text-xs font-bold ${c.accesActif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.accesActif ? '✅ Actif' : '⏸ Inactif'}</button></td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => setShowInvite(c)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 font-semibold">📧 Inviter</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-bold text-indigo-800 mb-2">🌐 Portail Copropriétaires</h3>
          <p className="text-sm text-indigo-700 mb-3">Chaque copropriétaire peut accéder à son espace personnel pour consulter ses charges, PV d'AG et documents.</p>
          <div className="flex gap-2">
            <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail`} className="flex-1 bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 text-sm font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/coproprietaire/portail`); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${copied ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{copied ? '✅ Copié' : '📋 Copier'}</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">👤 Nouveau copropriétaire</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Nom complet *</label><input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Jean Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jean.dupont@email.com" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Lot</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder="Apt 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Tantièmes</label><input type="number" value={form.tantieme} onChange={e => setForm({...form, tantieme: e.target.value})} placeholder="250" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Téléphone</label><input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Solde (€)</label><input type="number" value={form.solde} onChange={e => setForm({...form, solde: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none" /></div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📧 Inviter {showInvite.nom}</h2></div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Envoyez ce message à votre copropriétaire pour lui donner accès au portail :</p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm font-mono whitespace-pre-line border border-gray-200">
                {`Bonjour ${showInvite.nom},\n\nVotre syndic vous invite à accéder à votre espace copropriétaire en ligne sur Vitfix Pro.\n\nVotre lien d'accès :\n${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail\n\nLot : ${showInvite.lot || 'N/A'}\nEmail : ${showInvite.email || 'À compléter'}\n\nCordialement,\nVotre Syndic`}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`Bonjour ${showInvite!.nom},\n\nVotre syndic vous invite à accéder à votre espace copropriétaire Vitfix Pro.\n${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail\n\nLot : ${showInvite!.lot}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition ${copied ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{copied ? '✅ Copié !' : '📋 Copier le message'}</button>
            </div>
            <div className="p-6 border-t"><button onClick={() => setShowInvite(null)} className="w-full py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════════════════
// MODAL DÉTAILS MISSION — Fiche locataire + Canal + Rapport d'intervention
// ══════════════════════════════════════════════════════════════════════════
function MissionDetailsModal({
  mission, onClose, onUpdate, onValider, userRole
}: {
  mission: Mission
  onClose: () => void
  onUpdate: (m: Mission) => void
  onValider: () => void
  userRole: string
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'locataire' | 'canal' | 'rapport' | 'transfert'>('info')
  const [editing, setEditing] = useState(false)
  const [localData, setLocalData] = useState<Mission>({ ...mission })
  const [newMsg, setNewMsg] = useState('')
  const [authorName, setAuthorName] = useState(userRole === 'syndic_tech' ? 'Technicien' : 'Gestionnaire')

  const [transfertDone, setTransfertDone] = useState(!!(mission as any).transfertCompta)
  const [showTransfertModal, setShowTransfertModal] = useState(false)
  const [destinataire, setDestinataire] = useState<'comptable' | 'valideur' | 'syndic'>('comptable')
  const [noteTransfert, setNoteTransfert] = useState('')

  // Sync avec la mission externe si elle change
  useEffect(() => { setLocalData({ ...mission }); setTransfertDone(!!(mission as any).transfertCompta) }, [mission.id])

  const save = (data: Mission) => { setLocalData(data); onUpdate(data); setEditing(false) }
  const saveField = (field: keyof Mission, value: string) => {
    const updated = { ...localData, [field]: value }
    setLocalData(updated); onUpdate(updated)
  }

  const sendCanal = () => {
    if (!newMsg.trim()) return
    const msg = { auteur: authorName, role: userRole, texte: newMsg.trim(), date: new Date().toISOString() }
    const updated = { ...localData, canalMessages: [...(localData.canalMessages || []), msg] }
    setLocalData(updated); onUpdate(updated); setNewMsg('')
  }

  const destLabels: Record<string, string> = { comptable: '🧮 Comptabilité', valideur: '✅ Responsable validation', syndic: '🏛️ Syndic principal' }

  const doTransfert = () => {
    // Crée un paquet de transfert dans localStorage (section facturation / docs_interventions)
    const now = new Date()
    const transfertKey = `syndic_transferts_${userRole}`
    const existing = JSON.parse(localStorage.getItem(transfertKey) || '[]')
    const packet = {
      id: Date.now().toString(),
      missionId: localData.id,
      immeuble: localData.immeuble,
      batiment: localData.batiment,
      etage: localData.etage,
      locataire: localData.locataire,
      numLot: localData.numLot,
      artisan: localData.artisan,
      type: localData.type,
      montantDevis: localData.montantDevis,
      montantFacture: localData.montantFacture,
      travailEffectue: localData.travailEffectue,
      materiauxUtilises: localData.materiauxUtilises,
      problemesConstates: localData.problemesConstates,
      recommandations: localData.recommandations,
      dureeIntervention: localData.dureeIntervention,
      dateRapport: localData.dateRapport || now.toISOString().split('T')[0],
      destinataire,
      note: noteTransfert,
      dateTransfert: now.toISOString(),
      statut: 'en_attente_validation',
      transferePar: authorName,
    }
    existing.push(packet)
    localStorage.setItem(transfertKey, JSON.stringify(existing))

    // Marquer la mission comme transférée
    const updated = {
      ...localData,
      transfertCompta: { destinataire, date: now.toISOString(), par: authorName, note: noteTransfert }
    } as Mission & { transfertCompta: any }
    setLocalData(updated as Mission); onUpdate(updated as Mission)
    setTransfertDone(true)
    setShowTransfertModal(false)

    // Message canal auto
    const autoMsg = {
      auteur: 'Système',
      role: 'system',
      texte: `📤 Dossier transféré à ${destLabels[destinataire]} par ${authorName} le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Montant : ${localData.montantFacture ? `${localData.montantFacture.toLocaleString('fr-FR')} €` : localData.montantDevis ? `Devis ${localData.montantDevis.toLocaleString('fr-FR')} €` : 'Non renseigné'}. ${noteTransfert ? `Note : ${noteTransfert}` : ''}`,
      date: now.toISOString()
    }
    const withMsg = { ...updated, canalMessages: [...(updated.canalMessages || []), autoMsg] } as Mission
    setLocalData(withMsg); onUpdate(withMsg)
  }

  const exportRapport = () => {
    const lines = [
      `RAPPORT D'INTERVENTION — Mission #${localData.id}`,
      `Date : ${localData.dateRapport ? new Date(localData.dateRapport).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`,
      ``,
      `LOCALISATION`,
      `Immeuble : ${localData.immeuble}`,
      `Bâtiment : ${localData.batiment || '—'}`,
      `Étage : ${localData.etage || '—'}`,
      `N° Lot : ${localData.numLot || '—'}`,
      `Locataire : ${localData.locataire || '—'}`,
      `Tél. locataire : ${localData.telephoneLocataire || '—'}`,
      `Accès logement : ${localData.accesLogement || '—'}`,
      ``,
      `MISSION`,
      `Type : ${localData.type}`,
      `Artisan : ${localData.artisan}`,
      `Description : ${localData.description}`,
      `Durée intervention : ${localData.dureeIntervention || '—'}`,
      ``,
      `RAPPORT ARTISAN`,
      `Travail effectué : ${localData.travailEffectue || localData.rapportArtisan || '—'}`,
      `Matériaux utilisés : ${localData.materiauxUtilises || '—'}`,
      `Problèmes constatés : ${localData.problemesConstates || '—'}`,
      `Recommandations : ${localData.recommandations || '—'}`,
      ``,
      `FINANCIER`,
      `Montant devis : ${localData.montantDevis ? `${localData.montantDevis.toLocaleString('fr-FR')} €` : '—'}`,
      `Montant facture : ${localData.montantFacture ? `${localData.montantFacture.toLocaleString('fr-FR')} €` : '—'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rapport_Mission_${localData.id}_${localData.immeuble.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Archiver le dossier de la mission dans Documents Interventions ─────────
  const [archiveDone, setArchiveDone] = useState(!!(localData as any).archivedInDocs)

  const archiverDossier = () => {
    const now = new Date()
    const storageKey = 'vitfix_docs_interventions'
    let existingDocs: any[] = []
    try { existingDocs = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}

    const baseDoc = {
      id: `arch_${localData.id}_${Date.now()}`,
      mission_id: localData.id,
      artisan_nom: localData.artisan,
      artisan_metier: localData.type,
      immeuble: localData.immeuble,
      date_intervention: localData.dateRapport || now.toISOString().split('T')[0],
      url: '',
      envoye_compta: false,
      notes: `Archivé depuis canal mission par ${authorName}. Bât. ${localData.batiment || '—'} · Ét. ${localData.etage || '—'} · Lot ${localData.numLot || '—'} · Locataire : ${localData.locataire || '—'}`,
    }

    if (localData.montantDevis) {
      existingDocs.push({
        ...baseDoc,
        id: `arch_devis_${localData.id}_${Date.now()}`,
        type: 'devis',
        filename: `Devis_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}.txt`,
        montant: localData.montantDevis,
      })
    }
    if (localData.montantFacture) {
      existingDocs.push({
        ...baseDoc,
        id: `arch_facture_${localData.id}_${Date.now()}`,
        type: 'facture',
        filename: `Facture_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}.txt`,
        montant: localData.montantFacture,
      })
    }
    // Rapport d'intervention toujours
    existingDocs.push({
      ...baseDoc,
      type: 'rapport',
      filename: `Rapport_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.txt`,
      montant: localData.montantFacture || localData.montantDevis,
    })

    try { localStorage.setItem(storageKey, JSON.stringify(existingDocs)) } catch {}

    const updated = { ...localData, archivedInDocs: { date: now.toISOString(), par: authorName } } as Mission & { archivedInDocs: any }
    setLocalData(updated); onUpdate(updated as Mission)
    setArchiveDone(true)

    const autoMsg = {
      auteur: 'Système',
      role: 'system',
      texte: `🗂️ Dossier archivé dans "Documents Interventions" par ${authorName} le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Rapport${localData.montantDevis ? ' + devis' : ''}${localData.montantFacture ? ' + facture' : ''} + historique canal archivés.`,
      date: now.toISOString()
    }
    const withMsg = { ...updated, canalMessages: [...((updated as Mission).canalMessages || []), autoMsg] } as Mission
    setLocalData(withMsg); onUpdate(withMsg)
  }

  const tabs = [
    { id: 'info', label: '📋 Mission' },
    { id: 'locataire', label: '👤 Locataire', dot: !localData.locataire },
    { id: 'canal', label: `💬 Canal${(localData.canalMessages?.length || 0) > 0 ? ` (${localData.canalMessages!.length})` : ''}` },
    { id: 'rapport', label: '📄 Rapport', dot: !localData.travailEffectue && !localData.rapportArtisan },
    { id: 'transfert', label: transfertDone ? '📤 Transféré ✅' : '📤 Transférer' },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PrioriteBadge p={localData.priorite} />
              <Badge statut={localData.statut} />
              <span className="text-xs text-gray-500">#{localData.id}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{localData.immeuble}</h2>
            <p className="text-sm text-gray-500">{localData.type} · {localData.artisan}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`relative px-4 py-3 text-sm font-medium transition border-b-2 ${activeTab === t.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              {('dot' in t) && t.dot && <span className="absolute top-2 right-1 w-2 h-2 bg-orange-400 rounded-full"></span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── TAB TRANSFERT ── */}
          {activeTab === 'transfert' && (
            <div className="space-y-5">
              {transfertDone ? (
                <div className="bg-green-50 border border-green-300 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="font-bold text-green-800 text-lg">Dossier transféré</h3>
                  <p className="text-sm text-green-600 mt-1">Ce dossier a déjà été transmis. Retrouvez-le dans la section facturation / validation.</p>
                  <button onClick={() => setTransfertDone(false)} className="mt-4 text-xs text-green-700 underline">Renvoyer quand même</button>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-800">📤 Transfert en 1 clic</p>
                    <p className="text-xs text-amber-700 mt-1">Envoyez instantanément le dossier complet (rapport + devis + facture + infos locataire) à la comptabilité ou au valideur, sans passer par votre boîte mail.</p>
                  </div>

                  {/* Résumé du dossier */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2">📋 Contenu du dossier à transférer</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`flex items-center gap-2 ${localData.locataire ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.locataire ? '✅' : '⚠️'}</span><span>Locataire : {localData.locataire || 'Non renseigné'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.etage ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.etage ? '✅' : '⚠️'}</span><span>Étage : {localData.etage || 'Non renseigné'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.travailEffectue ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.travailEffectue ? '✅' : '⚠️'}</span><span>Rapport : {localData.travailEffectue ? 'Rempli' : 'Manquant'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.montantDevis ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.montantDevis ? '✅' : '⚠️'}</span><span>Devis : {localData.montantDevis ? `${localData.montantDevis.toLocaleString('fr-FR')} €` : 'Manquant'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.montantFacture ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.montantFacture ? '✅' : '—'}</span><span>Facture : {localData.montantFacture ? `${localData.montantFacture.toLocaleString('fr-FR')} €` : 'En attente'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.artisan ? 'text-green-700' : 'text-gray-500'}`}><span>✅</span><span>Artisan : {localData.artisan}</span></div>
                    </div>
                  </div>

                  {/* Destinataire */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Destinataire</label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {([['comptable', '🧮', 'Comptabilité', 'Validation des montants, intégration comptable'], ['valideur', '✅', 'Responsable', 'Validation du bon de travail avant paiement'], ['syndic', '🏛️', 'Syndic principal', 'Transmission au cabinet syndic pour archivage']] as const).map(([val, emoji, label, desc]) => (
                        <button
                          key={val}
                          onClick={() => setDestinataire(val)}
                          className={`p-3 rounded-xl border-2 text-left transition ${destinataire === val ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                        >
                          <div className="text-xl mb-1">{emoji}</div>
                          <div className="text-sm font-semibold text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note optionnelle */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Note (optionnelle)</label>
                    <textarea
                      className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none resize-none"
                      rows={2}
                      placeholder="Ex: Urgence à traiter, attente confirmation devis, pièce à commander…"
                      value={noteTransfert}
                      onChange={e => setNoteTransfert(e.target.value)}
                    />
                  </div>

                  {/* Bouton principal */}
                  <button
                    onClick={doTransfert}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold text-base transition shadow-lg shadow-purple-200 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">📤</span>
                    <span>Transférer à {destLabels[destinataire]}</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center">Le dossier complet sera immédiatement disponible dans la section comptabilité / validation. Un message de confirmation sera ajouté au canal.</p>
                </>
              )}
            </div>
          )}

          {/* ── TAB INFO ── */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {[
                  ['Immeuble', localData.immeuble],
                  ['Type d\'intervention', localData.type],
                  ['Artisan assigné', localData.artisan],
                  ['Date d\'intervention', localData.dateIntervention ? new Date(localData.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                  ['Devis', localData.montantDevis ? `${localData.montantDevis.toLocaleString('fr-FR')} €` : '—'],
                  ['Facturé', localData.montantFacture ? `${localData.montantFacture.toLocaleString('fr-FR')} €` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-500 shrink-0">{label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{localData.description}</p>
              </div>

              {/* ── Lien de suivi GPS ── */}
              {localData.trackingToken && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-sm font-bold text-blue-800">Suivi GPS actif</p>
                  </div>
                  <p className="text-xs text-blue-600 mb-2">L'artisan partage sa position en direct. Partagez ce lien au copropriétaire :</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/tracking/${localData.trackingToken}` : `/tracking/${localData.trackingToken}`}
                    </code>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/tracking/${localData.trackingToken}`
                        navigator.clipboard.writeText(url).catch(() => {})
                      }}
                      className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                    >
                      Copier
                    </button>
                  </div>
                  <a
                    href={`/tracking/${localData.trackingToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                  >
                    📍 Voir le suivi en direct →
                  </a>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                Mission #{localData.id} · Créée le {new Date(localData.dateCreation).toLocaleDateString('fr-FR')}
              </div>
            </div>
          )}

          {/* ── TAB LOCATAIRE ── */}
          {activeTab === 'locataire' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">📍 Fiche locataire / localisation</p>
                <p className="text-xs text-blue-600">Ces informations sont enregistrées dans l'ordre de mission et le rapport.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Bâtiment</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="Ex: Bâtiment A, Résidence B…"
                    value={localData.batiment || ''}
                    onChange={e => setLocalData(d => ({...d, batiment: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Étage</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="Ex: 3ème, RDC, 5ème…"
                    value={localData.etage || ''}
                    onChange={e => setLocalData(d => ({...d, etage: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">N° de lot / appartement</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="Ex: Apt 12, Lot 45…"
                    value={localData.numLot || ''}
                    onChange={e => setLocalData(d => ({...d, numLot: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom du locataire</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="Nom Prénom du locataire"
                    value={localData.locataire || ''}
                    onChange={e => setLocalData(d => ({...d, locataire: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Téléphone locataire</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="06 XX XX XX XX"
                    value={localData.telephoneLocataire || ''}
                    onChange={e => setLocalData(d => ({...d, telephoneLocataire: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Accès logement</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none"
                    placeholder="Code digicode, clé gardien…"
                    value={localData.accesLogement || ''}
                    onChange={e => setLocalData(d => ({...d, accesLogement: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
              </div>

              <button
                onClick={() => onUpdate(localData)}
                className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition"
              >
                ✅ Enregistrer la fiche locataire
              </button>

              {(localData.locataire || localData.etage || localData.batiment) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">✅ Fiche enregistrée</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                    {localData.batiment && <span>🏢 Bât. {localData.batiment}</span>}
                    {localData.etage && <span>🏗️ Étage : {localData.etage}</span>}
                    {localData.numLot && <span>🔢 Lot : {localData.numLot}</span>}
                    {localData.locataire && <span>👤 {localData.locataire}</span>}
                    {localData.telephoneLocataire && <span>📞 {localData.telephoneLocataire}</span>}
                    {localData.accesLogement && <span>🔐 {localData.accesLogement}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB CANAL ── */}
          {activeTab === 'canal' && (
            <div className="flex flex-col h-full" style={{ minHeight: '300px' }}>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600">Votre nom dans le canal</label>
                <input className="mt-1 w-48 border rounded-lg px-3 py-1.5 text-sm" value={authorName} onChange={e => setAuthorName(e.target.value)} />
              </div>
              <div className="flex-1 space-y-3 mb-4 max-h-64 overflow-y-auto">
                {(!localData.canalMessages || localData.canalMessages.length === 0) ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-sm">Aucun message — Ouvrez le dialogue avec l'artisan</p>
                  </div>
                ) : localData.canalMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === userRole ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${msg.role === 'artisan' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                      {msg.auteur.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-xs ${msg.role === userRole ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.role === userRole ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
                        {msg.texte}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 px-1">{msg.auteur} · {new Date(msg.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Quick actions */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {['📍 En route', '✅ Arrivé sur place', '🔍 Diagnostic en cours', '⚠️ Problème constaté', '✅ Intervention terminée', '📦 Commande pièce nécessaire'].map(txt => (
                  <button key={txt} onClick={() => { setNewMsg(txt) }} className="text-xs bg-gray-100 hover:bg-purple-50 hover:text-purple-700 px-3 py-1.5 rounded-full transition">{txt}</button>
                ))}
              </div>

              {/* ── Bouton Archiver dans Documents Interventions ── */}
              <div className={`rounded-xl border-2 p-3 mb-3 ${archiveDone ? 'border-green-200 bg-green-50' : 'border-dashed border-indigo-200 bg-indigo-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {archiveDone ? '🗂️ Dossier archivé' : '🗂️ Archiver dans Documents Interventions'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      {archiveDone
                        ? 'Rapport, devis et facture archivés — disponibles dans Documents'
                        : 'Enregistre rapport + devis/facture + historique dans "Documents Interventions"'}
                    </p>
                    {archiveDone && (localData as any).archivedInDocs && (
                      <p className="text-xs text-green-600 mt-1">
                        Archivé le {new Date((localData as any).archivedInDocs.date).toLocaleDateString('fr-FR')} par {(localData as any).archivedInDocs.par}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={archiverDossier}
                    disabled={archiveDone}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                      archiveDone
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    }`}
                  >
                    {archiveDone ? '✅ Archivé' : '📥 Archiver'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm focus:border-purple-400 outline-none"
                  placeholder="Message à l'artisan…"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendCanal())}
                />
                <button onClick={sendCanal} disabled={!newMsg.trim()} className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition disabled:opacity-60">Envoyer</button>
              </div>
            </div>
          )}

          {/* ── TAB RAPPORT ── */}
          {activeTab === 'rapport' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Date du rapport</label>
                  <input type="date" className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none" value={localData.dateRapport || new Date().toISOString().split('T')[0]} onChange={e => setLocalData(d => ({...d, dateRapport: e.target.value}))} onBlur={() => onUpdate(localData)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Durée intervention</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none" placeholder="Ex: 2h30" value={localData.dureeIntervention || ''} onChange={e => setLocalData(d => ({...d, dureeIntervention: e.target.value}))} onBlur={() => onUpdate(localData)} />
                </div>
              </div>
              {[
                ['Travail effectué *', 'travailEffectue', 'Décrivez les travaux réalisés…', 3],
                ['Matériaux utilisés', 'materiauxUtilises', 'Ex: 1 joint torique, 2m tuyau PER…', 2],
                ['Problèmes constatés', 'problemesConstates', 'Anomalies, vétusté, défauts constatés…', 2],
                ['Recommandations', 'recommandations', 'Travaux complémentaires à prévoir…', 2],
              ].map(([label, field, placeholder, rows]) => (
                <div key={String(field)}>
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 outline-none resize-none"
                    rows={rows as number}
                    placeholder={placeholder as string}
                    value={(localData as Record<string, any>)[field as string] || ''}
                    onChange={e => setLocalData(d => ({...d, [field as string]: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => onUpdate(localData)} className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition">
                  ✅ Enregistrer le rapport
                </button>
                <button onClick={exportRapport} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition">
                  ⬇️ Télécharger rapport
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition font-medium">
            Fermer
          </button>
          {mission.statut === 'en_attente' && (
            <button onClick={onValider} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
              ✅ Valider la mission
            </button>
          )}
          {mission.statut !== 'terminee' && mission.statut !== 'annulee' && (
            <button
              onClick={() => { const u = { ...localData, statut: 'terminee' as const }; onUpdate(u) }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
            >
              🏁 Marquer terminée
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FACTURATION PAGE — avec dossiers transférés par le gestionnaire technique
// ══════════════════════════════════════════════════════════════════════════
function FacturationPageWithTransferts({ missions, user, userRole, onOpenMission }: {
  missions: Mission[]
  user: any
  userRole: string
  onOpenMission: (m: Mission) => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'factures' | 'transferts'>('factures')
  const [filterStatut, setFilterStatut] = useState<string>('')

  // Charger tous les dossiers transférés (depuis tous les rôles tech/gestionnaire)
  const allTransferts = useMemo(() => {
    const keys = ['syndic_tech', 'syndic_gestionnaire', 'syndic', 'syndic_admin']
    const all: any[] = []
    keys.forEach(k => {
      try {
        const items = JSON.parse(localStorage.getItem(`syndic_transferts_${k}`) || '[]')
        all.push(...items)
      } catch {}
    })
    return all.sort((a, b) => new Date(b.dateTransfert).getTime() - new Date(a.dateTransfert).getTime())
  }, [])

  const [transferts, setTransferts] = useState(allTransferts)

  const validerTransfert = (id: string) => {
    const updated = transferts.map(t => t.id === id ? { ...t, statut: 'validé' } : t)
    setTransferts(updated)
    // Re-save toutes les clés
    const byRole: Record<string, any[]> = {}
    updated.forEach(t => {
      const k = `syndic_transferts_${t.transferePar?.includes('Tech') ? 'syndic_tech' : 'syndic_gestionnaire'}`
      if (!byRole[k]) byRole[k] = []
      byRole[k].push(t)
    })
    Object.entries(byRole).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
  }

  const refuserTransfert = (id: string, raison: string) => {
    const updated = transferts.map(t => t.id === id ? { ...t, statut: 'refusé', raisonRefus: raison } : t)
    setTransferts(updated)
  }

  const destColors: Record<string, string> = {
    comptable: 'bg-blue-100 text-blue-700',
    valideur: 'bg-purple-100 text-purple-700',
    syndic: 'bg-green-100 text-green-700',
  }
  const destLabels: Record<string, string> = {
    comptable: '🧮 Comptabilité',
    valideur: '✅ Valideur',
    syndic: '🏛️ Syndic',
  }
  const statutColors: Record<string, string> = {
    en_attente_validation: 'bg-orange-100 text-orange-700',
    validé: 'bg-green-100 text-green-700',
    refusé: 'bg-red-100 text-red-700',
  }

  const filtered = filterStatut ? transferts.filter(t => t.statut === filterStatut) : transferts

  const totalDevis = missions.filter(m => m.montantDevis).reduce((s, m) => s + (m.montantDevis || 0), 0)
  const totalFacture = missions.filter(m => m.montantFacture).reduce((s, m) => s + (m.montantFacture || 0), 0)
  const enAttente = transferts.filter(t => t.statut === 'en_attente_validation').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard emoji="💶" label="Facturé (missions)" value={`${totalFacture.toLocaleString('fr-FR')} €`} sub={`${missions.filter(m => m.montantFacture).length} factures`} color="green" />
        <StatCard emoji="📋" label="Devis en cours" value={`${totalDevis.toLocaleString('fr-FR')} €`} sub={`${missions.filter(m => m.montantDevis && !m.montantFacture).length} devis`} color="blue" />
        <StatCard emoji="📤" label="Dossiers transférés" value={String(transferts.length)} sub={`${enAttente} en attente`} color="purple" />
        <StatCard emoji="✅" label="Validés comptabilité" value={String(transferts.filter(t => t.statut === 'validé').length)} color="green" />
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveSubTab('factures')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'factures' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>📄 Factures & Devis</button>
        <button onClick={() => setActiveSubTab('transferts')} className={`relative px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'transferts' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          📤 Dossiers transférés
          {enAttente > 0 && <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{enAttente}</span>}
        </button>
      </div>

      {/* FACTURES */}
      {activeSubTab === 'factures' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Factures & devis des missions</h3>
          <div className="space-y-2">
            {missions.filter(m => m.montantFacture || m.montantDevis).length === 0 ? (
              <div className="text-center py-8 text-gray-500">Aucune facture ni devis sur les missions</div>
            ) : missions.filter(m => m.montantFacture || m.montantDevis).map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition cursor-pointer" onClick={() => onOpenMission(m)}>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{m.immeuble} — {m.type}</p>
                  <p className="text-xs text-gray-500">{m.artisan} · {m.locataire ? `👤 ${m.locataire}` : ''} {m.etage ? `· Ét. ${m.etage}` : ''}</p>
                  <p className="text-xs text-gray-500">{m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR') : m.dateCreation}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-gray-900">{(m.montantFacture || m.montantDevis)?.toLocaleString('fr-FR')} €</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.montantFacture ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.montantFacture ? 'Facturé' : 'Devis'}</span>
                  {(m as any).transfertCompta && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">📤 Transféré</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSFERTS */}
      {activeSubTab === 'transferts' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Filtrer :</span>
            {[['', 'Tous'], ['en_attente_validation', '⏳ En attente'], ['validé', '✅ Validés'], ['refusé', '❌ Refusés']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatut(val)} className={`px-3 py-1 rounded-full text-sm font-medium ${filterStatut === val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
              <div className="text-4xl mb-2">📤</div>
              <p>Aucun dossier transféré pour l'instant</p>
              <p className="text-sm mt-1">Les gestionnaires techniques peuvent transférer des dossiers depuis les ordres de mission</p>
            </div>
          ) : filtered.map((t: any) => (
            <div key={t.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${t.statut === 'en_attente_validation' ? 'border-orange-400' : t.statut === 'validé' ? 'border-green-400' : 'border-red-400'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutColors[t.statut] || 'bg-gray-100 text-gray-700'}`}>{t.statut.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${destColors[t.destinataire] || 'bg-gray-100 text-gray-700'}`}>{destLabels[t.destinataire] || t.destinataire}</span>
                    <span className="text-xs text-gray-500">Mission #{t.missionId}</span>
                  </div>
                  <h3 className="font-bold text-gray-900">{t.immeuble} — {t.type}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                    {t.artisan && <span>🔧 {t.artisan}</span>}
                    {t.locataire && <span>👤 {t.locataire}</span>}
                    {t.batiment && <span>🏢 Bât. {t.batiment}</span>}
                    {t.etage && <span>🏗️ Ét. {t.etage}</span>}
                    {t.numLot && <span>🔢 Lot {t.numLot}</span>}
                  </div>
                  {t.travailEffectue && <p className="text-xs text-gray-500 mt-1 italic">"{t.travailEffectue.slice(0, 80)}{t.travailEffectue.length > 80 ? '…' : ''}"</p>}
                  {t.note && <p className="text-xs bg-yellow-50 text-yellow-700 rounded px-2 py-1 mt-1">📝 Note : {t.note}</p>}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  {t.montantFacture && <p className="font-bold text-lg text-gray-900">{t.montantFacture.toLocaleString('fr-FR')} €</p>}
                  {t.montantDevis && !t.montantFacture && <p className="font-bold text-lg text-amber-700">Devis {t.montantDevis.toLocaleString('fr-FR')} €</p>}
                  <p className="text-xs text-gray-500 mt-1">{new Date(t.dateTransfert).toLocaleDateString('fr-FR')} {new Date(t.dateTransfert).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-gray-500">Par : {t.transferePar}</p>
                </div>
              </div>

              {t.statut === 'en_attente_validation' && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => validerTransfert(t.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-semibold transition"
                  >
                    ✅ Valider & intégrer en comptabilité
                  </button>
                  <button
                    onClick={() => {
                      const raison = window.prompt('Raison du refus ?') || 'Informations manquantes'
                      refuserTransfert(t.id, raison)
                    }}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition"
                  >
                    ❌ Refuser
                  </button>
                </div>
              )}

              {t.statut === 'validé' && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-sm text-green-600 font-medium">✅ Validé et intégré en comptabilité</span>
                </div>
              )}

              {t.statut === 'refusé' && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-sm text-red-600">❌ Refusé : {t.raisonRefus}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE CANAL COMMUNICATIONS — Vue dédiée messagerie syndic ↔ artisans + demandeurs
// ══════════════════════════════════════════════════════════════════════════
function CanalCommunicationsPage({
  missions,
  artisans,
  userRole,
  user,
  onUpdateMission,
  onAddMission,
  onOpenMission,
  onCreateMission,
}: {
  missions: Mission[]
  artisans: Artisan[]
  userRole: string
  user: any
  onUpdateMission: (m: Mission) => void
  onAddMission: (m: Mission) => void
  onOpenMission: (m: Mission) => void
  onCreateMission: () => void
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  // Vue liste gauche : 'artisans' = ordres de mission | 'demandeurs' = coproprio/locataire/technicien
  const [listeVue, setListeVue] = useState<'artisans' | 'demandeurs'>('artisans')
  // 'artisan' = canal avec l'artisan | 'demandeur' = canal avec le copropriétaire/technicien
  const [canalTab, setCanalTab] = useState<'artisan' | 'demandeur'>('artisan')
  const [newMsg, setNewMsg] = useState('')
  const [newMsgDemandeur, setNewMsgDemandeur] = useState('')
  const [authorName, setAuthorName] = useState(
    userRole === 'syndic_tech' ? 'Technicien' : userRole === 'syndic_gestionnaire' ? 'Gestionnaire' : 'Gestionnaire'
  )
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  // ── Modal transfert artisan ──
  const [showTransfert, setShowTransfert] = useState(false)
  const [transfertArtisanId, setTransfertArtisanId] = useState('')
  const [transfertDate, setTransfertDate] = useState('')
  const [transfertDescription, setTransfertDescription] = useState('')
  const [transfertPriorite, setTransfertPriorite] = useState<'urgente' | 'normale' | 'planifiee'>('normale')
  const [transfertLoading, setTransfertLoading] = useState(false)
  const [transfertSuccess, setTransfertSuccess] = useState('')

  const openTransfert = (m: Mission) => {
    setTransfertArtisanId('')
    setTransfertDate(new Date().toISOString().split('T')[0])
    setTransfertDescription(m.description || '')
    setTransfertPriorite(m.priorite || 'normale')
    setTransfertSuccess('')
    setShowTransfert(true)
  }

  const handleTransfert = async () => {
    if (!selectedMission || !transfertArtisanId) return
    const artisan = artisans.find(a => a.id === transfertArtisanId)
    if (!artisan) return
    setTransfertLoading(true)

    // Créer le nouvel ordre de mission
    const nouvelleM: Mission = {
      id: Date.now().toString(),
      immeuble: selectedMission.immeuble || '',
      artisan: artisan.nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim(),
      type: selectedMission.type || artisan.metier || 'Intervention',
      description: transfertDescription,
      priorite: transfertPriorite,
      statut: 'en_attente',
      dateCreation: new Date().toISOString().split('T')[0],
      dateIntervention: transfertDate || undefined,
      batiment: selectedMission.batiment,
      etage: selectedMission.etage,
      numLot: selectedMission.numLot,
      locataire: selectedMission.demandeurNom || selectedMission.locataire,
      telephoneLocataire: selectedMission.telephoneLocataire,
      accesLogement: selectedMission.accesLogement,
      estPartieCommune: selectedMission.estPartieCommune,
      zoneSignalee: selectedMission.zoneSignalee,
      demandeurNom: selectedMission.demandeurNom,
      demandeurRole: selectedMission.demandeurRole,
      demandeurEmail: selectedMission.demandeurEmail,
      canalMessages: [{
        auteur: 'Système',
        role: 'system',
        texte: `📋 Ordre de mission créé depuis le signalement de ${selectedMission.demandeurNom || 'un résident'}.\n📍 ${selectedMission.immeuble}${selectedMission.estPartieCommune ? ` · ${selectedMission.zoneSignalee}` : selectedMission.etage ? ` · Ét. ${selectedMission.etage}` : ''}\n📝 ${transfertDescription}`,
        date: new Date().toISOString(),
      }],
    }

    // Appel API si l'artisan a un compte
    if (artisan.artisan_user_id || artisan.email) {
      try {
        await fetch('/api/syndic/assign-mission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artisan_email: artisan.email,
            description: transfertDescription,
            date_intervention: transfertDate,
            immeuble: selectedMission.immeuble,
            priorite: transfertPriorite,
            notes: `Signalement de ${selectedMission.demandeurNom || 'résident'} — ${selectedMission.estPartieCommune ? selectedMission.zoneSignalee : `Lot ${selectedMission.numLot || 'N/A'}`}`,
          }),
        })
      } catch { /* continue même si l'API échoue */ }
    }

    // Ajouter la mission
    onAddMission(nouvelleM)

    // Ajouter message système dans le canal demandeur
    const artisanNom = artisan.nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim()
    const sysMsg = {
      auteur: 'Gestionnaire',
      role: 'system',
      texte: `✅ Votre demande a été transférée à ${artisanNom} (${artisan.metier}).\n📅 Intervention prévue : ${transfertDate ? new Date(transfertDate).toLocaleDateString('fr-FR') : 'À confirmer'}\nUn ordre de mission a été créé.`,
      date: new Date().toISOString(),
    }
    onUpdateMission({
      ...selectedMission,
      artisan: artisanNom,
      statut: 'acceptee',
      demandeurMessages: [...(selectedMission.demandeurMessages || []), sysMsg],
    })

    setTransfertLoading(false)
    setTransfertSuccess(`Ordre de mission créé et assigné à ${artisanNom} !`)
    setTimeout(() => { setShowTransfert(false); setTransfertSuccess('') }, 2000)
  }

  // ─── Missions filtrées selon la vue active ───
  const missionsAvecCanal = missions.filter(m => {
    const matchSearch = !search ||
      m.artisan.toLowerCase().includes(search.toLowerCase()) ||
      m.immeuble.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      (m.locataire || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.demandeurNom || '').toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'all' || m.statut === filterStatut
    return matchSearch && matchStatut
  })

  // Missions avec artisan assigné (canal ordres de mission)
  const missionsArtisan = missionsAvecCanal.filter(m => m.artisan && m.artisan.trim() !== '')
  // Missions avec demandeur identifié (copropriétaire / locataire / technicien)
  const missionsDemandeur = missionsAvecCanal.filter(m => (m.demandeurNom || m.locataire) && m.demandeurNom !== undefined || (m.demandeurMessages && m.demandeurMessages.length > 0))

  // Compteurs non-lus
  const nbArtisanMsgs = missions.reduce((s, m) => s + (m.canalMessages?.length || 0), 0)
  const nbDemandeurMsgs = missions.reduce((s, m) => s + (m.demandeurMessages?.length || 0), 0)

  const selectedMission = missions.find(m => m.id === selectedMissionId) || null

  // ─── Envoi messages canal artisan ───
  const sendMsg = () => {
    if (!newMsg.trim() || !selectedMission) return
    const msg = { auteur: authorName, role: userRole, texte: newMsg.trim(), date: new Date().toISOString() }
    const updated = { ...selectedMission, canalMessages: [...(selectedMission.canalMessages || []), msg] }
    onUpdateMission(updated)
    setNewMsg('')
  }

  // ─── Envoi messages canal demandeur ───
  const sendMsgDemandeur = () => {
    if (!newMsgDemandeur.trim() || !selectedMission) return
    const msg = { auteur: authorName, role: userRole, texte: newMsgDemandeur.trim(), date: new Date().toISOString() }
    const updated = {
      ...selectedMission,
      demandeurMessages: [...(selectedMission.demandeurMessages || []), msg],
    }
    onUpdateMission(updated)
    // Aussi mettre à jour le localStorage canal_demandeur_* pour que le portail le voie
    if (selectedMission.demandeurNom || selectedMission.locataire) {
      const rawKey = (selectedMission.demandeurNom || selectedMission.locataire || '').replace(/\s+/g, '_').toLowerCase()
      const demandeurKey = `canal_demandeur_${rawKey}`
      try {
        const existing = JSON.parse(localStorage.getItem(demandeurKey) || '[]')
        existing.push({ ...msg, type: 'gestionnaire_reply' })
        localStorage.setItem(demandeurKey, JSON.stringify(existing))
      } catch { /* ignore */ }
    }
    setNewMsgDemandeur('')
  }

  const statuts: Record<string, { label: string; color: string }> = {
    en_attente: { label: 'En attente', color: 'bg-orange-100 text-orange-700' },
    acceptee:   { label: 'Acceptée',   color: 'bg-blue-100 text-blue-700' },
    en_cours:   { label: 'En cours',   color: 'bg-purple-100 text-purple-700' },
    terminee:   { label: 'Terminée',   color: 'bg-green-100 text-green-700' },
    annulee:    { label: 'Annulée',    color: 'bg-gray-100 text-gray-500' },
  }

  const totalMsgs = nbArtisanMsgs + nbDemandeurMsgs

  // Label rôle demandeur
  const demandeurRoleLabel = selectedMission?.demandeurRole === 'coproprio' ? 'Copropriétaire'
    : selectedMission?.demandeurRole === 'locataire' ? 'Locataire'
    : selectedMission?.demandeurRole === 'technicien' ? 'Technicien bâtiment'
    : selectedMission?.locataire ? 'Locataire / Résident'
    : 'Demandeur'

  const demandeurBadgeColor = selectedMission?.demandeurRole === 'coproprio' ? 'bg-blue-100 text-blue-700'
    : selectedMission?.demandeurRole === 'locataire' ? 'bg-green-100 text-green-700'
    : selectedMission?.demandeurRole === 'technicien' ? 'bg-orange-100 text-orange-700'
    : 'bg-blue-100 text-blue-600'

  // Icône rôle demandeur
  const demandeurIcon = selectedMission?.demandeurRole === 'coproprio' ? '🏠'
    : selectedMission?.demandeurRole === 'locataire' ? '🔑'
    : selectedMission?.demandeurRole === 'technicien' ? '🔧'
    : '👤'

  // Liste active selon la vue
  const listeActive = listeVue === 'artisans' ? missionsArtisan : missionsDemandeur

  return (
    <div className="flex gap-0 h-[calc(100vh-180px)] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ─── Panneau gauche — liste des conversations ─── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">

        {/* ── Switcher Artisans / Demandeurs ── */}
        <div className="p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            {/* ARTISANS */}
            <button
              onClick={() => { setListeVue('artisans'); setSelectedMissionId(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${listeVue === 'artisans' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <span>🔨</span>
              <span>Artisans</span>
              {nbArtisanMsgs > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${listeVue === 'artisans' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'}`}>
                  {nbArtisanMsgs}
                </span>
              )}
            </button>
            {/* DEMANDEURS */}
            <button
              onClick={() => { setListeVue('demandeurs'); setSelectedMissionId(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition border-l border-gray-200 ${listeVue === 'demandeurs' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <span>👤</span>
              <span>Résidents</span>
              {nbDemandeurMsgs > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${listeVue === 'demandeurs' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'}`}>
                  {nbDemandeurMsgs}
                </span>
              )}
            </button>
          </div>
          {/* Sous-titre */}
          <p className="text-xs text-gray-500 text-center mt-1.5">
            {listeVue === 'artisans'
              ? `${missionsArtisan.length} ordre${missionsArtisan.length > 1 ? 's' : ''} de mission`
              : `${missionsDemandeur.length} demande${missionsDemandeur.length > 1 ? 's' : ''} de résidents`}
          </p>
        </div>

        {/* ── Recherche + filtres ── */}
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={listeVue === 'artisans' ? 'Rechercher artisan, résidence…' : 'Rechercher résident, immeuble…'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {[['all', 'Toutes'], ['en_attente', '⏳'], ['en_cours', '🔵'], ['terminee', '✅']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilterStatut(val)}
                className={`text-xs px-2 py-1 rounded-lg border transition ${filterStatut === val
                  ? listeVue === 'artisans' ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {lbl}
              </button>
            ))}
            <button
              onClick={onCreateMission}
              className="ml-auto text-xs px-2 py-1 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 font-semibold transition"
            >
              + Mission
            </button>
          </div>
        </div>

        {/* ── Liste ── */}
        <div className="flex-1 overflow-y-auto">

          {/* VUE ARTISANS */}
          {listeVue === 'artisans' && (
            <>
              {missionsArtisan.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-3xl mb-2">🔨</div>
                  <p className="text-xs text-gray-500">Aucun ordre de mission</p>
                  <button onClick={onCreateMission} className="mt-3 text-xs text-amber-600 hover:underline font-medium">
                    + Créer un ordre de mission
                  </button>
                </div>
              ) : missionsArtisan.map(m => {
                const lastMsg = m.canalMessages && m.canalMessages.length > 0 ? m.canalMessages[m.canalMessages.length - 1] : null
                const msgCount = m.canalMessages?.length || 0
                const isSelected = m.id === selectedMissionId

                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMissionId(m.id); setCanalTab('artisan') }}
                    className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition hover:bg-amber-50/50 ${isSelected ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Avatar artisan */}
                          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0 border-2 border-amber-200">
                            {(m.artisan || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{m.artisan}</p>
                            <p className="text-xs text-gray-500 truncate">{m.type}</p>
                          </div>
                        </div>
                        {/* Résidence */}
                        <p className="text-xs text-gray-500 mt-1 ml-11 truncate">
                          🏢 {m.immeuble}
                          {m.batiment && ` · Bât. ${m.batiment}`}
                          {m.etage && ` · Ét. ${m.etage}`}
                        </p>
                        {/* Dernier message */}
                        {lastMsg ? (
                          <p className="text-xs text-gray-500 mt-0.5 ml-11 truncate italic">
                            {lastMsg.role === 'artisan' ? '← ' : '→ '}{lastMsg.texte.substring(0, 45)}{lastMsg.texte.length > 45 ? '…' : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-400 mt-0.5 ml-11 italic">Ordre envoyé — en attente</p>
                        )}
                        {/* Demandeur lié */}
                        {(m.demandeurNom || m.locataire) && (
                          <p className="text-xs text-blue-400 mt-0.5 ml-11 truncate">
                            👤 {m.demandeurNom || m.locataire}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statuts[m.statut]?.color || 'bg-gray-100 text-gray-600'}`}>
                          {statuts[m.statut]?.label}
                        </span>
                        {msgCount > 0 && (
                          <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[1.2rem] text-center">
                            {msgCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {/* VUE RÉSIDENTS (demandeurs) */}
          {listeVue === 'demandeurs' && (
            <>
              {missionsDemandeur.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-3xl mb-2">👤</div>
                  <p className="text-xs text-gray-500">Aucune demande de résident</p>
                  <p className="text-xs text-gray-500 mt-1">Les demandes arrivent depuis le portail copropriétaire</p>
                </div>
              ) : missionsDemandeur.map(m => {
                const lastMsg = m.demandeurMessages && m.demandeurMessages.length > 0 ? m.demandeurMessages[m.demandeurMessages.length - 1] : null
                const msgCount = m.demandeurMessages?.length || 0
                const isSelected = m.id === selectedMissionId
                const roleIcon = m.demandeurRole === 'coproprio' ? '🏠' : m.demandeurRole === 'locataire' ? '🔑' : m.demandeurRole === 'technicien' ? '🔧' : '👤'
                const roleBadge = m.demandeurRole === 'coproprio' ? 'bg-blue-100 text-blue-700' : m.demandeurRole === 'locataire' ? 'bg-green-100 text-green-700' : m.demandeurRole === 'technicien' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                const roleShort = m.demandeurRole === 'coproprio' ? 'Copro' : m.demandeurRole === 'locataire' ? 'Locataire' : m.demandeurRole === 'technicien' ? 'Technicien' : 'Résident'

                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMissionId(m.id); setCanalTab('demandeur') }}
                    className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Avatar demandeur */}
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0 border-2 border-blue-200">
                            {roleIcon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900 truncate">{m.demandeurNom || m.locataire || 'Résident'}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge}`}>{roleShort}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{m.type || 'Signalement'}</p>
                          </div>
                        </div>
                        {/* Localisation */}
                        <p className="text-xs text-gray-500 mt-1 ml-11 truncate">
                          {m.estPartieCommune
                            ? `🔶 ${m.zoneSignalee || 'Partie commune'} · ${m.immeuble}`
                            : `🏢 ${m.immeuble}${m.batiment ? ` · Bât. ${m.batiment}` : ''}${m.etage ? ` · Ét. ${m.etage}` : ''}${m.numLot ? ` · Lot ${m.numLot}` : ''}`}
                        </p>
                        {/* Dernier message */}
                        {lastMsg ? (
                          <p className="text-xs text-blue-500 mt-0.5 ml-11 truncate italic">
                            {lastMsg.role === userRole ? '→ ' : '← '}{lastMsg.texte.substring(0, 45)}{lastMsg.texte.length > 45 ? '…' : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-blue-300 mt-0.5 ml-11 italic">Nouvelle demande</p>
                        )}
                        {/* Artisan assigné si présent */}
                        {m.artisan && (
                          <p className="text-xs text-amber-500 mt-0.5 ml-11 truncate">🔨 {m.artisan}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statuts[m.statut]?.color || 'bg-gray-100 text-gray-600'}`}>
                          {statuts[m.statut]?.label}
                        </span>
                        {m.priorite === 'urgente' && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">🔴</span>}
                        {msgCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[1.2rem] text-center">
                            {msgCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ─── Panneau droit — conversation ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedMission ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-bold text-gray-700">Sélectionnez une mission</h3>
              <p className="text-sm text-gray-500 mt-2">Choisissez une mission dans la liste pour voir le canal de communication</p>
              <button onClick={onCreateMission} className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition">
                + Créer un ordre de mission
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header commun ── */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-700">
                    {(selectedMission.artisan || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{selectedMission.artisan || 'Non assigné'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statuts[selectedMission.statut]?.color}`}>
                        {statuts[selectedMission.statut]?.label}
                      </span>
                      {selectedMission.priorite === 'urgente' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">🔴 URGENT</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedMission.type} · {selectedMission.immeuble}
                      {selectedMission.batiment && ` · Bât. ${selectedMission.batiment}`}
                      {selectedMission.etage && ` · Ét. ${selectedMission.etage}`}
                      {selectedMission.numLot && ` · Lot ${selectedMission.numLot}`}
                    </p>
                    {(selectedMission.demandeurNom || selectedMission.locataire) && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        👤 {selectedMission.demandeurNom || selectedMission.locataire}
                        {selectedMission.demandeurRole && <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${demandeurBadgeColor}`}>{demandeurRoleLabel}</span>}
                        {selectedMission.estPartieCommune && <span className="ml-2 text-orange-600">· {selectedMission.zoneSignalee || 'Partie commune'}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onOpenMission(selectedMission)}
                  className="text-xs text-purple-600 hover:text-purple-800 font-semibold border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition"
                >
                  📋 Détails →
                </button>
              </div>

              {/* ── Onglets canal ── */}
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => setCanalTab('artisan')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${canalTab === 'artisan' ? 'bg-amber-100 text-amber-800 border-2 border-amber-300' : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700 border-2 border-transparent'}`}
                >
                  🔨 Artisan
                  {selectedMission.artisan && <span className="text-xs opacity-70">· {selectedMission.artisan.split(' ')[0]}</span>}
                  {(selectedMission.canalMessages?.length || 0) > 0 && (
                    <span className="bg-amber-500 text-white text-xs px-1.5 rounded-full">{selectedMission.canalMessages?.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setCanalTab('demandeur')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${canalTab === 'demandeur' ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-700 border-2 border-transparent'}`}
                >
                  {demandeurIcon} {demandeurRoleLabel}
                  {(selectedMission.demandeurNom || selectedMission.locataire) && (
                    <span className="text-xs opacity-70">· {(selectedMission.demandeurNom || selectedMission.locataire || '').split(' ')[0]}</span>
                  )}
                  {(selectedMission.demandeurMessages?.length || 0) > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-1.5 rounded-full">{selectedMission.demandeurMessages?.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════ */}
            {/* ONGLET ARTISAN */}
            {/* ══════════════════════════════════════════════════ */}
            {canalTab === 'artisan' && (
              <>
                {/* Fil de messages artisan */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {(!selectedMission.canalMessages || selectedMission.canalMessages.length === 0) ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-3">🔨</div>
                      <p className="text-gray-500 font-medium">Canal artisan ouvert</p>
                      <p className="text-sm text-gray-500 mt-1">L&apos;ordre de mission a été envoyé à {selectedMission.artisan}.<br/>Attendez sa confirmation ou envoyez un message.</p>
                    </div>
                  ) : selectedMission.canalMessages.map((msg, i) => {
                    const isMe = msg.role === userRole
                    const isSystem = msg.role === 'system'
                    const isArtisan = msg.role === 'artisan'

                    if (isSystem) {
                      return (
                        <div key={i} className="flex justify-center">
                          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 max-w-xl">
                            <p className="text-xs text-gray-500 text-center leading-relaxed whitespace-pre-line">{msg.texte}</p>
                            <p className="text-xs text-gray-300 text-center mt-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isArtisan ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                          {msg.auteur.charAt(0).toUpperCase()}
                        </div>
                        <div className={`max-w-sm ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <p className="text-xs text-gray-500 px-1">{msg.auteur} {isArtisan ? '· Artisan' : '· Gestionnaire'}</p>
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : isArtisan ? 'bg-amber-50 text-gray-900 border border-amber-100 rounded-tl-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                            {msg.texte}
                          </div>
                          <p className="text-xs text-gray-300 px-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Zone saisie artisan */}
                <div className="border-t border-gray-100 bg-white px-4 pt-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Votre nom :</label>
                      <input
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-32 focus:ring-1 focus:ring-purple-400 focus:outline-none"
                        value={authorName}
                        onChange={e => setAuthorName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['📍 En route', '✅ Confirmé', '⚠️ Info manquante', '🔑 Accès requis', '📄 Devis envoyé'].map(txt => (
                        <button key={txt} onClick={() => setNewMsg(txt)} className="text-xs bg-gray-100 hover:bg-amber-50 hover:text-amber-700 px-2.5 py-1 rounded-full transition">
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pb-4">
                    <textarea
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 outline-none resize-none"
                      placeholder={`Message à ${selectedMission.artisan || 'l\'artisan'}…`}
                      value={newMsg}
                      rows={2}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg())}
                    />
                    <button
                      onClick={sendMsg}
                      disabled={!newMsg.trim()}
                      className="bg-amber-500 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-amber-600 transition disabled:opacity-60 self-end"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* ONGLET DEMANDEUR (copropriétaire / locataire / technicien) */}
            {/* ══════════════════════════════════════════════════ */}
            {canalTab === 'demandeur' && (
              <>
                {/* Info demandeur */}
                {(selectedMission.demandeurNom || selectedMission.locataire) ? (
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-lg font-bold text-blue-700 flex-shrink-0">
                        {(selectedMission.demandeurNom || selectedMission.locataire || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-blue-900 text-sm">{selectedMission.demandeurNom || selectedMission.locataire}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${demandeurBadgeColor}`}>{demandeurRoleLabel}</span>
                          {selectedMission.artisan && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">🔨 {selectedMission.artisan}</span>
                          )}
                        </div>
                        {/* Localisation */}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {selectedMission.immeuble && <span className="text-xs text-blue-600">🏢 {selectedMission.immeuble}</span>}
                          {selectedMission.batiment && <span className="text-xs text-blue-600">· Bât. {selectedMission.batiment}</span>}
                          {selectedMission.etage && <span className="text-xs text-blue-600">· Ét. {selectedMission.etage}</span>}
                          {selectedMission.numLot && <span className="text-xs text-blue-600">· Lot {selectedMission.numLot}</span>}
                        </div>
                        {selectedMission.estPartieCommune && (
                          <p className="text-xs text-orange-600 mt-1">🔶 {selectedMission.zoneSignalee || 'Partie commune'}</p>
                        )}
                        {selectedMission.telephoneLocataire && (
                          <p className="text-xs text-blue-500 mt-1">📞 {selectedMission.telephoneLocataire}</p>
                        )}
                        {selectedMission.demandeurEmail && (
                          <p className="text-xs text-blue-500">✉️ {selectedMission.demandeurEmail}</p>
                        )}
                      </div>
                      {/* Bouton transfert artisan */}
                      <button
                        onClick={() => openTransfert(selectedMission)}
                        className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm"
                      >
                        🔨 Transférer à un artisan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs text-gray-500">ℹ️ Aucun demandeur identifié pour cette mission. Les informations de contact seront affichées ici si un copropriétaire, locataire ou technicien est lié à cette mission.</p>
                  </div>
                )}

                {/* Fil de messages demandeur */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-blue-50/30">
                  {(!selectedMission.demandeurMessages || selectedMission.demandeurMessages.length === 0) ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-3">👤</div>
                      <p className="text-gray-500 font-medium">Canal demandeur</p>
                      {selectedMission.demandeurNom || selectedMission.locataire ? (
                        <p className="text-sm text-gray-500 mt-1">
                          {selectedMission.demandeurNom || selectedMission.locataire} peut vous contacter via le portail copropriétaire.<br/>
                          Vous pouvez aussi leur envoyer une notification directement.
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">
                          Aucun demandeur associé à cette mission.<br/>
                          Créez la mission depuis une demande reçue pour lier automatiquement le demandeur.
                        </p>
                      )}
                    </div>
                  ) : selectedMission.demandeurMessages.map((msg, i) => {
                    const isMe = msg.role === userRole || msg.role === 'syndic' || msg.role === 'syndic_tech' || msg.role === 'syndic_gestionnaire'
                    const isDemandeur = msg.role === 'coproprio' || msg.role === 'locataire' || msg.role === 'technicien' || msg.role === 'demandeur'
                    const isSystem = msg.role === 'system'

                    if (isSystem) {
                      return (
                        <div key={i} className="flex justify-center">
                          <div className="bg-white border border-blue-100 rounded-xl px-4 py-2 max-w-xl">
                            <p className="text-xs text-blue-600 text-center leading-relaxed whitespace-pre-line">{msg.texte}</p>
                            <p className="text-xs text-gray-300 text-center mt-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${isDemandeur ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {msg.auteur.charAt(0).toUpperCase()}
                        </div>
                        <div className={`max-w-sm ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <p className="text-xs text-gray-500 px-1">{msg.auteur} {isDemandeur ? `· ${demandeurRoleLabel}` : '· Gestionnaire'}</p>
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : isDemandeur ? 'bg-blue-50 text-gray-900 border border-blue-100 rounded-tl-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                            {msg.texte}
                          </div>
                          <p className="text-xs text-gray-300 px-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Zone saisie demandeur */}
                <div className="border-t border-blue-100 bg-white px-4 pt-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Votre nom :</label>
                      <input
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-32 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        value={authorName}
                        onChange={e => setAuthorName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        '✅ Demande traitée',
                        `🔧 Artisan confirmé`,
                        '📅 RDV planifié',
                        '✔️ Intervention terminée',
                        '❓ Précisions requises',
                      ].map(txt => (
                        <button key={txt} onClick={() => setNewMsgDemandeur(txt)} className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 px-2.5 py-1 rounded-full transition">
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pb-4">
                    <textarea
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 outline-none resize-none"
                      placeholder={`Message à ${selectedMission.demandeurNom || selectedMission.locataire || 'au demandeur'}…`}
                      value={newMsgDemandeur}
                      rows={2}
                      onChange={e => setNewMsgDemandeur(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsgDemandeur())}
                    />
                    <button
                      onClick={sendMsgDemandeur}
                      disabled={!newMsgDemandeur.trim()}
                      className="bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 self-end"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL — TRANSFÉRER À UN ARTISAN                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showTransfert && selectedMission && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">🔨 Transférer à un artisan</h2>
                <p className="text-xs text-gray-500 mt-0.5">Crée un ordre de mission depuis ce signalement</p>
              </div>
              <button onClick={() => setShowTransfert(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Résumé signalement */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-blue-800">📋 Signalement de {selectedMission.demandeurNom || selectedMission.locataire}</p>
                <p className="text-xs text-blue-700">🏢 {selectedMission.immeuble}{selectedMission.estPartieCommune ? ` · ${selectedMission.zoneSignalee}` : ''}{selectedMission.etage ? ` · Ét. ${selectedMission.etage}` : ''}{selectedMission.numLot ? ` · Lot ${selectedMission.numLot}` : ''}</p>
                <p className="text-xs text-blue-700">🔧 Type : {selectedMission.type || 'Non défini'}</p>
                {selectedMission.demandeurEmail && <p className="text-xs text-blue-600">✉️ {selectedMission.demandeurEmail}</p>}
              </div>

              {/* Sélection artisan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Artisan *</label>
                {artisans.filter(a => a.statut === 'actif').length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Aucun artisan actif disponible</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {artisans.filter(a => a.statut === 'actif').map(a => (
                      <label key={a.id} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${transfertArtisanId === a.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/50'}`}>
                        <input
                          type="radio"
                          name="artisan"
                          value={a.id}
                          checked={transfertArtisanId === a.id}
                          onChange={() => setTransfertArtisanId(a.id)}
                          className="accent-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{a.nom}</p>
                            {(a.vitfixCertifie || a.vitfix_certifie) && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">✓ Certifié</span>}
                          </div>
                          <p className="text-xs text-gray-500">{a.metier} · {a.telephone}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-amber-600">⭐ {a.note}</p>
                          <p className="text-xs text-gray-500">{a.nbInterventions || a.nb_interventions} missions</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description de l'intervention</label>
                <textarea
                  rows={3}
                  value={transfertDescription}
                  onChange={e => setTransfertDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none"
                  placeholder="Décrivez le travail à effectuer…"
                />
              </div>

              {/* Priorité + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priorité</label>
                  <select
                    value={transfertPriorite}
                    onChange={e => setTransfertPriorite(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                  >
                    <option value="urgente">🔴 Urgente</option>
                    <option value="normale">🟡 Normale</option>
                    <option value="planifiee">🟢 Planifiée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date d'intervention</label>
                  <input
                    type="date"
                    value={transfertDate}
                    onChange={e => setTransfertDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Succès */}
              {transfertSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium text-center">
                  ✅ {transfertSuccess}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowTransfert(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleTransfert}
                disabled={!transfertArtisanId || transfertLoading || !!transfertSuccess}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition disabled:opacity-40 shadow-sm"
              >
                {transfertLoading ? '⏳ Création…' : '🔨 Créer l\'ordre de mission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
