'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { COMPARADOR_ENERGIA_MESSAGES } from './i18n/ModComparadorEnergia.messages'

/** Comparador de Tarifas de Energia Coletiva — port byte-exact du ModComparadorEnergia du bundle V5.7. */

const classColor = (cls: string): string =>
  cls === 'B' || cls === 'B-' ? 'var(--v54-sage-500)' : cls === 'C' ? 'var(--v54-amber-500)' : 'var(--v54-rust-500)'

export default function ModComparadorEnergia() {
  const t = useMessages(COMPARADOR_ENERGIA_MESSAGES)
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Pill kind="gold" noDot>{t.marche}</Pill>}
      />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: t.kpi.immeubles },
        { icon: 'coin', num: '275,26 €', lbl: t.kpi.coutMensuel, accent: 'gold' },
        { icon: 'chart', num: '726,31 €', lbl: t.kpi.economie, accent: 'sage' },
        { icon: 'bolt', num: 'C', lbl: t.kpi.classeMoyenne },
      ]} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: t.onglets.dash },
        { id: 'cmp', icon: 'scale', label: t.onglets.cmp },
        { id: 'sim', label: t.onglets.sim },
        { id: 'hist', icon: 'stamp', label: t.onglets.hist },
      ]} />
      <Panel title={t.profil}>
        <div className={m.cardGrid3}>
          {t.immeubles.map((b) => (
            <div key={b[0]} className={m.card} style={{ padding: 22, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 8, background: classColor(b[1]), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>{b[1]}</div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{b[0]}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}><Pill kind="sage" noDot>{b[2]}</Pill><Pill noDot>{b[3]}</Pill></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{t.consommation}</div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600 }}>{t.nombre(b[4])} <span style={{ fontSize: 14 }}>{t.kwh}</span></div></div>
                <div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{t.coutMoyen}</div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--v54-gold-700)' }}>{t.nombre(b[5])} €</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5, marginBottom: 14 }}>
                <div><div style={{ color: 'var(--v54-navy-300)' }}>{t.fournisseur}</div><b>{b[6]}</b></div>
                <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--v54-navy-300)' }}>{t.puissance}</div><b>{b[7]}</b></div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--v54-sage-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--v54-sage-700)', marginBottom: 2 }}>{t.economie}</div>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, color: 'var(--v54-sage-700)', fontWeight: 600 }}>{t.nombre(b[8])} <span style={{ fontSize: 13 }}>{t.euroParAn}</span></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
