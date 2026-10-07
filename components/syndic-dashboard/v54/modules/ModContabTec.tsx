'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { CONTAB_TEC_MESSAGES } from './i18n/ModContabTec.messages'

/** Contabilidade Técnica — port byte-exact V5.7 + Phase 3 : suivi des interventions calculé
 * (lecture seule) depuis data.missions (déjà câblé). Aucune nouvelle table/route. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

const prioKind = (p: string): PillKind | undefined => (p === 'urgente' ? 'rust' : undefined)
/** Couleur du statut, d'après le code de la mission (terminée ou en cours → vert). */
const estadoKind = (s: string): PillKind => (s === 'terminee' || s === 'en_cours' ? 'sage' : 'amber')

export default function ModContabTec() {
  const t = useMessages(CONTAB_TEC_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const missions = real ? (data.missions ?? []) : []
  const valOf = (mi: { montantFacture?: number; montantDevis?: number }) => mi.montantFacture ?? mi.montantDevis ?? 0
  const prioLabel = (p: string) => t.priorites[p] || p
  const statutLabel = (s: string) => t.statuts[s] || s

  // Agrégation par professionnel (artisan) pour le tableau « Por profissional ».
  const byPro = (() => {
    const map = new Map<string, { n: number; total: number }>()
    for (const mi of missions) {
      const key = mi.artisan?.trim() || t.aAttribuer
      const e = map.get(key) || { n: 0, total: 0 }
      e.n += 1; e.total += valOf(mi); map.set(key, e)
    }
    return [...map.entries()].map(([nome, e]) => [nome, e.n, fmtEUR(e.total, locale), fmtEUR(e.n ? e.total / e.n : 0, locale)] as (string | number)[])
  })()
  const totalMontant = missions.reduce((s, mi) => s + valOf(mi), 0)
  const concluidas = missions.filter((mi) => mi.statut === 'terminee').length
  const emCurso = missions.filter((mi) => mi.statut === 'en_cours').length

  const f = t.filtres
  const cp = t.colonnesPrestataire
  const cd = t.colonnesDetail
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <select aria-label={f.prestataireAria} style={selectStyle}><option>{f.prestataireTous}</option></select>
        <select aria-label={f.immeubleAria} style={selectStyle}><option>{f.immeubleTous}</option></select>
        <select aria-label={f.statutAria} style={selectStyle}><option>{f.statutTous}</option></select>
        <select aria-label={f.periodeAria} style={selectStyle}><option>{f.periodeTout}</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'clipboard', num: real ? missions.length : 12, lbl: t.kpi.interventions },
        { icon: 'check', num: real ? concluidas : 2, lbl: t.kpi.terminees, accent: 'sage' },
        { icon: 'cog', num: real ? emCurso : 4, lbl: t.kpi.enCours, accent: 'amber' },
        { icon: 'coin', num: real ? fmtEUR(totalMontant, locale).replace('€', '').trim() : '0', cur: '€', lbl: t.kpi.montantTotal, accent: 'gold' },
      ]} />
      <Panel title={t.parPrestataire} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{cp.prestataire}</th><th>{cp.missions}</th><th>{cp.montant}</th><th>{cp.moyenne}</th></tr></thead>
            <tbody>
              {(real ? byPro : t.demoPrestataires).map((p, i) => (
                <tr key={`${p[0]}-${i}`}><td><b>{p[0]}</b></td><td>{p[1]}</td><td>{p[2]}</td><td>{p[3]}</td></tr>
              ))}
              <tr style={{ background: 'var(--v54-cream)' }}>
                <td><b>{t.total}</b></td><td><b>{real ? missions.length : 12}</b></td><td><b style={{ color: 'var(--v54-gold-700)' }}>{real ? fmtEUR(totalMontant, locale) : '0 €'}</b></td><td><b>{real ? fmtEUR(missions.length ? totalMontant / missions.length : 0, locale) : '0 €'}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.detail(real ? missions.length : 12)} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{cd.date}</th><th>{cd.immeuble}</th><th>{cd.type}</th><th>{cd.prestataire}</th><th>{cd.priorite}</th><th>{cd.statut}</th><th>{cd.montant}</th></tr></thead>
            <tbody>
              {real ? (
                missions.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>{t.aucuneIntervention}</td></tr>
                ) : missions.map((mi) => (
                  <tr key={mi.id}>
                    <td className={m.numCell}>{mi.dateIntervention || mi.dateCreation || '—'}</td><td>{mi.immeuble || '—'}</td><td>{mi.type || '—'}</td><td>{mi.artisan || '—'}</td>
                    <td><Pill kind={prioKind(mi.priorite)} noDot>{prioLabel(mi.priorite)}</Pill></td>
                    <td><Pill kind={estadoKind(mi.statut)} noDot>{statutLabel(mi.statut)}</Pill></td>
                    <td className={m.numCell}>{valOf(mi) ? fmtEUR(valOf(mi), locale) : '—'}</td>
                  </tr>
                ))
              ) : t.demoInterventions.map((r, i) => (
                <tr key={`${r.date}-${r.immeuble}-${r.type}-${i}`}>
                  <td className={m.numCell}>{r.date}</td><td>{r.immeuble}</td><td>{r.type}</td><td>{r.prestataire}</td>
                  <td><Pill kind={prioKind(r.priorite)} noDot>{prioLabel(r.priorite)}</Pill></td>
                  <td><Pill kind={estadoKind(r.statut)} noDot>{statutLabel(r.statut)}</Pill></td>
                  <td className={m.numCell}>{r.montant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
