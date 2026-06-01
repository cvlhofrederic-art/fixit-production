'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/**
 * Alertas — Phase 2 : alertes dérivées des vraies données du cabinet quand un
 * syndic est connecté (conformité simple, sans calcul de dates : RC Pro/decenal
 * invalides, regulamento en falta) ; état « tout traité » sinon (mock/preview).
 */

type AlertItem = { kind: PillKind; tag: string; title: string; desc: string; icon: IconName }

export default function ModAlertas() {
  const data = useSyndicData()
  const real = data.authenticated

  const artisanName = (prenom: string | undefined, nom: string) => `${prenom ?? ''} ${nom}`.trim() || nom

  const alerts: AlertItem[] = real
    ? [
        ...data.artisans
          .filter((a) => !a.rcProValide)
          .map((a): AlertItem => ({ kind: 'rust', tag: 'Seguro', title: 'Seguro RC Pro inválido ou em falta', desc: artisanName(a.prenom, a.nom), icon: 'shield' })),
        ...data.artisans
          .filter((a) => !a.decennaleValide)
          .map((a): AlertItem => ({ kind: 'amber', tag: 'Garantia', title: 'Garantia decenal em falta', desc: artisanName(a.prenom, a.nom), icon: 'shield' })),
        ...data.immeubles
          .filter((i) => !i.reglementTexte)
          .map((i): AlertItem => ({ kind: 'gold', tag: 'Documento', title: 'Regulamento de condomínio em falta', desc: i.nom, icon: 'doc' })),
      ]
    : []

  return (
    <>
      <PageHead title="Alertas" lede="Alertas urgentes do sistema, prazos legais e operacionais" />
      <Panel flush={alerts.length > 0}>
        {alerts.length > 0 ? (
          alerts.map((al, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', borderBottom: i < alerts.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={al.icon} /></div>
              <div style={{ flex: 1 }}><b>{al.title}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{al.desc}</div></div>
              <Pill kind={al.kind} noDot>{al.tag}</Pill>
            </div>
          ))
        ) : (
          <Empty kind="sage" illustration="ocorrencias" title="Todos os alertas foram tratados!" desc="Operação nominal" />
        )}
      </Panel>
    </>
  )
}
