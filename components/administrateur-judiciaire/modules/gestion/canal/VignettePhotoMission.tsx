export interface VignettePhotoMissionProps {
  /** Légende de la photo (tronquée, reprise en infobulle). */
  label: string
}

/** Vignette factice d'une photo transmise via l'app (pictogramme d'image sur fond dégradé, légende en dessous). */
export function VignettePhotoMission({ label }: VignettePhotoMissionProps) {
  return (
    <div
      style={{
        minWidth: 0,
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 8,
          background: 'linear-gradient(135deg,#e9e5de,#d6cfc4)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="#9a948a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="M21 16l-5-5-8 7" />
        </svg>
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--navy-400)',
          marginTop: 4,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {label}
      </div>
    </div>
  )
}
