import { ImageResponse } from 'next/og'

// Génération dynamique des images Open Graph (1200×630) — aperçus WhatsApp / réseaux.
// Style aligné sur la VRAIE landing page (fond blanc, logo VIT jaune + FIX noir,
// badge + titre + chips de confiance + carte de réservation). Chaque page passe son
// propre titre/sous-titre/langue → image unique par page (méthode pro, cf. audit SEO-08).
//
// Params : ?title=...&subtitle=...&eyebrow=...&locale=pt|fr|en
// Polices Montserrat servies depuis /public/fonts (fetch origine, fallback police par défaut).

const YELLOW = '#FFD600'
const INK = '#0D0D0D'
const SUB = '#555555'
const CHIP_BG = '#F4F4F2'
const CARD_LINE = '#ECECEC'
const INPUT_BG = '#FAFAFA'
const INPUT_PH = '#9A9A9A'
const REGION = '#8A8A82'

type Loc = {
  badge: string; chips: string[]; region: string; defTitle: string; defSub: string
  card: { title: string; in1: string; in2: string; btn: string }
}
const LOCALES: Record<string, Loc> = {
  pt: {
    badge: 'Profissionais verificados · Resposta em 2h',
    chips: ['Verificados', 'Orçamento grátis', 'Resposta 2h'],
    region: 'Marco de Canaveses · Porto · Tâmega e Sousa',
    defTitle: 'Encontre e reserve o seu profissional online',
    defSub: 'Profissionais certificados e segurados, perto de si.',
    card: { title: 'Reservar em 2 cliques', in1: 'O que precisa?', in2: 'Onde? (cidade)', btn: 'Procurar profissional' },
  },
  fr: {
    badge: 'Artisans vérifiés · Réponse en 2h',
    chips: ['Vérifiés', 'Devis gratuit', 'Réponse 2h'],
    region: 'Marseille · Aix-en-Provence · PACA',
    defTitle: 'Trouvez et réservez votre artisan en ligne',
    defSub: 'Artisans certifiés et assurés, près de chez vous.',
    card: { title: 'Réserver en 2 clics', in1: 'Que recherchez-vous ?', in2: 'Où ? (ville)', btn: 'Trouver un artisan' },
  },
  en: {
    badge: 'Verified professionals · Reply in 2h',
    chips: ['Verified', 'Free quote', '2h reply'],
    region: 'Porto · Tâmega e Sousa · Portugal',
    defTitle: 'Find and book your professional online',
    defSub: 'Certified, insured professionals near you.',
    card: { title: 'Book in 2 clicks', in1: 'What do you need?', in2: 'Where? (city)', btn: 'Find a professional' },
  },
}

function Check({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: 'flex' }}>
      <circle cx="11" cy="11" r="11" fill={YELLOW} />
      <path d="M6 11 L9.3 14.3 L16 7.6" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const locale = (searchParams.get('locale') || 'fr').toLowerCase()
  const L = LOCALES[locale] || LOCALES.fr
  const title = (searchParams.get('title') || L.defTitle).slice(0, 90)
  const subtitle = (searchParams.get('subtitle') || L.defSub).slice(0, 130)
  const eyebrow = (searchParams.get('eyebrow') || L.badge).slice(0, 60)
  const titleSize = title.length > 46 ? 44 : title.length > 30 ? 50 : 56

  // Polices Montserrat en WOFF (extensions exclues du middleware locale, cf. matcher).
  // Fetch origine + vérif res.ok ; fallback police par défaut si indispo (jamais de 500).
  const loadFont = async (file: string) => {
    const r = await fetch(`${origin}/fonts/${file}`)
    if (!r.ok) throw new Error(`font ${file} ${r.status}`)
    return r.arrayBuffer()
  }
  let fonts: { name: string; data: ArrayBuffer; weight: 500 | 900; style: 'normal' }[] | undefined
  try {
    const [black, medium] = await Promise.all([loadFont('Montserrat-900.woff'), loadFont('Montserrat-500.woff')])
    fonts = [
      { name: 'Montserrat', data: black, weight: 900, style: 'normal' },
      { name: 'Montserrat', data: medium, weight: 500, style: 'normal' },
    ]
  } catch {
    fonts = undefined
  }

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#FFFFFF', fontFamily: 'Montserrat', padding: '64px 70px' }}>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          {/* Colonne gauche : texte */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 40 }}>
            <div style={{ display: 'flex', fontSize: 42, fontWeight: 900, letterSpacing: -1 }}>
              <span style={{ color: YELLOW }}>VIT</span>
              <span style={{ color: INK }}>FIX</span>
            </div>
            <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 22, background: YELLOW, color: INK, fontSize: 18, fontWeight: 900, padding: '9px 20px', borderRadius: 999 }}>
              {eyebrow}
            </div>
            <div style={{ display: 'flex', marginTop: 26, fontSize: titleSize, fontWeight: 900, color: INK, lineHeight: 1.06, letterSpacing: -1 }}>
              {title}
            </div>
            <div style={{ display: 'flex', marginTop: 18, fontSize: 24, fontWeight: 500, color: SUB, lineHeight: 1.3 }}>
              {subtitle}
            </div>
            <div style={{ display: 'flex', marginTop: 30, gap: 12 }}>
              {L.chips.map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', background: CHIP_BG, borderRadius: 999, padding: '9px 16px 9px 12px' }}>
                  <Check size={22} />
                  <span style={{ marginLeft: 8, fontSize: 18, fontWeight: 500, color: INK }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Colonne droite : carte de réservation */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 330, background: '#FFFFFF', border: `1px solid ${CARD_LINE}`, borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.10)', padding: 26 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: INK }}>{L.card.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 18, height: 50, background: INPUT_BG, border: '1px solid #EEEEEE', borderRadius: 11, padding: '0 16px', fontSize: 17, fontWeight: 500, color: INPUT_PH }}>{L.card.in1}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, height: 50, background: INPUT_BG, border: '1px solid #EEEEEE', borderRadius: 11, padding: '0 16px', fontSize: 17, fontWeight: 500, color: INPUT_PH }}>{L.card.in2}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16, height: 52, background: YELLOW, borderRadius: 11, fontSize: 18, fontWeight: 900, color: INK }}>{L.card.btn}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
              <Check size={18} />
              <span style={{ marginLeft: 8, fontSize: 16, fontWeight: 500, color: SUB }}>{L.chips[0]}</span>
            </div>
          </div>
        </div>
        {/* Pied */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: INK }}>vitfix.io</span>
          <span style={{ marginLeft: 16, fontSize: 17, fontWeight: 500, color: REGION }}>{L.region}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts ? { fonts } : {}),
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    },
  )
}
