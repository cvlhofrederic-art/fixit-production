'use client'

// Analyse de devis & factures (IA) — port du ModAnaliseOrc du mockup v8 (FR).
// Textarea pour coller le contenu + cartes d'analyses récentes.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** [titre, montant, verdict, détail, couleur] */
type OrcRow = readonly [string, string, string, string, 'sage' | 'amber' | 'rust']

const ORC: readonly OrcRow[] = [
  ['Devis toiture — Ent. Toitures Nord', '18 400 € HT', 'Conforme', 'Prix de marché cohérent, mentions légales complètes.', 'sage'],
  ['Devis ascenseur — Kone', '12 900 € HT', 'À vérifier', 'TVA à confirmer (10 % ou 20 % selon nature des travaux).', 'amber'],
  ['Facture plomberie — Plomberie Centrale', '744 € TTC', 'Anomalie', 'Écart avec le devis initial (+120 €) non justifié.', 'rust'],
  ['Devis ravalement — Façade Pro', '24 200 € HT', 'Conforme', 'Décomposition détaillée, garantie décennale jointe.', 'sage'],
]

const cardHeadRow = { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 } as const

export default function ModAnalyseDevis() {
  const { push } = useToast()
  const [txt, setTxt] = useState('')
  return (
    <>
      <PageHead eyebrow="Assistant · IA" title="Analyse de devis & factures"
        lede="Contrôle des devis et factures : cohérence des prix, TVA, mentions légales (outil d'aide à la décision)." />
      <Panel title="Analyser un document" icon="sparkle">
        <FormRow>
          <Field label="Coller le contenu du devis / de la facture" name="analyse-devis-contenu" full>
            <textarea aria-label="Contenu du devis ou de la facture" rows={4} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Coller ici le texte du devis ou de la facture…" style={{ width: '100%', resize: 'vertical' }} />
          </Field>
        </FormRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Analyse lancée', desc: 'Vérification des prix, TVA et mentions légales' })}><Icon name="sparkle" />Analyser</Button>
        </div>
      </Panel>
      <div style={{ height: 14 }}></div>
      <Panel title="Analyses récentes" icon="coin">
        <div className={m.cardGrid}>
          {ORC.map(([t, mt, v, d, c], i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={cardHeadRow}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</div>
                <Pill kind={c} noDot>{v}</Pill>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--v54-font-mono)', color: 'var(--v54-navy-600)', marginBottom: 6 }}>{mt}</div>
              <div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{d}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
