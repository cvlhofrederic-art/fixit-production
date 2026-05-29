'use client'

import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Análise Orçamentos & Faturas — port byte-exact du ModAnaliseOrc du bundle V5.7. */

const FEATURES: readonly (readonly [IconName, string, string])[] = [
  ['scale', 'Conformidade jurídica', 'NIF, IVA, Seguro RC, garantia decenal'],
  ['coin', 'Referência de preços de mercado', 'Tarifas 2024-2025 por ofício'],
  ['shield', 'Prevenção de litígios', 'Deteção de riscos jurídicos'],
]

export default function ModAnaliseOrc() {
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
      <Tabs defaultActive="pdf" tabs={[
        { id: 'pdf', label: 'Enviar um PDF', icon: 'upload' },
        { id: 'txt', label: 'Inserir o texto', icon: 'pencil' },
        { id: 'seg', label: 'Seguro', icon: 'shield' },
      ]} />
      <div className={m.dropZone}>
        <div className={m.icoLg}><Icon name="file" /></div>
        <h4>Arraste o seu PDF aqui</h4>
        <p>ou clique para selecionar um ficheiro</p>
        <Button variant="gold"><Icon name="upload" />Escolher um PDF</Button>
        <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 14 }}>Orçamento, fatura, nota de encomenda — máx 20 MB</div>
      </div>
      <Button disabled style={{ width: '100%', marginTop: 16, padding: 14, opacity: 0.5, justifyContent: 'center' }}><Icon name="search" />Analisar o documento</Button>
    </>
  )
}
