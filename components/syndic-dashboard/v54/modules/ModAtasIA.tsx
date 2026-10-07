'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { ATAS_IA_MESSAGES } from './i18n/ModAtasIA.messages'

/** Atas com IA — port byte-exact V5.7 + Phase 3 (lot IA) : génère l'ata d'assemblée via l'agent Alfredo
 *  à partir des points/notes collés. Câblage UI → endpoint existant, aucun prompt modifié (ai-agents.md).
 *  Version FR : consigne rédigée pour le procès-verbal du décret de 1967, langue transmise à l'agent. */

const textareaStyle = { width: '100%', padding: 12, border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: 'var(--v54-ink)', resize: 'vertical' } as const

export default function ModAtasIA() {
  const t = useMessages(ATAS_IA_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [mode, setMode] = useState<'cta' | 'form'>('cta')
  const [notas, setNotas] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const gerar = () => {
    if (!notas.trim()) return
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = t.consigne(notas)
      askAgent('alfredo', message, data.token, locale)
        .then((text) => { setResult(text); push({ kind: 'success', title: t.toasts.genere, desc: t.toasts.pretRelecture }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.indisponible }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: t.toasts.demo, desc: t.toasts.connexionRequise })
  }

  return (
    <>
      <PageHead
        title={t.titre}
        actions={<Button variant="gold" onClick={() => setMode('form')}><Icon name="plus" />{t.nouveau}</Button>}
      />
      <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', marginBottom: 14 }}>{t.sousTitre}</div>
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'pencil', label: t.onglets.ger },
        { id: 'atas', icon: 'book', label: t.onglets.atas },
        { id: 'mod', icon: 'clipboard', label: t.onglets.mod },
      ]} />
      <Panel>
        {mode === 'cta' ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="pencil" style={{ width: 54, height: 54 }} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 6 }}>{t.accueil.titre}</div>
            <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>{t.accueil.desc}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => setMode('form')}><Icon name="sparkle" />{t.accueil.partirDeZero}</Button>
              <Button onClick={() => push({ kind: 'info', title: t.modelesBientot.titre, desc: t.modelesBientot.desc })}>{t.accueil.voirModeles}</Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 4 }}>
            <label htmlFor="atas-notas" style={{ fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>{t.notesLabel}</label>
            <textarea id="atas-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={8} placeholder={t.notesPlaceholder} style={textareaStyle} />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <Button variant="primary" onClick={gerar} disabled={!notas.trim() || busy}><Icon name="sparkle" />{busy ? t.generation : t.generer}</Button>
              <Button onClick={() => { setMode('cta'); setResult('') }}>{t.annuler}</Button>
            </div>
            {(busy || result) && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--v54-line)', paddingTop: 16 }}>
                {busy ? (
                  <div style={{ fontSize: 13, color: 'var(--v54-navy-300)' }}>{t.redaction}</div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)' }}>{result}</div>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  )
}
