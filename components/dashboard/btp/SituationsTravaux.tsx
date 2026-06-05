'use client'

import { useState, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { BarChart3 } from 'lucide-react'
import { useThemeVars } from '../useThemeVars'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { ChantierSelect } from './ChantierSelect'

interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
interface Situation {
  id: string; chantier: string; chantier_id?: string; client: string; numero: number; date: string
  montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
}

export function SituationsTravaux({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const isPt = locale === 'pt'
  const dateLocale = isPt ? 'pt-PT' : 'fr-FR'

  const { items: situations, loading, add, update } = useBTPData<Situation>({ table: 'situations', artisanId: userId, userId })
  const [selected, setSelected] = useState<Situation | null>(null)
  // Synchroniser selected avec les items frais apres chaque refresh
  useEffect(() => {
    if (selected) {
      const fresh = situations.find(s => s.id === selected.id)
      if (fresh) setSelected(fresh)
      else setSelected(null) // supprimé entre-temps
    }
  }, [situations]) // eslint-disable-line react-hooks/exhaustive-deps
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier_id: '', chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const createSit = async () => {
    const existing = situations.filter(s => s.chantier === form.chantier)
    const numero = existing.length > 0 ? Math.max(...existing.map(s => s.numero)) + 1 : 1
    const created = await add({ ...form, chantier_id: form.chantier_id || undefined, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' })
    if (created) { setSelected(created); setShowForm(false) }
  }
  const addPoste = async () => {
    if (!selected) return
    const newTravaux = [...selected.travaux, { ...newPoste }]
    const ok = await update(selected.id, { travaux: newTravaux })
    if (ok) {
      const updated = { ...selected, travaux: newTravaux }
      setSelected(updated)
      setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
    }
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, tr) => sum + tr.quantite * tr.prixUnit * (tr.avancement / 100), 0)
  const changeStatut = async (id: string, statut: Situation['statut']) => {
    await update(id, { statut })
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }

  const sitBadgeV5: Record<string, string> = {
    brouillon: 'v5-badge v5-badge-gray',
    envoyée: 'v5-badge v5-badge-blue',
    validée: 'v5-badge v5-badge-orange',
    payée: 'v5-badge v5-badge-green',
  }
  const sitBadgeV22: Record<string, string> = {
    brouillon: 'v22-tag v22-tag-gray',
    envoyée: 'v22-tag v22-tag-green',
    validée: 'v22-tag v22-tag-amber',
    payée: 'v22-tag v22-tag-yellow',
  }

  return (
    <div>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {isV5 ? <h1>{t('proDash.btp.situations.title')}</h1> : <h1 className="v22-page-title">{t('proDash.btp.situations.title')}</h1>}
          {isV5 ? <p>{t('proDash.btp.situations.subtitle')}</p> : <p className="v22-page-sub">{t('proDash.btp.situations.subtitle')}</p>}
        </div>
        <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>
          + {t('proDash.btp.situations.nouvelleSituation')}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>{isPt ? 'A carregar...' : 'Chargement...'}</div>}

      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '.75rem' }}>
          <div className={isV5 ? 'v5-fr' : undefined} style={{ marginBottom: '.75rem', ...(isV5 ? {} : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }) }}>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.situations.chantier')}</label>
              <ChantierSelect
                userId={userId}
                orgRole={orgRole}
                value={form.chantier_id}
                onChange={(id, titre, client) => setForm({ ...form, chantier_id: id, chantier: titre, client })}
              />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.situations.client')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
          </div>
          <div className={isV5 ? 'v5-fg' : undefined}>
            <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.situations.montantMarche')}</label>
            <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ maxWidth: 200 }} value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={createSit} disabled={!form.chantier || !form.client}>{t('proDash.btp.situations.creer')}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}

      <div className={isV5 ? 'v5-sg2' : undefined} style={isV5 ? undefined : { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Left column: list of situations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {situations.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>{'📋'}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{t('proDash.btp.situations.aucuneSituation')}</div>
              <p style={{ color: '#999', fontSize: 12 }}>{isPt ? 'Crie a sua primeira situação de obra' : 'Créez votre première situation de travaux'}</p>
            </div>
          ) : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
              <div key={s.id} onClick={() => setSelected(s)} className={isV5 ? 'v5-card' : 'v22-card'}
                style={{ cursor: 'pointer', border: selected?.id === s.id ? (isV5 ? '2px solid var(--v5-primary-yellow)' : `2px solid ${tv.primary}`) : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{t('proDash.btp.situations.situation')} n&deg;{s.numero}</span>
                  <span className={(isV5 ? sitBadgeV5 : sitBadgeV22)[s.statut]}>{sitStatLabels[s.statut] || s.statut}</span>
                </div>
                <div style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-secondary)' : tv.textMid }}>{s.chantier}</div>
                <div style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-light)' : '#8A9BB0' }}>{s.client}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: isV5 ? 'var(--v5-primary-yellow-dark)' : tv.primary, marginTop: 4 }}>{getTotal(s).toLocaleString(dateLocale)} &euro;</div>
              </div>
            )
          })}
        </div>

        {/* Right column: detail */}
        <div>
          {selected ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ margin: 0 }}>{t('proDash.btp.situations.situation')} n&deg;{selected.numero} &mdash; {selected.chantier}</div>
                <div className={isV5 ? 'v5-tabs' : undefined} style={{ marginBottom: 0, borderBottom: 'none', ...(isV5 ? {} : { display: 'flex', gap: 4 }) }}>
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)}
                      className={isV5
                        ? `v5-tab-b${selected.statut === s ? ' active' : ''}`
                        : `v22-btn${selected.statut === s ? '' : ''}`
                      }
                      style={isV5 ? undefined : { fontSize: 11, padding: '4px 8px', background: selected.statut === s ? tv.primary : tv.bg, border: `1px solid ${tv.border}`, fontWeight: selected.statut === s ? 700 : 400 }}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colPoste')}</th>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colQte')}</th>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colUnite')}</th>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colPU')}</th>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colAvt')}</th>
                      <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.situations.colMontant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.travaux.map((tr, i) => (
                      <tr key={i} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tr.poste}</td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tr.quantite}</td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tr.unite}</td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tr.prixUnit.toLocaleString(dateLocale)}</td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tr.avancement}%</td>
                        <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)} &euro;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{t('proDash.btp.situations.total')}</td>
                      <td style={{ fontWeight: 600, color: isV5 ? 'var(--v5-primary-yellow-dark)' : tv.primary, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{getTotal(selected).toLocaleString(dateLocale)} &euro;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Add poste form */}
              <div style={{ padding: '1rem 1.25rem', background: isV5 ? 'var(--v5-content-bg)' : tv.bg, borderTop: '1px solid #E8E8E8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 8 }}>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className={isV5 ? 'v5-filter-sel' : 'v22-form-input'} value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>
                    {['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                  <button className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn'} onClick={addPoste} disabled={!newPoste.poste}>{t('proDash.btp.situations.ajouter')}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: isV5 ? 'var(--v5-text-light)' : tv.textMid }}>{t('proDash.btp.situations.avancement')}</span>
                  <input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} style={{ flex: 1, accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary }} />
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 32 }}>{newPoste.avancement}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 8 }}>
              <BarChart3 size={32} style={{ color: isV5 ? 'var(--v5-text-muted)' : tv.textMid }} />
              <p style={{ fontSize: 12, color: isV5 ? 'var(--v5-text-light)' : tv.textMid }}>{t('proDash.btp.situations.selectionnerSituation')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
