'use client'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

const SIZES: Record<NonNullable<Props['size']>, number> = {
  sm: 48,
  md: 72,
  lg: 96,
}

export function AlfredoMascot({ size = 'md', glow = true }: Props) {
  const px = SIZES[size]
  return (
    <div
      role="img"
      aria-label="Alfredo"
      style={{
        width: px,
        height: px,
        fontSize: px * 0.7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.18), rgba(244, 222, 159, 0.32))',
        boxShadow: glow ? '0 0 24px rgba(212, 175, 55, 0.35)' : 'none',
        userSelect: 'none',
      }}
    >
      📧
    </div>
  )
}
