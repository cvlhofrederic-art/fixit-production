'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PROC_LOTE_MESSAGES } from './i18n/ModProcLote.messages'

/** Processamentos em Lote — port byte-exact du ModProcLote du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldSelect = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const

export default function ModProcLote() {
  const t = useMessages(PROC_LOTE_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'cog', num: 0, lbl: t.kpi.executions },
        { icon: 'check', num: 0, lbl: t.kpi.terminees, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: t.kpi.erreurs, accent: 'rust' },
        { icon: 'clock', num: 0, lbl: t.kpi.planifications, accent: 'amber' },
      ]} />
      <Tabs defaultActive="exec" tabs={[
        { id: 'exec', label: t.onglets.exec },
        { id: 'hist', icon: 'folder', label: t.onglets.hist },
        { id: 'ag', icon: 'clock', label: t.onglets.ag },
        { id: 'rel', icon: 'chart', label: t.onglets.rel },
      ]} />
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="pl-edificio" style={fieldLabel}>{t.immeubleCible}</label>
        <select id="pl-edificio" style={fieldSelect}><option>{t.tousLesImmeubles}</option></select>
      </div>
      <div className={m.cardGrid3}>
        {t.actions.map((c) => (
          <div key={c[1]} className={m.card} style={{ padding: 22, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', marginBottom: 12 }}><Icon name={c[0]} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, marginBottom: 6, fontWeight: 500 }}>{c[1]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{c[2]}</div>
          </div>
        ))}
      </div>
    </>
  )
}
