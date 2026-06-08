'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Ocorrências — Classificador IA (Alfredo). Texte libre → classification Groq
 * (catégorie, priorité, localisation, résumé, suggestion). Anonyme = preview byte-exact. */

interface Classificacao { categoria?: string; prioridade?: string; localizacao?: string; resumo?: string; sugestao?: string }
const prioKind = (p?: string): PillKind => (p === 'urgente' ? 'rust' : p === 'alta' ? 'amber' : p === 'baixa' ? 'sage' : 'gold')

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const resLabel = { fontSize: 10.5, fontWeight: 600, color: 'var(--v54-navy-300)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 } as const

export default function ModOcClassif() {
  const soon = useComingSoon()
  const { push } = useToast()
  const data = useSyndicData()
  const real = data.authenticated
  const [edificio, setEdificio] = useState('')
  const [descricao, setDescricao] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Classificacao | null>(null)

  const analisar = () => {
    if (descricao.trim().length < 8) { push({ kind: 'info', title: 'Descrição', desc: 'Escreva a descrição do problema (mín. 8 caracteres).' }); return }
    if (!real || !data.token) { push({ kind: 'info', title: 'Classificador IA', desc: 'Conecte-se como síndico para usar o Alfredo.' }); return }
    setBusy(true)
    fetch('/api/syndic/oc-classif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ edificio, descricao, locale: 'pt' }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setResult((d.classificacao as Classificacao) || {}))
      .catch(() => push({ kind: 'error', title: 'Erro', desc: 'Não foi possível classificar. Tente novamente.' }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead title="Ocorrências — Classificador IA" lede="Envie texto e/ou foto — a IA categoriza, prioriza, localiza e cria a ocorrência automaticamente" />
      <div className={m.cardGrid}>
        <Panel>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-ed" style={fieldLabel}>Edifício</label><select id="oc-ed" aria-label="Edifício" style={fieldCtrl} value={edificio} onChange={(e) => setEdificio(e.target.value)}><option value="">Selecione um edifício…</option>{real && (data.immeubles ?? []).map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}</select></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-desc" style={fieldLabel}>Descrição do problema (texto livre, como uma mensagem WhatsApp)</label><textarea id="oc-desc" rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Está a chover dentro do elevador do 3.° andar, parece uma fuga no telhado…" style={fieldCtrl} /></div>
          <Button onClick={soon('Adicionar foto')}><Icon name="image" />Adicionar Foto</Button>
          <Button variant="primary" style={{ width: '100%', marginTop: 14, padding: 14, justifyContent: 'center' }} disabled={busy} onClick={analisar}><Icon name="sparkle" />{busy ? 'A analisar…' : 'Analisar e Classificar'}</Button>
        </Panel>
        <Panel>
          {result ? (
            <div style={{ padding: '6px 4px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Pill kind="gold" noDot>{result.categoria || '—'}</Pill>
                <Pill kind={prioKind(result.prioridade)} noDot>Prioridade: {result.prioridade || '—'}</Pill>
              </div>
              {([['Localização', result.localizacao], ['Resumo', result.resumo], ['Sugestão da Alfredo', result.sugestao]] as const).map(([lbl, val]) => (
                <div key={lbl} style={{ marginBottom: 12 }}>
                  <div style={resLabel}>{lbl}</div>
                  <div style={{ fontSize: 13, color: 'var(--v54-ink)', lineHeight: 1.5 }}>{val || '—'}</div>
                </div>
              ))}
              <Button variant="primary" style={{ marginTop: 6 }} onClick={() => push({ kind: 'info', title: 'Criar ocorrência', desc: 'Registo da ocorrência a partir da classificação — em breve.' })}><Icon name="plus" />Criar ocorrência</Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="bot" style={{ width: 54, height: 54 }} /></div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 8 }}>Escreva a descrição do problema</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginBottom: 20 }}>A IA irá categorizar, priorizar e localizar automaticamente</div>
              <div style={{ textAlign: 'left', background: 'var(--v54-gold-50)', padding: 18, borderRadius: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--v54-gold-700)' }}>Exemplos:</div>
                <div style={{ color: 'var(--v54-navy-500)', lineHeight: 1.8 }}>
                  &quot;Fuga de água no 2.° andar, está a pingar para o 1.°&quot;<br />
                  &quot;Elevador avariado desde ontem, faz barulho estranho&quot;<br />
                  &quot;Lâmpada fundida na escadaria entre o 3.° e 4.° andar&quot;
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
