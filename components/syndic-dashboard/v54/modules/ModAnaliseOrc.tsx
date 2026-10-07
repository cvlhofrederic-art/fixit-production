'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { ANALISE_ORC_MESSAGES } from './i18n/ModAnaliseOrc.messages'

/** Análise Orçamentos & Faturas — port byte-exact V5.7 + Phase 3 (lot IA).
 * Le séparateur « Inserir o texto » analyse le devis/facture collé via l'agent Léa (lea-comptable).
 * Câblage UI → endpoint agent existant, aucun prompt serveur modifié (ai-agents.md). Le PDF reste un placeholder.
 * Le message envoyé à Léa est dans le dictionnaire : PT inchangé, FR rédigé pour le droit français. */

/** Icônes des cartes de fonctionnalités, dans l'ordre des textes du dictionnaire. */
const FEATURE_ICONS: readonly IconName[] = ['scale', 'coin', 'shield']

export default function ModAnaliseOrc() {
  const t = useMessages(ANALISE_ORC_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [active, setActive] = useState('pdf')
  const [texto, setTexto] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const analisar = () => {
    if (!texto.trim()) return
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = t.prompt(texto)
      askAgent('lea', message, data.token, locale)
        .then((text) => { setResult(text); push({ kind: 'success', title: t.toasts.termineeTitre, desc: t.toasts.termineeDesc }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreurTitre, desc: t.toasts.erreurDesc }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: t.toasts.demoTitre, desc: t.toasts.demoDesc })
  }

  const canAnalyse = active === 'txt' && !!texto.trim() && !busy

  return (
    <>
      <PageHead title={t.titre} eyebrow={t.surtitre} />
      <div className={m.cardGrid3} style={{ marginBottom: 16 }}>
        {t.fonctionnalites.map((c, i) => (
          <div key={c.titre} className={m.card} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', color: 'var(--v54-navy-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={FEATURE_ICONS[i]} /></div>
            <div><div style={{ fontWeight: 600, marginBottom: 3 }}>{c.titre}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{c.description}</div></div>
          </div>
        ))}
      </div>
      <Tabs active={active} onChange={setActive} tabs={[
        { id: 'pdf', label: t.onglets.pdf, icon: 'upload' },
        { id: 'txt', label: t.onglets.texte, icon: 'pencil' },
        { id: 'seg', label: t.onglets.assurance, icon: 'shield' },
      ]} />
      {active === 'pdf' && (
        <div className={m.dropZone}>
          <div className={m.icoLg}><Icon name="file" /></div>
          <h4>{t.depot.titre}</h4>
          <p>{t.depot.sousTitre}</p>
          <Button variant="gold" onClick={() => push({ kind: 'info', title: t.toasts.pdfTitre, desc: t.toasts.pdfDesc })}><Icon name="upload" />{t.depot.bouton}</Button>
          <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 14 }}>{t.depot.formats}</div>
        </div>
      )}
      {active === 'txt' && (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} placeholder={t.textePlaceholder} style={{ width: '100%', padding: 12, border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: 'var(--v54-ink)', resize: 'vertical' }} />
      )}
      {active === 'seg' && (
        <Panel>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', lineHeight: 1.6 }}>{t.assuranceInfo}</div>
        </Panel>
      )}
      <Button onClick={analisar} disabled={!canAnalyse} style={{ width: '100%', marginTop: 16, padding: 14, opacity: canAnalyse ? 1 : 0.5, justifyContent: 'center' }}><Icon name="search" />{busy ? t.analyseEnCours : t.analyser}</Button>
      {(busy || result) && (
        <Panel title={t.resultat}>
          {busy ? (
            <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', padding: 8 }}>{t.leaAnalyse}</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)', padding: 4 }}>{result}</div>
          )}
        </Panel>
      )}
    </>
  )
}
