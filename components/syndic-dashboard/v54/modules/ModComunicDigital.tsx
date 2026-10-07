'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { COMUNIC_DIGITAL_MESSAGES, type TeinteStatut, type TypeEnvoi } from './i18n/ModComunicDigital.messages'

/** Comunicação Digital — port byte-exact du ModComunicDigital du bundle V5.7 (table). */

const ctrl = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 13 } as const

const tipoKind = (t: TypeEnvoi): PillKind =>
  t === 'urgence' ? 'rust' : t === 'relance' ? 'amber' : t === 'convocation' ? 'gold' : 'sage'
const statusKind = (s: TeinteStatut): PillKind | undefined =>
  s === 'sage' ? 'sage' : s === 'amber' ? 'amber' : s === 'navy' ? 'dark' : undefined

export default function ModComunicDigital() {
  const t = useMessages(COMUNIC_DIGITAL_MESSAGES)
  const c = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="msg" tabs={[
        { id: 'msg', icon: 'mail', label: t.onglets.msg },
        { id: 'mod', icon: 'clipboard', label: t.onglets.mod },
        { id: 'gp', icon: 'mail', label: t.onglets.gp },
        { id: 'def', icon: 'cog', label: t.onglets.def },
      ]} />
      <KPIGrid items={[
        { icon: 'chart', num: 6, lbl: t.kpi.total },
        { icon: 'mail', num: 1, lbl: t.kpi.attente, accent: 'amber' },
        { icon: 'check', num: 2, lbl: t.kpi.distribues, accent: 'gold' },
        { icon: 'check', num: 3, lbl: t.kpi.lus, accent: 'sage' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <select aria-label={t.filtres.typeAria} style={ctrl}><option>{t.filtres.tousLesTypes}</option></select>
        <input aria-label={t.filtres.rechercheAria} style={{ ...ctrl, textAlign: 'left' }} placeholder={t.filtres.recherchePlaceholder} />
        <input aria-label={t.filtres.debut} style={ctrl} type="date" />
        <input aria-label={t.filtres.fin} style={ctrl} type="date" />
      </div>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.destinataire}</th><th>{c.lot}</th><th>{c.type}</th><th>{c.objet}</th><th>{c.canal}</th><th>{c.date}</th><th>{c.statut}</th></tr></thead>
            <tbody>
              {t.demo.map((msg) => (
                <tr key={msg.nom}>
                  <td><b>{msg.nom}</b></td>
                  <td className={m.numCell}>{msg.lot}</td>
                  <td><Pill kind={tipoKind(msg.type)} noDot>{t.types[msg.type]}</Pill></td>
                  <td>{msg.objet}</td>
                  <td>{msg.canal}</td>
                  <td className={m.numCell}>{msg.date}</td>
                  <td><Pill kind={statusKind(msg.teinte)} noDot>● {msg.statut}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
