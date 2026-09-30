'use client'

import { useState } from 'react'
import { FixyCourriel } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyCourriel'
import { FixyDemande } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyDemande'
import { FixyOrdonnance } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyOrdonnance'
import { FixyVeille } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyVeille'
import { useFixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'

/**
 * Écran Fixy (agents IA · pilotage, données réelles) : veille calculée depuis la base et le moteur d'échéances,
 * demande libre, analyse d'un courriel reçu, création d'un mandat depuis une ordonnance, notes au gestionnaire.
 */
export function FixyModule() {
  const fixy = useFixy()
  const [faites, setFaites] = useState<string[]>([])
  const [enCours, setEnCours] = useState<string | null>(null)

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

  const notes = fixy.p.notifications.filter((notification) => notification.kind === 'note')

  return (
    <>
      <PageHead
        eyebrow="Agents IA · pilotage"
        title="Fixy"
        lede="Il récolte ce que savent les autres agents, rappelle ce qui est oublié, répond aux courriels avec les données réelles, crée un mandat depuis une ordonnance déposée. Il n'écrit rien dans la base sans ton accord."
      />
      {fixy.p.erreur && (
        <Alert kind="warn" icon="alert" title="Base locale indisponible">
          {MESSAGES_ETAT_ECHEANCES.indisponible}
        </Alert>
      )}
      <Panel
        title={`Veille · ${fixy.veille.length} rappel${fixy.veille.length > 1 ? 's' : ''}`}
        sub="Courriers oubliés, personnes à relancer, échéances qui tombent, pièces attendues · calculés depuis la base et le moteur"
        icon="alert"
        right={
          <Pill kind={fixy.veille.some((rappel) => rappel.gravite === 'rust') ? 'rust' : 'sage'} noDot>
            {fixy.veille.filter((rappel) => rappel.gravite === 'rust').length}
            {' urgent'}
            {fixy.veille.filter((rappel) => rappel.gravite === 'rust').length > 1 ? 's' : ''}
          </Pill>
        }
      >
        <FixyVeille veille={fixy.veille} faites={faites} onAction={executerAction} enCours={enCours} />
      </Panel>
      <Panel
        title="Demande"
        sub="Déterministe et hors ligne : compréhension par motifs et index de la base ; un modèle de langage pourra s'y brancher plus tard (D3)"
        icon="sparkle"
      >
        <FixyDemande fixy={fixy} />
      </Panel>
      <div className="card-grid cols-2">
        <Panel
          title="Courriel reçu"
          sub="Fixy reconnaît l'expéditeur, le sujet, propose la réponse et une note"
          icon="mail"
        >
          <FixyCourriel fixy={fixy} />
        </Panel>
        <Panel
          title="Nouveau mandat depuis une ordonnance"
          sub="Dépose le texte, Fixy lit et propose la création avec la source"
          icon="scale"
        >
          <FixyOrdonnance fixy={fixy} />
        </Panel>
      </div>
      <Panel
        title={`Notes au gestionnaire (${notes.length})`}
        sub="Enregistrées par Fixy depuis les courriels analysés"
        icon="clipboard"
        flush
      >
        {notes.length === 0 ? (
          <div
            style={{
              padding: '18px 22px',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            Aucune note.
          </div>
        ) : (
          [...notes].reverse().map((note) => (
            <div
              style={{
                padding: '11px 22px',
                borderBottom: '1px solid var(--line)',
                fontSize: 13,
              }}
              key={note.id}
            >
              <b>{note.titre}</b>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {note.description}
              </div>
            </div>
          ))
        )}
      </Panel>
    </>
  )
}
