'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { askAgent } from '@/lib/syndic/v54/api'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { ORC_IA_MESSAGES } from './i18n/ModOrcIA.messages'

/** Orçamento Anual com IA — port byte-exact V5.7 + Phase 3 : générateur câblé à l'agent Léa (lea-comptable).
 * Câblage UI → endpoint agent existant (aucun prompt modifié, conforme ai-agents.md). Layout préservé. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

export default function ModOrcIA() {
  const t = useMessages(ORC_IA_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const [edificio, setEdificio] = useState('')
  const [inflacao, setInflacao] = useState('3,2')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const gerar = () => {
    if (real && data.token) {
      setBusy(true)
      setResult('')
      const message = t.prompt(edificio, inflacao)
      askAgent('lea', message, data.token, locale)
        .then((text) => { setResult(text); push({ kind: 'success', title: t.toasts.genere, desc: t.toasts.pret }) })
        .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.indisponible }))
        .finally(() => setBusy(false))
      return
    }
    push({ kind: 'info', title: t.toasts.demo, desc: t.toasts.connexionRequise })
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: t.kpi.total },
        { icon: 'pencil', num: 0, lbl: t.kpi.brouillon, accent: 'amber' },
        { icon: 'check', num: 0, lbl: t.kpi.propose, accent: 'gold' },
        { icon: 'bank', num: 0, lbl: t.kpi.voteAG, accent: 'sage' },
      ]} />
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'bot', label: t.onglets.ger },
        { id: 'hist', icon: 'chart', label: t.onglets.hist },
        { id: 'cmp', icon: 'check', label: t.onglets.cmp },
        { id: 'apr', icon: 'check', label: t.onglets.apr },
      ]} />
      <Panel title={t.parametres}>
        <div className={m.cardGrid3}>
          <div><label htmlFor="orcia-ed" style={fieldLabel}>{t.immeuble}</label>
            <select id="orcia-ed" style={fieldCtrl} value={edificio} onChange={(e) => setEdificio(e.target.value)}>
              <option value="">{real && data.immeubles.length ? t.tousImmeubles : t.aucunImmeuble}</option>
              {real && data.immeubles.map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}
            </select>
          </div>
          <div><label htmlFor="orcia-inf" style={fieldLabel}>{t.inflation}</label><input id="orcia-inf" value={inflacao} onChange={(e) => setInflacao(e.target.value)} style={fieldCtrl} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Button variant="primary" style={{ width: '100%' }} onClick={gerar} disabled={busy}><Icon name="sparkle" />{busy ? t.generation : t.generer}</Button></div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>{t.aide}</div>
      </Panel>
      <Panel>
        {busy ? (
          <Empty illustration="faturas" title={t.chargement.titre} desc={t.chargement.texte} />
        ) : result ? (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--v54-ink)', padding: 4 }}>{result}</div>
        ) : (
          <Empty illustration="faturas" title={t.vide.titre} desc={t.vide.texte} />
        )}
      </Panel>
    </>
  )
}
