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
import { useMessages } from '@/lib/syndic/v54/i18n'
import { PONTUACAO_MESSAGES } from './i18n/ModPontuacao.messages'

/** Pontuação de Saúde dos Edifícios — port V5.7 + lot 6 fonctionnel.
 * Syndic connecté → score de saúde dérivé des édifices réels (data.immeubles, aucune
 * table) ; anonyme / sans édifices → état vide byte-exact (jauge F · 0/100). */

const numStyle = { fontFamily: 'var(--v54-font-serif)', fontSize: 24, color: 'var(--v54-navy-300)', fontWeight: 500 } as const
const CIRC = 213.6

export default function ModPontuacao() {
  const t = useMessages(PONTUACAO_MESSAGES)
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
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<><Button variant="primary" onClick={() => push({ kind: 'info', title: t.details, desc: t.toasts.details(scored.length) })}><Icon name="chart" />{t.details}</Button><Button onClick={() => push({ kind: 'info', title: t.classement, desc: scored.length ? t.toasts.meilleur(melhor) : t.toasts.aucunImmeuble })}><Icon name="grad" />{t.classement}</Button><Button variant="gold" onClick={() => push({ kind: 'success', title: t.toasts.misAJour, desc: t.toasts.moyenne(avg) })}><Icon name="sparkle" />{t.actualiser}</Button></>} />
      <div className={kpiCss.kpiGrid}>
        <div className={kpiCss.kpi} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" stroke="var(--v54-cream)" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="34" stroke={`var(--v54-${gColor}-500)`} strokeWidth="8" fill="none" strokeDasharray={`${((avg / 100) * CIRC).toFixed(0)} ${CIRC}`} />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'var(--v54-font-serif)', fontSize: 30, color: `var(--v54-${gColor}-700)`, fontWeight: 600 }}>{grade}</div>
          </div>
          <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 28 }}>{avg}/100</div><div className={kpiCss.lbl}>{t.kpi.scoreMoyen}</div><div className={kpiCss.sub}>{all.length}{t.kpi.suffixeImmeubles}</div></div>
        </div>
        <KPI icon="doc" num={melhor} numStyle={numStyle} lbl={t.kpi.meilleur} />
        <KPI icon="alert" num={pior} numStyle={numStyle} lbl={t.kpi.pire} />
        <KPI icon="bell" num={alertas} lbl={t.kpi.alertes} accent={alertas ? 'rust' : 'sage'} sub={alertas ? t.kpi.aRevoir(alertas) : t.kpi.toutEnOrdre} />
      </div>
      <Panel title={t.panneau}>
        {all.length === 0 ? (
          <div className={m.cardGrid}>
            <Empty illustration="condominos" title={t.vide.titre} />
            <Empty illustration="dados" desc={t.vide.texte} />
          </div>
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.immeuble}</th><th>{t.colonnes.ville}</th><th>{t.colonnes.lots}</th><th>{t.colonnes.score}</th><th>{t.colonnes.note}</th></tr></thead>
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
