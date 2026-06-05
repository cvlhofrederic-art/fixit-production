'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Assinatura Digital CMD — port byte-exact du ModAssinaturaCMD du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const

export default function ModAssinaturaCMD() {
  return (
    <>
      <PageHead title="Assinatura Digital CMD" lede="Chave Móvel Digital — Assinatura qualificada de documentos do condomínio" />
      <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginBottom: 14 }}>Conforme DL 12/2021 (assinatura digital qualificada PT) e Regulamento eIDAS (UE 910/2014). A assinatura via Chave Móvel Digital tem o mesmo valor legal que a assinatura manuscrita.</div>
      <KPIGrid items={[
        { num: 5, lbl: 'Total Documentos Assinados' },
        { num: 1, lbl: 'Pendentes', accent: 'amber' },
        { num: 4, lbl: 'Este Mês', accent: 'sage' },
        { icon: 'doc', num: '22 de maio de 2026', numStyle: { fontSize: 22 }, lbl: 'Último Documento' },
      ]} />
      <Tabs defaultActive="ass" tabs={[
        { id: 'ass', icon: 'pencil', label: 'Assinar Documento' },
        { id: 'docs', icon: 'doc', label: 'Documentos Assinados' },
        { id: 'val', icon: 'search', label: 'Validação' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <Panel title="Assinar Novo Documento">
        <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 14 }}>Carregue o documento que pretende assinar digitalmente com a Chave Móvel Digital.</div>
        <div className={m.cardGrid}>
          <div><label htmlFor="cmd-nome" style={fieldLabel}>Nome do Documento</label><input id="cmd-nome" style={fieldCtrl} placeholder="Ex: Ata AG Ordinária - Março 2026" /></div>
          <div><label htmlFor="cmd-tipo" style={fieldLabel}>Tipo de Documento</label><select id="cmd-tipo" style={fieldCtrl}><option>Ata de Assembleia</option></select></div>
        </div>
        <div style={{ marginTop: 14 }}><label htmlFor="cmd-edificio" style={fieldLabel}>Edifício</label><select id="cmd-edificio" style={fieldCtrl}><option>— Selecionar edifício —</option></select></div>
        <div className={m.dropZone} style={{ marginTop: 14 }}>
          <div className={m.icoLg}><Icon name="file" /></div>
          <h4>Clique ou arraste o ficheiro aqui</h4>
          <p>Formatos suportados: PDF, DOC, DOCX (máx. 10 MB)</p>
        </div>
      </Panel>
    </>
  )
}
