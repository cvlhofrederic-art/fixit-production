import { Icon, ICON_NAMES } from '@/components/syndic-dashboard/v54/primitives/icon'

/**
 * Showcase Icon — grille des 103 icônes du registre v54 à 24px avec leur nom.
 *
 * QA visuel clé (demande Claude Chat) : si une icône rend le glyphe `doc`
 * (document) au lieu de son vrai dessin, c'est que son path est cassé /
 * absent → repérable en un coup d'œil sur cette grille.
 *
 * Sizing : les icônes sont dimensionnées par CSS contextuel ici (.v54-icon-cell
 * svg { width:24px }) — exactement comme le bundle dimensionne via le parent,
 * pas via une prop size.
 */

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

export default function IconShowcasePage() {
  return (
    <div>
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
        Primitive · batch 1
      </p>
      <h1
        style={{
          fontFamily: 'var(--v54-font-serif)',
          fontWeight: 500,
          fontSize: 32,
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        Icon
      </h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        {ICON_NAMES.length} icônes. viewBox 0 0 24 24, stroke currentColor, strokeWidth 1.8,
        round. Dimensionnement 100 % CSS externe (pas de prop size). Fallback{' '}
        <code style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12 }}>doc</code> si name absent.
      </p>

      {/* Variants : 3 tailles via CSS contextuel */}
      <h2 style={sectionHeader}>Tailles (CSS contextuel : 16 / 20 / 24px)</h2>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, color: 'var(--v54-navy-700)' }}>
        {([16, 20, 24] as const).map((px) => (
          <div key={px} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', width: px, height: px }}>
              <Icon name="bell" style={{ width: px, height: px }} />
            </span>
            <span style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 11, color: 'var(--v54-navy-300)' }}>
              {px}px
            </span>
          </div>
        ))}
      </div>

      {/* Sample colorisé (stroke hérite de currentColor) */}
      <h2 style={sectionHeader}>Couleur (héritée de currentColor)</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        {(
          [
            ['var(--v54-navy-700)', 'navy-700'],
            ['var(--v54-gold-600)', 'gold-600'],
            ['var(--v54-sage-500)', 'sage-500'],
            ['var(--v54-rust-500)', 'rust-500'],
          ] as const
        ).map(([color, label]) => (
          <div key={label} style={{ color, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sparkle" style={{ width: 24, height: 24 }} />
            <span style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Grille exhaustive des 103 — QA fallback doc */}
      <h2 style={sectionHeader}>Registre complet ({ICON_NAMES.length} icônes · 24px)</h2>
      <div
        data-testid="icon-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 4,
        }}
      >
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            title={name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '16px 8px 10px',
              border: '1px solid var(--v54-line)',
              borderRadius: 'var(--v54-r-md)',
              background: '#fff',
              color: 'var(--v54-navy-700)',
            }}
          >
            <Icon name={name} style={{ width: 24, height: 24 }} />
            <span
              style={{
                fontFamily: 'var(--v54-font-mono)',
                fontSize: 9.5,
                color: 'var(--v54-navy-300)',
                textAlign: 'center',
                wordBreak: 'break-all',
                lineHeight: 1.3,
              }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
