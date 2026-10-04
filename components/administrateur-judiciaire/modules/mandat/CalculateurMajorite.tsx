'use client'

import { useState } from 'react'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  MAJORITES_AG,
  calculerMajoriteAG,
  type TypeMajorite,
} from '@/lib/administrateur-judiciaire/domain/majorites-ag'

/** Champs saisis du calculateur (chaînes brutes des inputs numériques). */
export type ChampVoteCalculateur = 'pour' | 'contre' | 'abstention' | 'membresPour'

export type SaisieVoteCalculateur = Record<ChampVoteCalculateur, string>

export interface CalculateurMajoriteProps {
  /** Tantièmes totaux de la copropriété (10 000 par défaut). */
  voixTotales?: number
  /** Nombre de copropriétaires (0 par défaut, affiché « ? »). */
  membresTotaux?: number
  /** Origine des chiffres, ajoutée au sous-titre. */
  source?: string
}

const SAISIE_VIDE: SaisieVoteCalculateur = {
  pour: '',
  contre: '',
  abstention: '',
  membresPour: '',
}

/**
 * Calculateur de majorité d'assemblée générale (L. 1965 art. 24, 25, 25-1, 26, 26-1). Le résultat n'apparaît
 * qu'une fois des voix « pour » ou « contre » saisies ; le nombre de copropriétaires pour n'est demandé qu'en art. 26.
 */
export function CalculateurMajorite({ voixTotales = 10000, membresTotaux = 0, source }: CalculateurMajoriteProps) {
  const [majorite, setMajorite] = useState<TypeMajorite>('art25'),
    [saisie, setSaisie] = useState<SaisieVoteCalculateur>(SAISIE_VIDE),
    nombre = (champ: ChampVoteCalculateur) => Number(String(saisie[champ]).replace(',', '.')) || 0,
    resultat = calculerMajoriteAG(
      {
        voixTotales,
        membresTotaux,
        pour: nombre('pour'),
        contre: nombre('contre'),
        abstention: nombre('abstention'),
        membresPour: nombre('membresPour'),
      },
      majorite,
    ),
    voteSaisi = saisie.pour !== '' || saisie.contre !== '',
    champVoix = (champ: ChampVoteCalculateur, libelle: string) => (
      <label
        style={{
          display: 'grid',
          gap: 4,
          fontSize: 12,
        }}
      >
        {libelle}
        <input
          type="number"
          min="0"
          value={saisie[champ]}
          onChange={(evenement) =>
            setSaisie((precedente) => ({
              ...precedente,
              [champ]: evenement.target.value,
            }))
          }
          aria-label={libelle}
          style={{
            maxWidth: 140,
          }}
        />
      </label>
    )
  return (
    <Panel
      title="Calculateur de majorité"
      sub={`${voixTotales} voix · ${membresTotaux || '?'} copropriétaires${source ? ` · ${source}` : ''} · L. 1965 art. 24, 25, 25-1, 26, 26-1`}
      icon="scale"
    >
      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          alignItems: 'end',
        }}
      >
        <label
          style={{
            display: 'grid',
            gap: 4,
            fontSize: 12,
          }}
        >
          Majorité
          <select
            value={majorite}
            onChange={(evenement) => setMajorite(evenement.target.value as TypeMajorite)}
            aria-label="Majorité"
          >
            {Object.entries(MAJORITES_AG).map(([cle, definition]) => (
              <option value={cle} key={cle}>
                {definition.libelle}
                {' · '}
                {definition.base}
              </option>
            ))}
          </select>
        </label>
        {champVoix('pour', 'Voix pour')}
        {champVoix('contre', 'Voix contre')}
        {champVoix('abstention', 'Abstentions')}
        {majorite === 'art26' && champVoix('membresPour', 'Copropriétaires pour (nombre)')}
      </div>
      <p
        style={{
          fontSize: 12,
          color: 'var(--navy-500)',
          margin: '8px 0 0',
        }}
      >
        {MAJORITES_AG[majorite].exemples}.
      </p>
      {voteSaisi && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--paper)',
          }}
        >
          <Pill kind={resultat.adopte ? 'sage' : 'rust'} noDot>
            {resultat.adopte ? 'Adoptée' : 'Rejetée'}
          </Pill>
          <span
            style={{
              marginLeft: 10,
              fontSize: 13,
            }}
          >
            {resultat.detail}
          </span>
          {resultat.passerelle && (
            <div
              style={{
                fontSize: 12,
                marginTop: 6,
                color: resultat.passerelle.possible ? 'var(--navy-700)' : 'var(--navy-300)',
              }}
            >
              <b>{resultat.passerelle.article === 'art25-1' ? 'Art. 25-1' : 'Art. 26-1'}</b>
              {' · '}
              {resultat.passerelle.detail}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
