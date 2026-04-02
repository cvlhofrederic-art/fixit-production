'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { HardHat, FileText, BarChart3, Check, Minus, Search, FileEdit, Handshake, Loader, Brain, Lightbulb, CheckSquare } from 'lucide-react'

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
  const inputS: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelS: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Handshake size={22} /> {isFR ? 'Sous-traitance & Appels d\'offres' : 'Subempreitada & Concursos'}</h2>
          <p style={{ color: '#6b7280', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
            {isFR ? 'Gérez vos sous-traitants, analysez les DCE et préparez vos réponses' : 'Gerir subempreiteiros, analisar DCE e preparar propostas'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('sous_traitants')} className={`v22-tab${tab === 'sous_traitants' ? ' active' : ''}`}><HardHat size={14} /> {isFR ? 'Sous-traitants' : 'Subempreiteiros'} ({soustraitants.length})</button>
        <button onClick={() => setTab('analyse_dce')} className={`v22-tab${tab === 'analyse_dce' ? ' active' : ''}`}><Search size={14} /> {isFR ? 'Analyse DCE / IA' : 'Análise DCE / IA'}</button>
        <button onClick={() => setTab('memoire')} className={`v22-tab${tab === 'memoire' ? ' active' : ''}`}><FileEdit size={14} /> {isFR ? 'Mémoire technique' : 'Memória técnica'}</button>
        <button onClick={() => setTab('checklist')} className={`v22-tab${tab === 'checklist' ? ' active' : ''}`}><CheckSquare size={14} /> {isFR ? 'Checklist dépôt' : 'Checklist submissão'}</button>
      </div>

      {/* TAB 1: SOUS-TRAITANTS */}
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
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{s.dc4Genere ? <Check size={14} className="v22-up" style={{ color: 'var(--v22-green)' }} /> : <Minus size={14} style={{ color: 'var(--v22-border)' }} />}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {s.statut === 'en_attente' && <button onClick={() => agreer(s.id)} style={{ padding: '4px 10px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>{isFR ? 'Agréer' : 'Aprovar'}</button>}
                          {s.statut === 'agréé' && <button onClick={() => genererDC4(s)} style={{ padding: '4px 10px', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={12} /> DC4</button>}
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

      {/* TAB 2: ANALYSE DCE / IA */}
      {tab === 'analyse_dce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!selectedAnalysis ? (
            <>
              {/* Formulaire d'analyse */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><Search size={16} /> {isFR ? 'Nouvelle analyse DCE' : 'Nova análise DCE'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>{isFR ? 'Titre du marché *' : 'Título do concurso *'}</label><input style={inputS} value={dceForm.titre} onChange={e => setDceForm({...dceForm, titre: e.target.value})} placeholder={isFR ? 'ex: Réhabilitation école Jean Moulin' : 'ex: Reabilitação escola primária'} /></div>
                  <div><label style={labelS}>{isFR ? 'Pays' : 'País'}</label><select style={{...inputS, background: '#fff'}} value={dceForm.country} onChange={e => setDceForm({...dceForm, country: e.target.value as 'FR' | 'PT'})}><option value="FR">France</option><option value="PT">Portugal</option></select></div>
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
                  {dceLoading ? <><Loader size={14} /> Analyse en cours...</> : <><Brain size={14} /> {isFR ? 'Lancer l\'analyse IA' : 'Iniciar análise IA'}</>}
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
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{a.country === 'FR' ? 'FR' : 'PT'} {a.projectType} · {new Date(a.createdAt).toLocaleDateString(dateLocale)}</div>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: a.status === 'done' ? '#d1fae5' : a.status === 'error' ? '#fee2e2' : '#fef3c7', color: a.status === 'done' ? '#065f46' : a.status === 'error' ? '#991b1b' : '#92400e' }}>
                          {a.status === 'done' ? 'Terminée' : a.status === 'error' ? 'Erreur' : 'En cours'}
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
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={18} /> {selectedAnalysis.titre}</h3>
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
                    const titles: Record<string, string> = { analyse_marche: 'Analyse du marché', exigences: 'Exigences', strategie: 'Stratégie de réponse', memoire_technique: 'Mémoire technique', analyse_financiere: 'Analyse financière', sous_traitance: 'Sous-traitance', checklist_depot: 'Checklist avant dépôt' }
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

      {/* TAB 3: MEMOIRE TECHNIQUE */}
      {tab === 'memoire' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}><FileEdit size={16} /> {isFR ? 'Structure type — Mémoire technique BTP' : 'Estrutura tipo — Memória técnica'}</h3>
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
            <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Lightbulb size={14} /> {isFR ? 'Conseil expert' : 'Conselho de especialista'}</div>
            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
              {isFR
                ? 'Pour maximiser votre note : personnalisez chaque section au projet spécifique. Un mémoire générique se repère immédiatement. Mentionnez des détails du CCTP, adaptez vos références au type de travaux, et quantifiez vos engagements (délais, effectifs, certifications).'
                : 'Para maximizar a nota: personalize cada secção ao projeto específico. Uma memória genérica é imediatamente identificada. Mencione detalhes do caderno de encargos e quantifique os seus compromissos.'}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CHECKLIST DEPOT */}
      {tab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setDceForm(f => ({...f, country: 'FR'}))} className={`v22-tab${dceForm.country === 'FR' ? ' active' : ''}`}>France</button>
            <button onClick={() => setDceForm(f => ({...f, country: 'PT'}))} className={`v22-tab${dceForm.country === 'PT' ? ' active' : ''}`}>Portugal</button>
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
