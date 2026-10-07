'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { MONITORIZACAO_MESSAGES } from './i18n/ModMonitorizacao.messages'

/** Monitorização de Consumos — port byte-exact du ModMonitorizacao du bundle V5.7. */

/** Couleur de barre et valeurs des 6 derniers mois (électricité, eau, gaz) ; titres dans le dictionnaire. */
const SERIES: [string, number[]][] = [
  ['var(--v54-amber-500)', [120, 135, 108, 112, 140, 150]],
  ['var(--v54-navy-900)', [58, 42, 50, 35, 42, 30]],
  ['var(--v54-rust-500)', [280, 255, 242, 205, 232, 165]],
]
const swatch = (bg: string) => ({ width: 10, height: 10, background: bg, display: 'inline-block', borderRadius: 2, marginRight: 4 } as const)

export default function ModMonitorizacao() {
  const t = useMessages(MONITORIZACAO_MESSAGES)
  const k = t.kpi
  const charts: [string, string, number[]][] = SERIES.map(([couleur, valeurs], i) => [t.graphiques[i], couleur, valeurs])
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: t.onglets.dash },
        { id: 'cons', icon: 'lightning', label: t.onglets.cons },
        { id: 'al', icon: 'bell', label: t.onglets.al, badge: 2 },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <KPIGrid items={[
        { icon: 'bolt', num: k.electricite.num, lbl: k.electricite.lbl, sub: k.vsMoisPrecedent, accent: 'amber', trend: { kind: 'ok', label: k.electricite.tendance } },
        { icon: 'droplet', num: k.eau.num, lbl: k.eau.lbl, sub: k.vsMoisPrecedent, accent: 'sage', trend: { kind: 'ok', label: k.eau.tendance } },
        { icon: 'flame', num: k.gaz.num, lbl: k.gaz.lbl, sub: k.vsMoisPrecedent, accent: 'rust', trend: { kind: 'bad', label: k.gaz.tendance } },
        { icon: 'coin', num: k.cout.num, lbl: k.cout.lbl, sub: k.vsMoisPrecedent, accent: 'gold', trend: { kind: 'ok', label: k.cout.tendance } },
      ]} />
      <div className={m.cardGrid3}>
        {charts.map((c, i) => (
          <Panel key={i} title={c[0]}>
            <svg viewBox="0 0 240 140" style={{ width: '100%', height: 140 }}>
              {c[2].map((v, j) => <rect key={j} x={20 + j * 35} y={130 - v * 0.6} width="22" height={v * 0.6} rx="3" fill={c[1]} opacity={0.85} />)}
              <g fontSize="10" fill="var(--v54-navy-300)" fontFamily="var(--v54-font-mono)">
                {t.mois.map((mes, j) => <text key={j} x={20 + j * 35 + 11} y="138" textAnchor="middle">{mes}</text>)}
              </g>
            </svg>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--v54-navy-500)', marginTop: 6 }}>
              <span><span style={swatch(c[1])}></span>{t.anneeEnCours}</span>
              <span><span style={swatch('var(--v54-navy-100)')}></span>{t.anneePrecedente}</span>
            </div>
          </Panel>
        ))}
      </div>
      <Panel title={t.alertesActives} right={<Pill kind="amber" noDot>{t.nbActives}</Pill>}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--v54-line)', borderLeft: '3px solid var(--v54-amber-500)', paddingLeft: 14, marginBottom: 8 }}><b>{t.alerteEau}</b> <span style={{ marginLeft: 8 }}><Pill kind="amber" noDot>{t.avertissement}</Pill></span></div>
        <div style={{ paddingLeft: 14, borderLeft: '3px solid var(--v54-sage-500)' }}><b>{t.alerteElectricite}</b> <span style={{ marginLeft: 8 }}><Pill kind="sage" noDot>{t.info}</Pill></span></div>
      </Panel>
    </>
  )
}
