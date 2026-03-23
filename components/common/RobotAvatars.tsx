// Avatars robot centralisés — Fixy (doré), Max (bleu indigo), Léa (violet)
// Source de vérité : public/robots-design.html

// ═══ FIXY — Robot jaune avec loupe (SVG) ═══
export function FixyAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="50" cy="68" rx="22" ry="20" fill="#FFC107"/>
      <ellipse cx="50" cy="68" rx="18" ry="16" fill="#FFD54F"/>
      {/* Belly circle */}
      <circle cx="50" cy="70" r="6" fill="#FF9800" opacity="0.3"/>
      {/* Head */}
      <ellipse cx="50" cy="34" rx="20" ry="18" fill="#FFD54F"/>
      <ellipse cx="50" cy="34" rx="18" ry="16" fill="#FFECB3"/>
      {/* Screen/face area */}
      <rect x="34" y="24" width="32" height="18" rx="6" fill="#1a1a2e"/>
      {/* Eyes */}
      <ellipse cx="43" cy="32" rx="4" ry="4.5" fill="white"/>
      <ellipse cx="57" cy="32" rx="4" ry="4.5" fill="white"/>
      <circle cx="43" cy="32" r="2.5" fill="#1a1a2e"/>
      <circle cx="57" cy="32" r="2.5" fill="#1a1a2e"/>
      {/* Eye shine */}
      <circle cx="44.5" cy="30.5" r="1" fill="white"/>
      <circle cx="58.5" cy="30.5" r="1" fill="white"/>
      {/* Smile */}
      <path d="M44 37 Q50 41 56 37" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Antenna */}
      <line x1="50" y1="16" x2="50" y2="8" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="50" cy="6" r="3.5" fill="#FF9800"/>
      <circle cx="50" cy="6" r="2" fill="#FFC107"/>
      {/* Ears */}
      <rect x="14" y="28" width="6" height="10" rx="3" fill="#FFC107"/>
      <rect x="80" y="28" width="6" height="10" rx="3" fill="#FFC107"/>
      {/* Arms */}
      <ellipse cx="22" cy="62" rx="6" ry="5" fill="#FFD54F"/>
      <ellipse cx="78" cy="62" rx="6" ry="5" fill="#FFD54F"/>
      {/* Magnifying glass in right hand */}
      <g transform="translate(78, 52) rotate(-30)">
        <rect x="-2" y="8" width="4" height="14" rx="2" fill="#78909C"/>
        <circle cx="0" cy="4" r="8" fill="none" stroke="#90CAF9" strokeWidth="3"/>
        <circle cx="0" cy="4" r="5" fill="#E3F2FD" opacity="0.6"/>
        <circle cx="-2" cy="2" r="2" fill="white" opacity="0.5"/>
      </g>
      {/* Legs */}
      <rect x="38" y="86" width="8" height="8" rx="4" fill="#FFC107"/>
      <rect x="54" y="86" width="8" height="8" rx="4" fill="#FFC107"/>
      {/* Feet */}
      <ellipse cx="42" cy="95" rx="6" ry="3" fill="#FF9800"/>
      <ellipse cx="58" cy="95" rx="6" ry="3" fill="#FF9800"/>
    </svg>
  )
}

// ═══ MAX — Mascotte 3D : robot bleu, toge avocat, toque, lunettes, livre ═══
export function MaxAvatar({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/max-avatar.png"
      alt="Max — Expert-Conseil IA"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 36 ? 12 : 8 }}
      draggable={false}
    />
  )
}

// ═══ LÉA — Robot violet, cheveux, cils, calculatrice, pendentif ═══
export function LeaAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Body */}
      <path d="M28 46 Q26 46 26 50 L26 76 Q26 80 30 80 L70 80 Q74 80 74 76 L74 50 Q74 46 72 46 Z" fill="#9C27B0"/>
      {/* Head */}
      <rect x="27" y="16" width="46" height="32" rx="14" fill="#CE93D8"/>
      {/* Hair */}
      <path d="M27 32 Q24 10 38 8 Q50 6 62 8 Q76 10 73 32" fill="#7B1FA2"/>
      <path d="M30 28 Q30 16 40 15 L38 24 Z" fill="#6A1B9A"/>
      <path d="M70 28 Q70 16 60 15 L62 24 Z" fill="#6A1B9A"/>
      <path d="M38 8 Q44 4 50 8 Q56 4 62 8 Q58 10 50 9 Q42 10 38 8" fill="#6A1B9A"/>
      {/* Side hair strands */}
      <path d="M24 32 Q22 42 24 50" stroke="#7B1FA2" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M76 32 Q78 42 76 50" stroke="#7B1FA2" strokeWidth="4" strokeLinecap="round" fill="none"/>
      {/* Antenna */}
      <line x1="50" y1="8" x2="50" y2="-1" stroke="#CE93D8" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Eyes (kawaii) */}
      <ellipse cx="38" cy="30" rx="5.5" ry="6" fill="#1a1a2e"/>
      <ellipse cx="62" cy="30" rx="5.5" ry="6" fill="#1a1a2e"/>
      <circle cx="40" cy="28" r="2.2" fill="white"/>
      <circle cx="64" cy="28" r="2.2" fill="white"/>
      <circle cx="36.5" cy="31.5" r="1" fill="white" opacity="0.5"/>
      <circle cx="60.5" cy="31.5" r="1" fill="white" opacity="0.5"/>
      {/* Eyelashes */}
      <line x1="33" y1="25" x2="30" y2="21" stroke="#4A148C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="35.5" y1="24" x2="34" y2="20" stroke="#4A148C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="38" y1="23.5" x2="37.5" y2="19.5" stroke="#4A148C" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="62" y1="23.5" x2="62.5" y2="19.5" stroke="#4A148C" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="64.5" y1="24" x2="66" y2="20" stroke="#4A148C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="67" y1="25" x2="70" y2="21" stroke="#4A148C" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Blush */}
      <ellipse cx="31" cy="35" rx="4" ry="3" fill="#F48FB1" opacity="0.35"/>
      <ellipse cx="69" cy="35" rx="4" ry="3" fill="#F48FB1" opacity="0.35"/>
      {/* Smile */}
      <path d="M42 39 Q50 44.5 58 39" stroke="#AD1457" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Beauty mark */}
      <circle cx="62" cy="38" r="0.8" fill="#4A148C"/>
      {/* Necklace */}
      <path d="M35 48 Q42 55 50 53 Q58 55 65 48" stroke="#FFB74D" strokeWidth="1.2" fill="none"/>
      {/* Pendant */}
      <path d="M47 53 L50 58 L53 53 Z" fill="#FF9800"/>
      <path d="M48 53.5 L50 56 L52 53.5 Z" fill="#FFD54F"/>
      {/* Euro emblem */}
      <circle cx="50" cy="57" r="4.5" fill="#FFD54F" stroke="#FF9800" strokeWidth="1.2"/>
      <text x="50" y="60" textAnchor="middle" fontSize="7" fontWeight="900" fill="#7B1FA2">€</text>
      {/* Arms */}
      <rect x="13" y="52" width="13" height="5.5" rx="3" fill="#CE93D8"/>
      <circle cx="12" cy="55" r="3" fill="#D1A0DB"/>
      <rect x="74" y="52" width="13" height="5.5" rx="3" fill="#CE93D8"/>
      {/* Calculator */}
      <g transform="translate(84,42) rotate(8)">
        <rect x="-8" y="0" width="16" height="20" rx="2.5" fill="#E1BEE7"/>
        <rect x="-8" y="0" width="16" height="6" rx="2.5" fill="#4A148C"/>
        <rect x="-6" y="1.5" width="12" height="3.5" rx="1" fill="#B39DDB"/>
        <rect x="-6" y="8" width="3.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="-1.5" y="8" width="3.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="3" y="8" width="3.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="-6" y="12" width="3.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="-1.5" y="12" width="3.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="3" y="12" width="3.5" height="2.5" rx="0.8" fill="#FF9800"/>
        <rect x="-6" y="16" width="7.5" height="2.5" rx="0.8" fill="#AB47BC"/>
        <rect x="3" y="16" width="3.5" height="2.5" rx="0.8" fill="#4CAF50"/>
      </g>
      {/* Belt */}
      <rect x="30" y="64" width="40" height="3.5" rx="2" fill="#6A1B9A"/>
      <rect x="46" y="63" width="8" height="5.5" rx="1.5" fill="#FFB74D"/>
      <rect x="48" y="64.5" width="4" height="2.5" rx="0.5" fill="#6A1B9A"/>
      {/* Legs */}
      <rect x="34" y="80" width="9" height="14" rx="4.5" fill="#CE93D8"/>
      <rect x="57" y="80" width="9" height="14" rx="4.5" fill="#CE93D8"/>
      {/* Shoes */}
      <path d="M32 93 Q34 90 38.5 90 Q43 90 43 93 Q43 96 38 96 Q33 96 32 93" fill="#6A1B9A"/>
      <path d="M57 93 Q59 90 61.5 90 Q66 90 66 93 Q66 96 62 96 Q58 96 57 93" fill="#6A1B9A"/>
      {/* Heels */}
      <rect x="32" y="94" width="2.5" height="3" rx="1" fill="#4A148C"/>
      <rect x="64" y="94" width="2.5" height="3" rx="1" fill="#4A148C"/>
    </svg>
  )
}
