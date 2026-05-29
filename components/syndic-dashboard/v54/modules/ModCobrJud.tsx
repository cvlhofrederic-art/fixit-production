'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import { Button } from '../primitives/button'
import m from './modules.module.css'

/** Cobrança Judicial — port byte-exact du ModCobrJud du bundle V5.7. */

interface Proc {
  name: string
  fracao: string
  valor: string
  atraso: string
  restantes: string
  proxima: string
}
interface Stage {
  label: string
  prazo: string
  count: number
  color: PillKind
  procs?: readonly Proc[]
}

const PIPELINE: readonly Stage[] = [
  { label: 'Atraso identificado', prazo: 'Imediato', count: 0, color: 'rust' },
  { label: 'Contacto amigável', prazo: '15 dias', count: 1, color: 'amber', procs: [{ name: 'Ana Beatriz Oliveira', fracao: 'Fração C - 3.° Dto.', valor: '875,00 €', atraso: '265 dias atraso', restantes: '-189d restantes', proxima: 'Próxima: Contacto telefónico (prazo 1…' }] },
  { label: 'Notificação formal (LRAR)', prazo: '30 dias', count: 0, color: 'amber' },
  { label: 'Prazo 90 dias (Lei 8/2022)', prazo: '90 dias', count: 1, color: 'gold', procs: [{ name: 'Manuel Ferreira dos Santos', fracao: 'Fração A - 1.° Esq.', valor: '2450,00 €', atraso: '449 dias atraso', restantes: '-253d restantes', proxima: 'Próxima: Verificar cumprimento prazo…' }] },
  { label: 'Injunção / Ação judicial', prazo: 'Variável', count: 1, color: 'rust', procs: [{ name: 'Carlos Miguel Pinto', fracao: 'Fração E - R/C Esq.', valor: '5890,00 €', atraso: '874 dias atraso', restantes: '8d restantes', proxima: 'Próxima: Aguardar notificação …' }] },
]

export default function ModCobrJud() {
  return (
    <>
      <PageHead
        title="Cobrança Judicial"
        lede="Gestão automatizada de cobrança de dívidas ao condomínio (Lei portuguesa)"
        actions={<Button variant="primary"><Icon name="plus" />+ Novo processo</Button>}
      />
      <Alert title="Alerta Lei 8/2022 — Prazo de 90 dias a expirar">
        <span style={{ display: 'block' }}>2 processo(s) com atraso superior a 75 dias. A lei obriga a instauração de acao judicial após 90 dias.</span>
        <span style={{ display: 'flex', gap: 8, marginTop: 8 }}><Pill kind="amber" noDot>Manuel Ferreira dos Santos — 449 dias</Pill><Pill kind="amber" noDot>Ana Beatriz Oliveira — 265 dias</Pill></span>
      </Alert>
      <Tabs defaultActive="pipe" tabs={[
        { id: 'pipe', icon: 'chart', label: 'Pipeline' },
        { id: 'proc', icon: 'folder', label: 'Processos' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
        { id: 'leg', icon: 'scale', label: 'Legislação' },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '17 565,00 €', lbl: 'Total em dívida', accent: 'rust' },
        { icon: 'users', num: 4, lbl: 'N.° devedores' },
        { icon: 'calendar', num: '669 dias', lbl: 'Média dias atraso', accent: 'amber' },
        { icon: 'check', num: '1600,00 €', lbl: 'Recuperado este ano', accent: 'sage' },
      ]} />
      <Panel title="Pipeline de cobranca">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {PIPELINE.map((c) => (
            <div key={c.label}>
              <div style={{ padding: '10px 14px', background: `var(--v54-${c.color}-50)`, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: `var(--v54-${c.color}-700)`, marginBottom: 2 }}>{c.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--v54-navy-500)' }}>{c.prazo}</span>
                  <Pill kind={c.color} noDot>{c.count}</Pill>
                </div>
              </div>
              {!c.procs ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 11.5, background: 'var(--v54-paper)', borderRadius: 8 }}>Sem processos</div>
              ) : (
                c.procs.map((p) => (
                  <div key={p.name} className={m.card} style={{ padding: 12, fontSize: 11.5 }}>
                    <b style={{ fontSize: 12.5 }}>{p.name}</b>
                    <div style={{ color: 'var(--v54-navy-500)', marginTop: 2 }}>{p.fracao}</div>
                    <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, color: 'var(--v54-gold-700)', marginTop: 6, fontWeight: 600 }}>{p.valor}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}><Pill kind="amber" noDot>{p.atraso}</Pill><Pill kind="rust" noDot>{p.restantes}</Pill></div>
                    <div style={{ color: 'var(--v54-navy-300)', marginTop: 6 }}>{p.proxima}</div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
