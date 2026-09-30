'use client'

import { useState } from 'react'
import { FixyActions } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyActions'
import { useDicteeVocale } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useDicteeVocale'
import type { EchangeFixy, Fixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  COULEUR_PILL_PAR_AGENT,
  EXEMPLES_DEMANDES_FIXY,
  type ActionFixy,
} from '@/lib/administrateur-judiciaire/domain/fixy/agents'

export interface FixyDemandeProps {
  fixy: Fixy
  /** Version réduite du lanceur du Shell : placeholder court, bouton sans libellé, pas d'exemples. */
  compact?: boolean
}

/**
 * Zone « Demande à Fixy » : saisie (ou dictée), exemples cliquables, puis réponses de la plus récente à la plus
 * ancienne, avec leurs actions. Une action n'est marquée « Fait » que si elle écrit dans la base et a réussi.
 */
export function FixyDemande({ fixy, compact = false }: FixyDemandeProps) {
  const [texte, setTexte] = useState('')
  const [echanges, setEchanges] = useState<EchangeFixy[]>([])
  const [faites, setFaites] = useState<string[]>([])
  const [enCours, setEnCours] = useState<string | null>(null)
  const dictee = useDicteeVocale((transcription) => {
    setTexte(transcription)
  })

  const demander = (exemple?: string) => {
    const demande = (exemple ?? texte).trim()
    if (!demande) {
      fixy.push({
        kind: 'info',
        title: 'Dis-moi ce que tu cherches',
        desc: 'Par exemple : « solde de Garnier » ou « échéances de Villa Montaigne ».',
      })
      return
    }
    setEchanges((precedents) => [...precedents, fixy.demander(demande)])
    setTexte('')
  }

  const executerAction = async (action: ActionFixy) => {
    setEnCours(action.id)
    try {
      if ((await fixy.executer(action)) && action.ecrit) setFaites((precedentes) => [...precedentes, action.id])
    } catch (erreur) {
      fixy.push({
        kind: 'warn',
        title: 'Action impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    } finally {
      setEnCours(null)
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 6,
        }}
      >
        <input
          type="text"
          aria-label="Demande à Fixy"
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === 'Enter') demander()
          }}
          placeholder={
            compact
              ? 'Demande à Fixy…'
              : 'Ex. : solde de Garnier · état des comptes des Tilleuls · passe Benali en mise en demeure'
          }
          style={{
            flex: 1,
          }}
        />
        {dictee.disponible && (
          <button
            className={`btn ${dictee.ecoute ? 'gold' : ''}`}
            aria-label={dictee.ecoute ? 'Arrêter la dictée' : 'Dicter'}
            title="Dictée vocale (fr-FR)"
            onClick={dictee.basculer}
          >
            <Icon name="speech" />
          </button>
        )}
        <button className="btn gold" onClick={() => demander()} disabled={fixy.p.loading}>
          <Icon name="sparkle" />
          {compact ? '' : 'Demander'}
        </button>
      </div>
      {!compact && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          {EXEMPLES_DEMANDES_FIXY.map((exemple) => (
            <button
              className="btn"
              style={{
                fontSize: 12,
              }}
              onClick={() => demander(exemple)}
              key={exemple}
            >
              {exemple}
            </button>
          ))}
        </div>
      )}
      {[...echanges].reverse().map((echange, index) => (
        <div
          style={{
            marginTop: 12,
            padding: compact ? '10px 12px' : '14px 16px',
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--paper)',
          }}
          key={echanges.length - index}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {echange.reponse.titre}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--navy-300)',
                }}
              >
                {'« '}
                {echange.intention.texte}
                {' » · '}
                {echange.reponse.source}
              </div>
            </div>
            <Pill kind={COULEUR_PILL_PAR_AGENT[echange.reponse.agent] || 'navy'} noDot>
              {echange.reponse.agent}
            </Pill>
          </div>
          {echange.reponse.lignes.length > 0 && (
            <ul
              style={{
                margin: '8px 0 0',
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {echange.reponse.lignes.map((ligne, indexLigne) => (
                <li key={indexLigne}>{ligne}</li>
              ))}
            </ul>
          )}
          {echange.reponse.actions.length > 0 && (
            <FixyActions actions={echange.reponse.actions} faites={faites} onAction={executerAction} enCours={enCours} />
          )}
        </div>
      ))}
    </>
  )
}
