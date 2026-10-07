'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { REL_GESTAO_MESSAGES } from './i18n/ModRelGestao.messages'

/** Relatório de Gestão — port byte-exact du ModRelGestao du bundle V5.7 + Phase 3 :
 * pré-remplissage du formulaire + preview avec les agrégats réels (lecture seule) depuis
 * data.immeubles (édifices/budget/dépenses) + data.missions (intervenções/montant obras).
 * Aucune nouvelle table/route. Champs éditables (le syndic peut ajuster). Anonyme → zéros d'origine. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

type Field = readonly [string, string, boolean]

export default function ModRelGestao() {
  const t = useMessages(REL_GESTAO_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const immeubles = real ? (data.immeubles ?? []) : []
  const missions = real ? (data.missions ?? []) : []
  const valOf = (mi: { montantFacture?: number; montantDevis?: number }) => mi.montantFacture ?? mi.montantDevis ?? 0

  const curMonth = new Date().toISOString().slice(0, 7) // intervenções « do mês » = mois courant
  const nEdif = immeubles.length
  const nInterv = missions.length
  const intervMes = missions.filter((mi) => (mi.dateIntervention || mi.dateCreation || '').slice(0, 7) === curMonth).length
  const montantObras = missions.reduce((s, mi) => s + valOf(mi), 0)
  const orcAnual = immeubles.reduce((s, im) => s + (im.budgetAnnuel || 0), 0)
  const despAno = immeubles.reduce((s, im) => s + (im.depensesAnnee || 0), 0)
  const consumido = orcAnual > 0 ? t.pourcentage(Math.round((despAno / orcAnual) * 100)) : '—'

  const ch = t.champs
  const fields: readonly Field[] = real
    ? [
        [ch.immeublesGeres, String(nEdif), false],
        [ch.interventionsMois, String(intervMes), false],
        [ch.montantTravaux, String(montantObras), false],
        [ch.budgetAnnuel, String(orcAnual), false],
        [ch.depensesAnnee, String(despAno), false],
        [ch.budgetConsomme, consumido, true],
      ]
    : [
        [ch.immeublesGeres, '0', false],
        [ch.interventionsMois, '0', false],
        [ch.montantTravaux, '0', false],
        [ch.budgetAnnuel, '0', false],
        [ch.depensesAnnee, '0', false],
        [ch.budgetConsomme, '—', true],
      ]
  const st = t.stats
  const stats: readonly (readonly [string, string])[] = real
    ? [[String(nEdif), st.immeubles], [String(nInterv), st.interventions], [fmtEUR(montantObras, locale), st.montantTravaux], [consumido, st.budgetConsomme]]
    : [['0', st.immeubles], ['0', st.interventions], ['0 €', st.montantTravaux], ['—', st.budgetConsomme]]
  // Remount des inputs non-contrôlés quand les données async arrivent (defaultValue ne se met pas à jour seul).
  const formKey = real ? `r-${nEdif}-${nInterv}-${despAno}-${orcAnual}-${montantObras}` : 'anon'

  const exportPdf = () => {
    if (!real) { push({ kind: 'info', title: t.telecharger, desc: t.toastConnexion }); return }
    const obs = (document.getElementById('rg-obs') as HTMLTextAreaElement | null)?.value || ''
    downloadReportPdf(t.pdf.fichier, {
      title: t.pdf.titre,
      subtitle: t.pdf.sousTitre,
      kpis: fields.map((f) => ({ label: f[0], value: f[1] })),
      notes: obs || undefined,
    }, locale)
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Alert kind="gold" icon="scale" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <Panel
        title={t.periode}
        right={<>
          <select aria-label={t.moisAria} style={selectStyle}><option>{t.mois}</option></select>
          <select aria-label={t.anneeAria} style={selectStyle}><option>2026</option></select>
          <Button variant="gold" onClick={exportPdf}><Icon name="download" />{t.telecharger}</Button>
        </>}
      >
        <div className={m.cardGrid3} key={formKey}>
          {fields.map((f, i) => (
            <div key={f[0]}>
              <label htmlFor={`rg-${i}`} style={fieldLabel}>{f[0]}</label>
              <input id={`rg-${i}`} aria-label={f[0]} defaultValue={f[1]} style={f[2] ? { ...fieldCtrl, background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)' } : fieldCtrl} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <label htmlFor="rg-obs" style={fieldLabel}>{t.observations}</label>
          <textarea id="rg-obs" rows={3} placeholder={t.observationsPlaceholder} style={fieldCtrl} />
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '10px 0 14px' }}>{t.apercu}</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600 }}>{t.enteteApercu}</div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 32 }}>{t.periodeApercu}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>{t.genere}</div></div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {stats.map((k, i) => (
            <div key={k[1]} style={{ textAlign: 'center', padding: 18, borderRadius: 12, background: i < 2 ? 'var(--v54-gold-50)' : 'var(--v54-sage-50)' }}>
              <div style={{ ...serif, fontSize: 34 }}>{k[0]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{k[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 24px', color: 'var(--v54-navy-300)', fontSize: 13, textAlign: 'center', paddingBottom: 24 }}>{t.invitation}</div>
      </div>
    </>
  )
}
