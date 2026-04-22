import { ImageResponse } from 'next/og'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'VITFIX'
  const subtitle = searchParams.get('subtitle') || 'Profissionais verificados'

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        padding: '60px',
      }}>
        <div style={{ fontSize: '28px', color: '#FFD600', marginBottom: '20px', fontWeight: 'bold' }}>
          VITFIX
        </div>
        <div style={{ fontSize: '48px', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', lineHeight: 1.2, maxWidth: '900px' }}>
          {title}
        </div>
        <div style={{ fontSize: '24px', color: '#999999', marginTop: '16px', textAlign: 'center' }}>
          {subtitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
