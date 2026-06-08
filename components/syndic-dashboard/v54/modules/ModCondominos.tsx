'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useToast } from '../primitives/toast'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/**
 * Condóminos & Inquilinos — port byte-exact du ModCondominos du bundle V5.7.
 * Le bloc conditionnel `InquilinosSection` (window.Sections7) du bundle rend
 * null quand la section n'est pas chargée : on porte donc le corps principal.
 */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const selectStyle = { padding: '10px 14px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13, background: '#fff' } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

export default function ModCondominos() {
  const soon = useComingSoon()
  // Phase 2 : vrais condóminos du cabinet si syndic connecté, sinon mock/vide (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const coproprios = data.coproprios ?? []
  const ocupados = coproprios.filter((c) => c.ocupado).length
  const { push } = useToast()
  const exportCsv = () => {
    if (!real || coproprios.length === 0) {
      push({ kind: 'info', title: 'Exportar CSV', desc: real ? 'Nenhum condómino para exportar.' : 'Conecte-se como síndico para exportar.' })
      return
    }
    downloadCsv(
      'condominos.csv',
      ['Fração', 'Bloco', 'Andar', 'Porta', 'Proprietário', 'Email', 'Telefone', 'Permilagem', 'Ocupação', 'Saldo (€)'],
      coproprios.map((c) => [c.immeuble, c.batiment, c.etage, c.numeroPorte, c.proprietario, c.email, c.telefone, c.tantieme ?? '', c.ocupado ? 'Ocupado' : 'Vago', c.solde ?? '']),
    )
  }
  return (
    <>
      <PageHead
        title="Condóminos & Inquilinos"
        lede="Proprietários · Arrendatários · Frações · Permilagens"
        actions={<>
          <Button onClick={soon('Importar Gecond', 'Importação Gecond em desenvolvimento')}><Icon name="upload" />Import Gecond</Button>
          <Button onClick={exportCsv}><Icon name="download" />Export CSV</Button>
          <Button variant="gold" onClick={soon('Adicionar condómino', 'Criação de condóminos em desenvolvimento')}><Icon name="plus" />Adicionar</Button>
        </>}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar condómino" style={inputStyle} placeholder="Pesquisar por nome, fração…" />
        </div>
        <select aria-label="Filtrar por condomínio" style={selectStyle}><option>Todos os condomínios</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'grid', num: real ? coproprios.length : 0, lbl: 'Frações total', sub: 'No portefólio', accent: 'gold' },
        { icon: 'check', num: real ? ocupados : 0, lbl: 'Ocupados', sub: 'Por condóminos', accent: 'sage' },
        { icon: 'building', num: real ? coproprios.length - ocupados : 0, lbl: 'Vagos', sub: 'Sem ocupante', accent: 'amber' },
      ]} />
      <Tabs defaultActive="prop" tabs={[
        { id: 'prop', icon: 'users', label: 'Proprietários' },
        { id: 'inq', icon: 'home', label: 'Inquilinos' },
        { id: 'frac', icon: 'grid', label: 'Frações' },
      ]} />
      <Panel flush={real && coproprios.length > 0}>
        {real && coproprios.length > 0 ? (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Fração</th><th>Proprietário</th><th>Contacto</th><th>Ocupação</th></tr></thead>
              <tbody>
                {coproprios.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.immeuble || '—'}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{[c.batiment, c.etage ? `${c.etage}.º` : '', c.numeroPorte].filter(Boolean).join(' · ')}</div></td>
                    <td>{c.proprietario || '—'}</td>
                    <td className={m.mono} style={{ fontSize: 11.5 }}>{c.email || c.telefone || '—'}</td>
                    <td><Pill kind={c.ocupado ? 'sage' : 'amber'} noDot>{c.ocupado ? 'Ocupado' : 'Vago'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            illustration="condominos"
            title="Nenhum condómino encontrado"
            desc="Adicione condóminos manualmente ou importe-os via Gecond / CSV."
            action={<Button variant="gold" onClick={soon('Adicionar condómino', 'Criação de condóminos em desenvolvimento')}><Icon name="plus" />Adicionar primeiro condómino</Button>}
          />
        )}
      </Panel>
    </>
  )
}
