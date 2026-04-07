'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { FolderOpen, Download } from 'lucide-react'

export function DPGFSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `dpgf_${userId}`
  interface Lot { numero: string; designation: string; montantHT: number }
  interface AppelOffre { id: string; titre: string; client: string; dateRemise: string; montantEstime: number; statut: 'en_cours' | 'soumis' | 'gagné' | 'perdu'; lots: Lot[] }
  const [appels, setAppels] = useState<AppelOffre[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<AppelOffre | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', dateRemise: '', montantEstime: 0 })
  const [newLot, setNewLot] = useState<Lot>({ numero: '', designation: '', montantHT: 0 })

  const save = (data: AppelOffre[]) => { setAppels(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createAppel = () => {
    const a: AppelOffre = { id: Date.now().toString(), ...form, statut: 'en_cours', lots: [] }
    save([...appels, a]); setSelected(a); setShowForm(false)
  }
  const addLot = () => {
    if (!selected) return
    const updated = { ...selected, lots: [...selected.lots, { ...newLot }] }
    save(appels.map(a => a.id === selected.id ? updated : a)); setSelected(updated)
    setNewLot({ numero: '', designation: '', montantHT: 0 })
  }
  const getTotal = (a: AppelOffre) => a.lots.reduce((s, l) => s + l.montantHT, 0)
  const changeStatut = (id: string, statut: AppelOffre['statut']) => {
    const upd = appels.map(a => a.id === id ? { ...a, statut } : a)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const exportDPGF = (a: AppelOffre) => {
    const rows = a.lots.map(l => `LOT ${l.numero} \u2014 ${l.designation.padEnd(40)} ${l.montantHT.toLocaleString(dateLocale)} \u20AC HT`).join('\n')
    const content = `DPGF \u2014 ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString(dateLocale)} \u20AC\nTVA 20% : ${(getTotal(a) * 0.2).toLocaleString(dateLocale)} \u20AC\nTOTAL TTC : ${(getTotal(a) * 1.2).toLocaleString(dateLocale)} \u20AC`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }

  const dpgfBadge: Record<string, string> = {
    en_cours: 'v5-badge v5-badge-orange',
    soumis: 'v5-badge v5-badge-blue',
    gagné: 'v5-badge v5-badge-green',
    perdu: 'v5-badge v5-badge-red',
  }
  const dpgfStatLabels: Record<string, string> = {
    en_cours: t('proDash.btp.dpgf.enCours'),
    soumis: t('proDash.btp.dpgf.soumis'),
    gagné: t('proDash.btp.dpgf.gagne'),
    perdu: t('proDash.btp.dpgf.perdu'),
  }

  // Determine if a deadline is close (within 14 days)
  const isDeadlineWarning = (dateStr: string) => {
    if (!dateStr) return false
    const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 14
  }

  return (
    <div>
      <div className="v5-pg-t">
        <h1>{t('proDash.btp.dpgf.title')}</h1>
        <p>{t('proDash.btp.dpgf.subtitle')}</p>
      </div>

      {/* New appel button */}
      <div style={{ marginBottom: '.75rem' }}>
        <button className="v5-btn v5-btn-p" onClick={() => setShowForm(true)}>
          + {t('proDash.btp.dpgf.nouvelAppel')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="v5-card" style={{ marginBottom: '1.25rem' }}>
          <div className="v5-st">Nouvel appel d&apos;offres</div>
          <div className="v5-fr">
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.dpgf.titre')}</label>
              <input className="v5-fi" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label>
              <input className="v5-fi" value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.dpgf.dateRemise')}</label>
              <input type="date" className="v5-fi" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} />
            </div>
            <div className="v5-fg">
              <label className="v5-fl">{t('proDash.btp.dpgf.montantEstime')}</label>
              <input type="number" className="v5-fi" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className="v5-btn v5-btn-p" onClick={createAppel} disabled={!form.titre}>{t('proDash.btp.dpgf.creer')}</button>
            <button className="v5-btn" onClick={() => setShowForm(false)}>{t('proDash.btp.dpgf.annuler')}</button>
          </div>
        </div>
      )}

      {/* Top table: Appels d'offres */}
      <div className="v5-card" style={{ overflowX: 'auto', padding: 0, marginBottom: '1.25rem' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>R\u00E9f</th>
              <th>{t('proDash.btp.dpgf.titre') || 'Intitul\u00E9'}</th>
              <th>{t('proDash.btp.dpgf.clientMaitreOuvrage') || 'Ma\u00EEtre d\'ouvrage'}</th>
              <th>Deadline</th>
              <th>Budget estim\u00E9</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {appels.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--v5-text-muted)', fontSize: 12 }}>{t('proDash.btp.dpgf.aucunAppel')}</td></tr>
            ) : appels.map(a => (
              <tr key={a.id} onClick={() => setSelected(a)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>AO-{a.id.slice(-6)}</td>
                <td>{a.titre}</td>
                <td>{a.client}</td>
                <td style={isDeadlineWarning(a.dateRemise) ? { color: '#C62828', fontWeight: 600 } : undefined}>
                  {a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : '\u2014'}
                  {isDeadlineWarning(a.dateRemise) && ' \u26A0\uFE0F'}
                </td>
                <td>{a.montantEstime > 0 ? `${a.montantEstime.toLocaleString(dateLocale)} \u20AC` : '\u2014'}</td>
                <td><span className={dpgfBadge[a.statut] || 'v5-badge'}>{dpgfStatLabels[a.statut] || a.statut}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DPGF detail */}
      {selected ? (
        <div className="v5-card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
            <div className="v5-st" style={{ margin: 0 }}>DPGF \u2014 {selected.titre}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="v5-btn v5-btn-sm" onClick={() => exportDPGF(selected)}><Download size={10} /> {t('proDash.btp.dpgf.export')}</button>
              {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                <button
                  key={s}
                  className={`v5-btn v5-btn-sm${selected.statut === s ? ' v5-btn-p' : ''}`}
                  onClick={() => changeStatut(selected.id, s)}
                >{dpgfStatLabels[s]}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="v5-dt">
              <thead>
                <tr>
                  <th>{t('proDash.btp.dpgf.colNumeroLot')}</th>
                  <th>{t('proDash.btp.dpgf.colDesignation')}</th>
                  <th>{t('proDash.btp.dpgf.colMontantHT')}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lots.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{l.numero}</td>
                    <td>{l.designation}</td>
                    <td style={{ fontWeight: 600 }}>{l.montantHT.toLocaleString(dateLocale)} \u20AC</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>{t('proDash.btp.dpgf.totalHT')}</td>
                  <td style={{ fontWeight: 600, color: 'var(--v5-primary-yellow-dark)' }}>{getTotal(selected).toLocaleString(dateLocale)} \u20AC</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>{t('proDash.btp.dpgf.totalTTC')}</td>
                  <td style={{ fontWeight: 600 }}>{(getTotal(selected) * 1.2).toLocaleString(dateLocale)} \u20AC</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Add lot form */}
          <div style={{ padding: '1rem 1.25rem', background: 'var(--v5-content-bg)', borderTop: '1px solid #E8E8E8' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="v5-fi" style={{ width: 64 }} placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
              <input className="v5-fi" style={{ flex: 1 }} placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
              <input type="number" className="v5-fi" style={{ width: 110 }} placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
              <button className="v5-btn v5-btn-p v5-btn-sm" onClick={addLot} disabled={!newLot.designation}>+</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="v5-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 8 }}>
          <FolderOpen size={32} style={{ color: 'var(--v5-text-muted)' }} />
          <p style={{ fontSize: 12, color: 'var(--v5-text-light)' }}>{t('proDash.btp.dpgf.selectionnerAppel')}</p>
        </div>
      )}
    </div>
  )
}
