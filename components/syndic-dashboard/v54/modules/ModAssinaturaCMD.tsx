'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { ASSINATURA_CMD_MESSAGES } from './i18n/ModAssinaturaCMD.messages'

/** Assinatura Digital CMD — port byte-exact du ModAssinaturaCMD du bundle V5.7.
 * En français : signature électronique (règlement eIDAS) au lieu de la Chave Móvel Digital. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const

export default function ModAssinaturaCMD() {
  const t = useMessages(ASSINATURA_CMD_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginBottom: 14 }}>{t.noteLegale}</div>
      <KPIGrid items={[
        { num: 5, lbl: t.kpi.total },
        { num: 1, lbl: t.kpi.enAttente, accent: 'amber' },
        { num: 4, lbl: t.kpi.ceMois, accent: 'sage' },
        { icon: 'doc', num: t.kpi.dernierValeur, numStyle: { fontSize: 22 }, lbl: t.kpi.dernier },
      ]} />
      <Tabs defaultActive="ass" tabs={[
        { id: 'ass', icon: 'pencil', label: t.onglets.ass },
        { id: 'docs', icon: 'doc', label: t.onglets.docs },
        { id: 'val', icon: 'search', label: t.onglets.val },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <Panel title={t.panneau}>
        <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 14 }}>{t.consigne}</div>
        <div className={m.cardGrid}>
          <div><label htmlFor="cmd-nome" style={fieldLabel}>{t.nomDocument}</label><input id="cmd-nome" style={fieldCtrl} placeholder={t.nomPlaceholder} /></div>
          <div><label htmlFor="cmd-tipo" style={fieldLabel}>{t.typeDocument}</label><select id="cmd-tipo" style={fieldCtrl}><option>{t.typeProcesVerbal}</option></select></div>
        </div>
        <div style={{ marginTop: 14 }}><label htmlFor="cmd-edificio" style={fieldLabel}>{t.immeuble}</label><select id="cmd-edificio" style={fieldCtrl}><option>{t.choisirImmeuble}</option></select></div>
        <div className={m.dropZone} style={{ marginTop: 14 }}>
          <div className={m.icoLg}><Icon name="file" /></div>
          <h4>{t.depot}</h4>
          <p>{t.formats}</p>
        </div>
      </Panel>
    </>
  )
}
