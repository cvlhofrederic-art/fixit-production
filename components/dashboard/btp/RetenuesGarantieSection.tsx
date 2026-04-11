'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { Lightbulb } from 'lucide-react'
import { useThemeVars } from '../useThemeVars'
import { useBTPData } from '@/lib/hooks/use-btp-data'

interface Retenue {
  id: string; chantier: string; client: string; montantMarche: number; tauxRetenue: number
  montantRetenu: number; dateFinTravaux: string; dateLiberation?: string
  statut: 'active' | 'mainlevée_demandée' | 'libérée'; caution: boolean
}

export function RetenuesGarantieSection({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const { items: retenues, loading, add, update } = useBTPData<Retenue>({ table: 'retenues', artisanId: userId, userId })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })

  const addRetenue = async () => {
    await add({ ...form, montantRetenu: form.montantMarche * form.tauxRetenue / 100, statut: 'active' })
    setShowForm(false); setForm({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })
  }
  const changeStatut = async (id: string, statut: Retenue['statut']) => {
    await update(id, { statut, dateLiberation: statut === 'libérée' ? new Date().toISOString().split('T')[0] : undefined })
  }

  const totalRetenu = retenues.filter(r => r.statut === 'active').reduce((s, r) => s + r.montantRetenu, 0)
  const totalLib\u00E9r\u00E9 = retenues.filter(r => r.statut === 'libérée').reduce((s, r) => s + r.montantRetenu, 0)
  const imminentRetenue = retenues.find(r => {
    if (r.statut !== 'active' || !r.dateFinTravaux) return false
    const lib = new Date(r.dateFinTravaux)
    lib.setFullYear(lib.getFullYear() + 1)
    const diff = (lib.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 90
  })

  const retBadgeV5: Record<string, string> = {
    active: 'v5-badge v5-badge-blue',
    mainlevée_demandée: 'v5-badge v5-badge-orange',
    libérée: 'v5-badge v5-badge-green',
  }
  const retBadgeV22: Record<string, string> = {
    active: 'v22-tag v22-tag-green',
    mainlevée_demandée: 'v22-tag v22-tag-amber',
    libérée: 'v22-tag v22-tag-gray',
  }
  const retLabel: Record<string, string> = {
    active: t('proDash.btp.retenues.active') || 'En cours',
    mainlevée_demandée: t('proDash.btp.retenues.mainleveeDemandee') || 'Mainlevée demandée',
    libérée: t('proDash.btp.retenues.liberee') || 'Libérée',
  }

  return (
    <div>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          {isV5 ? <h1>{t('proDash.btp.retenues.title')}</h1> : <h1 className="v22-page-title">{t('proDash.btp.retenues.title')}</h1>}
          {isV5 ? <p>{t('proDash.btp.retenues.subtitle')}</p> : <p className="v22-page-sub">{t('proDash.btp.retenues.subtitle')}</p>}
        </div>
        <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>
          {t('proDash.btp.retenues.nouvelleRetenue')}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>Chargement...</div>}

      {/* KPI row */}
      {isV5 ? (
        <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="v5-kpi hl">
            <div className="v5-kpi-l">{t('proDash.btp.retenues.retenuEnAttente')}</div>
            <div className="v5-kpi-v">{totalRetenu.toLocaleString(dateLocale)} &euro;</div>
            <div className="v5-kpi-s">{t('proDash.btp.retenues.chantiersConcernes')}: {retenues.filter(r => r.statut === 'active').length}</div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-l">{t('proDash.btp.retenues.libere') || 'Libération imminente'}</div>
            <div className="v5-kpi-v">{imminentRetenue ? `${imminentRetenue.montantRetenu.toLocaleString(dateLocale)} \u20AC` : `${totalLib\u00E9r\u00E9.toLocaleString(dateLocale)} \u20AC`}</div>
            <div className="v5-kpi-s">{imminentRetenue ? imminentRetenue.chantier : `${retenues.filter(r => r.statut === 'libérée').length} chantier(s)`}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <div className="v22-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{t('proDash.btp.retenues.retenuEnAttente')}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{totalRetenu.toLocaleString(dateLocale)} &euro;</div>
            <div style={{ fontSize: 11, color: tv.textMid }}>{t('proDash.btp.retenues.chantiersConcernes')}: {retenues.filter(r => r.statut === 'active').length}</div>
          </div>
          <div className="v22-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{t('proDash.btp.retenues.libere') || 'Libération imminente'}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{imminentRetenue ? `${imminentRetenue.montantRetenu.toLocaleString(dateLocale)} \u20AC` : `${totalLib\u00E9r\u00E9.toLocaleString(dateLocale)} \u20AC`}</div>
            <div style={{ fontSize: 11, color: tv.textMid }}>{imminentRetenue ? imminentRetenue.chantier : `${retenues.filter(r => r.statut === 'libérée').length} chantier(s)`}</div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</div>
          <div className={isV5 ? 'v5-fr' : undefined} style={isV5 ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.retenues.chantier')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.retenues.client')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.retenues.montantMarcheHT')}</label>
              <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.retenues.tauxRetenue')}</label>
              <input type="number" min="1" max="10" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.retenues.finTravaux')}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} style={{ width: 16, height: 16, accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary }} />
              <label htmlFor="caution_ret" style={{ fontSize: 12, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid }}>{t('proDash.btp.retenues.cautionBancaire')}</label>
            </div>
          </div>
          {form.montantMarche > 0 && (
            <div className={isV5 ? 'v5-al info' : undefined} style={{ marginTop: '.75rem', ...(isV5 ? {} : { background: '#E8F4FD', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1565C0' }) }}>
              <Lightbulb size={14} /> {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} &euro;</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={addRetenue} disabled={!form.chantier || !form.client}>{t('proDash.btp.retenues.enregistrer')}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{t('proDash.btp.retenues.annuler')}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflowX: 'auto', padding: 0 }}>
        <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colChantier')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colClient')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colMarcheHT')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colRetenu')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colFinTravaux')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colStatut')}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.retenues.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {retenues.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#999', fontSize: 13 }}><div style={{ marginBottom: 6, opacity: 0.4, fontSize: 28 }}>{'🔒'}</div>{t('proDash.btp.retenues.aucuneRetenue')}</td></tr>
            ) : retenues.map(r => (
              <tr key={r.id} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{r.chantier}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{r.client}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{r.montantMarche.toLocaleString(dateLocale)} &euro;</td>
                <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{r.montantRetenu.toLocaleString(dateLocale)} &euro;</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '\u2014'}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}><span className={(isV5 ? retBadgeV5 : retBadgeV22)[r.statut] || (isV5 ? 'v5-badge' : 'v22-tag')}>{retLabel[r.statut] || r.statut}</span></td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                  {r.statut === 'active' && <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn'} style={isV5 ? undefined : { fontSize: 11, padding: '4px 8px' }} onClick={() => changeStatut(r.id, 'mainlevée_demandée')}>{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                  {r.statut === 'mainlevée_demandée' && <button className={isV5 ? 'v5-btn v5-btn-s v5-btn-sm' : 'v22-btn'} style={isV5 ? undefined : { fontSize: 11, padding: '4px 8px' }} onClick={() => changeStatut(r.id, 'libérée')}>{t('proDash.btp.retenues.liberer')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
