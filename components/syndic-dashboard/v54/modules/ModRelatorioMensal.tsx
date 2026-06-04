'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Relatório Mensal — port byte-exact du ModRelatorioMensal du bundle V5.7 (aperçu PDF) + Phase 3 :
 * aperçu calculé (lecture seule) depuis data.missions filtrées par mois, avec sélecteurs Mês/Ano
 * contrôlés. Agrégats budget depuis data.immeubles. Aucune nouvelle table/route. Anonyme → preview. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const monthName = (mm: string) => MES[(parseInt(mm, 10) || 1) - 1] ?? mm
const nameToNum = (name: string) => String(MES.indexOf(name) + 1).padStart(2, '0')
const isoToBR = (iso: string) => { const [y, mo, d] = iso.split('-'); return d ? `${d}/${mo}/${y}` : iso }

const STATS = [
  ['4', 'Edifícios', 'gold'],
  ['2', 'Intervenções do mês', 'gold'],
  ['0 €', 'Montante obras', 'sage'],
  ['55%', 'Orçamento consumido', 'sage'],
] as const

const INTERV = [
  ['Residencial Cedofeita — Inspeção técnica', 'Bruno Tavares', '12/04/2026', '0 €'],
  ['Edifício Atlântico — Manutenção corrente', 'Diogo Pereira', '29/04/2026', '0 €'],
] as const

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldSelect = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

export default function ModRelatorioMensal() {
  const data = useSyndicData()
  const real = data.authenticated
  const missions = real ? (data.missions ?? []) : []
  const immeubles = real ? (data.immeubles ?? []) : []
  const valOf = (mi: { montantFacture?: number; montantDevis?: number }) => mi.montantFacture ?? mi.montantDevis ?? 0
  const keyOf = (mi: { dateIntervention?: string; dateCreation?: string }) => (mi.dateIntervention || mi.dateCreation || '').slice(0, 7)

  // Périodes disponibles (YYYY-MM) triées récentes d'abord ; défaut = la plus récente sinon mois courant.
  const periods = [...new Set(missions.map(keyOf).filter(Boolean))].sort().reverse()
  const fallback = new Date().toISOString().slice(0, 7)
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
  const consumido = orcAnual > 0 ? `${Math.round((despAno / orcAnual) * 100)}%` : '—'

  const stats: readonly (readonly [string, string, string])[] = real
    ? [[String(immeubles.length), 'Edifícios', 'gold'], [String(filtered.length), 'Intervenções do mês', 'gold'], [fmtEUR(montantObras), 'Montante obras', 'sage'], [consumido, 'Orçamento consumido', 'sage']]
    : STATS
  const interv: readonly (readonly [string, string, string, string])[] = real
    ? filtered.map((mi) => [`${mi.immeuble || '—'} — ${mi.type || mi.description || 'Intervenção'}`, mi.artisan || '—', isoToBR(mi.dateIntervention || mi.dateCreation || ''), (mi.montantFacture ?? mi.montantDevis) ? fmtEUR(valOf(mi)) : '0 €'] as const)
    : INTERV
  const periodLabel = real ? `${monthName(selMonth)} ${selYear}` : 'Abril 2026'
  const geradoA = real ? isoToBR(fallback + '-' + String(new Date().getDate()).padStart(2, '0')) : '24/05/2026'

  return (
    <>
      <PageHead title="Relatório Mensal" lede="Síntese mensal de gestão — descarregar PDF ou enviar aos condóminos" />
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="rm-mes" style={fieldLabel}>Mês</label>
            {real ? (
              <select id="rm-mes" aria-label="Mês" style={fieldSelect} value={monthName(selMonth)} onChange={(e) => setSel(`${selYear}-${nameToNum(e.target.value)}`)}>
                {monthOptions.map((mm) => <option key={mm}>{monthName(mm)}</option>)}
              </select>
            ) : (
              <select id="rm-mes" style={fieldSelect}><option>Abril</option><option>Maio</option></select>
            )}
          </div>
          <div>
            <label htmlFor="rm-ano" style={fieldLabel}>Ano</label>
            {real ? (
              <select id="rm-ano" aria-label="Ano" style={fieldSelect} value={selYear} onChange={(e) => { const y = e.target.value; const first = periods.find((p) => p.startsWith(y)); setSel(first || `${y}-${selMonth}`) }}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            ) : (
              <select id="rm-ano" style={fieldSelect}><option>2026</option></select>
            )}
          </div>
          <Button><Icon name="mail" />Enviar aos condóminos</Button>
          <Button variant="gold"><Icon name="download" />Descarregar PDF</Button>
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '8px 0 14px' }}>Pré-visualização do relatório — este conteúdo será gerado em PDF</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 6 }}>Relatório Mensal de Gestão</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 34 }}>{periodLabel}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>Gerado a {geradoA}</div></div>
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
          <div style={{ ...serif, fontSize: 17, marginBottom: 12, fontWeight: 500 }}>Intervenções do mês</div>
          {interv.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--v54-navy-300)' }}>Nenhuma intervenção neste mês.</div>
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
