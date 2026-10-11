'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../../primitives/modal'
import { Field } from '../../primitives/field'
import { FormRow } from '../../primitives/form-row'
import { Button } from '../../primitives/button'
import { Pill } from '../../primitives/pill'
import { useToast } from '../../primitives/toast'
import btnCss from '../../primitives/button/Button.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { jourCivilLocal } from '@/lib/syndic/v54/i18n/dates'
import { ErreurApiSyndic, validerDemande, type Signalement } from '@/lib/syndic/v54/api'
import type { Artisan } from '@/components/syndic-dashboard/types'
import { CANAL_REEL_MESSAGES } from '../i18n/ModCanalReel.messages'
import css from './ValiderMissionModal.module.css'

/**
 * « Valider la mission » (Canal de communication, onglet Demandes) : choix du prestataire parmi TOUS
 * ceux du cabinet. Ceux sans compte Vitfix (artisan_user_id vide) sont listés mais ne peuvent pas
 * recevoir l'ordre de mission. Envoie POST /api/syndic/demandes/valider.
 */
export function ValiderMissionModal({
  open,
  onClose,
  signalement,
  artisans,
  token,
  onValidee,
}: Readonly<{
  open: boolean
  onClose: () => void
  signalement: Signalement | null
  artisans: Artisan[]
  token: string
  onValidee: () => void
}>) {
  const t = useMessages(CANAL_REEL_MESSAGES)
  const v = t.validation
  const { push } = useToast()
  const [choix, setChoix] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)

  // Prestataires avec compte d'abord, puis par nom.
  const liste = useMemo(
    () => [...artisans].sort((a, b) => Number(!!b.artisan_user_id) - Number(!!a.artisan_user_id) || (a.nom || '').localeCompare(b.nom || '')),
    [artisans],
  )

  useEffect(() => {
    if (open) {
      setChoix('')
      setDate(jourCivilLocal())
      setNote('')
      setErreur('')
    }
  }, [open, signalement?.id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!signalement) return
    const prestataire = artisans.find((a) => a.id === choix)
    if (!prestataire?.artisan_user_id) {
      setErreur(v.choisirErreur)
      return
    }
    setBusy(true)
    try {
      const r = await validerDemande(token, {
        signalement_id: signalement.id,
        syndic_artisan_id: prestataire.id,
        ...(date ? { date_intervention: date } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      if (r.notification) push({ kind: 'success', title: v.toasts.confiee(prestataire.nom), desc: v.toasts.confieeDesc })
      else push({ kind: 'warning', title: v.toasts.sansNotification, desc: v.toasts.sansNotificationDesc })
      onValidee()
      onClose()
    } catch (err) {
      const code = err instanceof ErreurApiSyndic ? err.code : ''
      if (code === 'prestataire_sans_compte') {
        push({ kind: 'error', title: v.toasts.sansCompte, desc: v.toasts.sansCompteDesc })
      } else if (code === 'signalement_deja_traite') {
        push({ kind: 'warning', title: v.toasts.dejaTraitee, desc: v.toasts.dejaTraiteeDesc })
        onValidee()
        onClose()
      } else {
        push({ kind: 'error', title: v.toasts.erreur, desc: v.toasts.reessayer })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="vm-title" size="md">
      <ModalHead icon="check" id="vm-title" title={v.titre} onClose={onClose} />
      <form onSubmit={submit} noValidate>
        <ModalBody>
          {signalement && (
            <p className={css.intro}>
              <b>{signalement.immeuble}</b> — {signalement.typeIntervention}
              <br />
              {v.intro}
            </p>
          )}
          <fieldset className={css.fieldset}>
            <legend className={css.legend}>{v.prestataires}</legend>
            {liste.length === 0 ? (
              <p className={css.vide}>{v.aucunPrestataire}</p>
            ) : (
              <ul className={css.list}>
                {liste.map((a) => {
                  const lie = !!a.artisan_user_id
                  return (
                    <li key={a.id}>
                      <label className={clsx(css.option, choix === a.id && css.selected, !lie && css.disabled)}>
                        <input
                          type="radio"
                          name="vm-prestataire"
                          value={a.id}
                          checked={choix === a.id}
                          disabled={!lie}
                          onChange={() => { setChoix(a.id); setErreur('') }}
                        />
                        <span className={css.info}>
                          <span className={css.nom}>{a.nom}</span>
                          {a.metier && <span className={css.metier}>{a.metier}</span>}
                        </span>
                        <Pill kind={lie ? 'sage' : 'amber'} noDot>{lie ? v.compteLie : v.sansCompte}</Pill>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {erreur && <p className={css.erreur} role="alert">{erreur}</p>}
          </fieldset>
          <FormRow>
            <Field label={v.date} name="vm-date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </FormRow>
          <Field label={v.note} full name="vm-note">
            <textarea rows={3} placeholder={v.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </Field>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={onClose}>{v.annuler}</Button>
          <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy || !choix}>{v.confirmer}</button>
        </ModalFoot>
      </form>
    </Modal>
  )
}
