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

const METIERS_FR = ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Métallerie / Ferronnerie', 'Multi-corps']

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
  const ganttStatV22: Record<string, { bg: string; color: string }> = {
    planifié: { bg: '#F0EBE3', color: '#6B7B8D' },
    en_cours: { bg: '#E8F4FD', color: '#1A6FB5' },
    terminé: { bg: '#E6F4F2', color: '#1A7A6E' },
    en_retard: { bg: '#FDE8E8', color: '#B33A3A' },
  }

  return (
    <div>
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">📅 {t('proDash.btp.gantt.title')}</h1>
          <p className="v22-page-sub">{taches.length} {t('proDash.btp.gantt.tachesPlanifiees')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.gantt.ajouterTache')}</button>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head"><span className="v22-card-title">{t('proDash.btp.gantt.nouvelleTache')}</span></div>
          <div className="v22-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.nom')}</label><input className="v22-form-input" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.gantt.nomPlaceholder')} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder={t('proDash.btp.gantt.chantierPlaceholder')} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.responsable')}</label><input className="v22-form-input" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.couleur')}</label><input type="color" className="v22-form-input" style={{ height: 38, padding: '2px 8px' }} value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.debut')}</label><input type="date" className="v22-form-input" value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.fin')}</label><input type="date" className="v22-form-input" value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} /></div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
            <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={addTache} disabled={!form.nom || !form.debut || !form.fin}>{t('proDash.btp.gantt.ajouter')}</button>
            <button className="v22-btn v22-btn-sm" style={{ background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.gantt.annuler')}</button>
          </div>
        </div>
      )}
      {taches.length === 0 ? (
        <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 12 }}>📅</div><p className="v22-card-meta">{t('proDash.btp.gantt.aucuneTache')}</p></div>
      ) : (
        <div className="v22-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  {[t('proDash.btp.gantt.colTache'), t('proDash.btp.gantt.colChantier'), t('proDash.btp.gantt.colStatut'), t('proDash.btp.gantt.colPlanning'), t('proDash.btp.gantt.colAvancement'), ''].map(h => (
                    <th key={h || '_'} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taches.map(tc => {
                  const bar = getBar(tc)
                  const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
                  const sv22 = ganttStatV22[tc.statut] || { bg: '#F0EBE3', color: '#6B7B8D' }
                  return (
                    <tr key={tc.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 13 }}>{tc.nom}</div>
                        <div style={{ fontSize: 11, color: '#8A9BB0' }}>{tc.responsable}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#4A5E78', fontSize: 13 }}>{tc.chantier}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sv22.bg, color: sv22.color }}>
                          {statLabels[tc.statut] || tc.statut}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', minWidth: 180 }}>
                        <div style={{ position: 'relative', height: 20, background: 'var(--v22-bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 3, height: 14, borderRadius: 3, opacity: 0.85, left: bar.left, width: bar.width, backgroundColor: tc.couleur }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8A9BB0', marginTop: 2 }}>
                          <span>{tc.debut ? new Date(tc.debut).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                          <span>{tc.fin ? new Date(tc.fin).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', width: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="range" min="0" max="100" value={tc.avancement} onChange={e => updateAvancement(tc.id, Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--v22-yellow)', height: 4 }} />
                          <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>{tc.avancement}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => deleteTache(tc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 14 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => {
          const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
          return (
          <div key={s} className="v22-card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{taches.filter(tc => tc.statut === s).length}</div>
            <div className="v22-card-meta" style={{ fontSize: 11, textTransform: 'capitalize' }}>{statLabels[s]}</div>
          </div>
        )})}
      </div>
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
  const sitStatV22: Record<string, string> = { brouillon: 'v22-tag v22-tag-gray', envoyée: 'v22-tag v22-tag-amber', validée: 'v22-tag v22-tag-yellow', payée: 'v22-tag v22-tag-green' }

  return (
    <div>
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">📊 {t('proDash.btp.situations.title')}</h1>
          <p className="v22-page-sub">{t('proDash.btp.situations.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.situations.nouvelleSituation')}</button>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showForm && (
        <div className="v22-card">
          <div className="v22-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="v22-form-label">{t('proDash.btp.situations.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.situations.client')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.situations.montantMarche')}</label><input type="number" className="v22-form-input" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
            <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={createSit} disabled={!form.chantier || !form.client}>{t('proDash.btp.situations.creer')}</button>
            <button className="v22-btn v22-btn-sm" style={{ background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {situations.length === 0 ? <div className="v22-card" style={{ padding: 24, textAlign: 'center' }}><p className="v22-card-meta">{t('proDash.btp.situations.aucuneSituation')}</p></div> : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
            <div key={s.id} onClick={() => setSelected(s)} className="v22-card"
              style={{ padding: 14, cursor: 'pointer', border: selected?.id === s.id ? '2px solid var(--v22-yellow)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t('proDash.btp.situations.situation')} n°{s.numero}</span>
                <span className={sitStatV22[s.statut]} style={{ fontSize: 10 }}>{sitStatLabels[s.statut] || s.statut}</span>
              </div>
              <div className="v22-card-meta" style={{ fontSize: 12 }}>{s.chantier}</div>
              <div className="v22-card-meta" style={{ fontSize: 11 }}>{s.client}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--v22-yellow)', marginTop: 4 }}>{getTotal(s).toLocaleString(dateLocale)} €</div>
            </div>
          )})}
        </div>
        <div>
          {selected ? (
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('proDash.btp.situations.situation')} n°{selected.numero} — {selected.chantier}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)}
                      className={selected.statut === s ? 'v22-btn v22-btn-sm' : 'v22-btn v22-btn-sm'}
                      style={{ background: selected.statut === s ? 'var(--v22-yellow)' : 'transparent', fontSize: 11 }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--v22-border)' }}>{[t('proDash.btp.situations.colPoste'), t('proDash.btp.situations.colQte'), t('proDash.btp.situations.colUnite'), t('proDash.btp.situations.colPU'), t('proDash.btp.situations.colAvt'), t('proDash.btp.situations.colMontant')].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead>
                  <tbody>{selected.travaux.map((tr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--v22-border)' }}><td style={{ padding: '8px 12px' }}>{tr.poste}</td><td style={{ padding: '8px 12px' }}>{tr.quantite}</td><td style={{ padding: '8px 12px' }}>{tr.unite}</td><td style={{ padding: '8px 12px' }}>{tr.prixUnit.toLocaleString(dateLocale)}</td><td style={{ padding: '8px 12px' }}>{tr.avancement}%</td><td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--v22-yellow)' }}>{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)}</td></tr>
                  ))}</tbody>
                  <tfoot><tr style={{ background: 'var(--v22-bg)', fontWeight: 700 }}><td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right' }}>{t('proDash.btp.situations.total')}</td><td style={{ padding: '8px 12px', color: 'var(--v22-yellow)' }}>{getTotal(selected).toLocaleString(dateLocale)} €</td></tr></tfoot>
                </table>
              </div>
              <div className="v22-card-body" style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <input className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="v22-form-input" style={{ fontSize: 12 }} value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>{['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}</select>
                  <input type="number" className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                  <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={addPoste} disabled={!newPoste.poste}>{t('proDash.btp.situations.ajouter')}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="v22-card-meta" style={{ fontSize: 12 }}>{t('proDash.btp.situations.avancement')}</span>
                  <input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} style={{ flex: 1, accentColor: 'var(--v22-yellow)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, minWidth: 32 }}>{newPoste.avancement}%</span>
                </div>
              </div>
            </div>
          ) : <div className="v22-card" style={{ padding: 40, textAlign: 'center', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}><div style={{ fontSize: 40, marginBottom: 8 }}>📊</div><p className="v22-card-meta">{t('proDash.btp.situations.selectionnerSituation')}</p></div>}
        </div>
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

  const retStatV22: Record<string, string> = {
    active: 'v22-tag v22-tag-amber',
    mainlevée_demandée: 'v22-tag v22-tag-blue',
    libérée: 'v22-tag v22-tag-green',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title">🔒 {t('proDash.btp.retenues.title')}</h2>
          <p className="v22-page-sub">{t('proDash.btp.retenues.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.retenues.nouvelleRetenue')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.retenuEnAttente')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C', marginTop: 4 }}>{totalRetenu.toLocaleString(dateLocale)} €</div>
        </div>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.libere')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75', marginTop: 4 }}>{totalLibéré.toLocaleString(dateLocale)} €</div>
        </div>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.chantiersConcernes')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2E', marginTop: 4 }}>{retenues.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</div>
          </div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.client')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.montantMarcheHT')}</label><input type="number" className="v22-form-input" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.tauxRetenue')}</label><input type="number" min="1" max="10" className="v22-form-input" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.finTravaux')}</label><input type="date" className="v22-form-input" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} style={{ width: 16, height: 16, accentColor: 'var(--v22-yellow)' }} />
                <label htmlFor="caution_ret" style={{ fontSize: 14, color: '#4A5E78' }}>{t('proDash.btp.retenues.cautionBancaire')}</label>
              </div>
            </div>
            {form.montantMarche > 0 && (
              <div style={{ marginTop: 12, background: '#FEF5E4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B8860B' }}>
                💡 {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} €</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="v22-btn" onClick={addRetenue} disabled={!form.chantier || !form.client}>{t('proDash.btp.retenues.enregistrer')}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.retenues.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="v22-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                {[t('proDash.btp.retenues.colChantier'), t('proDash.btp.retenues.colClient'), t('proDash.btp.retenues.colMarcheHT'), t('proDash.btp.retenues.colRetenu'), t('proDash.btp.retenues.colFinTravaux'), t('proDash.btp.retenues.colStatut'), t('proDash.btp.retenues.colActions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retenues.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--v22-text-mid)', fontSize: 13 }}>{t('proDash.btp.retenues.aucuneRetenue')}</td></tr>
              ) : retenues.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0D1B2E' }}>{r.chantier}</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.client}</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.montantMarche.toLocaleString(dateLocale)} €</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#C9A84C' }}>{r.montantRetenu.toLocaleString(dateLocale)} €</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '—'}</td>
                  <td style={{ padding: '10px 14px' }}><span className={retStatV22[r.statut] || 'v22-tag'}>{r.statut}</span></td>
                  <td style={{ padding: '10px 14px' }}>
                    {r.statut === 'active' && <button className="v22-btn v22-btn-sm" onClick={() => changeStatut(r.id, 'mainlevée_demandée')}>{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                    {r.statut === 'mainlevée_demandée' && <button className="v22-btn v22-btn-sm" style={{ background: '#E6F4F2', color: '#1A7A6E' }} onClick={() => changeStatut(r.id, 'libérée')}>{t('proDash.btp.retenues.liberer')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title">⏱️ {t('proDash.btp.pointage.title')}</h2>
          <p className="v22-page-sub">{t('proDash.btp.pointage.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.pointage.pointer')}</button>
      </div>

      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head"><div className="v22-card-title">Nouveau pointage</div></div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.employe')}</label><input className="v22-form-input" value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder={t('proDash.btp.pointage.employePlaceholder')} /></div>
              <div>
                <label className="v22-form-label">{t('proDash.btp.pointage.poste')}</label>
                <select className="v22-form-input" value={form.poste} onChange={e => setForm({...form, poste: e.target.value})}>
                  <option value="">{t('proDash.btp.pointage.selectionner')}</option>
                  {[{k:'chefChantier'},{k:'macon'},{k:'electricien'},{k:'plombier'},{k:'charpentier'},{k:'peintre'},{k:'manoeuvre'}].map(p => <option key={p.k} value={t(`proDash.btp.pointage.${p.k}`)}>{t(`proDash.btp.pointage.${p.k}`)}</option>)}
                </select>
              </div>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.date')}</label><input type="date" className="v22-form-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.arrivee')}</label><input type="time" className="v22-form-input" value={form.heureArrivee} onChange={e => setForm({...form, heureArrivee: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.depart')}</label><input type="time" className="v22-form-input" value={form.heureDepart} onChange={e => setForm({...form, heureDepart: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.pointage.pauseMin')}</label><input type="number" className="v22-form-input" value={form.pauseMinutes} onChange={e => setForm({...form, pauseMinutes: Number(e.target.value)})} /></div>
              <div style={{ gridColumn: 'span 2' }}><label className="v22-form-label">{t('proDash.btp.pointage.notes')}</label><input className="v22-form-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <div style={{ marginTop: 12, background: '#FEF5E4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B8860B' }}>
              ⏱️ {t('proDash.btp.pointage.heures')} <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="v22-btn" onClick={addPointage} disabled={!form.employe}>{t('proDash.btp.pointage.enregistrer')}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.pointage.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
        <div className="v22-card">
          <div className="v22-card-body" style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="v22-form-label">{t('proDash.btp.pointage.date')}</label>
                <input type="date" className="v22-form-input" style={{ width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              <div>
                <label className="v22-form-label">{t('proDash.btp.pointage.employe').replace(' *', '')}</label>
                <select className="v22-form-input" style={{ width: 160 }} value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}>
                  <option value="">{t('proDash.btp.pointage.tous')}</option>
                  {employes.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <span className="v22-card-meta" style={{ paddingBottom: 2 }}>{filtered.length} {t('proDash.btp.pointage.pointages')} — <strong>{totalH.toFixed(1)}h</strong></span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  {[t('proDash.btp.pointage.colEmploye'), t('proDash.btp.pointage.colPoste'), t('proDash.btp.pointage.colChantier'), t('proDash.btp.pointage.colDate'), t('proDash.btp.pointage.colArrivee'), t('proDash.btp.pointage.colDepart'), t('proDash.btp.pointage.colHeures'), ''].map(h => (
                    <th key={h || '_'} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--v22-text-mid)', fontSize: 13 }}>{t('proDash.btp.pointage.aucunPointage')}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.employe}</td>
                    <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.poste}</td>
                    <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.chantier}</td>
                    <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{new Date(p.date).toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                    <td style={{ padding: '8px 12px' }}>{p.heureArrivee}</td>
                    <td style={{ padding: '8px 12px' }}>{p.heureDepart}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--v22-yellow)' }}>{p.heuresTravaillees}h</td>
                    <td style={{ padding: '8px 12px' }}><button onClick={() => deleteP(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 14 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="v22-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#0D1B2E', marginBottom: 12 }}>{t('proDash.btp.pointage.recapEmployes')}</div>
          {heuresByEmp.length === 0 ? (
            <p className="v22-card-meta" style={{ fontSize: 12 }}>{t('proDash.btp.pointage.aucuneDonnee')}</p>
          ) : heuresByEmp.map(e => (
            <div key={e.employe} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--v22-border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{e.employe}</div>
                <div style={{ fontSize: 11, color: '#8A9BB0' }}>{e.jours} {t('proDash.btp.pointage.jours')}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v22-yellow)' }}>{e.heures.toFixed(1)}h</div>
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
  const isFR = locale !== 'pt'
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dc4_${userId}`
  const DCE_KEY = `dce_analyses_${userId}`

  // ── Types ──
  interface SousTraitant {
    id: string; entreprise: string; siret: string; responsable: string; email: string
    telephone: string; adresse: string; chantier: string; lot: string
    montantMarche: number; tauxTVA: number; statut: 'en_attente' | 'agréé' | 'refusé'; dateAgrement?: string; dc4Genere: boolean
  }
  interface DCEAnalysis {
    id: string; titre: string; country: 'FR' | 'PT'; projectType: string; createdAt: string
    result?: any; status: 'pending' | 'done' | 'error'
  }

  // ── State ──
  const [tab, setTab] = useState<'sous_traitants' | 'analyse_dce' | 'memoire' | 'checklist'>('sous_traitants')
  const [soustraitants, setSoustraitants] = useState<SousTraitant[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [analyses, setAnalyses] = useState<DCEAnalysis[]>(() => {
    try { return JSON.parse(localStorage.getItem(DCE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })
  // DCE analysis form
  const [dceForm, setDceForm] = useState({ titre: '', country: 'FR' as 'FR' | 'PT', projectType: '', description: '', budget: '', deadline: '', lots: '' })
  const [dceLoading, setDceLoading] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<DCEAnalysis | null>(null)

  // ── Sous-traitants logic ──
  const save = (data: SousTraitant[]) => { setSoustraitants(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const saveDCE = (data: DCEAnalysis[]) => { setAnalyses(data); localStorage.setItem(DCE_KEY, JSON.stringify(data)) }
  const addST = () => {
    save([...soustraitants, { id: Date.now().toString(), ...form, statut: 'en_attente', dc4Genere: false }])
    setShowForm(false); setForm({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })
  }
  const agreer = (id: string) => save(soustraitants.map(s => s.id === id ? { ...s, statut: 'agréé', dateAgrement: new Date().toISOString().split('T')[0] } : s))
  const genererDC4 = (st: SousTraitant) => {
    const ttc = st.montantMarche * (1 + st.tauxTVA / 100)
    const content = [
      '═══════════════════════════════════════════════════════',
      '         DC4 — ACTE SPÉCIAL DE SOUS-TRAITANCE',
      '        (Art. 114 du Code de la commande publique)',
      '═══════════════════════════════════════════════════════',
      '', `Date : ${new Date().toLocaleDateString(dateLocale)}`,
      '', '── IDENTIFICATION DU MARCHÉ ──',
      `Chantier : ${st.chantier}`, `Lot concerné : ${st.lot}`,
      '', '── SOUS-TRAITANT DÉSIGNÉ ──',
      `Entreprise : ${st.entreprise}`, `SIRET : ${st.siret}`,
      `Représentant : ${st.responsable}`, `Adresse : ${st.adresse}`,
      `Contact : ${st.email} | ${st.telephone}`,
      '', '── CONDITIONS FINANCIÈRES ──',
      `Montant HT : ${st.montantMarche.toLocaleString(dateLocale)} €`,
      `TVA (${st.tauxTVA}%) : ${(st.montantMarche * st.tauxTVA / 100).toLocaleString(dateLocale)} €`,
      `Montant TTC : ${ttc.toLocaleString(dateLocale)} €`,
      `Date agrément : ${st.dateAgrement || '—'}`,
      '', '── PAIEMENT DIRECT ──',
      `Le sous-traitant bénéficie du paiement direct.`,
      `Caution personnelle et solidaire : ☐ OUI  ☐ NON`,
      '', '── SIGNATURES ──', '',
      'Le maître d\'ouvrage : _________________________',
      '', 'L\'entreprise principale : _________________________',
      '', 'Le sous-traitant : _________________________',
      '', '═══════════════════════════════════════════════════════',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `DC4_${st.entreprise.replace(/\s+/g, '_')}.txt`; a.click()
    URL.revokeObjectURL(url)
    save(soustraitants.map(s => s.id === st.id ? { ...s, dc4Genere: true } : s))
  }

  // ── DCE Analysis via IA ──
  const lancerAnalyse = async () => {
    if (!dceForm.titre.trim() || !dceForm.description.trim()) return
    setDceLoading(true)
    const newAnalysis: DCEAnalysis = {
      id: Date.now().toString(), titre: dceForm.titre, country: dceForm.country,
      projectType: dceForm.projectType, createdAt: new Date().toISOString(), status: 'pending',
    }
    const updated = [newAnalysis, ...analyses]
    saveDCE(updated)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const res = await fetch('/api/dce-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          country: dceForm.country, projectType: dceForm.projectType,
          projectDescription: dceForm.description, budget: parseFloat(dceForm.budget) || 0,
          deadline: dceForm.deadline,
          lots: dceForm.lots.split('\n').filter(Boolean).map((l, i) => ({ numero: String(i + 1), designation: l.trim() })),
        }),
      })
      const json = await res.json()
      if (res.ok && json.analysis) {
        newAnalysis.result = json.analysis; newAnalysis.status = 'done'
      } else {
        newAnalysis.result = { error: json.error || 'Erreur inconnue' }; newAnalysis.status = 'error'
      }
    } catch (err) {
      newAnalysis.result = { error: String(err) }; newAnalysis.status = 'error'
    }
    saveDCE(updated.map(a => a.id === newAnalysis.id ? newAnalysis : a))
    setSelectedAnalysis(newAnalysis)
    setDceLoading(false)
    setTab('analyse_dce')
  }

  // ── Checklist generator ──
  const getChecklist = (country: 'FR' | 'PT') => {
    if (country === 'FR') return [
      { cat: 'Administratif', items: ['DC1 — Lettre de candidature', 'DC2 — Déclaration du candidat', 'DC4 — Acte spécial de sous-traitance', 'Attestation assurance RC Pro', 'Attestation assurance Décennale', 'Extrait Kbis < 3 mois', 'Attestation URSSAF à jour', 'Attestations fiscales', 'Certificat Qualibat / Qualifelec'] },
      { cat: 'Technique', items: ['Mémoire technique complet', 'Planning prévisionnel (Gantt)', 'PPSPS ou Plan de prévention', 'Note méthodologique', 'Références chantiers similaires (3 min)', 'CV des intervenants clés', 'Fiches techniques matériaux'] },
      { cat: 'Financier', items: ['DPGF / BPU complété', 'DQE si demandé', 'Sous-détail de prix', 'Décomposition du prix global', 'Justification des prix anormalement bas'] },
      { cat: 'Avant dépôt', items: ['Signature du candidat sur tous les documents', 'Acte d\'engagement paraphé et signé', 'Respect de la date limite de remise', 'Copie numérique conforme', 'Vérification cohérence prix / mémoire', 'Enveloppe séparée candidature / offre'] },
    ]
    return [
      { cat: 'Habilitação', items: ['Alvará de construção válido', 'Declaração de não dívida (AT)', 'Declaração Segurança Social', 'Certidão permanente', 'Seguro de responsabilidade civil', 'Seguro de acidentes de trabalho'] },
      { cat: 'Técnico', items: ['Memória descritiva técnica', 'Plano de trabalhos', 'Plano de segurança e saúde', 'Referências de obras similares', 'CV da equipa técnica', 'Fichas técnicas dos materiais'] },
      { cat: 'Financeiro', items: ['Mapa de quantidades preenchido', 'Proposta de preço (BPU)', 'Cronograma financeiro', 'Caução provisória (se exigida)'] },
      { cat: 'Antes da submissão', items: ['Assinaturas em todos os documentos', 'Respeito do prazo de entrega', 'Cópia digital conforme', 'Verificação coerência preços / memória'] },
    ]
  }
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({})
  const toggleCheck = (key: string) => setCheckStates(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Styles ──
  const stStatV22: Record<string, string> = { en_attente: 'v22-tag v22-tag-amber', agréé: 'v22-tag v22-tag-green', refusé: 'v22-tag v22-tag-red' }
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: active ? '#FFC107' : '#f3f4f6', color: active ? '#1a1a1a' : '#374151',
  })
  const inputS: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelS: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🤝 {isFR ? 'Sous-traitance & Appels d\'offres' : 'Subempreitada & Concursos'}</h2>
          <p style={{ color: '#6b7280', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
            {isFR ? 'Gérez vos sous-traitants, analysez les DCE et préparez vos réponses' : 'Gerir subempreiteiros, analisar DCE e preparar propostas'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('sous_traitants')} style={tabStyle(tab === 'sous_traitants')}>👷 {isFR ? 'Sous-traitants' : 'Subempreiteiros'} ({soustraitants.length})</button>
        <button onClick={() => setTab('analyse_dce')} style={tabStyle(tab === 'analyse_dce')}>🔎 {isFR ? 'Analyse DCE / IA' : 'Análise DCE / IA'}</button>
        <button onClick={() => setTab('memoire')} style={tabStyle(tab === 'memoire')}>📝 {isFR ? 'Mémoire technique' : 'Memória técnica'}</button>
        <button onClick={() => setTab('checklist')} style={tabStyle(tab === 'checklist')}>✅ {isFR ? 'Checklist dépôt' : 'Checklist submissão'}</button>
      </div>

      {/* ════════════ TAB 1: SOUS-TRAITANTS ════════════ */}
      {tab === 'sous_traitants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: isFR ? 'En attente' : 'Pendentes', val: soustraitants.filter(s => s.statut === 'en_attente').length, color: '#f59e0b' },
              { label: isFR ? 'Agréés' : 'Aprovados', val: soustraitants.filter(s => s.statut === 'agréé').length, color: '#22c55e' },
              { label: isFR ? 'DC4 générés' : 'DC4 gerados', val: soustraitants.filter(s => s.dc4Genere).length, color: '#374151' },
              { label: isFR ? 'Montant total' : 'Montante total', val: `${soustraitants.filter(s => s.statut !== 'refusé').reduce((s, st) => s + st.montantMarche, 0).toLocaleString(dateLocale)} €`, color: '#FFC107', isText: true },
            ].map((k, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
                <div style={{ fontSize: k.isText ? 18 : 26, fontWeight: 700, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Bouton ajouter */}
          <button onClick={() => setShowForm(!showForm)} style={{ alignSelf: 'flex-start', padding: '8px 18px', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {showForm ? '✕ Fermer' : `+ ${isFR ? 'Ajouter un sous-traitant' : 'Adicionar subempreiteiro'}`}
          </button>

          {/* Formulaire */}
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  [isFR ? 'Entreprise' : 'Empresa', 'entreprise', 'text'],
                  ['SIRET / NIF', 'siret', 'text'],
                  [isFR ? 'Responsable' : 'Responsável', 'responsable', 'text'],
                  ['Email', 'email', 'email'],
                  [isFR ? 'Téléphone' : 'Telefone', 'telephone', 'tel'],
                  [isFR ? 'Adresse' : 'Morada', 'adresse', 'text'],
                  [isFR ? 'Chantier' : 'Obra', 'chantier', 'text'],
                  ['Lot', 'lot', 'text'],
                ].map(([label, key, type]) => (
                  <div key={key as string}><label style={labelS}>{label}</label><input type={type as string} style={inputS} value={(form as any)[key as string]} onChange={e => setForm({...form, [key as string]: e.target.value})} /></div>
                ))}
                <div><label style={labelS}>{isFR ? 'Montant HT (€)' : 'Montante s/IVA (€)'}</label><input type="number" style={inputS} value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
                <div><label style={labelS}>{isFR ? 'TVA' : 'IVA'}</label><select style={{...inputS, background: '#fff'}} value={form.tauxTVA} onChange={e => setForm({...form, tauxTVA: Number(e.target.value)})}>{[20, 10, 5.5, 0].map(tv => <option key={tv} value={tv}>{tv}%</option>)}</select></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={addST} disabled={!form.entreprise} style={{ padding: '8px 18px', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: form.entreprise ? 1 : .5 }}>{isFR ? 'Ajouter' : 'Adicionar'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{isFR ? 'Annuler' : 'Cancelar'}</button>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {[isFR ? 'Entreprise' : 'Empresa', isFR ? 'Chantier / Lot' : 'Obra / Lote', isFR ? 'Montant HT' : 'Montante', isFR ? 'Statut' : 'Estado', 'DC4', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {soustraitants.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280', fontSize: 13 }}>{isFR ? 'Aucun sous-traitant enregistré' : 'Nenhum subempreiteiro registado'}</td></tr>
                  ) : soustraitants.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 13 }}>{s.entreprise}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.siret} · {s.responsable}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13, color: '#374151' }}>{s.chantier}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.lot}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#FFC107' }}>{s.montantMarche.toLocaleString(dateLocale)} €</td>
                      <td style={{ padding: '10px 14px' }}><span className={stStatV22[s.statut] || 'v22-tag'}>{s.statut === 'en_attente' ? (isFR ? 'En attente' : 'Pendente') : s.statut === 'agréé' ? (isFR ? 'Agréé' : 'Aprovado') : (isFR ? 'Refusé' : 'Recusado')}</span></td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.dc4Genere ? '✅' : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {s.statut === 'en_attente' && <button onClick={() => agreer(s.id)} style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>{isFR ? 'Agréer' : 'Aprovar'}</button>}
                          {s.statut === 'agréé' && <button onClick={() => genererDC4(s)} style={{ padding: '4px 10px', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📄 DC4</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ TAB 2: ANALYSE DCE / IA ════════════ */}
      {tab === 'analyse_dce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!selectedAnalysis ? (
            <>
              {/* Formulaire d'analyse */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>🔎 {isFR ? 'Nouvelle analyse DCE' : 'Nova análise DCE'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>{isFR ? 'Titre du marché *' : 'Título do concurso *'}</label><input style={inputS} value={dceForm.titre} onChange={e => setDceForm({...dceForm, titre: e.target.value})} placeholder={isFR ? 'ex: Réhabilitation école Jean Moulin' : 'ex: Reabilitação escola primária'} /></div>
                  <div><label style={labelS}>{isFR ? 'Pays' : 'País'}</label><select style={{...inputS, background: '#fff'}} value={dceForm.country} onChange={e => setDceForm({...dceForm, country: e.target.value as 'FR' | 'PT'})}><option value="FR">🇫🇷 France</option><option value="PT">🇵🇹 Portugal</option></select></div>
                  <div><label style={labelS}>{isFR ? 'Type de projet' : 'Tipo de projeto'}</label><select style={{...inputS, background: '#fff'}} value={dceForm.projectType} onChange={e => setDceForm({...dceForm, projectType: e.target.value})}>
                    <option value="">—</option>
                    {['Rénovation', 'Gros œuvre', 'Second œuvre', 'VRD', 'Électricité', 'Plomberie/CVC', 'Peinture/Finitions', 'Couverture/Étanchéité', 'Démolition', 'Construction neuve'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                  <div><label style={labelS}>{isFR ? 'Budget estimé (€)' : 'Orçamento estimado (€)'}</label><input type="number" style={inputS} value={dceForm.budget} onChange={e => setDceForm({...dceForm, budget: e.target.value})} /></div>
                  <div><label style={labelS}>{isFR ? 'Date limite de remise' : 'Prazo de entrega'}</label><input type="date" style={inputS} value={dceForm.deadline} onChange={e => setDceForm({...dceForm, deadline: e.target.value})} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>{isFR ? 'Description du projet *' : 'Descrição do projeto *'}</label><textarea style={{...inputS, minHeight: 100, resize: 'vertical'}} value={dceForm.description} onChange={e => setDceForm({...dceForm, description: e.target.value})} placeholder={isFR ? 'Décrivez le projet, ses contraintes, le contexte...' : 'Descreva o projeto, restrições, contexto...'} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>{isFR ? 'Lots (1 par ligne)' : 'Lotes (1 por linha)'}</label><textarea style={{...inputS, minHeight: 60, resize: 'vertical'}} value={dceForm.lots} onChange={e => setDceForm({...dceForm, lots: e.target.value})} placeholder={isFR ? 'Lot 1 - Gros œuvre\nLot 2 - Électricité\nLot 3 - Plomberie' : 'Lote 1 - Construção\nLote 2 - Eletricidade'} /></div>
                </div>
                <button onClick={lancerAnalyse} disabled={dceLoading || !dceForm.titre.trim() || !dceForm.description.trim()} style={{ marginTop: 16, padding: '10px 24px', background: dceLoading ? '#e5e7eb' : '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 8, cursor: dceLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 15 }}>
                  {dceLoading ? '⏳ Analyse en cours...' : `🧠 ${isFR ? 'Lancer l\'analyse IA' : 'Iniciar análise IA'}`}
                </button>
              </div>

              {/* Liste des analyses passées */}
              {analyses.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{isFR ? 'Analyses précédentes' : 'Análises anteriores'}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analyses.map(a => (
                      <div key={a.id} onClick={() => a.status === 'done' && setSelectedAnalysis(a)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', cursor: a.status === 'done' ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{a.titre}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{a.country === 'FR' ? '🇫🇷' : '🇵🇹'} {a.projectType} · {new Date(a.createdAt).toLocaleDateString(dateLocale)}</div>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: a.status === 'done' ? '#d1fae5' : a.status === 'error' ? '#fee2e2' : '#fef3c7', color: a.status === 'done' ? '#065f46' : a.status === 'error' ? '#991b1b' : '#92400e' }}>
                          {a.status === 'done' ? '✅ Terminée' : a.status === 'error' ? '❌ Erreur' : '⏳ En cours'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Résultat d'analyse */
            <div>
              <button onClick={() => setSelectedAnalysis(null)} style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>← {isFR ? 'Retour' : 'Voltar'}</button>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>📊 {selectedAnalysis.titre}</h3>
              {selectedAnalysis.result?.error ? (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, color: '#991b1b' }}>{selectedAnalysis.result.error}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Score global */}
                  {selectedAnalysis.result?.scoring && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{isFR ? 'Score technique' : 'Score técnico'}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#FFC107' }}>{selectedAnalysis.result.scoring.technique || '—'}/100</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{isFR ? 'Compétitivité prix' : 'Competitividade preço'}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{selectedAnalysis.result.scoring.prix || '—'}/100</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{isFR ? 'Probabilité de gain' : 'Probabilidade de ganho'}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{selectedAnalysis.result.scoring.probabilite || '—'}%</div>
                      </div>
                    </div>
                  )}
                  {/* Sections de l'analyse */}
                  {['analyse_marche', 'exigences', 'strategie', 'memoire_technique', 'analyse_financiere', 'sous_traitance', 'checklist_depot'].map(key => {
                    const section = selectedAnalysis.result?.[key]
                    if (!section) return null
                    const titles: Record<string, string> = { analyse_marche: '🔎 Analyse du marché', exigences: '📋 Exigences', strategie: '🧱 Stratégie de réponse', memoire_technique: '📝 Mémoire technique', analyse_financiere: '💰 Analyse financière', sous_traitance: '👥 Sous-traitance', checklist_depot: '⚠️ Checklist avant dépôt' }
                    return (
                      <div key={key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: '#1a1a1a' }}>{titles[key] || key}</h4>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{typeof section === 'string' ? section : JSON.stringify(section, null, 2)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB 3: MÉMOIRE TECHNIQUE ════════════ */}
      {tab === 'memoire' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>📝 {isFR ? 'Structure type — Mémoire technique BTP' : 'Estrutura tipo — Memória técnica'}</h3>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>{isFR ? 'Structure recommandée pour maximiser votre note technique.' : 'Estrutura recomendada para maximizar a nota técnica.'}</p>
            {[
              { n: '1', title: isFR ? 'Présentation de l\'entreprise' : 'Apresentação da empresa', desc: isFR ? 'Historique, chiffres clés, organigramme, certifications (Qualibat, RGE…), assurances.' : 'Histórico, números-chave, organograma, certificações (alvará), seguros.' },
              { n: '2', title: isFR ? 'Compréhension du projet' : 'Compreensão do projeto', desc: isFR ? 'Reformulation des enjeux, analyse du site, contraintes identifiées, points de vigilance.' : 'Reformulação dos desafios, análise do local, restrições, pontos de atenção.' },
              { n: '3', title: isFR ? 'Méthodologie d\'exécution' : 'Metodologia de execução', desc: isFR ? 'Phasage des travaux, méthodes constructives, gestion des interfaces inter-lots, accès chantier.' : 'Faseamento das obras, métodos construtivos, gestão de interfaces, acessos.' },
              { n: '4', title: isFR ? 'Moyens humains et matériels' : 'Meios humanos e materiais', desc: isFR ? 'Équipe dédiée (CV), matériel spécifique, sous-traitants prévus, planning des effectifs.' : 'Equipa dedicada (CV), equipamento específico, subempreiteiros, plano de efetivos.' },
              { n: '5', title: isFR ? 'Planning détaillé' : 'Planeamento detalhado', desc: isFR ? 'Gantt prévisionnel, jalons clés, chemin critique, marge de sécurité.' : 'Gantt previsional, marcos-chave, caminho crítico, margem de segurança.' },
              { n: '6', title: isFR ? 'Gestion des risques' : 'Gestão de riscos', desc: isFR ? 'Identification des risques, mesures préventives, plan de contingence, aléas climatiques.' : 'Identificação de riscos, medidas preventivas, plano de contingência.' },
              { n: '7', title: isFR ? 'Qualité / Sécurité / Environnement' : 'Qualidade / Segurança / Ambiente', desc: isFR ? 'Plan QSE, gestion des déchets, nuisances sonores, PPSPS, bilan carbone.' : 'Plano QSA, gestão de resíduos, ruído, plano de segurança, pegada carbono.' },
              { n: '8', title: isFR ? 'Références similaires' : 'Referências similares', desc: isFR ? '3 à 5 chantiers comparables avec montants, maîtres d\'ouvrage, photos, attestations de bonne exécution.' : '3 a 5 obras comparáveis com montantes, donos de obra, fotos, atestados.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFC107', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>💡 {isFR ? 'Conseil expert' : 'Conselho de especialista'}</div>
            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
              {isFR
                ? 'Pour maximiser votre note : personnalisez chaque section au projet spécifique. Un mémoire générique se repère immédiatement. Mentionnez des détails du CCTP, adaptez vos références au type de travaux, et quantifiez vos engagements (délais, effectifs, certifications).'
                : 'Para maximizar a nota: personalize cada secção ao projeto específico. Uma memória genérica é imediatamente identificada. Mencione detalhes do caderno de encargos e quantifique os seus compromissos.'}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ TAB 4: CHECKLIST DÉPÔT ════════════ */}
      {tab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setDceForm(f => ({...f, country: 'FR'}))} style={tabStyle(dceForm.country === 'FR')}>🇫🇷 France</button>
            <button onClick={() => setDceForm(f => ({...f, country: 'PT'}))} style={tabStyle(dceForm.country === 'PT')}>🇵🇹 Portugal</button>
          </div>
          {getChecklist(dceForm.country).map(cat => {
            const total = cat.items.length
            const checked = cat.items.filter((_, i) => checkStates[`${cat.cat}_${i}`]).length
            return (
              <div key={cat.cat} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>{cat.cat}</h4>
                  <span style={{ fontSize: 12, fontWeight: 700, color: checked === total ? '#22c55e' : '#6b7280' }}>{checked}/{total}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.items.map((item, i) => {
                    const key = `${cat.cat}_${i}`
                    const done = !!checkStates[key]
                    return (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: done ? '#9ca3af' : '#374151', textDecoration: done ? 'line-through' : 'none' }}>
                        <input type="checkbox" checked={done} onChange={() => toggleCheck(key)} style={{ accentColor: '#FFC107', width: 16, height: 16 }} />
                        {item}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {/* Barre de progression globale */}
          {(() => {
            const allItems = getChecklist(dceForm.country).flatMap(c => c.items)
            const totalChecked = allItems.filter((_, i) => {
              const cat = getChecklist(dceForm.country).find(c => c.items.includes(allItems[i]))
              const catIdx = cat ? cat.items.indexOf(allItems[i]) : i
              return checkStates[`${cat?.cat}_${catIdx}`]
            }).length
            const pct = allItems.length > 0 ? Math.round(totalChecked / allItems.length * 100) : 0
            return (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{isFR ? 'Progression globale' : 'Progresso global'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pct === 100 ? '#22c55e' : '#FFC107' }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#FFC107', borderRadius: 4, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })()}
        </div>
      )}
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
  const dpgfStatV22: Record<string, string> = {
    en_cours: 'v22-tag v22-tag-blue',
    soumis: 'v22-tag v22-tag-amber',
    gagné: 'v22-tag v22-tag-green',
    perdu: 'v22-tag v22-tag-red',
  }
  const dpgfStatLabels: Record<string, string> = {
    en_cours: t('proDash.btp.dpgf.enCours'),
    soumis: t('proDash.btp.dpgf.soumis'),
    gagné: t('proDash.btp.dpgf.gagne'),
    perdu: t('proDash.btp.dpgf.perdu'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title">📁 {t('proDash.btp.dpgf.title')}</h2>
          <p className="v22-page-sub">{t('proDash.btp.dpgf.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.dpgf.nouvelAppel')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
          <div key={s} className="v22-card" style={{ padding: 16 }}>
            <div className="v22-card-meta">{dpgfStatLabels[s]}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0D1B2E', marginTop: 4 }}>{appels.filter(a => a.statut === s).length}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head"><div className="v22-card-title">Nouvel appel d&apos;offres</div></div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.titre')}</label><input className="v22-form-input" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.dateRemise')}</label><input type="date" className="v22-form-input" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.montantEstime')}</label><input type="number" className="v22-form-input" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="v22-btn" onClick={createAppel} disabled={!form.titre}>{t('proDash.btp.dpgf.creer')}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.dpgf.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Liste des appels d'offres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appels.length === 0 ? (
            <div className="v22-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <p className="v22-card-meta">{t('proDash.btp.dpgf.aucunAppel')}</p>
            </div>
          ) : appels.map(a => (
            <div
              key={a.id}
              onClick={() => setSelected(a)}
              className="v22-card"
              style={{ padding: 14, cursor: 'pointer', border: selected?.id === a.id ? '2px solid var(--v22-yellow)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0D1B2E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titre}</span>
                <span className={dpgfStatV22[a.statut] || 'v22-tag'} style={{ flexShrink: 0 }}>{a.statut}</span>
              </div>
              <div className="v22-card-meta" style={{ fontSize: 11 }}>{a.client}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v22-yellow)', marginTop: 4 }}>{getTotal(a).toLocaleString(dateLocale)} € {t('proDash.common.ht')}</div>
            </div>
          ))}
        </div>

        {/* Détail DPGF */}
        {selected ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{selected.titre}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="v22-btn v22-btn-sm" onClick={() => exportDPGF(selected)}>⬇️ {t('proDash.btp.dpgf.export')}</button>
                {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                  <button
                    key={s}
                    className="v22-btn v22-btn-sm"
                    style={selected.statut === s ? { background: 'var(--v22-yellow)', color: '#0D1B2E' } : { background: 'var(--v22-bg)', color: 'var(--v22-text-mid)', border: '1px solid var(--v22-border)' }}
                    onClick={() => changeStatut(selected.id, s)}
                  >{dpgfStatLabels[s]}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                    {[t('proDash.btp.dpgf.colNumeroLot'), t('proDash.btp.dpgf.colDesignation'), t('proDash.btp.dpgf.colMontantHT')].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.lots.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0D1B2E' }}>{l.numero}</td>
                      <td style={{ padding: '8px 14px', color: '#4A5E78' }}>{l.designation}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--v22-yellow)' }}>{l.montantHT.toLocaleString(dateLocale)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', color: '#4A5E78' }}>{t('proDash.btp.dpgf.totalHT')}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--v22-yellow)' }}>{getTotal(selected).toLocaleString(dateLocale)} €</td>
                  </tr>
                  <tr style={{ background: 'var(--v22-bg)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', color: '#4A5E78' }}>{t('proDash.btp.dpgf.totalTTC')}</td>
                    <td style={{ padding: '8px 14px', color: '#0D1B2E' }}>{(getTotal(selected) * 1.2).toLocaleString(dateLocale)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="v22-card-body" style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="v22-form-input" style={{ width: 64, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
                <input className="v22-form-input" style={{ flex: 1, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
                <input type="number" className="v22-form-input" style={{ width: 110, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
                <button className="v22-btn v22-btn-sm" onClick={addLot} disabled={!newLot.designation}>+</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="v22-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 40 }}>📁</div>
            <p className="v22-card-meta">{t('proDash.btp.dpgf.selectionnerAppel')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHANNEL MANAGER
// ══════════════════════════════════════════════

