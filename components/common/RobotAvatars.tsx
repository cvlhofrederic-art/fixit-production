// Avatars robot centralisés — chaque agent a son image dédiée dans public/
// Pattern : <img src="/{agent}-avatar.webp"> + borderRadius conditionnel

// ═══ FIXY — Robot jaune avec loupes (secrétaire IA, recherche) ═══
export function FixyAvatar({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/fixy-avatar.webp"
      alt="Fixy — Secrétaire IA"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 36 ? 12 : 8 }}
      draggable={false}
    />
  )
}

// ═══ MAX — Mascotte 3D : robot bleu, toge avocat, toque, lunettes, livre ═══
export function MaxAvatar({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/max-avatar.webp"
      alt="Max — Expert-Conseil IA"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 36 ? 12 : 8 }}
      draggable={false}
    />
  )
}

// ═══ LÉA — Robot 3D experte comptable ═══
export function LeaAvatar({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/lea-avatar.webp"
      alt="Léa — Experte Comptable IA"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 36 ? 12 : 8 }}
      draggable={false}
    />
  )
}

// ═══ ALFREDO — Robot détective steampunk gestionnaire emails ═══
export function AlfredoAvatar({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/alfredo-avatar.webp"
      alt="Alfredo — Gestionnaire Emails IA"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 36 ? 12 : 8 }}
      draggable={false}
    />
  )
}
