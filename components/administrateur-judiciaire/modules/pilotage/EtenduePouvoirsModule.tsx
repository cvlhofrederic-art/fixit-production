'use client'

import { useState } from 'react'
import { MATRICE_POUVOIRS } from '@/components/administrateur-judiciaire/data/pouvoirs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { ficheRegimeCopro } from '@/lib/administrateur-judiciaire/domain/fondements'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

/**
 * Étendue des pouvoirs (statut partiel) : fiche du régime de la copropriété choisie (mission, pouvoirs conférés,
 * durée) et vérificateur « Puis-je décider seul ? » sur la matrice des pouvoirs (première décision par défaut).
 * Grille à deux colonnes fixes, sans adaptation mobile (comme la maquette).
 */
export function EtenduePouvoirsModule() {
  const [code, setCode] = useState(() => codeCoproSelectionne('TL'))
  const [question, setQuestion] = useState(MATRICE_POUVOIRS[0].q)
  const copro = useCoproParCode(code)
  const regime = ficheRegimeCopro(copro)
  const decision = MATRICE_POUVOIRS.find((candidate) => candidate.q === question) || MATRICE_POUVOIRS[0]
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Étendue des pouvoirs"
        lede="L'administrateur n'exerce que les pouvoirs conférés par l'ordonnance. Ce garde-fou évite l'excès de pouvoir (ultra vires) et sécurise chaque décision."
        actions={<SelecteurCopropriete value={code} onChange={setCode} />}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <Panel title={`Régime : ${regime.label}`} sub={regime.basis} icon="scale">
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--navy-500)',
              marginTop: 0,
            }}
          >
            {regime.mission}
          </p>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--navy-300)',
              fontWeight: 600,
              margin: '8px 0 8px',
            }}
          >
            Pouvoirs conférés
          </div>
          {regime.pouvoirs.map((pouvoir, index) => (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                marginBottom: 8,
                fontSize: 13,
              }}
              key={index}
            >
              <Icon
                name="check"
                style={{
                  width: 15,
                  height: 15,
                  color: 'var(--sage-700)',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <span>{pouvoir}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 10,
            }}
          >
            <Pill kind="gold" noDot>
              {'Durée : '}
              {regime.duree}
            </Pill>
          </div>
        </Panel>
        <Panel title="Puis-je décider seul ?" sub="Vérificateur de pouvoirs" icon="shield">
          <div
            className="field"
            style={{
              marginBottom: 14,
            }}
          >
            <label htmlFor="pw-q">Type de décision envisagée</label>
            <select
              id="pw-q"
              aria-label="Décision à vérifier"
              value={question}
              onChange={(evenement) => setQuestion(evenement.target.value)}
            >
              {MATRICE_POUVOIRS.map((option) => (
                <option value={option.q} key={option.q}>
                  {option.q}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <Pill kind={decision.pill} noDot>
                {decision.verdict}
              </Pill>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {decision.q}
              </span>
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--navy-500)',
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              {decision.why}
            </p>
          </div>
        </Panel>
      </div>
    </>
  )
}
