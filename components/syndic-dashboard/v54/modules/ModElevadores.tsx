'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Gestão de Elevadores — port byte-exact du ModElevadores du bundle V5.7. */

const STEPS: [string, string, string][] = [
  ['1', 'EMA deteta risco grave', 'Travagem · cabos · porta · botoneira'],
  ['2', 'EMA notifica administrador', 'Email/SMS automático · prazo 24h'],
  ['3', 'Administrador notifica Câmara', 'Template auto-gerado · enviado em 48h'],
  ['4', 'Sinalização elevador fora serviço', 'Cartaz auto-gerado em PDF'],
  ['5', 'Acompanhamento até reparação', 'Predição Manutenção atualiza'],
]

export default function ModElevadores() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 320/2002 + LEI 65/2013" title="Gestão de Elevadores"
        lede="Contrato EMA obrigatório · Inspeções periódicas 2/4/6 anos · Comunicação Câmara em 48h se risco grave"
        actions={<><Button><Icon name="plus" />+ Registar elevador</Button><Button variant="gold"><Icon name="upload" />Upload relatório inspeção</Button></>} />
      <Alert kind="gold" icon="scale" title="Periodicidade obrigatória das inspeções — Art. 8.° DL 320/2002">
        <strong>2 anos</strong> — edifícios comerciais ou serviços abertos ao público.<br />
        <strong>4 anos</strong> — edifícios mistos ou habitacionais com &gt; 32 fogos / &gt; 8 pisos.<br />
        <strong>6 anos</strong> — outros edifícios habitacionais.<br />
        Coimas em caso de incumprimento: <strong>250 € a 5 000 €</strong>.
      </Alert>
      <KPIGrid items={[
        { icon: 'monitor', num: 0, lbl: 'Elevadores registados' },
        { icon: 'check', num: 0, lbl: 'Em conformidade', accent: 'sage' },
        { icon: 'clock', num: 0, lbl: 'Próximos do prazo (≤ 90d)', accent: 'amber' },
        { icon: 'ban', num: 0, lbl: 'Inspeção em atraso', accent: 'rust' },
        { icon: 'shield', num: 0, lbl: 'EMAs ativas' },
        { icon: 'alert', num: 0, lbl: 'Comunicações Câmara 48h', accent: 'rust' },
      ]} />
      <Tabs defaultActive="elev" tabs={[
        { id: 'elev', icon: 'monitor', label: 'Elevadores (0)' },
        { id: 'insp', icon: 'clipboard', label: 'Inspeções (0)' },
        { id: 'ema', icon: 'shield', label: 'Contratos EMA (0)' },
        { id: 'risco', icon: 'alert', label: 'Comunicações risco grave' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Edifício</th><th>Marca/Modelo</th><th>Categoria</th><th>Periodicidade</th><th>Última inspeção</th><th>Próxima inspeção</th><th>EMA</th><th>Estado</th></tr></thead>
            <tbody><tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>Nenhum elevador registado. Registe o primeiro elevador.</td></tr></tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Workflow risco grave — 48h" sub="DL 320/2002 art. 22.° + Lei 65/2013">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-rust-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
