'use client'

import { useState } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { passerEnModeReel, restaurerDemonstration } from '@/lib/administrateur-judiciaire/db/reset'
import { DATE_DEMO_ISO, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/**
 * Bandeau de mode en haut de page (MAQUETTE ou DONNÉES RÉELLES) avec un bouton de bascule à confirmation en deux
 * clics : le premier demande confirmation, le second vide la base locale et recharge la page dans l'autre mode.
 * Quitter le bouton (blur) annule la confirmation.
 */
export function DemoBanner() {
  const [confirmation, setConfirmation] = useState(false)

  const basculerMode = async () => {
    if (!confirmation) {
      setConfirmation(true)
      return
    }
    if (MODE_ACTIF === 'demo') await passerEnModeReel()
    else await restaurerDemonstration()
  }

  const libelleBouton =
    MODE_ACTIF === 'demo'
      ? confirmation
        ? 'Confirmer : vider la démonstration et passer à la date réelle'
        : 'Passer aux données réelles'
      : confirmation
        ? 'Confirmer : effacer les données de ce navigateur et restaurer la démonstration'
        : 'Restaurer la démonstration'

  return (
    <div
      className="vfx-demo-banner"
      role="status"
      style={
        MODE_ACTIF === 'reel'
          ? {
              background: 'var(--navy-700, #1f2a44)',
            }
          : undefined
      }
    >
      <Icon
        name={MODE_ACTIF === 'demo' ? 'alert' : 'check'}
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {MODE_ACTIF === 'demo' ? (
        <span>
          <b>MAQUETTE</b>
          {' · données de démonstration, date figée au '}
          {new Intl.DateTimeFormat('fr-FR').format(new Date(DATE_DEMO_ISO))}
          {' ; seuls les écrans marqués « Données réelles » enregistrent, dans la base locale de ce navigateur'}
        </span>
      ) : (
        <span>
          <b>DONNÉES RÉELLES</b>
          {' · date du jour, base locale de ce navigateur, sans donnée de démonstration'}
        </span>
      )}
      <button
        type="button"
        className="btn sm"
        style={{
          marginLeft: 12,
          padding: '2px 10px',
          fontSize: 11,
        }}
        onClick={basculerMode}
        onBlur={() => setConfirmation(false)}
      >
        {libelleBouton}
      </button>
    </div>
  )
}
