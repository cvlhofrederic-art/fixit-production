'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { downloadReportPdf, type ReportModel } from '@/lib/syndic/v54/report-pdf'

const MES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Relatório de Gestão — port byte-exact du ModRelGestao du bundle V5.7 + Phase 3 :
 * pré-remplissage du formulaire + preview avec les agrégats réels (lecture seule) depuis
 * data.immeubles (édifices/budget/dépenses) + data.missions (intervenções/montant obras).
 * Aucune nouvelle table/route. Champs éditables (le syndic peut ajuster). Anonyme → zéros d'origine. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

type Field = readonly [string, string, boolean]
const FIELDS: readonly Field[] = [
  ['Edifícios geridos', '0', false],
  ['Intervenções do mês', '0', false],
  ['Montante obras (€)', '0', false],
  ['Orçamento anual (€)', '0', false],
  ['Despesas do ano (€)', '0', false],
  ['Orçamento consumido', '—', true],
]

const STATS = [['0', 'Edifícios'], ['0', 'Intervenções'], ['0 €', 'Montante obras'], ['—', 'Orçamento consumido']] as const

export default function ModRelGestao() {
  const data = useSyndicData()
  const real = data.authenticated
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
  const consumido = orcAnual > 0 ? `${Math.round((despAno / orcAnual) * 100)}%` : '—'

  const fields: readonly Field[] = real
    ? [
        ['Edifícios geridos', String(nEdif), false],
        ['Intervenções do mês', String(intervMes), false],
        ['Montante obras (€)', String(montantObras), false],
        ['Orçamento anual (€)', String(orcAnual), false],
        ['Despesas do ano (€)', String(despAno), false],
        ['Orçamento consumido', consumido, true],
      ]
    : FIELDS
  const stats: readonly (readonly [string, string])[] = real
    ? [[String(nEdif), 'Edifícios'], [String(nInterv), 'Intervenções'], [fmtEUR(montantObras), 'Montante obras'], [consumido, 'Orçamento consumido']]
    : STATS
  // Remount des inputs non-contrôlés quand les données async arrivent (defaultValue ne se met pas à jour seul).
  const formKey = real ? `r-${nEdif}-${nInterv}-${despAno}-${orcAnual}-${montantObras}` : 'anon'

  const { push } = useToast()
  // Modèle PDF = reproduction fidèle de l'aperçu (4 KPIs + détail orçamental), période = mois courant.
  const buildModel = (): ReportModel => {
    const now = new Date()
    return {
      docTitle: 'Relatório de Gestão',
      periodLabel: `${MES_PT[now.getMonth()]} ${now.getFullYear()}`,
      geradoA: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
      stats: stats.map((s, i) => ({ value: s[0], label: s[1], tone: i < 2 ? 'gold' : 'sage' })),
      sectionTitle: 'Detalhe orçamental',
      rows: [
        { label: 'Orçamento anual', sub: 'Aprovado em assembleia', montante: fmtEUR(orcAnual) },
        { label: 'Despesas do ano', sub: `${consumido} do orçamento consumido`, montante: fmtEUR(despAno) },
      ],
      legal: 'Documento gerado por Vitfix.io · Prestação de contas (Art.º 1436.º CC · Lei 8/2022)',
    }
  }
  const baixarPdf = async () => {
    if (!real) { push({ kind: 'info', title: 'Pré-visualização', desc: 'Conecte-se como síndico para gerar o PDF com os seus dados.' }); return }
    try {
      await downloadReportPdf(buildModel(), 'relatorio-gestao.pdf')
      push({ kind: 'success', title: 'PDF gerado', desc: 'Relatório de gestão descarregado.' })
    } catch (err) {
      console.error('[ModRelGestao] geração do PDF falhou', err)
      push({ kind: 'error', title: 'Erro', desc: 'Não foi possível gerar o PDF.' })
    }
  }

  return (
    <>
      <PageHead title="Relatório de Gestão" lede="Relatório anual · Prestação de contas · Art.° 1436.° CC · Lei 8/2022" />
      <Alert kind="gold" icon="scale" title="Relatório de Gestão — Art.° 1436.° do Código Civil">
        O administrador do condomínio é obrigado a prestar contas à assembleia de condóminos (Lei 8/2022). Este relatório facilita a prestação de contas mensal e anual.
      </Alert>
      <Panel
        title="Dados do período — Abril 2026"
        right={<>
          <select aria-label="Mês" style={selectStyle}><option>Abril</option></select>
          <select aria-label="Ano" style={selectStyle}><option>2026</option></select>
          <Button variant="gold" onClick={baixarPdf}><Icon name="download" />Descarregar PDF</Button>
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
          <label htmlFor="rg-obs" style={fieldLabel}>Observações</label>
          <textarea id="rg-obs" rows={3} placeholder="Notas adicionais, alertas regulamentares, decisões pendentes…" style={fieldCtrl} />
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '10px 0 14px' }}>Pré-visualização do relatório</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600 }}>Relatório Mensal de Gestão</div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 32 }}>Abril 2026</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>Gerado a 24/05/2026</div></div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {stats.map((k, i) => (
            <div key={k[1]} style={{ textAlign: 'center', padding: 18, borderRadius: 12, background: i < 2 ? 'var(--v54-gold-50)' : 'var(--v54-sage-50)' }}>
              <div style={{ ...serif, fontSize: 34 }}>{k[0]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{k[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 24px', color: 'var(--v54-navy-300)', fontSize: 13, textAlign: 'center', paddingBottom: 24 }}>Preencha os dados acima para gerar o relatório de gestão de Abril 2026</div>
      </div>
    </>
  )
}
