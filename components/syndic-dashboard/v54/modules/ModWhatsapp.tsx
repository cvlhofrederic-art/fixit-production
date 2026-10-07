'use client'

import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { WHATSAPP_MESSAGES } from './i18n/ModWhatsapp.messages'

/** Comunicação com Condóminos (WhatsApp/SMS) — port byte-exact du ModWhatsapp du bundle V5.7. */

export default function ModWhatsapp() {
  const t = useMessages(WHATSAPP_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="msg" tabs={[
        { id: 'msg', icon: 'chat', label: t.onglets.msg },
        { id: 'mod', icon: 'clipboard', label: t.onglets.mod },
        { id: 'env', icon: 'mail', label: t.onglets.env },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, minHeight: 560 }}>
        <Panel flush>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', marginBottom: 8 }}>{t.coproprietaires}</div>
            <select className={btnCss.btn} style={{ width: '100%' }} aria-label={t.filtrerCanal}><option>{t.tousLesCanaux}</option></select>
          </div>
          {t.demo.map((c, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--v54-line)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><b>{c.nome}</b><Pill kind={c.kind} noDot>{c.estado}</Pill></div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{c.fracao}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.msg}</div>
            </div>
          ))}
        </Panel>
        <Panel flush>
          <div style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 480 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', marginBottom: 18, color: 'var(--v54-gold-700)' }}><Icon name="chat" style={{ width: 32, height: 32 }} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 6 }}>{t.selectionner}</div>
          </div>
        </Panel>
      </div>
    </>
  )
}
