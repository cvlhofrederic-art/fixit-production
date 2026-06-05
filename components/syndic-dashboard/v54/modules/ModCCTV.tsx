'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Câmaras de Vigilância — port byte-exact du ModCCTV du bundle V5.7. */

export default function ModCCTV() {
  return (
    <>
      <PageHead eyebrow="RGPD + DL 35/2004" title="Câmaras de Vigilância"
        lede="Inventário · Sinalização auto-gerada · Logs acesso · Retenção 30 dias máximo · CNPD compliance"
        actions={<><Button><Icon name="plus" />+ Registar câmara</Button><Button variant="gold"><Icon name="doc" />Gerar cartazes sinalização</Button></>} />
      <Alert kind="gold" icon="scale" title="Videovigilância em condomínio — regras">
        <strong>Autorização CNPD</strong> obrigatória (ou notificação simplificada). <strong>Sinalização visível</strong> nas entradas (cartaz com fim · responsável · contactos). <strong>Retenção máxima 30 dias</strong>. <strong>Acesso restrito</strong> (logs obrigatórios).
      </Alert>
      <KPIGrid items={[
        { icon: 'monitor', num: 0, lbl: 'Câmaras registadas' },
        { icon: 'building', num: 0, lbl: 'Edifícios cobertos' },
        { icon: 'check', num: 0, lbl: 'Com sinalização', accent: 'sage' },
        { icon: 'doc', num: 0, lbl: 'Autorizações CNPD', accent: 'gold' },
        { icon: 'alert', num: 0, lbl: 'Retenção > 30d (não-conforme)', accent: 'rust' },
        { icon: 'archive', num: 0, lbl: 'Logs acesso (mês)', accent: 'sage' },
      ]} />
      <Tabs defaultActive="cam" tabs={[
        { id: 'cam', icon: 'monitor', label: 'Câmaras (0)' },
        { id: 'sin', icon: 'doc', label: 'Sinalização' },
        { id: 'logs', icon: 'archive', label: 'Logs Acesso' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Edifício</th><th>Localização</th><th>Tipo</th><th>Retenção (dias)</th><th>Responsável acesso</th><th>Autorização CNPD</th><th>Sinalização</th></tr></thead>
            <tbody><tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>Nenhuma câmara registada.</td></tr></tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
