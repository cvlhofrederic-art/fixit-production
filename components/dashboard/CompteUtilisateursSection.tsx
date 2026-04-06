'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n/context'
import { toast } from 'sonner'
import {
  type AccessLevel,
  type ProTeamRole,
  PRO_TEAM_ROLES,
  ROLE_LABELS,
  MODULE_LABELS,
  ALL_PRO_MODULES,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
} from '@/lib/permissions'
import type { Artisan } from '@/lib/types'

interface TeamMember {
  id: string
  email: string
  full_name: string
  phone: string
  role: ProTeamRole
  assigned_chantiers: string[]
  invite_sent_at: string | null
  accepted_at: string | null
  last_login_at: string | null
  is_active: boolean
  created_at: string
  permission_overrides: { module_id: string; access_level: string }[]
}

interface Props {
  artisan: Artisan
}

export default function CompteUtilisateursSection({ artisan }: Props) {
  const { t, locale } = useTranslation()
  const isPt = locale === 'pt'

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPermsModal, setShowPermsModal] = useState<TeamMember | null>(null)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    memberRole: 'CONDUCTEUR_TRAVAUX' as ProTeamRole,
  })
  const [inviting, setInviting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editPerms, setEditPerms] = useState<Record<string, AccessLevel>>({})

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch('/api/pro/team', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch {
      toast.error(isPt ? 'Erro ao carregar a equipa' : 'Erreur lors du chargement de l\'équipe')
    } finally {
      setLoading(false)
    }
  }, [getAuthToken, isPt])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error(isPt ? 'Preencha email e nome' : 'Remplissez email et nom')
      return
    }
    setInviting(true)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/pro/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || (isPt ? 'Convite enviado' : 'Invitation envoyée'))
        setShowInviteModal(false)
        setInviteForm({ email: '', full_name: '', phone: '', memberRole: 'CONDUCTEUR_TRAVAUX' })
        fetchMembers()
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error(isPt ? 'Erro de rede' : 'Erreur réseau')
    } finally {
      setInviting(false)
    }
  }

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/pro/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: member.id, is_active: !member.is_active }),
      })
      if (res.ok) {
        toast.success(member.is_active
          ? (isPt ? 'Conta desativada' : 'Compte désactivé')
          : (isPt ? 'Conta reativada' : 'Compte réactivé'))
        fetchMembers()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const handleDelete = async (member: TeamMember) => {
    const confirmMsg = isPt
      ? `Tem a certeza que deseja eliminar ${member.full_name}?`
      : `Supprimer ${member.full_name} de l'équipe ?`
    if (!confirm(confirmMsg)) return
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/pro/team?member_id=${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success(isPt ? 'Membro eliminado' : 'Membre supprimé')
        fetchMembers()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const handleResendInvite = async (member: TeamMember) => {
    // Re-create the invitation (delete + re-invite)
    try {
      const token = await getAuthToken()
      await fetch(`/api/pro/team?member_id=${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const res = await fetch('/api/pro/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: member.email,
          full_name: member.full_name,
          phone: member.phone,
          memberRole: member.role,
        }),
      })
      if (res.ok) {
        toast.success(isPt ? 'Convite reenviado' : 'Invitation renvoyée')
        fetchMembers()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const openPermsModal = (member: TeamMember) => {
    const defaults = getDefaultPermissionsForRole(member.role)
    const effective = getEffectivePermissions(
      member.role,
      member.permission_overrides.map(o => ({
        module_id: o.module_id,
        access_level: o.access_level as AccessLevel,
      }))
    )
    setEditPerms(effective)
    setShowPermsModal(member)
  }

  const handleSavePerms = async () => {
    if (!showPermsModal) return
    setSaving(true)
    try {
      const defaults = getDefaultPermissionsForRole(showPermsModal.role)
      // Only send overrides where the value differs from default
      const overrides = Object.entries(editPerms)
        .filter(([moduleId, level]) => defaults[moduleId] !== level)
        .map(([module_id, access_level]) => ({ module_id, access_level }))

      const token = await getAuthToken()
      const res = await fetch('/api/pro/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: showPermsModal.id, permissions: overrides }),
      })
      if (res.ok) {
        toast.success(isPt ? 'Permissões atualizadas' : 'Permissions mises à jour')
        setShowPermsModal(null)
        fetchMembers()
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (member: TeamMember, newRole: ProTeamRole) => {
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/pro/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: member.id, role: newRole }),
      })
      if (res.ok) {
        toast.success(isPt ? 'Papel atualizado' : 'Rôle mis à jour')
        fetchMembers()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const getRoleLabel = (role: ProTeamRole) => isPt ? ROLE_LABELS[role].pt : ROLE_LABELS[role].fr
  const getModuleLabel = (moduleId: string) => {
    const labels = MODULE_LABELS[moduleId]
    return labels ? (isPt ? labels.pt : labels.fr) : moduleId
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const getStatusBadge = (member: TeamMember) => {
    if (!member.is_active) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: '#fee2e2', color: '#dc2626' }}>{isPt ? 'Desativado' : 'Désactivé'}</span>
    }
    if (!member.accepted_at) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: '#FFF8E1', color: '#F59E0B' }}>{isPt ? 'Pendente' : 'En attente'}</span>
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: '#dcfce7', color: '#16a34a' }}>{isPt ? 'Ativo' : 'Actif'}</span>
  }

  // Filter modules for permission grid — skip gestion_comptes (always GERANT-only)
  const editableModules = ALL_PRO_MODULES.filter(m => m !== 'gestion_comptes' && m !== 'settings')

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <div className="v22-page-header">
          <div className="v22-page-title">👥 {isPt ? 'Gestão de contas' : 'Gestion des comptes'}</div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-sm" style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'A carregar...' : 'Chargement...'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="v22-page-header">
        <div className="v22-page-title">👥 {isPt ? 'Gestão de contas' : 'Gestion des comptes'}</div>
        <div className="v22-page-sub">
          {isPt
            ? `${members.length} membro(s) · Gerir acessos e permissões da equipa`
            : `${members.length} membre(s) · Gérer les accès et permissions de l'équipe`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="v22-btn v22-btn-primary text-xs px-4 py-2"
          >
            + {isPt ? 'Convidar membro' : 'Inviter un membre'}
          </button>
        </div>
        <div className="text-xs" style={{ color: 'var(--v22-text-muted)' }}>
          {isPt ? 'Apenas o gerente pode gerir contas' : 'Seul le gérant peut gérer les comptes'}
        </div>
      </div>

      {/* Members Table */}
      <div className="v22-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--v22-border)', background: 'var(--v22-bg)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Nome' : 'Nom'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>Email</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Papel' : 'Rôle'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Estado' : 'Statut'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Criado' : 'Créé'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--v22-text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt ? 'Nenhum membro na equipa' : 'Aucun membre dans l\'équipe'}
                  </td>
                </tr>
              )}
              {members.map(member => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--v22-border)', opacity: member.is_active ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'var(--v22-yellow)', color: 'var(--v22-text)' }}>
                        {member.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--v22-text)' }}>{member.full_name}</div>
                        {member.phone && <div style={{ color: 'var(--v22-text-muted)', fontSize: 10 }}>{member.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--v22-text-muted)' }}>{member.email}</td>
                  <td className="px-4 py-3">
                    {member.role === 'GERANT' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'var(--v22-yellow)', color: 'var(--v22-text)' }}>
                        {getRoleLabel(member.role)}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as ProTeamRole)}
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--v22-border)', background: 'var(--v22-bg)', color: 'var(--v22-text)' }}
                      >
                        {PRO_TEAM_ROLES.filter(r => r !== 'GERANT').map(r => (
                          <option key={r} value={r}>{getRoleLabel(r)}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(member)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--v22-text-muted)' }}>{formatDate(member.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {member.role !== 'GERANT' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openPermsModal(member)}
                          className="px-2 py-1 rounded text-[10px] font-semibold transition hover:bg-[var(--v22-bg)]"
                          style={{ color: 'var(--v22-yellow)' }}
                          title={isPt ? 'Permissões' : 'Permissions'}
                        >
                          🔐
                        </button>
                        {!member.accepted_at && (
                          <button
                            onClick={() => handleResendInvite(member)}
                            className="px-2 py-1 rounded text-[10px] font-semibold transition hover:bg-[var(--v22-bg)]"
                            style={{ color: 'var(--v22-text-muted)' }}
                            title={isPt ? 'Reenviar convite' : 'Renvoyer invitation'}
                          >
                            📧
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(member)}
                          className="px-2 py-1 rounded text-[10px] font-semibold transition hover:bg-[var(--v22-bg)]"
                          style={{ color: member.is_active ? '#f59e0b' : '#16a34a' }}
                          title={member.is_active ? (isPt ? 'Desativar' : 'Désactiver') : (isPt ? 'Reativar' : 'Réactiver')}
                        >
                          {member.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="px-2 py-1 rounded text-[10px] font-semibold transition hover:bg-[var(--v22-bg)]"
                          style={{ color: '#dc2626' }}
                          title={isPt ? 'Eliminar' : 'Supprimer'}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles Legend */}
      <div className="mt-6 v22-card p-4">
        <h4 className="text-[10px] font-bold uppercase mb-3" style={{ color: 'var(--v22-text-muted)', letterSpacing: '0.3px' }}>
          {isPt ? 'Papéis disponíveis' : 'Rôles disponibles'}
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {PRO_TEAM_ROLES.filter(r => r !== 'GERANT').map(role => (
            <div key={role} className="flex items-center gap-2 text-xs" style={{ color: 'var(--v22-text)' }}>
              <span className="font-semibold">{getRoleLabel(role)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ INVITE MODAL ═══ */}
      {showInviteModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowInviteModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="v22-card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold" style={{ color: 'var(--v22-text)' }}>
                  {isPt ? '👷 Convidar membro' : '👷 Inviter un membre'}
                </h3>
                <button onClick={() => setShowInviteModal(false)} className="text-lg" style={{ color: 'var(--v22-text-muted)' }}>✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt ? 'Nome completo' : 'Nom complet'} *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.full_name}
                    onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded text-xs"
                    style={{ border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', color: 'var(--v22-text)' }}
                    placeholder="Jean Dupont"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--v22-text-muted)' }}>Email *</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded text-xs"
                    style={{ border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', color: 'var(--v22-text)' }}
                    placeholder="jean@entreprise.fr"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt ? 'Telemóvel' : 'Téléphone'}
                  </label>
                  <input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded text-xs"
                    style={{ border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', color: 'var(--v22-text)' }}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt ? 'Papel' : 'Rôle'} *
                  </label>
                  <select
                    value={inviteForm.memberRole}
                    onChange={e => setInviteForm(f => ({ ...f, memberRole: e.target.value as ProTeamRole }))}
                    className="w-full px-3 py-2 rounded text-xs"
                    style={{ border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', color: 'var(--v22-text)' }}
                  >
                    {PRO_TEAM_ROLES.filter(r => r !== 'GERANT').map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt
                      ? 'As permissões padrão são aplicadas segundo o papel. Poderá personalizar depois.'
                      : 'Les permissions par défaut sont appliquées selon le rôle. Personnalisable après création.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 rounded text-xs font-semibold"
                  style={{ border: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}
                >
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="flex-1 v22-btn v22-btn-primary text-xs px-4 py-2"
                >
                  {inviting
                    ? (isPt ? 'A enviar...' : 'Envoi...')
                    : (isPt ? 'Enviar convite' : 'Envoyer l\'invitation')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ PERMISSIONS MODAL ═══ */}
      {showPermsModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowPermsModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="v22-card w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--v22-text)' }}>
                    🔐 {isPt ? 'Permissões' : 'Permissions'} — {showPermsModal.full_name}
                  </h3>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--v22-text-muted)' }}>
                    {isPt ? 'Papel' : 'Rôle'}: {getRoleLabel(showPermsModal.role)}
                  </p>
                </div>
                <button onClick={() => setShowPermsModal(null)} className="text-lg" style={{ color: 'var(--v22-text-muted)' }}>✕</button>
              </div>

              <div className="mb-3 flex items-center gap-3">
                <button
                  onClick={() => setEditPerms(getDefaultPermissionsForRole(showPermsModal.role))}
                  className="text-[10px] font-semibold px-3 py-1 rounded"
                  style={{ border: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}
                >
                  {isPt ? 'Restaurar padrão' : 'Restaurer les défauts'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--v22-border)' }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--v22-text)' }}>Module</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: '#16a34a', width: 90 }}>{isPt ? 'Completo' : 'Complet'}</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: '#f59e0b', width: 90 }}>{isPt ? 'Leitura' : 'Lecture'}</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: '#dc2626', width: 90 }}>{isPt ? 'Nenhum' : 'Aucun'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableModules.map(moduleId => {
                      const defaultLevel = getDefaultPermissionsForRole(showPermsModal.role)[moduleId] || 'NONE'
                      const currentLevel = editPerms[moduleId] || 'NONE'
                      const isOverridden = currentLevel !== defaultLevel

                      return (
                        <tr key={moduleId} style={{
                          borderBottom: '1px solid var(--v22-border)',
                          background: isOverridden ? 'rgba(250, 204, 21, 0.04)' : 'transparent',
                        }}>
                          <td className="px-3 py-2" style={{ color: 'var(--v22-text)' }}>
                            {getModuleLabel(moduleId)}
                            {isOverridden && <span className="ml-1 text-[9px]" style={{ color: 'var(--v22-yellow)' }}>●</span>}
                          </td>
                          {(['FULL', 'READ', 'NONE'] as AccessLevel[]).map(level => (
                            <td key={level} className="text-center px-3 py-2">
                              <input
                                type="radio"
                                name={`perm_${moduleId}`}
                                checked={currentLevel === level}
                                onChange={() => setEditPerms(prev => ({ ...prev, [moduleId]: level }))}
                                className="w-3.5 h-3.5 cursor-pointer"
                                style={{ accentColor: level === 'FULL' ? '#16a34a' : level === 'READ' ? '#f59e0b' : '#dc2626' }}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPermsModal(null)}
                  className="flex-1 px-4 py-2 rounded text-xs font-semibold"
                  style={{ border: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}
                >
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
                <button
                  onClick={handleSavePerms}
                  disabled={saving}
                  className="flex-1 v22-btn v22-btn-primary text-xs px-4 py-2"
                >
                  {saving
                    ? (isPt ? 'A guardar...' : 'Enregistrement...')
                    : (isPt ? 'Guardar permissões' : 'Enregistrer les permissions')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
