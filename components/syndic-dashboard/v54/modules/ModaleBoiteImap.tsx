'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import clsx from 'clsx'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { Alert } from '../primitives/alert'
import { Button, type ButtonProps } from '../primitives/button'
import btnCss from '../primitives/button/Button.module.css'
import { useToast } from '../primitives/toast'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { ErreurConnexionImap, connecterBoiteImap } from '@/lib/syndic/v54/api'
import { SERVEURS_HEBERGEURS, estAdresseMicrosoft, serveurImapSuggere } from '@/lib/email-agent/imap/serveurs-connus'
import { MODALE_BOITE_IMAP_MESSAGES } from './i18n/ModaleBoiteImap.messages'

/**
 * Connexion de la boîte du cabinet par IMAP (« autre messagerie » : OVH, Infomaniak,
 * Gandi, Ionos, iCloud, Yahoo, serveur du cabinet…). Le serveur teste la connexion avant
 * de l'enregistrer ; le mot de passe part une fois, chiffré côté serveur, et n'est jamais
 * réaffiché (champ vidé à la fermeture).
 */

const ID_TITRE = 'boite-imap-titre'
const ID_SUGGESTIONS = 'boite-imap-serveurs'

export interface ModaleBoiteImapProps {
  open: boolean
  onClose: () => void
  token: string | null
  /** Boîte connectée (adresse) : le parent recharge l'état de la boîte. */
  onConnectee?: (email: string) => void
}

export default function ModaleBoiteImap({ open, onClose, token, onConnectee }: ModaleBoiteImapProps) {
  const t = useMessages(MODALE_BOITE_IMAP_MESSAGES)
  const { push } = useToast()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [hote, setHote] = useState('')
  // Serveur saisi à la main : plus de pré-remplissage depuis le domaine de l'adresse.
  const [hoteSaisi, setHoteSaisi] = useState(false)
  const [utilisateur, setUtilisateur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const fermer = () => {
    if (enCours) return
    setMotDePasse('')
    setErreur(null)
    onClose()
  }

  const changerEmail = (valeur: string) => {
    setEmail(valeur)
    if (!hoteSaisi) setHote(serveurImapSuggere(valeur) ?? '')
  }

  const soumettre = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || enCours) return
    if (!email.trim() || !motDePasse || !hote.trim()) {
      setErreur(t.champsRequis)
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const r = await connecterBoiteImap(token, {
        email: email.trim(),
        motDePasse,
        hote: hote.trim(),
        ...(utilisateur.trim() ? { utilisateur: utilisateur.trim() } : {}),
      })
      setMotDePasse('')
      push({ kind: 'success', title: t.connexionOk, desc: r.email })
      onConnectee?.(r.email)
      onClose()
    } catch (err) {
      const code = err instanceof ErreurConnexionImap ? err.code : null
      setErreur((code && t.erreurs[code]) || (err instanceof Error ? err.message : t.connexionEchec))
    } finally {
      setEnCours(false)
    }
  }

  const microsoft = estAdresseMicrosoft(email)

  return (
    <Modal open={open} onClose={fermer} labelledBy={ID_TITRE} size="md">
      <ModalHead icon="mail" id={ID_TITRE} title={t.titre} onClose={fermer} />
      <form onSubmit={e => { void soumettre(e) }} noValidate>
        <ModalBody>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 10 }}>{t.intro}</div>
          <Alert kind="gold" icon="info" title={t.aideMotDePasse}>{t.aideMicrosoft}</Alert>
          <Field label={t.adresse} name="imap-email" required full error={microsoft ? t.domaineMicrosoft : undefined}>
            <input type="email" autoComplete="email" placeholder={t.adressePlaceholder} value={email} onChange={e => changerEmail(e.target.value)} />
          </Field>
          <Field label={t.motDePasse} name="imap-mot-de-passe" required full hint={t.motDePasseAide}>
            <input type="password" autoComplete="off" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} />
          </Field>
          <Field label={t.serveur} name="imap-serveur" required full hint={t.serveurAide} suffix=":993">
            <input
              type="text"
              list={ID_SUGGESTIONS}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t.serveurPlaceholder}
              value={hote}
              onChange={e => { setHote(e.target.value); setHoteSaisi(true) }}
            />
          </Field>
          <datalist id={ID_SUGGESTIONS}>
            {SERVEURS_HEBERGEURS.map(s => <option key={s.hote} value={s.hote}>{s.nom}</option>)}
          </datalist>
          <Field label={t.identifiant} name="imap-identifiant" full hint={t.identifiantAide}>
            <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={utilisateur} onChange={e => setUtilisateur(e.target.value)} />
          </Field>
          {erreur && <Alert kind="rust" title={t.connexionEchec}>{erreur}</Alert>}
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={fermer} disabled={enCours}>{t.annuler}</Button>
          <button type="submit" className={clsx(btnCss.btn, btnCss.primary)} disabled={enCours || !token}>
            {enCours ? t.connexionEnCours : t.connecter}
          </button>
        </ModalFoot>
      </form>
    </Modal>
  )
}

export interface BoutonBoiteImapProps {
  variant?: ButtonProps['variant']
  style?: CSSProperties
  disabled?: boolean
  /** Boîte connectée : le parent recharge l'état de la boîte. */
  onConnectee?: (email: string) => void
}

/**
 * Bouton « Autre messagerie (IMAP) » et son formulaire, à côté des boutons Outlook et
 * Gmail (E-mails Fixy, Paramètres). Hors connexion au tableau de bord : toast d'attente,
 * comme les deux autres boutons.
 */
export function BoutonBoiteImap({ variant, style, disabled, onConnectee }: BoutonBoiteImapProps) {
  const t = useMessages(MODALE_BOITE_IMAP_MESSAGES)
  const soon = useComingSoon()
  const { token, authenticated } = useSyndicData()
  const [ouvert, setOuvert] = useState(false)
  const actif = authenticated && !!token
  return (
    <>
      <Button variant={variant} style={style} disabled={disabled} onClick={actif ? () => setOuvert(true) : soon(t.bouton)}>
        {t.bouton}
      </Button>
      {actif && <ModaleBoiteImap open={ouvert} onClose={() => setOuvert(false)} token={token ?? null} onConnectee={onConnectee} />}
    </>
  )
}
