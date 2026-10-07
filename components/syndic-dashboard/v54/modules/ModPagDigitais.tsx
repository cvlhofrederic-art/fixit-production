'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PAG_DIGITAIS_MESSAGES } from './i18n/ModPagDigitais.messages'

/** Pagamentos Digitais — port byte-exact du ModPagDigitais du bundle V5.7. */

export default function ModPagDigitais() {
  const t = useMessages(PAG_DIGITAIS_MESSAGES)
  const c = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: t.onglets.dash },
        { id: 'mb', icon: 'coin', label: t.onglets.mb },
        { id: 'rec', icon: 'refresh', label: t.onglets.rec },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '0,00 €', lbl: t.kpi.encaisse, accent: 'gold' },
        { icon: 'clock', num: '4', lbl: t.kpi.enAttente, sub: '765,75 €', accent: 'amber' },
        { icon: 'chart', num: t.kpi.tauxValeur, lbl: t.kpi.taux, accent: 'sage' },
        { icon: 'calendar', num: '98', lbl: t.kpi.retard },
      ]} />
      <Panel title={t.repartition.titre}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>{t.repartition.encaisse}</span><b>0,00 €</b></div>
        <Progress pct={0} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, marginTop: 14 }}><span>{t.repartition.enAttente}</span><b>765,75 €</b></div>
        <Progress pct={100} kind="amber" />
      </Panel>
      <Panel title={t.derniers} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.coproprietaire}</th><th>{c.lot}</th><th>{c.montant}</th><th>{c.mode}</th><th>{c.date}</th></tr></thead>
            <tbody>
              {t.demo.map((r) => (
                <tr key={r[0]}>
                  <td><b>{r[0]}</b></td>
                  <td>{r[1]}</td>
                  <td className={m.numCell} style={{ color: 'var(--v54-gold-700)', fontWeight: 600 }}>{r[2]}</td>
                  <td><Pill noDot>{r[3]}</Pill></td>
                  <td className={m.numCell}>{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
