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
import { useMessages } from '@/lib/syndic/v54/i18n'
import { URGENCIAS_MESSAGES, type EtatUrgence, type PrioriteUrgence } from './i18n/ModUrgencias.messages'

/** Urgências Técnicas — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Phase 3 : urgences actives calculées (lecture seule) depuis data.missions (priorite urgente,
 * non terminées). Aucune nouvelle table/route. Anonyme → preview illustratif inchangé. */

type Urgencia = { tipo: string; edificio: string; prioridade: string; kind: PillKind; profissional: string; estado: string; estadoKind: PillKind; tempo: string }

const PRIO_KIND: Record<PrioriteUrgence, PillKind> = { critica: 'rust', alta: 'amber', media: 'gold' }

const ETAT_KIND: Record<EtatUrgence, PillKind> = {
  procura: 'rust',
  despacho: 'amber',
  despachada: 'sage',
  curso: 'amber',
  concluida: 'sage',
  anulada: 'rust',
}

// statut mission → état affiché (libellé selon la langue, pill kind)
const ESTADO: Record<string, EtatUrgence> = {
  en_attente: 'procura',
  acceptee: 'despacho',
  en_cours: 'curso',
  terminee: 'concluida',
  annulee: 'anulada',
}

export default function ModUrgencias() {
  const soon = useComingSoon()
  const t = useMessages(URGENCIAS_MESSAGES)
  const data = useSyndicData()
  const real = data.authenticated
  // Urgences actives = missions prioritaires non clôturées.
  const urgentes = real
    ? (data.missions ?? []).filter((mi) => mi.priorite === 'urgente' && mi.statut !== 'terminee' && mi.statut !== 'annulee')
    : []
  const emDespacho = urgentes.filter((mi) => mi.statut !== 'en_cours').length
  const rows: Urgencia[] = real
    ? urgentes.map((mi) => {
        const code = ESTADO[mi.statut]
        const estado = code ? t.etats[code] : mi.statut
        const estadoKind: PillKind = code ? ETAT_KIND[code] : 'amber'
        return { tipo: mi.type || mi.description || t.interventionParDefaut, edificio: mi.immeuble || '—', prioridade: t.prioriteUrgente, kind: 'rust', profissional: mi.artisan || '—', estado, estadoKind, tempo: '—' }
      })
    : t.demo.map((d) => ({ tipo: d.tipo, edificio: d.edificio, prioridade: t.priorites[d.prioridade], kind: PRIO_KIND[d.prioridade], profissional: d.profissional, estado: t.etats[d.estado], estadoKind: ETAT_KIND[d.estado], tempo: d.tempo }))

  const c = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={soon(t.nouvelleUrgence, t.nouvelleUrgenceDesc)}><Icon name="plus" />{t.nouvelleUrgence}</Button>} />
      <Tabs defaultActive="ativas" tabs={[
        { id: 'ativas', icon: 'siren', label: t.onglets.ativas },
        { id: 'despacho', icon: 'sat', label: t.onglets.despacho },
        { id: 'profissionais', icon: 'wrench', label: t.onglets.profissionais },
        { id: 'hist', icon: 'clock', label: t.onglets.hist },
      ]} />
      <Alert kind="rust" icon="siren" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'siren', num: real ? urgentes.length : 4, lbl: t.kpi.actives, accent: 'rust' },
        { icon: 'sat', num: real ? emDespacho : 2, lbl: t.kpi.enDispatch, accent: 'amber' },
        { icon: 'wrench', num: real ? (data.artisans ?? []).length : 9, lbl: t.kpi.disponibles, accent: 'sage' },
        { icon: 'clock', num: real ? '—' : t.kpi.delaiMoyenDemo, lbl: t.kpi.delaiMoyen },
      ]} />
      <Panel title={t.panneau} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{c.type}</th><th>{c.immeuble}</th><th>{c.priorite}</th><th>{c.prestataire}</th><th>{c.etat}</th><th>{c.delai}</th></tr></thead>
            <tbody>
              {real && rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>{t.aucuneUrgence}</td></tr>
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
