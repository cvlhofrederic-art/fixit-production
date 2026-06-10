'use client'

import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'

/** Réservation des espaces communs — port FR du ModReservaEsp du mockup v8
 * (mini-calendrier mensuel). Réutilise les classes CSS globales `calendar / dow /
 * day / ev` du module PT (components/syndic-dashboard/v54/modules/reservaesp.css,
 * chargé par le layout) ; textes et données du mockup FR. */

const DOWS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** [espace, couleur de légende] */
const SPACES: [string, string][] = [
  ['Salle commune', 'var(--v54-gold-500)'],
  ['Local vélos', 'var(--v54-sage-500)'],
  ['Parking visiteurs', 'var(--v54-rust-500)'],
  ['Terrasse', 'var(--v54-sage-700)'],
  ['Buanderie', 'var(--v54-amber-500)'],
  ['Salle de réunion', 'var(--v54-gold-700)'],
]

// Juin 2026 commence un lundi (1er = lundi) → 30 jours, pas de décalage (0 = case vide).
const DAYS: number[] = Array.from({ length: 35 }, (_, i) => (i < 30 ? i + 1 : 0))

const legendSwatch = { width: 8, height: 8, borderRadius: 2, display: 'inline-block', marginRight: 4 } as const

// Reset des styles UA du <button> (le mockup utilisait un <div onClick> — converti
// en bouton pour l'a11y) : le reste du visuel vient de la classe globale `.day`.
const dayBtnReset: CSSProperties = {
  font: 'inherit',
  textAlign: 'left',
  width: '100%',
  margin: 0,
  borderTop: 'none',
  borderLeft: 'none',
  appearance: 'none',
}

export default function ModReservation() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Réservation des espaces communs"
        lede="Gérez les réservations, les espaces et les règles d'utilisation de la copropriété."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle réservation', desc: 'Réserver un espace commun' })}><Icon name="plus" />Nouvelle réservation</Button>} />
      <Tabs defaultActive="cal" tabs={[
        { id: 'cal', icon: 'calendar', label: 'Calendrier' },
        { id: 'esp', icon: 'home', label: 'Espaces' },
        { id: 'reg', icon: 'clipboard', label: 'Règles' },
        { id: 'rel', icon: 'chart', label: 'Rapport' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {SPACES.map((l, i) => (
          <Pill key={i} noDot><span style={{ ...legendSwatch, background: l[1] }} />{l[0]}</Pill>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" aria-label="Mois précédent" onClick={() => push({ kind: 'info', title: 'Mois précédent' })}>←</Button>
        <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, padding: '8px 16px' }}>Juin 2026</div>
        <Button variant="ghost" aria-label="Mois suivant" onClick={() => push({ kind: 'info', title: 'Mois suivant' })}>→</Button>
        <Button onClick={() => push({ kind: 'info', title: 'Aujourd\'hui', desc: 'Calendrier centré sur la date du jour' })}>Aujourd'hui</Button>
        <Button onClick={() => push({ kind: 'info', title: 'Vue semaine', desc: 'Affichage hebdomadaire' })}>Semaine</Button>
        <Button variant="primary" onClick={() => push({ kind: 'info', title: 'Vue mois', desc: 'Affichage mensuel' })}>Mois</Button>
      </div>
      <Panel flush>
        <div className="calendar">
          {DOWS.map(d => <div key={d} className="dow">{d}</div>)}
          {DAYS.map((n, i) => (
            n === 0 ? (
              <div key={i} className="day muted" />
            ) : (
              <button key={i} type="button" className={clsx('day', n === 4 && 'today')} style={dayBtnReset}
                onClick={() => push({ kind: 'info', title: `${n} juin`, desc: 'Voir les réservations du jour' })}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{n}</div>
                {n === 5 && <div className="ev gold">14:00 Salle réunion</div>}
                {n === 8 && <><div className="ev gold">10:00 Salle commune</div><div className="ev green">18:00 Terrasse</div></>}
                {n === 11 && <div className="ev green">17:30 Local vélos</div>}
                {n === 15 && <><div className="ev gold">09:00 Salle réunion</div><div className="ev green">14:00 Terrasse</div></>}
                {n === 22 && <div className="ev gold">18:30 Salle commune (CS)</div>}
                {n === 27 && <div className="ev green">11:00 Buanderie</div>}
              </button>
            )
          ))}
        </div>
      </Panel>
    </>
  )
}
