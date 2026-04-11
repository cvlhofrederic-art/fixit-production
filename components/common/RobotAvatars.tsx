// Avatars robot centralisés — Fixy (doré), Max (bleu indigo), Léa (violet)
// Source de vérité : public/robots-design.html

// ═══ FIXY — Robot doré avec clé à molette ═══
export function FixyAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/>
      {/* Head */}
      <rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
      {/* Eyes */}
      <circle cx="40" cy="30" r="5" fill="#1a1a2e"/>
      <circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
      {/* Eye shine */}
      <circle cx="42" cy="28" r="1.5" fill="white"/>
      <circle cx="62" cy="28" r="1.5" fill="white"/>
      {/* Smile */}
      <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Antenna */}
      <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="50" cy="6" r="4" fill="#FF9800"/>
      {/* Arms */}
      <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
      {/* Wrench in right hand */}
      <g transform="translate(72, 42) rotate(30)">
        <rect x="0" y="8" width="5" height="20" rx="2" fill="#78909C"/>
        <circle cx="2.5" cy="6" r="7" fill="none" stroke="#78909C" strokeWidth="4"/>
        <circle cx="2.5" cy="6" r="3" fill="#FFD54F"/>
      </g>
      {/* Legs */}
      <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      <rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      {/* Belt detail */}
      <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/>
      {/* Chest bolt */}
      <circle cx="50" cy="55" r="3" fill="#FF9800"/>
    </svg>
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
