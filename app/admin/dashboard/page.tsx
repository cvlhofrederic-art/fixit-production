'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type SubRole = {
  id: string
  label: string
  emoji: string
  desc: string
  role: string
  url?: string
  color: string
  border: string
  bg: string
}

type Dashboard = {
  id: string
  label: string
  emoji: string
  desc: string
  color: string
  border: string
  bg: string
  url: string
  role: string
  roles: string[]
  subRoles?: SubRole[]
}

const DASHBOARDS: Dashboard[] = [
  {
    id: 'syndic',
    label: 'Syndic / Cabinet',
    emoji: '🏢',
    desc: 'Dashboard gestionnaire syndic — immeubles, missions, canal, AG, comptabilité copro',
    color: 'from-purple-600 to-purple-800',
    border: 'border-purple-500',
    bg: 'bg-purple-950/30',
    url: '/syndic/dashboard',
    role: 'syndic',
    roles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_secretaire', 'syndic_tech', 'coproprio', 'locataire'],
    subRoles: [
      {
        id: 'syndic_admin',
        label: 'Administrateur Syndic',
        emoji: '👑',
        desc: 'Accès complet — gestion globale du cabinet, utilisateurs, paramètres',
        role: 'syndic_admin',
        color: 'from-purple-600 to-purple-800',
        border: 'border-purple-400',
        bg: 'bg-purple-950/40',
      },
      {
        id: 'syndic_gestionnaire',
        label: 'Gestionnaire',
        emoji: '📋',
        desc: 'Gestion des immeubles, copropriétaires, assemblées générales',
        role: 'syndic_gestionnaire',
        color: 'from-violet-600 to-purple-700',
        border: 'border-violet-400',
        bg: 'bg-violet-950/30',
      },
      {
        id: 'syndic_tech',
        label: 'Gestionnaire Technique',
        emoji: '🔧',
        desc: 'Missions terrain, interventions, pointage, suivi travaux',
        role: 'syndic_tech',
        color: 'from-blue-600 to-blue-800',
        border: 'border-blue-400',
        bg: 'bg-blue-950/30',
      },
      {
        id: 'syndic_comptable',
        label: 'Comptable',
        emoji: '💼',
        desc: 'Comptabilité copropriété, charges, budgets, appels de fonds',
        role: 'syndic_comptable',
        color: 'from-emerald-600 to-green-700',
        border: 'border-emerald-400',
        bg: 'bg-emerald-950/30',
      },
      {
        id: 'syndic_secretaire',
        label: 'Secrétaire',
        emoji: '📝',
        desc: 'Courrier, convocations AG, procès-verbaux, archivage',
        role: 'syndic_secretaire',
        color: 'from-pink-600 to-rose-700',
        border: 'border-pink-400',
        bg: 'bg-pink-950/30',
      },
      {
        id: 'syndic_base',
        label: 'Syndic (accès complet)',
        emoji: '🏢',
        desc: 'Rôle syndic principal — accès complet identique au gestionnaire principal',
        role: 'syndic',
        color: 'from-indigo-600 to-purple-700',
        border: 'border-indigo-400',
        bg: 'bg-indigo-950/30',
      },
      {
        id: 'coproprio',
        label: 'Copropriétaire',
        emoji: '🏘️',
        desc: 'Dashboard copropriétaire — charges, documents, votes AG, communication syndic',
        role: 'coproprio',
        url: '/coproprietaire/dashboard',
        color: 'from-amber-600 to-orange-700',
        border: 'border-amber-400',
        bg: 'bg-amber-950/30',
      },
      {
        id: 'locataire',
        label: 'Locataire',
        emoji: '🔑',
        desc: 'Dashboard locataire — charges, documents, signalements, communication syndic',
        role: 'locataire',
        url: '/coproprietaire/dashboard',
        color: 'from-cyan-600 to-sky-700',
        border: 'border-cyan-400',
        bg: 'bg-cyan-950/30',
      },
    ],
  },
  {
    id: 'artisan',
    label: 'Artisan / Auto-entrepreneur',
    emoji: '⚡',
    desc: 'Dashboard artisan — agenda, devis, factures, comptabilité, ordres de mission',
    color: 'from-yellow-500 to-amber-600',
    border: 'border-yellow-400',
    bg: 'bg-yellow-950/20',
    url: '/pro/dashboard',
    role: 'artisan',
    roles: ['artisan'],
  },
  {
    id: 'pro_societe',
    label: 'Société BTP',
    emoji: '🏗️',
    desc: 'Dashboard entreprise BTP — équipes, chantiers, Gantt, situations travaux, DC4, DPGF',
    color: 'from-orange-600 to-red-700',
    border: 'border-orange-500',
    bg: 'bg-orange-950/20',
    url: '/pro/dashboard',
    role: 'pro_societe',
    roles: ['pro_societe'],
  },
  {
    id: 'pro_conciergerie',
    label: 'Conciergerie',
    emoji: '🏠',
    desc: 'Dashboard conciergerie — logements, channel manager, check-in/out, planning ménage, RevPAR',
    color: 'from-teal-600 to-cyan-700',
    border: 'border-teal-400',
    bg: 'bg-teal-950/20',
    url: '/pro/dashboard',
    role: 'pro_conciergerie',
    roles: ['pro_conciergerie'],
  },
  {
    id: 'pro_gestionnaire',
    label: 'Gestionnaire Locatif',
    emoji: '📋',
    desc: 'Dashboard gestionnaire locatif — immeubles, ordres de mission, contrats, locataires',
    color: 'from-green-600 to-emerald-700',
    border: 'border-green-400',
    bg: 'bg-green-950/20',
    url: '/pro/dashboard',
    role: 'pro_gestionnaire',
    roles: ['pro_gestionnaire'],
  },
  {
    id: 'client',
    label: 'Client / Particulier',
    emoji: '👤',
    desc: 'Dashboard client — réservations, historique interventions, devis reçus',
    color: 'from-slate-600 to-slate-700',
    border: 'border-slate-400',
    bg: 'bg-slate-950/20',
    url: '/client/dashboard',
    role: 'client',
    roles: ['client'],
  },
  {
    id: 'coproprio',
    label: 'Dashboard Copropriétaire',
    emoji: '🏘️',
    desc: 'Dashboard copropriétaire — charges, documents, votes AG, communication syndic',
    color: 'from-indigo-600 to-indigo-800',
    border: 'border-indigo-400',
    bg: 'bg-indigo-950/20',
    url: '/coproprietaire/dashboard',
    role: 'coproprio',
    roles: ['coproprio'],
  },
]

export default function AdminDashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [navigating, setNavigating] = useState<string | null>(null)
  const [subRoleModal, setSubRoleModal] = useState<Dashboard | null>(null)

  useEffect(() => {
    const check = async () => {
      await supabase.auth.refreshSession()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { window.location.href = '/admin/login'; return }
      const meta = u.user_metadata
      const isSuperAdmin = meta?.role === 'super_admin' || meta?._original_role === 'super_admin'
      if (!isSuperAdmin) { window.location.href = '/admin/login'; return }
      // Restaurer le rôle super_admin si on revient d'un sous-dashboard
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

  const goToDashboard = async (role: string, url: string, id: string) => {
    setNavigating(id)
    setSubRoleModal(null)
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        role,
        _admin_override: true,
        _original_role: 'super_admin',
      }
    })
    await supabase.auth.refreshSession()
    window.location.href = url
  }

  const handleCardClick = (db: Dashboard) => {
    if (db.subRoles && db.subRoles.length > 0) {
      setSubRoleModal(db)
    } else {
      goToDashboard(db.role, db.url, db.id)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">⚡</span>
              <h1 className="text-2xl font-bold text-yellow-400">Vitfix</h1>
              <span className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">SUPER ADMIN</span>
            </div>
            <p className="text-gray-500 text-sm">Bienvenue, {user?.user_metadata?.full_name || user?.email} — Sélectionnez le dashboard à visualiser</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-400 transition border border-gray-700 hover:border-red-700 px-4 py-2 rounded-lg"
          >
            Déconnexion
          </button>
        </div>

        {/* Titre section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Quel dashboard souhaitez-vous voir ?</h2>
          <p className="text-gray-500 text-sm">Cliquez sur un espace pour y accéder avec le rôle correspondant</p>
        </div>

        {/* Grid dashboards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DASHBOARDS.map(db => (
            <button
              key={db.id}
              onClick={() => handleCardClick(db)}
              disabled={navigating !== null}
              className={`relative text-left rounded-2xl border ${db.border} ${db.bg} p-5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden`}
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${db.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

              {navigating === db.id && (
                <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                  <div className="text-white text-sm animate-pulse font-medium">Redirection…</div>
                </div>
              )}

              <div className="text-4xl mb-3">{db.emoji}</div>
              <h3 className="font-bold text-white text-base mb-1.5">{db.label}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{db.desc}</p>

              <div className="mt-4 flex flex-wrap gap-1">
                {db.roles.slice(0, 3).map(r => (
                  <span key={r} className="text-[10px] bg-white/5 border border-white/10 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                    {r}
                  </span>
                ))}
                {db.roles.length > 3 && (
                  <span className="text-[10px] bg-white/5 border border-white/10 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                    +{db.roles.length - 3}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 group-hover:text-gray-300 transition">
                {db.subRoles ? (
                  <>
                    <span className="text-purple-400 font-medium">Choisir un rôle</span>
                    <span className="text-purple-400 group-hover:translate-x-1 transition-transform inline-block">▾</span>
                  </>
                ) : (
                  <>
                    <span>Accéder</span>
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-10 text-center text-xs text-gray-600">
          <p>Le rôle est temporairement modifié pour accéder au dashboard. Reconnectez-vous ici pour changer de vue.</p>
          <p className="mt-1">Email : AdminCvlho@gmail.com · Rôle : super_admin</p>
        </div>
      </div>

      {/* Modal sous-rôles */}
      {subRoleModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSubRoleModal(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{subRoleModal.emoji}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">{subRoleModal.label}</h3>
                  <p className="text-gray-500 text-sm">Choisissez le rôle avec lequel accéder au dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setSubRoleModal(null)}
                className="text-gray-500 hover:text-white transition text-xl font-light w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            {/* Sous-rôles grid */}
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
                      <div className="text-white text-sm animate-pulse font-medium">Redirection…</div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{sub.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm mb-0.5">{sub.label}</div>
                      <div className="text-gray-500 text-xs leading-relaxed">{sub.desc}</div>
                      <div className="mt-2">
                        <span className="text-[10px] bg-white/5 border border-white/10 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                          {sub.role}
                        </span>
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
