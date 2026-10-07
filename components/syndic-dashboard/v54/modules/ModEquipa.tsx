'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill, type PillKind } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { TeamMember } from '@/components/syndic-dashboard/types'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { EQUIPA_MESSAGES, type RoleEquipe } from './i18n/ModEquipa.messages'

/** A Minha Equipa — port byte-exact du ModEquipa du bundle V5.7 (table + avatars). */

type Textes = (typeof EQUIPA_MESSAGES)['pt-PT']

/** Fonctions décrites dans le panneau « Descrição das funções » (ordre d'affichage + icône). */
const ROLES: readonly (readonly [RoleEquipe, IconName])[] = [
  ['admin', 'crown'],
  ['gestorTecnico', 'wrench'],
  ['tecnico', 'wrench'],
  ['secretaria', 'doc'],
  ['gestorCondominio', 'building'],
  ['contabilista', 'coin'],
  ['jurista', 'scale'],
]

const AV_COLOR: Record<string, string | undefined> = { gold: m.avGold, sage: m.avSage }

const roleKind = (role: RoleEquipe | undefined): PillKind | undefined => {
  if (role === 'admin') return 'gold'
  if (role === 'jurista') return 'amber'
  if (role === 'contabilista') return 'sage'
  return undefined
}

const eliminarStyle = { color: 'var(--v54-rust-700)', marginLeft: 6, borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' } as const

/** Initiales, nom, e-mail, libellé de la fonction, modules, couleur d'avatar, code de la fonction. */
type Row = readonly [string, string, string, string, string, string, RoleEquipe | undefined]

/** Rôle DB (clé) → fonction (code interne). */
const ROLE_CODES: Record<string, RoleEquipe> = {
  syndic_admin: 'admin', admin: 'admin',
  syndic_gestionnaire: 'gestorTecnico', gestionnaire: 'gestorTecnico', gestor_tecnico: 'gestorTecnico',
  syndic_tech: 'tecnico', tech: 'tecnico', tecnico: 'tecnico',
  syndic_secretaire: 'secretaria', secretaire: 'secretaria', secretaria: 'secretaria',
  syndic_comptable: 'contabilista', comptable: 'contabilista', contabilista: 'contabilista',
  syndic_juriste: 'jurista', juriste: 'jurista', jurista: 'jurista',
  syndic_gestor_condominio: 'gestorCondominio',
}
/** Rôle stocké directement sous son libellé PT (valeur brute déjà affichable). */
const ROLES_PT = EQUIPA_MESSAGES['pt-PT'].roles
const roleCode = (role: string): RoleEquipe | undefined =>
  ROLE_CODES[role] ?? (Object.keys(ROLES_PT) as RoleEquipe[]).find((c) => ROLES_PT[c] === role)

const teamInitials = (name: string): string => {
  const parts = (name || '').split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '—'
}

/** Rôle → libellé affiché dans la langue courante (fallback = valeur brute si inconnue). */
function memberToRow(member: TeamMember, t: Textes): Row {
  const code = roleCode(member.role)
  const label = code ? t.roles[code] : member.role
  return [
    teamInitials(member.full_name),
    member.full_name || member.email,
    member.email,
    label,
    member.custom_modules ? t.nbModules(member.custom_modules.length) : t.tousModules,
    code === 'admin' ? 'gold' : 'sage',
    code,
  ]
}

export default function ModEquipa() {
  const t = useMessages(EQUIPA_MESSAGES)
  // Phase 2 : vraie équipe du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const items: ReadonlyArray<{ row: Row; id: string | null; active: boolean }> = real
    ? (data.team ?? []).map((mt) => ({ row: memberToRow(mt, t), id: mt.id, active: mt.is_active }))
    : t.demo.map((d) => ({ row: [d.initiales, d.nom, d.email, t.roles[d.role], d.modules, d.couleur, d.role] as const, id: null, active: true }))

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
        .then(() => { data.refresh?.(); push({ kind: 'success', title: t.toasts.suspendu, desc: name }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurSuspension, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusyId(null))
      return
    }
    push({ kind: 'info', title: t.toasts.suspenduDemo, desc: t.toasts.connexionRequise })
  }
  const confirmDelete = () => {
    if (real && data.token && delTarget?.id) {
      setBusyDel(true)
      fetch(`/api/syndic/team?member_id=${encodeURIComponent(delTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.token}` },
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); const n = delTarget?.name; setDelTarget(null); push({ kind: 'success', title: t.toasts.supprime, desc: n }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurSuppression, desc: t.toasts.reessayerPlusTard }))
        .finally(() => setBusyDel(false))
      return
    }
    setDelTarget(null)
    push({ kind: 'info', title: t.toasts.supprimeDemo, desc: t.toasts.connexionRequise })
  }

  // Phase 2 écritures : « Convidar um membro » → POST /api/syndic/team (invitation).
  const INVITE_ROLES = [
    { v: 'syndic_gestionnaire', l: t.roles.gestorTecnico },
    { v: 'syndic_tech', l: t.roles.tecnico },
    { v: 'syndic_secretaire', l: t.roles.secretaria },
    { v: 'syndic_comptable', l: t.roles.contabilista },
    { v: 'syndic_juriste', l: t.roles.jurista },
    { v: 'syndic_admin', l: t.roles.admin },
  ] as const
  const blankInvite = { email: '', full_name: '', memberRole: 'syndic_tech' }
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState(blankInvite)
  const [inviteErr, setInviteErr] = useState<Record<string, string>>({})
  const [busyInvite, setBusyInvite] = useState(false)
  const updInvite = (k: string, v: string) => setInvite((s) => ({ ...s, [k]: v }))
  const openInvite = () => { setInvite(blankInvite); setInviteErr({}); setInviteOpen(true) }
  const submitInvite = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!invite.full_name.trim()) errs.full_name = t.erreurs.nom
    if (!invite.email.trim()) errs.email = t.erreurs.email
    if (Object.keys(errs).length) { setInviteErr(errs); return }
    if (real && data.token) {
      setBusyInvite(true)
      fetch('/api/syndic/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ email: invite.email, full_name: invite.full_name, memberRole: invite.memberRole }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setInviteOpen(false); push({ kind: 'success', title: t.toasts.invitationEnvoyee, desc: invite.full_name }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurInvitation, desc: t.toasts.verifierEmail }))
        .finally(() => setBusyInvite(false))
      return
    }
    setInviteOpen(false)
    push({ kind: 'info', title: t.toasts.invitationDemo, desc: t.toasts.connexionRequise })
  }
  const c = t.colonnes
  const sup = t.suppression
  const inv = t.invitation
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau(items.length)}
        actions={<Button variant="gold" onClick={openInvite}><Icon name="plus" />{t.inviter}</Button>}
      />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead>
              <tr><th>{c.membre}</th><th>{c.fonction}</th><th>{c.modules}</th><th>{c.statut}</th><th aria-label={c.actions} /></tr>
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
                  <td><Pill kind={roleKind(member[6])} noDot>{member[3]}</Pill></td>
                  <td><Pill kind="sage" noDot>{member[4]}</Pill></td>
                  <td>{active
                    ? <><span className={m.dotStatus} /> <span style={{ fontSize: 12.5, color: 'var(--v54-sage-700)' }}>{t.actif}</span></>
                    : <span style={{ fontSize: 12.5, color: 'var(--v54-rust-700)' }}>{t.suspendu}</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm" disabled={busyId === id} onClick={() => suspend(id, member[1])}>{t.suspendre}</Button>
                    <Button size="sm" style={eliminarStyle} onClick={() => setDelTarget({ id, name: member[1] })}>{t.supprimer}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.panneauRoles.titre} sub={t.panneauRoles.sousTitre}>
        <div className={m.cardGrid}>
          {ROLES.map(([code, icon]) => (
            <div key={code} style={{ padding: '16px 18px', border: '1px solid var(--v54-line)', borderRadius: 12, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--v54-gold-50)', color: 'var(--v54-gold-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.roles[code]}</div><div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{t.descriptions[code]}</div></div>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={delTarget != null} onClose={() => setDelTarget(null)} labelledBy="dm-title" size="sm">
        <ModalHead icon="trash" id="dm-title" title={sup.titre} onClose={() => setDelTarget(null)} />
        <ModalBody>
          <p style={{ fontSize: 13.5, color: 'var(--v54-navy-500)', lineHeight: 1.5, margin: 0 }}>
            {sup.avant}<b>{delTarget?.name}</b>{sup.apres}
          </p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setDelTarget(null)}>{sup.annuler}</Button>
          <button type="button" onClick={confirmDelete} disabled={busyDel} className={btnCss.btn} style={{ color: 'var(--v54-rust-700)', borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' }}>{sup.confirmer}</button>
        </ModalFoot>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} labelledBy="nm-title" size="md">
        <ModalHead icon="plus" id="nm-title" title={inv.titre} onClose={() => setInviteOpen(false)} />
        <form onSubmit={submitInvite} noValidate>
          <ModalBody>
            <Field label={inv.nomComplet} required full name="nm-nom" error={inviteErr.full_name}>
              <input type="text" placeholder={inv.nomPlaceholder} value={invite.full_name} onChange={(e) => updInvite('full_name', e.target.value)} />
            </Field>
            <Field label={inv.email} required full name="nm-email" error={inviteErr.email}>
              <input type="email" placeholder={inv.emailPlaceholder} value={invite.email} onChange={(e) => updInvite('email', e.target.value)} />
            </Field>
            <Field label={inv.fonction} full name="nm-role">
              <select value={invite.memberRole} onChange={(e) => updInvite('memberRole', e.target.value)}>
                {INVITE_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>{inv.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busyInvite}>{inv.envoyer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
