'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'accueil' | 'immeubles' | 'artisans' | 'missions' | 'planning' | 'documents' | 'facturation' | 'coproprios' | 'alertes' | 'emails' | 'reglementaire' | 'rapport' | 'ia' | 'parametres' | 'equipe' | 'comptabilite_tech' | 'analyse_devis' | 'docs_interventions'

// Pages accessibles par rôle
const ROLE_PAGES: Record<string, Page[]> = {
  syndic: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'planning', 'reglementaire', 'rapport', 'documents', 'facturation', 'alertes', 'emails', 'ia', 'equipe', 'analyse_devis', 'parametres'],
  syndic_admin: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'planning', 'reglementaire', 'rapport', 'documents', 'facturation', 'alertes', 'emails', 'ia', 'equipe', 'analyse_devis', 'parametres'],
  syndic_tech: ['accueil', 'missions', 'artisans', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'planning', 'alertes', 'ia', 'parametres'],
  syndic_secretaire: ['accueil', 'coproprios', 'missions', 'planning', 'documents', 'alertes', 'emails', 'ia', 'parametres'],
  syndic_gestionnaire: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'planning', 'reglementaire', 'alertes', 'documents', 'ia', 'parametres'],
  syndic_comptable: ['accueil', 'facturation', 'rapport', 'documents', 'ia', 'parametres'],
}

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
}

interface Alerte {
  id: string
  type: 'rc_pro' | 'controle' | 'budget' | 'mission' | 'document'
  message: string
  urgence: 'haute' | 'moyenne' | 'basse'
  date: string
}

// ─── Données démo ─────────────────────────────────────────────────────────────

const IMMEUBLES_DEMO: Immeuble[] = [
  { id: '1', nom: 'Résidence Les Acacias', adresse: '12 rue des Acacias', ville: 'Paris', codePostal: '75008', nbLots: 24, anneeConstruction: 1978, typeImmeuble: 'Copropriété', gestionnaire: 'Jean Dupont', prochainControle: '2026-03-15', nbInterventions: 8, budgetAnnuel: 45000, depensesAnnee: 28000 },
  { id: '2', nom: 'Le Clos Vendôme', adresse: '3 allée Vendôme', ville: 'Lyon', codePostal: '69002', nbLots: 36, anneeConstruction: 1965, typeImmeuble: 'Copropriété', gestionnaire: 'Marie Martin', prochainControle: '2026-02-28', nbInterventions: 12, budgetAnnuel: 68000, depensesAnnee: 51000 },
  { id: '3', nom: 'Tour Horizon', adresse: '88 boulevard Horizon', ville: 'Marseille', codePostal: '13008', nbLots: 60, anneeConstruction: 1990, typeImmeuble: 'Résidence', gestionnaire: 'Pierre Leroy', prochainControle: '2026-04-10', nbInterventions: 5, budgetAnnuel: 90000, depensesAnnee: 32000 },
]

const ARTISANS_DEMO: Artisan[] = [
  { id: '1', nom: 'Marc Fontaine', metier: 'Plomberie', telephone: '06 12 34 56 78', email: 'marc@plomberie.fr', siret: '12345678901234', rcProValide: true, rcProExpiration: '2026-12-31', note: 4.8, nbInterventions: 34, statut: 'actif', vitfixCertifie: true },
  { id: '2', nom: 'Sophie Électrique', metier: 'Électricité', telephone: '06 98 76 54 32', email: 'sophie@elec.fr', siret: '98765432109876', rcProValide: true, rcProExpiration: '2026-08-15', note: 4.6, nbInterventions: 22, statut: 'actif', vitfixCertifie: true },
  { id: '3', nom: 'Karim Peinture', metier: 'Peinture', telephone: '06 11 22 33 44', email: 'karim@peinture.fr', siret: '11122233344455', rcProValide: false, rcProExpiration: '2025-11-30', note: 4.2, nbInterventions: 15, statut: 'suspendu', vitfixCertifie: false },
  { id: '4', nom: 'Lucas Menuiserie', metier: 'Menuiserie', telephone: '06 55 66 77 88', email: 'lucas@menuiserie.fr', siret: '55566677788899', rcProValide: true, rcProExpiration: '2027-03-01', note: 4.9, nbInterventions: 41, statut: 'actif', vitfixCertifie: true },
]

const MISSIONS_DEMO: Mission[] = [
  { id: '1', immeuble: 'Résidence Les Acacias', artisan: 'Marc Fontaine', type: 'Plomberie', description: 'Fuite colonne d\'eau chaude cave niveau -1', priorite: 'urgente', statut: 'en_cours', dateCreation: '2026-02-20', dateIntervention: '2026-02-23', montantDevis: 850 },
  { id: '2', immeuble: 'Le Clos Vendôme', artisan: 'Sophie Électrique', type: 'Électricité', description: 'Remplacement tableau électrique parties communes', priorite: 'normale', statut: 'acceptee', dateCreation: '2026-02-18', dateIntervention: '2026-02-26', montantDevis: 3200 },
  { id: '3', immeuble: 'Tour Horizon', artisan: 'Lucas Menuiserie', type: 'Menuiserie', description: 'Réparation porte entrée principale — gonds cassés', priorite: 'urgente', statut: 'terminee', dateCreation: '2026-02-15', dateIntervention: '2026-02-16', montantDevis: 420, montantFacture: 390 },
  { id: '4', immeuble: 'Résidence Les Acacias', artisan: 'Karim Peinture', type: 'Peinture', description: 'Ravalement façade côté rue', priorite: 'planifiee', statut: 'en_attente', dateCreation: '2026-02-22', dateIntervention: '2026-04-01', montantDevis: 12000 },
]

const ALERTES_DEMO: Alerte[] = [
  { id: '1', type: 'rc_pro', message: 'RC Pro de Karim Peinture expirée depuis le 30/11/2025', urgence: 'haute', date: '2026-02-23' },
  { id: '2', type: 'controle', message: 'Contrôle ascenseur Le Clos Vendôme — échéance 28/02/2026', urgence: 'haute', date: '2026-02-23' },
  { id: '3', type: 'budget', message: 'Le Clos Vendôme : 75% du budget annuel consommé', urgence: 'moyenne', date: '2026-02-22' },
  { id: '4', type: 'document', message: 'Diagnostic DPE manquant pour Tour Horizon', urgence: 'basse', date: '2026-02-20' },
]

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
          className="w-full text-xs text-gray-400 hover:text-red-500 transition py-1"
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
      className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-purple-400 text-gray-700 hover:text-purple-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
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
          <button onClick={() => setInviteUrl(null)} className="text-xs text-gray-400 mt-2 hover:text-gray-600">Fermer</button>
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
                className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50"
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
            <p className="text-sm text-gray-400 mt-1">Invitez votre équipe pour collaborer</p>
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
                        <p className="text-xs text-gray-400">{m.email}</p>
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

function AnalyseDevisSection({ artisans, setPage }: { artisans: Artisan[]; setPage: (p: Page) => void }) {
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
    artisan: '', immeuble: '', type: '', description: '',
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
          setError('Ce PDF est un document scanné (image). Veuillez copier-coller le texte manuellement.')
          setInputMode('paste')
        } else {
          setError(data.error || 'Erreur extraction PDF')
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
        setMissionSuccess(true)
        setShowMissionModal(false)
      } else {
        alert(data.message || data.error || 'Erreur lors de la création')
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
                            <p className="text-xs text-gray-400">Devis, facture, bon de commande — max 20 Mo</p>
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
                            className="text-sm text-gray-400 hover:text-red-500 transition"
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
                        Nom du document <span className="font-normal text-gray-400">(optionnel)</span>
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
                      <p className="text-xs text-gray-400 mt-1">{docText.length} caractères</p>
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
                            <span className="text-gray-400">🔧</span>
                            <span className="text-gray-700"><strong>{extracted.artisan_nom}</strong>{extracted.artisan_metier ? ` — ${extracted.artisan_metier}` : ''}</span>
                          </div>
                        )}
                        {extracted.description_travaux && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">📋</span>
                            <span className="text-gray-700 truncate">{extracted.description_travaux}</span>
                          </div>
                        )}
                        {extracted.immeuble && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">🏢</span>
                            <span className="text-gray-700">{extracted.immeuble}</span>
                          </div>
                        )}
                        {(extracted.montant_ht || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">💰</span>
                            <span className="text-gray-700">
                              <strong>{extracted.montant_ht?.toLocaleString('fr-FR')}€ HT</strong>
                              {(extracted.montant_ttc || 0) > 0 && <span className="text-gray-400"> / {extracted.montant_ttc?.toLocaleString('fr-FR')}€ TTC</span>}
                            </span>
                          </div>
                        )}
                        {extracted.date_intervention && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">📅</span>
                            <span className="text-gray-700">{new Date(extracted.date_intervention).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                        {extracted.priorite && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">🚦</span>
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
              <p className="text-sm text-gray-400 mt-1">Lancez votre première analyse pour la retrouver ici</p>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">📋 Créer la mission</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Données pré-remplies depuis le devis</p>
                </div>
                <button onClick={() => setShowMissionModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Artisan <span className="text-red-500">*</span></label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de travaux</label>
                  <input
                    type="text"
                    value={missionForm.type}
                    onChange={e => setMissionForm(f => ({ ...f, type: e.target.value }))}
                    placeholder="ex : Plomberie, Élagage..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  value={missionForm.description}
                  onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Immeuble</label>
                  <input
                    type="text"
                    value={missionForm.immeuble}
                    onChange={e => setMissionForm(f => ({ ...f, immeuble: e.target.value }))}
                    placeholder="Nom ou adresse"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant HT (€)</label>
                  <input
                    type="number"
                    value={missionForm.montantDevis || ''}
                    onChange={e => setMissionForm(f => ({ ...f, montantDevis: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;intervention</label>
                  <input
                    type="date"
                    value={missionForm.dateIntervention}
                    onChange={e => setMissionForm(f => ({ ...f, dateIntervention: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
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
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleCreateMission}
                disabled={missionCreating || !missionForm.artisan || !missionForm.description}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {missionCreating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création...</>
                ) : '✅ Créer la mission'}
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

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-3 flex-wrap items-center">
          {/* Recherche */}
          <div className="flex-1 min-w-64 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
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
          {/* Statut transmission */}
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value as typeof filterStatut)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">🔄 Tous statuts</option>
            <option value="non_envoye">🔴 Non transmis</option>
            <option value="envoye">✅ Transmis</option>
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
              ✕ Effacer
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">{filtered.length} document{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</p>
      </div>

      {/* Liste documents */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="font-semibold text-gray-700">{docs.length === 0 ? 'Aucun document' : 'Aucun résultat'}</p>
          <p className="text-sm text-gray-400 mt-1">{docs.length === 0 ? 'Ajoutez des factures, devis et rapports d\'intervention' : 'Modifiez vos filtres de recherche'}</p>
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
              className={`bg-white rounded-2xl border-2 shadow-sm p-5 transition ${
                doc.envoye_compta ? 'border-green-200' : 'border-orange-200'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Badge type */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-50 border border-gray-100">
                  {typeConfig[doc.type]?.emoji || '📄'}
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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        Transmis compta
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse inline-block" />
                        Non transmis
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
                    <p className="text-xs text-gray-400 mt-1 italic truncate">💬 {doc.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Ouvrir */}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Ouvrir"
                  >
                    👁️
                  </a>

                  {/* Analyser (si facture/devis) */}
                  {(doc.type === 'facture' || doc.type === 'devis') && (
                    <button
                      onClick={() => setPage('analyse_devis')}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
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
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
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
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
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
                      <p className="text-xs text-gray-400">PDF, JPG, PNG — max 10 Mo</p>
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
          <p className="text-sm text-gray-400 text-center py-8">Aucune intervention pour les filtres sélectionnés</p>
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
          <p className="text-sm text-gray-400 text-center py-8">Aucune données</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byImmeuble).sort((a, b) => b[1].montant - a[1].montant).map(([imm, stats]) => {
              const pct = totalMontant > 0 ? Math.round(stats.montant / totalMontant * 100) : 0
              return (
                <div key={imm} className="flex items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{imm}</p>
                    <p className="text-xs text-gray-400">{stats.count} mission{stats.count > 1 ? 's' : ''}</p>
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
                  <div className="text-xs text-gray-400 w-10 text-right">{pct}%</div>
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
          <p className="text-sm text-gray-400 text-center py-8">Aucune intervention</p>
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
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
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
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>✉️ {email.from_name || email.from_email}</span>
                            {email.immeuble_detecte && <span>🏢 {email.immeuble_detecte}</span>}
                            {email.locataire_detecte && <span>👤 {email.locataire_detecte}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Date */}
                      <div className="text-xs text-gray-400 flex-shrink-0 mt-1 text-right">
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p>Aucun email ne correspond aux filtres</p>
            </div>
          ) : null}
        </>
      )}

      {activeTab === 'rapport' && (
        <div className="space-y-4">
          {emails.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
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
                      <span className="text-xs text-gray-400 w-10">({stats.total > 0 ? Math.round((t.count / stats.total) * 100) : 0}%)</span>
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
                          <p className="text-xs text-gray-400">{email.from_name || email.from_email} · {new Date(email.received_at).toLocaleDateString('fr-FR')}</p>
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
                <button onClick={() => setSelectedEmail(null)} className="text-gray-400 hover:text-gray-600 text-xl ml-3">✕</button>
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
                  <div className="w-full text-center py-2 text-sm text-gray-400">
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

function ModalNouveilleMission({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Partial<Mission>) => void }) {
  const [form, setForm] = useState({ immeuble: '', artisan: '', type: 'Plomberie', description: '', priorite: 'normale' as Mission['priorite'], dateIntervention: '', montantDevis: '' })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Nouvel ordre de mission</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Immeuble</label>
              <select value={form.immeuble} onChange={e => setForm({ ...form, immeuble: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="">Sélectionner</option>
                {IMMEUBLES_DEMO.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artisan</label>
              <select value={form.artisan} onChange={e => setForm({ ...form, artisan: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="">Sélectionner</option>
                {ARTISANS_DEMO.filter(a => a.statut === 'actif').map(a => <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de travaux</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                {['Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Menuiserie', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Chauffage', 'Autre'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
              <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as Mission['priorite'] })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none bg-white text-sm">
                <option value="urgente">🔴 Urgente</option>
                <option value="normale">🔵 Normale</option>
                <option value="planifiee">⚪ Planifiée</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none resize-none text-sm"
              placeholder="Décrivez l'intervention nécessaire..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date souhaitée</label>
              <input type="date" value={form.dateIntervention} onChange={e => setForm({ ...form, dateIntervention: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (€)</label>
              <input type="number" value={form.montantDevis} onChange={e => setForm({ ...form, montantDevis: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition">Annuler</button>
          <button onClick={() => { onAdd({ ...form, id: Date.now().toString(), statut: 'en_attente', dateCreation: new Date().toISOString().split('T')[0], montantDevis: Number(form.montantDevis) || undefined }); onClose() }}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition">
            Créer la mission
          </button>
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

const GED_DEMO: GEDDocument[] = [
  { id: '1',  nom: 'Rapport plomberie cave — fuite colonne eau chaude', type: 'rapport',    immeuble: 'Résidence Les Acacias', artisan: 'Marc Fontaine',    locataire: 'Martin Jean',     dateDocument: '2026-02-23', dateAjout: '2026-02-23', taille: '1.2 MB', tags: ['plomberie', 'fuite', 'cave'] },
  { id: '2',  nom: 'Facture remplacement tableau électrique parties communes', type: 'facture', immeuble: 'Le Clos Vendôme',    artisan: 'Sophie Électrique', locataire: '',                dateDocument: '2026-02-20', dateAjout: '2026-02-21', taille: '340 KB', tags: ['électricité', 'tableau', 'parties communes'] },
  { id: '3',  nom: 'Devis ravalement façade côté rue', type: 'devis',   immeuble: 'Résidence Les Acacias', artisan: 'Karim Peinture',    locataire: '',                dateDocument: '2026-02-22', dateAjout: '2026-02-22', taille: '280 KB', tags: ['peinture', 'façade', 'ravalement'] },
  { id: '4',  nom: 'DPE Tour Horizon 2024', type: 'diagnostic',         immeuble: 'Tour Horizon',          artisan: '',                  locataire: '',                dateDocument: '2024-01-15', dateAjout: '2024-01-16', taille: '2.1 MB', tags: ['DPE', 'énergie', 'diagnostic'] },
  { id: '5',  nom: 'Attestation RC Pro Marc Fontaine 2026', type: 'assurance', immeuble: 'Tous',            artisan: 'Marc Fontaine',    locataire: '',                dateDocument: '2026-01-01', dateAjout: '2026-01-02', taille: '450 KB', tags: ['RC Pro', 'assurance', 'attestation'] },
  { id: '6',  nom: 'PV AG annuelle 2025 — Le Clos Vendôme', type: 'ag',immeuble: 'Le Clos Vendôme',       artisan: '',                  locataire: '',                dateDocument: '2025-06-10', dateAjout: '2025-06-11', taille: '890 KB', tags: ['AG', 'assemblée', 'vote', '2025'] },
  { id: '7',  nom: 'Rapport menuiserie porte entrée brisée', type: 'rapport', immeuble: 'Tour Horizon',    artisan: 'Lucas Menuiserie',  locataire: '',                dateDocument: '2026-02-16', dateAjout: '2026-02-16', taille: '780 KB', tags: ['menuiserie', 'porte', 'entrée'] },
  { id: '8',  nom: 'Facture réparation porte d\'entrée', type: 'facture', immeuble: 'Tour Horizon',         artisan: 'Lucas Menuiserie',  locataire: '',                dateDocument: '2026-02-17', dateAjout: '2026-02-17', taille: '210 KB', tags: ['menuiserie', 'facture', 'porte'] },
  { id: '9',  nom: 'Contrat entretien ascenseur 2026', type: 'contrat', immeuble: 'Le Clos Vendôme',       artisan: '',                  locataire: '',                dateDocument: '2026-01-05', dateAjout: '2026-01-06', taille: '1.5 MB', tags: ['ascenseur', 'contrat', 'entretien'] },
  { id: '10', nom: 'Contrôle ascenseur — rapport technique', type: 'controle', immeuble: 'Le Clos Vendôme', artisan: '',               locataire: '',                dateDocument: '2026-02-15', dateAjout: '2026-02-15', taille: '660 KB', tags: ['ascenseur', 'contrôle', 'sécurité'] },
  { id: '11', nom: 'Plan masse immeuble Les Acacias', type: 'plan',     immeuble: 'Résidence Les Acacias', artisan: '',                  locataire: '',                dateDocument: '2020-03-01', dateAjout: '2021-09-10', taille: '4.2 MB', tags: ['plan', 'masse', 'architecture'] },
  { id: '12', nom: 'Signalement fuite lot 12 — Dupont Marie', type: 'rapport', immeuble: 'Résidence Les Acacias', artisan: 'Marc Fontaine', locataire: 'Dupont Marie', dateDocument: '2026-02-10', dateAjout: '2026-02-10', taille: '320 KB', tags: ['fuite', 'lot 12', 'urgent'] },
  { id: '13', nom: 'Devis peinture cage escalier A', type: 'devis',     immeuble: 'Le Clos Vendôme',       artisan: 'Karim Peinture',    locataire: '',                dateDocument: '2026-02-08', dateAjout: '2026-02-09', taille: '195 KB', tags: ['peinture', 'cage', 'escalier'] },
  { id: '14', nom: 'Attestation assurance immeuble 2026 — AXA', type: 'assurance', immeuble: 'Tour Horizon', artisan: '',              locataire: '',                dateDocument: '2026-01-01', dateAjout: '2026-01-02', taille: '820 KB', tags: ['assurance', 'immeuble', 'AXA'] },
  { id: '15', nom: 'Rapport intervention interphone lot 28 — Bernard Paul', type: 'rapport', immeuble: 'Le Clos Vendôme', artisan: 'Sophie Électrique', locataire: 'Bernard Paul', dateDocument: '2026-02-21', dateAjout: '2026-02-21', taille: '540 KB', tags: ['interphone', 'électricité', 'lot 28'] },
]

// ─── Composant GED ─────────────────────────────────────────────────────────────

function GEDSection({ immeubles, artisans }: { immeubles: Immeuble[]; artisans: Artisan[] }) {
  const [docs, setDocs] = useState<GEDDocument[]>(GED_DEMO)
  const [search, setSearch] = useState('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterArtisan, setFilterArtisan] = useState('')
  const [filterLocataire, setFilterLocataire] = useState('')
  const [filterType, setFilterType] = useState<TypeDocument | ''>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<GEDDocument | null>(null)
  const [uploadForm, setUploadForm] = useState({ nom: '', type: 'rapport' as TypeDocument, immeuble: '', artisan: '', locataire: '', tags: '' })

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

  const handleUpload = () => {
    if (!uploadForm.nom) return
    const newDoc: GEDDocument = {
      id: Date.now().toString(),
      nom: uploadForm.nom,
      type: uploadForm.type,
      immeuble: uploadForm.immeuble || 'Tous',
      artisan: uploadForm.artisan,
      locataire: uploadForm.locataire,
      dateDocument: new Date().toISOString().split('T')[0],
      dateAjout: new Date().toISOString().split('T')[0],
      taille: '—',
      tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    setDocs(prev => [newDoc, ...prev])
    setShowUpload(false)
    setUploadForm({ nom: '', type: 'rapport', immeuble: '', artisan: '', locataire: '', tags: '' })
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
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
              {hasFilters && <span className="text-gray-400"> sur {docs.length} au total</span>}
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
            <div className="text-center py-16 text-gray-400">
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
                    <div className="col-span-1 text-xs text-gray-400">
                      {new Date(doc.dateDocument).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                    {/* Actions */}
                    <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setSelectedDoc(doc)} title="Détails"
                        className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-lg transition text-xs">👁</button>
                      <button title="Télécharger"
                        className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-lg transition text-xs">⬇️</button>
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
            <div className="col-span-4 text-center py-16 text-gray-400">
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
                <p className="text-xs text-gray-400 mt-2">{doc.immeuble}</p>
                {doc.artisan && <p className="text-xs text-gray-500">🔧 {doc.artisan}</p>}
                {doc.locataire && <p className="text-xs text-purple-600">👤 {doc.locataire}</p>}
                <p className="text-xs text-gray-400 mt-2">{new Date(doc.dateDocument).toLocaleDateString('fr-FR')} · {doc.taille}</p>
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
              <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">🏢 Bâtiment</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.immeuble}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">📅 Date document</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateDocument).toLocaleDateString('fr-FR')}</p>
                </div>
                {selectedDoc.artisan && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">🔧 Artisan / Technicien</p>
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
                  <p className="text-xs text-gray-400 mb-0.5">📦 Taille</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.taille}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">📥 Ajouté le</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateAjout).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              {selectedDoc.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Tags</p>
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
              <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-semibold transition text-sm">
                ⬇️ Télécharger
              </button>
              <button onClick={() => setSelectedDoc(null)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                Fermer
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
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition cursor-pointer">
                <div className="text-3xl mb-2">📎</div>
                <p className="text-sm font-medium text-gray-700">Glissez un fichier ou cliquez pour sélectionner</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images — Max 50 MB</p>
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
              <button onClick={handleUpload} disabled={!uploadForm.nom}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50">
                Ajouter le document
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

const COPROPRIOS_DEMO: Coproprio[] = [
  { id: '1', immeuble: 'Résidence Les Acacias', batiment: 'Bât A', etage: 0, numeroPorte: '1', nomProprietaire: 'Dupont', prenomProprietaire: 'Marie', emailProprietaire: 'marie.dupont@email.fr', telephoneProprietaire: '06 12 34 56 78', nomLocataire: 'Martin', prenomLocataire: 'Jean', emailLocataire: 'jean.martin@email.fr', telephoneLocataire: '06 98 76 54 32', estOccupe: true },
  { id: '2', immeuble: 'Résidence Les Acacias', batiment: 'Bât A', etage: 1, numeroPorte: '12', nomProprietaire: 'Bernard', prenomProprietaire: 'Paul', emailProprietaire: 'paul.bernard@email.fr', telephoneProprietaire: '06 11 22 33 44', estOccupe: false },
  { id: '3', immeuble: 'Résidence Les Acacias', batiment: 'Bât B', etage: 2, numeroPorte: '24', nomProprietaire: 'Leroy', prenomProprietaire: 'Sophie', emailProprietaire: 'sophie.leroy@email.fr', telephoneProprietaire: '06 55 44 33 22', nomLocataire: 'Petit', prenomLocataire: 'Lucas', emailLocataire: 'lucas.petit@email.fr', telephoneLocataire: '06 77 88 99 00', estOccupe: true },
  { id: '4', immeuble: 'Le Clos Vendôme', batiment: 'Principal', etage: 0, numeroPorte: '2', nomProprietaire: 'Moreau', prenomProprietaire: 'Claire', emailProprietaire: 'claire.moreau@email.fr', telephoneProprietaire: '06 23 45 67 89', estOccupe: true },
  { id: '5', immeuble: 'Le Clos Vendôme', batiment: 'Principal', etage: 1, numeroPorte: '28', nomProprietaire: 'Simon', prenomProprietaire: 'Antoine', emailProprietaire: 'antoine.simon@email.fr', telephoneProprietaire: '06 34 56 78 90', nomLocataire: 'Roux', prenomLocataire: 'Isabelle', emailLocataire: 'isabelle.roux@email.fr', telephoneLocataire: '06 45 67 89 01', estOccupe: true },
  { id: '6', immeuble: 'Tour Horizon', batiment: 'Tour', etage: 5, numeroPorte: '52', nomProprietaire: 'Blanc', prenomProprietaire: 'Thomas', emailProprietaire: 'thomas.blanc@email.fr', telephoneProprietaire: '06 56 78 90 12', estOccupe: true },
]

// ─── Composant Copropriétaires ────────────────────────────────────────────────

function CopropriosSection({ immeubles }: { immeubles: Immeuble[] }) {
  const [coproprios, setCoproprios] = useState<Coproprio[]>(COPROPRIOS_DEMO)
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Coproprio | null>(null)
  const [form, setForm] = useState<Partial<Coproprio>>({ immeuble: '', batiment: '', etage: 0, numeroPorte: '', nomProprietaire: '', prenomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', estOccupe: false })

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
  const handleDelete = (id: string) => setCoproprios(prev => prev.filter(c => c.id !== id))

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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
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
                <span className="text-xs text-gray-400">({lots.length} lot{lots.length > 1 ? 's' : ''})</span>
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
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition text-xs">✏️</button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && <div className="bg-white rounded-2xl p-12 text-center text-gray-400"><div className="text-4xl mb-3">👥</div><p>Aucun copropriétaire trouvé</p></div>}

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
              <button onClick={handleSave} disabled={!form.nomProprietaire || !form.immeuble || !form.numeroPorte} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50 text-sm">
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

const ECHEANCES_DEMO: EcheanceReglementaire[] = [
  { id: '1', immeuble: 'Résidence Les Acacias', type: 'ascenseur', label: 'Contrôle ascenseur obligatoire', dateEcheance: '2026-03-15', periodicite: 1 },
  { id: '2', immeuble: 'Le Clos Vendôme', type: 'ascenseur', label: 'Contrôle ascenseur obligatoire', dateEcheance: '2026-02-28', periodicite: 1 },
  { id: '3', immeuble: 'Tour Horizon', type: 'dpe', label: 'Renouvellement DPE collectif', dateEcheance: '2026-04-10', periodicite: 10 },
  { id: '4', immeuble: 'Résidence Les Acacias', type: 'ag', label: 'AG annuelle obligatoire', dateEcheance: '2026-06-30', periodicite: 1 },
  { id: '5', immeuble: 'Le Clos Vendôme', type: 'assurance', label: 'Renouvellement assurance immeuble AXA', dateEcheance: '2027-01-01', periodicite: 1 },
  { id: '6', immeuble: 'Tour Horizon', type: 'amiante', label: 'Diagnostic amiante parties communes', dateEcheance: '2025-12-01', periodicite: 3 },
  { id: '7', immeuble: 'Résidence Les Acacias', type: 'electricite', label: 'Contrôle installation électrique', dateEcheance: '2026-05-20', periodicite: 5 },
  { id: '8', immeuble: 'Le Clos Vendôme', type: 'ravalement', label: 'Ravalement façade (arrêté municipal)', dateEcheance: '2027-09-30', periodicite: 10 },
]

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

function CalendrierReglementaireSection({ immeubles }: { immeubles: Immeuble[] }) {
  const [echeances, setEcheances] = useState<EcheanceReglementaire[]>(ECHEANCES_DEMO)
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<EcheanceReglementaire>>({ immeuble: '', type: 'autre', label: '', dateEcheance: '', periodicite: 1 })

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
          <div className="col-span-3">Libellé</div>
          <div className="col-span-2">Échéance</div>
          <div className="col-span-1">Statut</div>
        </div>
        {filtered.map(e => {
          const statut = getStatutEcheance(e.dateEcheance)
          const sConfig = STATUT_ECHEANCE_CONFIG[statut]
          const tConfig = ECHEANCE_CONFIG[e.type]
          const daysLeft = Math.ceil((new Date(e.dateEcheance).getTime() - Date.now()) / 86400000)
          return (
            <div key={e.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 items-center ${statut === 'expire' ? 'bg-red-50/40' : statut === 'urgent' ? 'bg-orange-50/30' : ''}`}>
              <div className="col-span-3 text-sm font-medium text-gray-800 truncate">{e.immeuble}</div>
              <div className="col-span-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${tConfig.color}`}>{tConfig.emoji} {tConfig.label}</span></div>
              <div className="col-span-3 text-sm text-gray-600 truncate">{e.label}</div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-gray-900">{new Date(e.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                <p className="text-xs text-gray-400">{daysLeft < 0 ? `Il y a ${Math.abs(daysLeft)}j` : `Dans ${daysLeft}j`}</p>
              </div>
              <div className="col-span-1">
                <div className={`w-2.5 h-2.5 rounded-full ${sConfig.dot} mx-auto`} title={sConfig.label} />
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Aucune échéance trouvée</div>}
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
              <button onClick={handleAdd} disabled={!form.label || !form.immeuble || !form.dateEcheance} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50 text-sm">Ajouter</button>
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
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
          {isEmpty && <p className="text-xs text-gray-400 text-center mt-1">Signez ici avec votre souris ou votre doigt</p>}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-500">
          🕐 Horodatage : {new Date().toLocaleString('fr-FR')} · 🔐 Empreinte SHA-256 générée à la validation
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
          <button onClick={handleSign} disabled={isEmpty || !nom.trim() || signing}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50 text-sm">
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
    const body = encodeURIComponent(`Madame, Monsieur,\n\nVeuillez trouver ci-joint le rapport mensuel de gestion pour le mois de ${monthLabel}.\n\nCe rapport comprend :\n- Le bilan des interventions réalisées\n- L'état du budget\n- Les alertes réglementaires\n\nCordialement,\nVotre gestionnaire VitFix Pro`)
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
          <button onClick={generatePDF} disabled={generating} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
            {generating ? '⏳' : '📄'} {generating ? 'Génération...' : 'Télécharger PDF'}
          </button>
        </div>
      </div>

      {/* Aperçu rapport */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <p className="text-xs text-gray-400 mb-4 text-center">Aperçu du rapport — ce contenu sera généré en PDF</p>
        {/* Template caché pour jsPDF */}
        <div ref={rapportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '794px', backgroundColor: '#fff', fontFamily: 'Arial, sans-serif' }}>
          {/* En-tête */}
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: '32px 40px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>⚡ VitFix Pro</div>
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
              <span>⚡ VitFix Pro — Gestion de copropriété</span>
              <span>Document généré automatiquement — {new Date().toLocaleString('fr-FR')}</span>
            </div>
          </div>
        </div>

        {/* Aperçu visible */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">⚡ VitFix Pro</div>
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
            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
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
                      <span className="text-xs text-gray-400">{r.email}</span>
                    </label>
                  ))}
                </div>
              ))}
              {allEmails.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Aucun email copropriétaire renseigné</p>}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">Annuler</button>
              <button onClick={handleSend} disabled={selectedRecipients.length === 0} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50 text-sm">
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
  const [user, setUser] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [immeubles, setImmeubles] = useState<Immeuble[]>(IMMEUBLES_DEMO)
  const [artisans, setArtisans] = useState<Artisan[]>(ARTISANS_DEMO)
  const [missions, setMissions] = useState<Mission[]>(MISSIONS_DEMO)
  const [alertes] = useState<Alerte[]>(ALERTES_DEMO)
  const [showModalMission, setShowModalMission] = useState(false)
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
  const [iaMessages, setIaMessages] = useState<{ role: 'user' | 'assistant'; content: string; action?: any }[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis **Max**, votre assistant IA expert VitFix Pro.\n\nJ\'ai accès à **toutes vos données en temps réel** : immeubles, artisans, missions, alertes, échéances réglementaires.\n\nJe peux aussi **agir directement** : créer une mission, naviguer vers une page, générer un courrier...\n\n🎙️ Vous pouvez me parler à voix haute en cliquant sur le micro !\n\nComment puis-je vous aider ?' }
  ])
  const [iaInput, setIaInput] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const iaEndRef = useRef<HTMLDivElement>(null)
  // ── Voice & Speech ─────────────────────────────────────────────────────────
  const [iaVoiceActive, setIaVoiceActive] = useState(false)
  const [iaVoiceSupported, setIaVoiceSupported] = useState(false)
  const [iaSpeechEnabled, setIaSpeechEnabled] = useState(false)
  const [iaSpeaking, setIaSpeaking] = useState(false)
  const iaRecognitionRef = useRef<any>(null)
  const iaSendTimerRef = useRef<any>(null)

  useEffect(() => {
    // Vérifier support Web Speech API
    if (typeof window !== 'undefined') {
      const supported = !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      )
      setIaVoiceSupported(supported)
    }
  }, [])

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
      // getUser() fait un appel réseau frais (contrairement à getSession() qui lit les cookies)
      const { data: { user: freshUser } } = await supabase.auth.getUser()
      const userRole = freshUser?.user_metadata?.role || ''
      const isSyndic = userRole === 'syndic' || userRole.startsWith('syndic_')
      if (!freshUser || !isSyndic) {
        window.location.href = '/syndic/login'
        return
      }
      setUser(freshUser)
    }
    getUser()
  }, [])

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

  useEffect(() => {
    iaEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [iaMessages])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/syndic/login'
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
    coproprios_count: COPROPRIOS_DEMO.length,
    stats: {
      totalBudget: immeubles.reduce((s, i) => s + i.budgetAnnuel, 0),
      totalDepenses: immeubles.reduce((s, i) => s + i.depensesAnnee, 0),
      missionsUrgentes: missions.filter(m => m.priorite === 'urgente' && m.statut !== 'terminee').length,
      artisansRcExpiree: artisans.filter(a => !a.rcProValide).length,
    },
  })

  // ── Synthèse vocale ───────────────────────────────────────────────────────────
  const speakResponse = (text: string) => {
    if (!iaSpeechEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    // Nettoyer le markdown pour la parole
    const cleanText = text
      .replace(/##ACTION##[\s\S]*?##/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/\|[^\n]+\|/g, '') // enlever tableaux
      .replace(/[-•]\s/g, '')
      .replace(/\n{2,}/g, '. ')
      .trim()
      .substring(0, 500) // limiter pour ne pas lire trop longtemps
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'fr-FR'
    utterance.rate = 1.05
    utterance.pitch = 1.0
    // Chercher une voix française
    const voices = window.speechSynthesis.getVoices()
    const frVoice = voices.find(v => v.lang.startsWith('fr')) || null
    if (frVoice) utterance.voice = frVoice
    utterance.onstart = () => setIaSpeaking(true)
    utterance.onend = () => setIaSpeaking(false)
    utterance.onerror = () => setIaSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  // ── Reconnaissance vocale Web Speech API ─────────────────────────────────────
  const startVoiceRecognition = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // Stop si déjà actif
    if (iaVoiceActive && iaRecognitionRef.current) {
      iaRecognitionRef.current.stop()
      setIaVoiceActive(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    recognition.onstart = () => setIaVoiceActive(true)

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results as any[])
      const transcript = results.map((r: any) => r[0].transcript).join('')
      setIaInput(transcript)

      // Si résultat final → envoyer automatiquement après 600ms
      if ((event.results[event.results.length - 1] as any).isFinal) {
        clearTimeout(iaSendTimerRef.current)
        iaSendTimerRef.current = setTimeout(() => {
          setIaVoiceActive(false)
          // Déclencher via ref pour avoir la dernière valeur de iaInput
          setIaInput(prev => {
            if (prev.trim()) {
              // Envoyer le message avec la transcription
              setTimeout(() => {
                const btn = document.getElementById('ia-send-btn')
                if (btn) btn.click()
              }, 50)
            }
            return prev
          })
        }, 1500)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      setIaVoiceActive(false)
    }

    recognition.onend = () => {
      setIaVoiceActive(false)
    }

    iaRecognitionRef.current = recognition
    recognition.start()
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
        if (action.type === 'create_mission') {
          // Créer mission localement + assigner à l'artisan via API
          const newMission: Mission = {
            id: Date.now().toString(),
            immeuble: action.immeuble || '',
            artisan: action.artisan || '',
            type: action.type_travaux || 'Divers',
            description: action.description || '',
            priorite: action.priorite || 'normale',
            statut: 'en_attente',
            dateCreation: new Date().toISOString().split('T')[0],
            dateIntervention: action.date_intervention || undefined,
          }
          setMissions(prev => [newMission, ...prev])

          // Si date et artisan fournis → assigner sur l'agenda artisan
          if (action.date_intervention && action.artisan_email) {
            fetch('/api/syndic/assign-mission', {
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
            }).then(r => r.json()).then(d => {
              if (d.success) {
                setIaMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `✅ **Mission envoyée sur l'agenda de ${action.artisan}** — Il a reçu une notification et la mission apparaît dans son planning.`,
                }])
                speakResponse(`Mission envoyée sur l'agenda de ${action.artisan}.`)
              }
            }).catch(() => {})
          }

        } else if (action.type === 'assign_mission') {
          // Attribution directe vocale : "Lepore Sebastien, intervention élagage, 10 mars, Parc Corot"
          if (action.artisan_email && action.date_intervention) {
            fetch('/api/syndic/assign-mission', {
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
            }).then(r => r.json()).then(d => {
              const msg = d.artisan_found
                ? `✅ **Mission assignée !**\n\n📅 **${action.type_travaux || action.description}** — ${action.immeuble || action.lieu || ''}\n👤 **${action.artisan}** — ${new Date(action.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n\nNotification envoyée — la mission apparaît sur son agenda.`
                : `⚠️ Mission créée mais **${action.artisan}** n'a pas de compte VitFix. Ajoutez-le dans l'onglet Artisans pour la synchronisation agenda.`
              setIaMessages(prev => [...prev, { role: 'assistant', content: msg }])
              speakResponse(d.artisan_found ? `Mission assignée à ${action.artisan}. Il a reçu la notification.` : `Mission créée. L'artisan n'est pas encore sur VitFix.`)
              // Ajouter à l'état local missions
              setMissions(prev => [{
                id: Date.now().toString(),
                immeuble: action.immeuble || action.lieu || '',
                artisan: action.artisan || '',
                type: action.type_travaux || 'Intervention',
                description: action.description || '',
                priorite: action.priorite || 'normale',
                statut: 'en_attente',
                dateCreation: new Date().toISOString().split('T')[0],
                dateIntervention: action.date_intervention,
              } as Mission, ...prev])
            }).catch(() => {})
          }

        } else if (action.type === 'navigate') {
          if (action.page) setPage(action.page as Page)

        } else if (action.type === 'create_alert') {
          console.info('Max action — create_alert:', action)

        } else if (action.type === 'send_message') {
          // Envoyer message à un artisan via canal dédié
          const targetArtisan = artisans.find(a =>
            a.nom.toLowerCase().includes((action.artisan || '').toLowerCase()) ||
            (action.artisan || '').toLowerCase().includes(a.nom.toLowerCase())
          )
          if (targetArtisan?.artisan_user_id && action.content) {
            fetch('/api/syndic/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaToken}` },
              body: JSON.stringify({
                content: action.content,
                artisan_user_id: targetArtisan.artisan_user_id,
              }),
            }).catch(() => {})
          }

        } else if (action.type === 'create_document') {
          // Afficher le document généré directement dans le chat
          if (action.contenu) {
            setIaMessages(prev => [...prev, {
              role: 'assistant',
              content: `📄 **Document généré — ${action.type_doc || 'Courrier'}**\n\n---\n\n${action.contenu}`,
            }])
          }
        }
      }

      speakResponse(responseText)

    } catch {
      setIaMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Vérifiez votre réseau et réessayez.' }])
    }
    setIaLoading(false)
  }

  const companyName = user?.user_metadata?.company_name || 'Mon Cabinet'
  const userName = user?.user_metadata?.full_name || 'Gestionnaire'
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)

  const userRole = user?.user_metadata?.role || 'syndic'
  const allowedPages = ROLE_PAGES[userRole] || ROLE_PAGES['syndic']

  const allNavItems: { id: Page; emoji: string; label: string; badge?: number }[] = [
    { id: 'accueil', emoji: '📊', label: 'Tableau de bord' },
    { id: 'immeubles', emoji: '🏢', label: 'Immeubles', badge: immeubles.length },
    { id: 'coproprios', emoji: '👥', label: 'Copropriétaires' },
    { id: 'artisans', emoji: '🔧', label: 'Artisans', badge: artisans.filter(a => a.statut === 'actif').length },
    { id: 'missions', emoji: '📋', label: 'Ordres de mission', badge: missions.filter(m => m.statut === 'en_cours').length },
    { id: 'comptabilite_tech', emoji: '📊', label: 'Comptabilité Technique' },
    { id: 'analyse_devis', emoji: '🔍', label: 'Analyse Devis/Factures' },
    { id: 'docs_interventions', emoji: '🗂️', label: 'Documents Interventions' },
    { id: 'planning', emoji: '📅', label: 'Planning' },
    { id: 'reglementaire', emoji: '⚖️', label: 'Calendrier réglementaire' },
    { id: 'rapport', emoji: '📄', label: 'Rapport mensuel' },
    { id: 'documents', emoji: '📁', label: 'Documents (GED)' },
    { id: 'facturation', emoji: '💶', label: 'Facturation' },
    { id: 'alertes', emoji: '🔔', label: 'Alertes', badge: alertes.filter(a => a.urgence === 'haute').length },
    { id: 'emails', emoji: '📧', label: 'Emails Max IA' },
    { id: 'ia', emoji: '🤖', label: 'Assistant Max IA' },
    { id: 'equipe', emoji: '👤', label: 'Mon Équipe' },
    { id: 'parametres', emoji: '⚙️', label: 'Paramètres' },
  ]
  const navItems = allNavItems.filter(item => allowedPages.includes(item.id))

  const totalBudget = immeubles.reduce((a, i) => a + i.budgetAnnuel, 0)
  const totalDepenses = immeubles.reduce((a, i) => a + i.depensesAnnee, 0)

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
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
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
            </h1>
            <p className="text-sm text-gray-500">{companyName} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge alertes urgentes */}
            {alertes.filter(a => a.urgence === 'haute').length > 0 && (
              <button onClick={() => setPage('alertes')} className="relative p-2 text-gray-400 hover:text-red-500 transition" title="Alertes urgentes">
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
                className="relative p-2 text-gray-400 hover:text-purple-600 transition"
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
                      <div className="p-6 text-center text-gray-400 text-sm">Aucune notification</div>
                    ) : notifs.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-purple-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {n.type === 'rapport_intervention' ? '📋' : n.type === 'new_mission' ? '✅' : n.type === 'mission_completed' ? '🏁' : '📣'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                            {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
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
                <StatCard emoji="🔧" label="Artisans actifs" value={artisans.filter(a => a.statut === 'actif').length} sub={`${artisans.filter(a => a.vitfixCertifie).length} certifiés VitFix`} color="yellow" />
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
                <p className="text-xs text-gray-400 mt-1">{Math.round((totalDepenses / totalBudget) * 100)}% consommé</p>
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
                          <p className="text-xs text-gray-400 mt-0.5">{a.date}</p>
                        </div>
                      </div>
                    ))}
                    {alertes.filter(a => a.urgence === 'haute').length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-4">Aucune alerte urgente ✅</p>
                    )}
                  </div>
                </div>

                {/* Missions récentes */}
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
                      <p className="text-xs text-gray-400 mt-1">Budget : {Math.round((i.depensesAnnee / i.budgetAnnuel) * 100)}% consommé</p>
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
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + Ajouter un immeuble
                </button>
              </div>
              {immeubles.map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{i.nom}</h3>
                      <p className="text-gray-500 text-sm">{i.adresse}, {i.codePostal} {i.ville}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition font-medium">Modifier</button>
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
                </div>
              ))}
            </div>
          )}

          {/* ── ARTISANS ── */}
          {page === 'artisans' && !selectedArtisanChat && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">{artisans.length} artisans référencés · {artisans.filter(a => a.vitfixCertifie || a.vitfix_certifie).length} certifiés VitFix</p>
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
                          <button className="flex-1 text-xs border border-gray-200 text-gray-400 py-1.5 rounded-lg cursor-not-allowed" title="Compte VitFix non lié">
                            💬 Pas de compte lié
                          </button>
                        )}
                        <button onClick={() => setShowModalMission(true)} className="flex-1 text-xs bg-purple-600 text-white py-1.5 rounded-lg hover:bg-purple-700 transition">Créer mission</button>
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
                <button onClick={() => { setSelectedArtisanChat(null); setMessages([]) }} className="text-gray-400 hover:text-gray-600 transition">
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
                  <div className="text-center py-12 text-gray-400">
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
                        <p className={`text-xs mt-1 ${isMine ? 'text-purple-200' : 'text-gray-400'}`}>
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
                  {['Toutes', 'Urgentes', 'En cours', 'Terminées'].map(f => (
                    <button key={f} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:border-purple-400 hover:text-purple-600 transition">
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowModalMission(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                  + Nouvelle mission
                </button>
              </div>
              <div className="space-y-3">
                {missions.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 hover:border-purple-200 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PrioriteBadge p={m.priorite} />
                          <Badge statut={m.statut} />
                          <span className="text-xs text-gray-400">#{m.id}</span>
                        </div>
                        <h3 className="font-bold text-gray-900">{m.immeuble}</h3>
                        <p className="text-sm text-gray-600">{m.type} · {m.description}</p>
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
                      </div>
                      <div className="flex gap-2">
                        {m.statut === 'en_attente' && (
                          <button className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition font-medium">Valider</button>
                        )}
                        {m.statut === 'terminee' && (
                          <button className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition font-medium">Voir rapport</button>
                        )}
                        <button className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-200 transition font-medium">Détails</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PLANNING ── */}
          {page === 'planning' && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Planning des interventions — Février 2026</h2>
                <div className="flex gap-2">
                  <button className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">← Précédent</button>
                  <button className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Suivant →</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => {
                  const dayMissions = missions.filter(m => m.dateIntervention === `2026-02-${String(day).padStart(2, '0')}`)
                  return (
                    <div key={day} className={`min-h-16 p-1 rounded-lg border text-xs ${day === 23 ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <span className={`font-semibold block mb-1 ${day === 23 ? 'text-purple-700' : 'text-gray-700'}`}>{day}</span>
                      {dayMissions.map(m => (
                        <div key={m.id} className={`text-xs p-1 rounded mb-0.5 truncate ${m.priorite === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                          {m.type}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold text-gray-900 text-sm">Missions planifiées</h3>
                {missions.filter(m => m.dateIntervention).map(m => (
                  <div key={m.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl text-sm">
                    <span className="font-bold text-purple-600 w-12 flex-shrink-0">
                      {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                    </span>
                    <span className="flex-1 truncate">{m.immeuble} — {m.type}</span>
                    <span className="text-gray-500 flex-shrink-0">{m.artisan}</span>
                    <Badge statut={m.statut} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DOCUMENTS GED ── */}
          {page === 'documents' && <GEDSection immeubles={immeubles} artisans={artisans} />}

          {/* ── FACTURATION ── */}
          {page === 'facturation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard emoji="💶" label="Facturé ce mois" value="16 640 €" sub="4 factures" color="green" />
                <StatCard emoji="⏳" label="En attente paiement" value="4 050 €" sub="2 factures" color="yellow" />
                <StatCard emoji="📋" label="Devis en cours" value="3" sub="12 000 €" color="blue" />
                <StatCard emoji="✅" label="Payé cette année" value="51 240 €" color="green" />
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">Factures récentes</h3>
                <div className="space-y-2">
                  {missions.filter(m => m.montantFacture || m.montantDevis).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{m.immeuble} — {m.type}</p>
                        <p className="text-xs text-gray-500">{m.artisan} · {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString('fr-FR') : m.dateCreation}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{(m.montantFacture || m.montantDevis)?.toLocaleString('fr-FR')} €</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.montantFacture ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {m.montantFacture ? 'Facturé' : 'Devis'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── COPROPRIÉTAIRES ── */}
          {page === 'coproprios' && <CopropriosSection immeubles={immeubles} />}

          {/* ── CALENDRIER RÉGLEMENTAIRE ── */}
          {page === 'reglementaire' && <CalendrierReglementaireSection immeubles={immeubles} />}

          {/* ── RAPPORT MENSUEL ── */}
          {page === 'rapport' && user && (
            <RapportMensuelSection
              immeubles={immeubles}
              missions={missions}
              artisans={artisans}
              syndicId={user.id}
              coproprios={COPROPRIOS_DEMO}
            />
          )}

          {/* ── ALERTES ── */}
          {page === 'alertes' && (
            <div className="space-y-3">
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
                        <p className="text-xs text-gray-400 mt-1">{a.date}</p>
                      </div>
                    </div>
                    <button className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 transition font-medium ml-4 flex-shrink-0">
                      Traiter
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
                      <h2 className="text-white font-bold text-base">Max — Expert VitFix Pro</h2>
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
                      onClick={() => {
                        setIaSpeechEnabled(p => !p)
                        if (iaSpeaking) window.speechSynthesis?.cancel()
                      }}
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

                {/* ── Bandeau vocal actif ── */}
                {iaVoiceActive && (
                  <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center gap-3">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse" style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                    <span className="text-red-700 text-sm font-medium">🎙️ Max vous écoute...</span>
                    <span className="text-red-500 text-xs">{iaInput || 'Parlez maintenant'}</span>
                    <button onClick={() => { iaRecognitionRef.current?.stop(); setIaVoiceActive(false) }} className="ml-auto text-red-500 hover:text-red-700 text-xs">Annuler</button>
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
                        {/* Badge action exécutée */}
                        {msg.action && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                              ⚡ Action exécutée :
                              {msg.action.type === 'create_mission' && ` Mission créée — ${msg.action.immeuble}`}
                              {msg.action.type === 'navigate' && ` Navigation → ${msg.action.page}`}
                              {msg.action.type === 'create_alert' && ` Alerte créée`}
                            </span>
                          </div>
                        )}
                        {/* Bouton lecture voix */}
                        {msg.role === 'assistant' && !iaSpeaking && (
                          <button
                            onClick={() => speakResponse(msg.content)}
                            className="self-start text-xs text-gray-400 hover:text-purple-600 transition flex items-center gap-1 px-1"
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
                          <span className="text-xs text-gray-400 ml-2">Max réfléchit...</span>
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

                {/* ── Input + Micro ── */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    {/* Bouton micro */}
                    {iaVoiceSupported && (
                      <button
                        onClick={startVoiceRecognition}
                        title={iaVoiceActive ? 'Arrêter l\'écoute' : 'Parler à Max'}
                        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition text-lg ${
                          iaVoiceActive
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600'
                        }`}
                      >
                        🎙️
                      </button>
                    )}
                    <div className="flex-1 relative">
                      <input
                        id="ia-input"
                        type="text"
                        value={iaInput}
                        onChange={e => setIaInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !iaLoading && sendIaMessage()}
                        placeholder={iaVoiceActive ? '🎙️ Parlez maintenant...' : 'Posez une question à Max ou dites une action...'}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-sm pr-10"
                        disabled={iaLoading}
                      />
                      {iaInput && (
                        <button onClick={() => setIaInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>
                      )}
                    </div>
                    <button
                      id="ia-send-btn"
                      onClick={() => sendIaMessage()}
                      disabled={iaLoading || !iaInput.trim()}
                      className="flex-shrink-0 w-11 h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center font-bold text-lg transition disabled:opacity-40"
                    >
                      {iaLoading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : '↑'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">
                    {iaVoiceSupported ? '🎙️ Commande vocale disponible · ' : ''}Max a accès à toutes vos données · Les actions sont exécutées en temps réel
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* ── MON ÉQUIPE ── */}
          {page === 'equipe' && user && (
            <EquipeSection cabinetId={user.id} currentUserRole={userRole} />
          )}

          {/* ── COMPTABILITÉ TECHNIQUE ── */}
          {page === 'comptabilite_tech' && user && (
            <ComptabiliteTechSection missions={missions} artisans={artisans} immeubles={immeubles} />
          )}

          {/* ── ANALYSE DEVIS / FACTURES ── */}
          {page === 'analyse_devis' && (
            <AnalyseDevisSection artisans={artisans} setPage={setPage} />
          )}

          {/* ── DOCUMENTS INTERVENTIONS ── */}
          {page === 'docs_interventions' && (
            <DocsInterventionsSection artisans={artisans} setPage={setPage} />
          )}

          {/* ── PARAMÈTRES ── */}
          {page === 'parametres' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Mon cabinet</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du cabinet</label>
                    <input type="text" defaultValue={companyName} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" defaultValue={user?.email} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none" />
                  </div>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-semibold transition">
                    Sauvegarder
                  </button>
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
                {[
                  { label: 'Alertes RC Pro expirées', checked: true },
                  { label: 'Contrôles réglementaires imminents', checked: true },
                  { label: 'Nouvelles missions créées', checked: true },
                  { label: 'Signalements copropriétaires', checked: false },
                  { label: 'Résumé hebdomadaire', checked: true },
                ].map(n => (
                  <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <div className={`w-11 h-6 rounded-full transition-all cursor-pointer ${n.checked ? 'bg-purple-600' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${n.checked ? 'ml-5.5' : 'ml-0.5'}`} style={{ marginLeft: n.checked ? '22px' : '2px' }} />
                    </div>
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
          onAdd={(m) => setMissions(prev => [{ ...m, id: Date.now().toString(), statut: 'en_attente', dateCreation: new Date().toISOString().split('T')[0] } as Mission, ...prev])}
        />
      )}

      {/* ── Modal Ajouter un Artisan ── */}
      {showModalArtisan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">🔧 Ajouter un artisan</h2>
                <button onClick={() => setShowModalArtisan(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
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
                          ? <>✅ Compte VitFix trouvé — <strong>{artisanSearchResult.name}</strong> ({artisanSearchResult.role === 'artisan' ? 'artisan certifié' : artisanSearchResult.role})<br/><span className="text-xs">Il sera synchronisé avec votre cabinet.</span></>
                          : <>⚠️ Aucun compte VitFix. Vous pouvez créer un compte artisan ou l'ajouter sans compte.</>
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
                          Ajouter sans compte VitFix
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
    </div>
  )
}
