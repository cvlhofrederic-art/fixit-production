import { ImageResponse } from 'next/og'

// iOS Safari requires PNG pour l'apple-touch-icon (SVG pas supporté
// avant iOS 17.4). Next.js convention : app/apple-icon.tsx → /apple-icon
// servi automatiquement comme <link rel="apple-touch-icon">.
//
// Référence : nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 900,
          fontSize: 130,
          letterSpacing: '-0.06em',
        }}
      >
        <span style={{ color: '#FFD600' }}>V</span>
        <span style={{ color: '#111110' }}>F</span>
      </div>
    ),
    { ...size },
  )
}
