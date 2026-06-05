'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'

/** Atas com IA — port byte-exact V5.7 + Phase 3 (lot IA) : génère l'ata d'assemblée via l'agent Alfredo
 *  à partir des points/notes collés. Câblage UI → endpoint existant, aucun prompt modifié (ai-agents.md). */

const textareaStyle = { width: '100%', padding: 12, border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: 'var(--v54-ink)', resize: 'vertical' } as const

export default function ModAtasIA() {
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [mode, setMode] = useState<'cta' | 'form'>('cta')
  const [notas, setNotas] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const gerar = () => {
    if (!notas.trim()) return
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = `Gera uma ata de assembleia de condóminos em português de Portugal, bem estruturada (cabeçalho com data e local, presenças e quórum, ordem de trabalhos, deliberações e votações por ponto, encerramento), a partir destes pontos/notas:\n\n${notas}`
      askAgent('alfredo', message, data.token)
        .then((text) => { setResult(text); push({ kind: 'success', title: 'Ata gerada', desc: 'Pronta para revisão' }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao gerar', desc: 'O Alfredo está indisponível, tente novamente' }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: 'Geração de ata (demo)', desc: 'Conecte-se como síndico para gerar com o Alfredo' })
  }

  return (
    <>
      <PageHead
        title="Atas com IA — Atas de Assembleia"
        actions={<Button variant="gold" onClick={() => setMode('form')}><Icon name="plus" />+ Nova Ata</Button>}
      />
      <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', marginBottom: 14 }}>Geração inteligente de atas de assembleia de condóminos</div>
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'pencil', label: 'Gerar Ata' },
        { id: 'atas', icon: 'book', label: 'Atas Geradas' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
      ]} />
      <Panel>
        {mode === 'cta' ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="pencil" style={{ width: 54, height: 54 }} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 6 }}>Gerar uma nova ata</div>
            <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>Utilize o assistente passo a passo para criar uma ata de assembleia completa, ou comece a partir de um modelo.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => setMode('form')}><Icon name="sparkle" />Começar do zero</Button>
              <Button onClick={() => push({ kind: 'info', title: 'Modelos', desc: 'Em breve — comece do zero entretanto' })}>Ver modelos</Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 4 }}>
            <label htmlFor="atas-notas" style={{ fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Ordem de trabalhos / notas da reunião</label>
            <textarea id="atas-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={8} placeholder={'Ex.:\n1. Aprovação das contas 2025\n2. Orçamento 2026 (votado, 720/1000 milésimos a favor)\n3. Obras de reabilitação da fachada\n4. Assuntos diversos'} style={textareaStyle} />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <Button variant="primary" onClick={gerar} disabled={!notas.trim() || busy}><Icon name="sparkle" />{busy ? 'A gerar…' : 'Gerar ata com IA'}</Button>
              <Button onClick={() => { setMode('cta'); setResult('') }}>Cancelar</Button>
            </div>
            {(busy || result) && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--v54-line)', paddingTop: 16 }}>
                {busy ? (
                  <div style={{ fontSize: 13, color: 'var(--v54-navy-300)' }}>O Alfredo está a redigir a ata…</div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)' }}>{result}</div>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  )
}
