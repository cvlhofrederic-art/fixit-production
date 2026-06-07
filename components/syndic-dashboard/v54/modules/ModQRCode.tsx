'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'

/** QR Code por Fração — port byte-exact du ModQRCode du bundle V5.7. */

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 } as const

export default function ModQRCode() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        title="QR Code por Fração"
        lede="Gere QR Codes por zona · Condóminos reportam problemas com scan · Sinalizações automáticas"
        actions={<Button variant="gold" onClick={soon('Novo QR Code', 'Geração de QR codes em desenvolvimento')}><Icon name="plus" />+ Novo QR Code</Button>}
      />
      <KPIGrid items={[
        { icon: 'qr', num: 0, lbl: 'QR Codes ativos', accent: 'gold' },
        { icon: 'target', num: 0, lbl: 'Total scans' },
        { icon: 'alert', num: 0, lbl: 'Novas sinalizações', accent: 'rust' },
        { icon: 'check', num: 0, lbl: 'Resolvidos', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'qr', label: 'Gerir QR Codes' },
        { id: 'sig', icon: 'siren', label: 'Sinalizações (0)' },
        { id: 'est', icon: 'chart', label: 'Estatísticas' },
      ]} />
      <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
      <Panel>
        <Empty
          illustration="documentos"
          title="Nenhum QR Code criado"
          desc="Crie QR Codes para zonas comuns ou frações"
          action={<Button variant="gold" onClick={soon('Novo QR Code', 'Geração de QR codes em desenvolvimento')}><Icon name="plus" />+ Novo QR Code</Button>}
        />
      </Panel>
    </>
  )
}
