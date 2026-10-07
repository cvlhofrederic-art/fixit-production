'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { MAPA_FISCAL_MESSAGES, type CategorieContrat } from './i18n/ModMapaFiscal.messages'

/** Mapa Fiscal Anual — port byte-exact V5.7 + Phase 3 : rapport calculé (lecture seule) depuis
 * data.contratos (dépenses par catégorie) + data.faturas (recettes). Aucune nouvelle table/route. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
/** Catégories de contrat, dans l'ordre d'affichage (libellé et code de référence : dictionnaire). */
const CATEGORIES: CategorieContrat[] = ['limpezas', 'elevadores', 'jardinagem', 'seguranca', 'outros']

export default function ModMapaFiscal() {
  const t = useMessages(MAPA_FISCAL_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const contratos = real ? (data.contratos ?? []) : []
  const faturas = real ? (data.faturas ?? []) : []

  const totalDespesas = contratos.reduce((s, c) => s + (c.custoAnual || 0), 0)
  const totalReceitas = faturas.reduce((s, f) => s + (f.montantTtc || 0), 0)
  // Preview byte-exact (anonyme) : catégories standard à 0.
  const ROWS: (string | number)[][] = t.apercu.map((c) => [c.libelle, c.code, 0, '0,00 €', '—', c.derniere])
  // Lignes calculées : groupées par catégorie de contrat (≥ 1 contrat).
  const computedRows: (string | number)[][] = CATEGORIES.map((key) => {
    const { libelle, code, derniere } = t.categories[key]
    const list = contratos.filter((c) => c.categoria === key)
    const total = list.reduce((s, c) => s + (c.custoAnual || 0), 0)
    const pct = totalDespesas > 0 ? t.pct(Math.round((total / totalDespesas) * 100)) : '—'
    return [libelle, code, list.length, fmtEUR(total, locale), pct, derniere] as (string | number)[]
  }).filter((r) => (r[2] as number) > 0)

  const rows = real ? computedRows : ROWS
  const { push } = useToast()
  const exportar = () => {
    if (!real) { push({ kind: 'info', title: t.toasts.exportTitre, desc: t.toasts.connexionExport }); return }
    try {
      downloadCsv(t.csvFichier, t.colonnes, rows)
      push({ kind: 'success', title: t.toasts.exportReussi, desc: t.toasts.resumeExport(contratos.length, fmtEUR(totalDespesas, locale)) })
    } catch (err) {
      console.error('[ModMapaFiscal] export CSV falhou', err)
      push({ kind: 'error', title: t.toasts.erreur, desc: t.toasts.exportImpossible })
    }
  }

  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={() => push({ kind: 'info', title: 'Max Expert', desc: t.toasts.reclassementBientot })}><Icon name="bot" />{t.reclasser}</Button><Button variant="gold" onClick={exportar}><Icon name="download" />{t.exporter}</Button></>} />
      <Alert kind="sage" icon="check" title={t.alerte.titre}>
        {t.alerte.avant}<strong>{t.alerte.gras}</strong>{t.alerte.apres}
      </Alert>
      <KPIGrid items={[
        { icon: 'fact', num: real ? contratos.length + faturas.length : 0, lbl: t.kpi.ecritures },
        { icon: 'bot', num: t.pct(real && contratos.length ? 100 : 0), lbl: t.kpi.classementIA, accent: 'sage' },
        { icon: 'coin', num: real ? fmtEUR(totalDespesas, locale) : '0,00 €', lbl: t.kpi.totalDepenses },
        { icon: 'coin', num: real ? fmtEUR(totalReceitas, locale) : '0,00 €', lbl: t.kpi.totalRecettes },
        { icon: 'check', num: 'OK', lbl: t.kpi.rapprochement, accent: 'sage' },
        { icon: 'download', num: 0, lbl: t.kpi.exports },
      ]} />
      <Tabs defaultActive="2026" tabs={[
        { id: '2026', label: t.ongletEnCours },
        { id: '2025', label: '2025' },
        { id: '2024', label: '2024' },
      ]} />
      <Panel title={t.panneau} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr>{t.colonnes.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>{t.vide}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
