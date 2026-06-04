'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Open Banking — Reconciliação Automática — port byte-exact du ModOpenBanking du bundle V5.7. */

const BANCOS = ['Caixa Geral', 'BCP Millennium', 'Santander', 'Novobanco', 'BPI', 'Crédito Agrícola', 'Revolut Business', 'Wise Business', 'Activo Bank', 'Banco CTT']

export default function ModOpenBanking() {
  return (
    <>
      <PageHead eyebrow="TESOURARIA · PSD2 AISP" title="Open Banking — Reconciliação Automática"
        lede="Conexão direta bancos PT · Sync diário · Max Expert auto-match transações · Confidence score"
        actions={<><Button><Icon name="plus" />+ Conectar conta bancária</Button><Button variant="gold"><Icon name="refresh" />Sync agora</Button></>} />
      <Alert kind="sage" icon="check" title="PSD2 Open Banking — autorização Banco Portugal">
        Conexões via providers licenciados AISP (Tink · GoCardless). Suporta Caixa, BCP, Santander, Novobanco, Millennium, BPI, Crédito Agrícola, Revolut Business. Max Expert auto-match 90%+ das transações com confidence score; restantes 10% revisão manual em 1 clique.
      </Alert>
      <KPIGrid items={[
        { icon: 'bank', num: 0, lbl: 'Contas conectadas' },
        { icon: 'refresh', num: 0, lbl: 'Transações sync (mês)', accent: 'gold' },
        { icon: 'check', num: '0%', lbl: 'Auto-match Max Expert', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Em revisão manual', accent: 'amber' },
        { icon: 'ban', num: 0, lbl: 'Não conciliadas', accent: 'rust' },
        { icon: 'clock', num: '—', lbl: 'Última sync' },
      ]} />
      <Tabs defaultActive="contas" tabs={[
        { id: 'contas', icon: 'bank', label: 'Contas (0)' },
        { id: 'sync', icon: 'refresh', label: 'Sync recente' },
        { id: 'rev', icon: 'alert', label: 'A rever (0)' },
      ]} />
      <Panel>
        <Empty illustration="pagamentos" title="Nenhuma conta conectada"
          desc="Conecte a conta bancária do condomínio via Open Banking PSD2. Sync automático diário, reconciliação 90%+ por Max Expert."
          action={<Button variant="primary"><Icon name="bank" />Conectar primeira conta</Button>} />
      </Panel>
      <Panel title="Bancos suportados">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {BANCOS.map((b, i) => (
            <div key={i} style={{ padding: '10px 14px', border: '1px solid var(--v54-line)', borderRadius: 8, textAlign: 'center', background: 'var(--v54-cream)', fontSize: 12, fontWeight: 600, color: 'var(--v54-navy-900)' }}>{b}</div>
          ))}
        </div>
      </Panel>
    </>
  )
}
