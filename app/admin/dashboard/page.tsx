'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'subscriptions' | 'kyc' | 'switcher'

interface Stats {
  users: { total: number; byRole: Record<string, number>; newThisWeek: number }
  artisans: { total: number; active: number }
  clients: { total: number }
  bookings: { thisMonth: number; prevMonth: number; evolution: number; byStatus: Record<string, number> }
  subscriptions: { byPlan: Record<string, number>; byStatus: Record<string, number> }
}

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  last_sign_in_at: string | null
  subscription_plan: string
  subscription_status: string | null
}

interface SubRow {
  id: string
  user_id: string
  user_email: string
  plan: string
  status: string
  stripe_customer_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface KycRow {
  id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  kyc_status: string
  kyc_score: number | null
  kyc_checks: Record<string, unknown> | null
  kyc_verified_at: string | null
  kyc_reviewed_at: string | null
  kyc_rejection_reason: string | null
  kbis_url: string | null
  id_document_url: string | null
  kbis_extracted: Record<string, unknown> | null
  certidao_extracted: Record<string, unknown> | null
  kyc_market: string | null
  created_at: string
}

// ── Role Switcher data (preserved from original) ────────────────────────────

type SubRole = {
  id: string; label: string; emoji: string; desc: string
  role: string; url?: string; color: string; border: string; bg: string
}

type Dashboard = {
  id: string; label: string; emoji: string; desc: string
  color: string; border: string; bg: string; url: string; role: string
  roles: string[]; subRoles?: SubRole[]
}

const DASHBOARDS: Dashboard[] = [
  {
    id: 'syndic', label: 'Syndic / Cabinet', emoji: '🏢',
    desc: 'Dashboard gestionnaire syndic — immeubles, missions, canal, AG, comptabilité copro',
    color: 'from-purple-600 to-purple-800', border: 'border-purple-500', bg: 'bg-purple-950/30',
    url: '/syndic/dashboard', role: 'syndic',
    roles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_secretaire', 'syndic_tech', 'coproprio', 'locataire'],
    subRoles: [
      { id: 'syndic_admin', label: 'Administrateur Syndic', emoji: '👑', desc: 'Accès complet — gestion globale du cabinet, utilisateurs, paramètres', role: 'syndic_admin', color: 'from-purple-600 to-purple-800', border: 'border-purple-400', bg: 'bg-purple-950/40' },
      { id: 'syndic_gestionnaire', label: 'Gestionnaire', emoji: '📋', desc: 'Gestion des immeubles, copropriétaires, assemblées générales', role: 'syndic_gestionnaire', color: 'from-violet-600 to-purple-700', border: 'border-violet-400', bg: 'bg-violet-950/30' },
      { id: 'syndic_tech', label: 'Gestionnaire Technique', emoji: '🔧', desc: 'Missions terrain, interventions, pointage, suivi travaux', role: 'syndic_tech', color: 'from-blue-600 to-blue-800', border: 'border-blue-400', bg: 'bg-blue-950/30' },
      { id: 'syndic_comptable', label: 'Comptable', emoji: '💼', desc: 'Comptabilité copropriété, charges, budgets, appels de fonds', role: 'syndic_comptable', color: 'from-emerald-600 to-green-700', border: 'border-emerald-400', bg: 'bg-emerald-950/30' },
      { id: 'syndic_secretaire', label: 'Secrétaire', emoji: '📝', desc: 'Courrier, convocations AG, procès-verbaux, archivage', role: 'syndic_secretaire', color: 'from-pink-600 to-rose-700', border: 'border-pink-400', bg: 'bg-pink-950/30' },
      { id: 'syndic_base', label: 'Syndic (accès complet)', emoji: '🏢', desc: 'Rôle syndic principal — accès complet identique au gestionnaire principal', role: 'syndic', color: 'from-indigo-600 to-purple-700', border: 'border-indigo-400', bg: 'bg-indigo-950/30' },
      { id: 'coproprio', label: 'Copropriétaire', emoji: '🏘️', desc: 'Dashboard copropriétaire — charges, documents, votes AG, communication syndic', role: 'coproprio', url: '/coproprietaire/dashboard', color: 'from-amber-600 to-orange-700', border: 'border-amber-400', bg: 'bg-amber-950/30' },
      { id: 'locataire', label: 'Locataire', emoji: '🔑', desc: 'Dashboard locataire — charges, documents, signalements, communication syndic', role: 'locataire', url: '/coproprietaire/dashboard', color: 'from-cyan-600 to-sky-700', border: 'border-cyan-400', bg: 'bg-cyan-950/30' },
    ],
  },
  { id: 'artisan', label: 'Artisan / Auto-entrepreneur', emoji: '⚡', desc: 'Dashboard artisan — agenda, devis, factures, comptabilité, ordres de mission', color: 'from-yellow-500 to-amber-600', border: 'border-yellow-400', bg: 'bg-yellow-950/20', url: '/pro/dashboard', role: 'artisan', roles: ['artisan'] },
  { id: 'pro_societe', label: 'Société BTP', emoji: '🏗️', desc: 'Dashboard entreprise BTP — équipes, chantiers, Gantt, situations travaux, DC4, DPGF', color: 'from-orange-600 to-red-700', border: 'border-orange-500', bg: 'bg-orange-950/20', url: '/pro/dashboard', role: 'pro_societe', roles: ['pro_societe'] },
  { id: 'pro_conciergerie', label: 'Conciergerie', emoji: '🏠', desc: 'Dashboard conciergerie — logements, channel manager, check-in/out, planning ménage, RevPAR', color: 'from-teal-600 to-cyan-700', border: 'border-teal-400', bg: 'bg-teal-950/20', url: '/pro/dashboard', role: 'pro_conciergerie', roles: ['pro_conciergerie'] },
  { id: 'pro_gestionnaire', label: 'Gestionnaire Locatif', emoji: '📋', desc: 'Dashboard gestionnaire locatif — immeubles, ordres de mission, contrats, locataires', color: 'from-green-600 to-emerald-700', border: 'border-green-400', bg: 'bg-green-950/20', url: '/pro/dashboard', role: 'pro_gestionnaire', roles: ['pro_gestionnaire'] },
  { id: 'client', label: 'Client / Particulier', emoji: '👤', desc: 'Dashboard client — réservations, historique interventions, devis reçus', color: 'from-slate-600 to-slate-700', border: 'border-slate-400', bg: 'bg-slate-950/20', url: '/client/dashboard', role: 'client', roles: ['client'] },
  { id: 'coproprio', label: 'Dashboard Copropriétaire', emoji: '🏘️', desc: 'Dashboard copropriétaire — charges, documents, votes AG, communication syndic', color: 'from-indigo-600 to-indigo-800', border: 'border-indigo-400', bg: 'bg-indigo-950/20', url: '/coproprietaire/dashboard', role: 'coproprio', roles: ['coproprio'] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ROLE_COLORS: Record<string, string> = {
  artisan: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  client: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  syndic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  super_admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  coproprio: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  pro_societe: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pro_conciergerie: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  pro_gestionnaire: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  canceled: 'bg-red-500/20 text-red-400',
  past_due: 'bg-amber-500/20 text-amber-400',
  trialing: 'bg-blue-500/20 text-blue-400',
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Users
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersPagination, setUsersPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [usersLoading, setUsersLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  // Subscriptions
  const [subs, setSubs] = useState<SubRow[]>([])
  const [subsPagination, setSubsPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [subsLoading, setSubsLoading] = useState(false)
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // KYC
  const [kycRows, setKycRows] = useState<KycRow[]>([])
  const [kycFilter, setKycFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [kycLoading, setKycLoading] = useState(false)
  const [kycRejectModalId, setKycRejectModalId] = useState<string | null>(null)
  const [kycRejectReason, setKycRejectReason] = useState('')

  // Role switcher
  const [navigating, setNavigating] = useState<string | null>(null)
  const [subRoleModal, setSubRoleModal] = useState<Dashboard | null>(null)

  // ── Auth check ──────────────────────────────────────────────────────────

  useEffect(() => {
    const check = async () => {
      await supabase.auth.refreshSession()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/admin/login'; return }
      const meta = u.user_metadata
      const isAdmin = meta?.role === 'super_admin' || meta?._original_role === 'super_admin'
      if (!isAdmin) { window.location.href = '/admin/login'; return }
      if (meta?.role !== 'super_admin') {
        await supabase.auth.updateUser({
          data: { ...meta, role: 'super_admin', _admin_override: false, _original_role: undefined }
        })
        const { data: { user: refreshed } } = await supabase.auth.getUser()
        setUser(refreshed)
      } else {
        setUser(u)
      }
      setLoading(false)
    }
    check()
  }, [])

  // ── API helpers ─────────────────────────────────────────────────────────

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }, [])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (e) {
      console.error('[admin] fetchStats error:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [getToken])

  const fetchUsers = useCallback(async (p = 1) => {
    setUsersLoading(true)
    try {
      const token = await getToken()
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (roleFilter) params.set('role', roleFilter)
      if (searchFilter) params.set('search', searchFilter)
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setUsersPagination(data.pagination)
      }
    } catch (e) {
      console.error('[admin] fetchUsers error:', e)
    } finally {
      setUsersLoading(false)
    }
  }, [getToken, roleFilter, searchFilter])

  const fetchSubs = useCallback(async (p = 1) => {
    setSubsLoading(true)
    try {
      const token = await getToken()
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (planFilter) params.set('plan', planFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/subscriptions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSubs(data.subscriptions)
        setSubsPagination(data.pagination)
      }
    } catch (e) {
      console.error('[admin] fetchSubs error:', e)
    } finally {
      setSubsLoading(false)
    }
  }, [getToken, planFilter, statusFilter])

  const fetchKycRows = useCallback(async (status: 'pending' | 'approved' | 'rejected') => {
    setKycLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc?status=${status}&limit=50`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setKycRows(json.data ?? [])
    } catch {
      setKycRows([])
    } finally {
      setKycLoading(false)
    }
  }, [])

  const handleKycAction = async (artisanId: string, action: 'approve' | 'reject', reason?: string) => {
    const res = await fetch('/api/admin/kyc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artisan_id: artisanId, action, rejection_reason: reason }),
    })
    if (res.ok) {
      setKycRejectModalId(null)
      setKycRejectReason('')
      await fetchKycRows(kycFilter)
    }
  }

  // ── Load data on tab change ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    if (activeTab === 'overview' && !stats) fetchStats()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'subscriptions') fetchSubs()
    if (activeTab === 'kyc') fetchKycRows(kycFilter)
  }, [activeTab, user, stats, fetchStats, fetchUsers, fetchSubs, fetchKycRows, kycFilter])

  // ── Role switcher ─────────────────────────────────────────────────────

  const goToDashboard = async (role: string, url: string, id: string) => {
    setNavigating(id)
    setSubRoleModal(null)
    await supabase.auth.updateUser({
      data: { ...user.user_metadata, role, _admin_override: true, _original_role: 'super_admin' }
    })
    await supabase.auth.refreshSession()
    window.location.href = url
  }

  const handleCardClick = (db: Dashboard) => {
    if (db.subRoles?.length) setSubRoleModal(db)
    else goToDashboard(db.role, db.url, db.id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Chargement...</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { id: 'users', label: 'Utilisateurs', icon: '👥' },
    { id: 'subscriptions', label: 'Abonnements', icon: '💳' },
    { id: 'kyc', label: 'KYC', icon: '🛡️' },
    { id: 'switcher', label: 'Dashboards', icon: '🔄' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h1 className="text-xl font-bold text-yellow-400">VitFix</h1>
            <span className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
              SUPER ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-400 transition border border-gray-700 hover:border-red-700 px-4 py-2 rounded-lg">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── TAB: Overview ────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            {statsLoading ? (
              <div className="text-gray-400 animate-pulse py-20 text-center">Chargement des statistiques...</div>
            ) : stats ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  <KPICard label="Utilisateurs" value={stats.users.total} icon="👥" />
                  <KPICard label="Artisans" value={stats.artisans.total} sub={`${stats.artisans.active} actifs`} icon="⚡" />
                  <KPICard label="Clients" value={stats.clients.total} icon="👤" />
                  <KPICard label="Bookings (mois)" value={stats.bookings.thisMonth} sub={`${stats.bookings.evolution >= 0 ? '+' : ''}${stats.bookings.evolution}%`} subColor={stats.bookings.evolution >= 0 ? 'text-green-400' : 'text-red-400'} icon="📅" />
                  <KPICard label="Inscrits (7j)" value={stats.users.newThisWeek} icon="🆕" />
                  <KPICard label="Abonnés Pro" value={stats.subscriptions.byPlan.pro || 0} icon="💎" />
                </div>

                {/* Details sections */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Bookings by status */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-gray-300 mb-4">Bookings par statut (ce mois)</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.bookings.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm capitalize">{status}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400 rounded-full"
                                style={{ width: `${stats.bookings.thisMonth ? (count / stats.bookings.thisMonth) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-white font-mono text-sm w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Users by role */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-gray-300 mb-4">Utilisateurs par rôle</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.users.byRole)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 8)
                        .map(([role, count]) => (
                          <div key={role} className="flex items-center justify-between">
                            <span className={`text-sm px-2 py-0.5 rounded border ${ROLE_COLORS[role] || 'bg-gray-700/30 text-gray-400 border-gray-600'}`}>
                              {role}
                            </span>
                            <span className="text-white font-mono text-sm">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Subscriptions by plan */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-gray-300 mb-4">Abonnements par plan</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.subscriptions.byPlan).map(([plan, count]) => (
                        <div key={plan} className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm capitalize">{plan}</span>
                          <span className="text-white font-mono text-sm">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subscriptions by status */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-gray-300 mb-4">Abonnements par statut</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.subscriptions.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className={`text-sm px-2 py-0.5 rounded ${STATUS_COLORS[status] || 'bg-gray-700/30 text-gray-400'}`}>
                            {status}
                          </span>
                          <span className="text-white font-mono text-sm">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Refresh */}
                <div className="mt-6 text-center">
                  <button onClick={fetchStats} className="text-xs text-gray-500 hover:text-gray-300 transition">
                    Rafraîchir les stats
                  </button>
                </div>
              </>
            ) : (
              <div className="text-gray-500 py-20 text-center">Erreur de chargement</div>
            )}
          </div>
        )}

        {/* ── TAB: Users ──────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Rechercher par email ou nom..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUsers(1)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none w-64"
              />
              <select
                value={roleFilter}
                onChange={e => { setRoleFilter(e.target.value); setTimeout(() => fetchUsers(1), 0) }}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              >
                <option value="">Tous les rôles</option>
                <option value="artisan">Artisan</option>
                <option value="client">Client</option>
                <option value="syndic">Syndic</option>
                <option value="coproprio">Copropriétaire</option>
                <option value="pro_societe">Société BTP</option>
                <option value="pro_conciergerie">Conciergerie</option>
                <option value="pro_gestionnaire">Gestionnaire</option>
              </select>
              <button
                onClick={() => fetchUsers(1)}
                className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-4 py-2 rounded-lg text-sm hover:bg-yellow-400/20 transition"
              >
                Rechercher
              </button>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {usersLoading ? (
                <div className="py-20 text-center text-gray-400 animate-pulse">Chargement...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400">
                        <th className="text-left px-4 py-3 font-medium">Email</th>
                        <th className="text-left px-4 py-3 font-medium">Nom</th>
                        <th className="text-left px-4 py-3 font-medium">Rôle</th>
                        <th className="text-left px-4 py-3 font-medium">Inscription</th>
                        <th className="text-left px-4 py-3 font-medium">Dernière connexion</th>
                        <th className="text-left px-4 py-3 font-medium">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                          <td className="px-4 py-3 text-white font-mono text-xs">{u.email}</td>
                          <td className="px-4 py-3 text-gray-300">{u.full_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[u.role] || 'bg-gray-700/30 text-gray-400 border-gray-600'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(u.last_sign_in_at)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-400 capitalize">{u.subscription_plan}</span>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Aucun utilisateur trouvé</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {usersPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">{usersPagination.total} utilisateurs</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchUsers(usersPagination.page - 1)}
                      disabled={usersPagination.page <= 1}
                      className="px-3 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 transition"
                    >
                      Précédent
                    </button>
                    <span className="px-3 py-1 text-xs text-gray-400">
                      {usersPagination.page} / {usersPagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchUsers(usersPagination.page + 1)}
                      disabled={usersPagination.page >= usersPagination.totalPages}
                      className="px-3 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 transition"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Subscriptions ──────────────────────────────────────── */}
        {activeTab === 'subscriptions' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={planFilter}
                onChange={e => { setPlanFilter(e.target.value); setTimeout(() => fetchSubs(1), 0) }}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              >
                <option value="">Tous les plans</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setTimeout(() => fetchSubs(1), 0) }}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="active">Active</option>
                <option value="canceled">Canceled</option>
                <option value="past_due">Past due</option>
                <option value="trialing">Trialing</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {subsLoading ? (
                <div className="py-20 text-center text-gray-400 animate-pulse">Chargement...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400">
                        <th className="text-left px-4 py-3 font-medium">Email</th>
                        <th className="text-left px-4 py-3 font-medium">Plan</th>
                        <th className="text-left px-4 py-3 font-medium">Statut</th>
                        <th className="text-left px-4 py-3 font-medium">Stripe ID</th>
                        <th className="text-left px-4 py-3 font-medium">Fin période</th>
                        <th className="text-left px-4 py-3 font-medium">Annulation prévue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map(s => (
                        <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                          <td className="px-4 py-3 text-white font-mono text-xs">{s.user_email || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs capitalize text-gray-300">{s.plan}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[s.status] || 'bg-gray-700/30 text-gray-400'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.stripe_customer_id || '-'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.current_period_end)}</td>
                          <td className="px-4 py-3">
                            {s.cancel_at_period_end ? (
                              <span className="text-xs text-red-400">Oui</span>
                            ) : (
                              <span className="text-xs text-gray-500">Non</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {subs.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Aucun abonnement trouvé</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {subsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">{subsPagination.total} abonnements</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchSubs(subsPagination.page - 1)}
                      disabled={subsPagination.page <= 1}
                      className="px-3 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 transition"
                    >
                      Précédent
                    </button>
                    <span className="px-3 py-1 text-xs text-gray-400">
                      {subsPagination.page} / {subsPagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchSubs(subsPagination.page + 1)}
                      disabled={subsPagination.page >= subsPagination.totalPages}
                      className="px-3 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 transition"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: KYC Review ─────────────────────────────────────────── */}
        {activeTab === 'kyc' && (
          <div className="space-y-4">
            {/* Header avec filtres */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-white">Vérifications KYC</h3>
              <div className="flex gap-2">
                {(['pending', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setKycFilter(s); fetchKycRows(s) }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      kycFilter === s
                        ? s === 'pending' ? 'bg-yellow-600 text-white'
                          : s === 'approved' ? 'bg-green-600 text-white'
                          : 'bg-red-700 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {s === 'pending' ? '⏳ En attente' : s === 'approved' ? '✅ Approuvés' : '❌ Rejetés'}
                  </button>
                ))}
              </div>
            </div>

            {kycLoading && <p className="text-gray-400 text-sm">Chargement...</p>}
            {!kycLoading && kycRows.length === 0 && (
              <p className="text-gray-500 text-sm italic">Aucun dossier {kycFilter === 'pending' ? 'en attente' : kycFilter === 'approved' ? 'approuvé' : 'rejeté'}.</p>
            )}

            {kycRows.map(row => (
              <div key={row.id} className="bg-gray-800/60 rounded-xl border border-gray-700 p-5 space-y-3">
                {/* Entête : infos société + score */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{row.company_name ?? '—'}</p>
                    <p className="text-sm text-gray-400">{row.first_name} {row.last_name} — {row.siret ?? row.kyc_market}</p>
                    <p className="text-xs text-gray-500">{row.email} {row.phone && `· ${row.phone}`}</p>
                    {row.kyc_market && (
                      <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-mono ${
                        row.kyc_market === 'pt_artisan' ? 'bg-green-900 text-green-300' :
                        row.kyc_market === 'fr_btp' ? 'bg-orange-900 text-orange-300' :
                        'bg-blue-900 text-blue-300'
                      }`}>{row.kyc_market}</span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {row.kyc_score !== null ? (
                      <span className={`text-3xl font-black ${
                        row.kyc_score >= 80 ? 'text-green-400' :
                        row.kyc_score >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>{row.kyc_score}<span className="text-base font-normal text-gray-500">/100</span></span>
                    ) : (
                      <span className="text-gray-600 text-sm">Non scoré</span>
                    )}
                  </div>
                </div>

                {/* Détails des checks */}
                {row.kyc_checks && (
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {Object.entries(row.kyc_checks as Record<string, boolean | number>).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                        typeof val === 'boolean' ? (val ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300') :
                        (val as number) >= 70 ? 'bg-green-900/40 text-green-300' :
                        (val as number) >= 40 ? 'bg-yellow-900/40 text-yellow-300' :
                        'bg-red-900/40 text-red-300'
                      }`}>
                        <span>{typeof val === 'boolean' ? (val ? '✓' : '✗') : `${val}%`}</span>
                        <span className="font-mono">{key}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Données extraites du document entreprise */}
                {(row.kbis_extracted || row.certidao_extracted) && (() => {
                  const extracted = (row.kbis_extracted || row.certidao_extracted) as Record<string, string | null>
                  const label = row.kyc_market === 'pt_artisan' ? 'Certidão extraite' : 'KBIS extrait'
                  return (
                    <div className="bg-gray-900/60 rounded-lg p-3 text-xs space-y-1 text-gray-300">
                      <p className="font-medium text-gray-200 mb-2">{label} :</p>
                      {extracted.denomination && <p><span className="text-gray-500">Dénomination :</span> {extracted.denomination}</p>}
                      {extracted.representant && <p><span className="text-gray-500">{row.kyc_market === 'pt_artisan' ? 'Gerente' : 'Gérant'} :</span> {extracted.representant}</p>}
                      {extracted.identifiant && <p><span className="text-gray-500">{row.kyc_market === 'pt_artisan' ? 'NIF' : 'SIRET'} extrait :</span> {extracted.identifiant}</p>}
                    </div>
                  )
                })()}

                {/* Liens documents */}
                <div className="flex flex-wrap gap-2">
                  {row.kbis_url && (
                    <a href={row.kbis_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-300 rounded-lg text-xs transition-colors">
                      📄 {row.kyc_market === 'pt_artisan' ? 'Certidão' : 'KBIS'}
                    </a>
                  )}
                  {row.id_document_url && (
                    <a href={row.id_document_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-300 rounded-lg text-xs transition-colors">
                      🪪 {row.kyc_market === 'pt_artisan' ? 'Cartão de Cidadão' : 'CNI'}
                    </a>
                  )}
                </div>

                {/* Motif de rejet existant */}
                {row.kyc_rejection_reason && (
                  <p className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">Rejet : {row.kyc_rejection_reason}</p>
                )}

                {/* Actions pour les dossiers pending */}
                {row.kyc_status === 'pending' && (
                  <div className="flex gap-2 pt-1 border-t border-gray-700">
                    <button
                      onClick={() => handleKycAction(row.id, 'approve')}
                      className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ✅ Approuver
                    </button>
                    <button
                      onClick={() => setKycRejectModalId(row.id)}
                      className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ❌ Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Modal rejet */}
            {kycRejectModalId && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-700">
                  <h4 className="text-white font-semibold text-lg">Motif du rejet</h4>
                  <p className="text-gray-400 text-sm">Ce motif sera envoyé par email à l&apos;artisan.</p>
                  <textarea
                    value={kycRejectReason}
                    onChange={e => setKycRejectReason(e.target.value)}
                    placeholder="Ex: KBIS illisible, nom gérant ne correspond pas à la CNI, SIRET radié..."
                    className="w-full bg-gray-700 text-white rounded-lg p-3 text-sm resize-none h-28 border border-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setKycRejectModalId(null); setKycRejectReason('') }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleKycAction(kycRejectModalId, 'reject', kycRejectReason)}
                      disabled={!kycRejectReason.trim()}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Confirmer le rejet
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Role Switcher (original) ──────────────────────────── */}
        {activeTab === 'switcher' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Quel dashboard souhaitez-vous voir ?</h2>
              <p className="text-gray-500 text-sm">Cliquez sur un espace pour y accéder avec le rôle correspondant</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {DASHBOARDS.map(db => (
                <button
                  key={db.id}
                  onClick={() => handleCardClick(db)}
                  disabled={navigating !== null}
                  className={`relative text-left rounded-2xl border ${db.border} ${db.bg} p-5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${db.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  {navigating === db.id && (
                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                      <div className="text-white text-sm animate-pulse font-medium">Redirection...</div>
                    </div>
                  )}
                  <div className="text-4xl mb-3">{db.emoji}</div>
                  <h3 className="font-bold text-white text-base mb-1.5">{db.label}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{db.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {db.roles.slice(0, 3).map(r => (
                      <span key={r} className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-full font-mono">{r}</span>
                    ))}
                    {db.roles.length > 3 && (
                      <span className="text-[10px] bg-white/5 border border-white/10 text-gray-500 px-2 py-0.5 rounded-full font-mono">+{db.roles.length - 3}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 group-hover:text-gray-300 transition">
                    {db.subRoles ? (
                      <><span className="text-purple-400 font-medium">Choisir un rôle</span><span className="text-purple-400 group-hover:translate-x-1 transition-transform inline-block">▾</span></>
                    ) : (
                      <><span>Accéder</span><span className="group-hover:translate-x-1 transition-transform inline-block">→</span></>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sub-role modal ──────────────────────────────────────────────── */}
      {subRoleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSubRoleModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{subRoleModal.emoji}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">{subRoleModal.label}</h3>
                  <p className="text-gray-400 text-sm">Choisissez le rôle avec lequel accéder au dashboard</p>
                </div>
              </div>
              <button onClick={() => setSubRoleModal(null)} className="text-gray-500 hover:text-white transition text-xl font-light w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subRoleModal.subRoles!.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => goToDashboard(sub.role, sub.url ?? subRoleModal.url, sub.id)}
                  disabled={navigating !== null}
                  className={`relative text-left rounded-xl border ${sub.border} ${sub.bg} p-4 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${sub.color} opacity-0 group-hover:opacity-10 transition-opacity rounded-xl`} />
                  {navigating === sub.id && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                      <div className="text-white text-sm animate-pulse font-medium">Redirection...</div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{sub.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm mb-0.5">{sub.label}</div>
                      <div className="text-gray-400 text-xs leading-relaxed">{sub.desc}</div>
                      <div className="mt-2">
                        <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-full font-mono">{sub.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 group-hover:text-gray-300 transition">
                    <span>Accéder avec ce rôle</span>
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Card component ────────────────────────────────────────────────────

function KPICard({ label, value, sub, subColor, icon }: {
  label: string; value: number; sub?: string; subColor?: string; icon: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {sub && <span className={`text-xs font-mono ${subColor || 'text-gray-400'}`}>{sub}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString('fr-FR')}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
