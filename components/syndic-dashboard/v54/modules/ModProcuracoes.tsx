'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Procurações & Lista de Presenças — port byte-exact du ModProcuracoes du bundle V5.7. */

const STEPS: [string, string, string][] = [
  ['1', 'Upload PDF procuração', 'Léa extrai texto OCR · confidence score'],
  ['2', 'Identificação partes', 'Procurante (condómino) · procurador · fração'],
  ['3', 'Validação NIF', 'API AT.gov.pt — match contra lista condóminos'],
  ['4', 'Extração datas', 'Validade · AG específica ou geral'],
  ['5', 'Arquivo + sinalização', 'Disponível em AG Live · pré-cheka lista presenças'],
]

export default function ModProcuracoes() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1433.° N.° 3" title="Procurações & Lista de Presenças"
        lede="Arquivo de procurações escritas · Lista de presenças assinada · Léa OCR + validação NIF"
        actions={<><Button><Icon name="upload" />Upload procuração PDF</Button><Button variant="gold"><Icon name="bank" />Gerar lista presenças AG</Button></>} />
      <Alert kind="gold" icon="scale" title="Enquadramento legal">
        Todo o condómino pode ser representado em assembleia por procuração escrita (CC art. 1433.°-3). A lista de presenças é obrigatória em qualquer AG (DL 268/94 art. 1.°-3) e deve ser conservada com a ata.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Procurações arquivadas' },
        { icon: 'bot', num: '0%', lbl: 'OCR Léa confidence', accent: 'sage' },
        { icon: 'check', num: 0, lbl: 'NIFs validados AT', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'NIFs com erro', accent: 'rust' },
        { icon: 'clock', num: 0, lbl: 'A expirar (próx. AG)', accent: 'amber' },
        { icon: 'bank', num: 0, lbl: 'AGs com lista completa', accent: 'gold' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'doc', label: 'Procurações (0)' },
        { id: 'pres', icon: 'team', label: 'Listas de Presenças (0)' },
      ]} />
      <Panel>
        <Empty illustration="ag" title="Nenhuma procuração arquivada"
          desc="Fazer upload das procurações em PDF. Léa extrai automaticamente: condómino representado, procurador, datas de validade, e valida NIFs contra AT."
          action={<Button variant="primary"><Icon name="upload" />+ Upload primeira procuração</Button>} />
      </Panel>
      <Panel title="Pipeline OCR Léa" sub="Validação automática + alertas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
