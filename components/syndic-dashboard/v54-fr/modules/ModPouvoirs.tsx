'use client'

// Étendue des pouvoirs (ModPouvoirs) — port byte-exact du mockup v8 FR.
// Garde-fou ultra vires : régime applicable au mandat sélectionné (regimeOf)
// + vérificateur « Puis-je décider seul ? » (POWER_CHECK).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { byCode } from '../data/mock'
import { regimeOf } from '../lib/regimes'
import CoproSelect from '../shared/CoproSelect'

interface PowerCheck {
  q: string
  verdict: string
  pill: PillKind
  why: string
}

const POWER_CHECK: PowerCheck[] = [
  { q: "Gestion courante, contrats d'entretien", verdict: 'Autorisé', pill: 'sage', why: 'Relève des pouvoirs du syndic (art. 18 L. 1965).' },
  { q: 'Travaux urgents de sauvegarde', verdict: 'Autorisé', pill: 'sage', why: 'Mesures conservatoires nécessaires (art. 18 ; jurisprudence constante).' },
  { q: 'Recouvrement des impayés / mise en demeure', verdict: 'Autorisé', pill: 'sage', why: 'Pouvoir du syndic ; engagement des poursuites (art. 19, 10-1).' },
  { q: "Travaux d'amélioration (art. 30)", verdict: 'AG requise', pill: 'amber', why: "Décision de l'assemblée, sauf si expressément inclus dans la mission par l'ordonnance." },
  { q: 'Emprunt collectif', verdict: 'AG requise', pill: 'amber', why: "Majorité spéciale de l'AG (art. 26) — hors pouvoirs propres de l'administrateur." },
  { q: 'Vente / constitution de droits réels (art. 26 a et b)', verdict: 'Exclu', pill: 'rust', why: "Expressément exclu des pouvoirs transférables à l'AP par l'art. 29-1." },
  { q: 'Action en justice au nom du syndicat', verdict: 'Selon ordonnance', pill: 'gold', why: "Dépend des pouvoirs conférés par le juge dans l'ordonnance de désignation." },
]

const eyebrowStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', fontWeight: 600, margin: '8px 0 8px' } as const

export default function ModPouvoirs() {
  const [code, setCode] = useState('TL')
  const [q, setQ] = useState(POWER_CHECK[0].q)
  const c = byCode(code)
  const reg = regimeOf(c)
  const sel = POWER_CHECK.find((x) => x.q === q) || POWER_CHECK[0]

  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Étendue des pouvoirs"
        lede="L'administrateur n'exerce que les pouvoirs conférés par l'ordonnance. Ce garde-fou évite l'excès de pouvoir (ultra vires) et sécurise chaque décision."
        actions={<CoproSelect value={code} onChange={setCode} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel title={`Régime : ${reg.label}`} sub={reg.basis} icon="scale">
          <p style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 0 }}>{reg.mission}</p>
          <div style={eyebrowStyle}>Pouvoirs conférés</div>
          {reg.pouvoirs.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13 }}>
              <Icon name="check" style={{ width: 15, height: 15, color: 'var(--v54-sage-700)', flexShrink: 0, marginTop: 2 }} />
              <span>{p}</span>
            </div>
          ))}
          <div style={{ marginTop: 10 }}><Pill kind="gold" noDot>Durée : {reg.duree}</Pill></div>
        </Panel>
        <Panel title="Puis-je décider seul ?" sub="Vérificateur de pouvoirs" icon="shield">
          <div style={{ marginBottom: 14 }}>
            <Field label="Type de décision envisagée" name="pw-q">
              <select aria-label="Décision à vérifier" value={q} onChange={(e) => setQ(e.target.value)}>
                {POWER_CHECK.map((x) => (
                  <option key={x.q} value={x.q}>{x.q}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Pill kind={sel.pill} noDot>{sel.verdict}</Pill>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{sel.q}</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', margin: 0, lineHeight: 1.55 }}>{sel.why}</p>
          </div>
        </Panel>
      </div>
    </>
  )
}
