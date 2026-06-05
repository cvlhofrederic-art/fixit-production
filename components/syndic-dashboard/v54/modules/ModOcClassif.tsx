'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Ocorrências — Classificador IA — port byte-exact du ModOcClassif du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

export default function ModOcClassif() {
  return (
    <>
      <PageHead title="Ocorrências — Classificador IA" lede="Envie texto e/ou foto — a IA categoriza, prioriza, localiza e cria a ocorrência automaticamente" />
      <div className={m.cardGrid}>
        <Panel>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-ed" style={fieldLabel}>Edifício</label><select id="oc-ed" style={fieldCtrl}><option>Selecione um edifício…</option></select></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-desc" style={fieldLabel}>Descrição do problema (texto livre, como uma mensagem WhatsApp)</label><textarea id="oc-desc" rows={6} placeholder="Ex: Está a chover dentro do elevador do 3.° andar, parece uma fuga no telhado…" style={fieldCtrl} /></div>
          <Button><Icon name="image" />Adicionar Foto</Button>
          <Button variant="primary" style={{ width: '100%', marginTop: 14, padding: 14, justifyContent: 'center' }}><Icon name="sparkle" />Analisar e Classificar</Button>
        </Panel>
        <Panel>
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
        </Panel>
      </div>
    </>
  )
}
