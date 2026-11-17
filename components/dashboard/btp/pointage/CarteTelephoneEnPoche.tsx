'use client'

import { Smartphone } from 'lucide-react'
import type { useArrierePlan } from './useArrierePlan'
import {
  messageAucuneZone,
  messageAutorisationArrierePlan,
  messageErreurPointage,
  messageZonesArrierePlan,
  messageZonesIncompletes,
  noticeArrierePlan,
  statutArrierePlan,
} from './textes'

// Carte « Téléphone en poche » de l'onglet Pointer : seulement dans l'appli Vitfix Pro, mode automatique activé par le
// gérant et compte relié à sa fiche employé. Information bien en vue avant la demande d'autorisation du système.

interface Props {
  arrierePlan: ReturnType<typeof useArrierePlan>
  isPt: boolean
}

/** Texte secondaire : gris assez foncé pour un contraste lisible en petite taille (comme OngletPointer). */
const GRIS = '#555'

function BoutonReglages({ arrierePlan, isPt }: Props) {
  return (
    <button type="button" className="v5-btn v5-btn-sm" onClick={() => { void arrierePlan.reglages() }}>
      {isPt ? 'Abrir as definições' : 'Ouvrir les réglages'}
    </button>
  )
}

/** Ce qui se dit sous l'état : chantiers suivis (activé), base pas à jour, aucun chantier localisé, ou l'information. */
function Explication({ arrierePlan, isPt }: Props) {
  const { etat, zones, surveillees, baseDisponible } = arrierePlan
  if (etat === 'zones_indisponibles') {
    return <p style={{ fontSize: 12, color: GRIS, margin: '0 0 10px' }}>{messageZonesIncompletes(surveillees ?? 0, zones, isPt)}</p>
  }
  if (etat === 'actif' || etat === 'sans_autorisation') {
    return <p style={{ fontSize: 12, color: GRIS, margin: '0 0 10px' }}>{messageZonesArrierePlan(zones, isPt)}</p>
  }
  if (!baseDisponible) return <p style={{ fontSize: 12, color: GRIS, margin: '0 0 10px' }}>{messageErreurPointage('migration_requise_appareils', isPt)}</p>
  if (zones === 0) return <p style={{ fontSize: 12, color: GRIS, margin: '0 0 10px' }}>{messageAucuneZone(isPt)}</p>
  return (
    <ul style={{ fontSize: 12, color: GRIS, margin: '0 0 10px', paddingLeft: 18 }}>
      {noticeArrierePlan(isPt).map(point => <li key={point}>{point}</li>)}
    </ul>
  )
}

export function CarteTelephoneEnPoche({ arrierePlan, isPt }: Props) {
  const { etat, occupe, autorisation, zones, baseDisponible } = arrierePlan
  if (etat === 'indisponible') return null
  const active = etat === 'actif' || etat === 'sans_autorisation' || etat === 'zones_indisponibles'
  const avertir = etat === 'sans_autorisation' || etat === 'zones_indisponibles'
  const demandeRefusee = !active && (autorisation === 'partielle' || autorisation === 'refusee')

  return (
    <div className="v5-card">
      <div className="v5-st" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Smartphone size={14} aria-hidden="true" /> {isPt ? 'Marcação com o telemóvel no bolso' : 'Pointage téléphone en poche'}
      </div>
      <p style={{ fontSize: 13, margin: '0 0 10px' }} role={avertir ? 'alert' : undefined}>
        {statutArrierePlan(etat, isPt)}
      </p>
      <Explication arrierePlan={arrierePlan} isPt={isPt} />
      {demandeRefusee && (
        <div className="v5-al warn" role="alert" style={{ marginBottom: 10 }}>
          {messageAutorisationArrierePlan(autorisation, isPt)}
          <div style={{ marginTop: 8 }}><BoutonReglages arrierePlan={arrierePlan} isPt={isPt} /></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {avertir && <BoutonReglages arrierePlan={arrierePlan} isPt={isPt} />}
        {active ? (
          <button type="button" className="v5-btn v5-btn-s" disabled={occupe} onClick={() => { void arrierePlan.couper() }}>
            {isPt ? 'Desligar neste telemóvel' : 'Couper sur ce téléphone'}
          </button>
        ) : (
          <button
            type="button"
            className="v5-btn v5-btn-p"
            disabled={occupe || !baseDisponible || zones === 0}
            onClick={() => { void arrierePlan.activer() }}
          >
            {isPt ? 'Ativar neste telemóvel' : 'Activer sur ce téléphone'}
          </button>
        )}
        {occupe && <span style={{ fontSize: 12, color: GRIS }}>{isPt ? 'Um momento…' : 'Un instant…'}</span>}
      </div>
    </div>
  )
}
