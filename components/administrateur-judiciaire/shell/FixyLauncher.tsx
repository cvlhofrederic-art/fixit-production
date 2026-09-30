'use client'

import { useState } from 'react'
import { FixyDemande } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyDemande'
import { FixyVeille } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyVeille'
import { useFixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import type { RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'

/** Valeur renvoyée par useFixy (données, veille, exécution des actions, notifications). */
type Fixy = ReturnType<typeof useFixy>

export interface FixyLauncherProps {
  /** Route affichée : le lanceur est masqué sur l'écran Fixy lui-même. */
  route: string
  /** Instance de Fixy du Shell ; à défaut, celle du lanceur. */
  fixy?: Fixy
}

/**
 * Bouton flottant « Fixy » (avec le nombre de rappels urgents) ouvrant une fenêtre : veille (3 rappels au plus,
 * exécutables) et zone de demande compacte. Absent de l'écran Fixy.
 */
export function FixyLauncher({ route, fixy }: FixyLauncherProps) {
  const [ouvert, setOuvert] = useState(false)
  // Appel inconditionnel (règles des hooks), même quand le Shell fournit déjà son instance.
  const fixyInterne = useFixy()
  const fixyActif = fixy || fixyInterne
  const [faites, setFaites] = useState<string[]>([])
  const [enCours, setEnCours] = useState<string | null>(null)
  const nbRappelsUrgents = fixyActif.veille.filter((rappel: RappelVeille) => rappel.gravite === 'rust').length

  if (route === 'fixy') return null

  const executerAction = async (action: ActionFixy) => {
    setEnCours(action.id)
    try {
      if ((await fixyActif.executer(action)) && action.ecrit) setFaites((precedentes) => [...precedentes, action.id])
    } catch (erreur) {
      fixyActif.push({
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
      <button
        type="button"
        aria-label={ouvert ? 'Fermer Fixy' : 'Ouvrir Fixy'}
        onClick={() => setOuvert((valeur) => !valeur)}
        className="btn gold"
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          zIndex: 60,
          borderRadius: 999,
          padding: '10px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
        }}
      >
        <Icon name="sparkle" />
        Fixy
        {nbRappelsUrgents > 0 && (
          <span
            className="pill rust no-dot"
            style={{
              marginLeft: 8,
              fontSize: 10,
            }}
          >
            {nbRappelsUrgents}
          </span>
        )}
      </button>
      {ouvert && (
        <div
          role="dialog"
          aria-label="Fixy"
          style={{
            position: 'fixed',
            right: 22,
            bottom: 74,
            width: 'min(440px, calc(100vw - 44px))',
            maxHeight: 'min(70vh, 640px)',
            overflow: 'auto',
            zIndex: 60,
            background: 'var(--white, #fff)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0,0,0,.18)',
            padding: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {'Fixy '}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 12,
                  color: 'var(--navy-300)',
                }}
              >
                · pilote tout, rien sans ton accord
              </span>
            </div>
            <button
              className="btn"
              aria-label="Fermer"
              onClick={() => setOuvert(false)}
              style={{
                padding: '4px 8px',
              }}
            >
              <Icon name="ban" />
            </button>
          </div>
          {fixyActif.veille.length > 0 && (
            <div
              style={{
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: 'var(--navy-500)',
                  marginBottom: 4,
                }}
              >
                {'À signaler '}
                <Pill kind={nbRappelsUrgents ? 'rust' : 'amber'} noDot>
                  {fixyActif.veille.length}
                </Pill>
              </div>
              <FixyVeille veille={fixyActif.veille} faites={faites} onAction={executerAction} enCours={enCours} max={3} />
            </div>
          )}
          <FixyDemande fixy={fixyActif} compact />
        </div>
      )}
    </>
  )
}
