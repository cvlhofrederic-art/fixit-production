'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { BarChart3 } from 'lucide-react'

export function SituationsTravaux({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `situations_${userId}`
  interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
  interface Situation {
    id: string; chantier: string; client: string; numero: number; date: string
    montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
  }
  const [situations, setSituations] = useState<Situation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Situation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const save = (data: Situation[]) => { setSituations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createSit = () => {
    const numero = situations.filter(s => s.chantier === form.chantier).length + 1
    const s: Situation = { id: Date.now().toString(), ...form, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' }
    save([...situations, s]); setSelected(s); setShowForm(false)
  }
  const addPoste = () => {
    if (!selected) return
    const updated = { ...selected, travaux: [...selected.travaux, { ...newPoste }] }
    save(situations.map(s => s.id === selected.id ? updated : s)); setSelected(updated)
    setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, t) => sum + t.quantite * t.prixUnit * (t.avancement / 100), 0)
  const changeStatut = (id: string, statut: Situation['statut']) => {
    const upd = situations.map(s => s.id === id ? { ...s, statut } : s)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }

  const sitBadge: Record<string, string> = {
    brouillon: 'v5-badge v5-badge-gray',
    envoyée: 'v5-badge v5-badge-blue',
    validée: 'v5-badge v5-badge-orange',
    payée: 'v5-badge v5-badge-green',
  }

  return (
    <div>
      <div className="v5-pg-t">
        <h1>{t('proDash.btp.situations.title')}</h1>
        <p>{t('proDash.btp.situations.subtitle')}</p>
      </div>

      <div style={{ marginBottom: '.75rem' }}>
        <button className="v5-btn v5-btn-p" onClick={() => setShowForm(true)}>
          + {t('proDash.btp.situations.nouvelleSituation')}
        </button>
      </div>

      {showForm && (
        <div className="v5-card" style={{ marginBottom: '.75rem' }}>
          <div className="v5-fr" style={{ marginBottom: '.75rem' }}>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.situations.chantier')}</label>
              <input className="v5-fi" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.situations.client')}</label>
              <input className="v5-fi" value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
          </div>
          <div className="v5-fg">
            <label className="v5-fl">{t('proDash.btp.situations.montantMarche')}</label>
            <input type="number" className="v5-fi" style={{ maxWidth: 200 }} value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className="v5-btn v5-btn-p" onClick={createSit} disabled={!form.chantier || !form.client}>{t('proDash.btp.situations.creer')}</button>
            <button className="v5-btn" onClick={() => setShowForm(false)}>{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}

      <div className="v5-sg2">
        {/* Left column: list of situations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {situations.length === 0 ? (
            <div className="v5-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <p style={{ color: 'var(--v5-text-muted)', fontSize: 12 }}>{t('proDash.btp.situations.aucuneSituation')}</p>
            </div>
          ) : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
              <div key={s.id} onClick={() => setSelected(s)} className="v5-card"
                style={{ cursor: 'pointer', border: selected?.id === s.id ? '2px solid var(--v5-primary-yellow)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{t('proDash.btp.situations.situation')} n&deg;{s.numero}</span>
                  <span className={sitBadge[s.statut]}>{sitStatLabels[s.statut] || s.statut}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--v5-text-secondary)' }}>{s.chantier}</div>
                <div style={{ fontSize: 11, color: 'var(--v5-text-light)' }}>{s.client}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v5-primary-yellow-dark)', marginTop: 4 }}>{getTotal(s).toLocaleString(dateLocale)} &euro;</div>
              </div>
            )
          })}
        </div>

        {/* Right column: detail */}
        <div>
          {selected ? (
            <div className="v5-card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
                <div className="v5-st" style={{ margin: 0 }}>{t('proDash.btp.situations.situation')} n&deg;{selected.numero} &mdash; {selected.chantier}</div>
                <div className="v5-tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)}
                      className={`v5-tab-b${selected.statut === s ? ' active' : ''}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="v5-dt">
                  <thead>
                    <tr>
                      <th>{t('proDash.btp.situations.colPoste')}</th>
                      <th>{t('proDash.btp.situations.colQte')}</th>
                      <th>{t('proDash.btp.situations.colUnite')}</th>
                      <th>{t('proDash.btp.situations.colPU')}</th>
                      <th>{t('proDash.btp.situations.colAvt')}</th>
                      <th>{t('proDash.btp.situations.colMontant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.travaux.map((tr, i) => (
                      <tr key={i}>
                        <td>{tr.poste}</td>
                        <td>{tr.quantite}</td>
                        <td>{tr.unite}</td>
                        <td>{tr.prixUnit.toLocaleString(dateLocale)}</td>
                        <td>{tr.avancement}%</td>
                        <td style={{ fontWeight: 600 }}>{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)} &euro;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>{t('proDash.btp.situations.total')}</td>
                      <td style={{ fontWeight: 600, color: 'var(--v5-primary-yellow-dark)' }}>{getTotal(selected).toLocaleString(dateLocale)} &euro;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Add poste form */}
              <div style={{ padding: '1rem 1.25rem', background: 'var(--v5-content-bg)', borderTop: '1px solid #E8E8E8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 8 }}>
                  <input className="v5-fi" placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="v5-fi" placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="v5-filter-sel" value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>
                    {['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" className="v5-fi" placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                  <button className="v5-btn v5-btn-p v5-btn-sm" onClick={addPoste} disabled={!newPoste.poste}>{t('proDash.btp.situations.ajouter')}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--v5-text-light)' }}>{t('proDash.btp.situations.avancement')}</span>
                  <input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} style={{ flex: 1, accentColor: 'var(--v5-primary-yellow)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 32 }}>{newPoste.avancement}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="v5-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 8 }}>
              <BarChart3 size={32} style={{ color: 'var(--v5-text-muted)' }} />
              <p style={{ fontSize: 12, color: 'var(--v5-text-light)' }}>{t('proDash.btp.situations.selectionnerSituation')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
