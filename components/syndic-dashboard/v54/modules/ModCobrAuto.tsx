'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/**
 * Cobrança Automática · Juros & Sanções — port byte-exact du ModCobrAuto du bundle V5.7.
 * Le bloc conditionnel `JurosSancoesSection` (window.Sections7) rend null hors chargement :
 * on porte le corps principal. KPIs sans icône → fallback `chart` (identique au bundle).
 */

export default function ModCobrAuto() {
  return (
    <>
      <PageHead
        title="Cobrança Automática · Juros & Sanções"
        lede="Pipeline de escalada · Cobrança IA · Juros legais Banco de Portugal · Sanções regulamentares"
        actions={<Button variant="primary"><Icon name="plus" />+ Novo processo</Button>}
      />
      <KPIGrid items={[
        { num: '0', cur: '€', lbl: 'Em curso de cobrança', accent: 'rust' },
        { num: 0, lbl: 'Processos ativos', accent: 'amber' },
        { num: '0', cur: '€', lbl: 'Recuperados', accent: 'sage' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'refresh', label: 'Processos cobrança' },
        { id: 'js', icon: 'scale', label: 'Juros & Sanções' },
      ]} />
      <Panel>
        <Empty illustration="pagamentos" title="Nenhum processo" desc="Adicione um processo de dívida para acompanhar a sua escalada automaticamente" />
      </Panel>
    </>
  )
}
