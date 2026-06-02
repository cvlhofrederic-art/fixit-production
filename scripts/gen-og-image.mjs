// Générateur des images Open Graph VITFIX (1200×630) — aperçus WhatsApp / réseaux.
// Reflète la VRAIE landing page (app/page.tsx + landing-v2.module.css) :
// fond blanc, titre noir + accent jaune, badge + chips de confiance, carte de
// réservation. Wordmark « VIT » jaune + « FIX » noir (cf. components/common/Header.tsx).
// Police Montserrat embarquée en base64 → rendu déterministe via sharp/librsvg.
//
// Usage : node scripts/gen-og-image.mjs <pt|fr|en> [sortie.png]
//   FONT_DIR (env) : dossier des .ttf Montserrat (défaut /tmp/og-fonts)
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const LOCALE = (process.argv[2] || 'pt').toLowerCase()
const OUT = process.argv[3] || `/tmp/og-${LOCALE}.png`
const FONT_DIR = process.env.FONT_DIR || '/tmp/og-fonts'
const b64 = (f) => readFileSync(`${FONT_DIR}/${f}`).toString('base64')
const F = { black: b64('Montserrat-Black.ttf'), bold: b64('Montserrat-Bold.ttf'), medium: b64('Montserrat-Medium.ttf') }

const C = { yellow: '#FFD600', ink: '#0D0D0D', sub: '#555555', chipBg: '#F4F4F2', cardLine: '#ECECEC', input: '#FAFAFA', inputPh: '#9A9A9A', region: '#8A8A82', white: '#FFFFFF' }

// Contenu par langue (miroir de la landing)
const L = {
  pt: {
    badge: 'Profissionais verificados · Resposta em 2h',
    l1: 'Encontre e reserve o seu', l2a: 'profissional', l2b: 'online',
    sub: 'Profissionais certificados e segurados, perto de si.',
    chips: ['Verificados', 'Orçamento grátis', 'Resposta 2h'],
    card: { title: 'Reservar em 2 cliques', in1: 'O que precisa?', in2: 'Onde? (cidade)', btn: 'Procurar profissional', c1: 'Resposta em 2h', c2: 'Profissionais verificados' },
    region: 'Marco de Canaveses · Porto · Tâmega e Sousa',
  },
  fr: {
    badge: 'Artisans vérifiés · Réponse en 2h',
    l1: 'Trouvez et réservez votre', l2a: 'artisan', l2b: 'en ligne',
    sub: 'Artisans certifiés et assurés, près de chez vous.',
    chips: ['Vérifiés', 'Devis gratuit', 'Réponse 2h'],
    card: { title: 'Réserver en 2 clics', in1: 'Que recherchez-vous ?', in2: 'Où ? (ville)', btn: 'Trouver un artisan', c1: 'Réponse en 2h', c2: 'Artisans vérifiés' },
    region: 'Marseille · Aix-en-Provence · PACA',
  },
  en: {
    badge: 'Verified professionals · Reply in 2h',
    l1: 'Find and book your', l2a: 'professional', l2b: 'online',
    sub: 'Certified, insured professionals near you.',
    chips: ['Verified', 'Free quote', '2h reply'],
    card: { title: 'Book in 2 clicks', in1: 'What do you need?', in2: 'Where? (city)', btn: 'Find a professional', c1: 'Reply in 2h', c2: 'Verified professionals' },
    region: 'Porto · Tâmega e Sousa · Portugal',
  },
}[LOCALE]
if (!L) { console.error(`Locale inconnue: ${LOCALE} (pt|fr|en)`); process.exit(1) }

const check = (cx, cy, r = 11) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.yellow}"/>` +
  `<path d="M ${cx - 5} ${cy} L ${cx - 1} ${cy + 4.5} L ${cx + 6} ${cy - 5}" stroke="${C.ink}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`

// Chips à largeur dynamique (selon la longueur du libellé)
let cx = 80
const chipsSvg = L.chips.map((label) => {
  const w = Math.round(67 + label.length * 10.2)
  const g = `<rect x="${cx}" y="392" width="${w}" height="44" rx="22" fill="${C.chipBg}"/>` +
    check(cx + 25, 414, 10) +
    `<text x="${cx + 45}" y="421" font-family="MMed" font-size="19" fill="${C.ink}">${label}</text>`
  cx += w + 14
  return g
}).join('\n  ')

const badgeW = Math.round(48 + L.badge.length * 9.7)
const CARD = { x: 794, y: 122, w: 332, h: 386 }

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      @font-face { font-family:'MBlack'; src:url(data:font/ttf;base64,${F.black})  format('truetype'); }
      @font-face { font-family:'MBold';  src:url(data:font/ttf;base64,${F.bold})   format('truetype'); }
      @font-face { font-family:'MMed';   src:url(data:font/ttf;base64,${F.medium}) format('truetype'); }
    </style>
  </defs>

  <rect width="1200" height="630" fill="${C.white}"/>

  <text x="80" y="98" font-family="MBlack" font-size="44" letter-spacing="-1"><tspan fill="${C.yellow}">VIT</tspan><tspan fill="${C.ink}">FIX</tspan></text>

  <rect x="80" y="124" width="${badgeW}" height="42" rx="21" fill="${C.yellow}"/>
  <text x="104" y="151" font-family="MBold" font-size="18" fill="${C.ink}">${L.badge}</text>

  <text x="78" y="240" font-family="MBlack" font-size="47" letter-spacing="-1" fill="${C.ink}">${L.l1}</text>
  <text x="78" y="300" font-family="MBlack" font-size="47" letter-spacing="-1"><tspan fill="${C.ink}">${L.l2a}</tspan><tspan dx="18" fill="${C.yellow}">${L.l2b}</tspan></text>

  <text x="80" y="352" font-family="MMed" font-size="23" fill="${C.sub}">${L.sub}</text>

  ${chipsSvg}

  <rect x="${CARD.x + 7}" y="${CARD.y + 12}" width="${CARD.w}" height="${CARD.h}" rx="20" fill="#000000" opacity="0.06"/>
  <rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="20" fill="${C.white}" stroke="${C.cardLine}" stroke-width="1.5"/>
  <text x="${CARD.x + 28}" y="${CARD.y + 52}" font-family="MBold" font-size="23" fill="${C.ink}">${L.card.title}</text>
  <rect x="${CARD.x + 24}" y="${CARD.y + 74}" width="${CARD.w - 48}" height="52" rx="11" fill="${C.input}" stroke="#EDEDED"/>
  <text x="${CARD.x + 42}" y="${CARD.y + 106}" font-family="MMed" font-size="18" fill="${C.inputPh}">${L.card.in1}</text>
  <rect x="${CARD.x + 24}" y="${CARD.y + 138}" width="${CARD.w - 48}" height="52" rx="11" fill="${C.input}" stroke="#EDEDED"/>
  <text x="${CARD.x + 42}" y="${CARD.y + 170}" font-family="MMed" font-size="18" fill="${C.inputPh}">${L.card.in2}</text>
  <rect x="${CARD.x + 24}" y="${CARD.y + 206}" width="${CARD.w - 48}" height="54" rx="11" fill="${C.yellow}"/>
  <text x="${CARD.x + CARD.w / 2}" y="${CARD.y + 240}" font-family="MBold" font-size="19" fill="${C.ink}" text-anchor="middle">${L.card.btn}</text>
  ${check(CARD.x + 34, CARD.y + 300, 9)}<text x="${CARD.x + 52}" y="${CARD.y + 305}" font-family="MMed" font-size="17" fill="${C.sub}">${L.card.c1}</text>
  ${check(CARD.x + 34, CARD.y + 334, 9)}<text x="${CARD.x + 52}" y="${CARD.y + 339}" font-family="MMed" font-size="17" fill="${C.sub}">${L.card.c2}</text>

  <text x="80" y="556" font-family="MBold" font-size="24" fill="${C.ink}">vitfix.io</text>
  <text x="80" y="588" font-family="MMed" font-size="18" fill="${C.region}">${L.region}</text>
</svg>`

const png = await sharp(Buffer.from(svg)).png().toBuffer()
writeFileSync(OUT, png)
console.log(`OK [${LOCALE}] → ${OUT} (${png.length} octets)`)
