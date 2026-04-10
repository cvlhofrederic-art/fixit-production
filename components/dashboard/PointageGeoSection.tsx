'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings, useGeoPointage } from '@/lib/hooks/use-btp-data'
import { Artisan } from '@/lib/types'
import { Loader2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// POINTAGE GÉO V2 — Pointage par GPS + manuel
// Quand l'ouvrier arrive sur le chantier (dans le rayon configuré),
// le pointage se déclenche automatiquement ou propose confirmation.
// ═══════════════════════════════════════════════════════════════════════════════

interface Chantier {
  id: string
  titre: string
  statut: string
  adresse?: string
  latitude?: number
  longitude?: number
  geoRayonM?: number
}

interface Membre {
  id: string
  prenom: string
  nom: string
  typeCompte?: string
}

interface Pointage {
  id: string
  employe: string
  poste?: string
  chantier?: string
  date: string
  heureArrivee: string
  heureDepart?: string
  pauseMinutes: number
  heuresTravaillees: number
  notes?: string
  mode?: 'manuel' | 'geo_confirme' | 'geo_auto'
}

interface NearestChantier extends Chantier {
  distance: number
  isDepot?: boolean
}

export function PointageGeoSection({ artisan, orgRole }: { artisan: Artisan; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe'
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateLocale = isPt ? 'pt-PT' : 'fr-FR'
  const userId = artisan?.user_id || ''

  const { items: pointages, loading: loadingP, add, remove, refresh } = useBTPData({
    table: 'pointages', artisanId: artisan?.id || '', userId,
  })
  const { items: chantiers } = useBTPData({
    table: 'chantiers', artisanId: artisan?.id || '', userId,
  })
  const { items: membres } = useBTPData({
    table: 'membres', artisanId: artisan?.id || '', userId,
  })
  const { settings } = useBTPSettings()
  const geo = useGeoPointage()

  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'pointages' | 'geo'>('pointages')
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmploye, setFilterEmploye] = useState('')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'watching' | 'in_zone' | 'pointed'>('idle')
  const [nearestChantier, setNearestChantier] = useState<NearestChantier | null>(null)
  const [form, setForm] = useState({
    employe: '', poste: '', chantier: '', chantierId: '',
    date: new Date().toISOString().split('T')[0],
    heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '',
  })

  const calcH = (a: string, d: string, p: number) => {
    const [ah, am] = a.split(':').map(Number)
    const [dh, dm] = d.split(':').map(Number)
    return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - p) / 60)
  }

  // ── Géo-détection : vérifier proximité chantiers ──────────────────────────
  useEffect(() => {
    if (!geo.position || !settings.geo_pointage_enabled) return

    const activeChantiers = (chantiers as Chantier[]).filter(c => c.statut === 'En cours' && c.latitude && c.longitude)
    let nearest: NearestChantier | null = null
    let minDist = Infinity

    for (const c of activeChantiers) {
      const dist = geo.distanceTo(c.latitude!, c.longitude!)
      if (dist !== null && dist < minDist) {
        minDist = dist
        nearest = { ...c, distance: Math.round(dist) }
      }
    }

    // Vérifier aussi le dépôt
    if (settings.depot_lat && settings.depot_lng) {
      const depotDist = geo.distanceTo(settings.depot_lat, settings.depot_lng)
      if (depotDist !== null && depotDist < minDist) {
        minDist = depotDist
        nearest = { id: 'depot', titre: isPt ? 'Depósito' : 'Dépôt', statut: 'En cours', distance: Math.round(depotDist), geoRayonM: settings.depot_rayon_m, latitude: settings.depot_lat, longitude: settings.depot_lng, isDepot: true }
      }
    }

    if (nearest && nearest.distance <= (nearest.geoRayonM || 100)) {
      setNearestChantier(nearest)
      setGeoStatus('in_zone')
    } else {
      setNearestChantier(nearest)
      setGeoStatus('watching')
    }
  }, [geo.position, chantiers, settings, isPt, geo])

  // ── Pointage auto/confirmé par GPS ────────────────────────────────────────
  const pointGeo = useCallback(async (chantier: NearestChantier) => {
    const now = new Date()
    const heure = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    await add({
      employe: artisan?.company_name || 'Moi',
      poste: 'patron',
      chantier: chantier.titre,
      chantierId: chantier.isDepot ? undefined : chantier.id,
      date: now.toISOString().split('T')[0],
      heureArrivee: heure,
      heureDepart: '',
      pauseMinutes: 0,
      heuresTravaillees: 0,
      notes: `Pointage GPS (${chantier.distance}m)`,
      mode: 'geo_confirme',
      arriveeLat: geo.position?.lat,
      arriveeLng: geo.position?.lng,
      distanceM: chantier.distance,
    })

    setGeoStatus('pointed')
    await refresh()
  }, [add, artisan, geo.position, refresh])

  // ── Pointage manuel ───────────────────────────────────────────────────────
  const addPointage = async () => {
    if (!form.employe) return
    await add({
      ...form,
      heuresTravaillees: Math.round(calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100,
      mode: 'manuel',
    })
    setShowForm(false)
    setForm({ employe: '', poste: '', chantier: '', chantierId: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })
  }

  // ── Filtres et stats ──────────────────────────────────────────────────────
  const allPointages = pointages as Pointage[]
  const employes = [...new Set(allPointages.map(p => p.employe))].filter(Boolean)
  const filtered = allPointages.filter(p => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s, p) => s + (p.heuresTravaillees || 0), 0)
  const heuresByEmp = employes.map(e => ({
    employe: e,
    heures: allPointages.filter(p => p.employe === e).reduce((s, p) => s + (p.heuresTravaillees || 0), 0),
    jours: new Set(allPointages.filter(p => p.employe === e).map(p => p.date)).size,
  }))

  // Postes dropdown
  const POSTES = isPt
    ? ['Chefe de obra', 'Pedreiro', 'Eletricista', 'Canalizador', 'Carpinteiro', 'Pintor', 'Servente']
    : ['Chef de chantier', 'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Peintre', 'Manoeuvre']

  // Weekly summary: group by employee, show hours per weekday
  const getWeeklySummary = () => {
    const weekDays = isPt ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
    const summary = employes.map(emp => {
      const empPointages = allPointages.filter(p => p.employe === emp)
      const byDay: Record<number, number> = {}
      let total = 0
      empPointages.forEach(p => {
        if (!p.date) return
        const d = new Date(p.date + 'T00:00')
        const dow = d.getDay() // 0=Sun, 1=Mon...
        if (dow >= 1 && dow <= 5) {
          byDay[dow] = (byDay[dow] || 0) + (p.heuresTravaillees || 0)
          total += (p.heuresTravaillees || 0)
        }
      })
      return { employe: emp, byDay, total }
    })
    return { weekDays, summary }
  }

  if (loadingP) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block', color: '#999' }} />
      <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div className={isV5 ? "v5-pg-t" : "v22-page-header"} style={{ flexDirection: 'column' }}>
        <h1>{isPt ? 'Pointagem equipas' : 'Pointage équipes'}</h1>
        <p>{isPt ? 'Manual ou automático por GPS' : 'Suivi des heures'}</p>
      </div>

      {/* Tabs + manual pointer button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '.75rem', alignItems: 'center' }}>
        <div className={isV5 ? "v5-tabs" : "v22-tabs"} style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button className={isV5 ? `v5-tab-b${tab === 'pointages' ? ' active' : ''}` : `v22-tab ${tab === 'pointages' ? 'active' : ''}`} onClick={() => setTab('pointages')}>
            {isPt ? 'Pontagens' : 'Pointages'}
          </button>
          <button className={isV5 ? `v5-tab-b${tab === 'geo' ? ' active' : ''}` : `v22-tab ${tab === 'geo' ? 'active' : ''}`} onClick={() => setTab('geo')}>
            GPS
          </button>
        </div>
        {tab === 'pointages' && (
          <button className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"} onClick={() => setShowForm(true)}>
            {isPt ? '⏱️ Pontar manualmente' : '⏱️ Pointer manuellement'}
          </button>
        )}
      </div>

      {/* ══ TAB GPS ══ */}
      {tab === 'geo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>

          {/* GPS status card */}
          <div className={isV5 ? "v5-card" : "v22-card"}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                background: geoStatus === 'in_zone' ? '#E8F5E9' : geoStatus === 'pointed' ? '#E8F5E9' : geoStatus === 'watching' ? '#FFF3E0' : '#F5F5F5',
              }}>
                {geoStatus === 'in_zone' ? '📍' : geoStatus === 'pointed' ? '✅' : geoStatus === 'watching' ? '🔍' : '📡'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {geoStatus === 'idle' && (isPt ? 'GPS desativado' : 'GPS désactivé')}
                  {geoStatus === 'watching' && (isPt ? 'A procurar obras próximas...' : 'Recherche de chantiers proches...')}
                  {geoStatus === 'in_zone' && (isPt ? `Perto de: ${nearestChantier?.titre}` : `Proche de : ${nearestChantier?.titre}`)}
                  {geoStatus === 'pointed' && (isPt ? 'Pontado!' : 'Pointé !')}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {nearestChantier && <>{nearestChantier.distance}m</>}
                  {geo.position && ` — ${geo.position.lat.toFixed(4)}, ${geo.position.lng.toFixed(4)}`}
                </div>
              </div>
            </div>

            {!settings.geo_pointage_enabled && (
              <div className={isV5 ? "v5-al warn" : "v22-alert v22-alert-amber"} style={{ marginBottom: 12 }}>
                ⚠️ {isPt
                  ? 'A pointagem GPS está desativada. Ative nas Configurações BTP.'
                  : 'Le pointage GPS est désactivé. Activez-le dans les Paramètres BTP.'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!geo.watching ? (
                <button className={isV5 ? "v5-btn v5-btn-s" : "v22-btn v22-btn-secondary"} onClick={() => { geo.start(); setGeoStatus('watching') }}>
                  📡 {isPt ? 'Ativar GPS' : 'Activer GPS'}
                </button>
              ) : (
                <button className={isV5 ? "v5-btn v5-btn-d" : "v22-btn v22-btn-danger"} onClick={() => { geo.stop(); setGeoStatus('idle') }}>
                  ⏹ {isPt ? 'Parar GPS' : 'Arrêter GPS'}
                </button>
              )}
              {geoStatus === 'in_zone' && nearestChantier && (
                <button className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"} onClick={() => pointGeo(nearestChantier)}>
                  ✅ {isPt ? `Pontar em ${nearestChantier.titre}` : `Pointer sur ${nearestChantier.titre}`}
                </button>
              )}
            </div>
          </div>

          {/* Chantiers with GPS */}
          <div className={isV5 ? "v5-card" : "v22-card"}>
            <div className={isV5 ? "v5-st" : "v22-section-title"}>📍 {isPt ? 'Obras com GPS' : 'Chantiers avec GPS'}</div>
            {(chantiers as Chantier[]).filter(c => c.latitude && c.statut === 'En cours').length === 0 ? (
              <p style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#999' }}>
                {isPt
                  ? 'Nenhuma obra com GPS. Adicione coordenadas GPS ao criar uma obra.'
                  : 'Aucun chantier avec GPS. Ajoutez les coordonnées GPS en créant un chantier.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(chantiers as Chantier[]).filter(c => c.latitude && c.statut === 'En cours').map(c => {
                  const dist = geo.position ? geo.distanceTo(c.latitude!, c.longitude!) : null
                  const inZone = dist !== null && dist <= (c.geoRayonM || 100)
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 6,
                      background: inZone ? '#E8F5E9' : '#FAFAFA',
                      border: inZone ? '2px solid #4CAF50' : '1px solid #E8E8E8',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{c.titre}</div>
                        <div style={{ fontSize: 10, color: '#999' }}>
                          {c.adresse} — {isPt ? 'raio' : 'rayon'}: {c.geoRayonM || 100}m
                        </div>
                      </div>
                      <div>
                        {dist !== null ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: inZone ? '#4CAF50' : '#999' }}>
                            {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#BBB' }}>—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB POINTAGES ══ */}
      {tab === 'pointages' && (
        <>
          {/* Form pointage manuel */}
          {showForm && (
            <div className={isV5 ? "v5-card" : "v22-card"} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <div className={isV5 ? "v5-st" : "v22-section-title"} style={{ marginBottom: 0 }}>{isPt ? 'Nova pontagem' : 'Nouveau pointage'}</div>
                <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div className={isV5 ? "v5-fr" : "v22-form-row"} style={{ marginBottom: '.75rem' }}>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Funcionário *' : 'Employé *'}</label>
                  {membres.length > 0 ? (
                    <select className={isV5 ? "v5-fi" : "v22-input"} value={form.employe} onChange={e => {
                      const m = (membres as Membre[]).find(m => `${m.prenom} ${m.nom}` === e.target.value)
                      setForm({ ...form, employe: e.target.value, poste: m?.typeCompte || form.poste })
                    }}>
                      <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                      {(membres as Membre[]).map(m => <option key={m.id} value={`${m.prenom} ${m.nom}`}>{m.prenom} {m.nom}</option>)}
                    </select>
                  ) : (
                    <input className={isV5 ? "v5-fi" : "v22-input"} value={form.employe} onChange={e => setForm({ ...form, employe: e.target.value })}
                      placeholder={isPt ? 'Nome do funcionário' : 'Nom de l\'employé'} />
                  )}
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Função' : 'Poste'}</label>
                  <select className={isV5 ? "v5-fi" : "v22-input"} value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })}>
                    <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                    {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Obra' : 'Chantier'}</label>
                  {(chantiers as Chantier[]).filter(c => c.statut === 'En cours').length > 0 ? (
                    <select className={isV5 ? "v5-fi" : "v22-input"} value={form.chantier} onChange={e => {
                      const c = (chantiers as Chantier[]).find(c => c.titre === e.target.value)
                      setForm({ ...form, chantier: e.target.value, chantierId: c?.id || '' })
                    }}>
                      <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                      {(chantiers as Chantier[]).filter(c => c.statut === 'En cours').map(c => (
                        <option key={c.id} value={c.titre}>{c.titre}</option>
                      ))}
                    </select>
                  ) : (
                    <input className={isV5 ? "v5-fi" : "v22-input"} value={form.chantier} onChange={e => setForm({ ...form, chantier: e.target.value })} />
                  )}
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>Date</label>
                  <input type="date" className={isV5 ? "v5-fi" : "v22-input"} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Chegada' : 'Arrivée'}</label>
                  <input type="time" className={isV5 ? "v5-fi" : "v22-input"} value={form.heureArrivee} onChange={e => setForm({ ...form, heureArrivee: e.target.value })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Saída' : 'Départ'}</label>
                  <input type="time" className={isV5 ? "v5-fi" : "v22-input"} value={form.heureDepart} onChange={e => setForm({ ...form, heureDepart: e.target.value })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Pausa (min)' : 'Pause (min)'}</label>
                  <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={form.pauseMinutes} onChange={e => setForm({ ...form, pauseMinutes: Number(e.target.value) })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>Notes</label>
                  <input className={isV5 ? "v5-fi" : "v22-input"} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className={isV5 ? "v5-al info" : "v22-alert v22-alert-blue"} style={{ marginBottom: 12 }}>
                ⏱️ {isPt ? 'Horas' : 'Heures'}: <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"} onClick={addPointage} disabled={!form.employe}>
                  ✅ {isPt ? 'Registar' : 'Enregistrer'}
                </button>
                <button className={isV5 ? "v5-btn" : "v22-btn"} onClick={() => setShowForm(false)}>
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
              </div>
            </div>
          )}

          {/* Daily tracking table */}
          <div className={isV5 ? "v5-card" : "v22-card"} style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
              <div className={isV5 ? "v5-st" : "v22-section-title"} style={{ marginBottom: 0 }}>
                {isPt ? 'Pontagem do dia' : 'Pointage du jour'} — {filterDate ? new Date(filterDate + 'T00:00').toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }) : (isPt ? 'Todos' : 'Tous')}
              </div>
              <div className={isV5 ? "v5-search" : "v22-search"} style={{ marginBottom: 0 }}>
                <input type="date" className={isV5 ? "v5-search-in" : "v22-search-in"} style={{ minWidth: 140, flex: 'none' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                <select className={isV5 ? "v5-filter-sel" : "v22-filter-sel"} value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}>
                  <option value="">{isPt ? 'Todos' : 'Tous'}</option>
                  {employes.map(e => <option key={e}>{e}</option>)}
                </select>
                <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setFilterDate('')}>{isPt ? 'Ver tudo' : 'Voir tout'}</button>
              </div>
            </div>
            <table className={isV5 ? "v5-dt" : "v22-table"}>
              <thead>
                <tr>
                  <th>{isPt ? 'Funcionário' : 'Employé'}</th>
                  <th>{isPt ? 'Obra' : 'Chantier'}</th>
                  <th>{isPt ? 'Chegada' : 'Arrivée'}</th>
                  <th>{isPt ? 'Saída' : 'Départ'}</th>
                  <th>{isPt ? 'Horas' : 'Heures'}</th>
                  <th>GPS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    {isPt ? 'Nenhuma pontagem' : 'Aucun pointage'}
                  </td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.employe}</td>
                    <td>{p.chantier || '—'}</td>
                    <td>{p.heureArrivee}</td>
                    <td>{p.heureDepart || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.heuresTravaillees ? `${p.heuresTravaillees}h` : '—'}</td>
                    <td>
                      {p.mode === 'geo_confirme' && <span className={isV5 ? "v5-badge v5-badge-green" : "v22-tag v22-tag-green"}>✓ Sur site</span>}
                      {p.mode === 'geo_auto' && <span className={isV5 ? "v5-badge v5-badge-blue" : "v22-tag v22-tag-blue"}>✓ Auto</span>}
                      {p.mode === 'manuel' && <span className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"}>Manuel</span>}
                      {!p.mode && <span className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"}>—</span>}
                    </td>
                    <td>
                      <button className={isV5 ? "v5-btn v5-btn-sm v5-btn-d" : "v22-btn v22-btn-sm v22-btn-danger"} onClick={() => remove(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 11, color: '#999', textAlign: 'right' }}>
              {filtered.length} {isPt ? 'pontagens' : 'pointages'} — <strong>{totalH.toFixed(1)}h</strong>
            </div>
          </div>

          {/* Weekly summary table */}
          <div className={isV5 ? "v5-card" : "v22-card"}>
            <div className={isV5 ? "v5-st" : "v22-section-title"}>{isPt ? 'Resumo horas semanais' : 'Résumé heures hebdomadaires'}</div>
            {(() => {
              const { weekDays, summary } = getWeeklySummary()
              return (
                <table className={isV5 ? "v5-dt" : "v22-table"}>
                  <thead>
                    <tr>
                      <th>{isPt ? 'Funcionário' : 'Employé'}</th>
                      {weekDays.map(d => <th key={d}>{d}</th>)}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.length === 0 ? (
                      <tr><td colSpan={weekDays.length + 2} style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                        {isPt ? 'Sem dados' : 'Aucune donnée'}
                      </td></tr>
                    ) : summary.map(row => (
                      <tr key={row.employe}>
                        <td style={{ fontWeight: 600 }}>{row.employe}</td>
                        {[1, 2, 3, 4, 5].map(dow => (
                          <td key={dow}>{row.byDay[dow] ? `${row.byDay[dow].toFixed(0)}h` : '—'}</td>
                        ))}
                        <td style={{ fontWeight: 600 }}>{row.total.toFixed(0)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
