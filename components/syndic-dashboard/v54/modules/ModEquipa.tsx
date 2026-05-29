'use client'

import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill, type PillKind } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** A Minha Equipa — port byte-exact du ModEquipa du bundle V5.7 (table + avatars). */

const TEAM = [
  ['HC', 'Helena Carvalho', 'admin@gabinete-vitfix.pt', 'Administrador', '97/86', 'gold'],
  ['BT', 'Bruno Tavares', 'bruno.tavares@gabinete-vitfix.pt', 'Gestor Técnico', '55/86', 'sage'],
  ['DP', 'Diogo Pereira', 'diogo.pereira@gabinete-vitfix.pt', 'Técnico', '15/86', 'sage'],
  ['TM', 'Tiago Mendes', 'tiago.mendes@gabinete-vitfix.pt', 'Técnico', '15/86', 'sage'],
  ['MS', 'Margarida Sousa', 'secretaria@gabinete-vitfix.pt', 'Secretária', '41/86', 'sage'],
  ['RA', 'Ricardo Almeida', 'contabilidade@gabinete-vitfix.pt', 'Contabilista', '49/86', 'sage'],
  ['IM', 'Inês Monteiro', 'juridico@gabinete-vitfix.pt', 'Jurista', '32/86', 'sage'],
] as const

const ROLES: readonly (readonly [string, IconName, string])[] = [
  ['Administrador', 'crown', 'Acesso total: gestão, configuração, equipa, faturação'],
  ['Gestor Técnico', 'wrench', 'Missões, profissionais, planeamento, contabilidade técnica das intervenções'],
  ['Técnico', 'wrench', 'Prestador interno do gabinete (homem dos sete ofícios) — executa reparações correntes, pequenas intervenções e manutenção no terreno'],
  ['Secretária', 'doc', 'Condóminos, planeamento, e-mails, documentos'],
  ['Gestor de Condomínio', 'building', 'Edifícios, missões, profissionais, alertas, calendário regulamentar'],
  ['Contabilista', 'coin', 'Faturação, relatório mensal, documentos financeiros'],
  ['Jurista', 'scale', 'Contencioso, recuperação de dívidas, sinistros, conformidade jurídica, AG'],
]

const AV_COLOR: Record<string, string | undefined> = { gold: m.avGold, sage: m.avSage }

const roleKind = (role: string): PillKind | undefined => {
  if (role === 'Administrador') return 'gold'
  if (role === 'Jurista') return 'amber'
  if (role === 'Contabilista') return 'sage'
  return undefined
}

const eliminarStyle = { color: 'var(--v54-rust-700)', marginLeft: 6, borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' } as const

export default function ModEquipa() {
  return (
    <>
      <PageHead
        title="A Minha Equipa"
        lede={`${TEAM.length} membros no seu gabinete`}
        actions={<Button variant="gold"><Icon name="plus" />Convidar um membro</Button>}
      />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead>
              <tr><th>Membro</th><th>Função</th><th>Módulos</th><th>Estado</th><th aria-label="Ações" /></tr>
            </thead>
            <tbody>
              {TEAM.map((member) => (
                <tr key={member[2]}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={clsx(m.av, AV_COLOR[member[5]])}>{member[0]}</div>
                      <div><b>{member[1]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{member[2]}</div></div>
                    </div>
                  </td>
                  <td><Pill kind={roleKind(member[3])} noDot>{member[3]}</Pill></td>
                  <td><Pill kind="sage" noDot>{member[4]}</Pill></td>
                  <td><span className={m.dotStatus} /> <span style={{ fontSize: 12.5, color: 'var(--v54-sage-700)' }}>Ativo</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm">Suspender</Button>
                    <Button size="sm" style={eliminarStyle}>Eliminar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Descrição das funções" sub="Cada função desbloqueia um conjunto específico de módulos">
        <div className={m.cardGrid}>
          {ROLES.map((r) => (
            <div key={r[0]} style={{ padding: '16px 18px', border: '1px solid var(--v54-line)', borderRadius: 12, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--v54-gold-50)', color: 'var(--v54-gold-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={r[1]} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r[0]}</div><div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{r[2]}</div></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
