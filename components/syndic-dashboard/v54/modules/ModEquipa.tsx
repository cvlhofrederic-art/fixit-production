'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill, type PillKind } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { TeamMember } from '@/components/syndic-dashboard/types'

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

type Row = readonly [string, string, string, string, string, string]

/** Rôle DB (clé) → libellé PT affiché (fallback = valeur brute si déjà un libellé). */
const ROLE_LABELS: Record<string, string> = {
  syndic_admin: 'Administrador', admin: 'Administrador',
  syndic_gestionnaire: 'Gestor Técnico', gestionnaire: 'Gestor Técnico', gestor_tecnico: 'Gestor Técnico',
  syndic_tech: 'Técnico', tech: 'Técnico', tecnico: 'Técnico',
  syndic_secretaire: 'Secretária', secretaire: 'Secretária', secretaria: 'Secretária',
  syndic_comptable: 'Contabilista', comptable: 'Contabilista', contabilista: 'Contabilista',
  syndic_juriste: 'Jurista', juriste: 'Jurista', jurista: 'Jurista',
  syndic_gestor_condominio: 'Gestor de Condomínio',
}
const roleLabel = (role: string): string => ROLE_LABELS[role] ?? role

const teamInitials = (name: string): string => {
  const parts = (name || '').split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '—'
}

function memberToRow(member: TeamMember): Row {
  const label = roleLabel(member.role)
  return [
    teamInitials(member.full_name),
    member.full_name || member.email,
    member.email,
    label,
    member.custom_modules ? `${member.custom_modules.length} módulos` : 'Todos os módulos',
    label === 'Administrador' ? 'gold' : 'sage',
  ]
}

export default function ModEquipa() {
  // Phase 2 : vraie équipe du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const items: ReadonlyArray<{ row: Row; id: string | null; active: boolean }> = real
    ? (data.team ?? []).map((mt) => ({ row: memberToRow(mt), id: mt.id, active: mt.is_active }))
    : TEAM.map((r) => ({ row: r, id: null, active: true }))

  // Phase 2 écritures : « Suspender » → PATCH is_active=false ; « Eliminar » → DELETE.
  const { push } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [delTarget, setDelTarget] = useState<{ id: string | null; name: string } | null>(null)
  const [busyDel, setBusyDel] = useState(false)
  const suspend = (id: string | null, name: string) => {
    if (real && data.token && id) {
      setBusyId(id)
      fetch('/api/syndic/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ member_id: id, is_active: false }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Membro suspenso', desc: name }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao suspender', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyId(null))
      return
    }
    push({ kind: 'info', title: 'Membro suspenso (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  const confirmDelete = () => {
    if (real && data.token && delTarget?.id) {
      setBusyDel(true)
      fetch(`/api/syndic/team?member_id=${encodeURIComponent(delTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.token}` },
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); const n = delTarget?.name; setDelTarget(null); push({ kind: 'success', title: 'Membro eliminado', desc: n }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao eliminar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyDel(false))
      return
    }
    setDelTarget(null)
    push({ kind: 'info', title: 'Membro eliminado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  return (
    <>
      <PageHead
        title="A Minha Equipa"
        lede={`${items.length} membros no seu gabinete`}
        actions={<Button variant="gold"><Icon name="plus" />Convidar um membro</Button>}
      />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead>
              <tr><th>Membro</th><th>Função</th><th>Módulos</th><th>Estado</th><th aria-label="Ações" /></tr>
            </thead>
            <tbody>
              {items.map(({ row: member, id, active }) => (
                <tr key={member[2]}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={clsx(m.av, AV_COLOR[member[5]])}>{member[0]}</div>
                      <div><b>{member[1]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{member[2]}</div></div>
                    </div>
                  </td>
                  <td><Pill kind={roleKind(member[3])} noDot>{member[3]}</Pill></td>
                  <td><Pill kind="sage" noDot>{member[4]}</Pill></td>
                  <td>{active
                    ? <><span className={m.dotStatus} /> <span style={{ fontSize: 12.5, color: 'var(--v54-sage-700)' }}>Ativo</span></>
                    : <span style={{ fontSize: 12.5, color: 'var(--v54-rust-700)' }}>Suspenso</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm" disabled={busyId === id} onClick={() => suspend(id, member[1])}>Suspender</Button>
                    <Button size="sm" style={eliminarStyle} onClick={() => setDelTarget({ id, name: member[1] })}>Eliminar</Button>
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

      <Modal open={delTarget != null} onClose={() => setDelTarget(null)} labelledBy="dm-title" size="sm">
        <ModalHead icon="trash" id="dm-title" title="Eliminar membro" onClose={() => setDelTarget(null)} />
        <ModalBody>
          <p style={{ fontSize: 13.5, color: 'var(--v54-navy-500)', lineHeight: 1.5, margin: 0 }}>
            Tem a certeza que pretende eliminar <b>{delTarget?.name}</b> da sua equipa? Esta ação é irreversível.
          </p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setDelTarget(null)}>Cancelar</Button>
          <button type="button" onClick={confirmDelete} disabled={busyDel} className={btnCss.btn} style={{ color: 'var(--v54-rust-700)', borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' }}>Eliminar</button>
        </ModalFoot>
      </Modal>
    </>
  )
}
