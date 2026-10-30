import type { ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

/**
 * Briques des fiches détaillées (copropriétaire, prestataire) sur le modèle des fiches Gestéam : blocs titrés, couples
 * libellé / valeur, petits tableaux et cases en lecture seule.
 */

export const STYLE_LIBELLE_FICHE = {
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--navy-300)',
  fontWeight: 600,
  marginBottom: 3,
} as const

const STYLE_CELLULE = {
  padding: '5px 6px',
  borderBottom: '1px solid var(--line)',
  fontSize: 12.5,
  color: 'var(--navy-700)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

/** Couple libellé / valeur, comme la fiche détail (« · » pour une valeur vide). */
export function Champ({ k, v, full }: { k: string; v: ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <div style={STYLE_LIBELLE_FICHE}>{k}</div>
      <div style={{ fontSize: 13.5, color: 'var(--navy-700)' }}>{v === '' || v === null || v === undefined ? '·' : v}</div>
    </div>
  )
}

/** Bloc de la fiche, sur une colonne ou sur toute la largeur (région nommée par son titre). */
export function Section({ titre, icone, large, children }: { titre: string; icone: string; large?: boolean; children: ReactNode }) {
  return (
    <section
      aria-label={titre}
      style={{
        gridColumn: large ? '1 / -1' : undefined,
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '12px 14px',
        minWidth: 0,
      }}
    >
      <h3
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          margin: '0 0 10px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--navy-500)',
        }}
      >
        <Icon name={icone} />
        {titre}
      </h3>
      {children}
    </section>
  )
}

/** Grille des blocs d'une fiche : deux colonnes, une seule sur écran étroit. */
export function GrilleFiche({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>{children}</div>
}

/** Grille de champs sur deux colonnes (ou `colonnes`). */
export function Grille({ colonnes = 2, children }: { colonnes?: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))`, gap: '10px 16px' }}>
      {children}
    </div>
  )
}

/** Petit tableau à en-têtes, largeurs de colonne en % ; `vide` s'affiche s'il n'a aucune ligne. */
export function Tableau({
  entetes,
  largeurs,
  lignes,
  vide = 'Aucune ligne.',
}: {
  entetes: string[]
  largeurs: number[]
  lignes: ReactNode[][]
  vide?: string
}) {
  if (lignes.length === 0)
    return (
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        {vide}
      </p>
    )
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        {largeurs.map((largeur, index) => (
          <col key={index} style={{ width: `${largeur}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {entetes.map((entete) => (
            <th
              key={entete}
              style={{ ...STYLE_LIBELLE_FICHE, textAlign: 'left', padding: '0 6px 4px', borderBottom: '1px solid var(--line)' }}
            >
              {entete}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((ligne, index) => (
          <tr key={index}>
            {ligne.map((cellule, colonne) => (
              <td key={colonne} style={STYLE_CELLULE}>
                {cellule}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Case en lecture seule, lisible par un lecteur d'écran. */
export function Case({ libelle, cochee }: { libelle: string; cochee: boolean }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--navy-700)' }}>
      <input type="checkbox" checked={cochee} disabled readOnly />
      {libelle}
    </label>
  )
}
