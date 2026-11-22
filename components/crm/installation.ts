// ── CRM du secrétariat : installation de l'application sur l'ordinateur ─────
// Chrome et Edge annoncent qu'une page est installable par l'événement « beforeinstallprompt » (manifeste
// lib/crm/manifeste.ts). On le garde pour proposer le bouton « Installer » dans l'écran, qui ouvre la fenêtre
// d'installation du navigateur. Firefox et Safari n'émettent pas cet événement : le bouton n'y apparaît pas. Sur
// ordinateur, l'icône d'installation de la barre d'adresse et le menu du navigateur restent disponibles en plus.
//
// Ordinateur seulement : le CRM s'installe sur le poste du secrétariat ; sur un téléphone, le texte (« une icône sur le
// bureau ») serait faux et l'écran reste ouvert dans le navigateur.
//
// L'écoute commence au chargement du module, et non au montage de l'écran : l'événement peut arriver avant.

export interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type IssueInstallation = 'acceptee' | 'refusee' | 'indisponible'

let evenementGarde: EvenementInstallation | null = null
const abonnes = new Set<() => void>()

function prevenir(): void {
  for (const rappel of abonnes) rappel()
}

function estEvenementInstallation(e: Event): e is EvenementInstallation {
  return typeof (e as Partial<EvenementInstallation>).prompt === 'function'
}

/** Poste avec souris ou pavé tactile, et navigateur qui ne se déclare pas mobile. */
export function surOrdinateur(): boolean {
  const indices = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (indices?.mobile === true) return false
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    if (!estEvenementInstallation(e)) return
    // Retient la mini-bannière d'installation d'Android ; sur ordinateur, l'icône de la barre d'adresse reste affichée.
    e.preventDefault()
    evenementGarde = e
    prevenir()
  })
  window.addEventListener('appinstalled', () => {
    evenementGarde = null
    prevenir()
  })
}

export function abonnerInstallation(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => {
    abonnes.delete(rappel)
  }
}

/** Vrai quand le navigateur propose l'installation sur un ordinateur (bouton à afficher). */
export function installationPossible(): boolean {
  return evenementGarde !== null && surOrdinateur()
}

/**
 * Ouvre la fenêtre d'installation du navigateur. Un événement ne sert qu'une fois : il est oublié quelle que soit la
 * réponse (le navigateur en émet un nouveau au prochain chargement si l'application n'est pas installée).
 */
export async function lancerInstallation(): Promise<IssueInstallation> {
  const evenement = evenementGarde
  if (!evenement) return 'indisponible'
  evenementGarde = null
  prevenir()
  await evenement.prompt()
  const { outcome } = await evenement.userChoice
  return outcome === 'accepted' ? 'acceptee' : 'refusee'
}
