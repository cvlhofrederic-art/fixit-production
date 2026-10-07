'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { OC_CLASSIF_MESSAGES } from './i18n/ModOcClassif.messages'

/** Ocorrências — Classificador IA (Alfredo). Texte libre → classification Groq
 * (catégorie, priorité, localisation, résumé, suggestion). Anonyme = preview byte-exact. */

interface Classificacao { categoria?: string; prioridade?: string; localizacao?: string; resumo?: string; sugestao?: string }
const prioKind = (p?: string): PillKind => (p === 'urgente' ? 'rust' : p === 'alta' ? 'amber' : p === 'baixa' ? 'sage' : 'gold')

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const resLabel = { fontSize: 10.5, fontWeight: 600, color: 'var(--v54-navy-300)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 } as const

export default function ModOcClassif() {
  const t = useMessages(OC_CLASSIF_MESSAGES)
  const soon = useComingSoon()
  const { push } = useToast()
  const data = useSyndicData()
  const real = data.authenticated
  const [edificio, setEdificio] = useState('')
  const [descricao, setDescricao] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Classificacao | null>(null)

  const analisar = () => {
    if (descricao.trim().length < 8) { push({ kind: 'info', title: t.toasts.descriptionTitre, desc: t.toasts.descriptionCourte }); return }
    if (!real || !data.token) { push({ kind: 'info', title: t.toasts.classificateur, desc: t.toasts.connexionRequise }); return }
    setBusy(true)
    fetch('/api/syndic/oc-classif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ edificio, descricao, locale: t.langueApi }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => setResult((d.classificacao as Classificacao) || {}))
      .catch(() => push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.echec }))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <div className={m.cardGrid}>
        <Panel>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-ed" style={fieldLabel}>{t.immeuble}</label><select id="oc-ed" aria-label={t.immeuble} style={fieldCtrl} value={edificio} onChange={(e) => setEdificio(e.target.value)}><option value="">{t.selectionnerImmeuble}</option>{real && (data.immeubles ?? []).map((im) => <option key={im.id} value={im.nom}>{im.nom}</option>)}</select></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="oc-desc" style={fieldLabel}>{t.description}</label><textarea id="oc-desc" rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t.descriptionPlaceholder} style={fieldCtrl} /></div>
          <Button onClick={soon(t.ajouterPhotoTitre)}><Icon name="image" />{t.ajouterPhoto}</Button>
          <Button variant="primary" style={{ width: '100%', marginTop: 14, padding: 14, justifyContent: 'center' }} disabled={busy} onClick={analisar}><Icon name="sparkle" />{busy ? t.analyseEnCours : t.analyser}</Button>
        </Panel>
        <Panel>
          {result ? (
            <div style={{ padding: '6px 4px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Pill kind="gold" noDot>{result.categoria ? t.categorie(result.categoria) : '—'}</Pill>
                <Pill kind={prioKind(result.prioridade)} noDot>{t.prioritePrefixe}{result.prioridade ? t.priorite(result.prioridade) : '—'}</Pill>
              </div>
              {([[t.resultat.localisation, result.localizacao], [t.resultat.resume, result.resumo], [t.resultat.suggestion, result.sugestao]] as const).map(([lbl, val]) => (
                <div key={lbl} style={{ marginBottom: 12 }}>
                  <div style={resLabel}>{lbl}</div>
                  <div style={{ fontSize: 13, color: 'var(--v54-ink)', lineHeight: 1.5 }}>{val || '—'}</div>
                </div>
              ))}
              <Button variant="primary" style={{ marginTop: 6 }} onClick={() => push({ kind: 'info', title: t.toasts.creerTitre, desc: t.toasts.creerBientot })}><Icon name="plus" />{t.creerIncident}</Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="bot" style={{ width: 54, height: 54 }} /></div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 8 }}>{t.initial.titre}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginBottom: 20 }}>{t.initial.texte}</div>
              <div style={{ textAlign: 'left', background: 'var(--v54-gold-50)', padding: 18, borderRadius: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--v54-gold-700)' }}>{t.initial.exemplesTitre}</div>
                <div style={{ color: 'var(--v54-navy-500)', lineHeight: 1.8 }}>
                  {t.initial.exemples[0]}<br />
                  {t.initial.exemples[1]}<br />
                  {t.initial.exemples[2]}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
