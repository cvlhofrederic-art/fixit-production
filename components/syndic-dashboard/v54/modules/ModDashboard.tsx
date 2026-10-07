'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../primitives/toast'
import { Pill, type PillKind } from '../primitives/pill'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission } from '@/components/syndic-dashboard/types'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import styles from './ModDashboard.module.css'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { DASHBOARD_MESSAGES, type ActionRapideId } from './i18n/ModDashboard.messages'

/**
 * Painel de controlo (ModDashboard) — page d'accueil du dashboard syndic v54.
 * Port byte-exact du bundle V5.7 : hero strip (date + stats), ações rápidas,
 * KPIGrid, Panel orçamento (chiffres + barre empilée), Panels alertes/missões.
 * Réutilise les primitives v54 Pill / KPIGrid / Panel / Empty / Icon.
 */

interface QuickAction { id: ActionRapideId; svgD: string; route: string }

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'criar-missao', svgD: 'M12 5v14M5 12h14', route: 'ordens' },
  { id: 'gerar-relat', svgD: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z|M14 3v6h6M9 13h6M9 17h4', route: 'relGestao' },
  { id: 'convidar-prof', svgD: 'CIRCLE 9 8 3|M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6|CIRCLE 17 6 2.5|M14 17c2-1.5 4.5-1.5 7 0', route: 'equipa' },
  { id: 'agendar-insp', svgD: 'RECT 3 5 18 16 2|M3 9h18M8 3v4M16 3v4', route: 'vistoria' },
]

function renderSvgChild(token: string, i: number) {
  if (token.startsWith('CIRCLE ')) {
    const [, cx, cy, r] = token.split(' ')
    return <circle key={i} cx={cx} cy={cy} r={r} />
  }
  if (token.startsWith('RECT ')) {
    const [, x, y, w, h, rx] = token.split(' ')
    return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />
  }
  return <path key={i} d={token} />
}

const eyebrowStyle = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', fontWeight: 600 } as const
const figVal = { fontFamily: 'var(--v54-font-serif)', fontSize: 34, marginTop: 6 } as const

type RecentRow = readonly [string, string, string, string, string, string, PillKind]
type Statuts = (typeof DASHBOARD_MESSAGES)['pt-PT']['statuts']

/** Initiales (2 lettres) depuis un nom d'immeuble. */
function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '—'
}

/** Statut mission → libellé (langue courante) + couleur Pill (Phase 2, données réelles). */
function missionStatus(statut: string, statuts: Statuts): { label: string; color: PillKind } {
  switch (statut) {
    case 'en_cours': return { label: statuts.en_cours, color: 'sage' }
    case 'acceptee': return { label: statuts.acceptee, color: 'sage' }
    case 'terminee': return { label: statuts.terminee, color: 'sage' }
    case 'en_attente': return { label: statuts.en_attente, color: 'amber' }
    case 'annulee': case 'refusee': return { label: statuts.annulee, color: 'rust' }
    default: return { label: statut || '—', color: 'gold' }
  }
}

function missionToRow(m: Mission, statuts: Statuts): RecentRow {
  const st = missionStatus(m.statut, statuts)
  return [initials(m.immeuble), m.immeuble, m.type, m.artisan || '—', m.dateIntervention || m.dateCreation || '', st.label, st.color]
}

export default function ModDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const t = useMessages(DASHBOARD_MESSAGES)
  const locale = useV54Locale()
  const { push } = useToast()
  // Phase 2 : données réelles du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    setDateStr(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()))
  }, [locale])
  const recent: ReadonlyArray<RecentRow> = real
    ? data.missions.slice(0, 4).map((mi) => missionToRow(mi, t.statuts))
    : t.recentes.map((r) => {
        const st = missionStatus(r.statut, t.statuts)
        return [r.initiales, r.immeuble, r.type, r.prestataire, r.quand, st.label, st.color] as const
      })
  const b = t.budget
  const lg = b.legende

  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <div className={styles.dateLine}>{dateStr}</div>
            <h1 className={styles.heroTitle}>{t.bienvenue}<i>{t.superAdmin}</i></h1>
            <div className={styles.lede}>{t.chapeau}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Pill kind="sage">{t.pastilles.stable}</Pill>
              <Pill kind="gold">{t.pastilles.synchro}</Pill>
              <Pill kind="amber">{t.pastilles.ordres}</Pill>
            </div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>{t.bandeau.lots}</div><div className={styles.statVal}>40</div><div className={styles.statSub}>{t.bandeau.lotsSous}</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>{t.bandeau.missions}</div><div className={styles.statVal}>4</div><div className={styles.statSub}>{t.bandeau.missionsSous}</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>{t.bandeau.budget}</div><div className={styles.statVal}>188<span className={styles.statCur}>{t.bandeau.milliersEuros}</span></div><div className={styles.statSub}>{t.bandeau.budgetSous}</div></div>
        </div>
      </div>

      <div className={styles.sectionEyebrow}><span>{t.actionsRapides}</span><div className={styles.eyebrowLine} /></div>
      <div className={styles.quick}>
        {QUICK_ACTIONS.map((qa) => {
          const a = t.actions[qa.id]
          return (
            <button key={qa.id} type="button" className={styles.qa} onClick={() => { onNavigate?.(qa.route); push({ kind: 'info', title: a.titre, desc: a.toast }) }}>
              <div className={styles.qaIco}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  {qa.svgD.split('|').map(renderSvgChild)}
                </svg>
              </div>
              <div className={styles.qaText}>
                <b>{a.titre}</b>
                <span>{a.desc}</span>
              </div>
              <svg className={styles.qaArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          )
        })}
      </div>

      <KPIGrid items={[
        { icon: 'building', num: real ? data.immeubles.length : 4, lbl: t.kpi.immeubles, sub: t.kpi.lotsAuTotal(real ? data.immeubles.reduce((a, i) => a + (i.nbLots || 0), 0) : 40), trend: real ? undefined : { kind: 'flat', label: t.kpi.tendanceImmeubles } },
        { icon: 'wrench', num: real ? data.artisans.filter((a) => a.statut === 'actif').length : 9, lbl: t.kpi.prestataires, sub: t.kpi.certifies(real ? data.artisans.filter((a) => a.vitfixCertifie).length : 7), accent: 'sage', trend: real ? undefined : { kind: 'ok', label: t.kpi.tendancePrestataires } },
        { icon: 'clipboard', num: real ? data.missions.filter((m) => m.statut === 'en_cours' || m.statut === 'acceptee').length : 4, lbl: t.kpi.missions, sub: real ? t.kpi.enAttente(data.missions.filter((m) => m.statut === 'en_attente').length) : t.kpi.delaiMoyen, accent: 'amber', trend: real ? undefined : { kind: 'warn', label: t.kpi.enAttente(6) } },
        { icon: 'check', num: 0, lbl: t.kpi.alertes, sub: real ? t.kpi.toutSousControle : t.kpi.alertesDemo, accent: 'sage', trend: real ? undefined : { kind: 'ok', label: t.kpi.toutVaBien } },
      ]} />

      <Panel
        title={b.titre}
        sub={b.sousTitre}
        right={<><Pill kind="sage">{b.enCours}</Pill><Button onClick={() => push({ kind: 'info', title: b.exporter, desc: b.enDeveloppement })}><Icon name="download" />{b.exporter}</Button></>}
      >
        <div className={styles.budgetFigures}>
          <div><div style={eyebrowStyle}>{b.total}</div><div style={figVal}>188 000<span style={{ color: 'var(--v54-gold-700)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>{b.exercice}</div></div>
          <div><div style={eyebrowStyle}>{b.depense}</div><div style={{ ...figVal, color: 'var(--v54-rust-700)' }}>102 470<span style={{ color: 'var(--v54-rust-500)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>{b.consomme}</div></div>
          <div><div style={eyebrowStyle}>{b.restant}</div><div style={{ ...figVal, color: 'var(--v54-sage-700)' }}>85 530<span style={{ color: 'var(--v54-sage-500)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>{b.disponible}</div></div>
          <div><div style={eyebrowStyle}>{b.finPrevue}</div><div style={{ ...figVal, fontSize: 22, color: 'var(--v54-navy-700)' }}>{b.finPrevueValeur}</div><div style={{ fontSize: 11.5, color: 'var(--v54-sage-700)', marginTop: 4 }}>{b.marge}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-sage-700), var(--v54-sage-500))' }} />{lg.entretien}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-gold-600), var(--v54-gold-500))' }} />{lg.travaux}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-amber-700), var(--v54-amber-500))' }} />{lg.services}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-rust-700), var(--v54-rust-500))' }} />{lg.autres}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--v54-cream)', border: '1px solid var(--v54-line)' }} />{lg.disponible}</span>
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--v54-cream)', border: '1px solid var(--v54-line)' }}>
          <div style={{ flex: 42000, background: 'linear-gradient(90deg, var(--v54-sage-700), var(--v54-sage-500))' }} />
          <div style={{ flex: 38200, background: 'linear-gradient(90deg, var(--v54-gold-600), var(--v54-gold-500))' }} />
          <div style={{ flex: 14870, background: 'linear-gradient(90deg, var(--v54-amber-700), var(--v54-amber-500))' }} />
          <div style={{ flex: 7400, background: 'linear-gradient(90deg, var(--v54-rust-700), var(--v54-rust-500))' }} />
          <div style={{ flex: 85530 }} />
        </div>
      </Panel>

      <div className={styles.twoCol}>
        <Panel title={t.alertes.titre} icon="alert">
          <Empty kind="sage" illustration="ocorrencias" title={t.alertes.vide} desc={t.alertes.videDesc} />
        </Panel>
        <Panel title={t.missionsRecentes} icon="clipboard" flush>
          {recent.map((r, i) => (
            <div key={i} className={styles.listRow}>
              <div className={styles.thumb}>{r[0]}</div>
              <div className={styles.info}><b>{r[1]}</b><div className={styles.meta}><span>{r[2]}</span><span className={styles.metaDot} /><span style={{ color: 'var(--v54-navy-500)', fontWeight: 500 }}>{r[3]}</span><span className={styles.metaDot} /><span>{r[4]}</span></div></div>
              <div />
              <Pill kind={r[6]}>{r[5]}</Pill>
            </div>
          ))}
        </Panel>
      </div>
    </>
  )
}
