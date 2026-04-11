'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { FolderOpen, Download } from 'lucide-react'
import { useThemeVars } from '../useThemeVars'
import { useBTPData } from '@/lib/hooks/use-btp-data'

interface Lot { numero: string; designation: string; montantHT: number }
interface AppelOffre { id: string; titre: string; client: string; dateRemise: string; montantEstime: number; statut: 'en_cours' | 'soumis' | 'gagné' | 'perdu'; lots: Lot[] }

export function DPGFSection({ userId, orgRole, country }: { userId: string; orgRole?: string; country?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const { items: appels, loading, add, update } = useBTPData<AppelOffre>({ table: 'dpgf', artisanId: userId, userId })
  const [selected, setSelected] = useState<AppelOffre | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', dateRemise: '', montantEstime: 0 })
  const [newLot, setNewLot] = useState<Lot>({ numero: '', designation: '', montantHT: 0 })

  const createAppel = async () => {
    const created = await add({ ...form, statut: 'en_cours', lots: [] })
    if (created) { setSelected(created); setShowForm(false) }
  }
  const addLot = async () => {
    if (!selected) return
    const newLots = [...selected.lots, { ...newLot }]
    const ok = await update(selected.id, { lots: newLots })
    if (ok) {
      const updated = { ...selected, lots: newLots }
      setSelected(updated)
      setNewLot({ numero: '', designation: '', montantHT: 0 })
    }
  }
  const getTotal = (a: AppelOffre) => a.lots.reduce((s, l) => s + l.montantHT, 0)
  const changeStatut = async (id: string, statut: AppelOffre['statut']) => {
    await update(id, { statut })
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  // Taux TVA dynamique selon le pays (France 20%, Portugal 23% standard)
  const tauxTVA = country === 'PT' ? 0.23 : 0.20
  const tvaTxt = country === 'PT' ? 'IVA' : 'TVA'

  const exportDPGF = (a: AppelOffre) => {
    const rows = a.lots.map(l => `LOT ${l.numero} — ${l.designation.substring(0, 40).padEnd(40)} ${l.montantHT.toLocaleString(dateLocale)} € HT`).join('\n')
    const content = `DPGF — ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString(dateLocale)} €\n${tvaTxt} ${(tauxTVA * 100).toFixed(0)}% : ${(getTotal(a) * tauxTVA).toLocaleString(dateLocale)} €\nTOTAL TTC : ${(getTotal(a) * (1 + tauxTVA)).toLocaleString(dateLocale)} €`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }

  const dpgfBadgeV5: Record<string, string> = {
    en_cours: 'v5-badge v5-badge-orange',
    soumis: 'v5-badge v5-badge-blue',
    gagné: 'v5-badge v5-badge-green',
    perdu: 'v5-badge v5-badge-red',
  }
  const dpgfBadgeV22: Record<string, string> = {
    en_cours: 'v22-tag v22-tag-amber',
    soumis: 'v22-tag v22-tag-green',
    gagné: 'v22-tag v22-tag-yellow',
    perdu: 'v22-tag v22-tag-red',
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
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {isV5 ? <h1>{t('proDash.btp.dpgf.title')}</h1> : <h1 className="v22-page-title">{t('proDash.btp.dpgf.title')}</h1>}
          {isV5 ? <p>{t('proDash.btp.dpgf.subtitle')}</p> : <p className="v22-page-sub">{t('proDash.btp.dpgf.subtitle')}</p>}
        </div>
        <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>
          + {t('proDash.btp.dpgf.nouvelAppel')}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>Chargement...</div>}

      {/* Form */}
      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>Nouvel appel d&apos;offres</div>
          <div className={isV5 ? 'v5-fr' : undefined} style={isV5 ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.dpgf.titre')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.dpgf.clientMaitreOuvrage')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.dpgf.dateRemise')}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.dpgf.montantEstime')}</label>
              <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '.75rem' }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={createAppel} disabled={!form.titre}>{t('proDash.btp.dpgf.creer')}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{t('proDash.btp.dpgf.annuler')}</button>
          </div>
        </div>
      )}

      {/* Top table: Appels d'offres */}
      {!loading && (
      <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflowX: 'auto', padding: 0, marginBottom: '1.25rem' }}>
        <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>Réf</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.dpgf.titre') || 'Intitulé'}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.dpgf.clientMaitreOuvrage') || 'Maître d\'ouvrage'}</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>Deadline</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>Budget estimé</th>
              <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {appels.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: '#999', fontSize: 13 }}><div style={{ marginBottom: 6, opacity: 0.4, fontSize: 28 }}>{'📂'}</div>{t('proDash.btp.dpgf.aucunAppel')}</td></tr>
            ) : appels.map(a => (
              <tr key={a.id} onClick={() => setSelected(a)} style={{ cursor: 'pointer', ...(isV5 ? {} : { borderBottom: `1px solid ${tv.border}` }) }}>
                <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>AO-{a.id.slice(-6)}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{a.titre}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{a.client}</td>
                <td style={isDeadlineWarning(a.dateRemise) ? { color: '#C62828', fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) } : (isV5 ? undefined : { padding: '8px 12px' })}>
                  {a.dateRemise ? new Date(a.dateRemise).toLocaleDateString(dateLocale) : '—'}
                  {isDeadlineWarning(a.dateRemise) && ' ⚠️'}
                </td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}>{a.montantEstime > 0 ? `${a.montantEstime.toLocaleString(dateLocale)} €` : '—'}</td>
                <td style={isV5 ? undefined : { padding: '8px 12px' }}><span className={(isV5 ? dpgfBadgeV5 : dpgfBadgeV22)[a.statut] || (isV5 ? 'v5-badge' : 'v22-tag')}>{dpgfStatLabels[a.statut] || a.statut}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* DPGF detail */}
      {selected ? (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
            <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ margin: 0 }}>DPGF — {selected.titre}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn'} style={isV5 ? undefined : { fontSize: 11, padding: '4px 8px' }} onClick={() => exportDPGF(selected)}><Download size={10} /> {t('proDash.btp.dpgf.export')}</button>
              {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                <button
                  key={s}
                  className={isV5
                    ? `v5-btn v5-btn-sm${selected.statut === s ? ' v5-btn-p' : ''}`
                    : 'v22-btn'
                  }
                  style={isV5 ? undefined : { fontSize: 11, padding: '4px 8px', background: selected.statut === s ? tv.primary : tv.bg, border: `1px solid ${tv.border}`, fontWeight: selected.statut === s ? 700 : 400 }}
                  onClick={() => changeStatut(selected.id, s)}
                >{dpgfStatLabels[s]}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.dpgf.colNumeroLot')}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.dpgf.colDesignation')}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.dpgf.colMontantHT')}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lots.map((l, i) => (
                  <tr key={i} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                    <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{l.numero}</td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>{l.designation}</td>
                    <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{l.montantHT.toLocaleString(dateLocale)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{t('proDash.btp.dpgf.totalHT')}</td>
                  <td style={{ fontWeight: 600, color: isV5 ? 'var(--v5-primary-yellow-dark)' : tv.primary, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{getTotal(selected).toLocaleString(dateLocale)} €</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{t('proDash.btp.dpgf.totalTTC')} ({tvaTxt} {(tauxTVA * 100).toFixed(0)}%)</td>
                  <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>{(getTotal(selected) * (1 + tauxTVA)).toLocaleString(dateLocale)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Add lot form */}
          <div style={{ padding: '1rem 1.25rem', background: isV5 ? 'var(--v5-content-bg)' : tv.bg, borderTop: '1px solid #E8E8E8' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ width: 64 }} placeholder={t('proDash.btp.dpgf.numLotPlaceholder')} value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ flex: 1 }} placeholder={t('proDash.btp.dpgf.designationPlaceholder')} value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
              <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ width: 110 }} placeholder={t('proDash.btp.dpgf.montantPlaceholder')} value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
              <button className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn'} onClick={addLot} disabled={!newLot.designation}>+</button>
            </div>
          </div>
        </div>
      ) : (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 8 }}>
          <FolderOpen size={32} style={{ color: isV5 ? 'var(--v5-text-muted)' : tv.textMid }} />
          <p style={{ fontSize: 12, color: isV5 ? 'var(--v5-text-light)' : tv.textMid }}>{t('proDash.btp.dpgf.selectionnerAppel')}</p>
        </div>
      )}
    </div>
  )
}
