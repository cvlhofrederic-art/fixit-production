'use client'

import { useState } from 'react'
import { DEMO_ANALYSES_DEVIS_FACTURES } from '@/components/administrateur-judiciaire/data/analyses-devis-factures'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Analyse de devis & factures (Technique & travaux, surtitre « Assistant · IA »).
 * Le texte collé est conservé dans l'état mais jamais lu : « Analyser » affiche seulement un toast de simulation.
 */
export function AnalyseDevisFacturesModule() {
  const { push } = useToast()
  const [contenu, setContenu] = useState('')

  return (
    <>
      <PageHead
        eyebrow="Assistant · IA"
        title="Analyse de devis & factures"
        lede="Contrôle des devis et factures : cohérence des prix, TVA, mentions légales (outil d'aide à la décision)."
      />
      <Panel title="Analyser un document" icon="sparkle">
        <FieldRow>
          <Field label="Coller le contenu du devis / de la facture" full>
            <textarea
              aria-label="Contenu du devis ou de la facture"
              rows={4}
              value={contenu}
              onChange={(evenement) => setContenu(evenement.target.value)}
              placeholder="Coller ici le texte du devis ou de la facture…"
              style={{
                width: '100%',
                resize: 'vertical',
              }}
            />
          </Field>
        </FieldRow>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'success',
                title: 'Simulation',
                desc: "Aucune analyse n'a été effectuée.",
              })
            }
          >
            <Icon name="sparkle" />
            Analyser
          </button>
        </div>
      </Panel>
      <div
        style={{
          height: 14,
        }}
      />
      <Panel title="Analyses récentes" icon="coin">
        <div className="card-grid cols-2">
          {DEMO_ANALYSES_DEVIS_FACTURES.map(([document, montant, verdict, commentaire, teinte], index) => (
            <div
              style={{
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: `var(--${teinte}-50)`,
                borderLeft: `3px solid var(--${teinte}-500)`,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {document}
                </div>
                <Pill kind={teinte} noDot>
                  {verdict}
                </Pill>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--navy-600)',
                  marginBottom: 6,
                }}
              >
                {montant}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {commentaire}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
