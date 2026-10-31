import type { CSSProperties } from 'react'

/**
 * Showcase visuel de tous les design tokens v54.
 *
 * Aucune primitive utilisée ici (juste div / h1 / span etc.) : c'est l'étape a
 * pure, validant que les CSS variables --v54-* résolvent correctement et que
 * les 3 fontes (next/font/local) chargent à 0 FOUT.
 *
 * Critères acceptance :
 *   - Hex exact lu en DevTools sur chaque swatch
 *   - Lighthouse audit `unused-font` = 0
 *   - Bundle de la page < 30 KB gzipped
 */

type Swatch = { name: string; varName: string; description?: string }
type SwatchGroup = { title: string; items: Swatch[] }

const SWATCH_GROUPS: SwatchGroup[] = [
  {
    title: 'Navy — texte sidebar et corps',
    items: [
      { name: '#0B1828', varName: '--v54-navy-900', description: 'Sidebar background, h1 sur fond clair' },
      { name: '#0F1F32', varName: '--v54-navy-800' },
      { name: '#14283F', varName: '--v54-navy-700', description: 'Hero card background' },
      { name: '#1B324B', varName: '--v54-navy-600' },
      { name: '#2A4663', varName: '--v54-navy-500', description: 'Texte corps secondaire' },
      { name: '#5A6D82', varName: '--v54-navy-400' },
      { name: '#556679', varName: '--v54-navy-350' },
      { name: '#5A6B7D', varName: '--v54-navy-300', description: 'Texte muted, captions' },
      { name: '#7D8A99', varName: '--v54-navy-200' },
      { name: '#C7D0DB', varName: '--v54-navy-100' },
    ],
  },
  {
    title: 'Gold — accents premium',
    items: [
      { name: '#846838', varName: '--v54-gold-700', description: 'Eyebrow text, arrow hover' },
      { name: '#B7944F', varName: '--v54-gold-600' },
      { name: '#C9A574', varName: '--v54-gold-500', description: 'Active nav border, brand mark gradient' },
      { name: '#D9BC92', varName: '--v54-gold-400', description: 'Active nav text, italic accents' },
      { name: '#F1E6D2', varName: '--v54-gold-100' },
      { name: '#F8F2E6', varName: '--v54-gold-50' },
    ],
  },
  {
    title: 'Cream / Paper / Ink — fonds et texte principal',
    items: [
      { name: '#F4EFE4', varName: '--v54-cream', description: 'Quick action icon background, list bg' },
      { name: '#EAE3D2', varName: '--v54-cream-2' },
      { name: '#FBF8F1', varName: '--v54-paper', description: 'Page background' },
      { name: '#1A1A1A', varName: '--v54-ink', description: 'Texte principal' },
    ],
  },
  {
    title: 'Sage — succès',
    items: [
      { name: '#2F5C49', varName: '--v54-sage-700', description: 'KPI success text' },
      { name: '#3F7A60', varName: '--v54-sage-500', description: 'KPI accent, dot status' },
      { name: '#DCE8DF', varName: '--v54-sage-100' },
      { name: '#ECF2EC', varName: '--v54-sage-50' },
    ],
  },
  {
    title: 'Rust — erreur',
    items: [
      { name: '#8E4327', varName: '--v54-rust-700' },
      { name: '#B65A36', varName: '--v54-rust-500' },
      { name: '#F1DDD0', varName: '--v54-rust-100' },
      { name: '#F9EEE5', varName: '--v54-rust-50' },
    ],
  },
  {
    title: 'Amber — warning',
    items: [
      { name: '#976C24', varName: '--v54-amber-700' },
      { name: '#C58A30', varName: '--v54-amber-500' },
      { name: '#F2E2C0', varName: '--v54-amber-100' },
      { name: '#F8EFDA', varName: '--v54-amber-50' },
    ],
  },
]

const RADII = [
  { name: '--v54-r-sm', value: 6 },
  { name: '--v54-r-md', value: 10 },
  { name: '--v54-r-lg', value: 14 },
  { name: '--v54-r-xl', value: 18 },
]

const SHADOWS = [
  { name: '--v54-shadow-card', description: 'Card subtile (Panel, KPI)' },
  { name: '--v54-shadow-hero', description: 'Hero card (Painel de controlo)' },
]

const TYPO_SAMPLES = [
  { tag: 'h1', size: 48, weight: 500, family: 'var(--v54-font-serif)', label: 'Bem-vindo, Super Admin', italicTail: '— exercício 2026' },
  { tag: 'h2', size: 32, weight: 500, family: 'var(--v54-font-serif)', label: 'Painel de controlo' },
  { tag: 'h3', size: 24, weight: 500, family: 'var(--v54-font-serif)', label: 'Orçamento global' },
  { tag: 'body 400', size: 14, weight: 400, family: 'var(--v54-font-sans)', label: 'Síntese mensal de exercício — operação estável' },
  { tag: 'body 500', size: 14, weight: 500, family: 'var(--v54-font-sans)', label: 'Síntese mensal de exercício — operação estável' },
  { tag: 'body 600', size: 14, weight: 600, family: 'var(--v54-font-sans)', label: 'Síntese mensal de exercício — operação estável' },
  { tag: 'body 700', size: 14, weight: 700, family: 'var(--v54-font-sans)', label: 'Síntese mensal de exercício — operação estável' },
  { tag: 'mono', size: 13, weight: 500, family: 'var(--v54-font-mono)', label: '#MSN-2026-1311 · 188 000 € · 2,5%' },
]

const sectionHeader: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '40px 0 16px',
}

const captionStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--v54-navy-300)',
  marginTop: 4,
  fontFamily: 'var(--v54-font-mono)',
}

export default function SyndicV54DevTokensPage() {
  return (
    <main style={{ maxWidth: 1180 }}>
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--v54-gold-700)',
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        VitFix Syndic Dashboard · V5.4 design system · étape a
      </p>
      <h1
        style={{
          fontFamily: 'var(--v54-font-serif)',
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        Tokens <span style={{ fontStyle: 'italic', color: 'var(--v54-gold-700)' }}>v54</span>
      </h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 12, marginBottom: 0 }}>
        56 CSS variables scopées sous <code style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12 }}>#syndic-dashboard-v54</code>.
        3 fontes self-hosted via <code style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12 }}>next/font/local</code>.
      </p>

      {SWATCH_GROUPS.map((group) => (
        <section key={group.title}>
          <h2 style={sectionHeader}>{group.title}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {group.items.map((item) => (
              <div key={item.varName} style={{ background: '#fff', borderRadius: 'var(--v54-r-md)', overflow: 'hidden', border: '1px solid var(--v54-line)' }}>
                <div
                  style={{
                    width: '100%',
                    height: 80,
                    background: `var(${item.varName})`,
                  }}
                  aria-label={`${item.varName} ${item.name}`}
                />
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12, color: 'var(--v54-navy-900)' }}>{item.name}</div>
                  <div style={captionStyle}>{item.varName}</div>
                  {item.description && (
                    <div style={{ fontSize: 11, color: 'var(--v54-navy-500)', marginTop: 4 }}>{item.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 style={sectionHeader}>Radii</h2>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {RADII.map((r) => (
            <div key={r.name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  background: 'var(--v54-cream)',
                  border: '1px solid var(--v54-line)',
                  borderRadius: `var(${r.name})`,
                }}
              />
              <div style={{ ...captionStyle, marginTop: 8 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--v54-navy-500)' }}>{r.value}px</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={sectionHeader}>Shadows</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {SHADOWS.map((s) => (
            <div
              key={s.name}
              style={{
                background: '#fff',
                borderRadius: 'var(--v54-r-lg)',
                padding: 24,
                boxShadow: `var(${s.name})`,
                border: '1px solid var(--v54-line)',
              }}
            >
              <div style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--v54-navy-500)', marginTop: 4 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={sectionHeader}>Typographie</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          {TYPO_SAMPLES.map((sample) => (
            <div key={sample.tag} style={{ background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 'var(--v54-r-md)', padding: '16px 20px' }}>
              <div
                style={{
                  fontFamily: sample.family,
                  fontWeight: sample.weight,
                  fontSize: sample.size,
                  lineHeight: 1.2,
                  color: 'var(--v54-navy-900)',
                }}
              >
                {sample.label}
                {sample.italicTail && (
                  <span style={{ fontStyle: 'italic', color: 'var(--v54-gold-700)' }}> {sample.italicTail}</span>
                )}
              </div>
              <div style={{ ...captionStyle, marginTop: 8 }}>
                {sample.tag} · {sample.size}px · weight {sample.weight}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
