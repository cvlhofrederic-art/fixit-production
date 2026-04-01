'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings, useGeoPointage } from '@/lib/hooks/use-btp-data'
import { Loader2, Clock, ClipboardList, Radio, Plus, MapPin, CheckCircle, Search, AlertTriangle, Square, Ruler, Calendar, Pencil, Satellite, X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// POINTAGE GÉO V2 — Pointage par GPS + manuel
// Quand l'ouvrier arrive sur le chantier (dans le rayon configuré),
// le pointage se déclenche automatiquement ou propose confirmation.
// ═══════════════════════════════════════════════════════════════════════════════

export function PointageGeoSection({ artisan }: { artisan: any }) {
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
  const [nearestChantier, setNearestChantier] = useState<any>(null)
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

    const activeChantiers = chantiers.filter((c: any) => c.statut === 'En cours' && c.latitude && c.longitude)
    let nearest: any = null
    let minDist = Infinity

    for (const c of activeChantiers) {
      const dist = geo.distanceTo(c.latitude, c.longitude)
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
        nearest = { titre: isPt ? 'Depósito' : 'Dépôt', distance: Math.round(depotDist), geoRayonM: settings.depot_rayon_m, latitude: settings.depot_lat, longitude: settings.depot_lng, isDepot: true }
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
  const pointGeo = useCallback(async (chantier: any) => {
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
    } as any)

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
    } as any)
    setShowForm(false)
    setForm({ employe: '', poste: '', chantier: '', chantierId: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })
  }

  // ── Filtres et stats ──────────────────────────────────────────────────────
  const employes = [...new Set(pointages.map((p: any) => p.employe))].filter(Boolean)
  const filtered = pointages.filter((p: any) => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s: number, p: any) => s + (p.heuresTravaillees || 0), 0)
  const heuresByEmp = employes.map(e => ({
    employe: e,
    heures: pointages.filter((p: any) => p.employe === e).reduce((s: number, p: any) => s + (p.heuresTravaillees || 0), 0),
    jours: new Set(pointages.filter((p: any) => p.employe === e).map((p: any) => p.date)).size,
  }))

  // Postes dropdown
  const POSTES = isPt
    ? ['Chefe de obra', 'Pedreiro', 'Eletricista', 'Canalizador', 'Carpinteiro', 'Pintor', 'Servente']
    : ['Chef de chantier', 'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Peintre', 'Manoeuvre']

  if (loadingP) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}><Loader2 size={24} className="animate-spin" /></div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title"><Clock size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Pointagem' : 'Pointage'}</h2>
          <p className="v22-page-sub">{isPt ? 'Manuel ou automático por GPS' : 'Manuel ou automatique par GPS'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`v22-btn v22-btn-sm`}
            style={{ background: tab === 'pointages' ? 'var(--v22-yellow)' : 'transparent' }}
            onClick={() => setTab('pointages')}>
            <ClipboardList size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Pontagens' : 'Pointages'}
          </button>
          <button className={`v22-btn v22-btn-sm`}
            style={{ background: tab === 'geo' ? 'var(--v22-yellow)' : 'transparent' }}
            onClick={() => setTab('geo')}>
            <Radio size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />GPS
          </button>
          {tab === 'pointages' && (
            <button className="v22-btn" onClick={() => setShowForm(true)}>
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Pontar' : 'Pointer'}
            </button>
          )}
        </div>
      </div>

      {/* ══ TAB GPS ══ */}
      {tab === 'geo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Statut GPS */}
          <div className="v22-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                background: geoStatus === 'in_zone' ? '#DEF7EC' : geoStatus === 'pointed' ? '#E8F5E9' : geoStatus === 'watching' ? '#FEF5E4' : '#F3F4F6',
              }}>
                {geoStatus === 'in_zone' ? <MapPin size={24} /> : geoStatus === 'pointed' ? <CheckCircle size={24} /> : geoStatus === 'watching' ? <Search size={24} /> : <Radio size={24} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {geoStatus === 'idle' && (isPt ? 'GPS desativado' : 'GPS désactivé')}
                  {geoStatus === 'watching' && (isPt ? 'A procurar obras próximas...' : 'Recherche de chantiers proches...')}
                  {geoStatus === 'in_zone' && (isPt ? `Perto de: ${nearestChantier?.titre}` : `Proche de : ${nearestChantier?.titre}`)}
                  {geoStatus === 'pointed' && (isPt ? 'Pontado!' : 'Pointé !')}
                </div>
                <div className="v22-card-meta" style={{ fontSize: 12 }}>
                  {nearestChantier && <><Ruler size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />{nearestChantier.distance}m</>}
                  {geo.position && ` — ${geo.position.lat.toFixed(4)}, ${geo.position.lng.toFixed(4)}`}
                </div>
              </div>
            </div>

            {!settings.geo_pointage_enabled && (
              <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400E', marginBottom: 12 }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt
                  ? 'A pointagem GPS está desativada. Ative nas Configurações BTP.'
                  : 'Le pointage GPS est désactivé. Activez-le dans les Paramètres BTP.'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!geo.watching ? (
                <button className="v22-btn" onClick={() => { geo.start(); setGeoStatus('watching') }}
                  style={{ background: '#22C55E', color: '#fff' }}>
                  <Radio size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Ativar GPS' : 'Activer GPS'}
                </button>
              ) : (
                <button className="v22-btn" onClick={() => { geo.stop(); setGeoStatus('idle') }}
                  style={{ background: '#EF4444', color: '#fff' }}>
                  <Square size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Parar GPS' : 'Arrêter GPS'}
                </button>
              )}
              {geoStatus === 'in_zone' && nearestChantier && (
                <button className="v22-btn" onClick={() => pointGeo(nearestChantier)}
                  style={{ background: 'var(--v22-yellow)', fontWeight: 700 }}>
                  <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? `Pontar em ${nearestChantier.titre}` : `Pointer sur ${nearestChantier.titre}`}
                </button>
              )}
            </div>
          </div>

          {/* Liste des chantiers avec leur GPS */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title"><MapPin size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Obras com GPS' : 'Chantiers avec GPS'}</div>
            </div>
            <div className="v22-card-body">
              {chantiers.filter((c: any) => c.latitude && c.statut === 'En cours').length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <p className="v22-card-meta">
                    {isPt
                      ? 'Nenhuma obra com GPS. Adicione coordenadas GPS ao criar uma obra.'
                      : 'Aucun chantier avec GPS. Ajoutez les coordonnées GPS en créant un chantier.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chantiers.filter((c: any) => c.latitude && c.statut === 'En cours').map((c: any) => {
                    const dist = geo.position ? geo.distanceTo(c.latitude, c.longitude) : null
                    const inZone = dist !== null && dist <= (c.geoRayonM || 100)
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8,
                        background: inZone ? '#DEF7EC' : 'var(--v22-bg)',
                        border: inZone ? '2px solid #22C55E' : '1px solid var(--v22-border)',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.titre}</div>
                          <div className="v22-card-meta" style={{ fontSize: 11 }}>
                            {c.adresse} — {isPt ? 'raio' : 'rayon'}: {c.geoRayonM || 100}m
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {dist !== null ? (
                            <span style={{ fontWeight: 700, fontSize: 14, color: inZone ? '#22C55E' : '#6B7280' }}>
                              {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                            </span>
                          ) : (
                            <span className="v22-card-meta" style={{ fontSize: 11 }}>—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB POINTAGES ══ */}
      {tab === 'pointages' && (
        <>
          {/* Form pointage manuel */}
          {showForm && (
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{isPt ? 'Nova pontagem' : 'Nouveau pointage'}</div>
                <button className="v22-btn v22-btn-sm" onClick={() => setShowForm(false)}><X size={14} /></button>
              </div>
              <div className="v22-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Funcionário *' : 'Employé *'}</label>
                    {membres.length > 0 ? (
                      <select className="v22-form-input" value={form.employe} onChange={e => {
                        const m = membres.find((m: any) => `${m.prenom} ${m.nom}` === e.target.value) as any
                        setForm({ ...form, employe: e.target.value, poste: m?.typeCompte || form.poste })
                      }}>
                        <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                        {membres.map((m: any) => <option key={m.id} value={`${m.prenom} ${m.nom}`}>{m.prenom} {m.nom}</option>)}
                      </select>
                    ) : (
                      <input className="v22-form-input" value={form.employe} onChange={e => setForm({ ...form, employe: e.target.value })}
                        placeholder={isPt ? 'Nome do funcionário' : 'Nom de l\'employé'} />
                    )}
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Função' : 'Poste'}</label>
                    <select className="v22-form-input" value={form.poste} onChange={e => setForm({ ...form, poste: e.target.value })}>
                      <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                      {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Obra' : 'Chantier'}</label>
                    {chantiers.filter((c: any) => c.statut === 'En cours').length > 0 ? (
                      <select className="v22-form-input" value={form.chantier} onChange={e => {
                        const c = chantiers.find((c: any) => c.titre === e.target.value)
                        setForm({ ...form, chantier: e.target.value, chantierId: (c as any)?.id || '' })
                      }}>
                        <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                        {chantiers.filter((c: any) => c.statut === 'En cours').map((c: any) => (
                          <option key={c.id} value={c.titre}>{c.titre}</option>
                        ))}
                      </select>
                    ) : (
                      <input className="v22-form-input" value={form.chantier} onChange={e => setForm({ ...form, chantier: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label className="v22-form-label"><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Date</label>
                    <input type="date" className="v22-form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Chegada' : 'Arrivée'}</label>
                    <input type="time" className="v22-form-input" value={form.heureArrivee} onChange={e => setForm({ ...form, heureArrivee: e.target.value })} />
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Saída' : 'Départ'}</label>
                    <input type="time" className="v22-form-input" value={form.heureDepart} onChange={e => setForm({ ...form, heureDepart: e.target.value })} />
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Pausa (min)' : 'Pause (min)'}</label>
                    <input type="number" className="v22-form-input" value={form.pauseMinutes} onChange={e => setForm({ ...form, pauseMinutes: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="v22-form-label">Notes</label>
                    <input className="v22-form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginTop: 12, background: '#FEF5E4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B8860B' }}>
                  <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Horas' : 'Heures'}: <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="v22-btn" onClick={addPointage} disabled={!form.employe}>
                    <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Registar' : 'Enregistrer'}
                  </button>
                  <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }}
                    onClick={() => setShowForm(false)}>
                    {isPt ? 'Cancelar' : 'Annuler'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table pointages */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
            <div className="v22-card">
              <div className="v22-card-body" style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label className="v22-form-label"><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Date</label>
                    <input type="date" className="v22-form-input" style={{ width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Funcionário' : 'Employé'}</label>
                    <select className="v22-form-input" style={{ width: 160 }} value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}>
                      <option value="">{isPt ? 'Todos' : 'Tous'}</option>
                      {employes.map((e: any) => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <button className="v22-btn v22-btn-sm" onClick={() => setFilterDate('')}
                    style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)' }}>
                    {isPt ? 'Ver tudo' : 'Voir tout'}
                  </button>
                  <span className="v22-card-meta" style={{ paddingBottom: 2 }}>
                    {filtered.length} pointages — <strong>{totalH.toFixed(1)}h</strong>
                  </span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      {[isPt ? 'Funcionário' : 'Employé', isPt ? 'Função' : 'Poste', isPt ? 'Obra' : 'Chantier', 'Date',
                        isPt ? 'Chegada' : 'Arrivée', isPt ? 'Saída' : 'Départ', isPt ? 'Horas' : 'Heures', 'Mode', ''].map(h => (
                        <th key={h || '_x'} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--v22-text-mid)', fontSize: 13 }}>
                        {isPt ? 'Nenhuma pontagem' : 'Aucun pointage'}
                      </td></tr>
                    ) : filtered.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.employe}</td>
                        <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.poste}</td>
                        <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.chantier}</td>
                        <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.date ? new Date(p.date + 'T00:00').toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' }) : ''}</td>
                        <td style={{ padding: '8px 12px' }}>{p.heureArrivee}</td>
                        <td style={{ padding: '8px 12px' }}>{p.heureDepart || '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--v22-yellow)' }}>{p.heuresTravaillees}h</td>
                        <td style={{ padding: '8px 12px' }}>
                          {p.mode === 'geo_confirme' && <span className="v22-tag v22-tag-green" style={{ fontSize: 10 }}><MapPin size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />GPS</span>}
                          {p.mode === 'geo_auto' && <span className="v22-tag v22-tag-blue" style={{ fontSize: 10 }}><Satellite size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />Auto</span>}
                          {p.mode === 'manuel' && <span className="v22-tag v22-tag-gray" style={{ fontSize: 10 }}><Pencil size={10} /></span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 14 }}><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Récap employés */}
            <div className="v22-card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0D1B2E', marginBottom: 12 }}>
                {isPt ? 'Resumo por funcionário' : 'Récap par employé'}
              </div>
              {heuresByEmp.length === 0 ? (
                <p className="v22-card-meta" style={{ fontSize: 12 }}>{isPt ? 'Sem dados' : 'Aucune donnée'}</p>
              ) : heuresByEmp.map(e => (
                <div key={e.employe} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--v22-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{e.employe}</div>
                    <div style={{ fontSize: 11, color: '#8A9BB0' }}>{e.jours} {isPt ? 'dias' : 'jours'}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v22-yellow)' }}>{e.heures.toFixed(1)}h</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
