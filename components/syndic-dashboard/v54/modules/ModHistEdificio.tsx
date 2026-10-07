'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { HIST_EDIFICIO_MESSAGES } from './i18n/ModHistEdificio.messages'

/** Histórico Edifício — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Phase 3 : vue consolidée par édifice calculée (lecture seule) — intervenções (data.missions),
 * equipamentos (data.elevadores), contratos (data.contratos), filtrés par édifice sélectionné.
 * Aucune nouvelle table/route. Anonyme → preview illustratif inchangé. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)

const EQUIP_KIND: Record<string, PillKind> = { conforme: 'sage', prazo: 'amber', atraso: 'rust' }
const CONTRATO_KIND: Record<string, PillKind> = { ativo: 'sage', renovacao: 'amber', expirado: 'rust' }
const estadoMissaoKind = (s: string): PillKind => (s === 'terminee' ? 'sage' : s === 'annulee' ? 'rust' : 'amber')

export default function ModHistEdificio() {
  const t = useMessages(HIST_EDIFICIO_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const immeubles = real ? (data.immeubles ?? []) : []
  const [active, setActive] = useState<string>('')

  // Édifice sélectionné (1er par défaut) — clé de jointure = nom (missions/elevadores/contratos référencent par nom).
  const selId = active || immeubles[0]?.id || ''
  const selImm = immeubles.find((im) => im.id === selId)
  const selNom = selImm?.nom ?? ''

  const intervencoes = real ? (data.missions ?? []).filter((mi) => mi.immeuble === selNom) : []
  const equipamentos = real ? (data.elevadores ?? []).filter((e) => e.immeuble === selNom) : []
  const contratos = real ? (data.contratos ?? []).filter((c) => c.immeuble === selNom) : []
  const contratosAtivos = contratos.filter((c) => c.statut === 'ativo').length

  const estadoMissaoLabel = (s: string) => t.statutsMission[s] || s
  const ti = t.interventions
  const te = t.equipements
  const tc = t.contrats

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs
        active={real ? selId : undefined}
        onChange={real ? setActive : undefined}
        defaultActive={real ? undefined : 'aurora'}
        tabs={real
          ? (immeubles.length ? immeubles.map((im) => ({ id: im.id, icon: 'building' as const, label: im.nom })) : [{ id: '', icon: 'building' as const, label: t.aucunImmeuble }])
          : [
              { id: 'aurora', icon: 'building', label: t.ongletsDemo.aurora },
              { id: 'belavista', icon: 'building', label: t.ongletsDemo.belavista },
              { id: 'cedofeita', icon: 'building', label: t.ongletsDemo.cedofeita },
            ]}
      />
      <KPIGrid items={[
        { icon: 'wrench', num: real ? intervencoes.length : 28, lbl: t.kpi.interventions },
        { icon: 'monitor', num: real ? equipamentos.length : 6, lbl: t.kpi.equipements, accent: 'gold' },
        { icon: 'handshake', num: real ? contratosAtivos : 3, lbl: t.kpi.contratsActifs, accent: 'sage' },
        { icon: 'coin', num: real ? fmtEUR(selImm?.depensesAnnee ?? 0, locale) : t.kpi.coutCumuleDemo, lbl: t.kpi.coutCumule },
      ]} />
      <Panel title={ti.titre} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{ti.colonnes.date}</th><th>{ti.colonnes.intervention}</th><th>{ti.colonnes.prestataire}</th><th>{ti.colonnes.cout}</th><th>{ti.colonnes.statut}</th></tr></thead>
            <tbody>
              {real ? (
                intervencoes.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>{ti.vide}</td></tr>
                  : intervencoes.map((mi) => (
                      <tr key={mi.id}>
                        <td className={m.numCell}>{mi.dateIntervention || mi.dateCreation || '—'}</td>
                        <td><b>{mi.type || mi.description || ti.parDefaut}</b></td>
                        <td>{mi.artisan || '—'}</td>
                        <td className={m.numCell}>{(mi.montantFacture ?? mi.montantDevis) ? fmtEUR(mi.montantFacture ?? mi.montantDevis ?? 0, locale) : '—'}</td>
                        <td><Pill kind={estadoMissaoKind(mi.statut)} noDot>{estadoMissaoLabel(mi.statut)}</Pill></td>
                      </tr>
                    ))
              ) : t.demo.interventions.map((r, i) => (
                <tr key={i}><td className={m.numCell}>{r[0]}</td><td><b>{r[1]}</b></td><td>{r[2]}</td><td className={m.numCell}>{r[3]}</td><td><Pill kind="sage" noDot>{ti.termineeDemo}</Pill></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={te.titre} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{te.colonnes.equipement}</th><th>{te.colonnes.etatTechnique}</th><th>{te.colonnes.conformite}</th><th>{te.colonnes.prochaineAction}</th></tr></thead>
            <tbody>
              {real ? (
                equipamentos.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>{te.vide}</td></tr>
                  : equipamentos.map((e) => (
                      <tr key={e.id}>
                        <td><b>{e.marca || te.parDefaut}</b></td>
                        <td>{e.ultimaInspecao ? te.derniereInspection(e.ultimaInspecao) : '—'}</td>
                        <td><Pill kind={EQUIP_KIND[e.estado] ?? 'amber'} noDot>{t.conformiteEquipement[e.estado] ?? e.estado}</Pill></td>
                        <td>{e.proximaInspecao ? te.prochaine(e.proximaInspecao) : '—'}</td>
                      </tr>
                    ))
              ) : t.demo.equipements.map((r, i) => (
                <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td><Pill kind={r[4]} noDot>{r[2]}</Pill></td><td>{r[3]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={tc.titre} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{tc.colonnes.contrat}</th><th>{tc.colonnes.prestataire}</th><th>{tc.colonnes.montant}</th><th>{tc.colonnes.validite}</th></tr></thead>
            <tbody>
              {real ? (
                contratos.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>{tc.vide}</td></tr>
                  : contratos.map((c) => (
                      <tr key={c.id}>
                        <td><b>{t.categoriesContrat[c.categoria] ?? c.categoria}</b></td>
                        <td>{c.fornecedor || '—'}</td>
                        <td className={m.numCell}>{c.custoAnual ? tc.parAn(fmtEUR(c.custoAnual, locale)) : c.custoMensal ? tc.parMois(fmtEUR(c.custoMensal, locale)) : '—'}</td>
                        <td><Pill kind={CONTRATO_KIND[c.statut] ?? 'amber'} noDot>{c.dataFim ? tc.jusquau(c.dataFim) : tc.statut(c.statut)}</Pill></td>
                      </tr>
                    ))
              ) : t.demo.contrats.map((r, i) => (
                <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td className={m.numCell}>{r[2]}</td><td><Pill kind={r[4]} noDot>{r[3]}</Pill></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
