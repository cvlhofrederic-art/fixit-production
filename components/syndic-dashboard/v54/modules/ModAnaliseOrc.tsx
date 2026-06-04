'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'

/** Análise Orçamentos & Faturas — port byte-exact V5.7 + Phase 3 (lot IA).
 * Le séparateur « Inserir o texto » analyse le devis/facture collé via l'agent Léa (lea-comptable).
 * Câblage UI → endpoint agent existant, aucun prompt modifié (ai-agents.md). Le PDF reste un placeholder. */

const FEATURES: readonly (readonly [IconName, string, string])[] = [
  ['scale', 'Conformidade jurídica', 'NIF, IVA, Seguro RC, garantia decenal'],
  ['coin', 'Referência de preços de mercado', 'Tarifas 2024-2025 por ofício'],
  ['shield', 'Prevenção de litígios', 'Deteção de riscos jurídicos'],
]

export default function ModAnaliseOrc() {
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [active, setActive] = useState('pdf')
  const [texto, setTexto] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const analisar = () => {
    if (!texto.trim()) return
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = `Analisa este orçamento/fatura de prestador para um condomínio em Portugal. Verifica: (1) conformidade jurídica (NIF, IVA, seguro RC, garantia decenal), (2) referência de preços de mercado 2024-2025 por ofício, (3) riscos de litígio. Apresenta conclusões claras e acionáveis.\n\n---\n${texto}`
      askAgent('lea', message, data.token)
        .then((text) => { setResult(text); push({ kind: 'success', title: 'Análise concluída', desc: 'Resultado pronto para revisão' }) })
        .catch(() => push({ kind: 'error', title: 'Erro na análise', desc: 'A Léa está indisponível, tente novamente' }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: 'Análise IA (demo)', desc: 'Conecte-se como síndico para analisar com a Léa' })
  }

  const canAnalyse = active === 'txt' && !!texto.trim() && !busy

  return (
    <>
      <PageHead title="Análise Orçamentos & Faturas" eyebrow="Conformidade jurídica · Referência de preços · Prevenção de litígios" />
      <div className={m.cardGrid3} style={{ marginBottom: 16 }}>
        {FEATURES.map((c) => (
          <div key={c[1]} className={m.card} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', color: 'var(--v54-navy-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={c[0]} /></div>
            <div><div style={{ fontWeight: 600, marginBottom: 3 }}>{c[1]}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{c[2]}</div></div>
          </div>
        ))}
      </div>
      <Tabs active={active} onChange={setActive} tabs={[
        { id: 'pdf', label: 'Enviar um PDF', icon: 'upload' },
        { id: 'txt', label: 'Inserir o texto', icon: 'pencil' },
        { id: 'seg', label: 'Seguro', icon: 'shield' },
      ]} />
      {active === 'pdf' && (
        <div className={m.dropZone}>
          <div className={m.icoLg}><Icon name="file" /></div>
          <h4>Arraste o seu PDF aqui</h4>
          <p>ou clique para selecionar um ficheiro</p>
          <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Análise de PDF', desc: 'Use o separador « Inserir o texto » para análise imediata pela Léa' })}><Icon name="upload" />Escolher um PDF</Button>
          <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 14 }}>Orçamento, fatura, nota de encomenda — máx 20 MB</div>
        </div>
      )}
      {active === 'txt' && (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} placeholder="Cole aqui o texto do orçamento ou fatura a analisar…" style={{ width: '100%', padding: 12, border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: 'var(--v54-ink)', resize: 'vertical' }} />
      )}
      {active === 'seg' && (
        <Panel>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', lineHeight: 1.6 }}>Verificação do seguro de responsabilidade civil do prestador e da garantia decenal. Cole a apólice ou os respetivos dados no separador « Inserir o texto » para análise pela Léa.</div>
        </Panel>
      )}
      <Button onClick={analisar} disabled={!canAnalyse} style={{ width: '100%', marginTop: 16, padding: 14, opacity: canAnalyse ? 1 : 0.5, justifyContent: 'center' }}><Icon name="search" />{busy ? 'A analisar…' : 'Analisar o documento'}</Button>
      {(busy || result) && (
        <Panel title="Resultado da análise">
          {busy ? (
            <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', padding: 8 }}>A Léa está a analisar o documento…</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)', padding: 4 }}>{result}</div>
          )}
        </Panel>
      )}
    </>
  )
}
