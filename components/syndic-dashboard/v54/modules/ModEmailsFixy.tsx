'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { EMAILS_FIXY_MESSAGES } from './i18n/ModEmailsFixy.messages'

/** Emails Fixy — port byte-exact du ModEmailsFixy du bundle V5.7. */

export default function ModEmailsFixy() {
  const soon = useComingSoon()
  const t = useMessages(EMAILS_FIXY_MESSAGES)
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<>
          <Button onClick={soon(t.listeToast)}><Icon name="chat" />{t.liste}</Button>
          <Button onClick={soon(t.rapportToast)}><Icon name="chart" />{t.rapport}</Button>
          <Button variant="gold" onClick={soon(t.analyseToast, t.connecterDabord)}><Icon name="sparkle" />{t.analyser}</Button>
        </>}
      />
      <Panel>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="mail" style={{ width: 54, height: 54 }} /></div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 8 }}>{t.connecterTitre}</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>{t.connecterTexte}</div>
          <Button variant="primary" onClick={soon(t.connecter, t.integrationEnCours)}>{t.connecter}</Button>
        </div>
      </Panel>
    </>
  )
}
