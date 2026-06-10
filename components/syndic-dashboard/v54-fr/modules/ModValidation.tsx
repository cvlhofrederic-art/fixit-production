'use client'

// Circuit de validation (juriste → direction) — port byte-exact du ModValidation
// du mockup v8 (route « validation »). Workflow d'approbation rôle-conscient :
// préparé → vérifié (juriste) → validé & signé (direction).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import DataTable from '../shared/DataTable'
import { useRole, ROLE_LABEL } from '../lib/role-context'

type ValStage = 'prepare' | 'verifie' | 'valide'

interface ValItem {
  id: number
  objet: string
  copro: string
  type: string
  stage: ValStage
  by: string
}

const VAL_SEED: ValItem[] = [
  { id: 1, objet: 'Requête en prorogation — Les Tilleuls', copro: 'Copropriété Les Tilleuls', type: 'Requête', stage: 'verifie', by: 'C. Noël' },
  { id: 2, objet: 'État de frais & honoraires — Le Méridien', copro: 'Résidence Le Méridien', type: 'Taxation', stage: 'verifie', by: 'J. Marchand' },
  { id: 3, objet: 'Convocation AG élective — Le Clos des Vignes', copro: 'Le Clos des Vignes', type: 'Convocation', stage: 'prepare', by: 'A. Diallo' },
  { id: 4, objet: 'Mise en demeure — SCI Belvédère', copro: 'Copropriété Les Tilleuls', type: 'Recouvrement', stage: 'prepare', by: 'J. Marchand' },
  { id: 5, objet: "Notification d'ordonnance — Villa Montaigne", copro: 'Villa Montaigne', type: 'Notification', stage: 'valide', by: 'Secrétariat' },
  { id: 6, objet: 'Rapport intermédiaire art. 29-1 B — Les Tilleuls', copro: 'Copropriété Les Tilleuls', type: 'Rapport', stage: 'prepare', by: 'C. Noël' },
]

const VAL_STAGE: Record<ValStage, { label: string; pill: PillKind }> = {
  prepare: { label: 'Préparé', pill: 'gold' },
  verifie: { label: 'Vérifié (juriste)', pill: 'amber' },
  valide: { label: 'Validé & signé', pill: 'sage' },
}

export default function ModValidation() {
  const role = useRole()
  const { push } = useToast()
  const [items, setItems] = useState<ValItem[]>(VAL_SEED)
  const advance = (id: number, to: ValStage, msg: { t: string; d: string }) => {
    setItems((it) => it.map((x) => (x.id === id ? { ...x, stage: to } : x)))
    push({ kind: 'success', title: msg.t, desc: msg.d })
  }
  const aVerifier = items.filter((i) => i.stage === 'prepare').length
  const aValider = items.filter((i) => i.stage === 'verifie').length
  const valides = items.filter((i) => i.stage === 'valide').length
  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Circuit de validation"
        lede="Chaque acte suit un circuit : préparé par le gestionnaire ou le comptable, vérifié par le juriste, puis validé et signé par la direction. Les actions dépendent de votre rôle."
        actions={<Pill kind="dark" noDot>Connecté : {ROLE_LABEL[role] || role}</Pill>}
      />
      <Alert kind="sage" icon="shield" title={`Vous agissez en tant que « ${role} »`}>
        {role === 'Juridique'
          ? 'Vous pouvez vérifier les actes préparés avant transmission à la direction.'
          : role === 'Direction'
          ? 'Vous pouvez valider et signer les actes vérifiés par le pôle juridique.'
          : 'Changez de rôle dans la barre du haut (Juridique ou Direction) pour agir sur le circuit. En lecture seule pour ce rôle.'}
      </Alert>
      <KPIGrid
        items={[
          { icon: 'pencil', num: aVerifier, lbl: 'À vérifier', sub: 'pôle juridique', accent: 'gold' },
          { icon: 'scale', num: aValider, lbl: 'À valider & signer', sub: 'direction', accent: 'amber' },
          { icon: 'check', num: valides, lbl: 'Validés', accent: 'sage' },
          { icon: 'clipboard', num: items.length, lbl: 'Actes au circuit' },
        ]}
      />
      <Panel title="File de validation" sub="préparé → vérifié (juriste) → validé & signé (direction)" icon="check" flush>
        <DataTable
          rowKey="id"
          columns={[
            { h: 'Acte', render: (r: ValItem) => (
              <div>
                <b style={{ fontWeight: 600 }}>{r.objet}</b>
                <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{r.type} · préparé par {r.by}</div>
              </div>
            ) },
            { h: 'Copropriété', render: (r: ValItem) => <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{r.copro}</span> },
            { h: 'Étape', render: (r: ValItem) => <Pill kind={VAL_STAGE[r.stage].pill} noDot>{VAL_STAGE[r.stage].label}</Pill> },
            { h: '', style: { width: 170, textAlign: 'right' }, tdStyle: { textAlign: 'right' }, render: (r: ValItem) =>
              role === 'Juridique' && r.stage === 'prepare' ? (
                <Button size="sm" style={{ background: 'var(--v54-amber-600,#C08A2D)', color: '#fff', border: 'none' }} onClick={() => advance(r.id, 'verifie', { t: 'Acte vérifié', d: r.objet })}>Vérifier</Button>
              ) : role === 'Direction' && r.stage === 'verifie' ? (
                <Button size="sm" variant="gold" onClick={() => advance(r.id, 'valide', { t: 'Acte validé & signé', d: r.objet })}>Valider & signer</Button>
              ) : r.stage === 'valide' ? (
                <span style={{ fontSize: 11.5, color: 'var(--v54-sage-700)', fontWeight: 600 }}>Signé ✓</span>
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r.stage === 'prepare' ? 'En attente juriste' : 'En attente direction'}</span>
              ) },
          ]}
          rows={items}
        />
      </Panel>
    </>
  )
}
