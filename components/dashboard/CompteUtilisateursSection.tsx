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

  // Role badge colors matching HTML v5 template
  const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
    GERANT: { bg: '#FFF8E1', color: '#F57F17' },
    CONDUCTEUR_TRAVAUX: { bg: '#E3F2FD', color: '#1565C0' },
    CHEF_CHANTIER: { bg: '#E3F2FD', color: '#1565C0' },
    SECRETAIRE: { bg: '#F3E5F5', color: '#7B1FA2' },
    COMPTABLE: { bg: '#E8F5E9', color: '#2E7D32' },
    OUVRIER: { bg: '#F5F5F5', color: '#757575' },
  }
  const AVATAR_COLORS = ['#F57C00', '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#4CAF50', '#EF5350', '#26C6DA']

  const getRelativeLogin = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return isPt ? 'Agora' : "Aujourd'hui"
    const hours = Math.floor(mins / 60)
    if (hours < 24) return isPt ? `Hoje ${new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : `Aujourd'hui ${new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    const days = Math.floor(hours / 24)
    if (days === 1) return isPt ? 'Ontem' : 'Hier'
    return new Date(dateStr).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className="v5-fade">
        <div className="v5-pg-t"><h1>{isPt ? 'Contas de utilizadores' : 'Comptes utilisateurs'}</h1></div>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#999', fontSize: 12 }}>{isPt ? 'A carregar...' : 'Chargement...'}</div>
      </div>
    )
  }

  return (
    <div className="v5-fade">
      {/* Header */}
      <div className="v5-pg-t">
        <h1>{isPt ? 'Contas de utilizadores' : 'Comptes utilisateurs'}</h1>
        <p>{isPt
          ? `Gerir os acessos da sua equipa — ${members.length} contas ativas / 20 max`
          : `Gérez les accès de votre équipe — ${members.length} comptes actifs / 20 max`}</p>
      </div>

      {/* Search + Create */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <input className="v5-search-in" placeholder={isPt ? 'Pesquisar um utilizador...' : 'Rechercher un utilisateur...'} style={{ maxWidth: 300 }} />
        <button onClick={() => setShowInviteModal(true)} className="v5-btn v5-btn-p">
          + {isPt ? 'Criar uma conta' : 'Créer un compte'}
        </button>
      </div>

      {/* Members Table */}
      <div className="v5-card" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{isPt ? 'Utilizador' : 'Utilisateur'}</th>
              <th>Email</th>
              <th>{isPt ? 'Papel' : 'Rôle'}</th>
              <th>{isPt ? 'Obras' : 'Chantiers'}</th>
              <th>{isPt ? 'Estado' : 'Statut'}</th>
              <th>{isPt ? 'Última conexão' : 'Dernière connexion'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>{isPt ? 'Nenhum membro na equipa' : 'Aucun membre dans l\'équipe'}</td></tr>
            )}
            {members.map((member, idx) => {
              const initials = member.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
              const badgeStyle = ROLE_BADGE[member.role] || ROLE_BADGE.OUVRIER
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
              return (
                <tr key={member.id} style={{ opacity: member.is_active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                      {member.full_name}
                    </div>
                  </td>
                  <td>{member.email}</td>
                  <td><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: badgeStyle.bg, color: badgeStyle.color }}>{ROLE_LABELS[member.role]?.[isPt ? 'pt' : 'fr'] || member.role}</span></td>
                  <td>{member.role === 'GERANT' ? (isPt ? 'Todos' : 'Tous') : (member.assigned_chantiers?.join(', ') || '—')}</td>
                  <td><span className={`v5-badge ${member.is_active ? 'v5-badge-green' : 'v5-badge-gray'}`}>{member.is_active ? (isPt ? 'Ativo' : 'Actif') : (isPt ? 'Inativo' : 'Inactif')}</span></td>
                  <td>{getRelativeLogin(member.last_login_at || member.accepted_at)}</td>
                  <td>
                    {member.role === 'GERANT' ? '—' : (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="v5-btn v5-btn-sm" onClick={() => { setEditPerms(getEffectivePermissions(member.role, member.permission_overrides?.map(o => ({ module_id: o.module_id, access_level: o.access_level as AccessLevel })) || [])); setShowPermsModal(member) }}>{isPt ? 'Modificar' : 'Modifier'}</button>
                        <button className="v5-btn v5-btn-sm v5-btn-d" onClick={() => handleToggleActive(member)}>{member.is_active ? (isPt ? 'Desativar' : 'Désactiver') : (isPt ? 'Ativar' : 'Activer')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Roles & Permissions description */}
      <div className="v5-card">
        <div className="v5-st">{isPt ? 'Papéis & permissões' : 'Rôles & permissions'}</div>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>
          <strong>{isPt ? 'Gerente' : 'Gérant'}</strong> — {isPt ? 'Acesso completo. Único a gerir as contas.' : 'Accès complet. Seul à gérer les comptes.'}<br/>
          <strong>{isPt ? 'Condutor de obras' : 'Conducteur de travaux'}</strong> — {isPt ? 'Obras, equipas, planning, orçamentos fornecedores, subempreitada.' : 'Chantiers, équipes, planning, devis fournisseurs, sous-traitance.'}<br/>
          <strong>{isPt ? 'Chefe de obra' : 'Chef de chantier'}</strong> — {isPt ? 'As suas obras: planning, marcação, relatórios, fotos.' : 'Ses chantiers : planning, pointage, rapports, photos.'}<br/>
          <strong>{isPt ? 'Secretária' : 'Secrétaire'}</strong> — {isPt ? 'Orçamentos, faturas, mensagens, clientes, conformidade.' : 'Devis, factures, messagerie, clients, conformité.'}<br/>
          <strong>{isPt ? 'Contabilista' : 'Comptable'}</strong> — {isPt ? 'Contabilidade, rentabilidade, faturas, situações, retenções, receitas.' : 'Compta, rentabilité, factures, situations, retenues, revenus.'}<br/>
          <strong>{isPt ? 'Operário' : 'Ouvrier'}</strong> — {isPt ? 'Marcação pessoal, fotos, planning apenas leitura.' : 'Pointage personnel, photos, planning lecture seule.'}
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
                    {PRO_TEAM_ROLES.map(r => (
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
