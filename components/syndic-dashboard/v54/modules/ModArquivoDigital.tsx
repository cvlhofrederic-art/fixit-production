'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import { KPIGrid } from '../primitives/kpi'
import { Alert } from '../primitives/alert'
import { Empty } from '../primitives/empty'
import { SectionDivider } from '../primitives/section-divider'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'

/** Arquivo Digital Certificado — port byte-exact du ModArquivoDigital du bundle V5.7
 * (assets L37698-37748) + sa sous-section ProjetoAprovSection (L39767-39795, co-localisée).
 * Statique. Tokens inline remappés --* → --v54-*. Tables via modules.module.css. */

type ArqDoc = { nome: string; data: string; tam: string; imovel: string; hash: string }
type ArqCat = { nome: string; count: number; docs: ArqDoc[] | null }

const CATEGORIAS: ArqCat[] = [
  {
    nome: 'Atas', count: 2, docs: [
      { nome: 'Ata AG Ordinária 2025.pdf', data: '2025-03-15', tam: '245 KB', imovel: 'Edifício Aurora', hash: '2e36304434cc...' },
      { nome: 'Ata AG Extraordinária Obras.pdf', data: '2025-01-20', tam: '189 KB', imovel: 'Edifício Aurora', hash: '3405a65293a4...' },
    ],
  },
  { nome: 'Convocatórias', count: 1, docs: null },
  { nome: 'Regulamentos', count: 1, docs: null },
  { nome: 'Orçamentos', count: 1, docs: null },
]

/** Sous-section « Projeto Aprovado & Licenças » (DL 268/94). */
function ProjetoAprovSection() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        eyebrow="OBRIGAÇÃO LEGAL · DL 268/94 ART. 2.°"
        title="Arquivo Projeto Aprovado & Licenças"
        lede="Cópias autenticadas · Projeto aprovado Câmara · Alvará · Licença utilização · Audit trail imutável"
        actions={<Button variant="gold" onClick={soon('Upload documento autenticado', 'Depósito de documentos em desenvolvimento')}><Icon name="upload" />Upload documento autenticado</Button>}
      />
      <Alert kind="gold" icon="scale" title="DL 268/94 art. 2.° — Documentos obrigatórios">
        Devem ficar depositadas à guarda do administrador as cópias autenticadas dos documentos utilizados para instruir o processo de constituição da propriedade horizontal, designadamente o projeto aprovado pela entidade pública competente.
      </Alert>
      <KPIGrid items={[
        { icon: 'archive', num: 0, lbl: 'Documentos autenticados' },
        { icon: 'building', num: 0, lbl: 'Edifícios cobertos', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Audit trail verificado', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Edifícios sem documentação', accent: 'rust' },
      ]} />
      <Tabs defaultActive="todos" tabs={[
        { id: 'todos', label: 'Todos' },
        { id: 'proj', label: 'Projeto Aprovado' },
        { id: 'alv', label: 'Alvará' },
        { id: 'lic', label: 'Licença Utilização' },
        { id: 'imi', label: 'Caderneta Predial IMI' },
        { id: 'audit', label: 'Audit Trail' },
      ]} />
      <Panel>
        <Empty
          illustration="documentos"
          title="Arquivo vazio"
          desc="Os documentos depositados aqui são imutáveis. Cada acesso, upload ou substituição fica registado no audit trail."
          action={<Button variant="primary" onClick={soon('Depositar documento', 'Depósito de documentos em desenvolvimento')}><Icon name="upload" />Depositar primeiro documento</Button>}
        />
      </Panel>
    </>
  )
}

export default function ModArquivoDigital() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead title="Arquivo Digital Certificado" lede="Arquivo eletrónico com integridade garantida por hash SHA-256 · Pesquisa avançada · Retenção legal · Projeto aprovado & licenças" />
      <Tabs defaultActive="arq" tabs={[
        { id: 'arq', icon: 'archive', label: 'Arquivo' },
        { id: 'pesq', icon: 'search', label: 'Pesquisa' },
        { id: 'cert', icon: 'lock', label: 'Certificação' },
        { id: 'proj', icon: 'stamp', label: 'Projeto Aprovado & Licenças' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <KPIGrid items={[
        { icon: 'doc', num: 12, lbl: 'Total documentos' },
        { icon: 'folder', num: 9, lbl: 'Categorias', accent: 'gold' },
        { icon: 'archive', num: '2.5 MB', lbl: 'Armazenamento', accent: 'sage' },
        { icon: 'calendar', num: '2025-02-10', lbl: 'Último upload' },
      ]} />
      <Panel title="Árvore de documentos" right={<Button variant="gold" onClick={soon('Carregar documento', 'Carregamento de documentos em desenvolvimento')}><Icon name="plus" />+ Carregar documento</Button>} flush>
        {CATEGORIAS.map((cat, i) => (
          <div key={i} style={{ borderBottom: i < 3 ? '1px solid var(--v54-line)' : 'none' }}>
            <div style={{ padding: '14px 22px', background: cat.docs ? 'var(--v54-gold-50)' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><b>{cat.nome}</b><Pill noDot>{cat.count}</Pill></div>
              <span style={{ color: 'var(--v54-navy-300)' }}>{cat.docs ? '▼' : '▶'}</span>
            </div>
            {cat.docs && (
              <div className={m.tblWrap}>
                <table className={m.tbl} style={{ background: 'var(--v54-paper)' }}>
                  <thead><tr><th>Nome</th><th>Data</th><th>Tamanho</th><th>Imóvel</th><th>Hash</th><th>Ações</th></tr></thead>
                  <tbody>{cat.docs.map((d, j) => (
                    <tr key={j}>
                      <td>{d.nome}</td>
                      <td className={m.numCell}>{d.data}</td>
                      <td className={m.numCell}>{d.tam}</td>
                      <td>{d.imovel}</td>
                      <td className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{d.hash}</td>
                      <td>
                        <Button size="sm" variant="ghost" aria-label="Ver fatura" title="Ver" onClick={soon('Ver documento', 'Visualização de documentos em desenvolvimento')}><Icon name="eye" /></Button>{' '}
                        <Button size="sm" variant="ghost" aria-label="Descarregar" title="Descarregar" onClick={soon('Descarregar documento', 'Descarregamento em desenvolvimento')}><Icon name="download" /></Button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </Panel>
      <SectionDivider eyebrow="OBRIGAÇÃO LEGAL · DL 268/94 ART. 2.°" title="Projeto Aprovado & Licenças" sub="Cópias autenticadas · Projeto aprovado Câmara · Alvará · Licença utilização · Audit trail imutável" />
      <ProjetoAprovSection />
    </>
  )
}
