'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Histórico Edifício — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Phase 3 : vue consolidée par édifice calculée (lecture seule) — intervenções (data.missions),
 * equipamentos (data.elevadores), contratos (data.contratos), filtrés par édifice sélectionné.
 * Aucune nouvelle table/route. Anonyme → preview illustratif inchangé. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

const INTERVENCOES: Array<[string, string, string, string]> = [
  ['12/05/2026', 'Reparação canalização garagem', 'HidroPro Lda', '€ 480'],
  ['28/04/2026', 'Manutenção elevador anual', 'ElevaTech', '€ 1 250'],
  ['15/03/2026', 'Pintura do hall de entrada', 'ConstruFix', '€ 2 100'],
  ['02/02/2026', 'Substituição bomba de água', 'HidroPro Lda', '€ 890'],
]
const EQUIPAMENTOS: Array<[string, string, string, string, PillKind]> = [
  ['Elevador OTIS A', 'Última inspeção 28/04/2026', 'Conforme', 'Próxima: 04/2028', 'sage'],
  ['Central AVAC', 'Última inspeção 10/01/2026', 'Conforme', 'Próxima: 01/2027', 'sage'],
  ['Bomba de pressurização', 'Substituída 02/02/2026', 'Operacional', '—', 'sage'],
  ['Portão automático', 'Manutenção pendente', 'A agendar', 'Atraso 12 dias', 'amber'],
]
const CONTRATOS: Array<[string, string, string, string, PillKind]> = [
  ['Manutenção de elevadores', 'ElevaTech', '€ 1 250 / ano', 'Ativo até 12/2027', 'sage'],
  ['Limpeza de áreas comuns', 'CleanPro', '€ 380 / mês', 'Renovação 06/2026', 'amber'],
  ['Seguro multirriscos', 'Fidelidade', '€ 2 400 / ano', 'Ativo até 03/2027', 'sage'],
]

const EQUIP_KIND: Record<string, PillKind> = { conforme: 'sage', prazo: 'amber', atraso: 'rust' }
const EQUIP_LABEL: Record<string, string> = { conforme: 'Conforme', prazo: 'A regularizar', atraso: 'Não conforme' }
const CONTRATO_KIND: Record<string, PillKind> = { ativo: 'sage', renovacao: 'amber', expirado: 'rust' }
const CAT_LABEL: Record<string, string> = { limpezas: 'Limpeza de áreas comuns', elevadores: 'Manutenção de elevadores', seguranca: 'Segurança', jardinagem: 'Jardinagem', outros: 'Outros serviços' }
const estadoMissaoKind = (s: string): PillKind => (s === 'terminee' ? 'sage' : s === 'annulee' ? 'rust' : 'amber')
const estadoMissaoLabel = (s: string) => (({ en_attente: 'Em espera', acceptee: 'Aceite', en_cours: 'Em curso', terminee: 'Concluída', annulee: 'Anulada' } as Record<string, string>)[s] || s)

export default function ModHistEdificio() {
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

  return (
    <>
      <PageHead title="Histórico Edifício" lede="Vista consolidada por edifício — intervenções, equipamentos, contratos" />
      <Tabs
        active={real ? selId : undefined}
        onChange={real ? setActive : undefined}
        defaultActive={real ? undefined : 'aurora'}
        tabs={real
          ? (immeubles.length ? immeubles.map((im) => ({ id: im.id, icon: 'building' as const, label: im.nom })) : [{ id: '', icon: 'building' as const, label: 'Nenhum edifício' }])
          : [
              { id: 'aurora', icon: 'building', label: 'Edifício Aurora' },
              { id: 'belavista', icon: 'building', label: 'Edifício Bela Vista' },
              { id: 'cedofeita', icon: 'building', label: 'Residencial Cedofeita' },
            ]}
      />
      <KPIGrid items={[
        { icon: 'wrench', num: real ? intervencoes.length : 28, lbl: 'Intervenções totais' },
        { icon: 'monitor', num: real ? equipamentos.length : 6, lbl: 'Equipamentos', accent: 'gold' },
        { icon: 'handshake', num: real ? contratosAtivos : 3, lbl: 'Contratos ativos', accent: 'sage' },
        { icon: 'coin', num: real ? fmtEUR(selImm?.depensesAnnee ?? 0) : '€ 18 240', lbl: 'Custo acumulado 2026' },
      ]} />
      <Panel title="Intervenções recentes" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Data</th><th>Intervenção</th><th>Profissional</th><th>Custo</th><th>Estado</th></tr></thead>
            <tbody>
              {real ? (
                intervencoes.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>Nenhuma intervenção para este edifício.</td></tr>
                  : intervencoes.map((mi) => (
                      <tr key={mi.id}>
                        <td className={m.numCell}>{mi.dateIntervention || mi.dateCreation || '—'}</td>
                        <td><b>{mi.type || mi.description || 'Intervenção'}</b></td>
                        <td>{mi.artisan || '—'}</td>
                        <td className={m.numCell}>{(mi.montantFacture ?? mi.montantDevis) ? fmtEUR(mi.montantFacture ?? mi.montantDevis ?? 0) : '—'}</td>
                        <td><Pill kind={estadoMissaoKind(mi.statut)} noDot>{estadoMissaoLabel(mi.statut)}</Pill></td>
                      </tr>
                    ))
              ) : INTERVENCOES.map((r, i) => (
                <tr key={i}><td className={m.numCell}>{r[0]}</td><td><b>{r[1]}</b></td><td>{r[2]}</td><td className={m.numCell}>{r[3]}</td><td><Pill kind="sage" noDot>Concluída</Pill></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Equipamentos" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Equipamento</th><th>Estado técnico</th><th>Conformidade</th><th>Próxima ação</th></tr></thead>
            <tbody>
              {real ? (
                equipamentos.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>Nenhum equipamento registado.</td></tr>
                  : equipamentos.map((e) => (
                      <tr key={e.id}>
                        <td><b>{e.marca || 'Elevador'}</b></td>
                        <td>{e.ultimaInspecao ? `Última inspeção ${e.ultimaInspecao}` : '—'}</td>
                        <td><Pill kind={EQUIP_KIND[e.estado] ?? 'amber'} noDot>{EQUIP_LABEL[e.estado] ?? e.estado}</Pill></td>
                        <td>{e.proximaInspecao ? `Próxima: ${e.proximaInspecao}` : '—'}</td>
                      </tr>
                    ))
              ) : EQUIPAMENTOS.map((r, i) => (
                <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td><Pill kind={r[4]} noDot>{r[2]}</Pill></td><td>{r[3]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Contratos" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Contrato</th><th>Prestador</th><th>Valor</th><th>Vigência</th></tr></thead>
            <tbody>
              {real ? (
                contratos.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--v54-navy-300)' }}>Nenhum contrato para este edifício.</td></tr>
                  : contratos.map((c) => (
                      <tr key={c.id}>
                        <td><b>{CAT_LABEL[c.categoria] ?? c.categoria}</b></td>
                        <td>{c.fornecedor || '—'}</td>
                        <td className={m.numCell}>{c.custoAnual ? `${fmtEUR(c.custoAnual)} / ano` : c.custoMensal ? `${fmtEUR(c.custoMensal)} / mês` : '—'}</td>
                        <td><Pill kind={CONTRATO_KIND[c.statut] ?? 'amber'} noDot>{c.dataFim ? `Até ${c.dataFim}` : c.statut}</Pill></td>
                      </tr>
                    ))
              ) : CONTRATOS.map((r, i) => (
                <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td className={m.numCell}>{r[2]}</td><td><Pill kind={r[4]} noDot>{r[3]}</Pill></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
