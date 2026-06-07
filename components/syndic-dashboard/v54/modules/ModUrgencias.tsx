'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Button } from '../primitives/button'
import { Alert } from '../primitives/alert'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Urgências Técnicas — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Phase 3 : urgences actives calculées (lecture seule) depuis data.missions (priorite urgente,
 * non terminées). Aucune nouvelle table/route. Anonyme → preview illustratif inchangé. */

type Urgencia = { tipo: string; edificio: string; prioridade: string; kind: PillKind; profissional: string; estado: string; estadoKind: PillKind; tempo: string }

const URGENCIAS: Urgencia[] = [
  { tipo: 'Fuga de água na garagem B2', edificio: 'Edifício Aurora', prioridade: 'Crítica', kind: 'rust', profissional: 'HidroPro Lda', estado: 'Despachada', estadoKind: 'sage', tempo: '6 min' },
  { tipo: 'Elevador bloqueado no 4.º', edificio: 'Edifício Bela Vista', prioridade: 'Alta', kind: 'amber', profissional: 'ElevaTech', estado: 'Em despacho', estadoKind: 'amber', tempo: '11 min' },
  { tipo: 'Curto-circuito no hall', edificio: 'Residencial Cedofeita', prioridade: 'Alta', kind: 'amber', profissional: '—', estado: 'À procura', estadoKind: 'rust', tempo: '2 min' },
  { tipo: 'Infiltração no teto do R/C', edificio: 'Condomínio Boavista Center', prioridade: 'Média', kind: 'gold', profissional: 'ConstruFix', estado: 'Despachada', estadoKind: 'sage', tempo: '18 min' },
]

// statut mission → [libellé estado PT, pill kind]
const ESTADO: Record<string, [string, PillKind]> = {
  en_attente: ['À procura', 'rust'],
  acceptee: ['Em despacho', 'amber'],
  en_cours: ['Em curso', 'amber'],
  terminee: ['Concluída', 'sage'],
  annulee: ['Anulada', 'rust'],
}

export default function ModUrgencias() {
  const soon = useComingSoon()
  const data = useSyndicData()
  const real = data.authenticated
  // Urgences actives = missions prioritaires non clôturées.
  const urgentes = real
    ? (data.missions ?? []).filter((mi) => mi.priorite === 'urgente' && mi.statut !== 'terminee' && mi.statut !== 'annulee')
    : []
  const emDespacho = urgentes.filter((mi) => mi.statut !== 'en_cours').length
  const rows: Urgencia[] = real
    ? urgentes.map((mi) => {
        const [estado, estadoKind] = ESTADO[mi.statut] ?? [mi.statut, 'amber']
        return { tipo: mi.type || mi.description || 'Intervenção', edificio: mi.immeuble || '—', prioridade: 'Urgente', kind: 'rust', profissional: mi.artisan || '—', estado, estadoKind, tempo: '—' }
      })
    : URGENCIAS

  return (
    <>
      <PageHead title="Urgências Técnicas" lede="Despacho imediato para o profissional VITFIX disponível"
        actions={<Button variant="gold" onClick={soon('Nova urgência', 'Despacho de urgências em desenvolvimento')}><Icon name="plus" />Nova urgência</Button>} />
      <Tabs defaultActive="ativas" tabs={[
        { id: 'ativas', icon: 'siren', label: 'Ativas' },
        { id: 'despacho', icon: 'sat', label: 'Despacho' },
        { id: 'profissionais', icon: 'wrench', label: 'Profissionais' },
        { id: 'hist', icon: 'clock', label: 'Histórico' },
      ]} />
      <Alert kind="rust" icon="siren" title="Despacho automático ativo">
        As urgências críticas são despachadas automaticamente para o profissional VITFIX disponível mais próximo, com confirmação em tempo real.
      </Alert>
      <KPIGrid items={[
        { icon: 'siren', num: real ? urgentes.length : 4, lbl: 'Urgências ativas', accent: 'rust' },
        { icon: 'sat', num: real ? emDespacho : 2, lbl: 'Em despacho', accent: 'amber' },
        { icon: 'wrench', num: real ? (data.artisans ?? []).length : 9, lbl: 'Profissionais disponíveis', accent: 'sage' },
        { icon: 'clock', num: real ? '—' : '9 min', lbl: 'Tempo médio de resposta' },
      ]} />
      <Panel title="Urgências ativas" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Tipo</th><th>Edifício</th><th>Prioridade</th><th>Profissional</th><th>Estado</th><th>Tempo</th></tr></thead>
            <tbody>
              {real && rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>Nenhuma urgência ativa.</td></tr>
              ) : rows.map((u, i) => (
                <tr key={i}>
                  <td><b>{u.tipo}</b></td>
                  <td>{u.edificio}</td>
                  <td><Pill kind={u.kind} noDot>{u.prioridade}</Pill></td>
                  <td>{u.profissional}</td>
                  <td><Pill kind={u.estadoKind} noDot>{u.estado}</Pill></td>
                  <td className={m.numCell}>{u.tempo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
