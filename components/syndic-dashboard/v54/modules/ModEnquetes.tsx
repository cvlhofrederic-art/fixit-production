'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Enquetes & Sondagens — port byte-exact du ModEnquetes du bundle V5.7.
 * Note : le bundle conditionne le badge « Anónima » sur `s[8]` (le % de participation,
 * toujours truthy → artefact de décodage). On utilise le flag explicite d'anonymat. */

type Opt = [string, number, number]
type Survey = { titulo: string; desc: string; estado: string; tipo: string; edificio: string; prazo: string; resp: number; total: number; pct: number; options: Opt[]; anonima?: boolean }
const SURVEYS: Survey[] = [
  { titulo: 'Horário de recolha de lixo', desc: 'Qual o horário preferido para a recolha de lixo no condomínio? Solicitamos a participação de todas as frações', estado: 'Ativa', tipo: 'Escolha Múltipla', edificio: 'Edifício Marquês', prazo: '8 dias restantes', resp: 25, total: 40, pct: 63, options: [['Manhã (7h-9h)', 8, 32], ['Tarde (14h-16h)', 3, 12], ['Noite (20h-22h)', 12, 48], ['Sem preferência', 2, 8]] },
  { titulo: 'Aprovação obra fachada', desc: 'Concorda com a realização da obra de pintura da fachada prevista no orçamento de 2026?', estado: 'A decorrer', tipo: 'Sim / Não', edificio: 'Edifício Marquês', prazo: 'Prazo expirado', resp: 25, total: 32, pct: 78, options: [['Sim', 18, 72], ['Não', 7, 28]] },
  { titulo: 'Satisfação serviço limpeza', desc: 'De 1 a 5, como avalia a qualidade do serviço de limpeza das áreas comuns no último trimestre?', estado: 'Ativa', tipo: 'Escala 1-5', edificio: 'Residência Boavista', prazo: 'Prazo expirado', resp: 25, total: 40, pct: 63, options: [['1 - Muito Insatisfeito', 1, 4], ['2 - Insatisfeito', 3, 12], ['3 - Neutro', 5, 20], ['4 - Satisfeito', 10, 40], ['5 - Muito Satisfeito', 6, 24]], anonima: true },
]
const surveyCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: 22, marginBottom: 16 } as const

export default function ModEnquetes() {
  return (
    <>
      <PageHead title="Enquetes & Sondagens" lede="Consulte a opinião dos condóminos de forma rápida e organizada"
        actions={<Button variant="gold"><Icon name="plus" />Nova Enquete</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: 3, lbl: 'Enquetes Ativas', accent: 'gold' },
        { icon: 'folder', num: 2, lbl: 'Histórico Total' },
        { icon: 'chart', num: '80%', lbl: 'Participação Média', accent: 'sage' },
        { icon: 'users', num: 139, lbl: 'Total Respostas', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ativas" tabs={[
        { id: 'ativas', icon: 'chart', label: 'Enquetes Ativas', badge: 3 },
        { id: 'hist', icon: 'folder', label: 'Histórico', badge: 2 },
        { id: 'criar', icon: 'pencil', label: 'Criar Enquete' },
      ]} />
      {SURVEYS.map((s, i) => (
        <div key={i} style={surveyCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{s.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)' }}>{s.desc}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill kind={s.estado === 'Ativa' ? 'sage' : 'amber'} noDot>● {s.estado}</Pill>
                <Pill noDot>{s.tipo}</Pill>
                <Pill noDot>{s.edificio}</Pill>
                {s.anonima && <Pill kind="gold" noDot>Anónima</Pill>}
                <Pill kind={s.prazo === 'Prazo expirado' ? 'rust' : 'gold'} noDot>{s.prazo}</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button>Ver detalhes</Button><Button variant="danger" size="sm">Encerrar</Button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)', margin: '14px 0 6px' }}><span>{s.resp}/{s.total} frações responderam</span><span><b style={{ color: 'var(--v54-ink)' }}>{s.pct}%</b></span></div>
          <Progress pct={s.pct} />
          <div style={{ marginTop: 14 }}>
            {s.options.map((o, j) => (
              <div key={j}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span>{o[0]}</span><span><b>{o[1]} ({o[2]}%)</b></span></div>
                <Progress pct={o[2]} kind="gold" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
