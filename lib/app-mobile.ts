// ── Appli Vitfix Pro (Capacitor) ─────────────────────────────────────────────
// L'appli Android et iPhone affiche le site (server.url de capacitor.config.ts) et injecte son pont JavaScript
// (`window.Capacitor`) dans les pages de vitfix.io avant leurs propres scripts. Côté navigateur seulement : faux sur
// le serveur et dans un navigateur ordinaire (où `@capacitor/core`, s'il est chargé, répond aussi faux).

interface FenetreCapacitor {
  Capacitor?: { isNativePlatform?: () => boolean }
}

export function estAppMobile(): boolean {
  if (typeof window === 'undefined') return false
  const { Capacitor } = window as Window & FenetreCapacitor
  return typeof Capacitor?.isNativePlatform === 'function' && Capacitor.isNativePlatform() === true
}
