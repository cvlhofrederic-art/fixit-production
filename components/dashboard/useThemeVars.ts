/**
 * useThemeVars — Returns CSS variable strings for v5 or v22 theme.
 *
 * Usage:
 *   const tv = useThemeVars(isV5)
 *   <div style={{ color: tv.text, borderColor: tv.border }}>
 */

export interface ThemeVars {
  // Text
  text: string
  textMuted: string
  textMid: string
  textSecondary: string
  // Backgrounds
  bg: string
  cardBg: string
  contentBg: string
  // Borders
  border: string
  borderDark: string
  // Accents
  primary: string
  primaryDark: string
  primaryLight: string
  primaryBorder: string
  primaryBg: string
  // Semantic
  green: string
  red: string
  redBg: string
  // Extra
  greenLight: string
  surface: string
  // Shadows
  shadow: string
  shadowHover: string
}

const v5Vars: ThemeVars = {
  text: '#1a1a1a',
  textMuted: '#BBB',
  textMid: '#999',
  textSecondary: '#666',
  bg: '#FAFAFA',
  cardBg: '#fff',
  contentBg: '#FAFAFA',
  border: '#E0E0E0',
  borderDark: '#CCC',
  primary: '#F57C00',
  primaryDark: '#EF6C00',
  primaryLight: '#FFF3E0',
  primaryBorder: '#F57C00',
  primaryBg: '#FFF8E1',
  green: '#4CAF50',
  red: '#E53935',
  redBg: '#FFEBEE',
  greenLight: '#E8F5E9',
  surface: '#fff',
  shadow: '0 1px 3px rgba(0,0,0,.06)',
  shadowHover: '0 2px 8px rgba(0,0,0,.1)',
}

const v22Vars: ThemeVars = {
  text: 'var(--v22-text)',
  textMuted: 'var(--v22-text-muted)',
  textMid: 'var(--v22-text-mid)',
  textSecondary: 'var(--v22-text-mid)',
  bg: 'var(--v22-bg)',
  cardBg: 'var(--v22-card-bg, #fff)',
  contentBg: 'var(--v22-bg)',
  border: 'var(--v22-border)',
  borderDark: 'var(--v22-border-dark)',
  primary: 'var(--v22-yellow)',
  primaryDark: 'var(--v22-yellow-dark, #F5A623)',
  primaryLight: 'var(--v22-yellow-light)',
  primaryBorder: 'var(--v22-yellow-border)',
  primaryBg: 'var(--v22-yellow-bg, #FFFDE7)',
  green: 'var(--v22-green, #4CAF50)',
  red: 'var(--v22-red, #E53935)',
  redBg: 'var(--v22-red-bg, #FFEBEE)',
  greenLight: 'var(--v22-green-light, #E8F5E9)',
  surface: 'var(--v22-surface, #fff)',
  shadow: '0 1px 3px rgba(0,0,0,.06)',
  shadowHover: '0 2px 8px rgba(0,0,0,.1)',
}

export function useThemeVars(isV5: boolean): ThemeVars {
  return isV5 ? v5Vars : v22Vars
}
