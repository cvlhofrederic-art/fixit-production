'use client'

import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Immeuble } from '@/components/syndic-dashboard/types'
import { healthScore, scoreGrade, gradeColor, scoreProgressKind } from '@/lib/syndic/v54/building-score'

/** Pontuação de Saúde dos Edifícios — port V5.7 + lot 6 fonctionnel.
 * Syndic connecté → score de saúde dérivé des édifices réels (data.immeubles, aucune
 * table) ; anonyme / sans édifices → état vide byte-exact (jauge F · 0/100). */

const numStyle = { fontFamily: 'var(--v54-font-serif)', fontSize: 24, color: 'var(--v54-navy-300)', fontWeight: 500 } as const
const CIRC = 213.6

export default function ModPontuacao() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Immeuble[] = real ? (data.immeubles ?? []) : []
  const { push } = useToast()

  const scored = all.map(im => ({ im, score: healthScore(im) })).sort((a, b) => b.score - a.score)
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : 0
  const grade = scoreGrade(avg)
  const gColor = gradeColor(avg)
  const melhor = scored[0]?.im.nom || '—'
  const pior = scored.length ? scored[scored.length - 1].im.nom : '—'
  const alertas = scored.filter(r => r.score < 50).length

  return (
    <>
      <PageHead title="Pontuação de Saúde dos Edifícios" lede="Avaliação IA baseada em estado técnico, finanças, conformidade, satisfação e energia"
        actions={<><Button variant="primary" onClick={() => push({ kind: 'info', title: 'Detalhes', desc: `${scored.length} edifício(s) avaliados` })}><Icon name="chart" />Detalhes</Button><Button onClick={() => push({ kind: 'info', title: 'Ranking', desc: scored.length ? `Melhor: ${melhor}` : 'Sem edifícios' })}><Icon name="grad" />Ranking</Button><Button variant="gold" onClick={() => push({ kind: 'success', title: 'Pontuações atualizadas', desc: `Média ${avg}/100` })}><Icon name="sparkle" />Atualizar</Button></>} />
      <div className={kpiCss.kpiGrid}>
        <div className={kpiCss.kpi} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" stroke="var(--v54-cream)" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="34" stroke={`var(--v54-${gColor}-500)`} strokeWidth="8" fill="none" strokeDasharray={`${((avg / 100) * CIRC).toFixed(0)} ${CIRC}`} />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'var(--v54-font-serif)', fontSize: 30, color: `var(--v54-${gColor}-700)`, fontWeight: 600 }}>{grade}</div>
          </div>
          <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 28 }}>{avg}/100</div><div className={kpiCss.lbl}>Pontuação Média</div><div className={kpiCss.sub}>{all.length} edifício(s)</div></div>
        </div>
        <KPI icon="doc" num={melhor} numStyle={numStyle} lbl="Melhor Edifício" />
        <KPI icon="alert" num={pior} numStyle={numStyle} lbl="Pior Edifício" />
        <KPI icon="bell" num={alertas} lbl="Alertas Ativos" accent={alertas ? 'rust' : 'sage'} sub={alertas ? `${alertas} edifício(s) a rever` : 'Tudo em ordem!'} />
      </div>
      <Panel title="EDIFÍCIOS">
        {all.length === 0 ? (
          <div className={m.cardGrid}>
            <Empty illustration="condominos" title="Nenhum edifício" />
            <Empty illustration="dados" desc="Selecione um edifício para ver a análise completa" />
          </div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Edifício</th><th>Cidade</th><th>Frações</th><th>Pontuação</th><th>Nota</th></tr></thead>
              <tbody>{scored.map(({ im, score }) => (
                <tr key={im.id}>
                  <td><b>{im.nom}</b></td>
                  <td>{im.ville || '—'}</td>
                  <td className={m.numCell}>{im.nbLots || 0}</td>
                  <td style={{ minWidth: 150 }}><Progress pct={score} kind={scoreProgressKind(score)} /></td>
                  <td><Pill kind={gradeColor(score)} noDot>{scoreGrade(score)} · {score}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
