'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { jourCivilLocal } from '@/lib/syndic/v54/i18n/dates'
import { RELATORIO_MENSAL_MESSAGES, type InterventionRapport, type StatRapport } from './i18n/ModRelatorioMensal.messages'

/** Relatório Mensal — port byte-exact du ModRelatorioMensal du bundle V5.7 (aperçu PDF) + Phase 3 :
 * aperçu calculé (lecture seule) depuis data.missions filtrées par mois, avec sélecteurs Mês/Ano
 * contrôlés. Agrégats budget depuis data.immeubles. Aucune nouvelle table/route. Anonyme → preview. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const isoToBR = (iso: string) => { const [y, mo, d] = iso.split('-'); return d ? `${d}/${mo}/${y}` : iso }

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldSelect = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

export default function ModRelatorioMensal() {
  const t = useMessages(RELATORIO_MENSAL_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const { push } = useToast()
  const emDesenvolvimento = (title: string) => push({ kind: 'info', title, desc: t.enDeveloppement })
  const monthName = (mm: string) => t.mois[(parseInt(mm, 10) || 1) - 1] ?? mm
  const missions = real ? (data.missions ?? []) : []
  const immeubles = real ? (data.immeubles ?? []) : []
  const valOf = (mi: { montantFacture?: number; montantDevis?: number }) => mi.montantFacture ?? mi.montantDevis ?? 0
  const keyOf = (mi: { dateIntervention?: string; dateCreation?: string }) => (mi.dateIntervention || mi.dateCreation || '').slice(0, 7)

  // Périodes disponibles (YYYY-MM) triées récentes d'abord ; défaut = la plus récente sinon mois courant.
  const periods = [...new Set(missions.map(keyOf).filter(Boolean))].sort().reverse()
  const fallback = jourCivilLocal().slice(0, 7)
  const [sel, setSel] = useState<string>('')
  const period = sel || periods[0] || fallback
  const selYear = period.slice(0, 4)
  const selMonth = period.slice(5, 7)
  const years = [...new Set([...periods.map((p) => p.slice(0, 4)), selYear])].sort().reverse()
  const monthsOfYear = [...new Set(periods.filter((p) => p.startsWith(selYear)).map((p) => p.slice(5, 7)))].sort().reverse()
  const monthOptions = monthsOfYear.length ? monthsOfYear : [selMonth]

  const filtered = missions.filter((mi) => keyOf(mi) === period)
  const montantObras = filtered.reduce((s, mi) => s + valOf(mi), 0)
  const orcAnual = immeubles.reduce((s, im) => s + (im.budgetAnnuel || 0), 0)
  const despAno = immeubles.reduce((s, im) => s + (im.depensesAnnee || 0), 0)
  const consumido = orcAnual > 0 ? t.pourcentage(Math.round((despAno / orcAnual) * 100)) : '—'

  const st = t.stats
  const stats: readonly StatRapport[] = real
    ? [[String(immeubles.length), st.immeubles, 'gold'], [String(filtered.length), st.interventionsMois, 'gold'], [fmtEUR(montantObras, locale), st.montantTravaux, 'sage'], [consumido, st.budgetConsomme, 'sage']]
    : t.demo.stats
  const interv: readonly InterventionRapport[] = real
    ? filtered.map((mi) => [`${mi.immeuble || '—'} — ${mi.type || mi.description || t.intervention}`, mi.artisan || '—', isoToBR(mi.dateIntervention || mi.dateCreation || ''), (mi.montantFacture ?? mi.montantDevis) ? fmtEUR(valOf(mi), locale) : '0 €'] as const)
    : t.demo.interventions
  const periodLabel = real ? `${monthName(selMonth)} ${selYear}` : t.demo.periode
  const geradoA = real ? isoToBR(fallback + '-' + String(new Date().getDate()).padStart(2, '0')) : '24/05/2026'

  const exportPdf = () => {
    if (!real) { push({ kind: 'info', title: t.telecharger, desc: t.connexionRequise }); return }
    downloadReportPdf(t.pdf.fichier(period), {
      title: t.pdf.titre,
      subtitle: t.pdf.sousTitre,
      periodLabel,
      kpis: stats.map((s) => ({ label: s[1], value: s[0] })),
      tables: [{ caption: t.pdf.tableau, headers: [...t.pdf.colonnes], rows: interv.map((r) => [r[0], r[1], r[2], r[3]]) }],
    }, locale)
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="rm-mes" style={fieldLabel}>{t.champMois}</label>
            {real ? (
              <select id="rm-mes" aria-label={t.champMois} style={fieldSelect} value={monthName(selMonth)} onChange={(e) => setSel(`${selYear}-${monthOptions[e.target.selectedIndex] ?? selMonth}`)}>
                {monthOptions.map((mm) => <option key={mm}>{monthName(mm)}</option>)}
              </select>
            ) : (
              <select id="rm-mes" style={fieldSelect}>{t.demo.mois.map((mo) => <option key={mo}>{mo}</option>)}</select>
            )}
          </div>
          <div>
            <label htmlFor="rm-ano" style={fieldLabel}>{t.champAnnee}</label>
            {real ? (
              <select id="rm-ano" aria-label={t.champAnnee} style={fieldSelect} value={selYear} onChange={(e) => { const y = e.target.value; const first = periods.find((p) => p.startsWith(y)); setSel(first || `${y}-${selMonth}`) }}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            ) : (
              <select id="rm-ano" style={fieldSelect}><option>2026</option></select>
            )}
          </div>
          <Button onClick={() => emDesenvolvimento(t.envoiEmail)}><Icon name="mail" />{t.envoyer}</Button>
          <Button variant="gold" onClick={exportPdf}><Icon name="download" />{t.telecharger}</Button>
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '8px 0 14px' }}>{t.apercu}</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 6 }}>{t.rapportTitre}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 34 }}>{periodLabel}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>{t.genereLe}{geradoA}</div></div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {stats.map((k) => (
            <div key={k[1]} style={{ textAlign: 'center', padding: 18, borderRadius: 12, background: k[2] === 'sage' ? 'var(--v54-sage-50)' : 'var(--v54-gold-50)' }}>
              <div style={{ ...serif, fontSize: 34, fontWeight: 500 }}>{k[0]}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{k[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ ...serif, fontSize: 17, marginBottom: 12, fontWeight: 500 }}>{t.interventionsMois}</div>
          {interv.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--v54-navy-300)' }}>{t.aucuneIntervention}</div>
          ) : interv.map((r, i) => (
            <div key={`${r[0]}-${i}`} style={{ padding: '10px 0', borderBottom: i < interv.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div><b>{r[0]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r[1]} · {r[2]}</div></div>
              <div style={{ fontWeight: 600 }}>{r[3]}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
