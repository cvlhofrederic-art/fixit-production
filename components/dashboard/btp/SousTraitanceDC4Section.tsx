'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { HardHat, FileText, BarChart3, Check, Minus, Search, FileEdit, Handshake, Loader, Brain, Lightbulb, CheckSquare } from 'lucide-react'
import { useThemeVars } from '../useThemeVars'

export function SousTraitanceDC4Section({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isFR = locale !== 'pt'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dc4_${userId}`
  const DCE_KEY = `dce_analyses_${userId}`

  // ── Types ──
  interface DCEResult {
    error?: string
    scoring?: { technique?: number | string; prix?: number | string; probabilite?: number | string }
    analyse_marche?: string | Record<string, unknown>
    exigences?: string | Record<string, unknown>
    strategie?: string | Record<string, unknown>
    memoire_technique?: string | Record<string, unknown>
    analyse_financiere?: string | Record<string, unknown>
    sous_traitance?: string | Record<string, unknown>
    checklist_depot?: string | Record<string, unknown>
  }
  interface SousTraitant {
    id: string; entreprise: string; siret: string; responsable: string; email: string
    telephone: string; adresse: string; chantier: string; lot: string
    montantMarche: number; tauxTVA: number; statut: 'en_attente' | 'agréé' | 'refusé'; dateAgrement?: string; dc4Genere: boolean
  }
  interface DCEAnalysis {
    id: string; titre: string; country: 'FR' | 'PT'; projectType: string; createdAt: string
    result?: DCEResult; status: 'pending' | 'done' | 'error'
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
      { cat: 'Administratif', items: ['DC1 \u2014 Lettre de candidature', 'DC2 \u2014 D\u00E9claration du candidat', 'DC4 \u2014 Acte sp\u00E9cial de sous-traitance', 'Attestation assurance RC Pro', 'Attestation assurance D\u00E9cennale', 'Extrait Kbis < 3 mois', 'Attestation URSSAF \u00E0 jour', 'Attestations fiscales', 'Certificat Qualibat / Qualifelec'] },
      { cat: 'Technique', items: ['M\u00E9moire technique complet', 'Planning pr\u00E9visionnel (Gantt)', 'PPSPS ou Plan de pr\u00E9vention', 'Note m\u00E9thodologique', 'R\u00E9f\u00E9rences chantiers similaires (3 min)', 'CV des intervenants cl\u00E9s', 'Fiches techniques mat\u00E9riaux'] },
      { cat: 'Financier', items: ['DPGF / BPU compl\u00E9t\u00E9', 'DQE si demand\u00E9', 'Sous-d\u00E9tail de prix', 'D\u00E9composition du prix global', 'Justification des prix anormalement bas'] },
      { cat: 'Avant d\u00E9p\u00F4t', items: ['Signature du candidat sur tous les documents', 'Acte d\'engagement paraph\u00E9 et sign\u00E9', 'Respect de la date limite de remise', 'Copie num\u00E9rique conforme', 'V\u00E9rification coh\u00E9rence prix / m\u00E9moire', 'Enveloppe s\u00E9par\u00E9e candidature / offre'] },
    ]
    return [
      { cat: 'Habilita\u00E7\u00E3o', items: ['Alvar\u00E1 de constru\u00E7\u00E3o v\u00E1lido', 'Declara\u00E7\u00E3o de n\u00E3o d\u00EDvida (AT)', 'Declara\u00E7\u00E3o Seguran\u00E7a Social', 'Certid\u00E3o permanente', 'Seguro de responsabilidade civil', 'Seguro de acidentes de trabalho'] },
      { cat: 'T\u00E9cnico', items: ['Mem\u00F3ria descritiva t\u00E9cnica', 'Plano de trabalhos', 'Plano de seguran\u00E7a e sa\u00FAde', 'Refer\u00EAncias de obras similares', 'CV da equipa t\u00E9cnica', 'Fichas t\u00E9cnicas dos materiais'] },
      { cat: 'Financeiro', items: ['Mapa de quantidades preenchido', 'Proposta de pre\u00E7o (BPU)', 'Cronograma financeiro', 'Cau\u00E7\u00E3o provis\u00F3ria (se exigida)'] },
      { cat: 'Antes da submiss\u00E3o', items: ['Assinaturas em todos os documentos', 'Respeito do prazo de entrega', 'C\u00F3pia digital conforme', 'Verifica\u00E7\u00E3o coer\u00EAncia pre\u00E7os / mem\u00F3ria'] },
    ]
  }
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({})
  const toggleCheck = (key: string) => setCheckStates(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Badge maps ──
  const stBadgeV5: Record<string, string> = { en_attente: 'v5-badge v5-badge-yellow', agréé: 'v5-badge v5-badge-green', refusé: 'v5-badge v5-badge-red' }
  const stBadgeV22: Record<string, string> = { en_attente: 'v22-tag v22-tag-amber', agréé: 'v22-tag v22-tag-green', refusé: 'v22-tag v22-tag-red' }
  const stBadge = isV5 ? stBadgeV5 : stBadgeV22

  return (
    <div>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        {isV5 ? (
          <>
            <h1>{isFR ? 'Sous-traitance & Appels d\'offres' : 'Subempreitada & Concursos'}</h1>
            <p>{isFR ? 'G\u00E9rez vos sous-traitants, analysez les DCE et pr\u00E9parez vos r\u00E9ponses' : 'Gerir subempreiteiros, analisar DCE e preparar propostas'}</p>
          </>
        ) : (
          <div>
            <h1 className="v22-page-title">{isFR ? 'Sous-traitance & Appels d\'offres' : 'Subempreitada & Concursos'}</h1>
            <p className="v22-page-sub">{isFR ? 'G\u00E9rez vos sous-traitants, analysez les DCE et pr\u00E9parez vos r\u00E9ponses' : 'Gerir subempreiteiros, analisar DCE e preparar propostas'}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={isV5 ? 'v5-tabs' : undefined} style={isV5 ? undefined : { display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${tv.border}`, paddingBottom: 8 }}>
        <button onClick={() => setTab('sous_traitants')} className={isV5 ? `v5-tab-b${tab === 'sous_traitants' ? ' active' : ''}` : `v22-tab${tab === 'sous_traitants' ? ' active' : ''}`}>
          <HardHat size={12} /> {isFR ? 'Sous-traitants' : 'Subempreiteiros'} ({soustraitants.length})
        </button>
        <button onClick={() => setTab('analyse_dce')} className={isV5 ? `v5-tab-b${tab === 'analyse_dce' ? ' active' : ''}` : `v22-tab${tab === 'analyse_dce' ? ' active' : ''}`}>
          <Search size={12} /> {isFR ? 'Analyse DCE / IA' : 'An\u00E1lise DCE / IA'}
        </button>
        <button onClick={() => setTab('memoire')} className={isV5 ? `v5-tab-b${tab === 'memoire' ? ' active' : ''}` : `v22-tab${tab === 'memoire' ? ' active' : ''}`}>
          <FileEdit size={12} /> {isFR ? 'M\u00E9moire technique' : 'Mem\u00F3ria t\u00E9cnica'}
        </button>
        <button onClick={() => setTab('checklist')} className={isV5 ? `v5-tab-b${tab === 'checklist' ? ' active' : ''}` : `v22-tab${tab === 'checklist' ? ' active' : ''}`}>
          <CheckSquare size={12} /> {isFR ? 'Checklist d\u00E9p\u00F4t' : 'Checklist submiss\u00E3o'}
        </button>
      </div>

      {/* ═══ TAB 1: SOUS-TRAITANTS ═══ */}
      {tab === 'sous_traitants' && (
        <div>
          {/* KPIs */}
          {isV5 ? (
            <div className="v5-kpi-g">
              {[
                { label: isFR ? 'En attente' : 'Pendentes', val: soustraitants.filter(s => s.statut === 'en_attente').length, hl: false },
                { label: isFR ? 'Agr\u00E9\u00E9s' : 'Aprovados', val: soustraitants.filter(s => s.statut === 'agréé').length, hl: false },
                { label: isFR ? 'DC4 g\u00E9n\u00E9r\u00E9s' : 'DC4 gerados', val: soustraitants.filter(s => s.dc4Genere).length, hl: false },
                { label: isFR ? 'Montant total' : 'Montante total', val: `${soustraitants.filter(s => s.statut !== 'refusé').reduce((s, st) => s + st.montantMarche, 0).toLocaleString(dateLocale)} \u20AC`, hl: true },
              ].map((k, i) => (
                <div key={i} className={`v5-kpi${k.hl ? ' hl' : ''}`}>
                  <div className="v5-kpi-l">{k.label}</div>
                  <div className="v5-kpi-v">{k.val}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: isFR ? 'En attente' : 'Pendentes', val: soustraitants.filter(s => s.statut === 'en_attente').length },
                { label: isFR ? 'Agr\u00E9\u00E9s' : 'Aprovados', val: soustraitants.filter(s => s.statut === 'agréé').length },
                { label: isFR ? 'DC4 g\u00E9n\u00E9r\u00E9s' : 'DC4 gerados', val: soustraitants.filter(s => s.dc4Genere).length },
                { label: isFR ? 'Montant total' : 'Montante total', val: `${soustraitants.filter(s => s.statut !== 'refusé').reduce((s, st) => s + st.montantMarche, 0).toLocaleString(dateLocale)} \u20AC` },
              ].map((k, i) => (
                <div key={i} className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{k.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          <div style={{ marginBottom: '.75rem' }}>
            <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(!showForm)}>
              {showForm ? '\u2715 Fermer' : `+ ${isFR ? 'Nouveau DC4' : 'Novo DC4'}`}
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
              <div className={isV5 ? 'v5-fr' : undefined} style={isV5 ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[
                  [isFR ? 'Entreprise' : 'Empresa', 'entreprise', 'text'],
                  ['SIRET / NIF', 'siret', 'text'],
                  [isFR ? 'Responsable' : 'Respons\u00E1vel', 'responsable', 'text'],
                  ['Email', 'email', 'email'],
                  [isFR ? 'T\u00E9l\u00E9phone' : 'Telefone', 'telephone', 'tel'],
                  [isFR ? 'Adresse' : 'Morada', 'adresse', 'text'],
                  [isFR ? 'Chantier' : 'Obra', 'chantier', 'text'],
                  ['Lot', 'lot', 'text'],
                ].map(([label, key, type]) => (
                  <div key={key as string} className={isV5 ? 'v5-fg' : undefined}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{label}</label>
                    <input type={type as string} className={isV5 ? 'v5-fi' : 'v22-form-input'} value={(form as any)[key as string]} onChange={e => setForm({...form, [key as string]: e.target.value})} />
                  </div>
                ))}
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Montant HT (\u20AC)' : 'Montante s/IVA (\u20AC)'}</label>
                  <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} />
                </div>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'TVA' : 'IVA'}</label>
                  <select className={isV5 ? 'v5-filter-sel' : 'v22-form-input'} style={{ width: '100%' }} value={form.tauxTVA} onChange={e => setForm({...form, tauxTVA: Number(e.target.value)})}>
                    {[20, 10, 5.5, 0].map(tv => <option key={tv} value={tv}>{tv}%</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
                <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={addST} disabled={!form.entreprise}>{isFR ? 'Ajouter' : 'Adicionar'}</button>
                <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{isFR ? 'Annuler' : 'Cancelar'}</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflowX: 'auto', padding: 0 }}>
            <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isFR ? 'Sous-traitant' : 'Subempreiteiro'}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isFR ? 'Chantier' : 'Obra'}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isFR ? 'Montant' : 'Montante'}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>% {isFR ? 'March\u00E9' : 'Contrato'}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isFR ? 'Statut' : 'Estado'}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>DC4</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {soustraitants.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#999', fontSize: 13 }}><div style={{ marginBottom: 6, opacity: 0.4, fontSize: 28 }}>{'🤝'}</div>{isFR ? 'Aucun sous-traitant enregistr\u00E9' : 'Nenhum subempreiteiro registado'}</td></tr>
                ) : soustraitants.map(s => (
                  <tr key={s.id} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                    <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                      {s.entreprise}
                      <div style={{ fontSize: 10, color: isV5 ? 'var(--v5-text-light)' : tv.textMid, fontWeight: 400 }}>{s.siret} \u00B7 {s.responsable}</div>
                    </td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                      {s.chantier}
                      <div style={{ fontSize: 10, color: isV5 ? 'var(--v5-text-light)' : tv.textMid }}>{s.lot}</div>
                    </td>
                    <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{s.montantMarche.toLocaleString(dateLocale)} \u20AC</td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>\u2014</td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                      <span className={stBadge[s.statut] || (isV5 ? 'v5-badge' : 'v22-tag')}>
                        {s.statut === 'en_attente' ? (isFR ? 'Brouillon' : 'Pendente') : s.statut === 'agréé' ? (isFR ? 'Accept\u00E9' : 'Aprovado') : (isFR ? 'Refus\u00E9' : 'Recusado')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                      {s.dc4Genere ? <Check size={14} style={{ color: '#2E7D32' }} /> : <Minus size={14} style={{ color: isV5 ? 'var(--v5-text-muted)' : tv.textMid }} />}
                    </td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {s.statut === 'en_attente' && <button className={isV5 ? 'v5-btn v5-btn-s v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => agreer(s.id)}>{isFR ? 'Agr\u00E9er' : 'Aprovar'}</button>}
                        {s.statut === 'agréé' && <button className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => genererDC4(s)}><FileText size={10} /> DC4</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: ANALYSE DCE / IA ═══ */}
      {tab === 'analyse_dce' && (
        <div>
          {!selectedAnalysis ? (
            <>
              <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} /> {isFR ? 'Nouvelle analyse DCE' : 'Nova an\u00E1lise DCE'}
                </div>
                <div className={isV5 ? 'v5-fr' : undefined} style={isV5 ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div className={isV5 ? 'v5-fg' : undefined} style={{ gridColumn: '1 / -1' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Titre du march\u00E9 *' : 'T\u00EDtulo do concurso *'}</label>
                    <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={dceForm.titre} onChange={e => setDceForm({...dceForm, titre: e.target.value})} placeholder={isFR ? 'ex: R\u00E9habilitation \u00E9cole Jean Moulin' : 'ex: Reabilita\u00E7\u00E3o escola prim\u00E1ria'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Pays' : 'Pa\u00EDs'}</label>
                    <select className={isV5 ? 'v5-filter-sel' : 'v22-form-input'} style={{ width: '100%' }} value={dceForm.country} onChange={e => setDceForm({...dceForm, country: e.target.value as 'FR' | 'PT'})}>
                      <option value="FR">France</option><option value="PT">Portugal</option>
                    </select>
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Type de projet' : 'Tipo de projeto'}</label>
                    <select className={isV5 ? 'v5-filter-sel' : 'v22-form-input'} style={{ width: '100%' }} value={dceForm.projectType} onChange={e => setDceForm({...dceForm, projectType: e.target.value})}>
                      <option value="">\u2014</option>
                      {['R\u00E9novation', 'Gros \u0153uvre', 'Second \u0153uvre', 'VRD', '\u00C9lectricit\u00E9', 'Plomberie/CVC', 'Peinture/Finitions', 'Couverture/\u00C9tanch\u00E9it\u00E9', 'D\u00E9molition', 'Construction neuve'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Budget estim\u00E9 (\u20AC)' : 'Or\u00E7amento estimado (\u20AC)'}</label>
                    <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={dceForm.budget} onChange={e => setDceForm({...dceForm, budget: e.target.value})} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Date limite de remise' : 'Prazo de entrega'}</label>
                    <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={dceForm.deadline} onChange={e => setDceForm({...dceForm, deadline: e.target.value})} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined} style={{ gridColumn: '1 / -1' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Description du projet *' : 'Descri\u00E7\u00E3o do projeto *'}</label>
                    <textarea className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ minHeight: 100, resize: 'vertical' }} value={dceForm.description} onChange={e => setDceForm({...dceForm, description: e.target.value})} placeholder={isFR ? 'D\u00E9crivez le projet, ses contraintes, le contexte...' : 'Descreva o projeto, restri\u00E7\u00F5es, contexto...'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : undefined} style={{ gridColumn: '1 / -1' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isFR ? 'Lots (1 par ligne)' : 'Lotes (1 por linha)'}</label>
                    <textarea className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ minHeight: 60, resize: 'vertical' }} value={dceForm.lots} onChange={e => setDceForm({...dceForm, lots: e.target.value})} placeholder={isFR ? 'Lot 1 - Gros \u0153uvre\nLot 2 - \u00C9lectricit\u00E9\nLot 3 - Plomberie' : 'Lote 1 - Constru\u00E7\u00E3o\nLote 2 - Eletricidade'} />
                  </div>
                </div>
                <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} style={{ marginTop: '.75rem' }} onClick={lancerAnalyse} disabled={dceLoading || !dceForm.titre.trim() || !dceForm.description.trim()}>
                  {dceLoading ? <><Loader size={12} /> Analyse en cours...</> : <><Brain size={12} /> {isFR ? 'Lancer l\'analyse IA' : 'Iniciar an\u00E1lise IA'}</>}
                </button>
              </div>

              {analyses.length > 0 && (
                <div>
                  <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isFR ? 'Analyses pr\u00E9c\u00E9dentes' : 'An\u00E1lises anteriores'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analyses.map(a => (
                      <div key={a.id} onClick={() => a.status === 'done' && setSelectedAnalysis(a)} className={isV5 ? 'v5-card' : 'v22-card'}
                        style={{ cursor: a.status === 'done' ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{a.titre}</div>
                          <div style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-light)' : tv.textMid }}>{a.country} {a.projectType} \u00B7 {new Date(a.createdAt).toLocaleDateString(dateLocale)}</div>
                        </div>
                        <span className={isV5
                          ? `v5-badge ${a.status === 'done' ? 'v5-badge-green' : a.status === 'error' ? 'v5-badge-red' : 'v5-badge-yellow'}`
                          : `v22-tag ${a.status === 'done' ? 'v22-tag-green' : a.status === 'error' ? 'v22-tag-red' : 'v22-tag-amber'}`
                        }>
                          {a.status === 'done' ? 'Termin\u00E9e' : a.status === 'error' ? 'Erreur' : 'En cours'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} onClick={() => setSelectedAnalysis(null)} style={{ marginBottom: '.75rem' }}>
                \u2190 {isFR ? 'Retour' : 'Voltar'}
              </button>
              <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <BarChart3 size={16} /> {selectedAnalysis.titre}
              </div>
              {selectedAnalysis.result?.error ? (
                <div className={isV5 ? 'v5-al err' : undefined} style={isV5 ? undefined : { background: '#FDEDED', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C62828' }}>{selectedAnalysis.result.error}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  {selectedAnalysis.result?.scoring && (
                    isV5 ? (
                      <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="v5-kpi hl">
                          <div className="v5-kpi-l">{isFR ? 'Score technique' : 'Score t\u00E9cnico'}</div>
                          <div className="v5-kpi-v">{selectedAnalysis.result.scoring.technique || '\u2014'}/100</div>
                        </div>
                        <div className="v5-kpi">
                          <div className="v5-kpi-l">{isFR ? 'Comp\u00E9titivit\u00E9 prix' : 'Competitividade pre\u00E7o'}</div>
                          <div className="v5-kpi-v">{selectedAnalysis.result.scoring.prix || '\u2014'}/100</div>
                        </div>
                        <div className="v5-kpi">
                          <div className="v5-kpi-l">{isFR ? 'Probabilit\u00E9 de gain' : 'Probabilidade de ganho'}</div>
                          <div className="v5-kpi-v">{selectedAnalysis.result.scoring.probabilite || '\u2014'}%</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{isFR ? 'Score technique' : 'Score t\u00E9cnico'}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAnalysis.result.scoring.technique || '\u2014'}/100</div>
                        </div>
                        <div className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{isFR ? 'Comp\u00E9titivit\u00E9 prix' : 'Competitividade pre\u00E7o'}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAnalysis.result.scoring.prix || '\u2014'}/100</div>
                        </div>
                        <div className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{isFR ? 'Probabilit\u00E9 de gain' : 'Probabilidade de ganho'}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAnalysis.result.scoring.probabilite || '\u2014'}%</div>
                        </div>
                      </div>
                    )
                  )}
                  {['analyse_marche', 'exigences', 'strategie', 'memoire_technique', 'analyse_financiere', 'sous_traitance', 'checklist_depot'].map(key => {
                    const section = selectedAnalysis.result ? (selectedAnalysis.result as Record<string, unknown>)[key] : undefined
                    if (!section) return null
                    const titles: Record<string, string> = { analyse_marche: 'Analyse du march\u00E9', exigences: 'Exigences', strategie: 'Strat\u00E9gie de r\u00E9ponse', memoire_technique: 'M\u00E9moire technique', analyse_financiere: 'Analyse financi\u00E8re', sous_traitance: 'Sous-traitance', checklist_depot: 'Checklist avant d\u00E9p\u00F4t' }
                    return (
                      <div key={key} className={isV5 ? 'v5-card' : 'v22-card'}>
                        <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{titles[key] || key}</div>
                        <div style={{ fontSize: 12, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{typeof section === 'string' ? section : JSON.stringify(section, null, 2)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 3: MEMOIRE TECHNIQUE ═══ */}
      {tab === 'memoire' && (
        <div>
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
            <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileEdit size={14} /> {isFR ? 'Structure type \u2014 M\u00E9moire technique BTP' : 'Estrutura tipo \u2014 Mem\u00F3ria t\u00E9cnica'}
            </div>
            <p style={{ color: isV5 ? 'var(--v5-text-light)' : tv.textMid, fontSize: 11, marginBottom: '1rem' }}>
              {isFR ? 'Structure recommand\u00E9e pour maximiser votre note technique.' : 'Estrutura recomendada para maximizar a nota t\u00E9cnica.'}
            </p>
            {[
              { n: '1', title: isFR ? 'Pr\u00E9sentation de l\'entreprise' : 'Apresenta\u00E7\u00E3o da empresa', desc: isFR ? 'Historique, chiffres cl\u00E9s, organigramme, certifications (Qualibat, RGE\u2026), assurances.' : 'Hist\u00F3rico, n\u00FAmeros-chave, organograma, certifica\u00E7\u00F5es (alvar\u00E1), seguros.' },
              { n: '2', title: isFR ? 'Compr\u00E9hension du projet' : 'Compreens\u00E3o do projeto', desc: isFR ? 'Reformulation des enjeux, analyse du site, contraintes identifi\u00E9es, points de vigilance.' : 'Reformula\u00E7\u00E3o dos desafios, an\u00E1lise do local, restri\u00E7\u00F5es, pontos de aten\u00E7\u00E3o.' },
              { n: '3', title: isFR ? 'M\u00E9thodologie d\'ex\u00E9cution' : 'Metodologia de execu\u00E7\u00E3o', desc: isFR ? 'Phasage des travaux, m\u00E9thodes constructives, gestion des interfaces inter-lots, acc\u00E8s chantier.' : 'Faseamento das obras, m\u00E9todos construtivos, gest\u00E3o de interfaces, acessos.' },
              { n: '4', title: isFR ? 'Moyens humains et mat\u00E9riels' : 'Meios humanos e materiais', desc: isFR ? '\u00C9quipe d\u00E9di\u00E9e (CV), mat\u00E9riel sp\u00E9cifique, sous-traitants pr\u00E9vus, planning des effectifs.' : 'Equipa dedicada (CV), equipamento espec\u00EDfico, subempreiteiros, plano de efetivos.' },
              { n: '5', title: isFR ? 'Planning d\u00E9taill\u00E9' : 'Planeamento detalhado', desc: isFR ? 'Gantt pr\u00E9visionnel, jalons cl\u00E9s, chemin critique, marge de s\u00E9curit\u00E9.' : 'Gantt previsional, marcos-chave, caminho cr\u00EDtico, margem de seguran\u00E7a.' },
              { n: '6', title: isFR ? 'Gestion des risques' : 'Gest\u00E3o de riscos', desc: isFR ? 'Identification des risques, mesures pr\u00E9ventives, plan de contingence, al\u00E9as climatiques.' : 'Identifica\u00E7\u00E3o de riscos, medidas preventivas, plano de conting\u00EAncia.' },
              { n: '7', title: isFR ? 'Qualit\u00E9 / S\u00E9curit\u00E9 / Environnement' : 'Qualidade / Seguran\u00E7a / Ambiente', desc: isFR ? 'Plan QSE, gestion des d\u00E9chets, nuisances sonores, PPSPS, bilan carbone.' : 'Plano QSA, gest\u00E3o de res\u00EDduos, ru\u00EDdo, plano de seguran\u00E7a, pegada carbono.' },
              { n: '8', title: isFR ? 'R\u00E9f\u00E9rences similaires' : 'Refer\u00EAncias similares', desc: isFR ? '3 \u00E0 5 chantiers comparables avec montants, ma\u00EEtres d\'ouvrage, photos, attestations de bonne ex\u00E9cution.' : '3 a 5 obras compar\u00E1veis com montantes, donos de obra, fotos, atestados.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, padding: '.65rem 0', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isV5 ? 'var(--v5-primary-yellow)' : tv.primary, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={isV5 ? 'v5-al warn' : undefined} style={isV5 ? undefined : { background: '#FFF8E1', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#F57F17' }}>
            <Lightbulb size={12} /> <span style={{ fontWeight: 600 }}>{isFR ? 'Conseil expert' : 'Conselho de especialista'}:</span>&nbsp;
            {isFR
              ? 'Personnalisez chaque section au projet sp\u00E9cifique. Un m\u00E9moire g\u00E9n\u00E9rique se rep\u00E8re imm\u00E9diatement. Mentionnez des d\u00E9tails du CCTP et quantifiez vos engagements.'
              : 'Personalize cada sec\u00E7\u00E3o ao projeto espec\u00EDfico. Uma mem\u00F3ria gen\u00E9rica \u00E9 imediatamente identificada. Mencione detalhes do caderno de encargos.'}
          </div>
        </div>
      )}

      {/* ═══ TAB 4: CHECKLIST DEPOT ═══ */}
      {tab === 'checklist' && (
        <div>
          <div className={isV5 ? 'v5-tabs' : undefined} style={{ marginBottom: '.75rem', ...(isV5 ? {} : { display: 'flex', gap: 4 }) }}>
            <button onClick={() => setDceForm(f => ({...f, country: 'FR'}))} className={isV5 ? `v5-tab-b${dceForm.country === 'FR' ? ' active' : ''}` : `v22-tab${dceForm.country === 'FR' ? ' active' : ''}`}>France</button>
            <button onClick={() => setDceForm(f => ({...f, country: 'PT'}))} className={isV5 ? `v5-tab-b${dceForm.country === 'PT' ? ' active' : ''}` : `v22-tab${dceForm.country === 'PT' ? ' active' : ''}`}>Portugal</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {getChecklist(dceForm.country).map(cat => {
              const total = cat.items.length
              const checked = cat.items.filter((_, i) => checkStates[`${cat.cat}_${i}`]).length
              return (
                <div key={cat.cat} className={isV5 ? 'v5-card' : 'v22-card'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
                    <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ margin: 0 }}>{cat.cat}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: checked === total ? '#2E7D32' : (isV5 ? 'var(--v5-text-light)' : tv.textMid) }}>{checked}/{total}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cat.items.map((item, i) => {
                      const key = `${cat.cat}_${i}`
                      const done = !!checkStates[key]
                      return (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: done ? (isV5 ? 'var(--v5-text-muted)' : tv.textMid) : (isV5 ? 'var(--v5-text-primary)' : 'inherit'), textDecoration: done ? 'line-through' : 'none', padding: '3px 0' }}>
                          <input type="checkbox" checked={done} onChange={() => toggleCheck(key)} style={{ accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary, width: 14, height: 14 }} />
                          {item}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {/* Global progress */}
            {(() => {
              const allItems = getChecklist(dceForm.country).flatMap(c => c.items)
              const totalChecked = allItems.filter((_, i) => {
                const cat = getChecklist(dceForm.country).find(c => c.items.includes(allItems[i]))
                const catIdx = cat ? cat.items.indexOf(allItems[i]) : i
                return checkStates[`${cat?.cat}_${catIdx}`]
              }).length
              const pct = allItems.length > 0 ? Math.round(totalChecked / allItems.length * 100) : 0
              return (
                <div className={isV5 ? 'v5-card' : 'v22-card'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{isFR ? 'Progression globale' : 'Progresso global'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? '#2E7D32' : (isV5 ? 'var(--v5-primary-yellow-dark)' : tv.primary) }}>{pct}%</span>
                  </div>
                  {isV5 ? (
                    <div className="v5-prog-row">
                      <div className="v5-prog-bg">
                        <div className="v5-prog-fill" style={{ width: `${pct}%`, background: pct === 100 ? '#2E7D32' : 'var(--v5-primary-yellow)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct === 100 ? '#2E7D32' : tv.primary }} />
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
