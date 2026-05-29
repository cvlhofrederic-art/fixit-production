'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Lançamento IA de Faturas — port byte-exact du ModLancamentoFat du bundle V5.7. */

export default function ModLancamentoFat() {
  return (
    <>
      <PageHead title="Lançamento IA de Faturas" lede="Importação, extração automática e validação das faturas de fornecedores" />
      <KPIGrid items={[
        { icon: 'doc', num: 8, lbl: 'Total faturas' },
        { icon: 'clock', num: 4, lbl: 'Em espera', accent: 'amber' },
        { icon: 'check', num: 4, lbl: 'Validadas', accent: 'sage' },
        { icon: 'alert', num: 3, lbl: 'Anomalias', accent: 'rust' },
      ]} />
      <Tabs defaultActive="imp" tabs={[
        { id: 'imp', icon: 'upload', label: 'Importar faturas' },
        { id: 'esp', icon: 'clock', label: 'Em espera', badge: 4 },
        { id: 'trat', icon: 'check', label: 'Tratadas' },
        { id: 'an', icon: 'alert', label: 'Anomalias', badge: 3 },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <div className={m.dropZone}>
        <div className={m.icoLg}><Icon name="folder" /></div>
        <h4>Arraste e largue as suas faturas aqui</h4>
        <p>Formatos aceites: PDF, JPG, PNG — Importação em lote suportada</p>
        <Button variant="gold"><Icon name="search" />Procurar ficheiros</Button>
      </div>
    </>
  )
}
