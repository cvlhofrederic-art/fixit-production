'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../primitives/toast'
import { Pill } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import Icon from '../primitives/icon/Icon'
import styles from './ModDashboard.module.css'

/**
 * Painel de controlo (ModDashboard) — page d'accueil du dashboard syndic v54.
 * Port byte-exact du bundle V5.7 : hero strip (date + stats), ações rápidas,
 * KPIGrid, Panel orçamento (chiffres + barre empilée), Panels alertes/missões.
 * Réutilise les primitives v54 Pill / KPIGrid / Panel / Empty / Icon.
 */

interface QuickAction { id: string; title: string; desc: string; svgD: string; toast: Parameters<ReturnType<typeof useToast>['push']>[0] }

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'criar-missao', title: 'Criar missão', desc: 'Novo pedido de intervenção', svgD: 'M12 5v14M5 12h14',
    toast: { kind: 'info', title: 'Criar missão', desc: 'Abertura do formulário de nova missão' } },
  { id: 'gerar-relat', title: 'Gerar relatório', desc: 'Síntese mensal de exercício', svgD: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z|M14 3v6h6M9 13h6M9 17h4',
    toast: { kind: 'info', title: 'Gerar relatório', desc: 'A preparar o relatório mensal' } },
  { id: 'convidar-prof', title: 'Convidar profissional', desc: 'Adicionar à equipa VitFix', svgD: 'CIRCLE 9 8 3|M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6|CIRCLE 17 6 2.5|M14 17c2-1.5 4.5-1.5 7 0',
    toast: { kind: 'info', title: 'Convidar profissional', desc: 'Envio do convite por email' } },
  { id: 'agendar-insp', title: 'Agendar inspeção', desc: 'Visita técnica anual', svgD: 'RECT 3 5 18 16 2|M3 9h18M8 3v4M16 3v4',
    toast: { kind: 'info', title: 'Agendar inspeção', desc: 'Abertura do planificador' } },
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

const RECENT = [
  ['FD', 'Edifício Foz Douro', 'Canalização', 'Bruno Tavares', 'há 2 h', 'Pendente', 'amber'],
  ['BC', 'Condomínio Boavista Center', 'Coordenação de obras', 'Bruno Tavares', 'há 5 h', 'Em curso', 'sage'],
  ['RC', 'Residencial Cedofeita', 'Inspeção técnica', 'Bruno Tavares', 'ontem', 'Pendente', 'amber'],
  ['BC', 'Condomínio Boavista Center', 'Verificação fachada', 'Ana Ribeiro', 'ontem', 'Concluída', 'sage'],
] as const

const eyebrowStyle = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', fontWeight: 600 } as const
const figVal = { fontFamily: 'var(--v54-font-serif)', fontSize: 34, marginTop: 6 } as const

export default function ModDashboard() {
  const { push } = useToast()
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    setDateStr(new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()))
  }, [])

  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <div className={styles.dateLine}>{dateStr}</div>
            <h1 className={styles.heroTitle}>Bem-vindo, <i>Super Admin</i></h1>
            <div className={styles.lede}>Visão geral do portefólio VitFix — orçamentos, missões em curso e estado operacional dos seus condomínios.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Pill kind="sage">Operação estável</Pill>
              <Pill kind="gold">Sincronizado há 2 min</Pill>
              <Pill kind="amber">6 ordens pendentes</Pill>
            </div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Frações</div><div className={styles.statVal}>40</div><div className={styles.statSub}>em 4 edifícios</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Missões ativas</div><div className={styles.statVal}>4</div><div className={styles.statSub}>6 pendentes</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Orçamento 2026</div><div className={styles.statVal}>188<span className={styles.statCur}>k €</span></div><div className={styles.statSub}>55% consumido</div></div>
        </div>
      </div>

      <div className={styles.sectionEyebrow}><span>Ações rápidas</span><div className={styles.eyebrowLine} /></div>
      <div className={styles.quick}>
        {QUICK_ACTIONS.map((qa) => (
          <button key={qa.id} type="button" className={styles.qa} onClick={() => push(qa.toast)}>
            <div className={styles.qaIco}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                {qa.svgD.split('|').map(renderSvgChild)}
              </svg>
            </div>
            <div className={styles.qaText}>
              <b>{qa.title}</b>
              <span>{qa.desc}</span>
            </div>
            <svg className={styles.qaArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        ))}
      </div>

      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Edifícios geridos', sub: '40 frações no total', trend: { kind: 'flat', label: '+0%' } },
        { icon: 'wrench', num: 9, lbl: 'Profissionais ativos', sub: '7 certificados VitFix', accent: 'sage', trend: { kind: 'ok', label: '+2 este mês' } },
        { icon: 'clipboard', num: 4, lbl: 'Missões em curso', sub: 'Prazo médio · 3,2 dias', accent: 'amber', trend: { kind: 'warn', label: '6 pendentes' } },
        { icon: 'check', num: 0, lbl: 'Alertas ativos', sub: '0 urgentes · 0 hoje', accent: 'sage', trend: { kind: 'ok', label: 'Tudo OK' } },
      ]} />

      <Panel
        title="Orçamento global — Exercício 2026"
        sub="Repartição orçamental por categoria · atualizado há 2 horas"
        right={<><Pill kind="sage">Em curso</Pill><button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="download" />Exportar</button></>}
      >
        <div className={styles.budgetFigures}>
          <div><div style={eyebrowStyle}>Orçamento total</div><div style={figVal}>188 000<span style={{ color: 'var(--v54-gold-700)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>Exercício 2026</div></div>
          <div><div style={eyebrowStyle}>Gasto</div><div style={{ ...figVal, color: 'var(--v54-rust-700)' }}>102 470<span style={{ color: 'var(--v54-rust-500)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>55% consumido</div></div>
          <div><div style={eyebrowStyle}>Restante</div><div style={{ ...figVal, color: 'var(--v54-sage-700)' }}>85 530<span style={{ color: 'var(--v54-sage-500)', fontStyle: 'italic', marginLeft: 3, fontSize: 22 }}>€</span></div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>Disponível · 45%</div></div>
          <div><div style={eyebrowStyle}>Previsão de fim</div><div style={{ ...figVal, fontSize: 22, color: 'var(--v54-navy-700)' }}>Setembro 2026</div><div style={{ fontSize: 11.5, color: 'var(--v54-sage-700)', marginTop: 4 }}>▲ 2 semanas de margem</div></div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-sage-700), var(--v54-sage-500))' }} />Manutenção · 42 000 €</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-gold-600), var(--v54-gold-500))' }} />Obras · 38 200 €</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-amber-700), var(--v54-amber-500))' }} />Serviços · 14 870 €</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg, var(--v54-rust-700), var(--v54-rust-500))' }} />Outros · 7 400 €</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--v54-cream)', border: '1px solid var(--v54-line)' }} />Disponível · 85 530 €</span>
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
        <Panel title="Alertas urgentes" icon="alert">
          <Empty kind="sage" illustration="ocorrencias" title="Nenhum alerta urgente" desc="Tudo sob controlo · operação nominal" />
        </Panel>
        <Panel title="Missões recentes" icon="clipboard" flush>
          {RECENT.map((r, i) => (
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
