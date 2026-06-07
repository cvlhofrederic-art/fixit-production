'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'

/** Documentos de Intervenções — port byte-exact du ModDocsInterv du bundle V5.7. */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

export default function ModDocsInterv() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        title="Documentos de Intervenções"
        lede="Faturas · Orçamentos · Relatórios · Fotos — Transmissão à contabilidade"
        actions={<Button variant="gold" onClick={soon('Adicionar documento')}><Icon name="plus" />Adicionar documento</Button>}
      />
      <KPIGrid items={[
        { icon: 'file', num: 0, lbl: 'Total documentos', sub: 'Todas as categorias' },
        { icon: 'mail', num: 0, lbl: 'Não transmitidas à contabilidade', sub: 'A tratar', accent: 'rust' },
        { icon: 'check', num: 0, lbl: 'Transmitidas à contabilidade', sub: 'Classificados', accent: 'sage' },
        { icon: 'file', num: 0, lbl: 'Faturas', sub: 'Este mês', accent: 'gold' },
      ]} />
      <Tabs defaultActive="all" tabs={[
        { id: 'all', icon: 'clipboard', label: 'Todos', badge: 0 },
        { id: 'env', label: '● A enviar', badge: 0 },
        { id: 'sent', label: '● Enviados & classificados', badge: 0 },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar documento" style={inputStyle} placeholder="Pesquisar por profissional, edifício, ficheiro, notas…" />
        </div>
        <Button onClick={soon('Filtrar por tipo')}><Icon name="doc" />Todos os tipos</Button>
        <Button onClick={soon('Filtrar por profissional')}><Icon name="wrench" />Todos os profissionais</Button>
      </div>
      <Panel>
        <Empty
          illustration="documentos"
          title="Nenhum documento"
          desc="Adicione faturas, orçamentos e relatórios de intervenção"
          action={<Button variant="gold" onClick={soon('Adicionar documento')}><Icon name="plus" />Adicionar documento</Button>}
        />
      </Panel>
    </>
  )
}
