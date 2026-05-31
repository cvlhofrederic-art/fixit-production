import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './SectionDivider.module.css'

export interface SectionDividerProps {
  /** Sur-titre (uppercase, lettré) — optionnel. */
  eyebrow?: ReactNode
  /** Titre serif de la section. */
  title: ReactNode
  /** Sous-titre descriptif — optionnel. */
  sub?: ReactNode
}

/**
 * Séparateur de section — port byte-exact de `window.UI.SectionDivider`
 * du bundle V5.7 (assets L39192-39201) : tick gold-500 en haut à gauche,
 * eyebrow uppercase, titre Cormorant, sous-titre. Voir la note dans
 * `SectionDivider.module.css` sur la bordure (token --gold-200 non défini
 * dans le bundle → aucune bordure rendue, reproduit à l'identique).
 */
export default function SectionDivider({ eyebrow, title, sub }: Readonly<SectionDividerProps>) {
  return (
    <div className={styles.divider}>
      <div aria-hidden="true" className={styles.tick}><div className={styles.tickBar}></div></div>
      {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
      <div className={clsx(styles.title, sub && styles.titleGap)}>{title}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
