'use client'

import { useState, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { calculateEmployeeCost, grossFromNet, netFromGross, hourlyFromMonthly, monthlyFromHourly, validatePayroll, type PayrollBreakdown } from '@/lib/payroll/engine'
import { resolveCompanyType, getCompanyTypesByCountry } from '@/lib/config/companyTypes'
import { Pencil, Trash2, Users, HardHat, Clock, FileText, BarChart3, Wrench, DollarSign, Phone, Mail, Check, Minus, AlertTriangle } from 'lucide-react'

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
  detention_capital_percent?: number    // % capital détenu — détermine TNS vs assimilé salarié (SARL/EURL gérant)
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
  ouvrier: 'v5-badge v5-badge-gray',
  chef_chantier: 'v5-badge v5-badge-orange',
  conducteur_travaux: 'v5-badge v5-badge-yellow',
  secretaire: 'v5-badge v5-badge-green',
  gerant: 'v5-badge v5-badge-red',
}

const CONTRAT_LABELS: Record<TypeContrat, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  interim: 'Intérim',
  apprenti: 'Apprenti',
  stage: 'Stage',
  independant: 'Indépendant',
}

/**
 * Contrats valides par rôle — règles URSSAF / droit du travail français
 *
 * Gérant/Patron : TNS ou mandataire social, pas salarié de sa propre boîte
 * Ouvrier : tout sauf indépendant (lien de subordination)
 * Chef de chantier : CDI/CDD/Intérim (poste qualifié, pas de stage)
 * Conducteur travaux : CDI/CDD uniquement (poste à responsabilité)
 * Secrétaire : CDI/CDD/Apprenti/Stage (poste compatible alternance)
 */
const CONTRATS_PAR_ROLE: Record<TypeCompte, TypeContrat[]> = {
  gerant: ['independant'],
  ouvrier: ['cdi', 'cdd', 'interim', 'apprenti'],
  chef_chantier: ['cdi', 'cdd', 'interim'],
  conducteur_travaux: ['cdi', 'cdd'],
  secretaire: ['cdi', 'cdd', 'apprenti', 'stage'],
}

/** Returns valid contract types for a given role */
function getValidContrats(role: TypeCompte): TypeContrat[] {
  return CONTRATS_PAR_ROLE[role] || ['independant']
}

/** Returns the default (first valid) contract for a role — never returns CDI for gérant */
function defaultContratForRole(role: TypeCompte): TypeContrat {
  return getValidContrats(role)[0]
}

/**
 * Moteur de classification juridique du gérant/dirigeant
 *
 * FR — Sources : URSSAF 2025, Code de commerce art. L223-18 (SARL), L227-6 (SAS)
 *   SARL/EURL  gérant > 50% capital  → TNS (SSI, ex-RSI) — charges ~40-45%
 *   SARL/EURL  gérant ≤ 50% capital  → Assimilé salarié (URSSAF) — charges ~60-80%, sans chômage
 *   SAS/SASU/SA président            → Assimilé salarié, quelle que soit la détention
 *   Un gérant majoritaire NE PEUT PAS avoir de contrat de travail dans sa propre société.
 *
 * PT — Sources : Segurança Social 2025, CIRS art. 2º, CIRS art. 11º
 *   Lda/SA  gerente → MOE (Membro Órgão Estatutário) — TSU 23.75% patronal + 11% salarial
 *   ENI/EIRL        → Trabalhador independente — contribuição 21.41% (Recibo Verde)
 */
interface GerantClassification {
  statut: 'tns' | 'assimile_salarie' | 'moe_pt' | 'independant_pt'
  label_fr: string
  label_pt: string
  fiche_de_paie: boolean
  eligibilite_chomage: boolean
  charges_estimees: string
  alerte: string | null
}

function classifyGerant(params: {
  companyKey: string
  bossIsTns: boolean
  detentionCapitalPercent: number
  country: 'FR' | 'PT'
}): GerantClassification {
  const { companyKey, bossIsTns, detentionCapitalPercent, country } = params

  // Portugal — pas de distinction capital pour MOE
  if (country === 'PT') {
    if (bossIsTns) {
      return {
        statut: 'independant_pt',
        label_fr: 'Travailleur indépendant (Recibo Verde)',
        label_pt: 'Trabalhador Independente (Recibo Verde)',
        fiche_de_paie: false,
        eligibilite_chomage: false,
        charges_estimees: '21,41%',
        alerte: null,
      }
    }
    return {
      statut: 'moe_pt',
      label_fr: 'Gérant — Membre Organe Statutaire (MOE)',
      label_pt: 'Gerente — Membro de Órgão Estatutário (MOE)',
      fiche_de_paie: true,
      eligibilite_chomage: false,
      charges_estimees: '23,75% patronal + 11% salarial',
      alerte: null,
    }
  }

  // France — SAS/SASU/SA : toujours assimilé salarié (art. L227-6)
  if (['sas', 'sasu', 'sa', 'sca'].includes(companyKey)) {
    return {
      statut: 'assimile_salarie',
      label_fr: 'Président / DG — Assimilé salarié',
      label_pt: 'Presidente / DG — Assimilado a assalariado',
      fiche_de_paie: true,
      eligibilite_chomage: false,
      charges_estimees: '60-80%',
      alerte: null,
    }
  }

  // France — SARL/EURL/SNC : dépend du capital (art. L223-18)
  if (detentionCapitalPercent > 50) {
    return {
      statut: 'tns',
      label_fr: 'Gérant majoritaire — TNS (SSI)',
      label_pt: 'Gerente maioritário — Trabalhador Independente',
      fiche_de_paie: false,
      eligibilite_chomage: false,
      charges_estimees: '40-45%',
      alerte: 'Un gérant majoritaire ne peut pas avoir de contrat de travail dans sa société (art. L223-18 C.com).',
    }
  }

  if (detentionCapitalPercent === 50) {
    return {
      statut: 'tns',
      label_fr: 'Gérant égalitaire — TNS (SSI)',
      label_pt: 'Gerente igualitário — Trabalhador Independente',
      fiche_de_paie: false,
      eligibilite_chomage: false,
      charges_estimees: '40-45%',
      alerte: '50% = égalitaire → traité comme majoritaire par l\'URSSAF.',
    }
  }

  // Minoritaire (< 50%)
  return {
    statut: 'assimile_salarie',
    label_fr: 'Gérant minoritaire — Assimilé salarié',
    label_pt: 'Gerente minoritário — Assimilado a assalariado',
    fiche_de_paie: true,
    eligibilite_chomage: false,
    charges_estimees: '60-80%',
    alerte: null,
  }
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
  detention_capital_percent: 100,
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
  const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string} | null>(null)

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
      detention_capital_percent: mForm.detention_capital_percent,
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
      type_contrat: (() => { const valid = getValidContrats(m.typeCompte || 'ouvrier'); return valid.includes(m.type_contrat) ? m.type_contrat : valid[0] })(),
      heures_hebdo: m.heures_hebdo || 35,
      panier_repas_jour: m.panier_repas_jour || 0,
      indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
      prime_mensuelle: m.prime_mensuelle || 0,
      detention_capital_percent: m.detention_capital_percent ?? 100,
      actif: m.actif !== false,
      _lastEdited: (m.salaire_brut_mensuel ? 'brut' : m.salaire_net_mensuel ? 'net' : m.coutHoraire ? 'horaire' : '') as '' | 'brut' | 'net' | 'horaire',
    })
    setShowFinance(true) // show finance fields when editing
    setShowMembreModal(true)
  }

  const deleteMembre = (id: string) => {
    setConfirmDelete({ type: 'membre', id })
  }

  const doActualDeleteMembre = async (id: string) => {
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

  const deleteEquipe = (id: string) => {
    setConfirmDelete({ type: 'equipe', id })
  }

  const doActualDeleteEquipe = async (id: string) => {
    await removeEquipe(id)
  }

  if (loadM || loadE) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ marginBottom: 12, animation: 'spin 1s linear infinite', display: 'flex', justifyContent: 'center' }}><Clock size={32} /></div>
        <p style={{ color: '#999' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="v5-pg-t" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{isPt ? 'Équipes & Colaboradores' : 'Équipes & Collaborateurs'}</h1>
          <p>{isPt ? 'Membros, equipas e custos detalhados' : 'Membres, équipes et coûts détaillés'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'membres' && (
            <button className="v5-btn v5-btn-p" onClick={() => { setEditingMembre(null); setMForm(EMPTY_MFORM); setShowFinance(false); setShowMembreModal(true) }}>
              + {isPt ? 'Membro' : 'Membre'}
            </button>
          )}
          {tab === 'equipes' && (
            <button className="v5-btn v5-btn-p" onClick={() => { setEditingEquipe(null); setEForm({ nom: '', metier: '', chantierId: '', membreIds: [] }); setShowEquipeModal(true) }}>
              + {isPt ? 'Equipa' : 'Équipe'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="v5-sc3" style={{ marginBottom: '1.25rem' }}>
        <div className="v5-kpi" style={{ textAlign: 'center' }}>
          <div className="v5-kpi-l">{isPt ? 'Ativos' : 'Actifs'}</div>
          <div className="v5-kpi-v">{totalActifs}</div>
        </div>
        <div className="v5-kpi" style={{ textAlign: 'center' }}>
          <div className="v5-kpi-l">{isPt ? 'Equipas' : 'Équipes'}</div>
          <div className="v5-kpi-v">{nbEquipes}</div>
        </div>
        <div className="v5-kpi hl" style={{ textAlign: 'center' }}>
          <div className="v5-kpi-l">{isPt ? 'Custo médio real' : 'Coût moyen réel'}</div>
          <div className="v5-kpi-v">{coutMoyenH}€/h</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="v5-tabs">
        {(['membres', 'equipes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`v5-tab-b${tab === t ? ' active' : ''}`}>
            {t === 'membres' ? (isPt ? 'Membros' : 'Membres') : (isPt ? 'Equipas' : 'Équipes')}
          </button>
        ))}
      </div>

      <div>

        {/* ── TAB MEMBRES ── */}
        {tab === 'membres' && (
          <>
            {activeMembres.length === 0 && inactiveMembres.length === 0 ? (
              <div className="v5-card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Users size={40} color="#BBB" /></div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhum colaborador' : 'Aucun collaborateur'}</div>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>{isPt ? 'Adicione os membros da sua empresa com os seus custos' : 'Ajoutez les membres de votre entreprise avec leurs coûts'}</p>
                <button className="v5-btn v5-btn-p" onClick={() => setShowMembreModal(true)}>+ {isPt ? 'Adicionar' : 'Ajouter'}</button>
              </div>
            ) : (
              <>
                {/* Active members table */}
                <div className="v5-card" style={{ marginBottom: inactiveMembres.length > 0 ? 20 : 0, padding: 0 }}>
                  <div style={{ padding: '.75rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
                    <div className="v5-st" style={{ marginBottom: 0 }}>{isPt ? 'Colaboradores ativos' : 'Collaborateurs actifs'} ({activeMembres.length})</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="v5-dt">
                      <thead>
                        <tr>
                          <th>{isPt ? 'Nome' : 'Nom'}</th>
                          <th>{isPt ? 'Tipo' : 'Type'}</th>
                          <th>{isPt ? 'Contrato' : 'Contrat'}</th>
                          <th style={{ textAlign: 'right' }}>{isPt ? 'Custo/h' : 'Coût/h'}</th>
                          <th style={{ textAlign: 'right' }}>{isPt ? 'Custo real/h' : 'Coût réel/h'}</th>
                          <th style={{ textAlign: 'right' }}>{isPt ? 'Custo real/jour' : 'Coût réel/jour'}</th>
                          <th style={{ textAlign: 'right' }}>{isPt ? 'Indemnités' : 'Indemnités'}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMembres.map(m => {
                          const equipe = equipes.find(e => e.membreIds?.includes(m.id))
                          return (
                            <tr key={m.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</div>
                                {m.rolePerso && <div style={{ fontSize: 10, color: '#999' }}>{m.rolePerso}</div>}
                                {equipe && <div style={{ fontSize: 10, color: 'var(--v5-primary-yellow-dark)', display: 'flex', alignItems: 'center', gap: 3 }}><HardHat size={10} /> {equipe.nom}</div>}
                              </td>
                              <td>
                                <span className={TYPE_COLORS[m.typeCompte]}>{TYPE_LABELS[m.typeCompte]}</span>
                              </td>
                              <td>
                                <span style={{ fontSize: 12 }}>{
                                  (() => {
                                    const contrat = m.type_contrat && getValidContrats(m.typeCompte).includes(m.type_contrat) ? m.type_contrat : defaultContratForRole(m.typeCompte)
                                    if (contrat === 'independant') return isPt ? 'Independente' : 'Indépendant'
                                    return CONTRAT_LABELS[contrat]
                                  })()
                                }</span>
                                <div style={{ fontSize: 10, color: '#999' }}>{m.heures_hebdo || 35}h/sem</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.coutHoraire || 25}€</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--v5-primary-yellow-dark)' }}>{m.coutReelH}€</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{m.coutReelJour}€</td>
                              <td style={{ textAlign: 'right', fontSize: 11 }}>
                                {(m.panier_repas_jour || 0) > 0 && <div>{m.panier_repas_jour}€ repas</div>}
                                {(m.indemnite_trajet_jour || 0) > 0 && <div>{m.indemnite_trajet_jour}€ trajet</div>}
                                {(m.panier_repas_jour || 0) === 0 && (m.indemnite_trajet_jour || 0) === 0 && <span style={{ color: '#BBB' }}>—</span>}
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="v5-btn v5-btn-sm" onClick={() => openEditMembre(m)} title={isPt ? 'Editar' : 'Modifier'} aria-label="Modifier"><Pencil size={12} /></button>
                                  <button className="v5-btn v5-btn-sm" onClick={() => toggleActif(m)} title={isPt ? 'Desativar' : 'Désactiver'}
                                    style={{ background: '#FFF3E0', color: '#EF6C00' }} aria-label="Désactiver"><Minus size={12} /></button>
                                  <button className="v5-btn v5-btn-sm v5-btn-d" onClick={() => deleteMembre(m.id)} title={isPt ? 'Remover' : 'Supprimer'}
                                    aria-label="Supprimer"><Trash2 size={12} /></button>
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
                  <div className="v5-card" style={{ opacity: 0.7 }}>
                    <div style={{ marginBottom: '.5rem' }}>
                      <div className="v5-st" style={{ color: '#999' }}>{isPt ? 'Inativos' : 'Inactifs'} ({inactiveMembres.length})</div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {inactiveMembres.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#F5F5F5', borderRadius: 10, fontSize: 12 }}>
                          <span>{m.prenom} {m.nom}</span>
                          <button className="v5-btn v5-btn-sm" onClick={() => toggleActif(m)}
                            title={isPt ? 'Reativar' : 'Réactiver'}><Check size={12} /></button>
                        </div>
                      ))}
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
            <div className="v5-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><HardHat size={40} color="#BBB" /></div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma equipa' : 'Aucune équipe'}</div>
              <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>{isPt ? 'Crie equipas e afecte-as a obras' : 'Créez des équipes et affectez-les à vos chantiers'}</p>
              <button className="v5-btn v5-btn-p" onClick={() => setShowEquipeModal(true)}>+ {isPt ? 'Criar equipa' : 'Créer une équipe'}</button>
            </div>
          ) : (
            <div className="v5-sg2">
              {equipes.map((eq, idx) => {
                const eqMembres = membres.filter(m => eq.membreIds?.includes(m.id))
                const eqCost = eqMembres.reduce((s, m) => {
                  const cH = (m.coutHoraire || 25) * (1 + (m.charges_patronales_pct || m.chargesPct || 45) / 100)
                  return s + cH
                }, 0)
                const avatarColors = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EF5350', '#26C6DA']
                const initials = eq.nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
                const chef = eqMembres.find(m => m.typeCompte === 'chef_chantier') || eqMembres[0]
                return (
                  <div key={eq.id} className="v5-card" style={{ cursor: 'pointer' }} onClick={() => { setEditingEquipe(eq); setEForm({ nom: eq.nom, metier: eq.metier, chantierId: eq.chantierId, membreIds: eq.membreIds || [] }); setShowEquipeModal(true) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.6rem' }}>
                      <div className="v5-hdr-avatar" style={{ background: avatarColors[idx % avatarColors.length], width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{eq.nom}</div>
                        <div style={{ fontSize: 10, color: '#999' }}>
                          {chef ? `${chef.prenom} ${chef.nom}, chef` : ''}{eqMembres.length > 0 ? ` — ${eqMembres.length} ${isPt ? 'membros' : 'personnes'}` : ''}
                        </div>
                      </div>
                    </div>
                    {eq.metier && <div style={{ fontSize: 11, color: '#666', marginBottom: '.4rem' }}>{eq.metier}</div>}
                    {eqCost > 0 && <div style={{ fontSize: 11, color: '#666', marginBottom: '.4rem' }}>{isPt ? 'Custo/h' : 'Coût/h'} : <strong style={{ color: 'var(--v5-primary-yellow-dark)' }}>{Math.round(eqCost * 100) / 100}€</strong></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`v5-badge ${eqMembres.length > 0 ? 'v5-badge-green' : 'v5-badge-orange'}`}>{eqMembres.length > 0 ? (isPt ? 'Operacional' : 'Déployée') : (isPt ? 'Em repouso' : 'En repos')}</span>
                      <button className="v5-btn v5-btn-sm v5-btn-d" onClick={(e) => { e.stopPropagation(); deleteEquipe(eq.id) }} aria-label="Supprimer"><Trash2 size={12} /></button>
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
          <div className="v5-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '.75rem 1.25rem', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{editingMembre ? (isPt ? 'Editar membro' : 'Modifier le membre') : (isPt ? 'Novo colaborador' : 'Nouveau collaborateur')}</span>
              <button className="v5-btn v5-btn-sm" onClick={() => { setShowMembreModal(false); setEditingMembre(null); setShowFinance(false) }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Identité */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v5-fl">{isPt ? 'Primeiro nome *' : 'Prénom *'}</label>
                  <input className="v5-fi" value={mForm.prenom} onChange={e => setMForm({ ...mForm, prenom: e.target.value })} placeholder="Jean" />
                </div>
                <div>
                  <label className="v5-fl">{isPt ? 'Apelido *' : 'Nom *'}</label>
                  <input className="v5-fi" value={mForm.nom} onChange={e => setMForm({ ...mForm, nom: e.target.value })} placeholder="Dupont" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v5-fl">{isPt ? 'Tipo de conta' : 'Type de compte'}</label>
                  <select className="v5-fi" value={mForm.typeCompte} onChange={e => {
                    const newRole = e.target.value as TypeCompte
                    const validContrats = getValidContrats(newRole)
                    const contratStillValid = validContrats.includes(mForm.type_contrat)
                    // Auto-adjust charges for gérant (boss uses different rates than employees)
                    const chargesUpdate = newRole === 'gerant'
                      ? { charges_salariales_pct: 0, charges_patronales_pct: Math.round(companyConfig.boss_charge_rate * 100) }
                      : mForm.typeCompte === 'gerant'
                        ? { charges_salariales_pct: Math.round(companyConfig.employee_charge_rate * 100), charges_patronales_pct: Math.round(companyConfig.employer_charge_rate * 100) }
                        : {}
                    setMForm({ ...mForm, typeCompte: newRole, type_contrat: contratStillValid ? mForm.type_contrat : validContrats[0], ...chargesUpdate })
                  }}>
                    {(Object.entries(TYPE_LABELS) as [TypeCompte, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="v5-fl">{isPt ? 'Contrato' : 'Type de contrat'}</label>
                  <select
                    className="v5-fi"
                    value={mForm.type_contrat}
                    disabled={mForm.typeCompte === 'gerant'}
                    style={mForm.typeCompte === 'gerant' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                    onChange={e => setMForm({ ...mForm, type_contrat: e.target.value as TypeContrat })}
                  >
                    {getValidContrats(mForm.typeCompte).map(k => (
                      <option key={k} value={k}>
                        {k === 'independant' ? (isPt ? 'Independente / Recibo Verde' : 'Indépendant / TNS') : CONTRAT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloc gérant — classification juridique (TNS vs assimilé salarié) */}
              {mForm.typeCompte === 'gerant' && (() => {
                const classification = classifyGerant({
                  companyKey: companyType,
                  bossIsTns: companyConfig.boss_is_tns,
                  detentionCapitalPercent: mForm.detention_capital_percent ?? 100,
                  country: country as 'FR' | 'PT',
                })
                const statutColor = classification.statut === 'tns' || classification.statut === 'independant_pt'
                  ? { bg: '#FFF8E1', border: '#FFD54F', text: '#E65100' }
                  : { bg: '#E8F5E9', border: '#66BB6A', text: '#1B5E20' }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: statutColor.bg, borderRadius: 10, border: `1px solid ${statutColor.border}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: statutColor.text }}>
                      {isPt ? '⚖️ Estatuto social do gerente' : '⚖️ Statut social du gérant'}
                    </div>

                    {/* % capital — seulement pertinent en FR pour SARL/EURL */}
                    {country === 'FR' && ['sarl', 'eurl', 'snc', 'scs'].includes(companyType) && (
                      <div>
                        <label className="v5-fl" style={{ color: statutColor.text }}>
                          {isPt ? '% capital detido' : '% de capital détenu'}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            className="v5-fi"
                            min={0} max={100} step={1}
                            style={{ width: 90 }}
                            value={mForm.detention_capital_percent ?? 100}
                            onChange={e => setMForm({ ...mForm, detention_capital_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                          />
                          <span style={{ fontSize: 13, color: '#999' }}>%</span>
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {isPt ? '(> 50% = maioritário = independente)' : '(> 50% = majoritaire = TNS)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Badge statut calculé */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: statutColor.text }}>
                        {isPt ? classification.label_pt : classification.label_fr}
                      </span>
                      <span style={{ fontSize: 12, background: statutColor.border, color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        {isPt ? `Encargos ~${classification.charges_estimees}` : `Charges ~${classification.charges_estimees}`}
                      </span>
                      {!classification.fiche_de_paie && (
                        <span style={{ fontSize: 11, color: '#B71C1C', background: '#FFEBEE', borderRadius: 6, padding: '2px 8px' }}>
                          {isPt ? 'Sem ficha de vencimento' : 'Pas de fiche de paie'}
                        </span>
                      )}
                    </div>

                    {/* Alerte légale */}
                    {classification.alerte && (
                      <div style={{ fontSize: 12, color: '#B71C1C', background: '#FFEBEE', borderRadius: 6, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{classification.alerte}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div>
                <label className="v5-fl">{isPt ? 'Função / Especialidade' : 'Rôle / Spécialité'}</label>
                <input className="v5-fi" value={mForm.rolePerso} onChange={e => setMForm({ ...mForm, rolePerso: e.target.value })} placeholder={isPt ? 'ex: Pedreiro, Canalizador...' : 'ex: Maçon, Carreleur...'} />
              </div>

              <div>
                <label className="v5-fl">{isPt ? 'Equipa' : 'Équipe'}</label>
                <select className="v5-fi" value={mForm.equipeId} onChange={e => setMForm({ ...mForm, equipeId: e.target.value })}>
                  <option value="">{isPt ? '— Sem equipa' : '— Sans équipe'}</option>
                  {equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={14} /> {isPt ? 'Telefone' : 'Téléphone'}</label>
                  <input className="v5-fi" value={mForm.telephone} onChange={e => setMForm({ ...mForm, telephone: e.target.value })} placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> Email</label>
                  <input className="v5-fi" value={mForm.email} onChange={e => setMForm({ ...mForm, email: e.target.value })} placeholder="jean@example.com" />
                </div>
              </div>

              {/* Toggle finance section */}
              <button
                className="v5-btn v5-btn-sm"
                style={{ alignSelf: 'flex-start', background: showFinance ? 'var(--v5-primary-yellow)' : '#fff', fontWeight: showFinance ? 700 : 400 }}
                onClick={() => setShowFinance(!showFinance)}
              >
                {isPt ? 'Dados financeiros' : 'Données financières'} {showFinance ? '▲' : '▼'}
              </button>

              {/* Financial fields — smart auto-calculation */}
              {showFinance && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: '#FAFAFA', borderRadius: 10 }}>

                  {/* Mode toggle: Auto / Manuel */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#999' }}>
                      <DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {isPt ? 'Salário e custos' : 'Salaire et coûts'}
                    </div>
                    <div className="v5-tabs" style={{ marginBottom: 0, border: 'none' }}>
                      <button
                        onClick={() => setCalcMode('auto')}
                        className={`v5-tab-b${calcMode === 'auto' ? ' active' : ''}`}>
                        Auto
                      </button>
                      <button
                        onClick={() => setCalcMode('manuel')}
                        className={`v5-tab-b${calcMode === 'manuel' ? ' active' : ''}`}>
                        Manuel
                      </button>
                    </div>
                  </div>

                  {calcMode === 'auto' && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: -8, padding: '6px 10px', background: '#FFFDE7', borderRadius: 6, border: '1px solid #FFF9C4' }}>
                      {isPt
                        ? 'Modo automático : preencha o NET ou o BRUTO, tudo o resto calcula-se sozinho.'
                        : 'Mode auto : remplissez le NET ou le BRUT, tout le reste se calcule tout seul.'}
                    </div>
                  )}
                  {calcMode === 'manuel' && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: -8, padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #E8E8E8' }}>
                      {isPt
                        ? 'Modo manual : preencha cada campo livremente, sem cálculo automático.'
                        : 'Mode manuel : remplissez chaque champ librement, aucun calcul automatique.'}
                    </div>
                  )}

                  {/* Heures + charges (paramètres de calcul) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v5-fl">{isPt ? 'Horas/semana' : 'Heures/semaine'}</label>
                      <input className="v5-fi" type="number" min="1" max="60" step="0.5" value={mForm.heures_hebdo}
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
                      <label className="v5-fl">{isPt ? 'Encargos salariais (%)' : 'Charges salariales (%)'}</label>
                      <input className="v5-fi" type="number" min="0" max="50" step="1" value={mForm.charges_salariales_pct}
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
                      <label className="v5-fl">{isPt ? 'Encargos patronais (%)' : 'Charges patronales (%)'}</label>
                      <input className="v5-fi" type="number" min="0" max="80" step="1" value={mForm.charges_patronales_pct}
                        onChange={e => setMForm({ ...mForm, charges_patronales_pct: parseFloat(e.target.value) || 45 })} />
                    </div>
                  </div>

                  {/* Salaire NET / BRUT / Horaire */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Salário líquido (€)' : 'Salaire NET (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'net' && <span style={{ fontSize: 9, background: 'var(--v5-primary-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v5-fi" type="number" min="0" step="50"
                        value={mForm.salaire_net_mensuel}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'net' ? 'var(--v5-primary-yellow)' : undefined,
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
                      <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Salário bruto (€)' : 'Salaire BRUT (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'brut' && <span style={{ fontSize: 9, background: 'var(--v5-primary-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v5-fi" type="number" min="0" step="50"
                        value={mForm.salaire_brut_mensuel}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'brut' ? 'var(--v5-primary-yellow)' : undefined,
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
                      <label className="v5-fl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isPt ? 'Custo horário (€)' : 'Coût horaire (€)'}
                        {calcMode === 'auto' && mForm._lastEdited === 'horaire' && <span style={{ fontSize: 9, background: 'var(--v5-primary-yellow)', color: '#0D1B2E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>source</span>}
                      </label>
                      <input className="v5-fi" type="number" min="0" step="0.5"
                        value={mForm.coutHoraire}
                        style={{
                          borderColor: calcMode === 'auto' && mForm._lastEdited === 'horaire' ? 'var(--v5-primary-yellow)' : undefined,
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
                          ? `Incoerência: com ${mForm.charges_salariales_pct}% de encargos, bruto ${brut}€ deveria dar líquido ~${expectedNet}€ (diferença: ${diff}€)`
                          : `Incohérence : avec ${mForm.charges_salariales_pct}% de charges salariales, brut ${brut}€ devrait donner net ~${expectedNet}€ (écart : ${diff}€)`)
                      }
                    }
                    if (brut > 0 && net > 0 && net >= brut) {
                      warnings.push(isPt ? 'O líquido não pode ser >= ao bruto !' : 'Le net ne peut pas être supérieur ou égal au brut !')
                    }
                    if (brut > 0 && brut < 1747) {
                      warnings.push(isPt ? 'Salário abaixo do SMIC bruto 2025 (1 747€)' : 'Salaire en dessous du SMIC brut 2025 (1 747€)')
                    }
                    if (mForm.coutHoraire > 0 && mForm.coutHoraire < 11.52) {
                      warnings.push(isPt ? 'Custo horário abaixo do SMIC horário (11,52€)' : 'Coût horaire en dessous du SMIC horaire (11,52€)')
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
                    <div style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #E8E8E8', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700 }}>{isPt ? 'Decomposição salarial' : 'Décomposition salariale'}</span>
                        <span className="v5-badge v5-badge-gray">{companyConfig.label_fr}</span>
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
                              <span style={{ color: '#999' }}>{isPt ? 'Líquido (o que recebe)' : 'Net (ce qu\'il reçoit)'}</span>
                              <span style={{ fontWeight: 700, color: '#2E7D32' }}>{preview.net_salary}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#999' }}>+ {isPt ? 'Encargos salariais' : 'Charges salariales'} ({Math.round(preview.employee_charge_rate * 100)}%)</span>
                              <span style={{ color: '#C0392B' }}>+{preview.employee_charges}€</span>
                            </div>
                            <div style={{ borderTop: '1px dashed #E8E8E8', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 600 }}>{isPt ? '= Bruto' : '= Brut'}</span>
                              <span style={{ fontWeight: 700 }}>{preview.gross_salary}€</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#999' }}>+ {isPt ? 'Encargos patronais' : 'Charges patronales'} ({Math.round(preview.employer_charge_rate * 100)}%)</span>
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
                                <span style={{ color: '#999' }}>+ {isPt ? 'Prémio mensal' : 'Prime mensuelle'}</span>
                                <span style={{ color: '#C0392B' }}>+{preview.prime_mensuelle}€</span>
                              </div>
                            )}
                            <div style={{ borderTop: '2px solid var(--v5-primary-yellow)', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700 }}>= {isPt ? 'Custo total empregador' : 'Coût total employeur'}</span>
                              <span style={{ fontWeight: 700, color: 'var(--v5-primary-yellow)', fontSize: 14 }}>{preview.total_employer_cost_mensuel}€{isPt ? '/mês' : '/mois'}</span>
                            </div>
                            {/* Engine warnings */}
                            {warnings.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                                {warnings.map((w, i) => (
                                  <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: w.type === 'error' ? '#FFF0F0' : '#FFF3CD', color: w.type === 'error' ? '#C0392B' : '#856404', borderRadius: 4 }}>
                                    <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? w.message_pt : w.message_fr}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#999', marginTop: 4, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={14} /> {isPt ? 'Indemnizações diárias' : 'Indemnités journalières'}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v5-fl">{isPt ? 'Refeição/dia (€)' : 'Panier repas/jour (€)'}</label>
                      <input className="v5-fi" type="number" min="0" step="0.5" value={mForm.panier_repas_jour}
                        onChange={e => setMForm({ ...mForm, panier_repas_jour: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="v5-fl">{isPt ? 'Deslocação/dia (€)' : 'Indemnité trajet/jour (€)'}</label>
                      <input className="v5-fi" type="number" min="0" step="0.5" value={mForm.indemnite_trajet_jour}
                        onChange={e => setMForm({ ...mForm, indemnite_trajet_jour: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="v5-fl">{isPt ? 'Prémio mensal (€)' : 'Prime mensuelle (€)'}</label>
                      <input className="v5-fi" type="number" min="0" step="10" value={mForm.prime_mensuelle}
                        onChange={e => setMForm({ ...mForm, prime_mensuelle: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  {/* Live cost summary — payroll engine */}
                  <div style={{ marginTop: 4, padding: 12, background: '#fff', borderRadius: 8, border: '2px solid var(--v5-primary-yellow)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={14} /> {isPt ? 'Custo real para a empresa' : 'Coût réel pour l\'entreprise'}</div>
                    {(() => {
                      const netVal = parseFloat(mForm.salaire_net_mensuel) || 0
                      if (netVal <= 0 && mForm.coutHoraire <= 0) {
                        return <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>{isPt ? 'Preencha o salário para ver os custos' : 'Renseignez un salaire pour voir les coûts'}</div>
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
                          <div style={{ fontWeight: 700, textAlign: 'right', color: 'var(--v5-primary-yellow)' }}>{p.cost_per_hour}€</div>
                          <div>{isPt ? 'Custo/jour' : 'Coût/jour'} :</div>
                          <div style={{ fontWeight: 700, textAlign: 'right' }}>{p.cost_per_day}€</div>
                          {p.indemnites_jour > 0 && <>
                            <div style={{ fontSize: 11, color: '#999' }}>  {isPt ? 'dont indemnités' : 'dont indemnités'} :</div>
                            <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>{p.indemnites_jour}€/jour</div>
                          </>}
                          {p.btp_total > 0 && <>
                            <div style={{ fontSize: 11, color: '#8B6914' }}>  {isPt ? 'dont BTP spécifique' : 'dont BTP spécifique'} :</div>
                            <div style={{ fontSize: 11, color: '#8B6914', textAlign: 'right' }}>{p.btp_total}€/mois</div>
                          </>}
                          <div style={{ borderTop: '1px solid #E8E8E8', paddingTop: 4, fontWeight: 600 }}>{isPt ? 'Custo mensal' : 'Coût mensuel'} :</div>
                          <div style={{ borderTop: '1px solid #E8E8E8', paddingTop: 4, fontWeight: 700, textAlign: 'right', fontSize: 14, color: 'var(--v5-primary-yellow)' }}>{p.cost_per_month}€</div>
                          <div>{isPt ? 'Custo anual' : 'Coût annuel'} :</div>
                          <div style={{ fontWeight: 600, textAlign: 'right' }}>{p.cost_per_year.toLocaleString('fr-FR')}€</div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Actif toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>
                    <input type="checkbox" checked={mForm.actif} onChange={e => setMForm({ ...mForm, actif: e.target.checked })}
                      style={{ accentColor: '#2E7D32', width: 16, height: 16 }} />
                    <span>{isPt ? 'Membro ativo' : 'Membre actif'}</span>
                  </label>
                </div>
              )}
            </div>

            <div style={{ padding: '.75rem 1.25rem', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 8 }}>
              <button className="v5-btn" style={{ flex: 1 }}
                onClick={() => { setShowMembreModal(false); setEditingMembre(null); setShowFinance(false) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v5-btn v5-btn-p" style={{ flex: 1 }}
                onClick={submitMembre} disabled={!mForm.prenom.trim() || !mForm.nom.trim() || saving}>
                {saving ? '...' : editingMembre ? (isPt ? 'Guardar' : 'Sauvegarder') : (isPt ? 'Adicionar' : 'Ajouter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ÉQUIPE ── */}
      {showEquipeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v5-card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '.75rem 1.25rem', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{editingEquipe ? (isPt ? 'Editar equipa' : "Modifier l'équipe") : (isPt ? 'Nova equipa' : 'Nouvelle équipe')}</span>
              <button className="v5-btn v5-btn-sm" onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v5-fl">{isPt ? 'Nome da equipa *' : "Nom de l'équipe *"}</label>
                <input className="v5-fi" value={eForm.nom} onChange={e => setEForm({ ...eForm, nom: e.target.value })} placeholder={isPt ? 'ex: Equipa Alvenaria A' : 'ex: Équipe Maçonnerie A'} />
              </div>
              <div>
                <label className="v5-fl">{isPt ? 'Especialidade' : 'Corps de métier'}</label>
                <select className="v5-fi" value={eForm.metier} onChange={e => setEForm({ ...eForm, metier: e.target.value })}>
                  <option value="">—</option>
                  {METIERS_FR.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="v5-fl">{isPt ? 'Membros da equipa' : "Membres de l'équipe"}</label>
                {membres.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#999' }}>{isPt ? 'Adicione colaboradores primeiro' : "Ajoutez des collaborateurs d'abord"}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                    {membres.filter(m => m.actif !== false).map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox"
                          checked={eForm.membreIds.includes(m.id)}
                          onChange={e => setEForm({ ...eForm, membreIds: e.target.checked ? [...eForm.membreIds, m.id] : eForm.membreIds.filter(id => id !== m.id) })}
                          style={{ accentColor: '#FFC107', width: 14, height: 14 }}
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
                <div style={{ padding: 10, background: '#FAFAFA', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={14} /> {isPt ? 'Custo da equipa' : "Coût de l'équipe"}</div>
                  {(() => {
                    const sel = membres.filter(m => eForm.membreIds.includes(m.id))
                    const totalH = sel.reduce((s, m) => s + (m.coutHoraire || 25) * (1 + (m.charges_patronales_pct || m.chargesPct || 45) / 100), 0)
                    return <div>{isPt ? 'Total coût réel/h' : 'Total coût réel/h'} : <strong style={{ color: 'var(--v5-primary-yellow-dark)' }}>{Math.round(totalH * 100) / 100}€</strong></div>
                  })()}
                </div>
              )}
            </div>
            <div style={{ padding: '.75rem 1.25rem', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 8 }}>
              <button className="v5-btn" style={{ flex: 1 }}
                onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v5-btn v5-btn-p" style={{ flex: 1 }}
                onClick={submitEquipe} disabled={!eForm.nom.trim() || saving}>
                {saving ? '...' : editingEquipe ? 'Sauvegarder' : (isPt ? 'Criar' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMATION SUPPRESSION ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmDelete(null)}>
          <div className="v5-card" style={{ maxWidth: 400, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '.75rem 1.25rem', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{isPt ? 'Confirmar eliminação' : 'Confirmer la suppression'}</span>
              <button className="v5-btn v5-btn-sm" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              <p style={{ fontSize: 12 }}>{isPt ? 'Tem certeza que deseja eliminar?' : 'Êtes-vous sûr de vouloir supprimer ?'}</p>
            </div>
            <div style={{ padding: '.75rem 1.25rem', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="v5-btn" onClick={() => setConfirmDelete(null)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v5-btn v5-btn-d" onClick={() => {
                if (confirmDelete.type === 'membre') doActualDeleteMembre(confirmDelete.id)
                else if (confirmDelete.type === 'equipe') doActualDeleteEquipe(confirmDelete.id)
                setConfirmDelete(null)
              }}>{isPt ? 'Eliminar' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Style helpers removed — using v5-dt table classes from dashboard-v5.css
