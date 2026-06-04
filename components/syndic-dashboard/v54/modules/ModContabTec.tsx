'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Contabilidade Técnica — port byte-exact V5.7 + Phase 3 : suivi des interventions calculé
 * (lecture seule) depuis data.missions (déjà câblé). Aucune nouvelle table/route. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
// Preview byte-exact (anonyme).
const INTERV = [
  ['22/05/2026', 'Edifício Foz Douro', 'Canalização', 'Bruno Tavares', 'normal', 'em espera', '—'],
  ['20/05/2026', 'Condomínio Boavista Center', 'Coordenação de obras', 'Bruno Tavares', 'normal', 'em curso', '—'],
  ['12/04/2026', 'Residencial Cedofeita', 'Inspeção técnica', 'Bruno Tavares', 'normal', 'concluída', '—'],
  ['18/05/2026', 'Condomínio Boavista Center', 'Pequenas reparações', 'Diogo Pereira', 'normal', 'em espera', '—'],
  ['29/04/2026', 'Edifício Atlântico', 'Manutenção corrente', 'Diogo Pereira', 'normal', 'concluída', '—'],
  ['17/05/2026', 'Edifício Atlântico', 'Pequenas reparações', 'Diogo Pereira', 'urgente', 'em curso', '—'],
  ['19/05/2026', 'Edifício Atlântico', 'Vistoria técnica', 'Bruno Tavares', 'normal', 'em curso', '—'],
  ['16/05/2026', 'Edifício Foz Douro', 'Pequenas reparações', 'Tiago Mendes', 'normal', 'em curso', '—'],
  ['—', 'Edifício Foz Douro', 'Manutenção corrente', '—', 'normal', 'em espera', '—'],
  ['—', 'Edifício Foz Douro', 'Eletricidade', '—', 'normal', 'em espera', '—'],
  ['—', 'Residencial Cedofeita', 'Construção', '—', 'normal', 'em espera', '—'],
  ['21/05/2026', 'Residencial Cedofeita', 'Manutenção corrente', 'Tiago Mendes', 'normal', 'em espera', '—'],
] as const
const BY_PRO = [
  ['Bruno Tavares', 4, '0 €', '0 €'],
  ['Diogo Pereira', 3, '0 €', '0 €'],
  ['Tiago Mendes', 2, '0 €', '0 €'],
  ['Por atribuir', 3, '0 €', '0 €'],
] as const

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

const prioLabel = (p: string) => (({ urgente: 'urgente', normale: 'normal', planifiee: 'planeada' } as Record<string, string>)[p] || p)
const statutLabel = (s: string) => (({ en_attente: 'em espera', acceptee: 'aceite', en_cours: 'em curso', terminee: 'concluída', annulee: 'anulada' } as Record<string, string>)[s] || s)
const prioKind = (p: string): PillKind | undefined => (p === 'urgente' ? 'rust' : undefined)
const estadoKind = (s: string): PillKind => (s === 'concluída' || s === 'em curso' ? 'sage' : 'amber')

export default function ModContabTec() {
  const data = useSyndicData()
  const real = data.authenticated
  const missions = real ? (data.missions ?? []) : []
  const valOf = (mi: { montantFacture?: number; montantDevis?: number }) => mi.montantFacture ?? mi.montantDevis ?? 0

  // Agrégation par professionnel (artisan) pour le tableau « Por profissional ».
  const byPro = (() => {
    const map = new Map<string, { n: number; total: number }>()
    for (const mi of missions) {
      const key = mi.artisan?.trim() || 'Por atribuir'
      const e = map.get(key) || { n: 0, total: 0 }
      e.n += 1; e.total += valOf(mi); map.set(key, e)
    }
    return [...map.entries()].map(([nome, e]) => [nome, e.n, fmtEUR(e.total), fmtEUR(e.n ? e.total / e.n : 0)] as (string | number)[])
  })()
  const totalMontant = missions.reduce((s, mi) => s + valOf(mi), 0)
  const concluidas = missions.filter((mi) => mi.statut === 'terminee').length
  const emCurso = missions.filter((mi) => mi.statut === 'en_cours').length

  return (
    <>
      <PageHead title="Contabilidade Técnica" lede="Acompanhamento das intervenções por profissional, condomínio e período" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <select aria-label="Filtrar por profissional" style={selectStyle}><option>Todos os profissionais</option></select>
        <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
        <select aria-label="Filtrar por estado" style={selectStyle}><option>Todos os estados</option></select>
        <select aria-label="Filtrar por período" style={selectStyle}><option>Todo o período</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'clipboard', num: real ? missions.length : 12, lbl: 'Intervenções' },
        { icon: 'check', num: real ? concluidas : 2, lbl: 'Concluídas', accent: 'sage' },
        { icon: 'cog', num: real ? emCurso : 4, lbl: 'Em curso', accent: 'amber' },
        { icon: 'coin', num: real ? fmtEUR(totalMontant).replace('€', '').trim() : '0', cur: '€', lbl: 'Montante total', accent: 'gold' },
      ]} />
      <Panel title="Por profissional" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Profissional</th><th>Missões</th><th>Montante</th><th>Méd./missão</th></tr></thead>
            <tbody>
              {(real ? byPro : BY_PRO).map((p, i) => (
                <tr key={`${p[0]}-${i}`}><td><b>{p[0]}</b></td><td>{p[1]}</td><td>{p[2]}</td><td>{p[3]}</td></tr>
              ))}
              <tr style={{ background: 'var(--v54-cream)' }}>
                <td><b>TOTAL</b></td><td><b>{real ? missions.length : 12}</b></td><td><b style={{ color: 'var(--v54-gold-700)' }}>{real ? fmtEUR(totalMontant) : '0 €'}</b></td><td><b>{real ? fmtEUR(missions.length ? totalMontant / missions.length : 0) : '0 €'}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={`Detalhe das intervenções (${real ? missions.length : 12})`} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Data</th><th>Edifício</th><th>Tipo</th><th>Profissional</th><th>Prioridade</th><th>Estado</th><th>Montante</th></tr></thead>
            <tbody>
              {real ? (
                missions.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>Nenhuma intervenção registada.</td></tr>
                ) : missions.map((mi) => (
                  <tr key={mi.id}>
                    <td className={m.numCell}>{mi.dateIntervention || mi.dateCreation || '—'}</td><td>{mi.immeuble || '—'}</td><td>{mi.type || '—'}</td><td>{mi.artisan || '—'}</td>
                    <td><Pill kind={prioKind(mi.priorite)} noDot>{prioLabel(mi.priorite)}</Pill></td>
                    <td><Pill kind={estadoKind(statutLabel(mi.statut))} noDot>{statutLabel(mi.statut)}</Pill></td>
                    <td className={m.numCell}>{valOf(mi) ? fmtEUR(valOf(mi)) : '—'}</td>
                  </tr>
                ))
              ) : INTERV.map((r, i) => (
                <tr key={`${r[0]}-${r[1]}-${r[2]}-${i}`}>
                  <td className={m.numCell}>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                  <td><Pill kind={prioKind(r[4])} noDot>{r[4]}</Pill></td>
                  <td><Pill kind={estadoKind(r[5])} noDot>{r[5]}</Pill></td>
                  <td className={m.numCell}>{r[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
