'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Campanha } from '@/lib/syndic/v54/api'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicCreate } from './use-syndic-create'
import { CONTACTO_MESSAGES } from './i18n/ModContacto.messages'

/** Contacto Proativo IA — port V5.7 + lot 3 fonctionnel.
 * Syndic connecté → vraies campanhas du cabinet (data.campanhas) + création POST (suivi —
 * l'envoi réel reste hors-scope) ; anonyme → Empty byte-exact. */

type CampForm = { nome: string; tipo: string; edificio: string; destinatarios: string; estado: Campanha['estado']; mensagem: string }

const estadoLabel = (v: string, etats: Record<Campanha['estado'], string>) => ((etats as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ rascunho: 'amber', agendada: 'gold', enviada: 'sage' } as Record<string, PillKind>)[v] || 'amber')

export default function ModContacto() {
  const t = useMessages(CONTACTO_MESSAGES)
  const data = useSyndicData()
  const real = data.authenticated
  const all: Campanha[] = real ? (data.campanhas ?? []) : []
  const { busy, create } = useSyndicCreate('/api/syndic/campanhas')

  const blank: CampForm = { nome: '', tipo: 'cobranca', edificio: '', destinatarios: '', estado: 'rascunho', mensagem: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CampForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof CampForm, string>>>({})

  const upd = (k: keyof CampForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) { setErrors({ nome: t.erreurNom }); return }
    create(
      { nome: form.nome, tipo: form.tipo, edificio: form.edificio, destinatarios: Number(form.destinatarios) || 0, estado: form.estado, mensagem: form.mensagem },
      { okTitle: t.toastCreee, desc: form.nome, onDone: () => setOpen(false) },
    )
  }

  const f = t.formulaire
  const enviadas = all.filter(c => c.estado === 'enviada').length
  const totalDest = all.reduce((s, c) => s + (Number(c.destinatarios) || 0), 0)
  const mensagensEnviadas = all.filter(c => c.estado === 'enviada').reduce((s, c) => s + (Number(c.destinatarios) || 0), 0)

  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleCampagne}</Button>}
      />
      <KPIGrid items={[
        { icon: 'sat', num: all.length, lbl: t.kpi.creees },
        { icon: 'mail', num: enviadas, lbl: t.kpi.envoyees, accent: enviadas ? 'sage' : undefined },
        { icon: 'users', num: totalDest, lbl: t.kpi.destinataires, accent: totalDest ? 'gold' : undefined },
        { icon: 'chat', num: mensagensEnviadas, lbl: t.kpi.messages, accent: mensagensEnviadas ? 'amber' : undefined },
      ]} />
      <Tabs defaultActive="camp" tabs={[
        { id: 'camp', icon: 'mail', label: t.onglets.camp },
        { id: 'mod', icon: 'pencil', label: t.onglets.mod },
        { id: 'hist', icon: 'chart', label: t.onglets.hist },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <Panel flush>
        {all.length === 0 ? (
          <Empty illustration="mensagens" title={t.vide.titre}
            desc={t.vide.texte}
            action={real ? <Button variant="gold" onClick={openNew}><Icon name="plus" />{t.nouvelleCampagne}</Button> : undefined} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.campagne}</th><th>{t.colonnes.type}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.destinataires}</th><th>{t.colonnes.statut}</th></tr></thead>
              <tbody>{all.map(c => (
                <tr key={c.id}><td><b>{c.nome}</b></td><td>{(c.tipo && t.typeTableau(c.tipo)) || '—'}</td><td>{c.edificio || '—'}</td><td className={m.numCell}>{c.destinatarios}</td><td><Pill kind={estadoKind(c.estado)} noDot>{estadoLabel(c.estado, t.etats)}</Pill></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="camp-modal-title" size="md">
        <ModalHead icon="mail" id="camp-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.nom} required full name="camp-nome" error={errors.nome}>
              <input type="text" placeholder={f.nomPlaceholder} value={form.nome} onChange={e => upd('nome', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.type} name="camp-tipo">
                <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                  <option value="cobranca">{f.types.cobranca}</option>
                  <option value="aviso">{f.types.aviso}</option>
                  <option value="relatorio">{f.types.relatorio}</option>
                  <option value="personalizada">{f.types.personalizada}</option>
                </select>
              </Field>
              <Field label={f.immeuble} name="camp-edif">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.edificio} onChange={e => upd('edificio', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.destinataires} hint={f.destinatairesAide} name="camp-dest">
                <input type="number" min="0" inputMode="numeric" placeholder="0" value={form.destinatarios} onChange={e => upd('destinatarios', e.target.value)} />
              </Field>
              <Field label={f.statut} name="camp-estado">
                <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                  <option value="rascunho">{t.etats.rascunho}</option>
                  <option value="agendada">{t.etats.agendada}</option>
                  <option value="enviada">{t.etats.enviada}</option>
                </select>
              </Field>
            </FormRow>
            <Field label={f.message} full name="camp-msg">
              <textarea rows={3} placeholder={f.messagePlaceholder} value={form.mensagem} onChange={e => upd('mensagem', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
