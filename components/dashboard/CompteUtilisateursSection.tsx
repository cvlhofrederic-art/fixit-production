'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
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
import { CATEGORIES_PROPOSEES, LONGUEUR_MAX_CATEGORIE } from '@/lib/equipe/categorie-professionnelle'

type ContractType = 'cdi' | 'cdd' | 'sous_traitant' | 'interim' | 'stagiaire' | 'apprenti'

interface TeamMember {
  id: string
  email: string
  full_name: string
  phone: string
  role: ProTeamRole
  /** Catégorie professionnelle affichée (titre libre) ; sans effet sur les droits. */
  job_title?: string | null
  contract_type?: ContractType | null
  assigned_chantiers: string[]
  invite_sent_at: string | null
  accepted_at: string | null
  last_login_at: string | null
  is_active: boolean
  created_at: string
  permission_overrides: { module_id: string; access_level: string }[]
}

// Chips colorés par type de contrat (FR/PT)
const CONTRACT_LABELS: Record<ContractType, { fr: string; pt: string; bg: string; color: string }> = {
  cdi:           { fr: 'CDI',          pt: 'Sem termo',   bg: '#DCFCE7', color: '#15803D' }, // vert
  cdd:           { fr: 'CDD',          pt: 'A termo',     bg: '#FEF3C7', color: '#B45309' }, // ambre
  sous_traitant: { fr: 'Sous-traitant', pt: 'Subempreiteiro', bg: '#DBEAFE', color: '#1D4ED8' }, // bleu
  interim:       { fr: 'Intérim',       pt: 'Temporário',  bg: '#EDE9FE', color: '#6D28D9' }, // violet
  stagiaire:     { fr: 'Stagiaire',     pt: 'Estagiário',  bg: '#F3F4F6', color: '#4B5563' }, // gris
  apprenti:      { fr: 'Apprenti',      pt: 'Aprendiz',    bg: '#FFE4E6', color: '#BE123C' }, // rose
}

interface Props {
  artisan: Artisan
  isGerant?: boolean
}

const FORMULAIRE_VIDE = {
  email: '',
  full_name: '',
  phone: '',
  memberRole: 'CONDUCTEUR_TRAVAUX' as ProTeamRole,
  job_title: '',
}

const ID_LISTE_CATEGORIES = 'categories-professionnelles-equipe'

export default function CompteUtilisateursSection({ artisan, isGerant = false }: Props) {
  const { t, locale } = useTranslation()
  const isPt = locale === 'pt'
  const tv = useThemeVars(true)

  // Read cache synchronously on first render to skip "Chargement..." flash on tab switches
  const CACHE_KEY = '__team_members_cache'
  const CACHE_TTL = 30_000
  const initialCache = (() => {
    if (typeof window === 'undefined') return null
    const c = (window as any)[CACHE_KEY]
    if (c && Date.now() - c.at < CACHE_TTL) return c.data as TeamMember[]
    return null
  })()
  const [members, setMembers] = useState<TeamMember[]>(initialCache || [])
  const [loading, setLoading] = useState(!initialCache)
  const [chantiersMap, setChantiersMap] = useState<Record<string, string>>({})
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPermsModal, setShowPermsModal] = useState<TeamMember | null>(null)
  const [inviteForm, setInviteForm] = useState(FORMULAIRE_VIDE)
  const [inviting, setInviting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editPerms, setEditPerms] = useState<Record<string, AccessLevel>>({})
  const [editCategorie, setEditCategorie] = useState('')

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const fetchMembers = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = (window as any)[CACHE_KEY]
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setMembers(cached.data)
        setLoading(false)
        return
      }
    }
    try {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch('/api/pro/team', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        const list = data.members || []
        setMembers(list)
        ;(window as any)[CACHE_KEY] = { data: list, at: Date.now() }
      } else {
        // Sans ce message, une erreur du serveur affichait « aucun membre » comme une équipe vide.
        toast.error(isPt ? 'Erro ao carregar a equipa' : 'Erreur lors du chargement de l\'équipe')
      }
    } catch {
      toast.error(isPt ? 'Erro ao carregar a equipa' : 'Erreur lors du chargement de l\'équipe')
    } finally {
      setLoading(false)
    }
  }, [getAuthToken, isPt])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Charger les chantiers pour résoudre UUID → titre
  // On interroge toujours Supabase directement : assigned_chantiers contient des UUIDs Supabase
  // (le localStorage peut avoir des IDs demo comme "demo-ch-001" qui ne matchent pas)
  useEffect(() => {
    const loadChantiers = async () => {
      const artisanId = artisan?.id
      if (!artisanId) return
      try {
        const { data } = await supabase
          .from('chantiers_btp')
          .select('id, titre')
          .eq('artisan_id', artisanId)
        if (data && data.length > 0) {
          const map: Record<string, string> = {}
          data.forEach((c: { id: string; titre?: string }) => { map[c.id] = c.titre || c.id })
          setChantiersMap(map)
        }
      } catch { /* ignore */ }
    }
    loadChantiers()
  }, [artisan?.id])

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error(isPt ? 'Preencha o e-mail e o nome' : 'Remplissez email et nom')
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
        setInviteForm(FORMULAIRE_VIDE)
        fetchMembers(true)
      } else {
        toast.error(data.error || (isPt ? 'Erro' : 'Erreur'))
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
        fetchMembers(true)
      }
    } catch {
      toast.error(isPt ? 'Erro' : 'Erreur')
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
        fetchMembers(true)
      }
    } catch {
      toast.error(isPt ? 'Erro' : 'Erreur')
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
          job_title: member.job_title ?? null,
        }),
      })
      if (res.ok) {
        toast.success(isPt ? 'Convite reenviado' : 'Invitation renvoyée')
        fetchMembers(true)
      }
    } catch {
      toast.error(isPt ? 'Erro' : 'Erreur')
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
    setEditCategorie(member.job_title ?? '')
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

      // La catégorie n'est envoyée que si elle a changé (texte vide = retirée).
      const categorieModifiee = editCategorie.trim() !== (showPermsModal.job_title ?? '')
      const token = await getAuthToken()
      const res = await fetch('/api/pro/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          member_id: showPermsModal.id,
          permissions: overrides,
          ...(categorieModifiee ? { job_title: editCategorie } : {}),
        }),
      })
      if (res.ok) {
        toast.success(isPt ? 'Alterações guardadas' : 'Modifications enregistrées')
        setShowPermsModal(null)
        fetchMembers(true)
      } else if (isPt) {
        // Les messages du serveur sont en français : écran portugais, message portugais.
        toast.error(res.status === 400
          ? `Categoria ou permissões inválidas (máximo ${LONGUEUR_MAX_CATEGORIE} caracteres, sem caracteres especiais).`
          : 'Erro ao guardar. Tente novamente.')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error(isPt ? 'Erro' : 'Erreur')
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
        fetchMembers(true)
      }
    } catch {
      toast.error(isPt ? 'Erro' : 'Erreur')
    }
  }

  const getRoleLabel = (role: ProTeamRole) => ROLE_LABELS[role][isPt ? 'pt' : 'fr']
  const getModuleLabel = (moduleId: string) => {
    const labels = MODULE_LABELS[moduleId]
    return labels ? labels[isPt ? 'pt' : 'fr'] : moduleId
  }
  // Séparateur entre un rôle et sa description : pas d'espace avant « : » en portugais.
  const separateurRole = isPt ? ': ' : ' : '

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const getStatusBadge = (member: TeamMember) => {
    if (!member.is_active) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: '#fee2e2', color: '#dc2626' }}>{isPt ? 'Desativado' : 'Désactivé'}</span>
    }
    if (!member.accepted_at) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: '#FFF8E1', color: '#F59E0B' }}>{isPt ? 'Pendente' : 'En attente'}</span>
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: '#dcfce7', color: '#16a34a' }}>{isPt ? 'Ativo' : 'Actif'}</span>
  }

  // Tous les modules sont réglables, compte par compte (24/11/2026). `settings` l'était resté « par rôle », donc
  // figé : la secrétaire, à qui les valeurs par défaut donnent FULL, lisait et modifiait les réglages de la société —
  // salaire du gérant, taux de cotisations, taux d'IS, objectif de marge — sans que le gérant puisse le lui retirer.
  const editableModules = ALL_PRO_MODULES

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
            ? `Acessos da equipa: ${members.length} ${members.length === 1 ? 'conta ativa' : 'contas ativas'} / 20 no máximo`
            : `Accès équipe : ${members.length} comptes actifs / 20 max`}</p>
      </div>

      {/* Search + Create */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <input className="v5-search-in" placeholder={isPt ? 'Pesquisar um utilizador...' : 'Rechercher un utilisateur...'} style={{ maxWidth: 300 }} />
        {isGerant && (
          <button onClick={() => setShowInviteModal(true)} className="v5-btn v5-btn-p">
            + {isPt ? 'Criar uma conta' : 'Créer un compte'}
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="v5-card" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{isPt ? 'Utilizador' : 'Utilisateur'}</th>
              <th>{isPt ? 'E-mail' : 'Email'}</th>
              <th>{isPt ? 'Papel' : 'Rôle'}</th>
              <th>{isPt ? 'Contrato' : 'Contrat'}</th>
              <th>{isPt ? 'Estado' : 'Statut'}</th>
              <th>{isPt ? 'Último acesso' : 'Dernière connexion'}</th>
              <th>{isPt ? 'Ações' : 'Actions'}</th>
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
                  <td>
                    {/* La catégorie professionnelle, quand elle est saisie, est le titre affiché ; le rôle, qui fixe
                        les droits, passe alors en dessous. */}
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: badgeStyle.bg, color: badgeStyle.color }}>{member.job_title || getRoleLabel(member.role) || member.role}</span>
                    {member.job_title && (
                      <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>
                        {isPt ? 'Permissões' : 'Droits'}{separateurRole}{getRoleLabel(member.role) || member.role}
                      </div>
                    )}
                  </td>
                  <td>
                    {(() => {
                      // Gérant = statut dirigeant (pas de chip contrat salarié classique)
                      if (member.role === 'GERANT') {
                        return <span style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{isPt ? 'Sócio-gerente' : 'Dirigeant'}</span>
                      }
                      const ct = member.contract_type || 'cdi'
                      const meta = CONTRACT_LABELS[ct] ?? CONTRACT_LABELS.cdi
                      return (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: meta.bg, color: meta.color }}>
                          {isPt ? meta.pt : meta.fr}
                        </span>
                      )
                    })()}
                  </td>
                  <td><span className={`v5-badge ${member.is_active ? 'v5-badge-green' : 'v5-badge-gray'}`}>{member.is_active ? (isPt ? 'Ativo' : 'Actif') : (isPt ? 'Inativo' : 'Inactif')}</span></td>
                  <td>{getRelativeLogin(member.last_login_at || member.accepted_at)}</td>
                  <td>
                    {!isGerant ? '—' : (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="v5-btn v5-btn-sm" onClick={() => { setEditPerms(getEffectivePermissions(member.role, member.permission_overrides?.map(o => ({ module_id: o.module_id, access_level: o.access_level as AccessLevel })) || [])); setEditCategorie(member.job_title ?? ''); setShowPermsModal(member) }}>{isPt ? 'Editar' : 'Modifier'}</button>
                        <button className="v5-btn v5-btn-sm v5-btn-d" onClick={() => handleToggleActive(member)}>{member.is_active ? (isPt ? 'Desativar' : 'Désactiver') : (isPt ? 'Ativar' : 'Activer')}</button>
                        <button className="v5-btn v5-btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDelete(member)}>{isPt ? 'Eliminar' : 'Supprimer'}</button>
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
          <strong>{ROLE_LABELS.GERANT[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'acesso total. Único com permissão para gerir contas.' : 'accès complet. Seul à gérer les comptes.'}<br/>
          <strong>{ROLE_LABELS.CONDUCTEUR_TRAVAUX[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'obras, equipas, planeamento, orçamentos de fornecedores, subempreitadas.' : 'chantiers, équipes, planning, devis fournisseurs, sous-traitance.'}<br/>
          <strong>{ROLE_LABELS.CHEF_CHANTIER[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'as suas obras (planeamento, registo de horas, relatórios, fotos).' : 'ses chantiers (planning, pointage, rapports, photos).'}<br/>
          <strong>{ROLE_LABELS.SECRETAIRE[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'orçamentos, faturas, mensagens, clientes, conformidade.' : 'devis, factures, messagerie, clients, conformité.'}<br/>
          <strong>{ROLE_LABELS.COMPTABLE[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'contabilidade, rentabilidade, faturas, autos de medição, retenções, receitas.' : 'compta, rentabilité, factures, situations, retenues, revenus.'}<br/>
          <strong>{ROLE_LABELS.OUVRIER[isPt ? 'pt' : 'fr']}</strong>{separateurRole}{isPt ? 'registo das suas horas, fotos, planeamento apenas em leitura.' : 'pointage personnel, photos, planning en lecture seule.'}
        </div>
      </div>
      {/* Propositions communes aux deux champs « Catégorie professionnelle » ; la saisie reste libre. */}
      <datalist id={ID_LISTE_CATEGORIES}>
        {CATEGORIES_PROPOSEES[isPt ? 'pt' : 'fr'].map(c => <option key={c} value={c} />)}
      </datalist>
      {/* ═══ INVITE MODAL ═══ */}
      {showInviteModal && (
        <>
          <div className="v22-modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="v22-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="v22-modal-head">
                <div className="v22-modal-title">{isPt ? '👷 Convidar membro' : '👷 Inviter un membre'}</div>
                <button onClick={() => setShowInviteModal(false)} className="v22-modal-close">✕</button>
              </div>
              <div className="v22-modal-body">
                <div className="v22-form-group">
                  <label className="v22-form-label">{isPt ? 'Nome completo' : 'Nom complet'} *</label>
                  <input type="text" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} className="v22-form-input" placeholder={isPt ? 'João Silva' : 'Jean Dupont'} />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{isPt ? 'E-mail *' : 'Email *'}</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="v22-form-input" placeholder={isPt ? 'joao@empresa.pt' : 'jean@entreprise.fr'} />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{isPt ? 'Telemóvel' : 'Téléphone'}</label>
                  <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} className="v22-form-input" placeholder={isPt ? '+351 912 345 678' : '+33 6 12 34 56 78'} />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{isPt ? 'Papel' : 'Rôle'} *</label>
                  <select value={inviteForm.memberRole} onChange={e => setInviteForm(f => ({ ...f, memberRole: e.target.value as ProTeamRole }))} className="v22-form-input">
                    {PRO_TEAM_ROLES.map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                  <p style={{ marginTop: 4, fontSize: 10, color: '#999' }}>
                    {isPt
                      ? 'As permissões predefinidas são aplicadas de acordo com o papel. Poderá personalizá-las depois da criação.'
                      : 'Les permissions par défaut sont appliquées selon le rôle. Personnalisable après création.'}
                  </p>
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label" htmlFor="categorie-invitation">{isPt ? 'Categoria profissional' : 'Catégorie professionnelle'}</label>
                  <input id="categorie-invitation" type="text" list={ID_LISTE_CATEGORIES} maxLength={LONGUEUR_MAX_CATEGORIE} value={inviteForm.job_title} onChange={e => setInviteForm(f => ({ ...f, job_title: e.target.value }))} className="v22-form-input" placeholder={isPt ? 'Ex.: Encarregado geral' : 'Ex. : Chef de chantier'} aria-describedby="categorie-invitation-aide" />
                  <p id="categorie-invitation-aide" style={{ marginTop: 4, fontSize: 10, color: '#999' }}>
                    {isPt ? 'Título apresentado na lista. Não altera as permissões.' : 'Titre affiché dans la liste. Ne change pas les permissions.'}
                  </p>
                </div>
              </div>
              <div className="v22-modal-foot">
                <button onClick={() => setShowInviteModal(false)} className="v22-btn">{isPt ? 'Cancelar' : 'Annuler'}</button>
                <button onClick={handleInvite} disabled={inviting} className="v22-btn v22-btn-primary">
                  {inviting ? (isPt ? 'A enviar...' : 'Envoi...') : (isPt ? 'Enviar convite' : 'Envoyer l\'invitation')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ PERMISSIONS MODAL ═══ */}
      {showPermsModal && (
        <div className="v22-modal-overlay" onClick={() => setShowPermsModal(null)}>
          <div className="v22-modal" style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="v22-modal-head">
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                  🔐 {isPt ? 'Permissões' : 'Permissions'}{isPt ? ': ' : ' — '}{showPermsModal.full_name}
                </h3>
                <p style={{ fontSize: 10, marginTop: 4, color: tv.textMuted }}>
                  {isPt ? 'Papel' : 'Rôle'}: {getRoleLabel(showPermsModal.role)}
                </p>
              </div>
            </div>
            <div className="v22-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <div className="v22-form-group" style={{ marginBottom: 12 }}>
                <label className="v22-form-label" htmlFor="categorie-membre">{isPt ? 'Categoria profissional' : 'Catégorie professionnelle'}</label>
                <input id="categorie-membre" type="text" list={ID_LISTE_CATEGORIES} maxLength={LONGUEUR_MAX_CATEGORIE} value={editCategorie} onChange={e => setEditCategorie(e.target.value)} className="v22-form-input" placeholder={isPt ? 'Ex.: Encarregado geral' : 'Ex. : Chef de chantier'} aria-describedby="categorie-membre-aide" />
                <p id="categorie-membre-aide" style={{ marginTop: 4, fontSize: 10, color: tv.textMuted }}>
                  {isPt ? 'Título apresentado na lista. Não altera as permissões.' : 'Titre affiché dans la liste. Ne change pas les permissions.'}
                </p>
              </div>
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setEditPerms(getDefaultPermissionsForRole(showPermsModal.role))}
                  className="v22-btn"
                  style={{ fontSize: 10, padding: '4px 12px' }}
                >
                  {isPt ? 'Repor predefinições' : 'Restaurer les défauts'}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="v22-dt" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>{isPt ? 'Módulo' : 'Module'}</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: '#16a34a', width: 90 }}>{isPt ? 'Completo' : 'Complet'}</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: '#f59e0b', width: 90 }}>{isPt ? 'Leitura' : 'Lecture'}</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: '#dc2626', width: 90 }}>{isPt ? 'Nenhum' : 'Aucun'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableModules.map(moduleId => {
                      const defaultLevel = getDefaultPermissionsForRole(showPermsModal.role)[moduleId] || 'NONE'
                      const currentLevel = editPerms[moduleId] || 'NONE'
                      const isOverridden = currentLevel !== defaultLevel

                      return (
                        <tr key={moduleId} style={{
                          background: isOverridden ? 'rgba(250, 204, 21, 0.04)' : 'transparent',
                        }}>
                          <td style={{ padding: '8px 12px' }}>
                            {getModuleLabel(moduleId)}
                            {isOverridden && <span style={{ marginLeft: 4, fontSize: 9, color: tv.primary }}>●</span>}
                          </td>
                          {(['FULL', 'READ', 'NONE'] as AccessLevel[]).map(level => (
                            <td key={level} style={{ textAlign: 'center', padding: '8px 12px' }}>
                              <input
                                type="radio"
                                name={`perm_${moduleId}`}
                                checked={currentLevel === level}
                                onChange={() => setEditPerms(prev => ({ ...prev, [moduleId]: level }))}
                                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: level === 'FULL' ? '#16a34a' : level === 'READ' ? '#f59e0b' : '#dc2626' }}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="v22-modal-foot">
              <button onClick={() => setShowPermsModal(null)} className="v22-btn">
                {isPt ? 'Cancelar' : 'Annuler'}
              </button>
              <button
                onClick={handleSavePerms}
                disabled={saving}
                className="v22-btn v22-btn-primary"
              >
                {saving
                  ? (isPt ? 'A guardar...' : 'Enregistrement...')
                  : (isPt ? 'Guardar permissões' : 'Enregistrer les permissions')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
