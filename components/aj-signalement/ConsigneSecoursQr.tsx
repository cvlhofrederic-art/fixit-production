// ── Consigne d'appel aux secours de la page publique « AJ Signalement » ───────────
//
// R70 du dossier téléphonie (14/11/2026) : une urgence déclarée par QR code n'alerte aucun secours. BROUILLON (textes à
// valider par Hugo, présentation par Frédéric, portugais H4), composant du socle seulement (Encadre, tons existants) :
//   - ConsigneSecoursQr : consigne permanente, en tête du formulaire, avant les coordonnées (ton « info ») ;
//   - ConsigneSecoursUrgenteQr : consigne renforcée (ton « avertissement »), sous le choix d'urgence quand « urgent »
//     est choisi et sur la confirmation d'un signalement urgent.
// Accessibilité : rôle « status » de l'Encadre (annonce polie, jamais une alerte) ; aucune région vivante en plus, pour
// que rien ne soit lu deux fois ; le focus ne bouge pas. Textes : lib/aj-signalement/textes.ts.

import { Encadre } from '@/components/coproprietaire-dashboard/ui'
import type { TextesSignalementQr } from '@/lib/aj-signalement/textes'

export function ConsigneSecoursQr({ tq }: Readonly<{ tq: TextesSignalementQr }>) {
  return <Encadre ton="info">{tq.consigneSecours}</Encadre>
}

export function ConsigneSecoursUrgenteQr({ tq, className }: Readonly<{ tq: TextesSignalementQr; className?: string }>) {
  return (
    <Encadre ton="avertissement" className={className}>
      <p className="font-semibold">{tq.consigneSecoursUrgente.titre}</p>
      <p className="mt-1">{tq.consigneSecoursUrgente.texte}</p>
    </Encadre>
  )
}
