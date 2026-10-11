'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Pill, type PillKind } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import { useToast } from '../primitives/toast'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { fetchEtatBoiteGmail, releverBoiteGmail, urlConnexionGmail, type EtatBoiteGmail } from '@/lib/syndic/v54/api'
import { EMAILS_FIXY_MESSAGES } from './i18n/ModEmailsFixy.messages'

/**
 * Emails Fixy — port du ModEmailsFixy du bundle V5.7, branché sur la boîte Gmail du
 * cabinet quand le syndic est connecté : connexion Google (jeton dans l'en-tête, pas
 * dans l'URL), relève immédiate (Alfredo classe et prépare des brouillons — rien n'est
 * envoyé) et liste des derniers e-mails analysés. Hors connexion : écran d'origine.
 */

const URGENCE_PILL: Record<string, PillKind> = { urgente: 'rust', haute: 'rust', normale: 'amber', basse: 'sage' }

function dateCourte(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ModEmailsFixy() {
  const soon = useComingSoon()
  const { push } = useToast()
  const t = useMessages(EMAILS_FIXY_MESSAGES)
  const { token, authenticated } = useSyndicData()
  const [etat, setEtat] = useState<EtatBoiteGmail | null>(null)
  const [occupe, setOccupe] = useState<'connexion' | 'releve' | null>(null)

  const charger = useCallback(async () => {
    if (!token) return
    try {
      setEtat(await fetchEtatBoiteGmail(token))
    } catch (e) {
      console.warn('[ModEmailsFixy] état de la boîte indisponible', e)
    }
  }, [token])

  useEffect(() => { void charger() }, [charger])

  const connecter = async () => {
    if (!token) return
    setOccupe('connexion')
    try {
      window.location.assign(await urlConnexionGmail(token))
    } catch (e) {
      setOccupe(null)
      push({ kind: 'error', title: t.connexionEchec, desc: e instanceof Error ? e.message : undefined })
    }
  }

  const relever = async () => {
    if (!token || !etat) return
    setOccupe('releve')
    try {
      const r = await releverBoiteGmail(token, etat.cabinetId)
      push({ kind: 'success', title: t.releveOk, desc: `${r.nouveaux} ${t.releveNouveaux} · ${r.traites} ${t.releveLus}` })
      await charger()
    } catch (e) {
      push({ kind: 'error', title: t.releveEchec, desc: e instanceof Error ? e.message : undefined })
    } finally {
      setOccupe(null)
    }
  }

  const connecte = authenticated && !!etat?.connecte
  const emails = etat?.emails ?? []
  const lede = connecte
    ? `${t.boiteConnectee} ${etat?.email ?? ''} · ${emails.length} ${t.emailsAnalyses} · ${etat?.brouillonsEnAttente ?? 0} ${t.brouillonsAValider}`
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
        <Panel title={t.derniersEmails}>
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
            <Button
              variant="primary"
              onClick={authenticated && token ? () => { void connecter() } : soon(t.connecter, t.integrationEnCours)}
              disabled={occupe !== null}
            >
              {occupe === 'connexion' ? t.connexionEnCours : t.connecter}
            </Button>
          </div>
        </Panel>
      )}
    </>
  )
}
