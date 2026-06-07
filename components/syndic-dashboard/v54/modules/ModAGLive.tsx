'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'

/** Assembleia Geral Digital — port byte-exact du ModAGLive du bundle V5.7. */

export default function ModAGLive() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead title="Assembleia Geral Digital" lede="Sessão em tempo real · Votação instantânea · Controlo de presenças · Ata automática" />
      <KPIGrid items={[
        { icon: 'bank', num: 0, lbl: 'Total AGs' },
        { icon: 'check', num: 0, lbl: 'Encerradas', accent: 'sage' },
        { icon: 'users', num: 0, lbl: 'Presentes (live)', accent: 'gold' },
        { icon: 'poll', num: '0‰', lbl: 'Permilagem (live)', accent: 'amber' },
      ]} />
      <Tabs defaultActive="live" tabs={[
        { id: 'live', label: 'Sessão Live' },
        { id: 'ag', icon: 'calendar', label: 'Agendar AG' },
        { id: 'hist', icon: 'stamp', label: 'Histórico' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <Panel>
        <Empty
          illustration="ag"
          title="Nenhuma AG em curso"
          desc="Agende uma AG ou inicie uma sessão agendada"
          action={<Button variant="gold" onClick={soon('Agendar nova AG', 'Agendamento de assembleias em desenvolvimento')}><Icon name="calendar" />Agendar nova AG</Button>}
        />
      </Panel>
    </>
  )
}
