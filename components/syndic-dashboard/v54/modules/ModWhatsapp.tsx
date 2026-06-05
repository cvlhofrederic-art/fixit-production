'use client'

import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'

/** Comunicação com Condóminos (WhatsApp/SMS) — port byte-exact du ModWhatsapp du bundle V5.7. */

type Cond = { nome: string; fracao: string; msg: string; estado: string; kind: PillKind }
const CONDS: Cond[] = [
  { nome: 'Ana Silva', fracao: 'Fração A - 1.º Esq', msg: 'Obrigada, já procedi ao pagamento…', estado: 'Em dia', kind: 'sage' },
  { nome: 'Carlos Santos', fracao: 'Fração B - 1.º Dto', msg: 'Sr. Carlos, a quota de fevereiro encontra-se…', estado: 'Atrasado', kind: 'rust' },
  { nome: 'Maria Costa', fracao: 'Fração C - 2.º Esq', msg: 'CONDOMINIO AURORA: Aviso manutenção…', estado: 'Em dia', kind: 'sage' },
  { nome: 'Pedro Ferreira', fracao: 'Fração D - 2.º Dto', msg: 'Exmo. Sr. Ferreira, serve a presente par…', estado: 'Em divida', kind: 'rust' },
  { nome: 'Sofia Oliveira', fracao: 'Fração A - R/C', msg: 'Convocatória: Assembleia Geral Ordinária', estado: 'Em dia', kind: 'sage' },
]

export default function ModWhatsapp() {
  return (
    <>
      <PageHead title="Comunicação com Condóminos" lede="WhatsApp, SMS e Email — mensagens, modelos e envios em massa" />
      <Tabs defaultActive="msg" tabs={[
        { id: 'msg', icon: 'chat', label: 'Mensagens' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
        { id: 'env', icon: 'mail', label: 'Envio em Massa' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, minHeight: 560 }}>
        <Panel flush>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', marginBottom: 8 }}>Condóminos</div>
            <select className={btnCss.btn} style={{ width: '100%' }} aria-label="Filtrar canal"><option>Todos os canais</option></select>
          </div>
          {CONDS.map((c, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--v54-line)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><b>{c.nome}</b><Pill kind={c.kind} noDot>{c.estado}</Pill></div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{c.fracao}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.msg}</div>
            </div>
          ))}
        </Panel>
        <Panel flush>
          <div style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 480 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', marginBottom: 18, color: 'var(--v54-gold-700)' }}><Icon name="chat" style={{ width: 32, height: 32 }} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 6 }}>Selecione um condómino para ver as mensagens</div>
          </div>
        </Panel>
      </div>
    </>
  )
}
