import type { HTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Pulse.module.css'

export type PulseProps = HTMLAttributes<HTMLSpanElement>

/**
 * Point indicateur animé v54 — port pixel-perfect du `.pulse` du bundle V5.7.
 *
 * Nu : juste le dot 7×7 #ef4444 avec halo paper et pulsation 2.4s. Le
 * positionnement (ex `position:absolute; top:7px; right:7px`) est posé par le
 * consommateur (NotifsPopover, bell badge…), pas par la primitive. Les props
 * span (style, className…) sont spreadées pour permettre ce positionnement.
 *
 * aria-hidden : le compteur lisible est porté par l'aria-label du bouton hôte.
 */
export default function Pulse({ className, ...props }: PulseProps) {
  return <span aria-hidden="true" className={clsx(styles.pulse, className)} {...props} />
}
