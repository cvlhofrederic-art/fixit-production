'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useDocumentUpload } from './use-document-upload'
import { useLeaDocuments, docTypeLabel, docTypeKind, docTypeIcon, docDateShort, type LeaDocMeta } from './use-lea-documents'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { DOCS_INTERV_MESSAGES } from './i18n/ModDocsInterv.messages'

/**
 * Documentos de Intervenções — port byte-exact V5.7 (Empty = preview anonyme).
 * Authentifié : documents Léa du cabinet liés aux intervenções (faturas de
 * artisans, orçamentos, relatórios/autres). Onglets = statut de transmissão
 * à la comptabilité (processed = transmitido). Anonyme : preview inchangée.
 */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

/** Types Léa considérés « de intervenção » (factures artisans, devis, relatórios/autres). */
const INTERV_TYPES = ['facture_artisan', 'devis', 'autre']

export default function ModDocsInterv() {
  const t = useMessages(DOCS_INTERV_MESSAGES)
  const locale = useV54Locale()
  const soon = useComingSoon()
  const data = useSyndicData()
  const authed = data.authenticated
  const { docs, refresh } = useLeaDocuments({ enabled: authed })
  const upload = useDocumentUpload(refresh)
  const [tab, setTab] = useState('all')

  const interv = authed ? docs.filter((d) => INTERV_TYPES.includes(d.type)) : []
  const transmitidas = interv.filter((d) => d.status === 'processed').length
  const naoTransmitidas = interv.length - transmitidas
  const nFaturas = interv.filter((d) => d.type === 'facture_artisan').length
  const shown = tab === 'env' ? interv.filter((d) => d.status !== 'processed') : tab === 'sent' ? interv.filter((d) => d.status === 'processed') : interv

  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<Button variant="gold" onClick={upload('autre')}><Icon name="plus" />{t.ajouterDocument}</Button>}
      />
      <KPIGrid items={[
        { icon: 'file', num: interv.length, lbl: t.kpi.total, sub: t.kpi.totalSous },
        { icon: 'mail', num: naoTransmitidas, lbl: t.kpi.nonTransmis, sub: t.kpi.nonTransmisSous, accent: 'rust' },
        { icon: 'check', num: transmitidas, lbl: t.kpi.transmis, sub: t.kpi.transmisSous, accent: 'sage' },
        { icon: 'file', num: nFaturas, lbl: t.kpi.factures, sub: t.kpi.facturesSous, accent: 'gold' },
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'all', icon: 'clipboard', label: t.onglets.tous, badge: interv.length },
        { id: 'env', label: t.onglets.aEnvoyer, badge: naoTransmitidas },
        { id: 'sent', label: t.onglets.envoyes, badge: transmitidas },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label={t.rechercheAria} style={inputStyle} placeholder={t.recherchePlaceholder} />
        </div>
        <Button onClick={soon(t.filtrerType)}><Icon name="doc" />{t.tousTypes}</Button>
        <Button onClick={soon(t.filtrerPrestataire)}><Icon name="wrench" />{t.tousPrestataires}</Button>
      </div>
      {!authed || interv.length === 0 ? (
        <Panel>
          <Empty
            illustration="documentos"
            title={t.vide.titre}
            desc={t.vide.description}
            action={<Button variant="gold" onClick={upload('autre')}><Icon name="plus" />{t.ajouterDocument}</Button>}
          />
        </Panel>
      ) : (
        <Panel flush>
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.document}</th><th>{t.colonnes.type}</th><th>{t.colonnes.comptabilite}</th><th>{t.colonnes.date}</th></tr></thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>{t.aucunDansCategorie}</td></tr>
                ) : shown.map((d) => {
                  const meta = (d.extracted_metadata ?? {}) as LeaDocMeta
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div className={m.docIconThumb} aria-hidden="true"><Icon name={docTypeIcon(d.type)} /></div>
                          <div><b>{d.filename}</b><div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{meta.fournisseur || meta.summary_short || '—'}</div></div>
                        </div>
                      </td>
                      <td><Pill kind={docTypeKind(d.type)} noDot>{docTypeLabel(d.type, locale)}</Pill></td>
                      <td><Pill kind={d.status === 'processed' ? 'sage' : 'amber'} noDot>{d.status === 'processed' ? t.transmis : t.aEnvoyer}</Pill></td>
                      <td className={m.numCell}>{docDateShort(d.uploaded_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}
