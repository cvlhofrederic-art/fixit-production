'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'

/** Quadro de Avisos — port byte-exact du ModQuadroAvisos du bundle V5.7. */

type Aviso = { fixado: string; categoria: string; prioridade: string; expirado: string; titulo: string; desc: string; edificio: string; views: number; color: string; data: string }
const AVISOS: Aviso[] = [
  { fixado: 'Fixado', categoria: 'Manutenção', prioridade: 'Urgente', expirado: 'Expirado', titulo: 'Corte de água — Manutenção urgente da canalização', desc: 'Informamos que haverá corte de água no dia 15 de março, das 09h às 14h, para reparação urgente de uma fuga na canalização principal do edifício', edificio: 'Edifício Aurora', views: 47, color: 'rust', data: '11/03/26' },
  { fixado: 'Fixado', categoria: 'Assembleia', prioridade: 'Importante', expirado: 'Expirado', titulo: 'Convocatória — Assembleia Geral Ordinária 2026', desc: 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que se realizará no dia 28 de março de 2026, às 19h00', edificio: 'Edifício Aurora', views: 38, color: 'gold', data: '08/03/26' },
  { fixado: '', categoria: 'Manutenção', prioridade: 'Urgente', expirado: '', titulo: 'Elevador fora de serviço — Reparação em curso', desc: 'O elevador do Edifício Solaris encontra-se fora de serviço desde hoje. A empresa de manutenção foi contactada e a reparação está prevista para os próximos 2 dias úteis', edificio: 'Edifício Solaris', views: 62, color: 'amber', data: '10/03/26' },
  { fixado: '', categoria: 'Financeiro', prioridade: 'Importante', expirado: '', titulo: 'Renovação do Seguro Multirriscos', desc: 'Informamos que o seguro multirriscos do condomínio foi renovado com a Fidelidade Seguros, com efeito a partir de 1 de abril', edificio: '—', views: 25, color: 'sage', data: '07/03/26' },
  { fixado: '', categoria: 'Manutenção', prioridade: '', expirado: '', titulo: 'Horário de limpeza das áreas comuns', desc: 'A partir de 1 de abril, o horário de limpeza das áreas comuns será alterado para as manhãs (08h-11h) em vez do período da tarde', edificio: '—', views: 19, color: '', data: '06/03/26' },
  { fixado: '', categoria: 'Manutenção', prioridade: '', expirado: '', titulo: 'Manutenção do jardim — Primavera 2026', desc: 'Iniciamos esta semana os trabalhos de manutenção do jardim e espaços verdes. Serão realizados podas, plantação de novas flores', edificio: 'Edifício Atlântico', views: 14, color: '', data: '05/03/26' },
  { fixado: '', categoria: 'Segurança', prioridade: '', expirado: '', titulo: 'Regras de segurança — Portas de acesso', desc: 'Relembramos todos os condóminos da importância de manter as portas de acesso ao edifício sempre fechadas. Não abram a porta a pessoas desconhecidas', edificio: '—', views: 31, color: '', data: '04/03/26' },
  { fixado: '', categoria: 'Social', prioridade: 'Expirado', expirado: '', titulo: 'Festa de Vizinhos — 20 de março', desc: 'Convidamos todos os moradores para a Festa de Vizinhos que se realizará no dia 20 de março, às 18h30, no terraço do Edifício Aurora', edificio: 'Edifício Aurora', views: 42, color: 'sage', data: '03/03/26' },
]
const COR: Record<string, string> = { rust: 'var(--v54-rust-500)', amber: 'var(--v54-amber-500)', gold: 'var(--v54-gold-500)', sage: 'var(--v54-sage-500)' }
const avisoCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: '18px 20px', marginBottom: 12 } as const
const fieldInput = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const prioKind = (p: string): PillKind | undefined => (p === 'Urgente' ? 'rust' : p === 'Importante' ? 'gold' : undefined)
const RESUMO: [IconName, number, string][] = [['clipboard', 8, 'Avisos ativos'], ['calendar', 0, 'Avisos este mês'], ['eye', 62, 'Elevador fora de serviço — Rep…']]
const DISTRIB: [string, number][] = [['Manutenção', 4], ['Assembleia', 1], ['Financeiro', 1], ['Segurança', 1], ['Social', 1], ['Outro', 0]]
const ACOES: [IconName, string][] = [['siren', 'Aviso Urgente'], ['bank', 'Convocatória AG'], ['coin', 'Aviso Financeiro']]

export default function ModQuadroAvisos() {
  return (
    <>
      <PageHead title="Quadro de Avisos" lede="Comunique com os condóminos de forma clara e organizada"
        actions={<Button variant="gold"><Icon name="plus" />Novo Aviso</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}><Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} /><input aria-label="Pesquisar avisos" style={fieldInput} placeholder="Pesquisar avisos…" /></div>
        <select className={btnCss.btn} aria-label="Estado"><option>Ativos</option></select>
        <select className={btnCss.btn} aria-label="Categoria"><option>Todas as categorias</option></select>
        <select className={btnCss.btn} aria-label="Prioridade"><option>Todas as prioridades</option></select>
        <select className={btnCss.btn} aria-label="Imóvel"><option>Todos os imóveis</option></select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {AVISOS.map((a, i) => (
            <div key={i} style={{ ...avisoCard, borderLeft: `3px solid ${COR[a.color] || 'var(--v54-navy-300)'}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {a.fixado && <Pill kind="gold" noDot>{a.fixado}</Pill>}
                <Pill noDot>{a.categoria}</Pill>
                {a.prioridade && <Pill kind={prioKind(a.prioridade)} noDot>{a.prioridade}</Pill>}
                {a.expirado && <Pill noDot>{a.expirado}</Pill>}
              </div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 6 }}>{a.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{a.desc}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--v54-navy-300)' }}>
                <span>{a.edificio === '—' ? 'Administração' : 'Gestor'}</span><span>{a.data}</span><span>{a.edificio}</span><span>{a.views}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <Panel title="Resumo">
            {RESUMO.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--v54-line)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={s[0]} /></div>
                <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20 }}>{s[1]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{s[2]}</div></div>
              </div>
            ))}
          </Panel>
          <Panel title="Distribuição por Categoria">
            {DISTRIB.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: i < 5 ? '1px solid var(--v54-line)' : 'none' }}>
                <span>{c[0]}</span><b>{c[1]}</b>
              </div>
            ))}
          </Panel>
          <Panel title="Ações Rápidas">
            {ACOES.map((q, i) => (
              <Button key={i} style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, padding: '10px 14px', background: 'var(--v54-cream)' }}><Icon name={q[0]} /> <span>{q[1]}</span></Button>
            ))}
          </Panel>
        </div>
      </div>
    </>
  )
}
