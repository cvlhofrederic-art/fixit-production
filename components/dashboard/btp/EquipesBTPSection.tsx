'use client'

import { useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { PlusCircle, Pencil, Trash2, Users, Key, Tag, HardHat, Phone, Mail, Check, Minus } from 'lucide-react'
import {
  TypeCompte, ModulePerms, PermMap, Membre, EquipeBTP, RolePerso,
  TYPE_LABELS, TYPE_COLORS, MODULE_LABELS, MODULE_ICONS, MODULES,
  DEFAULT_PERMS, METIERS_FR, EMPTY_PERM,
} from './types'
import { useThemeVars } from '../useThemeVars'

export function EquipesBTPSection({ artisan, orgRole }: { artisan: import('@/lib/types').Artisan; orgRole?: string }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const TYPE_COLORS_V5: Record<TypeCompte, string> = {
    ouvrier: 'v5-badge v5-badge-gray',
    chef_chantier: 'v5-badge v5-badge-orange',
    conducteur_travaux: 'v5-badge v5-badge-yellow',
    secretaire: 'v5-badge v5-badge-green',
    gerant: 'v5-badge v5-badge-red',
  }

  const keyMembres = `fixit_membres_${artisan?.id}`
  const keyEquipes = `fixit_equipes_btp_${artisan?.id}`
  const keyRoles  = `fixit_roles_btp_${artisan?.id}`

  const [membres, setMembres] = useState<Membre[]>(() => {
    try { return JSON.parse(localStorage.getItem(keyMembres) || '[]') } catch { return [] }
  })
  const [equipes, setEquipes] = useState<EquipeBTP[]>(() => {
    try { return JSON.parse(localStorage.getItem(keyEquipes) || '[]') } catch { return [] }
  })
  const [roles, setRoles] = useState<RolePerso[]>(() => {
    try { return JSON.parse(localStorage.getItem(keyRoles) || '[]') } catch { return [] }
  })

  const [tab, setTab] = useState<'membres' | 'equipes' | 'roles'>('membres')
  const [showMembreModal, setShowMembreModal] = useState(false)
  const [showEquipeModal, setShowEquipeModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingMembre, setEditingMembre] = useState<Membre | null>(null)
  const [editingEquipe, setEditingEquipe] = useState<EquipeBTP | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'membre' | 'equipe'; id: string } | null>(null)

  // ── Membres ───────────────────────────────────────────────
  const [mForm, setMForm] = useState({ prenom: '', nom: '', telephone: '', email: '', typeCompte: 'ouvrier' as TypeCompte, rolePerso: '', equipeId: '' })

  const saveMembres = (list: Membre[]) => { setMembres(list); localStorage.setItem(keyMembres, JSON.stringify(list)) }

  const submitMembre = () => {
    if (!mForm.prenom.trim() || !mForm.nom.trim()) return
    if (editingMembre) {
      saveMembres(membres.map(m => m.id === editingMembre.id ? { ...editingMembre, ...mForm } : m))
    } else {
      saveMembres([...membres, { id: Date.now().toString(), ...mForm, createdAt: new Date().toISOString() }])
    }
    setShowMembreModal(false)
    setEditingMembre(null)
    setMForm({ prenom: '', nom: '', telephone: '', email: '', typeCompte: 'ouvrier', rolePerso: '', equipeId: '' })
  }

  const openEditMembre = (m: Membre) => {
    setEditingMembre(m)
    setMForm({ prenom: m.prenom, nom: m.nom, telephone: m.telephone, email: m.email, typeCompte: m.typeCompte, rolePerso: m.rolePerso, equipeId: m.equipeId })
    setShowMembreModal(true)
  }

  const deleteMembre = (id: string) => {
    setConfirmDelete({ type: 'membre', id })
  }

  // ── Équipes ───────────────────────────────────────────────
  const [eForm, setEForm] = useState({ nom: '', metier: '', chantierId: '', membreIds: [] as string[] })

  const saveEquipes = (list: EquipeBTP[]) => { setEquipes(list); localStorage.setItem(keyEquipes, JSON.stringify(list)) }

  const submitEquipe = () => {
    if (!eForm.nom.trim()) return
    if (editingEquipe) {
      saveEquipes(equipes.map(e => e.id === editingEquipe.id ? { ...editingEquipe, ...eForm } : e))
    } else {
      saveEquipes([...equipes, { id: Date.now().toString(), ...eForm, createdAt: new Date().toISOString() }])
    }
    setShowEquipeModal(false)
    setEditingEquipe(null)
    setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] })
  }

  const deleteEquipe = (id: string) => {
    setConfirmDelete({ type: 'equipe', id })
  }

  // ── Rôles ─────────────────────────────────────────────────
  const [rForm, setRForm] = useState({ nom: '', permissions: { ...EMPTY_PERM } })

  const saveRoles = (list: RolePerso[]) => { setRoles(list); localStorage.setItem(keyRoles, JSON.stringify(list)) }

  const submitRole = () => {
    if (!rForm.nom.trim()) return
    saveRoles([...roles, { id: Date.now().toString(), nom: rForm.nom, permissions: rForm.permissions }])
    setShowRoleModal(false)
    setRForm({ nom: '', permissions: { ...EMPTY_PERM } })
  }

  const deleteRole = (id: string) => saveRoles(roles.filter(r => r.id !== id))

  const toggleRolePerm = (roleId: string, mod: ModulePerms) => {
    saveRoles(roles.map(r => r.id === roleId ? { ...r, permissions: { ...r.permissions, [mod]: !r.permissions[mod] } } : r))
  }

  // ── Stats ─────────────────────────────────────────────────
  const totalMembres = membres.length
  const nbEquipes = equipes.length
  const nbGerants = membres.filter(m => m.typeCompte === 'gerant').length

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          <h1 className={isV5 ? undefined : "v22-page-title"}><HardHat size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Equipas & Colaboradores' : 'Équipes & Collaborateurs'}</h1>
          <p className={isV5 ? undefined : "v22-page-sub"}>{isPt ? 'Gerencie membros, equipas e permissões por função' : 'Gérez vos membres, équipes et permissions par rôle'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'membres' && <button className={isV5 ? "v5-btn v5-btn-action" : "v22-btn v22-btn-action"} onClick={() => { setEditingMembre(null); setMForm({ prenom: '', nom: '', telephone: '', email: '', typeCompte: 'ouvrier', rolePerso: '', equipeId: '' }); setShowMembreModal(true) }}><PlusCircle size={14} /> {isPt ? 'Membro' : 'Membre'}</button>}
          {tab === 'equipes' && <button className={isV5 ? "v5-btn v5-btn-action" : "v22-btn v22-btn-action"} onClick={() => { setEditingEquipe(null); setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] }); setShowEquipeModal(true) }}><PlusCircle size={14} /> {isPt ? 'Equipa' : 'Équipe'}</button>}
          {tab === 'roles'   && <button className={isV5 ? "v5-btn v5-btn-action" : "v22-btn v22-btn-action"} onClick={() => { setRForm({ nom: '', permissions: { ...EMPTY_PERM } }); setShowRoleModal(true) }}><PlusCircle size={14} /> {isPt ? 'Criar função' : 'Créer un rôle'}</button>}
        </div>
      </div>

      {/* Stats row */}
      {isV5 ? (
        <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="v5-kpi">
            <div className="v5-kpi-v">{totalMembres}</div>
            <div className="v5-kpi-l">{isPt ? 'Colaboradores' : 'Collaborateurs'}</div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-v">{nbEquipes}</div>
            <div className="v5-kpi-l">{isPt ? 'Equipas' : 'Équipes'}</div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-v">{nbGerants}</div>
            <div className="v5-kpi-l">{isPt ? 'Gestores' : 'Gérants'}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '0 24px 16px' }}>
          <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{totalMembres}</div>
            <div className="v22-card-meta">{isPt ? 'Colaboradores' : 'Collaborateurs'}</div>
          </div>
          <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{nbEquipes}</div>
            <div className="v22-card-meta">{isPt ? 'Equipas' : 'Équipes'}</div>
          </div>
          <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{nbGerants}</div>
            <div className="v22-card-meta">{isPt ? 'Gestores' : 'Gérants'}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isV5 ? (
        <div className="v5-tabs">
          {(['membres', 'equipes', 'roles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`v5-tab-b${tab === t ? ' active' : ''}`}>
              {t === 'membres' ? <><Users size={14} /> {isPt ? 'Membros' : 'Membres'}</> : t === 'equipes' ? <><HardHat size={14} /> {isPt ? 'Equipas' : 'Équipes'}</> : <><Key size={14} /> {isPt ? 'Funções' : 'Rôles & Accès'}</>}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4, padding: '0 24px 16px', borderBottom: `1px solid ${tv.border}` }}>
          {(['membres', 'equipes', 'roles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`v22-tab${tab === t ? ' active' : ''}`}>
              {t === 'membres' ? <><Users size={14} /> {isPt ? 'Membros' : 'Membres'}</> : t === 'equipes' ? <><HardHat size={14} /> {isPt ? 'Equipas' : 'Équipes'}</> : <><Key size={14} /> {isPt ? 'Funções' : 'Rôles & Accès'}</>}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: isV5 ? undefined : '20px 24px' }}>

        {/* ── TAB MEMBRES ── */}
        {tab === 'membres' && (
          membres.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12 }}><Users size={44} style={{ color: '#CCC' }} /></div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhum colaborador' : 'Aucun collaborateur'}</div>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>{isPt ? 'Adicione os membros da sua empresa' : 'Ajoutez les membres de votre entreprise'}</p>
              <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowMembreModal(true)}><PlusCircle size={16} /> {isPt ? 'Adicionar membro' : 'Ajouter un membre'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {membres.map(m => {
                const equipe = equipes.find(e => e.id === m.equipeId)
                return (
                  <div key={m.id} className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{m.prenom} {m.nom}</div>
                        {m.rolePerso && <div style={{ fontSize: 12, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid, marginTop: 2 }}>{m.rolePerso}</div>}
                      </div>
                      <span className={(isV5 ? TYPE_COLORS_V5 : TYPE_COLORS)[m.typeCompte]} style={{ fontSize: 11 }}>{TYPE_LABELS[m.typeCompte]}</span>
                    </div>
                    {m.telephone && <div className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><Phone size={12} /> {m.telephone}</div>}
                    {m.email && <div className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><Mail size={12} /> {m.email}</div>}
                    {equipe && <div className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><HardHat size={12} /> {equipe.nom}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ flex: 1 }} onClick={() => openEditMembre(m)}><Pencil size={14} /> {isPt ? 'Editar' : 'Modifier'}</button>
                      <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={isV5 ? { color: '#C0392B' } : { background: tv.redBg, color: tv.red }} onClick={() => deleteMembre(m.id)} aria-label="Supprimer ce collaborateur"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB ÉQUIPES ── */}
        {tab === 'equipes' && (
          equipes.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12 }}><HardHat size={44} style={{ color: '#CCC' }} /></div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma equipa' : 'Aucune équipe'}</div>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>{isPt ? 'Crie equipas e afecte-as a obras' : 'Créez des équipes et affectez-les à vos chantiers'}</p>
              <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowEquipeModal(true)}><PlusCircle size={16} /> {isPt ? 'Criar equipa' : 'Créer une équipe'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {equipes.map(eq => {
                const eqMembres = membres.filter(m => eq.membreIds.includes(m.id))
                return (
                  <div key={eq.id} className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{eq.nom}</div>
                        {eq.metier && <div style={{ fontSize: 12, color: isV5 ? 'var(--v5-primary-yellow-dark)' : tv.primary, fontWeight: 600, marginTop: 2 }}>{eq.metier}</div>}
                      </div>
                      <span className={isV5 ? 'v5-badge v5-badge-green' : 'v22-tag v22-tag-green'} style={{ fontSize: 11 }}>{eqMembres.length} {isPt ? 'membros' : 'membres'}</span>
                    </div>
                    {eqMembres.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {eqMembres.map(m => (
                          <span key={m.id} className={isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray'} style={{ fontSize: 11 }}>{m.prenom} {m.nom[0]}.</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ flex: 1 }} onClick={() => { setEditingEquipe(eq); setEForm({ nom: eq.nom, metier: eq.metier, chantierId: eq.chantierId, membreIds: eq.membreIds }); setShowEquipeModal(true) }} aria-label="Modifier cette équipe"><Pencil size={14} /></button>
                      <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={isV5 ? { color: '#C0392B' } : { background: tv.redBg, color: tv.red }} onClick={() => deleteEquipe(eq.id)} aria-label="Supprimer cette équipe"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB RÔLES & PERMISSIONS ── */}
        {tab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Rôles par défaut (types de comptes) */}
            <div className={isV5 ? 'v5-card' : 'v22-card'}>
              {isV5 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
                  <div className="v5-st" style={{ margin: 0 }}><Tag size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Permissões por tipo de conta' : 'Accès par type de compte'}</div>
                  <span style={{ fontSize: 11, color: 'var(--v5-text-muted)' }}>{isPt ? 'Configuração padrão — não editável' : 'Défauts système — non modifiables'}</span>
                </div>
              ) : (
                <div className="v22-card-head">
                  <span className="v22-card-title"><Tag size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Permissões por tipo de conta' : 'Accès par type de compte'}</span>
                  <span className="v22-card-meta" style={{ fontSize: 11 }}>{isPt ? 'Configuração padrão — não editável' : 'Défauts système — non modifiables'}</span>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                      <th style={isV5 ? { textAlign: 'left' } : { padding: '8px 12px', textAlign: 'left', color: tv.textMid, fontWeight: 600 }}>{isPt ? 'Tipo' : 'Type'}</th>
                      {MODULES.map(mod => <th key={mod} style={isV5 ? { textAlign: 'center' } : { padding: '8px 8px', textAlign: 'center', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{MODULE_ICONS[mod]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(DEFAULT_PERMS) as TypeCompte[]).map(type => (
                      <tr key={type} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}><span className={(isV5 ? TYPE_COLORS_V5 : TYPE_COLORS)[type]} style={{ fontSize: 11 }}>{TYPE_LABELS[type]}</span></td>
                        {MODULES.map(mod => (
                          <td key={mod} style={isV5 ? { textAlign: 'center' } : { padding: '8px 8px', textAlign: 'center' }}>
                            {DEFAULT_PERMS[type][mod] ? <Check size={14} style={{ color: isV5 ? '#2E7D32' : tv.green }} /> : <Minus size={14} style={{ color: isV5 ? '#CCC' : tv.border }} />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 16px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MODULES.map(mod => <span key={mod} style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{MODULE_ICONS[mod]} {MODULE_LABELS[mod]}</span>)}
                </div>
              </div>
            </div>

            {/* Rôles personnalisés */}
            <div className={isV5 ? 'v5-card' : 'v22-card'}>
              {isV5 ? (
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
                  <div className="v5-st" style={{ margin: 0 }}><Key size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Funções personalizadas' : 'Rôles personnalisés'}</div>
                </div>
              ) : (
                <div className="v22-card-head">
                  <span className="v22-card-title"><Key size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Funções personalizadas' : 'Rôles personnalisés'}</span>
                </div>
              )}
              <div className={isV5 ? undefined : 'v22-card-body'} style={isV5 ? { padding: '1rem 1.25rem' } : undefined}>
                {roles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <p className={isV5 ? undefined : 'v22-card-meta'} style={{ marginBottom: 12, ...(isV5 ? { color: 'var(--v5-text-muted)', fontSize: 12 } : {}) }}>{isPt ? 'Crie funções específicas (ex: Pedreiro, Canalizador...)' : 'Créez des rôles spécifiques (ex: Maçon, Carreleur...)'}</p>
                    <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => setShowRoleModal(true)}><PlusCircle size={14} /> {isPt ? 'Criar função' : 'Créer un rôle'}</button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                          <th style={isV5 ? { textAlign: 'left' } : { padding: '8px 12px', textAlign: 'left', color: tv.textMid, fontWeight: 600 }}>{isPt ? 'Função' : 'Rôle'}</th>
                          {MODULES.map(mod => <th key={mod} style={isV5 ? { textAlign: 'center' } : { padding: '8px 8px', textAlign: 'center', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{MODULE_ICONS[mod]}</th>)}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map(role => (
                          <tr key={role.id} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                            <td style={isV5 ? { fontWeight: 600 } : { padding: '8px 12px', fontWeight: 600 }}>{role.nom}</td>
                            {MODULES.map(mod => (
                              <td key={mod} style={isV5 ? { textAlign: 'center' } : { padding: '8px 8px', textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleRolePerm(role.id, mod)}
                                  aria-label="Basculer la permission"
                                  style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    color: role.permissions[mod] ? (isV5 ? '#2E7D32' : tv.green) : (isV5 ? '#CCC' : tv.border) }}>
                                  {role.permissions[mod] ? <Check size={14} /> : <Minus size={14} />}
                                </button>
                              </td>
                            ))}
                            <td style={isV5 ? undefined : { padding: '8px 8px' }}>
                              <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ padding: '2px 8px', background: 'none', color: isV5 ? '#C0392B' : tv.red }} onClick={() => deleteRole(role.id)} aria-label="Supprimer ce rôle">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL MEMBRE ── */}
      {showMembreModal && (
        <div className={isV5 ? 'v5-modal-ov' : undefined} style={isV5 ? undefined : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? 'v5-modal' : 'v22-card'} style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            {isV5 ? (
              <div className="v5-modal-h">
                <span><Users size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {editingMembre ? (isPt ? 'Editar membro' : 'Modifier le membre') : (isPt ? 'Novo colaborador' : 'Nouveau collaborateur')}</span>
                <button className="v5-btn v5-btn-sm" onClick={() => { setShowMembreModal(false); setEditingMembre(null) }} aria-label="Fermer">✕</button>
              </div>
            ) : (
              <div className="v22-card-head">
                <span className="v22-card-title"><Users size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {editingMembre ? (isPt ? 'Editar membro' : 'Modifier le membre') : (isPt ? 'Novo colaborador' : 'Nouveau collaborateur')}</span>
                <button className="v22-btn v22-btn-sm" onClick={() => { setShowMembreModal(false); setEditingMembre(null) }} aria-label="Fermer">✕</button>
              </div>
            )}
            <div className={isV5 ? undefined : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(isV5 ? { padding: '1rem 1.25rem' } : {}) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Primeiro nome *' : 'Prénom *'}</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.prenom} onChange={e => setMForm({ ...mForm, prenom: e.target.value })} placeholder={isPt ? 'Jean' : 'Jean'} />
                </div>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Apelido *' : 'Nom *'}</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.nom} onChange={e => setMForm({ ...mForm, nom: e.target.value })} placeholder="Dupont" />
                </div>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Tipo de conta' : 'Type de compte'}</label>
                <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.typeCompte} onChange={e => setMForm({ ...mForm, typeCompte: e.target.value as TypeCompte })}>
                  {(Object.entries(TYPE_LABELS) as [TypeCompte, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Função / Especialidade' : 'Rôle / Spécialité'} <span style={{ fontWeight: 400, color: isV5 ? 'var(--v5-text-muted)' : tv.textMid }}>(ex: Maçon, Carreleur...)</span></label>
                {roles.length > 0 ? (
                  <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })}>
                    <option value="">{isPt ? '— Sem função específica' : '— Sans rôle spécifique'}</option>
                    {roles.map(r => <option key={r.id} value={r.nom}>{r.nom}</option>)}
                  </select>
                ) : (
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur...'} />
                )}
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Equipa' : 'Équipe'}</label>
                <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.equipeId} onChange={e => setMForm({ ...mForm, equipeId: e.target.value })}>
                  <option value="">{isPt ? '— Sem equipa' : '— Sans équipe'}</option>
                  {equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Téléphone</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.telephone} onChange={e => setMForm({ ...mForm, telephone: e.target.value })} placeholder="06 12 34 56 78" />
                </div>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Email</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mForm.email} onChange={e => setMForm({ ...mForm, email: e.target.value })} placeholder="jean@example.com" />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1, background: 'none', border: isV5 ? '1px solid #E8E8E8' : `1px solid ${tv.border}` }} onClick={() => { setShowMembreModal(false); setEditingMembre(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} style={{ flex: 1, ...(isV5 ? {} : { background: tv.primary, fontWeight: 700 }) }} onClick={submitMembre} disabled={!mForm.prenom.trim() || !mForm.nom.trim()}>
{editingMembre ? <><Check size={14} /> {isPt ? 'Guardar' : 'Sauvegarder'}</> : <><Check size={14} /> {isPt ? 'Adicionar' : 'Ajouter'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ÉQUIPE ── */}
      {showEquipeModal && (
        <div className={isV5 ? 'v5-modal-ov' : undefined} style={isV5 ? undefined : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? 'v5-modal' : 'v22-card'} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            {isV5 ? (
              <div className="v5-modal-h">
                <span><HardHat size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {editingEquipe ? (isPt ? 'Editar equipa' : "Modifier l'équipe") : (isPt ? 'Nova equipa' : 'Nouvelle équipe')}</span>
                <button className="v5-btn v5-btn-sm" onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>✕</button>
              </div>
            ) : (
              <div className="v22-card-head">
                <span className="v22-card-title"><HardHat size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {editingEquipe ? (isPt ? 'Editar equipa' : "Modifier l'équipe") : (isPt ? 'Nova equipa' : 'Nouvelle équipe')}</span>
                <button className="v22-btn v22-btn-sm" onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>✕</button>
              </div>
            )}
            <div className={isV5 ? undefined : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(isV5 ? { padding: '1rem 1.25rem' } : {}) }}>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome da equipa *' : "Nom de l'équipe *"}</label>
                <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={eForm.nom} onChange={e => setEForm({ ...eForm, nom: e.target.value })} placeholder={isPt ? 'ex: Equipa Alvenaria A' : 'ex: Équipe Maçonnerie A'} />
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Especialidade' : 'Corps de métier'}</label>
                <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={eForm.metier} onChange={e => setEForm({ ...eForm, metier: e.target.value })}>
                  <option value="">—</option>
                  {METIERS_FR.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Membros da equipa' : "Membres de l'équipe"}</label>
                {membres.length === 0 ? (
                  <p className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, ...(isV5 ? { color: 'var(--v5-text-muted)' } : {}) }}>{isPt ? 'Adicione colaboradores primeiro' : 'Ajoutez des collaborateurs d\'abord'}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
                    {membres.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox"
                          checked={eForm.membreIds.includes(m.id)}
                          onChange={e => setEForm({ ...eForm, membreIds: e.target.checked ? [...eForm.membreIds, m.id] : eForm.membreIds.filter(id => id !== m.id) })}
                          style={{ accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary, width: 14, height: 14 }}
                        />
                        <span>{m.prenom} {m.nom}</span>
                        <span className={(isV5 ? TYPE_COLORS_V5 : TYPE_COLORS)[m.typeCompte]} style={{ fontSize: 10 }}>{TYPE_LABELS[m.typeCompte]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1, background: 'none', border: isV5 ? '1px solid #E8E8E8' : `1px solid ${tv.border}` }} onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} style={{ flex: 1, ...(isV5 ? {} : { background: tv.primary, fontWeight: 700 }) }} onClick={submitEquipe} disabled={!eForm.nom.trim()}>
{editingEquipe ? <><Check size={14} /> Sauvegarder</> : <><Check size={14} /> {isPt ? 'Criar' : 'Créer'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RÔLE ── */}
      {showRoleModal && (
        <div className={isV5 ? 'v5-modal-ov' : undefined} style={isV5 ? undefined : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? 'v5-modal' : 'v22-card'} style={{ width: '100%', maxWidth: 480 }}>
            {isV5 ? (
              <div className="v5-modal-h">
                <span><Key size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Nova função personalizada' : 'Nouveau rôle personnalisé'}</span>
                <button className="v5-btn v5-btn-sm" onClick={() => setShowRoleModal(false)}>✕</button>
              </div>
            ) : (
              <div className="v22-card-head">
                <span className="v22-card-title"><Key size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Nova função personalizada' : 'Nouveau rôle personnalisé'}</span>
                <button className="v22-btn v22-btn-sm" onClick={() => setShowRoleModal(false)}>✕</button>
              </div>
            )}
            <div className={isV5 ? undefined : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(isV5 ? { padding: '1rem 1.25rem' } : {}) }}>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome da função *' : 'Nom du rôle *'}</label>
                <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={rForm.nom} onChange={e => setRForm({ ...rForm, nom: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur, Chauffeur...'} />
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Acessos' : 'Accès autorisés'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {MODULES.map(mod => (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '6px 8px', background: isV5 ? 'var(--v5-content-bg)' : tv.bg, borderRadius: 6 }}>
                      <input type="checkbox"
                        checked={rForm.permissions[mod]}
                        onChange={e => setRForm({ ...rForm, permissions: { ...rForm.permissions, [mod]: e.target.checked } })}
                        style={{ accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary, width: 14, height: 14 }}
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{MODULE_ICONS[mod]} {MODULE_LABELS[mod]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1, background: 'none', border: isV5 ? '1px solid #E8E8E8' : `1px solid ${tv.border}` }} onClick={() => setShowRoleModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} style={{ flex: 1, ...(isV5 ? {} : { background: tv.primary, fontWeight: 700 }) }} onClick={submitRole} disabled={!rForm.nom.trim()}><Check size={14} /> {isPt ? 'Criar função' : 'Créer le rôle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMATION SUPPRESSION ── */}
      {confirmDelete && (
        <div className={isV5 ? 'v5-modal-ov' : 'v22-modal-overlay'} onClick={() => setConfirmDelete(null)}>
          <div className={isV5 ? 'v5-modal' : 'v22-modal'} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            {isV5 ? (
              <div className="v5-modal-h">
                <span>{isPt ? 'Confirmar eliminação' : 'Confirmer la suppression'}</span>
                <button className="v5-btn v5-btn-sm" onClick={() => setConfirmDelete(null)}>✕</button>
              </div>
            ) : (
              <div className="v22-modal-head">
                <div className="v22-modal-title">{isPt ? 'Confirmar eliminação' : 'Confirmer la suppression'}</div>
                <button className="v22-modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
              </div>
            )}
            <div className={isV5 ? undefined : 'v22-modal-body'} style={isV5 ? { padding: '1rem 1.25rem' } : undefined}>
              <p style={{ fontSize: 13 }}>
                {confirmDelete.type === 'membre'
                  ? (isPt ? 'Tem a certeza que quer remover este membro?' : 'Êtes-vous sûr de vouloir supprimer ce membre ?')
                  : (isPt ? 'Tem a certeza que quer remover esta equipa?' : 'Êtes-vous sûr de vouloir supprimer cette équipe ?')}
              </p>
            </div>
            <div className={isV5 ? undefined : 'v22-modal-foot'} style={isV5 ? { padding: '12px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' } : undefined}>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} onClick={() => setConfirmDelete(null)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-danger'} style={isV5 ? { background: '#C0392B', color: '#fff' } : undefined} onClick={() => {
                if (confirmDelete.type === 'membre') {
                  saveMembres(membres.filter(m => m.id !== confirmDelete.id))
                } else {
                  saveEquipes(equipes.filter(e => e.id !== confirmDelete.id))
                }
                setConfirmDelete(null)
              }}>{isPt ? 'Eliminar' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
