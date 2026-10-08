'use client'

import { useState } from 'react'
import { AgentChatPage } from '@/components/administrateur-judiciaire/modules/agents-ia/AgentChatPage'
import { FixyCourriel } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyCourriel'
import { FixyDemande } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyDemande'
import { FixyOrdonnance } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyOrdonnance'
import { FixyVeille } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyVeille'
import { useFixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { OngletsAgent, type OngletAgent } from '@/components/administrateur-judiciaire/modules/agents-ia/OngletsAgent'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useNomsCoproprietesSelonMode } from '@/lib/administrateur-judiciaire/db/hooks'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'

/**
 * Écran Fixy, comme Tempo : onglet « Assistant » (page d'accueil de Fixy, agent secrétaire, reprise de la maquette
 * VitFix_Syndic_Judiciaire_13_M1 : conversation aux réponses simulées) et onglet « Tableau » (veille, demande,
 * courriel, ordonnance et notes, sur les données réelles).
 */
export function FixyModule() {
  const [onglet, setOnglet] = useState<OngletAgent>('assistant')
  const nomsCoproprietes = useNomsCoproprietesSelonMode()
  // Une fois ouvert, le Tableau reste monté (masqué sous l'onglet Assistant) : comme celui de Tempo, il garde son
  // état, et une demande, un courriel ou une ordonnance en cours survivent au changement d'onglet.
  const [tableauOuvert, setTableauOuvert] = useState(false)

  const changerOnglet = (nouvel: OngletAgent) => {
    setOnglet(nouvel)
    if (nouvel === 'tableau') setTableauOuvert(true)
  }

  return (
    <>
      <OngletsAgent onglet={onglet} onChange={changerOnglet} />
      {onglet === 'assistant' && (
        <AgentChatPage
          mascot="fixy"
          domain="ops"
          conversations={[
            {
              id: 'f1',
              title: 'Ordre de mission — fuite 4e étage',
              bucket: 'hier',
            },
            {
              id: 'f2',
              title: 'Devis étanchéité Les Tilleuls',
              bucket: 'cette-semaine',
            },
            {
              id: 'f3',
              title: 'Prestataires plomberie référencés',
              bucket: 'cette-semaine',
            },
          ]}
          name="Fixy — Assistant du mandat"
          title="Coordination des interventions et de la gestion courante du syndicat"
          intro="Bonjour, je suis Fixy."
          introDetail="Je vous aide à piloter les interventions, les prestataires et le suivi opérationnel de vos copropriétés sous mandat."
          contextSelector={{
            label: 'Copropriété',
            options: nomsCoproprietes,
          }}
          showDocsBtn
          suggestions={[
            'Quelles interventions sont en attente de validation ?',
            'Génère un ordre de service pour la fuite du 4e',
            'Quels prestataires sont référencés pour la plomberie ?',
            'Fais le point opérationnel du Clos des Vignes',
          ]}
        />
      )}
      {tableauOuvert && (
        <div
          style={
            onglet === 'tableau'
              ? undefined
              : {
                  display: 'none',
                }
          }
        >
          <FixyTableau />
        </div>
      )}
    </>
  )
}

/**
 * Tableau de Fixy (agents IA · pilotage, données réelles) : veille calculée depuis la base et le moteur d'échéances,
 * demande libre, analyse d'un courriel reçu, création d'un mandat depuis une ordonnance, notes au gestionnaire.
 */
function FixyTableau() {
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
