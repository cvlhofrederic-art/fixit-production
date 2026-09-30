export interface ToggleProps {
  on?: boolean
  onToggle?: () => void
}

/** Interrupteur (role=switch) activable au clic, à Entrée ou à Espace. */
export function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div
      className={`toggle ${on ? 'on' : ''}`}
      onClick={onToggle}
      role="switch"
      aria-checked={!!on}
      tabIndex={0}
      onKeyDown={(evenement) => {
        if (evenement.key === 'Enter' || evenement.key === ' ') {
          evenement.preventDefault()
          if (onToggle) onToggle()
        }
      }}
    />
  )
}
