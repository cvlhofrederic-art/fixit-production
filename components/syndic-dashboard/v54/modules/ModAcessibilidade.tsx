'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Acessibilidade dos Edifícios — port byte-exact V5.7 + Phase C : diagnóstico IA Alfredo (DL 163/2006). */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const CRITERIOS: [string, string, Cor][] = [
  ['Rampas exteriores (inclinação ≤ 6%)', 'Acessos ao edifício', 'sage'],
  ['Largura portas (≥ 0.77m)', 'Entrada + frações', 'sage'],
  ['Elevador acessível', 'Cabine ≥ 1.10×1.40m', 'gold'],
  ['Casa de banho adaptada', 'Partes comuns', 'amber'],
  ['Sinalética tátil', 'Botoneira + andares', 'sage'],
  ['Percurso acessível contínuo', 'Sem obstáculos', 'gold'],
]

export default function ModAcessibilidade() {
  const soon = useComingSoon()
  const { push } = useToast()
  const data = useSyndicData()
  const real = data.authenticated
  const [open, setOpen] = useState(false)
  const [edificio, setEdificio] = useState('')
  const [notas, setNotas] = useState('')
  const [busy, setBusy] = useState(false)
  const [analise, setAnalise] = useState('')
  const openAnalise = () => { setEdificio(''); setNotas(''); setAnalise(''); setOpen(true) }
  const analisar = () => {
    if (!edificio.trim()) { push({ kind: 'info', title: 'Edifício', desc: 'Indique o edifício.' }); return }
    if (!real || !data.token) { push({ kind: 'info', title: 'Análise IA Alfredo', desc: 'Conecte-se como síndico para usar o Alfredo.' }); return }
    setBusy(true)
    fetch('/api/syndic/acessibilidade-analise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ edificio, notas }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setAnalise(typeof d.analise === 'string' ? d.analise : ''))
      .catch(() => push({ kind: 'error', title: 'Erro', desc: 'Não foi possível analisar a acessibilidade.' }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 163/2006" title="Acessibilidade dos Edifícios"
        lede="Checklist 23 critérios · Análise IA fotografias por Alfredo · Plano de conformidade · Atestação PDF"
        actions={<><Button onClick={soon('Upload de fotos')}><Icon name="upload" />Upload fotos do edifício</Button><Button variant="gold" onClick={openAnalise}><Icon name="bot" />Análise IA Alfredo</Button></>} />
      <Alert kind="gold" icon="scale" title="Decreto-Lei n.° 163/2006 de 8 de agosto">
        Todos os edifícios construídos ou objeto de reabilitação após 22 de agosto de 2007 devem cumprir as normas técnicas de acessibilidade. O administrador deve poder atestar a conformidade ou apresentar plano de correção.
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: 0, lbl: 'Edifícios avaliados', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Conformes', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Não conformes', accent: 'rust' },
        { icon: 'construction', num: 0, lbl: 'Em plano correção', accent: 'amber' },
        { icon: 'coin', num: '0,00 €', lbl: 'Investimento estimado' },
        { icon: 'bot', num: 0, lbl: 'Diagnósticos IA Alfredo', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: 'Edifícios (0)' },
        { id: 'chk', icon: 'clipboard', label: 'Checklist 23 critérios' },
        { id: 'plano', icon: 'construction', label: 'Planos de correção' },
      ]} />
      <Panel>
        <Empty illustration="condominos" title="Nenhum edifício avaliado"
          desc="Faça upload de fotografias e plantas. Alfredo deteta automaticamente: rampas, larguras de portas, casas de banho adaptadas, sinalética, percursos acessíveis."
          action={<Button variant="primary" onClick={openAnalise}><Icon name="bot" />Iniciar avaliação IA</Button>} />
      </Panel>
      <Panel title="Critérios DL 163/2006 — Edifícios Habitacionais">
        <div className={m.cardGrid3}>
          {CRITERIOS.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="acess-title" size="md">
        <ModalHead icon="bot" id="acess-title" title="Análise de acessibilidade (Alfredo)" onClose={() => setOpen(false)} />
        <ModalBody>
          <Field label="Edifício" full name="acess-ed">
            <input type="text" placeholder="Nome do edifício" value={edificio} onChange={(e) => setEdificio(e.target.value)} />
          </Field>
          <Field label="Observações (opcional)" full name="acess-not">
            <textarea rows={2} placeholder="Ex.: sem rampa na entrada, elevador estreito…" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>
          {analise && <div style={{ marginTop: 14, maxHeight: 320, overflow: 'auto', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 8, padding: 14, fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{analise}</div>}
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
          <button type="button" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy} onClick={analisar}>{busy ? 'A analisar…' : (analise ? 'Reanalisar' : 'Analisar')}</button>
        </ModalFoot>
      </Modal>
    </>
  )
}
