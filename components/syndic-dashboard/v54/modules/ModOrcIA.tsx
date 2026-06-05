'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'

/** Orçamento Anual com IA — port byte-exact V5.7 + Phase 3 : générateur câblé à l'agent Léa (lea-comptable).
 * Câblage UI → endpoint agent existant (aucun prompt modifié, conforme ai-agents.md). Layout préservé. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

export default function ModOrcIA() {
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [edificio, setEdificio] = useState('')
  const [inflacao, setInflacao] = useState('3,2')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const gerar = () => {
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = `Gera uma proposta de orçamento previsional anual${edificio ? ` para o edifício "${edificio}"` : ''}, com taxa de inflação prevista de ${inflacao}%. Baseia-te em médias ponderadas dos últimos 3 exercícios, deteta tendências por categoria, calcula o fundo comum de reserva ao mínimo legal de 10% (DL 268/94), e apresenta as rubricas principais com o total previsto.`
      askAgent('lea', message, data.token)
        .then((text) => { setResult(text); push({ kind: 'success', title: 'Orçamento gerado', desc: 'Proposta pronta para revisão' }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao gerar', desc: 'A Léa está indisponível, tente novamente' }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: 'Gerador IA (demo)', desc: 'Conecte-se como síndico para gerar com a Léa' })
  }

  return (
    <>
      <PageHead title="Orçamento Anual com IA" lede="Geração automática baseada nos últimos 3 exercícios + tendências económicas + inflação" />
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Total Orçamentos' },
        { icon: 'pencil', num: 0, lbl: 'Rascunho', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Proposto', accent: 'gold' },
        { icon: 'bank', num: 0, lbl: 'Aprovado AG', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'bot', label: 'Gerador IA' },
        { id: 'hist', icon: 'chart', label: 'Histórico' },
        { id: 'cmp', icon: 'check', label: 'Comparação' },
        { id: 'apr', icon: 'check', label: 'Aprovação AG' },
      ]} />
      <Panel title="Parâmetros de Geração">
        <div className={m.cardGrid3}>
          <div><label htmlFor="orcia-ed" style={fieldLabel}>Edifício</label>
            <select id="orcia-ed" style={fieldCtrl} value={edificio} onChange={(e) => setEdificio(e.target.value)}>
              <option value="">{real && data.immeubles.length ? 'Todos os edifícios' : 'Nenhum edifício'}</option>
              {real && data.immeubles.map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}
            </select>
          </div>
          <div><label htmlFor="orcia-inf" style={fieldLabel}>Taxa de inflação prevista (%)</label><input id="orcia-inf" value={inflacao} onChange={(e) => setInflacao(e.target.value)} style={fieldCtrl} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Button variant="primary" style={{ width: '100%' }} onClick={gerar} disabled={busy}><Icon name="sparkle" />{busy ? 'A gerar…' : 'Gerar Orçamento 2027'}</Button></div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>O algoritmo analisa os últimos 3 exercícios contabilísticos, aplica médias ponderadas, deteta tendências de crescimento/redução por categoria, e ajusta pela inflação prevista. O fundo de reserva é automaticamente calculado ao mínimo legal de 10% (DL 268/94).</div>
      </Panel>
      <Panel>
        {busy ? (
          <Empty illustration="faturas" title="A gerar com IA…" desc="A Léa analisa os exercícios anteriores e aplica a inflação prevista." />
        ) : result ? (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)', padding: 4 }}>{result}</div>
        ) : (
          <Empty illustration="faturas" title="Gere o seu primeiro orçamento com IA" desc={'Selecione um edifício, defina a inflação prevista e clique em "Gerar"'} />
        )}
      </Panel>
    </>
  )
}
