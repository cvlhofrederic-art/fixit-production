'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { TeamMember } from '../types'
import { ROLE_LABELS_TEAM, ROLE_COLORS, ROLE_EMOJIS_TEAM, getRoleLabel } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

// ── Catégories pour le sélecteur de modules ──
const getModuleCategories = (locale: string) => [
  { key: 'gestion', label: locale === 'pt' ? 'Gestão' : 'Gestion' },
  { key: 'patrimoine', label: locale === 'pt' ? 'Património' : 'Patrimoine' },
  { key: 'technique', label: locale === 'pt' ? 'Técnico' : 'Technique' },
  { key: 'suivi', label: locale === 'pt' ? 'Acompanhamento' : 'Suivi' },
  { key: 'copropriete', label: locale === 'pt' ? 'Condomínio' : 'Copropriété' },
  { key: 'obrigacoes', label: locale === 'pt' ? 'Obrigações Legais' : 'Obligations PT' },
  { key: 'outils_ia', label: locale === 'pt' ? 'Ferramentas IA' : 'Outils IA' },
  { key: 'compte', label: locale === 'pt' ? 'Conta' : 'Compte' },
]

interface ModuleInfo {
  key: string
  label: string
  emoji: string
  category: string
}

interface EquipeSectionProps {
  cabinetId: string
  currentUserRole: string
  rolePages?: Record<string, string[]>
  modulesList?: ModuleInfo[]
}

// ── Composant sélecteur de modules réutilisable ──
function ModuleSelector({
  modules,
  selectedModules,
  onToggle,
  onSelectAll,
  onReset,
  roleLabel,
  locale,
}: {
  modules: ModuleInfo[]
  selectedModules: string[]
  onToggle: (key: string) => void
  onSelectAll: () => void
  onReset: () => void
  roleLabel: string
  locale: string
}) {
  const categories = getModuleCategories(locale)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {selectedModules.length} {locale === 'pt' ? 'módulo(s) ativado(s)' : `module${selectedModules.length > 1 ? 's' : ''} activé${selectedModules.length > 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onSelectAll} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
            {locale === 'pt' ? 'Ativar tudo' : 'Tout activer'}
          </button>
          <button type="button" onClick={onReset} className="text-xs text-[#C9A84C] hover:text-[#B8963D] hover:underline">
            {locale === 'pt' ? `Padrões ${roleLabel}` : `Défauts ${roleLabel}`}
          </button>
        </div>
      </div>
      {categories.map(cat => {
        const catModules = modules.filter(m => m.category === cat.key)
        if (catModules.length === 0) return null
        return (
          <div key={cat.key}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{cat.label}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {catModules.map(mod => {
                const isChecked = selectedModules.includes(mod.key)
                return (
                  <label
                    key={mod.key}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-sm border ${
                      isChecked
                        ? 'bg-[#0D1B2E] text-white border-[#0D1B2E]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#C9A84C] hover:bg-[#F7F4EE]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(mod.key)}
                      className="sr-only"
                    />
                    <span className="text-sm">{mod.emoji}</span>
                    <span className="truncate text-xs font-medium">{mod.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function EquipeSection({ cabinetId, currentUserRole, rolePages, modulesList }: EquipeSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'syndic_tech' })
  const [formModules, setFormModules] = useState<string[]>([])
  const [showFormModules, setShowFormModules] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Modal modules pour un membre existant
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editModules, setEditModules] = useState<string[]>([])
  const [savingModules, setSavingModules] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const isAdmin = currentUserRole === 'syndic' || currentUserRole === 'syndic_admin'

  // Initialiser formModules quand le rôle du formulaire change
  useEffect(() => {
    if (rolePages) {
      setFormModules([...(rolePages[form.role] || [])])
    }
  }, [form.role, rolePages])

  // Click-outside pour fermer la modal
  useEffect(() => {
    if (!editingMember) return
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setEditingMember(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingMember])

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
      const payload: Record<string, unknown> = {
        email: form.email,
        full_name: form.full_name,
        memberRole: form.role,
      }
      // Si les modules ont été personnalisés (différents des défauts), les envoyer
      const defaults = rolePages?.[form.role] || []
      const isCustom = formModules.length !== defaults.length || formModules.some(m => !defaults.includes(m))
      if (isCustom) {
        payload.customModules = formModules
      }
      const res = await fetch('/api/syndic/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('syndicDash.common.loading')); return }
      setInviteUrl(data.invite_url)
      setForm({ email: '', full_name: '', role: 'syndic_tech' })
      setShowForm(false)
      setShowFormModules(false)
      fetchTeam()
    } catch { setError(t('syndicDash.equipe.networkError')) }
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
    if (!confirm(t('syndicDash.equipe.confirmDelete'))) return
    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    await fetch(`/api/syndic/team?member_id=${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    fetchTeam()
  }

  const openModuleEditor = (member: TeamMember) => {
    setEditingMember(member)
    // Si le membre a des modules persos (non vides), les utiliser ; sinon les défauts du rôle
    const hasCustom = Array.isArray(member.custom_modules) && member.custom_modules.length > 0
    const current = hasCustom ? member.custom_modules! : (rolePages?.[member.role] || [])
    setEditModules([...current])
  }

  const handleSaveModules = async () => {
    if (!editingMember) return
    setSavingModules(true)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      // Si identique aux défauts du rôle → envoyer null pour réinitialiser
      const defaults = rolePages?.[editingMember.role] || []
      const isDefault = editModules.length === defaults.length && editModules.every(m => defaults.includes(m))
      await fetch('/api/syndic/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          member_id: editingMember.id,
          customModules: isDefault ? null : editModules,
        }),
      })
      setEditingMember(null)
      fetchTeam()
    } catch (e) {
      console.error(e)
    } finally {
      setSavingModules(false)
    }
  }

  const toggleFormModule = (key: string) => {
    setFormModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const toggleEditModule = (key: string) => {
    setEditModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2E]">👥 {t('syndicDash.equipe.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} {t('syndicDash.equipe.membersInCabinet')}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0D1B2E] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#152338] transition flex items-center gap-2"
          >
            + {t('syndicDash.equipe.inviteMember')}
          </button>
        )}
      </div>

      {/* Lien d'invitation */}
      {inviteUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">✅ {t('syndicDash.equipe.inviteCreated')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-xs text-gray-700 truncate">{inviteUrl}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success(t('syndicDash.equipe.linkCopied')) }}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition"
            >
              {t('syndicDash.common.copy')}
            </button>
          </div>
          <button onClick={() => setInviteUrl(null)} className="text-xs text-gray-500 mt-2 hover:text-gray-600">{t('syndicDash.common.close')}</button>
        </div>
      )}

      {/* Formulaire invitation */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-[#0D1B2E] mb-4">{t('syndicDash.equipe.inviteNewMember')}</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.equipe.fullName')}</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jean Dupont"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C9A84C] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.admin.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jean@cabinet.fr"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C9A84C] focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('syndicDash.equipe.role')}</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C9A84C] focus:outline-none"
              >
                {Object.entries(ROLE_LABELS_TEAM).map(([val]) => (
                  <option key={val} value={val}>{ROLE_EMOJIS_TEAM[val]} {getRoleLabel(val, locale)}</option>
                ))}
              </select>
            </div>

            {/* ── Sélecteur de modules pour l'invitation ── */}
            {modulesList && modulesList.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFormModules(!showFormModules)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F7F4EE] hover:bg-[#EDE8DD] transition text-sm font-semibold text-[#0D1B2E]"
                >
                  <span>🧩 {locale === 'pt' ? `Configurar módulos (${formModules.length} ativados)` : `Configurer les modules (${formModules.length} activés)`}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: showFormModules ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {showFormModules && (
                  <div className="p-4 border-t border-gray-200">
                    <ModuleSelector
                      modules={modulesList}
                      selectedModules={formModules}
                      onToggle={toggleFormModule}
                      onSelectAll={() => setFormModules(modulesList.map(m => m.key))}
                      onReset={() => setFormModules([...(rolePages?.[form.role] || [])])}
                      roleLabel={getRoleLabel(form.role, locale)}
                      locale={locale}
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#0D1B2E] text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-[#152338] transition disabled:opacity-60"
              >
                {submitting ? t('syndicDash.equipe.sending') : t('syndicDash.equipe.createInvitation')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setShowFormModules(false) }} className="px-6 py-2.5 rounded-xl border border-gray-200 hover:bg-[#F7F4EE] transition">
                {t('syndicDash.common.cancel')}
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
            <p className="text-gray-500 font-medium">{t('syndicDash.equipe.noMembersYet')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('syndicDash.equipe.inviteToCollaborate')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F7F4EE] border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('syndicDash.equipe.member')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('syndicDash.equipe.role')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{locale === 'pt' ? 'Módulos' : 'Modules'}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('syndicDash.common.status')}</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => {
                // custom_modules = array avec contenu → custom ; null ou [] → défauts du rôle
                const hasCustom = Array.isArray(m.custom_modules) && m.custom_modules.length > 0
                const roleDefault = rolePages?.[m.role]?.length || 0
                const moduleCount = hasCustom ? m.custom_modules!.length : roleDefault
                return (
                  <tr key={m.id} className="hover:bg-[#F7F4EE] transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#F7F4EE] rounded-xl flex items-center justify-center text-lg">
                          {ROLE_EMOJIS_TEAM[m.role] || '👤'}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0D1B2E] text-sm">{m.full_name}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[m.role] || 'bg-[#F7F4EE] text-gray-700'}`}>
                        {getRoleLabel(m.role, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {isAdmin && modulesList ? (
                        <button
                          onClick={() => openModuleEditor(m)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                            hasCustom
                              ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 hover:bg-[#C9A84C]/20'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          🧩 {moduleCount}{modulesList.length > 0 ? `/${modulesList.length}` : ''}
                          {hasCustom && <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full" />}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">{moduleCount} {locale === 'pt' ? 'módulos' : 'modules'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {m.accepted_at ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> {t('syndicDash.equipe.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" /> {t('syndicDash.equipe.pending')}
                        </span>
                      )}
                      {!m.is_active && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-500 bg-[#F7F4EE] px-2.5 py-1 rounded-full">
                          {t('syndicDash.equipe.suspended')}
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
                                toast.success(t('syndicDash.equipe.linkCopied'))
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                            >
                              {t('syndicDash.equipe.copyLink')}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(m)}
                            className={`text-xs px-2 py-1 rounded border transition ${m.is_active ? 'text-[#C9A84C] border-orange-200 hover:bg-orange-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                          >
                            {m.is_active ? t('syndicDash.equipe.suspend') : t('syndicDash.equipe.reactivate')}
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition"
                          >
                            {t('syndicDash.common.delete')}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Description des rôles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D1B2E] mb-4">{t('syndicDash.equipe.roleDescriptions')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { role: 'syndic_admin', descKey: 'syndicDash.equipe.roleDesc.admin' },
            { role: 'syndic_tech', descKey: 'syndicDash.equipe.roleDesc.tech' },
            { role: 'syndic_secretaire', descKey: 'syndicDash.equipe.roleDesc.secretary' },
            { role: 'syndic_gestionnaire', descKey: 'syndicDash.equipe.roleDesc.manager' },
            { role: 'syndic_comptable', descKey: 'syndicDash.equipe.roleDesc.accountant' },
            { role: 'syndic_juriste', descKey: 'syndicDash.equipe.roleDesc.lawyer' },
          ].map(({ role, descKey }) => (
            <div key={role} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
              <span className="text-xl">{ROLE_EMOJIS_TEAM[role]}</span>
              <div>
                <p className="font-semibold text-sm text-[#0D1B2E]">{getRoleLabel(role, locale)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal d'édition des modules d'un membre ── */}
      {editingMember && modulesList && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-[#0D1B2E] text-lg">
                  🧩 {locale === 'pt' ? `Módulos de ${editingMember.full_name}` : `Modules de ${editingMember.full_name}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ROLE_EMOJIS_TEAM[editingMember.role]} {getRoleLabel(editingMember.role, locale)}
                  {Array.isArray(editingMember.custom_modules) && editingMember.custom_modules.length > 0 && (
                    <span className="ml-2 text-[#C9A84C]">• {locale === 'pt' ? 'Personalizado' : 'Personnalisé'}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Body - scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
              <ModuleSelector
                modules={modulesList}
                selectedModules={editModules}
                onToggle={toggleEditModule}
                onSelectAll={() => setEditModules(modulesList.map(m => m.key))}
                onReset={() => setEditModules([...(rolePages?.[editingMember.role] || [])])}
                roleLabel={getRoleLabel(editingMember.role, locale)}
                locale={locale}
              />
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm hover:bg-[#F7F4EE] transition"
              >
                {locale === 'pt' ? 'Cancelar' : 'Annuler'}
              </button>
              <button
                onClick={handleSaveModules}
                disabled={savingModules}
                className="bg-[#0D1B2E] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#152338] transition disabled:opacity-60 flex items-center gap-2"
              >
                {savingModules ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === 'pt' ? 'A guardar...' : 'Enregistrement...'}
                  </>
                ) : (
                  locale === 'pt' ? 'Guardar' : 'Enregistrer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
