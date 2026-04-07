'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { Lightbulb } from 'lucide-react'

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
  const imminentRetenue = retenues.find(r => {
    if (r.statut !== 'active' || !r.dateFinTravaux) return false
    const lib = new Date(r.dateFinTravaux)
    lib.setFullYear(lib.getFullYear() + 1)
    const diff = (lib.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 90
  })

  const retBadge: Record<string, string> = {
    active: 'v5-badge v5-badge-blue',
    mainlevée_demandée: 'v5-badge v5-badge-orange',
    libérée: 'v5-badge v5-badge-green',
  }
  const retLabel: Record<string, string> = {
    active: t('proDash.btp.retenues.active') || 'En cours',
    mainlevée_demandée: t('proDash.btp.retenues.mainleveeDemandee') || 'Mainlevée demandée',
    libérée: t('proDash.btp.retenues.liberee') || 'Libérée',
  }

  return (
    <div>
      <div className="v5-pg-t">
        <h1>{t('proDash.btp.retenues.title')}</h1>
        <p>{t('proDash.btp.retenues.subtitle')}</p>
      </div>

      {/* KPI row */}
      <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{t('proDash.btp.retenues.retenuEnAttente')}</div>
          <div className="v5-kpi-v">{totalRetenu.toLocaleString(dateLocale)} &euro;</div>
          <div className="v5-kpi-s">{t('proDash.btp.retenues.chantiersConcernes')}: {retenues.filter(r => r.statut === 'active').length}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.btp.retenues.libere') || 'Libération imminente'}</div>
          <div className="v5-kpi-v">{imminentRetenue ? `${imminentRetenue.montantRetenu.toLocaleString(dateLocale)} \u20AC` : `${totalLibéré.toLocaleString(dateLocale)} \u20AC`}</div>
          <div className="v5-kpi-s">{imminentRetenue ? imminentRetenue.chantier : `${retenues.filter(r => r.statut === 'libérée').length} chantier(s)`}</div>
        </div>
      </div>

      {/* Add button */}
      <div style={{ marginBottom: '.75rem' }}>
        <button className="v5-btn v5-btn-p" onClick={() => setShowForm(true)}>
          + {t('proDash.btp.retenues.nouvelleRetenue')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="v5-card" style={{ marginBottom: '1.25rem' }}>
          <div className="v5-st">{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</div>
          <div className="v5-fr">
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.retenues.chantier')}</label>
              <input className="v5-fi" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.retenues.client')}</label>
              <input className="v5-fi" value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.retenues.montantMarcheHT')}</label>
              <input type="number" className="v5-fi" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.retenues.tauxRetenue')}</label>
              <input type="number" min="1" max="10" className="v5-fi" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.retenues.finTravaux')}</label>
              <input type="date" className="v5-fi" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} />
            </div>
            <div className="v5-fg" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} style={{ width: 16, height: 16, accentColor: 'var(--v5-primary-yellow)' }} />
              <label htmlFor="caution_ret" style={{ fontSize: 12, color: 'var(--v5-text-secondary)' }}>{t('proDash.btp.retenues.cautionBancaire')}</label>
            </div>
          </div>
          {form.montantMarche > 0 && (
            <div className="v5-al info" style={{ marginTop: '.75rem' }}>
              <Lightbulb size={14} /> {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} &euro;</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className="v5-btn v5-btn-p" onClick={addRetenue} disabled={!form.chantier || !form.client}>{t('proDash.btp.retenues.enregistrer')}</button>
            <button className="v5-btn" onClick={() => setShowForm(false)}>{t('proDash.btp.retenues.annuler')}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="v5-card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{t('proDash.btp.retenues.colChantier')}</th>
              <th>{t('proDash.btp.retenues.colClient')}</th>
              <th>{t('proDash.btp.retenues.colMarcheHT')}</th>
              <th>{t('proDash.btp.retenues.colRetenu')}</th>
              <th>{t('proDash.btp.retenues.colFinTravaux')}</th>
              <th>{t('proDash.btp.retenues.colStatut')}</th>
              <th>{t('proDash.btp.retenues.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {retenues.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--v5-text-muted)', fontSize: 12 }}>{t('proDash.btp.retenues.aucuneRetenue')}</td></tr>
            ) : retenues.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.chantier}</td>
                <td>{r.client}</td>
                <td>{r.montantMarche.toLocaleString(dateLocale)} &euro;</td>
                <td style={{ fontWeight: 600 }}>{r.montantRetenu.toLocaleString(dateLocale)} &euro;</td>
                <td>{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '\u2014'}</td>
                <td><span className={retBadge[r.statut] || 'v5-badge'}>{retLabel[r.statut] || r.statut}</span></td>
                <td>
                  {r.statut === 'active' && <button className="v5-btn v5-btn-sm" onClick={() => changeStatut(r.id, 'mainlevée_demandée')}>{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                  {r.statut === 'mainlevée_demandée' && <button className="v5-btn v5-btn-s v5-btn-sm" onClick={() => changeStatut(r.id, 'libérée')}>{t('proDash.btp.retenues.liberer')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
