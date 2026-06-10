'use client'

// Dossier juridictionnel (ModDossierJud) — port byte-exact du mockup v8 FR.
// Dialogue avec le tribunal pour le mandat sélectionné : pièces du dossier,
// requêtes (dépôt → délibéré → ordonnance) et chronologie de la mission.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { byCode } from '../data/mock'
import { regimeOf } from '../lib/regimes'
import CoproSelect from '../shared/CoproSelect'
import DataTable from '../shared/DataTable'

interface Piece {
  nom: string
  date: string
  statut: string
  pill: PillKind
}

interface Requete {
  objet: string
  date: string
  statut: string
  pill: PillKind
  ord: string
}

interface ChronoEvent {
  d: string
  t: string
  k: 'sage' | 'amber' | 'rust'
}

const thumbStyle = { width: 38, height: 38, borderRadius: 9, background: 'var(--v54-cream)', color: 'var(--v54-navy-700)', display: 'grid', placeItems: 'center', border: '1px solid var(--v54-line)', flexShrink: 0 } as const

export default function ModDossierJud() {
  const { push } = useToast()
  const [code, setCode] = useState('TL')
  const c = byCode(code)
  const reg = regimeOf(c)
  const is29 = reg.code === 'ap291'

  const pieces: Piece[] = [
    { nom: 'Ordonnance de désignation', date: c.ordonnance, statut: 'Versée', pill: 'sage' },
    { nom: 'Notification aux copropriétaires (art. 64)', date: '—', statut: c.code === 'VM' ? 'En cours' : 'Effectuée', pill: c.code === 'VM' ? 'amber' : 'sage' },
    ...(is29 ? [{ nom: 'Rapport intermédiaire (art. 29-1 B, 6 mois)', date: 'À échéance', statut: 'À établir', pill: 'rust' as const }] : []),
    { nom: 'Procès-verbal de la dernière AG', date: '18/05/2026', statut: 'Versé', pill: 'sage' },
    { nom: 'Rapport de fin de mission', date: '—', statut: 'Non échu', pill: 'gold' },
  ]
  const requetes: Requete[] = [
    ...(c.code === 'TL' ? [{ objet: 'Requête en prorogation de la mission', date: 'À déposer', statut: 'À préparer', pill: 'rust' as const, ord: '—' }] : []),
    { objet: 'Requête en autorisation de travaux urgents', date: '02/04/2026', statut: 'Ordonnance rendue', pill: 'sage', ord: 'Ord. du 11/04/2026' },
    { objet: 'Requête en taxation des honoraires', date: c.code === 'TL' ? '05/03/2026' : '—', statut: c.code === 'TL' ? 'En délibéré' : 'Non déposée', pill: c.code === 'TL' ? 'amber' : 'gold', ord: '—' },
  ]
  const chrono: ChronoEvent[] = [
    { d: c.ordonnance, t: `Ordonnance de désignation — ${reg.label}`, k: 'sage' },
    { d: '12/04/2026', t: 'Ordonnance autorisant les travaux urgents', k: 'sage' },
    ...(is29 ? [{ d: 'À 6 mois', t: 'Rapport intermédiaire art. 29-1 B attendu par le tribunal', k: 'rust' as const }] : []),
    { d: c.echeance, t: 'Échéance de la mission', k: 'amber' },
  ]

  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Dossier juridictionnel"
        lede="Tout le dialogue avec le tribunal pour ce mandat : pièces du dossier, requêtes et leur suivi (dépôt → délibéré → ordonnance), chronologie."
        actions={
          <>
            <CoproSelect value={code} onChange={setCode} />
            <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle requête', desc: `${c.tribunal}` })}>
              <Icon name="plus" />Nouvelle requête
            </Button>
          </>
        }
      />
      <Alert kind="sage" icon="scale" title={`${reg.label} — ${c.tribunal}`}>
        Désignation sur le fondement : {reg.basis}. RG {c.rg} · ordonnance du {c.ordonnance} · durée {reg.duree}.
      </Alert>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Panel title="Requêtes au tribunal" sub="Suivi dépôt → délibéré → ordonnance" icon="scale" flush>
          <DataTable<Requete>
            rowKey="objet"
            columns={[
              { h: 'Objet', render: (r) => <b style={{ fontWeight: 600 }}>{r.objet}</b> },
              { h: 'Déposée le', render: (r) => r.date },
              { h: 'Statut', render: (r) => <Pill kind={r.pill} noDot>{r.statut}</Pill> },
              { h: 'Ordonnance', render: (r) => <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{r.ord}</span> },
            ]}
            rows={requetes}
          />
        </Panel>
        <Panel title="Pièces du dossier" icon="doc" flush>
          {pieces.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--v54-line)' }}>
              <div style={thumbStyle}><Icon name="doc" style={{ width: 18, height: 18 }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.nom}</div>
                <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{p.date}</div>
              </div>
              <Pill kind={p.pill} noDot>{p.statut}</Pill>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Chronologie de la mission" sub="Échanges et actes juridictionnels" icon="clock" flush>
        {chrono.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 22px', borderBottom: '1px solid var(--v54-line)', alignItems: 'center' }}>
            <span className={m.mono} style={{ fontSize: 12, color: 'var(--v54-navy-500)', width: 90, flexShrink: 0 }}>{e.d}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--v54-${e.k}-500)`, flexShrink: 0 }}></span>
            <span style={{ fontSize: 13 }}>{e.t}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}
