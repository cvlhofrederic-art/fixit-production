'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { MAPA_QUOTAS_MESSAGES, type EtatQuota, type LigneQuotaDemo } from './i18n/ModMapaQuotas.messages'

/** Mapa de Quotas — port byte-exact du ModMapaQuotas du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

type Row = LigneQuotaDemo & { kind: PillKind }

const ETAT_KIND: Record<EtatQuota, PillKind> = { emDia: 'sage', atraso: 'amber', divida: 'rust' }

const fmtEUR = (v: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v)

/** Statut depuis le solde (convention ancien dashboard : < 0 = doit). */
function soldeEstado(solde: number): EtatQuota {
  if (solde <= -1000) return 'divida'
  if (solde < 0) return 'atraso'
  return 'emDia'
}

function coproToRow(c: Coprop, enDette: (montant: string) => string, locale: V54Locale): Row {
  const solde = c.solde ?? 0
  const estado = soldeEstado(solde)
  return {
    frac: [c.immeuble, c.batiment, c.numeroPorte].filter(Boolean).join(' · ') || '—',
    cond: c.proprietario || '—',
    perm: c.tantieme ?? 0,
    area: 0,
    quota: '0,00 €',
    fcr: '0,00 €',
    total: '0,00 €',
    estado,
    kind: ETAT_KIND[estado],
    detalhe: solde < 0 ? enDette(fmtEUR(Math.abs(solde), locale)) : undefined,
  }
}

export default function ModMapaQuotas() {
  const t = useMessages(MAPA_QUOTAS_MESSAGES)
  const locale = useV54Locale()
  const soon = useComingSoon()
  // Phase 2 : quotas réelles du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const copros = data.coproprios ?? []
  const rows: Row[] = real ? copros.map((c) => coproToRow(c, t.enDette, locale)) : t.demo.map((r) => ({ ...r, kind: ETAT_KIND[r.estado] }))
  const dividaTotal = real ? copros.filter((c) => (c.solde ?? 0) < 0).reduce((s, c) => s + Math.abs(c.solde ?? 0), 0) : 3960
  const emDia = real ? copros.filter((c) => (c.solde ?? 0) >= 0).length : 8
  const taxaCobranca = real ? (copros.length ? Math.round((emDia / copros.length) * 100) : 100) : 66.7
  const ch = t.champs
  const c = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Pill kind={dividaTotal > 0 ? 'rust' : 'sage'} noDot>{t.detteTotale}{fmtEUR(dividaTotal, locale)}</Pill>} />
      <Tabs defaultActive="map" tabs={[
        { id: 'map', icon: 'coin', label: t.onglets.map },
        { id: 'sim', label: t.onglets.sim },
        { id: 'cob', icon: 'clipboard', label: t.onglets.cob },
        { id: 'rel', icon: 'chart', label: t.onglets.rel },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '48 000,00 €', lbl: t.kpi.budget, sub: t.kpi.budgetSous },
        { icon: 'bank', num: '0,00 €', lbl: t.kpi.fcr, sub: t.kpi.fcrSous, accent: 'gold' },
        { icon: 'chart', num: '0,00 €', lbl: t.kpi.quota, sub: t.kpi.quotaSous },
        { icon: 'chart', num: t.kpi.taux(taxaCobranca), lbl: t.kpi.tauxLbl, sub: real ? t.kpi.tauxSous(emDia, copros.length - emDia) : t.kpi.tauxSous(8, 4), accent: 'sage' },
      ]} />
      <Panel>
        <div className={m.cardGrid3} style={{ marginBottom: 14 }}>
          <div><label htmlFor="mq-orc" style={fieldLabel}>{ch.budget}</label><input id="mq-orc" defaultValue="48000" style={fieldCtrl} /></div>
          <div><label htmlFor="mq-fcr" style={fieldLabel}>{ch.fcr}</label><input id="mq-fcr" type="range" min="0" max="100" defaultValue="50" aria-label={ch.valeurAria} style={fieldCtrl} /></div>
          <div><label htmlFor="mq-modo" style={fieldLabel}>{ch.mode}</label><div id="mq-modo" style={{ display: 'flex', gap: 4 }}><Button size="sm" style={{ flex: 1 }} onClick={soon(t.modes.fixa.titre, t.modes.fixa.desc)}>{ch.fixa}</Button><Button size="sm" style={{ flex: 1 }} onClick={soon(t.modes.area.titre, t.modes.area.desc)}>{ch.area}</Button><Button size="sm" variant="primary" style={{ flex: 1 }} onClick={soon(t.modes.perm.titre, t.modes.perm.desc)}>{ch.perm}</Button></div></div>
        </div>
      </Panel>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.frac}</th><th>{c.cond}</th><th>{c.perm}</th><th>{c.area}</th><th>{c.quota}</th><th>{c.fcr}</th><th>{c.total}</th><th>{c.estado}</th></tr></thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={i}>
                  <td><b>{q.frac}</b></td>
                  <td>{q.cond}</td>
                  <td className={m.numCell}>{q.perm}</td>
                  <td className={m.numCell}>{q.area}</td>
                  <td className={m.numCell}>{q.quota}</td>
                  <td className={m.numCell}>{q.fcr}</td>
                  <td className={m.numCell}>{q.total}</td>
                  <td><Pill kind={q.kind} noDot>● {t.etats[q.estado]}</Pill>{q.detalhe && <div style={{ fontSize: 11, color: 'var(--v54-rust-700)', marginTop: 2 }}>{q.detalhe}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
