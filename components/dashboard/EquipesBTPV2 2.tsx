'use client'

import { useState, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { calculateEmployeeCost, grossFromNet, netFromGross, hourlyFromMonthly, monthlyFromHourly, validatePayroll, type PayrollBreakdown } from '@/lib/payroll/engine'
import { resolveCompanyType, getCompanyTypesByCountry } from '@/lib/config/companyTypes'

/* ══════════════════════════════════════════════════════════
   ÉQUIPES BTP V2 — Supabase + Champs financiers
   Membres individuels · Coûts détaillés · Équipes
══════════════════════════════════════════════════════════ */

type TypeCompte = 'ouvrier' | 'chef_chantier' | 'conducteur_travaux' | 'secretaire' | 'gerant'
type TypeContrat = 'cdi' | 'cdd' | 'interim' | 'apprenti' | 'stage' | 'independant'

interface Membre {
  id: string
  prenom: string
  nom: string
  telephone: string
  email: string
  typeCompte: TypeCompte
  rolePerso: string
  equipeId: string
  coutHoraire: number
  chargesPct: number
  // New v2 fields
  salaire_brut_mensuel?: number
  salaire_net_mensuel?: number
  charges_salariales_pct: number
  charges_patronales_pct: number
  type_contrat: TypeContrat
  heures_hebdo: number
  panier_repas_jour: number
  indemnite_trajet_jour: number
  prime_mensuelle: number
  actif: boolean
  createdAt: string
}

interface EquipeBTP {
  id: string
  nom: string
  metier: string
  chantierId: string
  membreIds: string[]
  createdAt: string
}

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

const CONTRAT_LABELS: Record<TypeContrat, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  interim: 'Intérim',
  apprenti: 'Apprenti',
  stage: 'Stage',
  independant: 'Indépendant',
}

const METIERS_FR = ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Métallerie / Ferronnerie', 'Multi-corps']

// Salary calculation now uses /lib/payroll/engine.ts
// Local wrappers for the form auto-calc (accept percentages, not fractions)
function brutFromNetPct(net: number, chargesSalPct: number): number {
  return grossFromNet(net, chargesSalPct / 100)
}
function netFromBrutPct(brut: number, chargesSalPct: number): number {
  return netFromGross(brut, chargesSalPct / 100)
}
function coutHoraireFromBrut(brut: number, heuresHebdo: number): number {
  return hourlyFromMonthly(brut, heuresHebdo)
}
function brutFromCoutHoraire(coutH: number, heuresHebdo: number): number {
  return monthlyFromHourly(coutH, heuresHebdo)
}

// Default member form values
const EMPTY_MFORM = {
  prenom: '', nom: '', telephone: '', email: '',
  typeCompte: 'ouvrier' as TypeCompte, rolePerso: '', equipeId: '',
  coutHoraire: 0, chargesPct: 45,
  salaire_brut_mensuel: '' as string, salaire_net_mensuel: '' as string,
  charges_salariales_pct: 22, charges_patronales_pct: 45,
  type_contrat: 'cdi' as TypeContrat, heures_hebdo: 35,
  panier_repas_jour: 0, indemnite_trajet_jour: 0, prime_mensuelle: 0,
  actif: true,
  _lastEdited: '' as '' | 'brut' | 'net' | 'horaire', // tracks which field the user changed last
}

export default function EquipesBTPV2({ artisan }: { artisan: import('@/lib/types').Artisan }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const userId = artisan?.user_id || ''

  const { settings } = useBTPSettings()
  const country = settings.country || 'FR'
  const companyType = settings.company_type || 'sarl'
  const companyConfig = resolveCompanyType(companyType, country)

  const { items: membres, loading: loadM, add: addMembre, update: updateMembre, remove: removeMembre } = useBTPData<Membre>({
    table: 'membres', artisanId: artisan?.id || '', userId,
  })
  const { items: equipes, loading: loadE, add: addEquipe, update: updateEquipe, remove: removeEquipe } = useBTPData<EquipeBTP>({
    table: 'equipes', artisanId: artisan?.id || '', userId,
  })

  const [tab, setTab] = useState<'membres' | 'equipes'>('membres')
  const [showMembreModal, setShowMembreModal] = useState(false)
  const [showEquipeModal, setShowEquipeModal] = useState(false)
  const [editingMembre, setEditingMembre] = useState<Membre | null>(null)
  const [editingEquipe, setEditingEquipe] = useState<EquipeBTP | null>(null)
  const [showFinance, setShowFinance] = useState(false) // toggle finance section in modal
  const [calcMode, setCalcMode] = useState<'auto' | 'manuel'>('auto') // auto = smart calc, manuel = free edit
  const [saving, setSaving] = useState(false)

  const [mForm, setMForm] = useState(EMPTY_MFORM)
  const [eForm, setEForm] = useState({ nom: '', metier: '', chantierId: '', membreIds: [] as string[] })

  // Computed: real cost per member using payroll engine
  const membresWithCost = useMemo(() => {
    return membres.map(m => {
      const netSalary = m.salaire_net_mensuel || (m.salaire_brut_mensuel ? netFromGross(m.salaire_brut_mensuel, companyConfig.employee_charge_rate) : 0)
      const payroll = netSalary > 0 ? calculateEmployeeCost({
        country,
        company_type: companyType,
        net_salary: netSalary,
        heures_hebdo: m.heures_hebdo || 35,
        panier_repas_jour: m.panier_repas_jour || 0,
        indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
        prime_mensuelle: m.prime_mensuelle || 0,
        overrides: {
          employee_charge_rate: m.charges_salariales_pct ? m.charges_salariales_pct / 100 : undefined,
          employer_charge_rate: m.charges_patronales_pct ? m.charges_patronales_pct / 100 : undefined,
        },
      }) : null
      return {
        ...m,
        payroll,
        coutReelH: payroll?.cost_per_hour || 0,
        coutReelJour: payroll?.cost_per_day || 0,
      }
    })
  }, [membres, country, companyType, companyConfig.employee_charge_rate])

  const activeMembres = membresWithCost.filter(m => m.actif !== false)
  const inactiveMembres = membresWithCost.filter(m => m.actif === false)

  // Stats
  const totalActifs = activeMembres.length
  const nbEquipes = equipes.length
  const coutMoyenH = activeMembres.length > 0 ? Math.round(activeMembres.reduce((s, m) => s + m.coutReelH, 0) / activeMembres.length * 100) / 100 : 0

  // ── Submit handlers ──

  const submitMembre = async () => {
    if (!mForm.prenom.trim() || !mForm.nom.trim()) return
    setSaving(true)

    const data: Omit<Membre, 'id' | 'createdAt'> = {
      prenom: mForm.prenom,
      nom: mForm.nom,
      telephone: mForm.telephone,
      email: mForm.email,
      typeCompte: mForm.typeCompte,
      rolePerso: mForm.rolePerso,
      equipeId: mForm.equipeId,
      coutHoraire: mForm.coutHoraire,
      chargesPct: mForm.chargesPct,
      salaire_brut_mensuel: mForm.salaire_brut_mensuel ? parseFloat(mForm.salaire_brut_mensuel) : undefined,
      salaire_net_mensuel: mForm.salaire_net_mensuel ? parseFloat(mForm.salaire_net_mensuel) : undefined,
      charges_salariales_pct: mForm.charges_salariales_pct,
      charges_patronales_pct: mForm.charges_patronales_pct,
      type_contrat: mForm.type_contrat,
      heures_hebdo: mForm.heures_hebdo,
      panier_repas_jour: mForm.panier_repas_jour,
      indemnite_trajet_jour: mForm.indemnite_trajet_jour,
      prime_mensuelle: mForm.prime_mensuelle,
      actif: mForm.actif,
    }

    if (editingMembre) {
      await updateMembre(editingMembre.id, data)
    } else {
      await addMembre(data)
    }

    setSaving(false)
    setShowMembreModal(false)
    setEditingMembre(null)
    setMForm(EMPTY_MFORM)
    setShowFinance(false)
  }

  const openEditMembre = (m: Membre) => {
    setEditingMembre(m)
    setMForm({
      prenom: m.prenom || '', nom: m.nom || '',
      telephone: m.telephone || '', email: m.email || '',
      typeCompte: m.typeCompte || 'ouvrier', rolePerso: m.rolePerso || '', equipeId: m.equipeId || '',
      coutHoraire: m.coutHoraire || 25, chargesPct: m.chargesPct || 45,
      salaire_brut_mensuel: m.salaire_brut_mensuel ? String(m.salaire_brut_mensuel) : '',
      salaire_net_mensuel: m.salaire_net_mensuel ? String(m.salaire_net_mensuel) : '',
      charges_salariales_pct: m.charges_salariales_pct ?? 22,
      charges_patronales_pct: m.charges_patronales_pct ?? 45,
      type_contrat: m.type_contrat || 'cdi',
      heures_hebdo: m.heures_hebdo || 35,
      panier_repas_jour: m.panier_repas_jour || 0,
      indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
      prime_mensuelle: m.prime_mensuelle || 0,
      actif: m.actif !== false,
      _lastEdited: (m.salaire_brut_mensuel ? 'brut' : m.salaire_net_mensuel ? 'net' : m.coutHoraire ? 'horaire' : '') as '' | 'brut' | 'net' | 'horaire',
    })
    setShowFinance(true) // show finance fields when editing
    setShowMembreModal(true)
  }

  const deleteMembre = async (id: string) => {
    if (!confirm(isPt ? 'Remover membro?' : 'Supprimer ce membre ?')) return
    await removeMembre(id)
  }

  const toggleActif = async (m: Membre) => {
    await updateMembre(m.id, { actif: m.actif === false ? true : false } as any)
  }

  const submitEquipe = async () => {
    if (!eForm.nom.trim()) return
    setSaving(true)
    if (editingEquipe) {
      await updateEquipe(editingEquipe.id, eForm as any)
    } else {
      await addEquipe(eForm as any)
    }
    setSaving(false)
    setShowEquipeModal(false)
    setEditingEquipe(null)
    setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] })
  }

  const deleteEquipe = async (id: string) => {
    if (!confirm(isPt ? 'Remover equipa?' : 'Supprimer cette équipe ?')) return
    await removeEquipe(id)
  }

  if (loadM || loadE) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={{ color: 'var(--v22-text-mid)' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">👷 {isPt ? 'Equipas & Colaboradores' : 'Équipes & Collaborateurs'}</h1>
          <p className="v22-page-sub">{isPt ? 'Membros, equipas e custos detalhados' : 'Membres, équipes et coûts détaillés'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'membres' && (
            <button className="v22-btn" onClick={() => { setEditingMembre(null); setMForm(EMPTY_MFORM); setShowFinance(false); setShowMembreModal(true) }}>
              ➕ {isPt ? 'Membro' : 'Membre'}
            </button>
          )}
          {tab === 'equipes' && (
            <button className="v22-btn" onClick={() => { setEditingEquipe(null); setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] }); setShowEquipeModal(true) }}>
              ➕ {isPt ? 'Equipa' : 'Équipe'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '0 24px 16px' }}>
        <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalActifs}</div>
          <div className="v22-card-meta">{isPt ? 'Ativos' : 'Actifs'}</div>
        </div>
        <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{nbEquipes}</div>
          <div className="v22-card-meta">{isPt ? 'Equipas' : 'Équipes'}</div>
        </div>
        <div className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{coutMoyenH}€/h</div>
          <div className="v22-card-meta">{isPt ? 'Custo médio real' : 'Coût moyen réel'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px 16px', borderBottom: '1px solid var(--v22-border)' }}>
        {(['membres', 'equipes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="v22-btn v22-btn-sm"
            style={{ background: tab === t ? 'var(--v22-yellow)' : 'transparent', color: tab === t ? '#0D1B2E' : 'var(--v22-text-mid)', fontWeight: tab === t ? 700 : 400 }}>
            {t === 'membres' ? (isPt ? '👤 Membros' : '👤 Membres') : (isPt ? '👷 Equipas' : '👷 Équipes')}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* ── TAB MEMBRES ── */}
        {tab === 'membres' && (
          <>
            {activeMembres.length === 0 && inactiveMembres.length === 0 ? (
              <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhum colaborador' : 'Aucun collaborateur'}</div>
                <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Adicione os membros da sua empresa com os seus custos' : 'Ajoutez les membres de votre entreprise avec leurs coûts'}</p>
                <button className="v22-btn" onClick={() => setShowMembreModal(true)}>➕ {isPt ? 'Adicionar' : 'Ajouter'}</button>
              </div>
            ) : (
              <>
                {/* Active members table */}
                <div className="v22-card" style={{ marginBottom: inactiveMembres.length > 0 ? 20 : 0 }}>
                  <div className="v22-card-head">
                    <span className="v22-card-title">{isPt ? 'Colaboradores ativos' : 'Collaborateurs actifs'} ({activeMembres.length})</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--v22-border)' }}>
                          <th style={thStyle}>{isPt ? 'Nome' : 'Nom'}</th>
                          <th style={thStyle}>{isPt ? 'Tipo' : 'Type'}</th>
                          <th style={thStyle}>{isPt ? 'Contrato' : 'Contrat'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{isPt ? 'Custo/h' : 'Coût/h'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{isPt ? 'Custo real/h' : 'Coût réel/h'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{isPt ? 'Custo real/jour' : 'Coût réel/jour'}</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>{isPt ? 'Indemnités' : 'Indemnités'}</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMembres.map(m => {
                          const equipe = equipes.find(e => e.membreIds?.includes(m.id))
                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</div>
                                {m.rolePerso && <div style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>{m.rolePerso}</div>}
                                {equipe && <div style={{ fontSize: 11, color: 'var(--v22-yellow)' }}>👷 {equipe.nom}</div>}
                              </td>
                              <td style={tdStyle}>
                                <span className={TYPE_COLORS[m.typeCompte]} style={{ fontSize: 11 }}>{TYPE_LABELS[m.typeCompte]}</span>
                              </td>
                              <td style={tdStyle}>
                                <span style={{ fontSize: 12 }}>{CONTRAT_LABELS[m.type_contrat] || 'CDI'}</span>
                                <div style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>{m.heures_hebdo || 35}h/sem</div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{m.coutHoraire || 25}€</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--v22-yellow)' }}>{m.coutReelH}€</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{m.coutReelJour}€</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12 }}>
                                {(m.panier_repas_jour || 0) > 0 && <div>🍽 {m.panier_repas_jour}€</div>}
                                {(m.indemnite_trajet_jour || 0) > 0 && <div>🚗 {m.indemnite_trajet_jour}€</div>}
                                {(m.panier_repas_jour || 0) === 0 && (m.indemnite_trajet_jour || 0) === 0 && <span style={{ color: 'var(--v22-text-mid)' }}>—</span>}
                              </td>
                              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="v22-btn v22-btn-sm" onClick={() => openEditMembre(m)} title={isPt ? 'Editar' : 'Modifier'}>✏️</button>
                                  <button className="v22-btn v22-btn-sm" onClick={() => toggleActif(m)} title={isPt ? 'Desativar' : 'Désactiver'}
                                    style={{ background: 'var(--v22-amber-bg, #FFF8E1)', color: '#B8860B' }}>⏸</button>
                                  <button className="v22-btn v22-btn-sm" onClick={() => deleteMembre(m.id)} title={isPt ? 'Remover' : 'Supprimer'}
                                    style={{ background: 'var(--v22-red-bg, #FFF0F0)', color: 'var(--v22-red, #C0392B)' }}>🗑</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inactive members */}
                {inactiveMembres.length > 0 && (
                  <div className="v22-card" style={{ opacity: 0.7 }}>
                    <div className="v22-card-head">
                      <span className="v22-card-title" style={{ color: 'var(--v22-text-mid)' }}>⏸ {isPt ? 'Inativos' : 'Inactifs'} ({inactiveMembres.length})</span>
                    </div>
                    <div style={{ padding: '8px 16px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {inactiveMembres.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--v22-bg)', borderRadius: 8, fontSize: 13 }}>
                            <span>{m.prenom} {m.nom}</span>
                            <button className="v22-btn v22-btn-sm" onClick={() => toggleActif(m)} style={{ padding: '2px 6px', fontSize: 11 }}
                              title={isPt ? 'Reativar' : 'Réactiver'}>▶️</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
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
                const eqMembres = membres.filter(m => eq.membreIds?.includes(m.id))
                const eqCost = eqMembres.reduce((s, m) => {
                  const cH = (m.coutHoraire || 25) * (1 + (m.charges_patronales_pct || m.chargesPct || 45) / 100)
                  return s + cH
                }, 0)
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
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {eqMembres.map(m => (
                            <span key={m.id} className="v22-tag v22-tag-gray" style={{ fontSize: 11 }}>{m.prenom} {m.nom[0]}.</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', marginBottom: 10 }}>
                          {isPt ? 'Custo/h equipa' : "Coût/h équipe"} : <strong style={{ color: 'var(--v22-yellow)' }}>{Math.round(eqCost * 100) / 100}€</strong>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="v22-btn v22-btn-sm" style={{ flex: 1 }} onClick={() => { setEditingEquipe(eq); setEForm({ nom: eq.nom, metier: eq.metier, chantierId: eq.chantierId, membreIds: eq.membreIds || [] }); setShowEquipeModal(true) }}>✏️</button>
                      <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-red-bg, #FFF0F0)', color: 'var(--v22-red, #C0392B)' }} onClick={() => deleteEquipe(eq.id)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* ── MODAL MEMBRE ── */}
      {showMembreModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title">👤 {editingMembre ? (isPt ? 'Editar membro' : 'Modifier le membre') : (isPt ? 'Novo colaborador' : 'Nouveau collaborateur')}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => { setShowMembreModal(false); setEditingMembre(null); setShowFinance(false) }}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Identité */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Primeiro nome *' : 'Prénom *'}</label>
                  <input className="v22-form-input" value={mForm.prenom} onChange={e => setMForm({ ...mForm, prenom: e.target.value })} placeholder="Jean" />
                </div>
                <div>
                  <label className="v22-form-label">{isPt ? 'Apelido *' : 'Nom *'}</label>
                  <input className="v22-form-input" value={mForm.nom} onChange={e => setMForm({ ...mForm, nom: e.target.value })} placeholder="Dupont" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Tipo de conta' : 'Type de compte'}</label>
                  <select className="v22-form-input" value={mForm.typeCompte} onChange={e => setMForm({ ...mForm, typeCompte: e.target.value as TypeCompte })}>
                    {(Object.entries(TYPE_LABELS) as [TypeCompte, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="v22-form-label">{isPt ? 'Contrato' : 'Type de contrat'}</label>
                  <select className="v22-form-input" value={mForm.type_contrat} onChange={e => setMForm({ ...mForm, type_contrat: e.target.value as TypeContrat })}>
                    {(Object.entries(CONTRAT_LABELS) as [TypeContrat, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="v22-form-label">{isPt ? 'Função / Especialidade' : 'Rôle / Spécialité'}</label>
                <input className="v22-form-input" value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur...'} />
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
                  <label className="v22-form-label">📱 {isPt ? 'Telefone' : 'Téléphone'}</label>
                  <input className="v22-form-input" value={mForm.telephone} onChange={e => setMForm({ ...mForm, telephone: e.target.value })} placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="v22-form-label">✉️ Email</label>
                  <input className="v22-form-input" value={mForm.email} onChange={e => setMForm({ ...mForm, email: e.target.value })} placeholder="jean@example.com" />
                </div>
              </div>

              {/* Toggle finance section */}
              <button
                className="v22-btn v22-btn-sm"
                style={{ alignSelf: 'flex-start', background: showFinance ? 'var(--v22-yellow)' : 'var(--v22-bg)', fontWeight: showFinance ? 700 : 400 }}
                onClick={() => setShowFinance(!showFinance)}
              >
                💰 {isPt ? 'Dados financeiros' : 'Données financières'} {showFinance ? '▲' : '▼'}
              </button>

              {/* Financial fields — smart auto-calculation */}
              {showFinance && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: 'var(--v22-bg)', borderRadius: 10 }}>

                  {/* Mode toggle: Auto / Manuel */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v22-text-mid)' }}>
                      💰 {isPt ? 'Salário e custos' : 'Salaire et coûts'}
                    </div>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--v22-border)' }}>
                      <button
                        onClick={() => setCalcMode('auto')}
                        style={{
                          padding: '5px 14px', fontSize: 12, fontWeight: calcMode === 'auto' ? 700 : 400, border: 'none', cursor: 'pointer',
                          background: calcMode === 'auto' ? 'var(--v22-yellow)' : 'var(--v22-card-bg, #fff)',
                          color: calcMode === 'auto' ? '#0D1B2E' : 'var(--v22-text-mid)',
                        }}>
                        🔄 Auto
                      </button>
                      <button
                        onClick={() => setCalcMode('manuel')}
                        style={{
                          padding: '5px 14px', fontSize: 12, fontWeight: calcMode === 'manuel' ? 700 : 400, border: 'none', cursor: 'pointer',
                          borderLeft: '1px solid var(--v22-border)',
                          background: calcMode === 'manuel' ? '#0D1B2E' : 'var(--v22-card-bg, #fff)',
                          color: calcMode === 'manuel' ? '#fff' : 'var(--v22-text-mid)',
                        }}>
                        ✏️ Manuel
                      </button>
                    </div>
                  </div>

                  {calcMode === 'auto' && (
                    <div style={{ fontSize: 11, color: 'var(--v22-text-mid)', marginTop: -8, padding: '6px 10px', background: '#FFFDE7', borderRadius: 6, border: '1px solid #FFF9C4' }}>
                      💡 {isPt
                        ? 'Modo automático : preencha o NET ou o BRUTO, tudo o resto calcula-se sozinho.'
                        : 'Mode auto : remplissez le NET ou le BRUT, tout le reste se calcule tout seul.'}
                    </div>
                  )}
                  {calcMode === 'manuel' && (
                    <div style={{ fontSize: 11, color: 'var(--v22-text-mid)', marginTop: -8, padding: '6px 10px', background: 'var(--v22-card-bg, #fff)', borderRadius: 6, border: '1px solid var(--v22-border)' }}>
                      ✏️ {isPt
                        ? 'Modo manual : preencha cada campo livremente, sem cálculo automático.'
                        : 'Mode manuel : remplissez chaque champ librement, aucun calcul automatique.'}
                    </div>
                  )}

                  {/* Heures + charges (paramètres de calcul) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Horas/semana' : 'Heures/semaine'}</label>
                      <input className="v22-form-input" type="number" min="1" max="60" step="0.5" value={mForm.heures_hebdo}
                        onChange={e => {
                          const h = parseFloat(e.target.value) || 35
                          if (calcMode === 'auto') {
                            const brut = parseFloat(mForm.salaire_brut_mensuel) || 0
                            setMForm({ ...mForm, heures_hebdo: h, coutHoraire: brut > 0 ? coutHoraireFromBrut(brut, h) : mForm.coutHoraire })
                          } else {
                            setMForm({ ...mForm, heures_hebdo: h })
                          }
                        }} />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Encargos salariais (%)' : 'Charges salariales (%)'}</label>
                      <input className="v22-form-input" type="number" min="0" max="50" step="1" value={mForm.charges_salariales_pct}
                        onChange={e => {
                          const cs = parseFloat(e.target.value) || 22
                          if (calcMode === 'auto') {
                            const brut = parseFloat(mForm.salaire_brut_mensuel) || 0
                            const net = parseFloat(mForm.salaire_net_mensuel) || 0
                            if (mForm._lastEdited === 'brut' && brut > 0) {
                              setMForm({ ...mForm, charges_salariales_pct: cs, salaire_net_mensuel: String(netFromBrutPct(brut, cs)) })
                            } else if (mForm._lastEdited === 'net' && net > 0) {
                              const newBrut = brutFromNetPct(net, cs)
                              setMForm({ ...mForm, charges_salariales_pct: cs, salaire_brut_mensuel: String(newBrut), coutHoraire: coutHoraireFromBrut(newBrut, mForm.heures_hebdo) })
                            } else {
                              setMForm({ ...mForm, charges_salariales_pct: cs })
                            }
                          } else {
                            setMForm({ ...mForm, charges_salariales_pct: cs })
                          }
                        }} />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Encargos patronais (%)' : 'Charges patronales (%)'}</label>
                      <input className="v22-form-input" type="number" min="0" max="80" step="1" value={mForm.charges_patronales_pct}
                        onChange={e => setMForm({ ...mForm, charges_patronales_pct: parseFloat(e.target.value) || 45 })} />
                    </div>
                  </div>

                  {/* Salaire NET / BRUT / Horaire */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Salário líquido (€)' : 'Salaire NET (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'net' && <span style={{ fontSize: 9, background: 'var(--v22-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v22-form-input" type="number" min="0" step="50"
                        value={mForm.salaire_net_mensuel}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'net' ? 'var(--v22-yellow)' : undefined,
                          fontWeight: calcMode === 'auto' && mForm._lastEdited === 'net' ? 700 : 400,
                        }}
                        onChange={e => {
                          const net = e.target.value
                          if (calcMode === 'auto') {
                            const netNum = parseFloat(net) || 0
                            if (netNum > 0) {
                              const brut = brutFromNetPct(netNum, mForm.charges_salariales_pct)
                              const cH = coutHoraireFromBrut(brut, mForm.heures_hebdo)
                              setMForm({ ...mForm, salaire_net_mensuel: net, salaire_brut_mensuel: String(brut), coutHoraire: cH, _lastEdited: 'net' })
                            } else {
                              setMForm({ ...mForm, salaire_net_mensuel: net, _lastEdited: 'net' })
                            }
                          } else {
                            setMForm({ ...mForm, salaire_net_mensuel: net })
                          }
                        }}
                        placeholder="ex: 1700" />
                    </div>
                    <div>
                      <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Salário bruto (€)' : 'Salaire BRUT (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'brut' && <span style={{ fontSize: 9, background: 'var(--v22-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v22-form-input" type="number" min="0" step="50"
                        value={mForm.salaire_brut_mensuel}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'brut' ? 'var(--v22-yellow)' : undefined,
                          fontWeight: calcMode === 'auto' && mForm._lastEdited === 'brut' ? 700 : 400,
                        }}
                        onChange={e => {
                          const brut = e.target.value
                          if (calcMode === 'auto') {
                            const brutNum = parseFloat(brut) || 0
                            if (brutNum > 0) {
                              const net = netFromBrutPct(brutNum, mForm.charges_salariales_pct)
                              const cH = coutHoraireFromBrut(brutNum, mForm.heures_hebdo)
                              setMForm({ ...mForm, salaire_brut_mensuel: brut, salaire_net_mensuel: String(net), coutHoraire: cH, _lastEdited: 'brut' })
                            } else {
                              setMForm({ ...mForm, salaire_brut_mensuel: brut, _lastEdited: 'brut' })
                            }
                          } else {
                            setMForm({ ...mForm, salaire_brut_mensuel: brut })
                          }
                        }}
                        placeholder="ex: 2180" />
                    </div>
                    <div>
                      <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Custo horário (€)' : 'Coût horaire (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'horaire' && <span style={{ fontSize: 9, background: 'var(--v22-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v22-form-input" type="number" min="0" step="0.5"
                        value={mForm.coutHoraire}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'horaire' ? 'var(--v22-yellow)' : undefined,
                          fontWeight: calcMode === 'auto' && mForm._lastEdited === 'horaire' ? 700 : 400,
                        }}
                        onChange={e => {
                          const cH = parseFloat(e.target.value) || 0
                          if (calcMode === 'auto') {
                            if (cH > 0) {
                              const brut = brutFromCoutHoraire(cH, mForm.heures_hebdo)
                              const net = netFromBrutPct(brut, mForm.charges_salariales_pct)
                              setMForm({ ...mForm, coutHoraire: cH, salaire_brut_mensuel: String(brut), salaire_net_mensuel: String(net), _lastEdited: 'horaire' })
                            } else {
                              setMForm({ ...mForm, coutHoraire: cH, _lastEdited: 'horaire' })
                            }
                          } else {
                            setMForm({ ...mForm, coutHoraire: cH })
                          }
                        }} />
                    </div>
                  </div>

                  {/* ⚠️ Cross-validation warnings (always active, both modes) */}
                  {(() => {
                    const brut = parseFloat(mForm.salaire_brut_mensuel) || 0
                    const net = parseFloat(mForm.salaire_net_mensuel) || 0
                    const warnings: string[] = []

                    if (brut > 0 && net > 0) {
                      const expectedNet = netFromBrutPct(brut, mForm.charges_salariales_pct)
                      const diff = Math.abs(net - expectedNet)
                      if (diff > 50) {
                        warnings.push(isPt
                          ? `⚠️ Incoerência: com ${mForm.charges_salariales_pct}% de encargos, bruto ${brut}€ deveria dar líquido ~${expectedNet}€ (diferença: ${diff}€)`
                          : `⚠️ Incohérence : avec ${mForm.charges_salariales_pct}% de charges salariales, brut ${brut}€ devrait donner net ~${expectedNet}€ (écart : ${diff}€)`)
                      }
                    }
                    if (brut > 0 && net > 0 && net >= brut) {
                      warnings.push(isPt ? '🚨 O líquido não pode ser >= ao bruto !' : '🚨 Le net ne peut pas être supérieur ou égal au brut !')
                    }
                    if (brut > 0 && brut < 1747) {
                      warnings.push(isPt ? '⚠️ Salário abaixo do SMIC bruto 2025 (1 747€)' : '⚠️ Salaire en dessous du SMIC brut 2025 (1 747€)')
                    }
                    if (mForm.coutHoraire > 0 && mForm.coutHoraire < 11.52) {
                      warnings.push(isPt ? '⚠️ Custo horário abaixo do SMIC horário (11,52€)' : '⚠️ Coût horaire en dessous du SMIC horaire (11,52€)')
                    }

                    if (warnings.length === 0) return null
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {warnings.map((w, i) => (
                          <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: '#FFF3CD', color: '#856404', borderRadius: 6, border: '1px solid #FFEEBA' }}>{w}</div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Arrow flow visualization — uses payroll engine */}
                  {(parseFloat(mForm.salaire_net_mensuel) || parseFloat(mForm.salaire_brut_mensuel) || 0) > 0 && (
                    <div style={{ padding: 10, background: 'var(--v22-card-bg, #fff)', borderRadius: 8, border: '1px solid var(--v22-border)', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700 }}>🔄 {isPt ? 'Decomposição salarial' : 'Décomposition salariale'}</span>
                        <span className="v22-tag v22-tag-gray" style={{ fontSize: 10 }}>{companyConfig.label_fr}</span>
                      </div>
                      {(() => {
                        const netVal = parseFloat(mForm.salaire_net_mensuel) || 0
                        if (netVal <= 0) return null
                        const preview = calculateEmployeeCost({
                          country,
                          company_type: companyType,
                          net_salary: netVal,
                          heures_hebdo: mForm.heures_hebdo || 35,
                          panier_repas_jour: mForm.panier_repas_jour,
                          indemnite_trajet_jour: mForm.indemnite_trajet_jour,
                          prime_mensuelle: mForm.prime_mensuelle,
                          overrides: calcMode === 'manuel' ? {
                            employee_charge_rate: mForm.charges_salariales_pct / 100,
                            employer_charge_rate: mForm.charges_patronales_pct / 100,
                          } : undefined,
                        })
                        const warnings = validatePayroll(preview)
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--v22-text-mid)' }}>{isPt ? 'Líquido (o que recebe)' : 'Net (ce qu\'il reçoit)'}</span>
                              <span style={{ fontWeight: 700, color: '#1D9E75' }}>{preview.net_salary}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--v22-text-mid)' }}>+ {isPt ? 'Encargos salariais' : 'Charges salariales'} ({Math.round(preview.employee_charge_rate * 100)}%)</span>
                              <span style={{ color: '#C0392B' }}>+{preview.employee_charges}€</span>
                            </div>
                            <div style={{ borderTop: '1px dashed var(--v22-border)', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 600 }}>{isPt ? '= Bruto' : '= Brut'}</span>
                              <span style={{ fontWeight: 700 }}>{preview.gross_salary}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--v22-text-mid)' }}>+ {isPt ? 'Encargos patronais' : 'Charges patronales'} ({Math.round(preview.employer_charge_rate * 100)}%)</span>
                              <span style={{ color: '#C0392B' }}>+{preview.employer_charges}€</span>
                            </div>
                            {/* BTP-specific cost lines */}
                            {preview.btp_lines.map(line => (
                              <div key={line.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#8B6914' }}>+ {isPt ? line.label_pt : line.label_fr} ({(line.rate * 100).toFixed(2)}%)</span>
                                <span style={{ color: '#C0392B' }}>+{line.amount}€</span>
                              </div>
                            ))}
                            {preview.prime_mensuelle > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--v22-text-mid)' }}>+ {isPt ? 'Prémio mensal' : 'Prime mensuelle'}</span>
                                <span style={{ color: '#C0392B' }}>+{preview.prime_mensuelle}€</span>
                              </div>
                            )}
                            <div style={{ borderTop: '2px solid var(--v22-yellow)', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700 }}>= {isPt ? 'Custo total empregador' : 'Coût total employeur'}</span>
                              <span style={{ fontWeight: 700, color: 'var(--v22-yellow)', fontSize: 14 }}>{preview.total_employer_cost_mensuel}€{isPt ? '/mês' : '/mois'}</span>
                            </div>
                            {/* Engine warnings */}
                            {warnings.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                                {warnings.map((w, i) => (
                                  <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: w.type === 'error' ? '#FFF0F0' : '#FFF3CD', color: w.type === 'error' ? '#C0392B' : '#856404', borderRadius: 4 }}>
                                    {w.type === 'error' ? '🚨' : '⚠️'} {isPt ? w.message_pt : w.message_fr}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v22-text-mid)', marginTop: 4, marginBottom: 2 }}>🍽 {isPt ? 'Indemnizações diárias' : 'Indemnités journalières'}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Refeição/dia (€)' : 'Panier repas/jour (€)'}</label>
                      <input className="v22-form-input" type="number" min="0" step="0.5" value={mForm.panier_repas_jour}
                        onChange={e => setMForm({ ...mForm, panier_repas_jour: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Deslocação/dia (€)' : 'Indemnité trajet/jour (€)'}</label>
                      <input className="v22-form-input" type="number" min="0" step="0.5" value={mForm.indemnite_trajet_jour}
                        onChange={e => setMForm({ ...mForm, indemnite_trajet_jour: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Prémio mensal (€)' : 'Prime mensuelle (€)'}</label>
                      <input className="v22-form-input" type="number" min="0" step="10" value={mForm.prime_mensuelle}
                        onChange={e => setMForm({ ...mForm, prime_mensuelle: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  {/* Live cost summary — payroll engine */}
                  <div style={{ marginTop: 4, padding: 12, background: 'var(--v22-card-bg, #fff)', borderRadius: 8, border: '2px solid var(--v22-yellow)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📊 {isPt ? 'Custo real para a empresa' : 'Coût réel pour l\'entreprise'}</div>
                    {(() => {
                      const netVal = parseFloat(mForm.salaire_net_mensuel) || 0
                      if (netVal <= 0 && mForm.coutHoraire <= 0) {
                        return <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', fontStyle: 'italic' }}>{isPt ? 'Preencha o salário para ver os custos' : 'Renseignez un salaire pour voir les coûts'}</div>
                      }
                      const p = calculateEmployeeCost({
                        country,
                        company_type: companyType,
                        net_salary: netVal > 0 ? netVal : netFromGross(brutFromCoutHoraire(mForm.coutHoraire, mForm.heures_hebdo), companyConfig.employee_charge_rate),
                        heures_hebdo: mForm.heures_hebdo || 35,
                        panier_repas_jour: mForm.panier_repas_jour,
                        indemnite_trajet_jour: mForm.indemnite_trajet_jour,
                        prime_mensuelle: mForm.prime_mensuelle,
                        overrides: calcMode === 'manuel' ? {
                          employee_charge_rate: mForm.charges_salariales_pct / 100,
                          employer_charge_rate: mForm.charges_patronales_pct / 100,
                        } : undefined,
                      })
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                          <div>{isPt ? 'Custo/hora (total)' : 'Coût/heure (total)'} :</div>
                          <div style={{ fontWeight: 700, textAlign: 'right', color: 'var(--v22-yellow)' }}>{p.cost_per_hour}€</div>
                          <div>{isPt ? 'Custo/jour' : 'Coût/jour'} :</div>
                          <div style={{ fontWeight: 700, textAlign: 'right' }}>{p.cost_per_day}€</div>
                          {p.indemnites_jour > 0 && <>
                            <div style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>  {isPt ? 'dont indemnités' : 'dont indemnités'} :</div>
                            <div style={{ fontSize: 11, color: 'var(--v22-text-mid)', textAlign: 'right' }}>{p.indemnites_jour}€/jour</div>
                          </>}
                          {p.btp_total > 0 && <>
                            <div style={{ fontSize: 11, color: '#8B6914' }}>  {isPt ? 'dont BTP spécifique' : 'dont BTP spécifique'} :</div>
                            <div style={{ fontSize: 11, color: '#8B6914', textAlign: 'right' }}>{p.btp_total}€/mois</div>
                          </>}
                          <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 4, fontWeight: 600 }}>{isPt ? 'Custo mensal' : 'Coût mensuel'} :</div>
                          <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 4, fontWeight: 700, textAlign: 'right', fontSize: 14, color: 'var(--v22-yellow)' }}>{p.cost_per_month}€</div>
                          <div>{isPt ? 'Custo anual' : 'Coût annuel'} :</div>
                          <div style={{ fontWeight: 600, textAlign: 'right' }}>{p.cost_per_year.toLocaleString('fr-FR')}€</div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Actif toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>
                    <input type="checkbox" checked={mForm.actif} onChange={e => setMForm({ ...mForm, actif: e.target.checked })}
                      style={{ accentColor: 'var(--v22-green)', width: 16, height: 16 }} />
                    <span>{isPt ? 'Membro ativo' : 'Membre actif'}</span>
                  </label>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }}
                onClick={() => { setShowMembreModal(false); setEditingMembre(null); setShowFinance(false) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }}
                onClick={submitMembre} disabled={!mForm.prenom.trim() || !mForm.nom.trim() || saving}>
                {saving ? '...' : editingMembre ? (isPt ? '✅ Guardar' : '✅ Sauvegarder') : (isPt ? '✅ Adicionar' : '✅ Ajouter')}
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
                  <p className="v22-card-meta" style={{ fontSize: 12 }}>{isPt ? 'Adicione colaboradores primeiro' : "Ajoutez des collaborateurs d'abord"}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                    {membres.filter(m => m.actif !== false).map(m => (
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

              {/* Cost preview */}
              {eForm.membreIds.length > 0 && (
                <div style={{ padding: 10, background: 'var(--v22-bg)', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>📊 {isPt ? 'Custo da equipa' : "Coût de l'équipe"}</div>
                  {(() => {
                    const sel = membres.filter(m => eForm.membreIds.includes(m.id))
                    const totalH = sel.reduce((s, m) => s + (m.coutHoraire || 25) * (1 + (m.charges_patronales_pct || m.chargesPct || 45) / 100), 0)
                    return <div>{isPt ? 'Total coût réel/h' : 'Total coût réel/h'} : <strong style={{ color: 'var(--v22-yellow)' }}>{Math.round(totalH * 100) / 100}€</strong></div>
                  })()}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }}
                onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }}
                onClick={submitEquipe} disabled={!eForm.nom.trim() || saving}>
                {saving ? '...' : editingEquipe ? '✅ Sauvegarder' : (isPt ? '✅ Criar' : '✅ Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Style helpers ──
const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  color: 'var(--v22-text-mid)',
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
}
