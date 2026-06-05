'use client'

import { useState, useEffect, type FormEvent } from 'react'
import clsx from 'clsx'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/**
 * Modal partagé « Nova missão » → POST /api/syndic/missions, pré-remplissable.
 * Utilisé par les raccourcis depuis une carte profissional (artisan verrouillé)
 * ou edifício (immeuble verrouillé). Ne touche pas au modal interne de ModOrdens.
 */
export function NovaMissaoModal({
  open,
  onClose,
  prefillImmeuble = '',
  prefillArtisan = '',
  lockImmeuble = false,
  lockArtisan = false,
}: {
  open: boolean
  onClose: () => void
  prefillImmeuble?: string
  prefillArtisan?: string
  lockImmeuble?: boolean
  lockArtisan?: boolean
}) {
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [form, setForm] = useState({ immeuble: prefillImmeuble, type: '', description: '', priorite: 'normale', artisan: prefillArtisan })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  // Réinitialise avec les valeurs pré-remplies à chaque ouverture.
  useEffect(() => {
    if (open) { setForm({ immeuble: prefillImmeuble, type: '', description: '', priorite: 'normale', artisan: prefillArtisan }); setErrors({}) }
  }, [open, prefillImmeuble, prefillArtisan])
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.immeuble.trim()) errs.immeuble = 'O edifício é obrigatório.'
    if (!form.type.trim()) errs.type = 'O tipo é obrigatório.'
    if (!form.description.trim()) errs.description = 'A descrição é obrigatória.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ immeuble: form.immeuble, type: form.type, description: form.description, priorite: form.priorite, artisan: form.artisan }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); onClose(); push({ kind: 'success', title: 'Missão criada', desc: form.type }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar a missão', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    onClose()
    push({ kind: 'info', title: 'Missão criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  return (
    <Modal open={open} onClose={onClose} labelledBy="nms-title" size="md">
      <ModalHead icon="plus" id="nms-title" title="Nova missão" onClose={onClose} />
      <form onSubmit={submit} noValidate>
        <ModalBody>
          <Field label="Edifício" required full name="nms-imovel" error={errors.immeuble}>
            {lockImmeuble ? (
              <input type="text" value={form.immeuble} readOnly />
            ) : real && data.immeubles.length > 0 ? (
              <select value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)}>
                <option value="">Selecione…</option>
                {data.immeubles.map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Nome do edifício" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
            )}
          </Field>
          <FormRow>
            <Field label="Tipo" required name="nms-tipo" error={errors.type}>
              <input type="text" placeholder="Ex.: Canalização" value={form.type} onChange={(e) => upd('type', e.target.value)} />
            </Field>
            <Field label="Prioridade" name="nms-prio">
              <select value={form.priorite} onChange={(e) => upd('priorite', e.target.value)}>
                <option value="basse">Baixa</option>
                <option value="normale">Normal</option>
                <option value="haute">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
          </FormRow>
          <Field label="Descrição" required full name="nms-desc" error={errors.description}>
            <textarea rows={3} placeholder="Descreva a intervenção…" value={form.description} onChange={(e) => upd('description', e.target.value)} />
          </Field>
          <Field label="Profissional (opcional)" full name="nms-art">
            <input type="text" placeholder="Nome do profissional" value={form.artisan} onChange={(e) => upd('artisan', e.target.value)} readOnly={lockArtisan} />
          </Field>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar missão</button>
        </ModalFoot>
      </form>
    </Modal>
  )
}
