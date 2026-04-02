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
    const rows = a.lots.map(l => `LOT ${l.numero} — ${l.designation.padEnd(40)} ${l.montantHT.toLocaleString(dateLocale)} € HT`).join('\n')
    const content = `DPGF — ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString(dateLocale)} €\nTVA 20% : ${(getTotal(a) * 0.2).toLocaleString(dateLocale)} €\nTOTAL TTC : ${(getTotal(a) * 1.2).toLocaleString(dateLocale)} €`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }
  const dpgfStatV22: Record<string, string> = {
    en_cours: 'v22-tag v22-tag-blue',
    soumis: 'v22-tag v22-tag-amber',
    gagné: 'v22-tag v22-tag-green',
    perdu: 'v22-tag v22-tag-red',
  }
  const dpgfStatLabels: Record<string, string> = {
    en_cours: t('proDash.btp.dpgf.enCours'),
    soumis: t('proDash.btp.dpgf.soumis'),
    gagné: t('proDash.btp.dpgf.gagne'),
    perdu: t('proDash.btp.dpgf.perdu'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title"><FolderOpen size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.dpgf.title')}</h2>
          <p className="v22-page-sub">{t('proDash.btp.dpgf.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.dpgf.nouvelAppel')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
          <div key={s} className="v22-card" style={{ padding: 16 }}>
            <div className="v22-card-meta">{dpgfStatLabels[s]}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0D1B2E', marginTop: 4 }}>{appels.filter(a => a.statut === s).length}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head"><div className="v22-card-title">Nouvel appel d&apos;offres</div></div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.titre')}</label><input className="v22-form-input" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.dateRemise')}</label><input type="date" className="v22-form-input" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.dpgf.montantEstime')}</label><input type="number" className="v22-form-input" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="v22-btn" onClick={createAppel} disabled={!form.titre}>{t('proDash.btp.dpgf.creer')}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.dpgf.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Liste des appels d'offres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appels.length === 0 ? (
            <div className="v22-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}><FolderOpen size={32} style={{ color: 'var(--v22-text-mid)' }} /></div>
              <p className="v22-card-meta">{t('proDash.btp.dpgf.aucunAppel')}</p>
            </div>
          ) : appels.map(a => (
            <div
              key={a.id}
              onClick={() => setSelected(a)}
              className="v22-card"
              style={{ padding: 14, cursor: 'pointer', border: selected?.id === a.id ? '2px solid var(--v22-yellow)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0D1B2E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titre}</span>
                <span className={dpgfStatV22[a.statut] || 'v22-tag'} style={{ flexShrink: 0 }}>{a.statut}</span>
              </div>
              <div className="v22-card-meta" style={{ fontSize: 11 }}>{a.client}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v22-yellow)', marginTop: 4 }}>{getTotal(a).toLocaleString(dateLocale)} € {t('proDash.common.ht')}</div>
            </div>
          ))}
        </div>

        {/* Détail DPGF */}
        {selected ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{selected.titre}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="v22-btn v22-btn-sm" onClick={() => exportDPGF(selected)}><Download size={14} /> {t('proDash.btp.dpgf.export')}</button>
                {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                  <button
                    key={s}
                    className="v22-btn v22-btn-sm"
                    style={selected.statut === s ? { background: 'var(--v22-yellow)', color: '#0D1B2E' } : { background: 'var(--v22-bg)', color: 'var(--v22-text-mid)', border: '1px solid var(--v22-border)' }}
                    onClick={() => changeStatut(selected.id, s)}
                  >{dpgfStatLabels[s]}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                    {[t('proDash.btp.dpgf.colNumeroLot'), t('proDash.btp.dpgf.colDesignation'), t('proDash.btp.dpgf.colMontantHT')].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.lots.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0D1B2E' }}>{l.numero}</td>
                      <td style={{ padding: '8px 14px', color: '#4A5E78' }}>{l.designation}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--v22-yellow)' }}>{l.montantHT.toLocaleString(dateLocale)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', color: '#4A5E78' }}>{t('proDash.btp.dpgf.totalHT')}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--v22-yellow)' }}>{getTotal(selected).toLocaleString(dateLocale)} €</td>
                  </tr>
                  <tr style={{ background: 'var(--v22-bg)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 14px', textAlign: 'right', color: '#4A5E78' }}>{t('proDash.btp.dpgf.totalTTC')}</td>
                    <td style={{ padding: '8px 14px', color: '#0D1B2E' }}>{(getTotal(selected) * 1.2).toLocaleString(dateLocale)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="v22-card-body" style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="v22-form-input" style={{ width: 64, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
                <input className="v22-form-input" style={{ flex: 1, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
                <input type="number" className="v22-form-input" style={{ width: 110, fontSize: 12 }} placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
                <button className="v22-btn v22-btn-sm" onClick={addLot} disabled={!newLot.designation}>+</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="v22-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flexDirection: 'column', gap: 8 }}>
            <FolderOpen size={40} style={{ color: 'var(--v22-text-mid)' }} />
            <p className="v22-card-meta">{t('proDash.btp.dpgf.selectionnerAppel')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
