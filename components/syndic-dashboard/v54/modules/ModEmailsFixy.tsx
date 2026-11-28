'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Pill, type PillKind } from '../primitives/pill'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Toggle } from '../primitives/toggle'
import Icon from '../primitives/icon/Icon'
import { useToast } from '../primitives/toast'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import {
  ErreurReleveBoite,
  deconnecterBoite,
  fetchEtatBoite,
  releverBoite,
  urlConnexionBoite,
  ORIGINES_CONNEXION_BOITE,
  type EtatBoiteEmail,
  type FournisseurBoiteEmail,
} from '@/lib/syndic/v54/api'
import { EMAILS_FIXY_MESSAGES } from './i18n/ModEmailsFixy.messages'
import { safeNavigate } from '@/lib/security/safe-url'

/**
 * Emails Fixy — port du ModEmailsFixy du bundle V5.7, branché sur la boîte e-mail du
 * cabinet (Outlook / Microsoft 365 ou Gmail / Google Workspace) quand le syndic est
 * connecté : connexion chez le fournisseur (jeton dans l'en-tête, pas dans l'URL), relève
 * immédiate (Alfredo classe et prépare des brouillons — rien n'est envoyé), liste des
 * derniers e-mails analysés et déconnexion. Hors connexion : écran d'origine.
 */

type Textes = (typeof EMAILS_FIXY_MESSAGES)['fr-FR']

/** Boutons de connexion, dans l'ordre d'affichage (un par fournisseur pris en charge). */
const BOUTONS_FOURNISSEURS: ReadonlyArray<{
  id: FournisseurBoiteEmail
  libelle: 'connecterMicrosoft' | 'connecterGmail'
  enCours: 'connexionEnCoursMicrosoft' | 'connexionEnCoursGmail'
}> = [
  { id: 'microsoft', libelle: 'connecterMicrosoft', enCours: 'connexionEnCoursMicrosoft' },
  { id: 'gmail', libelle: 'connecterGmail', enCours: 'connexionEnCoursGmail' },
]

const URGENCE_PILL: Record<string, PillKind> = { urgente: 'rust', haute: 'rust', normale: 'amber', basse: 'sage' }

const ID_TITRE_DECONNEXION = 'emails-fixy-deconnexion-titre'

function dateCourte(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Nom affiché du fournisseur de la boîte connectée. */
function nomFournisseur(provider: string | null | undefined, t: Textes): string {
  const bouton = BOUTONS_FOURNISSEURS.find(b => b.id === provider)
  return bouton ? t[bouton.libelle] : ''
}

/** Message d'échec de relève : reconnexion demandée si le jeton a expiré. */
function descriptionEchecReleve(e: unknown, t: Textes): string | undefined {
  if (e instanceof ErreurReleveBoite && e.code === 'refresh_failed') return t.releveReconnecter
  if (e instanceof ErreurReleveBoite && e.code) return t.releveLectureImpossible
  return e instanceof Error ? e.message : undefined
}

export default function ModEmailsFixy() {
  const soon = useComingSoon()
  const { push } = useToast()
  const t = useMessages(EMAILS_FIXY_MESSAGES)
  const { token, authenticated } = useSyndicData()
  const [etat, setEtat] = useState<EtatBoiteEmail | null>(null)
  // Fournisseur en cours de connexion, relève ou déconnexion en cours.
  const [occupe, setOccupe] = useState<FournisseurBoiteEmail | 'releve' | 'deconnexion' | null>(null)
  const [confirmation, setConfirmation] = useState(false)
  const [purger, setPurger] = useState(false)

  const charger = useCallback(async () => {
    if (!token) return
    try {
      setEtat(await fetchEtatBoite(token))
    } catch (e) {
      console.warn('[ModEmailsFixy] état de la boîte indisponible', e)
    }
  }, [token])

  useEffect(() => { void charger() }, [charger])

  const connecter = async (provider: FournisseurBoiteEmail) => {
    if (!token) return
    setOccupe(provider)
    try {
      const adresse = await urlConnexionBoite(token, provider)
      // L'adresse vient du serveur : seule une page d'autorisation Google ou Microsoft est acceptée ;
      // sinon, même toast que pour un échec de la route (texte existant, bilingue).
      if (!safeNavigate(adresse, { allowedOrigins: ORIGINES_CONNEXION_BOITE })) {
        setOccupe(null)
        push({ kind: 'error', title: t.connexionEchec })
      }
    } catch (e) {
      setOccupe(null)
      push({ kind: 'error', title: t.connexionEchec, desc: e instanceof Error ? e.message : undefined })
    }
  }

  const relever = async () => {
    if (!token || !etat) return
    setOccupe('releve')
    try {
      const r = await releverBoite(token, etat.cabinetId)
      const reportes = r.reportes > 0 ? ` · ${r.reportes} ${t.releveReportes}` : ''
      push({ kind: 'success', title: t.releveOk, desc: `${r.nouveaux} ${t.releveNouveaux} · ${r.traites} ${t.releveLus}${reportes}` })
      await charger()
    } catch (e) {
      push({ kind: 'error', title: t.releveEchec, desc: descriptionEchecReleve(e, t) })
    } finally {
      setOccupe(null)
    }
  }

  const fermerConfirmation = () => {
    if (occupe === 'deconnexion') return
    setConfirmation(false)
    setPurger(false)
  }

  const deconnecter = async () => {
    if (!token) return
    setOccupe('deconnexion')
    try {
      const r = await deconnecterBoite(token, purger)
      setConfirmation(false)
      setPurger(false)
      setEtat(prev => (prev ? { ...prev, connecte: false, provider: null, email: null } : prev))
      push({ kind: 'success', title: t.deconnexionOk, desc: purger ? `${r.emailsSupprimes} ${t.emailsEffaces}` : undefined })
      await charger()
    } catch (e) {
      push({ kind: 'error', title: t.deconnexionEchec, desc: e instanceof Error ? e.message : undefined })
    } finally {
      setOccupe(null)
    }
  }

  const connecte = authenticated && !!etat?.connecte
  const emails = etat?.emails ?? []
  const fournisseur = nomFournisseur(etat?.provider, t)
  const boite = fournisseur ? `${etat?.email ?? ''} (${fournisseur})` : etat?.email ?? ''
  const lede = connecte
    ? `${t.boiteConnectee} ${boite} · ${emails.length} ${t.emailsAnalyses} · ${etat?.brouillonsEnAttente ?? 0} ${t.brouillonsAValider}`
    : t.chapeau

  return (
    <>
      <PageHead
        title={t.titre}
        lede={lede}
        actions={<>
          <Button onClick={soon(t.listeToast)}><Icon name="chat" />{t.liste}</Button>
          <Button onClick={soon(t.rapportToast)}><Icon name="chart" />{t.rapport}</Button>
          <Button
            variant="gold"
            onClick={connecte ? () => { void relever() } : soon(t.analyseToast, t.connecterDabord)}
            disabled={occupe !== null}
          >
            <Icon name="sparkle" />{occupe === 'releve' ? t.releveEnCours : t.analyser}
          </Button>
        </>}
      />
      {connecte ? (
        <Panel
          title={t.derniersEmails}
          right={<Button variant="ghost" size="sm" onClick={() => setConfirmation(true)} disabled={occupe !== null}>{t.deconnecter}</Button>}
        >
          {emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', fontSize: 13, color: 'var(--v54-navy-300)' }}>{t.aucunEmail}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {emails.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 4px', borderBottom: '1px solid var(--v54-line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.subject || t.sansObjet}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{e.from_email} · {dateCourte(e.received_at, t.localeDate)}</div>
                    {e.resume_ia && <div style={{ fontSize: 12.5, marginTop: 6 }}>{e.resume_ia}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {e.urgence && <Pill kind={URGENCE_PILL[e.urgence] ?? 'sage'}>{e.urgence}</Pill>}
                    {e.draft_status === 'pending_review' && <Pill kind="gold" noDot>{t.brouillonAValider}</Pill>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="mail" style={{ width: 54, height: 54 }} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 8 }}>{t.connecterTitre}</div>
            <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>{t.connecterTexte}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {BOUTONS_FOURNISSEURS.map(b => (
                <Button
                  key={b.id}
                  variant="primary"
                  onClick={authenticated && token ? () => { void connecter(b.id) } : soon(t[b.libelle], t.integrationEnCours)}
                  disabled={occupe !== null}
                >
                  {occupe === b.id ? t[b.enCours] : t[b.libelle]}
                </Button>
              ))}
            </div>
          </div>
        </Panel>
      )}
      <Modal open={confirmation} onClose={fermerConfirmation} labelledBy={ID_TITRE_DECONNEXION} size="sm">
        <ModalHead icon="mail" id={ID_TITRE_DECONNEXION} title={t.deconnexionTitre} onClose={fermerConfirmation} />
        <ModalBody>
          {etat?.email && <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{boite}</div>}
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 16 }}>{t.deconnexionTexte}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--v54-cream)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.purgerEmails}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{t.purgerAide}</div>
            </div>
            <Toggle on={purger} onToggle={e => setPurger(e.target.checked)} disabled={occupe === 'deconnexion'} aria-label={t.purgerEmails} />
          </div>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={fermerConfirmation} disabled={occupe === 'deconnexion'}>{t.annuler}</Button>
          <Button variant="danger" onClick={() => { void deconnecter() }} disabled={occupe === 'deconnexion'}>
            {occupe === 'deconnexion' ? t.deconnexionEnCours : t.confirmerDeconnexion}
          </Button>
        </ModalFoot>
      </Modal>
    </>
  )
}
