'use client'

import { useState } from 'react'
import { FixyActions } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyActions'
import type { Fixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import type { AnalyseCourriel } from '@/lib/administrateur-judiciaire/domain/fixy/courriel'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/** Courriel d'exemple (bouton « Exemple »). */
const COURRIEL_EXEMPLE =
  'Bonjour, je suis Antoine Rousseau, lot 14 de la Copropriété Les Tilleuls. Je conteste le montant de mes charges et le solde réclamé sur mon compte. Cordialement.'

export interface FixyCourrielProps {
  fixy: Fixy
}

/**
 * Courriel reçu : Fixy reconnaît l'expéditeur et le sujet, propose une réponse (à copier : aucun envoi) et une note
 * pour le gestionnaire (enregistrée dans la base d'un clic). Modifier le texte efface l'analyse.
 */
export function FixyCourriel({ fixy }: FixyCourrielProps) {
  const [texte, setTexte] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseCourriel | null>(null)
  const [faites, setFaites] = useState<string[]>([])
  const [enCours, setEnCours] = useState<string | null>(null)

  const copier = async (reponse: string) => {
    try {
      await navigator.clipboard.writeText(reponse)
      fixy.push({
        kind: 'success',
        title: 'Copié',
        desc: 'La réponse est dans le presse-papiers.',
      })
    } catch {
      fixy.push({
        kind: 'warn',
        title: 'Copie impossible',
        desc: 'Sélectionne le texte et copie-le à la main.',
      })
    }
  }

  const enregistrerNote = async () => {
    if (!analyse) return
    try {
      const codeCopro = analyse.copro?.selection?.code
      await fixy.p.creerNote(
        (codeCopro && fixy.p.copros.find((copro) => copro.code === codeCopro)?.id) || null,
        `Courriel · ${analyse.expediteur ? analyse.expediteur.label : 'expéditeur non reconnu'}`,
        analyse.note,
        AUJOURDHUI_ISO,
      )
      fixy.push({
        kind: 'success',
        title: 'Note enregistrée',
        desc: 'Visible dans les notes au gestionnaire.',
      })
      setFaites((precedentes) => [...precedentes, 'note'])
    } catch (erreur) {
      fixy.push({
        kind: 'warn',
        title: 'Note impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    }
  }

  const executerAction = async (action: ActionFixy) => {
    setEnCours(action.id)
    try {
      await fixy.executer(action)
    } finally {
      setEnCours(null)
    }
  }

  return (
    <>
      <textarea
        aria-label="Courriel reçu"
        value={texte}
        onChange={(evenement) => {
          setTexte(evenement.target.value)
          setAnalyse(null)
        }}
        rows={5}
        style={{
          width: '100%',
          fontSize: 13,
        }}
        placeholder="Colle ici le courriel reçu : Fixy reconnaît l'expéditeur, le sujet, et prépare la réponse avec les données réelles."
      />
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        <button className="btn" onClick={() => setTexte(COURRIEL_EXEMPLE)}>
          Exemple
        </button>
        <button
          className="btn gold"
          onClick={() => setAnalyse(fixy.lireCourriel(texte))}
          disabled={!texte.trim() || fixy.p.loading}
        >
          <Icon name="search" />
          Analyser le courriel
        </button>
      </div>
      {analyse && (
        <div
          style={{
            marginTop: 12,
          }}
        >
          <Alert kind="info" icon="mail" title={analyse.resume}>
            {'Tu as reçu ce courriel. Tu veux que '}
            <b>{analyse.agent}</b>
            {' réponde ceci ?'}
          </Alert>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12.5,
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 12,
              margin: 0,
            }}
          >
            {analyse.reponse}
          </pre>
          <p
            style={{
              fontSize: 12.5,
              margin: '10px 0 0',
            }}
          >
            <b>Note pour le gestionnaire :</b>
            {' '}
            {analyse.note}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 10,
            }}
          >
            <button className="btn" onClick={() => copier(analyse.reponse)}>
              <Icon name="doc" />
              Copier la réponse
            </button>
            <button className="btn gold" onClick={enregistrerNote} disabled={faites.includes('note')}>
              <Icon name="check" />
              {faites.includes('note') ? 'Note enregistrée' : 'Enregistrer la note'}
            </button>
          </div>
          {analyse.actions.length > 0 && (
            <FixyActions actions={analyse.actions} faites={[]} onAction={executerAction} enCours={enCours} />
          )}
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--navy-300)',
              margin: '8px 0 0',
            }}
          >
            {"Aucun envoi automatique : la réponse se copie, elle ne part pas d'ici."}
          </p>
        </div>
      )}
    </>
  )
}
