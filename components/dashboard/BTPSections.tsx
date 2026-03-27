'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

/* ══════════════════════════════════════════════════════════
   ÉQUIPES BTP — V2
   Membres individuels · Équipes · Rôles & Permissions
══════════════════════════════════════════════════════════ */

type TypeCompte = 'ouvrier' | 'chef_chantier' | 'conducteur_travaux' | 'secretaire' | 'gerant'
type ModulePerms = 'pointage' | 'agenda' | 'chantiers' | 'devis' | 'rapports' | 'equipes' | 'materiaux' | 'comptabilite'

interface PermMap { pointage: boolean; agenda: boolean; chantiers: boolean; devis: boolean; rapports: boolean; equipes: boolean; materiaux: boolean; comptabilite: boolean }
interface Membre { id: string; prenom: string; nom: string; telephone: string; email: string; typeCompte: TypeCompte; rolePerso: string; equipeId: string; createdAt: string }
interface EquipeBTP { id: string; nom: string; metier: string; chantierId: string; membreIds: string[]; createdAt: string }
interface RolePerso { id: string; nom: string; permissions: PermMap }

const TYPE_LABELS: Record<TypeCompte, string> = {
  ouvrier: 'Ouvrier',
  chef_chantier: 'Chef de chantier',
  conducteur_travaux: 'Conducteur de travaux',
  secretaire: 'Secrétaire',
  gerant: 'Gérant / Patron',
}
const TYPE_COLORS: Record<TypeCompte, string> = {
  ouvrier: 'v22-tag v22-tag-gray',
  chef_chantier: 'v22-tag v22-tag-amber',
  conducteur_travaux: 'v22-tag v22-tag-yellow',
  secretaire: 'v22-tag v22-tag-green',
  gerant: 'v22-tag v22-tag-red',
}
const MODULE_LABELS: Record<ModulePerms, string> = {
  pointage: '⏱ Pointage', agenda: '📅 Agenda', chantiers: '🏗️ Chantiers',
  devis: '📋 Devis', rapports: '📊 Rapports', equipes: '👷 Équipes',
  materiaux: '🧱 Matériaux', comptabilite: '💰 Comptabilité',
}
const MODULES: ModulePerms[] = ['pointage', 'agenda', 'chantiers', 'devis', 'rapports', 'equipes', 'materiaux', 'comptabilite']

const DEFAULT_PERMS: Record<TypeCompte, PermMap> = {
  ouvrier:           { pointage: true,  agenda: false, chantiers: false, devis: false, rapports: true,  equipes: false, materiaux: false, comptabilite: false },
  chef_chantier:     { pointage: true,  agenda: true,  chantiers: true,  devis: false, rapports: true,  equipes: true,  materiaux: true,  comptabilite: false },
  conducteur_travaux:{ pointage: true,  agenda: true,  chantiers: true,  devis: true,  rapports: true,  equipes: true,  materiaux: true,  comptabilite: false },
  secretaire:        { pointage: false, agenda: true,  chantiers: false, devis: true,  rapports: false, equipes: false, materiaux: false, comptabilite: true  },
  gerant:            { pointage: true,  agenda: true,  chantiers: true,  devis: true,  rapports: true,  equipes: true,  materiaux: true,  comptabilite: true  },
}

const METIERS_FR = ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Multi-corps']

const EMPTY_PERM: PermMap = { pointage: false, agenda: false, chantiers: false, devis: false, rapports: false, equipes: false, materiaux: false, comptabilite: false }

export function EquipesBTPSection({ artisan }: { artisan: any }) {
  const locale = useLocale()
  const isPt = locale === 'pt'

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
    if (!confirm(isPt ? 'Remover membro?' : 'Supprimer ce membre ?')) return
    saveMembres(membres.filter(m => m.id !== id))
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
    if (!confirm(isPt ? 'Remover equipa?' : 'Supprimer cette équipe ?')) return
    saveEquipes(equipes.filter(e => e.id !== id))
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
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">👷 {isPt ? 'Equipas & Colaboradores' : 'Équipes & Collaborateurs'}</h1>
          <p className="v22-page-sub">{isPt ? 'Gerencie membros, equipas e permissões por função' : 'Gérez vos membres, équipes et permissions par rôle'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'membres' && <button className="v22-btn" onClick={() => { setEditingMembre(null); setMForm({ prenom: '', nom: '', telephone: '', email: '', typeCompte: 'ouvrier', rolePerso: '', equipeId: '' }); setShowMembreModal(true) }}>➕ {isPt ? 'Membro' : 'Membre'}</button>}
          {tab === 'equipes' && <button className="v22-btn" onClick={() => { setEditingEquipe(null); setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] }); setShowEquipeModal(true) }}>➕ {isPt ? 'Equipa' : 'Équipe'}</button>}
          {tab === 'roles'   && <button className="v22-btn" onClick={() => { setRForm({ nom: '', permissions: { ...EMPTY_PERM } }); setShowRoleModal(true) }}>➕ {isPt ? 'Criar função' : 'Créer un rôle'}</button>}
        </div>
      </div>

      {/* Stats row */}
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px 16px', borderBottom: '1px solid var(--v22-border)' }}>
        {(['membres', 'equipes', 'roles'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? 'v22-btn v22-btn-sm' : 'v22-btn v22-btn-sm'}
            style={{ background: tab === t ? 'var(--v22-yellow)' : 'transparent', color: tab === t ? '#0D1B2E' : 'var(--v22-text-mid)', fontWeight: tab === t ? 700 : 400 }}>
            {t === 'membres' ? (isPt ? '👤 Membros' : '👤 Membres') : t === 'equipes' ? (isPt ? '👷 Equipas' : '👷 Équipes') : (isPt ? '🔑 Funções' : '🔑 Rôles & Accès')}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* ── TAB MEMBRES ── */}
        {tab === 'membres' && (
          membres.length === 0 ? (
            <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhum colaborador' : 'Aucun collaborateur'}</div>
              <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Adicione os membros da sua empresa' : 'Ajoutez les membres de votre entreprise'}</p>
              <button className="v22-btn" onClick={() => setShowMembreModal(true)}>➕ {isPt ? 'Adicionar membro' : 'Ajouter un membre'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {membres.map(m => {
                const equipe = equipes.find(e => e.id === m.equipeId)
                return (
                  <div key={m.id} className="v22-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{m.prenom} {m.nom}</div>
                        {m.rolePerso && <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', marginTop: 2 }}>{m.rolePerso}</div>}
                      </div>
                      <span className={TYPE_COLORS[m.typeCompte]} style={{ fontSize: 11 }}>{TYPE_LABELS[m.typeCompte]}</span>
                    </div>
                    {m.telephone && <div className="v22-card-meta" style={{ fontSize: 12, marginBottom: 4 }}>📱 {m.telephone}</div>}
                    {m.email && <div className="v22-card-meta" style={{ fontSize: 12, marginBottom: 4 }}>✉️ {m.email}</div>}
                    {equipe && <div className="v22-card-meta" style={{ fontSize: 12, marginBottom: 8 }}>👷 {equipe.nom}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="v22-btn v22-btn-sm" style={{ flex: 1 }} onClick={() => openEditMembre(m)}>✏️ {isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-red-bg, #FFF0F0)', color: 'var(--v22-red, #C0392B)' }} onClick={() => deleteMembre(m.id)}>🗑</button>
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
            <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👷</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma equipa' : 'Aucune équipe'}</div>
              <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Crie equipas e afecte-as a obras' : 'Créez des équipes et affectez-les à vos chantiers'}</p>
              <button className="v22-btn" onClick={() => setShowEquipeModal(true)}>➕ {isPt ? 'Criar equipa' : 'Créer une équipe'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {equipes.map(eq => {
                const eqMembres = membres.filter(m => eq.membreIds.includes(m.id))
                return (
                  <div key={eq.id} className="v22-card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{eq.nom}</div>
                        {eq.metier && <div style={{ fontSize: 12, color: 'var(--v22-yellow)', fontWeight: 600, marginTop: 2 }}>{eq.metier}</div>}
                      </div>
                      <span className="v22-tag v22-tag-green" style={{ fontSize: 11 }}>{eqMembres.length} {isPt ? 'membros' : 'membres'}</span>
                    </div>
                    {eqMembres.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {eqMembres.map(m => (
                          <span key={m.id} className="v22-tag v22-tag-gray" style={{ fontSize: 11 }}>{m.prenom} {m.nom[0]}.</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="v22-btn v22-btn-sm" style={{ flex: 1 }} onClick={() => { setEditingEquipe(eq); setEForm({ nom: eq.nom, metier: eq.metier, chantierId: eq.chantierId, membreIds: eq.membreIds }); setShowEquipeModal(true) }}>✏️</button>
                      <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-red-bg, #FFF0F0)', color: 'var(--v22-red, #C0392B)' }} onClick={() => deleteEquipe(eq.id)}>🗑</button>
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
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">🏷️ {isPt ? 'Permissões por tipo de conta' : 'Accès par type de compte'}</span>
                <span className="v22-card-meta" style={{ fontSize: 11 }}>{isPt ? 'Configuração padrão — não editável' : 'Défauts système — non modifiables'}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--v22-text-mid)', fontWeight: 600 }}>{isPt ? 'Tipo' : 'Type'}</th>
                      {MODULES.map(mod => <th key={mod} style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{MODULE_LABELS[mod].split(' ')[0]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(DEFAULT_PERMS) as TypeCompte[]).map(type => (
                      <tr key={type} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                        <td style={{ padding: '8px 12px' }}><span className={TYPE_COLORS[type]} style={{ fontSize: 11 }}>{TYPE_LABELS[type]}</span></td>
                        {MODULES.map(mod => (
                          <td key={mod} style={{ padding: '8px 8px', textAlign: 'center' }}>
                            {DEFAULT_PERMS[type][mod] ? <span style={{ color: 'var(--v22-green, #1D9E75)', fontWeight: 700 }}>✓</span> : <span style={{ color: 'var(--v22-border)', fontSize: 10 }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 16px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MODULES.map(mod => <span key={mod} style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>{MODULE_LABELS[mod]}</span>)}
                </div>
              </div>
            </div>

            {/* Rôles personnalisés */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">🔑 {isPt ? 'Funções personalizadas' : 'Rôles personnalisés'}</span>
              </div>
              <div className="v22-card-body">
                {roles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <p className="v22-card-meta" style={{ marginBottom: 12 }}>{isPt ? 'Crie funções específicas (ex: Pedreiro, Canalizador...)' : 'Créez des rôles spécifiques (ex: Maçon, Carreleur...)'}</p>
                    <button className="v22-btn v22-btn-sm" onClick={() => setShowRoleModal(true)}>➕ {isPt ? 'Criar função' : 'Créer un rôle'}</button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--v22-text-mid)', fontWeight: 600 }}>{isPt ? 'Função' : 'Rôle'}</th>
                          {MODULES.map(mod => <th key={mod} style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{MODULE_LABELS[mod].split(' ')[0]}</th>)}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map(role => (
                          <tr key={role.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{role.nom}</td>
                            {MODULES.map(mod => (
                              <td key={mod} style={{ padding: '8px 8px', textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleRolePerm(role.id, mod)}
                                  style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 14,
                                    color: role.permissions[mod] ? 'var(--v22-green, #1D9E75)' : 'var(--v22-border)' }}>
                                  {role.permissions[mod] ? '✓' : '○'}
                                </button>
                              </td>
                            ))}
                            <td style={{ padding: '8px 8px' }}>
                              <button className="v22-btn v22-btn-sm" style={{ padding: '2px 8px', background: 'none', color: 'var(--v22-red, #C0392B)' }} onClick={() => deleteRole(role.id)}>✕</button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title">👤 {editingMembre ? (isPt ? 'Editar membro' : 'Modifier le membre') : (isPt ? 'Novo colaborador' : 'Nouveau collaborateur')}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => { setShowMembreModal(false); setEditingMembre(null) }}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Primeiro nome *' : 'Prénom *'}</label>
                  <input className="v22-form-input" value={mForm.prenom} onChange={e => setMForm({ ...mForm, prenom: e.target.value })} placeholder={isPt ? 'Jean' : 'Jean'} />
                </div>
                <div>
                  <label className="v22-form-label">{isPt ? 'Apelido *' : 'Nom *'}</label>
                  <input className="v22-form-input" value={mForm.nom} onChange={e => setMForm({ ...mForm, nom: e.target.value })} placeholder="Dupont" />
                </div>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Tipo de conta' : 'Type de compte'}</label>
                <select className="v22-form-input" value={mForm.typeCompte} onChange={e => setMForm({ ...mForm, typeCompte: e.target.value as TypeCompte })}>
                  {(Object.entries(TYPE_LABELS) as [TypeCompte, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Função / Especialidade' : 'Rôle / Spécialité'} <span style={{ fontWeight: 400, color: 'var(--v22-text-mid)' }}>(ex: Maçon, Carreleur...)</span></label>
                {roles.length > 0 ? (
                  <select className="v22-form-input" value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })}>
                    <option value="">{isPt ? '— Sem função específica' : '— Sans rôle spécifique'}</option>
                    {roles.map(r => <option key={r.id} value={r.nom}>{r.nom}</option>)}
                  </select>
                ) : (
                  <input className="v22-form-input" value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur...'} />
                )}
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Equipa' : 'Équipe'}</label>
                <select className="v22-form-input" value={mForm.equipeId} onChange={e => setMForm({ ...mForm, equipeId: e.target.value })}>
                  <option value="">{isPt ? '— Sem equipa' : '— Sans équipe'}</option>
                  {equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">📱 Téléphone</label>
                  <input className="v22-form-input" value={mForm.telephone} onChange={e => setMForm({ ...mForm, telephone: e.target.value })} placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="v22-form-label">✉️ Email</label>
                  <input className="v22-form-input" value={mForm.email} onChange={e => setMForm({ ...mForm, email: e.target.value })} placeholder="jean@example.com" />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => { setShowMembreModal(false); setEditingMembre(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={submitMembre} disabled={!mForm.prenom.trim() || !mForm.nom.trim()}>
                {editingMembre ? (isPt ? '✅ Guardar' : '✅ Sauvegarder') : (isPt ? '✅ Adicionar' : '✅ Ajouter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ÉQUIPE ── */}
      {showEquipeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title">👷 {editingEquipe ? (isPt ? 'Editar equipa' : "Modifier l'équipe") : (isPt ? 'Nova equipa' : 'Nouvelle équipe')}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Nome da equipa *' : "Nom de l'équipe *"}</label>
                <input className="v22-form-input" value={eForm.nom} onChange={e => setEForm({ ...eForm, nom: e.target.value })} placeholder={isPt ? 'ex: Equipa Alvenaria A' : 'ex: Équipe Maçonnerie A'} />
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Especialidade' : 'Corps de métier'}</label>
                <select className="v22-form-input" value={eForm.metier} onChange={e => setEForm({ ...eForm, metier: e.target.value })}>
                  <option value="">—</option>
                  {METIERS_FR.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Membros da equipa' : "Membres de l'équipe"}</label>
                {membres.length === 0 ? (
                  <p className="v22-card-meta" style={{ fontSize: 12 }}>{isPt ? 'Adicione colaboradores primeiro' : 'Ajoutez des collaborateurs d\'abord'}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
                    {membres.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox"
                          checked={eForm.membreIds.includes(m.id)}
                          onChange={e => setEForm({ ...eForm, membreIds: e.target.checked ? [...eForm.membreIds, m.id] : eForm.membreIds.filter(id => id !== m.id) })}
                          style={{ accentColor: 'var(--v22-yellow)', width: 14, height: 14 }}
                        />
                        <span>{m.prenom} {m.nom}</span>
                        <span className={TYPE_COLORS[m.typeCompte]} style={{ fontSize: 10 }}>{TYPE_LABELS[m.typeCompte]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={submitEquipe} disabled={!eForm.nom.trim()}>
                {editingEquipe ? '✅ Sauvegarder' : (isPt ? '✅ Criar' : '✅ Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RÔLE ── */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 480 }}>
            <div className="v22-card-head">
              <span className="v22-card-title">🔑 {isPt ? 'Nova função personalizada' : 'Nouveau rôle personnalisé'}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Nome da função *' : 'Nom du rôle *'}</label>
                <input className="v22-form-input" value={rForm.nom} onChange={e => setRForm({ ...rForm, nom: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur, Chauffeur...'} />
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Acessos' : 'Accès autorisés'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {MODULES.map(mod => (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '6px 8px', background: 'var(--v22-bg)', borderRadius: 6 }}>
                      <input type="checkbox"
                        checked={rForm.permissions[mod]}
                        onChange={e => setRForm({ ...rForm, permissions: { ...rForm.permissions, [mod]: e.target.checked } })}
                        style={{ accentColor: 'var(--v22-yellow)', width: 14, height: 14 }}
                      />
                      <span>{MODULE_LABELS[mod]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowRoleModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={submitRole} disabled={!rForm.nom.trim()}>✅ {isPt ? 'Criar função' : 'Créer le rôle'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ CHANTIERS BTP SECTION ══════════ */
export function ChantiersBTPSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_chantiers_${artisan?.id}`
  const [chantiers, setChantiers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'Terminés' | 'En attente'>('Tous')
  const [form, setForm] = useState({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })

  const handleSave = () => {
    if (!form.titre.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...chantiers]
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = chantiers.map(c => c.id === id ? { ...c, statut } : c)
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const filtered = filter === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filter)
  const STATUS_COLORS: Record<string, string> = { 'En cours': 'bg-blue-100 text-blue-700', 'Terminé': 'bg-green-100 text-green-700', 'En attente': 'bg-orange-100 text-orange-700', 'Annulé': 'bg-red-100 text-red-700' }

  const isPt = locale === 'pt'

  const STATUS_V22: Record<string, string> = {
    'En cours': 'v22-tag v22-tag-green',
    'Terminé':  'v22-tag v22-tag-gray',
    'En attente': 'v22-tag v22-tag-amber',
    'Annulé':   'v22-tag v22-tag-red',
  }

  return (
    <div>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">🏗️ {isPt ? 'Obras / Chantiers' : 'Chantiers'}</h1>
          <p className="v22-page-sub">{isPt ? `${chantiers.length} obra(s) registada(s)` : `${chantiers.length} chantier(s) enregistré(s)`}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowModal(true)}>➕ {isPt ? 'Nova obra' : 'Nouveau chantier'}</button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Filtres */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['Tous', 'En cours', 'En attente', 'Terminés'] as const).map(f => {
            const labels: Record<string, string> = {
              'Tous': isPt ? 'Todas' : 'Toutes',
              'En cours': isPt ? 'Em curso' : 'En cours',
              'En attente': isPt ? 'Pendentes' : 'En attente',
              'Terminés': isPt ? 'Concluídas' : 'Terminés',
            }
            const count = f === 'Tous' ? chantiers.length : chantiers.filter(c => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`v22-tag ${filter === f ? 'v22-tag-yellow' : 'v22-tag-gray'}`}
                style={{ cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma obra' : 'Aucun chantier'}</div>
            <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}</p>
            <button className="v22-btn" onClick={() => setShowModal(true)}>➕ {isPt ? 'Criar obra' : 'Créer un chantier'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => (
              <div key={c.id} className="v22-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.titre}</span>
                      <span className={STATUS_V22[c.statut] || 'v22-tag v22-tag-gray'} style={{ fontSize: 11 }}>{c.statut}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {c.client && <span className="v22-card-meta" style={{ fontSize: 12 }}>👤 {c.client}</span>}
                      {c.adresse && <span className="v22-card-meta" style={{ fontSize: 12 }}>📍 {c.adresse}</span>}
                      {(c.dateDebut || c.dateFin) && <span className="v22-card-meta" style={{ fontSize: 12 }}>📅 {c.dateDebut || '?'} → {c.dateFin || '?'}</span>}
                      {c.budget && <span className="v22-card-meta" style={{ fontSize: 12 }}>💰 {Number(c.budget).toLocaleString('fr-FR')} €</span>}
                    </div>
                    {c.description && <p className="v22-card-meta" style={{ fontSize: 12, marginTop: 6 }}>{c.description}</p>}
                  </div>
                  <select
                    value={c.statut}
                    onChange={e => changeStatut(c.id, e.target.value)}
                    className="v22-form-input"
                    style={{ minWidth: 130, fontSize: 13, padding: '6px 10px' }}>
                    {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => {
                      const sl: Record<string, string> = isPt
                        ? { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }
                        : { 'En attente': 'En attente', 'En cours': 'En cours', 'Terminé': 'Terminé', 'Annulé': 'Annulé' }
                      return <option key={s} value={s}>{sl[s]}</option>
                    })}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouveau chantier */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title">🏗️ {isPt ? 'Nova obra' : 'Nouveau chantier'}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className="v22-form-input" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={isPt ? 'ex: Immeuble R+3 — Gros œuvre' : 'ex: Immeuble R+3 — Gros œuvre'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Cliente / Dono de obra' : 'Client / Maître d\'ouvrage'}</label>
                  <input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={isPt ? 'Nome do cliente' : 'Nom du client'} />
                </div>
                <div>
                  <label className="v22-form-label">💰 Budget HT (€)</label>
                  <input type="number" className="v22-form-input" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="v22-form-label">📍 {isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                <input className="v22-form-input" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={isPt ? 'Rua, cidade...' : 'Rue, ville...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">📅 {isPt ? 'Data de início' : 'Date de début'}</label>
                  <input type="date" className="v22-form-input" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} />
                </div>
                <div>
                  <label className="v22-form-label">📅 {isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className="v22-form-input" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Descrição' : 'Description'}</label>
                <textarea className="v22-form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={isPt ? 'Detalhes da obra...' : 'Détails du chantier...'} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={handleSave} disabled={!form.titre.trim()}>✅ {isPt ? 'Criar obra' : 'Créer le chantier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — PLANNING GANTT
// ══════════════════════════════════════════════
export function GanttSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `gantt_${userId}`
  interface Tache {
    id: string; nom: string; chantier: string; responsable: string
    debut: string; fin: string; avancement: number
    statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'; couleur: string
  }
  const [taches, setTaches] = useState<Tache[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié' as const, couleur: '#3B82F6' })

  const save = (data: Tache[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié', couleur: '#3B82F6' }) }
  const updateAvancement = (id: string, val: number) => save(taches.map(tc => tc.id === id ? { ...tc, avancement: val, statut: val === 100 ? 'terminé' : val > 0 ? 'en_cours' : 'planifié' } : tc))
  const deleteTache = (id: string) => save(taches.filter(tc => tc.id !== id))

  const allDates = taches.flatMap(t => [new Date(t.debut), new Date(t.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 30 * 86400000)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000)
  const getBar = (t: Tache) => {
    const start = Math.max(0, (new Date(t.debut).getTime() - minDate.getTime()) / 86400000)
    const duration = Math.max(1, (new Date(t.fin).getTime() - new Date(t.debut).getTime()) / 86400000)
    return { left: `${(start / totalDays) * 100}%`, width: `${(duration / totalDays) * 100}%` }
  }
  const statColors: Record<string, string> = { planifié: 'bg-gray-400', en_cours: 'bg-blue-500', terminé: 'bg-green-500', en_retard: 'bg-red-500' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📅'} {t('proDash.btp.gantt.title')}</h2><p className="text-gray-500 text-sm mt-1">{taches.length} {t('proDash.btp.gantt.tachesPlanifiees')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.gantt.ajouterTache')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{t('proDash.btp.gantt.nouvelleTache')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.nom')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.gantt.nomPlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder={t('proDash.btp.gantt.chantierPlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.responsable')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.couleur')}</label><input type="color" className="mt-1 w-full border rounded-lg px-3 py-2 h-9" value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.debut')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.gantt.fin')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addTache} disabled={!form.nom || !form.debut || !form.fin} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.gantt.ajouter')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.gantt.annuler')}</button>
          </div>
        </div>
      )}
      {taches.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">{'📅'}</div><p className="font-medium">{t('proDash.btp.gantt.aucuneTache')}</p></div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {[t('proDash.btp.gantt.colTache'), t('proDash.btp.gantt.colChantier'), t('proDash.btp.gantt.colStatut'), t('proDash.btp.gantt.colPlanning'), t('proDash.btp.gantt.colAvancement'), ''].map(h => <th key={h || '_'} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {taches.map(tc => {
                  const bar = getBar(tc)
                  const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
                  return (
                    <tr key={tc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-sm">{tc.nom}</div><div className="text-xs text-gray-500">{tc.responsable}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{tc.chantier}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${statColors[tc.statut]}`}>{statLabels[tc.statut] || tc.statut}</span></td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="relative h-6 bg-gray-100 rounded">
                          <div className="absolute top-1 h-4 rounded opacity-80" style={{ left: bar.left, width: bar.width, backgroundColor: tc.couleur }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                          <span>{tc.debut ? new Date(tc.debut).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                          <span>{tc.fin ? new Date(tc.fin).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" value={tc.avancement} onChange={e => updateAvancement(tc.id, Number(e.target.value))} className="flex-1 h-1.5 accent-blue-600" />
                          <span className="text-xs font-medium w-8">{tc.avancement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><button onClick={() => deleteTache(tc.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => {
          const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
          return (
          <div key={s} className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold">{taches.filter(tc => tc.statut === s).length}</div>
            <div className="text-sm text-gray-500 capitalize">{statLabels[s]}</div>
          </div>
        )})}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SITUATIONS DE TRAVAUX
// ══════════════════════════════════════════════
export function SituationsTravaux({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `situations_${userId}`
  interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
  interface Situation {
    id: string; chantier: string; client: string; numero: number; date: string
    montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
  }
  const [situations, setSituations] = useState<Situation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Situation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const save = (data: Situation[]) => { setSituations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createSit = () => {
    const numero = situations.filter(s => s.chantier === form.chantier).length + 1
    const s: Situation = { id: Date.now().toString(), ...form, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' }
    save([...situations, s]); setSelected(s); setShowForm(false)
  }
  const addPoste = () => {
    if (!selected) return
    const updated = { ...selected, travaux: [...selected.travaux, { ...newPoste }] }
    save(situations.map(s => s.id === selected.id ? updated : s)); setSelected(updated)
    setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, t) => sum + t.quantite * t.prixUnit * (t.avancement / 100), 0)
  const changeStatut = (id: string, statut: Situation['statut']) => {
    const upd = situations.map(s => s.id === id ? { ...s, statut } : s)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const statColors: Record<string, string> = { brouillon: 'bg-gray-100 text-gray-700', envoyée: 'bg-blue-100 text-blue-700', validée: 'bg-yellow-100 text-yellow-700', payée: 'bg-green-100 text-green-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📊'} {t('proDash.btp.situations.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.situations.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.situations.nouvelleSituation')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.situations.montantMarche')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createSit} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.situations.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-3">
          {situations.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.btp.situations.aucuneSituation')}</div> : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
            <div key={s.id} onClick={() => setSelected(s)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === s.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex justify-between mb-1"><span className="font-semibold text-sm">{t('proDash.btp.situations.situation')} n°{s.numero}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statColors[s.statut]}`}>{sitStatLabels[s.statut] || s.statut}</span></div>
              <div className="text-sm text-gray-600">{s.chantier}</div>
              <div className="text-xs text-gray-500">{s.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(s).toLocaleString(dateLocale)} €</div>
            </div>
          )})}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{t('proDash.btp.situations.situation')} n°{selected.numero} — {selected.chantier}</h3>
                <div className="flex gap-2">
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{[t('proDash.btp.situations.colPoste'), t('proDash.btp.situations.colQte'), t('proDash.btp.situations.colUnite'), t('proDash.btp.situations.colPU'), t('proDash.btp.situations.colAvt'), t('proDash.btp.situations.colMontant')].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {selected.travaux.map((tr, i) => (
                    <tr key={i}><td className="px-3 py-2">{tr.poste}</td><td className="px-3 py-2">{tr.quantite}</td><td className="px-3 py-2">{tr.unite}</td><td className="px-3 py-2">{tr.prixUnit.toLocaleString(dateLocale)}</td><td className="px-3 py-2">{tr.avancement}%</td><td className="px-3 py-2 font-semibold">{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-blue-50 font-bold"><td colSpan={5} className="px-3 py-2 text-right">{t('proDash.btp.situations.total')}</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString(dateLocale)} €</td></tr></tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <input className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="border rounded px-2 py-1.5 text-sm" value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>{['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}</select>
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1"><span className="text-sm text-gray-600">{t('proDash.btp.situations.avancement')}</span><input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} className="flex-1 accent-blue-600" /><span className="text-sm w-8">{newPoste.avancement}%</span></div>
                  <button onClick={addPoste} disabled={!newPoste.poste} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">{t('proDash.btp.situations.ajouter')}</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'📊'}</div><p>{t('proDash.btp.situations.selectionnerSituation')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — RETENUES DE GARANTIE
// ══════════════════════════════════════════════
export function RetenuesGarantieSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `retenues_${userId}`
  interface Retenue {
    id: string; chantier: string; client: string; montantMarche: number; tauxRetenue: number
    montantRetenu: number; dateFinTravaux: string; dateLiberation?: string
    statut: 'active' | 'mainlevée_demandée' | 'libérée'; caution: boolean
  }
  const [retenues, setRetenues] = useState<Retenue[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })

  const save = (data: Retenue[]) => { setRetenues(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addRetenue = () => {
    save([...retenues, { id: Date.now().toString(), ...form, montantRetenu: form.montantMarche * form.tauxRetenue / 100, statut: 'active' }])
    setShowForm(false); setForm({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })
  }
  const changeStatut = (id: string, statut: Retenue['statut']) => save(retenues.map(r => r.id === id ? { ...r, statut, dateLiberation: statut === 'libérée' ? new Date().toISOString().split('T')[0] : r.dateLiberation } : r))

  const totalRetenu = retenues.filter(r => r.statut === 'active').reduce((s, r) => s + r.montantRetenu, 0)
  const totalLibéré = retenues.filter(r => r.statut === 'libérée').reduce((s, r) => s + r.montantRetenu, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🔒'} {t('proDash.btp.retenues.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.retenues.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.retenues.nouvelleRetenue')}</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="text-orange-600 text-sm font-medium">{t('proDash.btp.retenues.retenuEnAttente')}</div><div className="text-2xl font-bold text-orange-700 mt-1">{totalRetenu.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-600 text-sm font-medium">{t('proDash.btp.retenues.libere')}</div><div className="text-2xl font-bold text-green-700 mt-1">{totalLibéré.toLocaleString(dateLocale)} €</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-600 text-sm font-medium">{t('proDash.btp.retenues.chantiersConcernes')}</div><div className="text-2xl font-bold text-blue-700 mt-1">{retenues.length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.client')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.montantMarcheHT')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.tauxRetenue')}</label><input type="number" min="1" max="10" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.retenues.finTravaux')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} /></div>
            <div className="flex items-center gap-2 mt-6"><input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} className="w-4 h-4" /><label htmlFor="caution_ret" className="text-sm text-gray-700">{t('proDash.btp.retenues.cautionBancaire')}</label></div>
          </div>
          {form.montantMarche > 0 && <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">{'💡'} {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} €</strong></div>}
          <div className="flex gap-3 mt-4">
            <button onClick={addRetenue} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.retenues.enregistrer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.retenues.annuler')}</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{[t('proDash.btp.retenues.colChantier'), t('proDash.btp.retenues.colClient'), t('proDash.btp.retenues.colMarcheHT'), t('proDash.btp.retenues.colRetenu'), t('proDash.btp.retenues.colFinTravaux'), t('proDash.btp.retenues.colStatut'), t('proDash.btp.retenues.colActions')].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {retenues.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-500 text-sm">{t('proDash.btp.retenues.aucuneRetenue')}</td></tr> : retenues.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-sm">{r.chantier}</td>
                <td className="px-4 py-3 text-sm">{r.client}</td>
                <td className="px-4 py-3 text-sm">{r.montantMarche.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3 text-sm font-semibold text-orange-700">{r.montantRetenu.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3 text-sm">{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.statut === 'active' ? 'bg-orange-100 text-orange-700' : r.statut === 'mainlevée_demandée' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{r.statut}</span></td>
                <td className="px-4 py-3">
                  {r.statut === 'active' && <button onClick={() => changeStatut(r.id, 'mainlevée_demandée')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                  {r.statut === 'mainlevée_demandée' && <button onClick={() => changeStatut(r.id, 'libérée')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">{t('proDash.btp.retenues.liberer')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — POINTAGE ÉQUIPES
// ══════════════════════════════════════════════
export function PointageEquipesSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `pointage_${userId}`
  interface Pointage {
    id: string; employe: string; poste: string; chantier: string; date: string
    heureArrivee: string; heureDepart: string; pauseMinutes: number; heuresTravaillees: number; notes: string
  }
  const [pointages, setPointages] = useState<Pointage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmploye, setFilterEmploye] = useState('')
  const [form, setForm] = useState({ employe: '', poste: '', chantier: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })

  const save = (data: Pointage[]) => { setPointages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const calcH = (a: string, d: string, p: number) => {
    const [ah, am] = a.split(':').map(Number); const [dh, dm] = d.split(':').map(Number)
    return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - p) / 60)
  }
  const addPointage = () => {
    save([...pointages, { id: Date.now().toString(), ...form, heuresTravaillees: Math.round(calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100 }])
    setShowForm(false)
  }
  const deleteP = (id: string) => save(pointages.filter(p => p.id !== id))
  const employes = [...new Set(pointages.map(p => p.employe))].filter(Boolean)
  const filtered = pointages.filter(p => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s, p) => s + p.heuresTravaillees, 0)
  const heuresByEmp = employes.map(e => ({ employe: e, heures: pointages.filter(p => p.employe === e).reduce((s, p) => s + p.heuresTravaillees, 0), jours: new Set(pointages.filter(p => p.employe === e).map(p => p.date)).size }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'⏱️'} {t('proDash.btp.pointage.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.pointage.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.pointage.pointer')}</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.employe')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder={t('proDash.btp.pointage.employePlaceholder')} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.poste')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.poste} onChange={e => setForm({...form, poste: e.target.value})}><option value="">{t('proDash.btp.pointage.selectionner')}</option>{[{k:'chefChantier'},{k:'macon'},{k:'electricien'},{k:'plombier'},{k:'charpentier'},{k:'peintre'},{k:'manoeuvre'}].map(p => <option key={p.k} value={t(`proDash.btp.pointage.${p.k}`)}>{t(`proDash.btp.pointage.${p.k}`)}</option>)}</select></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.chantier')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.date')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.arrivee')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureArrivee} onChange={e => setForm({...form, heureArrivee: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.depart')}</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureDepart} onChange={e => setForm({...form, heureDepart: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.pauseMin')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.pauseMinutes} onChange={e => setForm({...form, pauseMinutes: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="text-sm font-medium text-gray-700">{t('proDash.btp.pointage.notes')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">{'⏱️'} {t('proDash.btp.pointage.heures')} <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong></div>
          <div className="flex gap-3 mt-4">
            <button onClick={addPointage} disabled={!form.employe} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.pointage.enregistrer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.pointage.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex gap-3 mb-4">
            <div><label className="text-xs font-medium text-gray-600">{t('proDash.btp.pointage.date')}</label><input type="date" className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-gray-600">{t('proDash.btp.pointage.employe').replace(' *', '')}</label><select className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}><option value="">{t('proDash.btp.pointage.tous')}</option>{employes.map(e => <option key={e}>{e}</option>)}</select></div>
            <div className="flex items-end"><span className="text-sm text-gray-600 pb-2">{filtered.length} {t('proDash.btp.pointage.pointages')} — <strong>{totalH.toFixed(1)}h</strong></span></div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b"><tr>{[t('proDash.btp.pointage.colEmploye'), t('proDash.btp.pointage.colPoste'), t('proDash.btp.pointage.colChantier'), t('proDash.btp.pointage.colDate'), t('proDash.btp.pointage.colArrivee'), t('proDash.btp.pointage.colDepart'), t('proDash.btp.pointage.colHeures'), ''].map(h => <th key={h || '_'} className="text-left text-xs font-semibold text-gray-600 pb-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-sm">{t('proDash.btp.pointage.aucunPointage')}</td></tr> : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{p.employe}</td><td className="py-2 text-gray-600">{p.poste}</td><td className="py-2 text-gray-600">{p.chantier}</td>
                  <td className="py-2">{new Date(p.date).toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                  <td className="py-2">{p.heureArrivee}</td><td className="py-2">{p.heureDepart}</td>
                  <td className="py-2 font-semibold text-blue-700">{p.heuresTravaillees}h</td>
                  <td className="py-2"><button onClick={() => deleteP(p.id)} className="text-red-400 hover:text-red-600">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('proDash.btp.pointage.recapEmployes')}</h4>
          {heuresByEmp.length === 0 ? <p className="text-xs text-gray-500">{t('proDash.btp.pointage.aucuneDonnee')}</p> : heuresByEmp.map(e => (
            <div key={e.employe} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><div className="text-sm font-medium">{e.employe}</div><div className="text-xs text-gray-500">{e.jours} {t('proDash.btp.pointage.jours')}</div></div>
              <div className="text-sm font-bold text-blue-700">{e.heures.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SOUS-TRAITANCE DC4
// ══════════════════════════════════════════════
export function SousTraitanceDC4Section({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dc4_${userId}`
  interface SousTraitant {
    id: string; entreprise: string; siret: string; responsable: string; email: string
    telephone: string; adresse: string; chantier: string; lot: string
    montantMarche: number; tauxTVA: number; statut: 'en_attente' | 'agréé' | 'refusé'; dateAgrement?: string; dc4Genere: boolean
  }
  const [soustraitants, setSoustraitants] = useState<SousTraitant[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })

  const save = (data: SousTraitant[]) => { setSoustraitants(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addST = () => {
    save([...soustraitants, { id: Date.now().toString(), ...form, statut: 'en_attente', dc4Genere: false }])
    setShowForm(false); setForm({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })
  }
  const agréer = (id: string) => save(soustraitants.map(s => s.id === id ? { ...s, statut: 'agréé', dateAgrement: new Date().toISOString().split('T')[0] } : s))
  const genererDC4 = (st: SousTraitant) => {
    const content = `DC4 — ACTE SPÉCIAL DE SOUS-TRAITANCE\n\nChantier : ${st.chantier}\nLot : ${st.lot}\nSous-traitant : ${st.entreprise}\nSIRET : ${st.siret}\nReprésentant : ${st.responsable}\n\nMontant HT : ${st.montantMarche.toLocaleString(dateLocale)} €\nTVA : ${st.tauxTVA}%\nMontant TTC : ${(st.montantMarche * (1 + st.tauxTVA / 100)).toLocaleString(dateLocale)} €\nDate agrément : ${st.dateAgrement || '—'}\n\nSignature maître d'ouvrage : _______________\nSignature entreprise principale : _______________\nSignature sous-traitant : _______________`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `DC4_${st.entreprise}.txt`; a.click()
    URL.revokeObjectURL(url)
    save(soustraitants.map(s => s.id === st.id ? { ...s, dc4Genere: true } : s))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'🤝'} {t('proDash.btp.sousTraitance.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.sousTraitance.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.sousTraitance.ajouterSousTraitant')}</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><div className="text-yellow-700 text-sm font-medium">{t('proDash.btp.sousTraitance.enAttente')}</div><div className="text-2xl font-bold text-yellow-700 mt-1">{soustraitants.filter(s => s.statut === 'en_attente').length}</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-700 text-sm font-medium">{t('proDash.btp.sousTraitance.agrees')}</div><div className="text-2xl font-bold text-green-700 mt-1">{soustraitants.filter(s => s.statut === 'agréé').length}</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-700 text-sm font-medium">{t('proDash.btp.sousTraitance.dc4Generes')}</div><div className="text-2xl font-bold text-blue-700 mt-1">{soustraitants.filter(s => s.dc4Genere).length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {([[t('proDash.btp.sousTraitance.entreprise'), 'entreprise', 'text'], [t('proDash.btp.sousTraitance.siret'), 'siret', 'text'], [t('proDash.btp.sousTraitance.responsable'), 'responsable', 'text'], [t('proDash.btp.sousTraitance.email'), 'email', 'email'], [t('proDash.btp.sousTraitance.telephone'), 'telephone', 'tel'], [t('proDash.btp.sousTraitance.adresse'), 'adresse', 'text'], [t('proDash.btp.sousTraitance.chantier'), 'chantier', 'text'], [t('proDash.btp.sousTraitance.lot'), 'lot', 'text']] as [string, string, string][]).map(([label, key, type]) => (
              <div key={key}><label className="text-sm font-medium text-gray-700">{label}</label><input type={type} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={(form as Record<string, string | number>)[key] as string} onChange={e => setForm({...form, [key]: e.target.value})} /></div>
            ))}
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.sousTraitance.montantHT')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.sousTraitance.tva')}</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxTVA} onChange={e => setForm({...form, tauxTVA: Number(e.target.value)})}>{[20, 10, 5.5, 0].map(tv => <option key={tv} value={tv}>{tv}%</option>)}</select></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addST} disabled={!form.entreprise} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.sousTraitance.ajouter')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.sousTraitance.annuler')}</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{[t('proDash.btp.sousTraitance.colEntreprise'), t('proDash.btp.sousTraitance.colChantierLot'), t('proDash.btp.sousTraitance.colMontantHT'), t('proDash.btp.sousTraitance.colStatut'), t('proDash.btp.sousTraitance.colDC4'), t('proDash.btp.sousTraitance.colActions')].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {soustraitants.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-gray-500 text-sm">{t('proDash.btp.sousTraitance.aucunSousTraitant')}</td></tr> : soustraitants.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium text-sm">{s.entreprise}</div><div className="text-xs text-gray-500">{s.siret}</div></td>
                <td className="px-4 py-3 text-sm"><div>{s.chantier}</div><div className="text-xs text-gray-500">{s.lot}</div></td>
                <td className="px-4 py-3 text-sm font-semibold">{s.montantMarche.toLocaleString(dateLocale)} €</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' : s.statut === 'agréé' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.statut}</span></td>
                <td className="px-4 py-3 text-center">{s.dc4Genere ? '✅' : '—'}</td>
                <td className="px-4 py-3">
                  {s.statut === 'en_attente' && <button onClick={() => agréer(s.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 mr-1">{t('proDash.btp.sousTraitance.agreer')}</button>}
                  {s.statut === 'agréé' && <button onClick={() => genererDC4(s)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">{t('proDash.btp.sousTraitance.genererDC4')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — DPGF / APPELS D'OFFRES
// ══════════════════════════════════════════════
export function DPGFSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dpgf_${userId}`
  interface Lot { numero: string; designation: string; montantHT: number }
  interface AppelOffre { id: string; titre: string; client: string; dateRemise: string; montantEstime: number; statut: 'en_cours' | 'soumis' | 'gagné' | 'perdu'; lots: Lot[] }
  const [appels, setAppels] = useState<AppelOffre[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<AppelOffre | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', dateRemise: '', montantEstime: 0 })
  const [newLot, setNewLot] = useState<Lot>({ numero: '', designation: '', montantHT: 0 })

  const save = (data: AppelOffre[]) => { setAppels(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createAppel = () => {
    const a: AppelOffre = { id: Date.now().toString(), ...form, statut: 'en_cours', lots: [] }
    save([...appels, a]); setSelected(a); setShowForm(false)
  }
  const addLot = () => {
    if (!selected) return
    const updated = { ...selected, lots: [...selected.lots, { ...newLot }] }
    save(appels.map(a => a.id === selected.id ? updated : a)); setSelected(updated)
    setNewLot({ numero: '', designation: '', montantHT: 0 })
  }
  const getTotal = (a: AppelOffre) => a.lots.reduce((s, l) => s + l.montantHT, 0)
  const changeStatut = (id: string, statut: AppelOffre['statut']) => {
    const upd = appels.map(a => a.id === id ? { ...a, statut } : a)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const exportDPGF = (a: AppelOffre) => {
    const rows = a.lots.map(l => `LOT ${l.numero} — ${l.designation.padEnd(40)} ${l.montantHT.toLocaleString(dateLocale)} € HT`).join('\n')
    const content = `DPGF — ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString(dateLocale)} €\nTVA 20% : ${(getTotal(a) * 0.2).toLocaleString(dateLocale)} €\nTOTAL TTC : ${(getTotal(a) * 1.2).toLocaleString(dateLocale)} €`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }
  const statColors: Record<string, string> = { en_cours: 'bg-blue-100 text-blue-700', soumis: 'bg-yellow-100 text-yellow-700', gagné: 'bg-green-100 text-green-700', perdu: 'bg-red-100 text-red-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">{'📋'} {t('proDash.btp.dpgf.title')}</h2><p className="text-gray-500 text-sm mt-1">{t('proDash.btp.dpgf.subtitle')}</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">{t('proDash.btp.dpgf.nouvelAppel')}</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => {
          const dpgfStatLabels: Record<string, string> = { en_cours: t('proDash.btp.dpgf.enCours'), soumis: t('proDash.btp.dpgf.soumis'), gagné: t('proDash.btp.dpgf.gagne'), perdu: t('proDash.btp.dpgf.perdu') }
          return (
          <div key={s} className={`border rounded-xl p-4 ${statColors[s].replace('text-', 'border-').replace('-700', '-200')}`}>
            <div className="text-sm font-medium text-gray-600 capitalize">{dpgfStatLabels[s]}</div>
            <div className="text-2xl font-bold mt-1">{appels.filter(a => a.statut === s).length}</div>
          </div>
        )})}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.titre')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.dateRemise')}</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">{t('proDash.btp.dpgf.montantEstime')}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createAppel} disabled={!form.titre} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t('proDash.btp.dpgf.creer')}</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">{t('proDash.btp.dpgf.annuler')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {appels.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">{t('proDash.btp.dpgf.aucunAppel')}</div> : appels.map(a => (
            <div key={a.id} onClick={() => setSelected(a)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === a.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm truncate">{a.titre}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statColors[a.statut]}`}>{a.statut}</span></div>
              <div className="text-xs text-gray-500">{a.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(a).toLocaleString(dateLocale)} € {t('proDash.common.ht')}</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{selected.titre}</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportDPGF(selected)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">{'⬇️'} {t('proDash.btp.dpgf.export')}</button>
                  {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{[t('proDash.btp.dpgf.colNumeroLot'), t('proDash.btp.dpgf.colDesignation'), t('proDash.btp.dpgf.colMontantHT')].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">{selected.lots.map((l, i) => <tr key={i}><td className="px-3 py-2 font-medium">{l.numero}</td><td className="px-3 py-2">{l.designation}</td><td className="px-3 py-2 font-semibold">{l.montantHT.toLocaleString(dateLocale)}</td></tr>)}</tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold"><td colSpan={2} className="px-3 py-2 text-right">{t('proDash.btp.dpgf.totalHT')}</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString(dateLocale)} €</td></tr>
                  <tr className="bg-blue-100 font-bold"><td colSpan={2} className="px-3 py-2 text-right">{t('proDash.btp.dpgf.totalTTC')}</td><td className="px-3 py-2 text-blue-800">{(getTotal(selected) * 1.2).toLocaleString(dateLocale)} €</td></tr>
                </tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-2">
                  <input className="w-16 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
                  <input className="flex-1 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
                  <input type="number" className="w-28 border rounded px-2 py-1.5 text-sm" placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
                  <button onClick={addLot} disabled={!newLot.designation} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">+</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">{'📋'}</div><p>{t('proDash.btp.dpgf.selectionnerAppel')}</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHANNEL MANAGER
// ══════════════════════════════════════════════

