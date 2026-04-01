'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { supabase } from '@/lib/supabase'
import {
  PlusCircle, Pencil, Trash2, HardHat, MapPin, Calendar,
  User, Euro, FileText, CheckCircle2, AlertTriangle, AlertCircle,
  Siren, Clock, Satellite, Loader2, Users,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIERS BTP V2 — Supabase + Géoloc + Devis import + Rentabilité
// ═══════════════════════════════════════════════════════════════════════════════

interface ChantierForm {
  titre: string; client: string; adresse: string
  dateDebut: string; dateFin: string; budget: string
  statut: string; description: string; equipe: string
  latitude?: number | null; longitude?: number | null
  geoRayonM: number
  devis_id?: string | null
  membres_ids?: string[]
}

const EMPTY_FORM: ChantierForm = {
  titre: '', client: '', adresse: '', dateDebut: '', dateFin: '',
  budget: '', statut: 'En attente', description: '', equipe: '',
  latitude: null, longitude: null, geoRayonM: 100,
  devis_id: null, membres_ids: [],
}

interface DevisSummary {
  id: string; numero: string; client_name: string; client_address: string
  total_ht_cents: number; items: any; created_at: string; status: string
  execution_delay_days?: number; prestation_date?: string
}

interface MembreSummary {
  id: string; prenom: string; nom: string; role: string
  daily_cost: number; actif: boolean
}

function fmt(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export function ChantiersBTPV2({ artisan }: { artisan: any }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dl = isPt ? 'pt-PT' : 'fr-FR'

  const { items: chantiers, loading, add, update, remove } = useBTPData({
    table: 'chantiers',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
  })
  const { settings } = useBTPSettings()

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'En attente' | 'Terminés'>('Tous')
  const [form, setForm] = useState<ChantierForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  // Devis + Membres pour l'import
  const [devisList, setDevisList] = useState<DevisSummary[]>([])
  const [membresList, setMembresList] = useState<MembreSummary[]>([])
  const [loadingDevis, setLoadingDevis] = useState(false)

  // Alerte fin de chantier
  const [prolongModal, setProlongModal] = useState<{ chantier: any } | null>(null)
  const [prolongDays, setProlongDays] = useState(2)

  // Confirmation suppression
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Fetch devis + membres quand le modal s'ouvre ──
  const loadDevisAndMembres = useCallback(async () => {
    setLoadingDevis(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      const [devisRes, membresRes] = await Promise.all([
        supabase.from('devis').select('id, numero, client_name, client_address, total_ht_cents, items, created_at, status').eq('artisan_id', artisan?.id).order('created_at', { ascending: false }).limit(50),
        fetch('/api/btp?table=membres', { headers }),
      ])
      if (devisRes.data) setDevisList(devisRes.data as any)
      if (membresRes.ok) {
        const j = await membresRes.json()
        const membres = (j.membres || []).filter((m: any) => m.actif !== false)
        // Calculer le coût journalier via payroll engine
        const { calculateEmployeeCost } = await import('@/lib/payroll/engine')
        const country = (settings.country || 'FR') as 'FR' | 'PT'
        const companyType = settings.company_type || settings.statut_juridique || (country === 'FR' ? 'sarl' : 'lda')
        const mapped: MembreSummary[] = membres.map((m: any) => {
          const netSalary = m.salaire_net_mensuel || m.salaire_net || 0
          let dailyCost = 0
          if (netSalary > 0) {
            const b = calculateEmployeeCost({
              country, company_type: companyType, net_salary: netSalary,
              heures_hebdo: m.heures_hebdo || 35,
              panier_repas_jour: m.panier_repas_jour || 0,
              indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
              prime_mensuelle: m.prime_mensuelle || 0,
              overrides: {
                employee_charge_rate: m.charges_salariales_pct ? m.charges_salariales_pct / 100 : undefined,
                employer_charge_rate: m.charges_patronales_pct ? m.charges_patronales_pct / 100 : undefined,
              },
            })
            dailyCost = b.cost_per_day
          } else {
            const ch = m.cout_horaire || settings.cout_horaire_ouvrier || 15
            const cp = (m.charges_patronales_pct || settings.charges_patronales_pct || 45) / 100
            dailyCost = ch * (1 + cp) * 7
          }
          return {
            id: m.id, prenom: m.prenom || '', nom: m.nom || '',
            role: m.role || m.poste || 'Ouvrier',
            daily_cost: Math.round(dailyCost * 100) / 100,
            actif: m.actif !== false,
          }
        })
        setMembresList(mapped)
      }
    } catch (e) { console.error('loadDevisAndMembres:', e) }
    setLoadingDevis(false)
  }, [artisan?.id, settings])

  // ── Géocode ──
  const geocodeAdresse = useCallback(async (adresse: string) => {
    if (!adresse.trim()) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        if (data.features?.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates
          setForm(f => ({ ...f, latitude: lat, longitude: lng }))
          setGeocoding(false); return
        }
      }
      const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`, {
        signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'Fixit/1.0' }
      })
      if (nom.ok) {
        const nomData = await nom.json()
        if (nomData.length > 0) setForm(f => ({ ...f, latitude: parseFloat(nomData[0].lat), longitude: parseFloat(nomData[0].lon) }))
      }
    } catch { /* silent */ }
    finally { setGeocoding(false) }
  }, [])

  // ── Import devis → form ──
  const importDevis = (devis: DevisSummary) => {
    const items = typeof devis.items === 'string' ? JSON.parse(devis.items) : (devis.items || [])
    const firstDesc = items[0]?.description || ''
    const totalHT = devis.total_ht_cents / 100

    // Estimer les jours à partir du devis
    const delayDays = (devis as any).execution_delay_days || 0
    const today = new Date().toISOString().split('T')[0]
    let dateFin = ''
    if (delayDays > 0) {
      const end = new Date()
      end.setDate(end.getDate() + delayDays)
      dateFin = end.toISOString().split('T')[0]
    }

    setForm(f => ({
      ...f,
      titre: firstDesc || `Devis ${devis.numero}`,
      client: devis.client_name || '',
      adresse: devis.client_address || '',
      budget: String(totalHT),
      devis_id: devis.id,
      dateDebut: (devis as any).prestation_date || today,
      dateFin: dateFin || f.dateFin,
      description: `${isPt ? 'Ref. orçamento' : 'Réf. devis'}: ${devis.numero}\n${items.map((it: any) => `• ${it.description}`).join('\n')}`,
    }))

    // Géocoder l'adresse importée
    if (devis.client_address) geocodeAdresse(devis.client_address)
  }

  // ── Save ──
  const handleSave = async () => {
    if (!form.titre.trim()) return
    setSaving(true)
    if (editId) {
      await update(editId, form)
    } else {
      await add(form)
    }
    setSaving(false); setShowModal(false); setEditId(null); setForm(EMPTY_FORM)
  }

  const handleEdit = (c: any) => {
    setEditId(c.id)
    setForm({
      titre: c.titre, client: c.client, adresse: c.adresse,
      dateDebut: c.dateDebut, dateFin: c.dateFin, budget: c.budget,
      statut: c.statut, description: c.description, equipe: c.equipe,
      latitude: c.latitude, longitude: c.longitude, geoRayonM: c.geoRayonM || 100,
      devis_id: c.devis_id || null, membres_ids: c.membres_ids || [],
    })
    setShowModal(true)
    loadDevisAndMembres()
  }

  const handleDelete = async (id: string) => {
    await remove(id)
    setDeleteConfirm(null)
  }

  const changeStatut = async (id: string, statut: string) => {
    await update(id, { statut } as any)
  }

  // ── Prolongation ──
  const handleProlong = async () => {
    if (!prolongModal) return
    const c = prolongModal.chantier
    const newEnd = new Date(c.dateFin)
    newEnd.setDate(newEnd.getDate() + prolongDays)
    await update(c.id, { dateFin: newEnd.toISOString().split('T')[0] } as any)
    setProlongModal(null)
  }

  // ── Rentabilité par chantier ──
  const getRenta = useCallback((c: any) => {
    const budget = Number(c.budget) || 0
    if (!budget || !c.dateDebut || !c.dateFin) return null

    const d0 = new Date(c.dateDebut)
    const d1 = new Date(c.dateFin)
    const now = new Date()
    const joursPrevu = Math.max(1, Math.ceil((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)))

    // Jours écoulés (si en cours)
    const joursEcoules = c.statut === 'En cours'
      ? Math.max(0, Math.ceil((now.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)))
      : c.statut === 'Terminé' ? joursPrevu : 0

    // Coût MO par jour (employés assignés ou moyenne)
    const membresIds: string[] = c.membres_ids || []
    const membresAssignes = membresIds.length > 0
      ? membresList.filter(m => membresIds.includes(m.id))
      : []
    const nbEmployes = membresAssignes.length || Number(c.equipe) || 1
    const coutMOJour = membresAssignes.length > 0
      ? membresAssignes.reduce((s, m) => s + m.daily_cost, 0)
      : nbEmployes * (settings.cout_horaire_ouvrier || 15) * (1 + (settings.charges_patronales_pct || 45) / 100) * 7

    const marginPct = settings.objectif_marge_pct || 30
    const materiauxPct = 15 // 15% du budget pour matériaux
    const coutMateriaux = budget * materiauxPct / 100
    const coutMOTotal = coutMOJour * joursPrevu
    const coutTotal = coutMOTotal + coutMateriaux
    const beneficePrevu = budget - coutTotal
    const margePrevu = budget > 0 ? (beneficePrevu / budget) * 100 : 0

    // Retard
    const enRetard = c.statut === 'En cours' && joursEcoules > joursPrevu
    const joursRetard = enRetard ? joursEcoules - joursPrevu : 0
    const perteParJourRetard = coutMOJour
    const perteRetardTotal = joursRetard * perteParJourRetard
    const beneficeActuel = beneficePrevu - perteRetardTotal

    // Status
    const status: 'profit' | 'warning' | 'loss' =
      beneficeActuel > 0 && margePrevu >= 25 ? 'profit'
        : beneficeActuel > 0 ? 'warning'
          : 'loss'

    // Fin prévue dépassée ?
    const finDepassee = c.statut === 'En cours' && now > d1

    return {
      budget,
      joursPrevu,
      joursEcoules,
      nbEmployes,
      coutMOJour: Math.round(coutMOJour),
      coutMOTotal: Math.round(coutMOTotal),
      coutMateriaux: Math.round(coutMateriaux),
      coutTotal: Math.round(coutTotal),
      beneficePrevu: Math.round(beneficePrevu),
      margePrevu: Math.round(margePrevu * 10) / 10,
      enRetard,
      joursRetard,
      perteParJourRetard: Math.round(perteParJourRetard),
      perteRetardTotal: Math.round(perteRetardTotal),
      beneficeActuel: Math.round(beneficeActuel),
      status,
      finDepassee,
    }
  }, [membresList, settings])

  // ── Charger membres au mount ──
  useEffect(() => { loadDevisAndMembres() }, [loadDevisAndMembres])

  const filtered = filter === 'Tous'
    ? chantiers
    : chantiers.filter((c: any) => filter === 'Terminés' ? c.statut === 'Terminé' : c.statut === filter)

  const STATUS_V22: Record<string, string> = {
    'En cours': 'v22-tag v22-tag-green', 'Terminé': 'v22-tag v22-tag-gray',
    'En attente': 'v22-tag v22-tag-amber', 'Annulé': 'v22-tag v22-tag-red',
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" /></div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HardHat size={22} /> {isPt ? 'Obras / Chantiers' : 'Chantiers'}</h1>
          <p className="v22-page-sub">{isPt ? `${chantiers.length} obra(s) registada(s)` : `${chantiers.length} chantier(s) enregistré(s)`}</p>
        </div>
        <button className="v22-btn" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); loadDevisAndMembres() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PlusCircle size={14} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Filtres */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['Tous', 'En cours', 'En attente', 'Terminés'] as const).map(f => {
            const labels: Record<string, string> = {
              'Tous': isPt ? 'Todas' : 'Toutes', 'En cours': isPt ? 'Em curso' : 'En cours',
              'En attente': isPt ? 'Pendentes' : 'En attente', 'Terminés': isPt ? 'Concluídas' : 'Terminés',
            }
            const count = f === 'Tous' ? chantiers.length : chantiers.filter((c: any) => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`v22-tag ${filter === f ? 'v22-tag-yellow' : 'v22-tag-gray'}`}
                style={{ cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HardHat size={48} /></div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma obra' : 'Aucun chantier'}</div>
            <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}</p>
            <button className="v22-btn" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); loadDevisAndMembres() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PlusCircle size={14} /> {isPt ? 'Criar obra' : 'Créer un chantier'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((c: any) => {
              const renta = getRenta(c)
              return (
                <div key={c.id} className="v22-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Carte chantier */}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{c.titre}</span>
                          <span className={STATUS_V22[c.statut] || 'v22-tag v22-tag-gray'} style={{ fontSize: 11 }}>{c.statut}</span>
                          {c.latitude && <span className="v22-tag v22-tag-green" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> GPS</span>}
                          {c.devis_id && <span className="v22-tag v22-tag-blue" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}><FileText size={10} /> Devis</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {c.client && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><User size={12} /> {c.client}</span>}
                          {c.adresse && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {c.adresse}</span>}
                          {(c.dateDebut || c.dateFin) && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Calendar size={12} /> {c.dateDebut || '?'} → {c.dateFin || '?'}</span>}
                          {c.budget && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Euro size={12} /> {Number(c.budget).toLocaleString(dl)} €</span>}
                        </div>
                        {/* Employés assignés */}
                        {c.membres_ids?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                            {(c.membres_ids as string[]).map((mid: string) => {
                              const m = membresList.find(mm => mm.id === mid)
                              return m ? <span key={mid} className="v22-tag v22-tag-gray" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Users size={10} /> {m.prenom} {m.nom}</span> : null
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="v22-btn v22-btn-sm" onClick={() => handleEdit(c)} style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}><Pencil size={14} /></button>
                        <select value={c.statut} onChange={e => changeStatut(c.id, e.target.value)} className="v22-form-input" style={{ minWidth: 130, fontSize: 13, padding: '6px 10px' }}>
                          {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => {
                            const sl: Record<string, string> = isPt
                              ? { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }
                              : { 'En attente': 'En attente', 'En cours': 'En cours', 'Terminé': 'Terminé', 'Annulé': 'Annulé' }
                            return <option key={s} value={s}>{sl[s]}</option>
                          })}
                        </select>
                        <button onClick={() => setDeleteConfirm(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>

                  {/* ══════ BANDEAU RENTABILITÉ ══════ */}
                  {renta && (
                    <div style={{
                      padding: '10px 16px',
                      background: renta.status === 'profit' ? '#F0FDF4' : renta.status === 'warning' ? '#FEF3C7' : '#FEF2F2',
                      borderTop: `2px solid ${renta.status === 'profit' ? '#22C55E' : renta.status === 'warning' ? '#F59E0B' : '#EF4444'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: renta.beneficeActuel >= 0 ? '#166534' : '#991B1B',
                        }}>
                          {renta.status === 'profit' ? <CheckCircle2 size={14} style={{ display: 'inline' }} /> : renta.status === 'warning' ? <AlertTriangle size={14} style={{ display: 'inline' }} /> : <AlertCircle size={14} style={{ display: 'inline' }} />}{' '}
                          {isPt ? 'Rentabilidade' : 'Rentabilité'}: {renta.beneficeActuel >= 0 ? '+' : ''}{fmt(renta.beneficeActuel, dl)} €
                        </span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          ({isPt ? 'Margem' : 'Marge'}: {renta.margePrevu}%)
                        </span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          {isPt ? 'Custo M.O.' : 'Coût M.O.'}: {fmt(renta.coutMOJour, dl)} €/{isPt ? 'dia' : 'j'} × {renta.joursPrevu}{isPt ? 'j' : 'j'}
                        </span>
                      </div>

                      {/* Retard */}
                      {renta.enRetard && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>
                            <Siren size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {renta.joursRetard}{isPt ? ' dias de atraso' : 'j de retard'} = -{fmt(renta.perteRetardTotal, dl)} €
                          </span>
                          <span style={{ fontSize: 11, color: '#EF4444' }}>
                            (-{fmt(renta.perteParJourRetard, dl)} €/{isPt ? 'dia' : 'jour'})
                          </span>
                        </div>
                      )}

                      {/* Alerte fin dépassée */}
                      {renta.finDepassee && (
                        <button onClick={() => { setProlongModal({ chantier: c }); setProlongDays(2) }}
                          className="v22-btn v22-btn-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11 }}>
                          <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {isPt ? 'Prolongar / Encerrar' : 'Prolonger / Clôturer'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══════ MODAL PROLONGATION ══════ */}
      {prolongModal && (() => {
        const c = prolongModal.chantier
        const renta = getRenta(c)
        const newRenta = renta ? {
          ...renta,
          joursPrevu: renta.joursPrevu + prolongDays,
          coutMOTotal: renta.coutMOJour * (renta.joursPrevu + prolongDays),
          coutTotal: renta.coutMOJour * (renta.joursPrevu + prolongDays) + renta.coutMateriaux,
          beneficePrevu: renta.budget - (renta.coutMOJour * (renta.joursPrevu + prolongDays) + renta.coutMateriaux),
        } : null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="v22-card" style={{ width: '100%', maxWidth: 480 }}>
              <div className="v22-card-head">
                <span className="v22-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> {isPt ? 'O seu chantier terminou?' : 'Votre chantier est-il fini ?'}</span>
                <button className="v22-btn v22-btn-sm" onClick={() => setProlongModal(null)}>✕</button>
              </div>
              <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center', fontSize: 14 }}>
                  <strong>{c.titre}</strong> — {isPt ? 'Previsto' : 'Prévu'}: {renta?.joursPrevu}{isPt ? ' dias' : ' jours'}
                </div>

                {/* Option 1: Clôturer */}
                <button onClick={async () => { await changeStatut(c.id, 'Terminé'); setProlongModal(null) }}
                  className="v22-btn" style={{ width: '100%', background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', padding: '12px 14px', fontWeight: 700 }}>
                  <CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {isPt ? 'Sim, encerrar a obra' : 'Oui, clôturer le chantier'}
                </button>

                {/* Option 2: Prolonger */}
                <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>
                    {isPt ? 'Não, estimar dias suplementares:' : 'Non, estimer les jours supplémentaires :'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="number" min={1} max={60} value={prolongDays}
                      onChange={e => setProlongDays(Math.max(1, Number(e.target.value)))}
                      className="v22-form-input" style={{ width: 80, textAlign: 'center', fontWeight: 700, fontSize: 16 }} />
                    <span style={{ fontSize: 13, color: '#92400E' }}>{isPt ? 'dias a mais' : 'jours de plus'}</span>
                  </div>

                  {/* Nouveau calcul */}
                  {newRenta && renta && (
                    <div style={{ marginTop: 12, padding: 12, background: 'white', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{isPt ? 'Novo custo M.O.' : 'Nouveau coût M.O.'}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>{fmt(newRenta.coutMOTotal, dl)} €</div>
                        <div style={{ fontSize: 10, color: '#EF4444' }}>+{fmt(newRenta.coutMOTotal - renta.coutMOTotal, dl)} €</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{isPt ? 'Nova rentabilidade' : 'Nouvelle rentabilité'}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: newRenta.beneficePrevu >= 0 ? '#22C55E' : '#EF4444' }}>
                          {newRenta.beneficePrevu >= 0 ? '+' : ''}{fmt(newRenta.beneficePrevu, dl)} €
                        </div>
                        <div style={{ fontSize: 10, color: newRenta.beneficePrevu < renta.beneficePrevu ? '#EF4444' : '#6B7280' }}>
                          {fmt(newRenta.beneficePrevu - renta.beneficePrevu, dl)} €
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={handleProlong}
                    className="v22-btn" style={{ width: '100%', marginTop: 12, background: '#F59E0B', color: 'white', fontWeight: 700, padding: '10px 14px' }}>
                    <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {isPt ? `Prolongar de ${prolongDays} dias` : `Prolonger de ${prolongDays} jours`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════ MODAL CONFIRMATION SUPPRESSION ══════ */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 400 }}>
            <div className="v22-card-head">
              <span className="v22-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={16} /> {isPt ? 'Confirmar remoção' : 'Confirmer la suppression'}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <p style={{ fontSize: 14, marginBottom: 16 }}>{isPt ? 'Tem certeza que deseja remover esta obra?' : 'Voulez-vous vraiment supprimer ce chantier ?'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }}
                  onClick={() => setDeleteConfirm(null)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
                <button className="v22-btn" style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', fontWeight: 700 }}
                  onClick={() => handleDelete(deleteConfirm)}>{isPt ? 'Remover' : 'Supprimer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL CRÉATION/ÉDITION ══════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><HardHat size={16} /> {editId ? (isPt ? 'Editar obra' : 'Modifier le chantier') : (isPt ? 'Nova obra' : 'Nouveau chantier')}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Import devis ── */}
              {!editId && (
                <div style={{ background: '#F0F9FF', borderRadius: 8, padding: 12, border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0369A1', marginBottom: 8 }}>
                    <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {isPt ? 'Importar de um orçamento existente' : 'Importer depuis un devis existant'}
                  </div>
                  {loadingDevis ? (
                    <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={12} className="animate-spin" /> {isPt ? 'A carregar...' : 'Chargement...'}</div>
                  ) : devisList.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{isPt ? 'Nenhum orçamento encontrado' : 'Aucun devis trouvé'}</div>
                  ) : (
                    <select className="v22-form-input" style={{ fontSize: 12 }}
                      value="" onChange={e => {
                        const devis = devisList.find(d => d.id === e.target.value)
                        if (devis) importDevis(devis)
                      }}>
                      <option value="">{isPt ? '— Selecionar um orçamento —' : '— Sélectionner un devis —'}</option>
                      {devisList.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.numero} — {d.client_name} — {(d.total_ht_cents / 100).toLocaleString(dl)} € ({d.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="v22-form-label">{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className="v22-form-input" value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
                  placeholder={isPt ? 'ex: Immeuble R+3 — Gros oeuvre' : 'ex: Immeuble R+3 — Gros oeuvre'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Cliente / Dono de obra' : 'Client / Maître d\'ouvrage'}</label>
                  <input className="v22-form-input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
                </div>
                <div>
                  <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Euro size={14} /> Budget HT (€)</label>
                  <input type="number" className="v22-form-input" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="v22-form-input" style={{ flex: 1 }} value={form.adresse}
                    onChange={e => setForm({ ...form, adresse: e.target.value })}
                    placeholder={isPt ? 'Rua, cidade...' : 'Rue, ville...'} />
                  <button className="v22-btn v22-btn-sm" onClick={() => geocodeAdresse(form.adresse)}
                    disabled={geocoding || !form.adresse.trim()} style={{ whiteSpace: 'nowrap' }}>
                    {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} {form.latitude ? <CheckCircle2 size={14} /> : 'GPS'}
                  </button>
                </div>
                {form.latitude && <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> GPS : {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}</div>}
              </div>

              <div>
                <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Satellite size={14} /> {isPt ? 'Raio para pointagem GPS' : 'Rayon pointage GPS'}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={25} max={500} step={25} value={form.geoRayonM}
                    onChange={e => setForm({ ...form, geoRayonM: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, minWidth: 50, textAlign: 'right' }}>{form.geoRayonM}m</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={14} /> {isPt ? 'Data de início' : 'Date de début'}</label>
                  <input type="date" className="v22-form-input" value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} />
                </div>
                <div>
                  <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={14} /> {isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className="v22-form-input" value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} />
                </div>
              </div>

              {/* ── Équipe / Employés assignés ── */}
              <div>
                <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {isPt ? 'Empregados atribuídos' : 'Employés assignés'}</label>
                {membresList.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#6B7280', padding: 8 }}>
                    {isPt ? 'Aucun empregado. Ajoutez-en dans "Équipes".' : 'Aucun employé. Ajoutez-en dans "Équipes".'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                    {membresList.map(m => {
                      const selected = (form.membres_ids || []).includes(m.id)
                      return (
                        <label key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                          background: selected ? '#F0FDF4' : 'var(--v22-bg)', border: `1px solid ${selected ? '#86EFAC' : 'var(--v22-border)'}`,
                        }}>
                          <input type="checkbox" checked={selected}
                            onChange={() => {
                              const ids = form.membres_ids || []
                              setForm({ ...form, membres_ids: selected ? ids.filter(id => id !== m.id) : [...ids, m.id] })
                            }} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{m.prenom} {m.nom}</span>
                          <span style={{ fontSize: 11, color: '#6B7280' }}>{m.role}</span>
                          <span style={{ fontSize: 11, color: '#EF4444', marginLeft: 'auto' }}>{m.daily_cost.toFixed(0)} €/{isPt ? 'dia' : 'j'}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {(form.membres_ids || []).length > 0 && (
                  <div style={{ fontSize: 11, color: '#166534', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> {(form.membres_ids || []).length} {isPt ? 'empregado(s) selecionado(s)' : 'employé(s) sélectionné(s)'}
                    — {isPt ? 'Custo/dia' : 'Coût/j'}: {fmt(membresList.filter(m => (form.membres_ids || []).includes(m.id)).reduce((s, m) => s + m.daily_cost, 0), dl)} €
                  </div>
                )}
              </div>

              <div>
                <label className="v22-form-label">{isPt ? 'Descrição' : 'Description'}</label>
                <textarea className="v22-form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }}
                onClick={() => setShowModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }}
                onClick={handleSave} disabled={!form.titre.trim() || saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {editId ? (isPt ? 'Guardar' : 'Enregistrer') : (isPt ? 'Criar obra' : 'Créer le chantier')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
